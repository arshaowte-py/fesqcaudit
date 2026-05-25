import fs from 'fs/promises';
import path from 'path';
import { kv } from '@vercel/kv';

const SECTIONS = [
  { id: 'S1', count: 5 },
  { id: 'S2', count: 1 },
  { id: 'S3', count: 1 },
  { id: 'S4', count: 17 },
  { id: 'S5', count: 5 },
  { id: 'S6', count: 6 },
  { id: 'S7', count: 35 },
];

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'audits.json');

const AUDITS_HASH = 'frido:audits:v2';
const LEGACY_KV_KEY = 'frido:audits';
const LEGACY_INDEX_KEY = 'frido:audits:index';
const LEGACY_KEY_PREFIX = 'frido:audit:';
const TEST_STORE_PREFIX = 'KV Smoke ';

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function buildAuditEnvelope(audit) {
  return { kind: 'audit', audit, deletedAt: null };
}

function buildTombstone(timestamp) {
  return { kind: 'tombstone', deletedAt: new Date().toISOString(), timestamp };
}

function isTombstone(entry) {
  return entry && entry.kind === 'tombstone';
}

function isAuditEnvelope(entry) {
  return entry && entry.kind === 'audit' && entry.audit;
}

function parseHashValue(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    if (raw.kind === 'audit' || raw.kind === 'tombstone') return raw;
    // Pre-envelope payload: treat the stored object as an audit body.
    if (raw.storeName && raw.timestamp) {
      return { kind: 'audit', audit: raw, deletedAt: null };
    }
  }
  return null;
}

function parseAuditItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  }
  return item;
}

function isSmokeTestAudit(audit) {
  return String(audit?.storeName || '').startsWith(TEST_STORE_PREFIX);
}

function isWrongTypeError(err) {
  const msg = String(err?.message || err || '');
  return msg.includes('WRONGTYPE') || msg.includes('wrong kind');
}

/* ------------------------------------------------------------------ */
/* File-mode helpers (used when KV is not configured)                  */
/* ------------------------------------------------------------------ */

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ audits: [] }, null, 2), 'utf8');
  }
}

async function readAuditsFromFile() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.audits) ? parsed.audits : [];
}

async function writeAuditsToFile(audits) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify({ audits }, null, 2), 'utf8');
}

/* ------------------------------------------------------------------ */
/* KV-mode helpers (Redis hash, one field per audit)                  */
/* ------------------------------------------------------------------ */

async function purgeLegacyDataIfPresent() {
  /* The earlier deploys experimented with two other key shapes:
   *   - `frido:audits` as a JSON array / Redis list
   *   - `frido:audits:index` as a set + `frido:audit:<ts>` per audit
   *
   * Those keys are no longer authoritative. We must delete them
   * rather than migrate, because reading them from a stale replica
   * (and writing the values back into the v2 hash) overwrites the
   * authoritative state including tombstones.
   *
   * This function only deletes. It is idempotent and safe to call
   * many times: once the keys are gone it becomes a no-op. */

  try {
    await kv.del(LEGACY_KV_KEY);
  } catch {
    /* ignore */
  }
  try {
    await kv.del(LEGACY_INDEX_KEY);
  } catch {
    /* ignore */
  }

  try {
    const keys = await kv.keys(`${LEGACY_KEY_PREFIX}*`);
    if (Array.isArray(keys) && keys.length) {
      for (const k of keys) {
        try {
          await kv.del(k);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

let migrationPromise = null;
async function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = purgeLegacyDataIfPresent().catch((err) => {
      migrationPromise = null;
      throw err;
    });
  }
  return migrationPromise;
}

async function readAuditsFromKv() {
  try {
    await ensureMigrated();
  } catch (err) {
    console.error('Migration error:', err);
  }

  /* Upstash Redis on the Vercel marketplace defaults to a globally
   * replicated database with eventual consistency. Each serverless
   * invocation tends to be pinned to one replica, so we poll a few
   * times with backoff and merge the responses. Audits and
   * tombstones are stored in the same hash, and the merge prefers
   * tombstones so that deletes propagate as soon as the marker
   * reaches any replica we see. */

  const attempts = 4;
  const delaysMs = [0, 120, 280, 520];

  const envelopes = new Map();
  let sawValidResponse = false;
  let lastError = null;

  for (let i = 0; i < attempts; i++) {
    if (delaysMs[i]) {
      await new Promise((resolve) => setTimeout(resolve, delaysMs[i]));
    }
    try {
      const entries = await kv.hgetall(AUDITS_HASH);
      sawValidResponse = true;
      if (!entries) continue;

      for (const [ts, value] of Object.entries(entries)) {
        if (!ts) continue;
        const parsed = parseHashValue(value);
        if (!parsed) continue;

        const existing = envelopes.get(ts);
        if (!existing) {
          envelopes.set(ts, parsed);
          continue;
        }

        // Tombstones win once observed by any replica.
        if (isTombstone(parsed) && !isTombstone(existing)) {
          envelopes.set(ts, parsed);
        }
      }
    } catch (err) {
      lastError = err;
      if (isWrongTypeError(err)) {
        try {
          await kv.del(AUDITS_HASH);
        } catch {
          /* ignore */
        }
        envelopes.clear();
      }
    }
  }

  if (!sawValidResponse && lastError) {
    throw lastError;
  }

  const audits = [];
  for (const entry of envelopes.values()) {
    if (isAuditEnvelope(entry)) audits.push(entry.audit);
  }

  audits.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime() || 0;
    const tb = new Date(b.timestamp).getTime() || 0;
    return ta - tb;
  });

  return audits;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function calculateSectionScores(sections) {
  return SECTIONS.map((sec) => {
    const sectionData = sections[sec.id] || {};
    let yesCount = 0;
    for (let q = 1; q <= sec.count; q++) {
      const cp = sectionData[`Q${q}`];
      if (cp && cp.answer === 'YES') yesCount++;
    }
    return yesCount;
  });
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export async function getAllAudits() {
  if (isKvConfigured()) {
    return readAuditsFromKv();
  }

  const audits = await readAuditsFromFile();
  const cleaned = audits.filter((a) => !isSmokeTestAudit(a));
  if (cleaned.length !== audits.length) {
    await writeAuditsToFile(cleaned);
  }
  return cleaned;
}

export async function addAudit(payload) {
  const {
    storeName,
    location,
    auditorName,
    auditeeName,
    visitDate,
    sections,
    photos,
  } = payload;

  const sectionScoresArray = calculateSectionScores(sections);
  const sectionScores = {};
  SECTIONS.forEach((sec, index) => {
    sectionScores[sec.id] = sectionScoresArray[index];
  });

  const totalScore = sectionScoresArray.reduce((sum, score) => sum + score, 0);
  const timestamp = new Date().toISOString();

  const audit = {
    timestamp,
    storeName,
    location: location || '',
    auditorName,
    auditeeName: auditeeName || '',
    visitDate,
    sectionScores,
    totalScore,
    checkpoints: sections,
    photos: photos || [],
  };

  let rowNumber;

  if (isKvConfigured()) {
    try {
      await ensureMigrated();
    } catch (err) {
      console.error('Migration before add failed:', err);
    }

    try {
      await kv.hset(AUDITS_HASH, {
        [timestamp]: JSON.stringify(buildAuditEnvelope(audit)),
      });
    } catch (err) {
      if (isWrongTypeError(err)) {
        await kv.del(AUDITS_HASH);
        await kv.hset(AUDITS_HASH, {
          [timestamp]: JSON.stringify(buildAuditEnvelope(audit)),
        });
      } else {
        throw err;
      }
    }

    const count = await kv.hlen(AUDITS_HASH);
    rowNumber = typeof count === 'number' ? count : null;
  } else {
    const audits = await readAuditsFromFile();
    const cleaned = audits.filter((a) => !isSmokeTestAudit(a));
    cleaned.push(audit);
    await writeAuditsToFile(cleaned);
    rowNumber = cleaned.length;
  }

  return {
    totalScore,
    sectionScores: sectionScoresArray,
    timestamp,
    rowNumber,
  };
}

export async function deleteAudit({ timestamp, storeName } = {}) {
  if (!timestamp) {
    throw new Error('Missing audit timestamp');
  }

  if (isKvConfigured()) {
    const existingRaw = await kv.hget(AUDITS_HASH, timestamp);
    const existingEnvelope = parseHashValue(existingRaw);

    let existingAudit = null;
    if (isAuditEnvelope(existingEnvelope)) {
      existingAudit = existingEnvelope.audit;
    } else if (
      existingEnvelope &&
      !isTombstone(existingEnvelope) &&
      existingEnvelope.storeName &&
      existingEnvelope.timestamp
    ) {
      existingAudit = existingEnvelope;
    }

    if (!existingAudit) {
      // Already tombstoned or never existed.
      if (isTombstone(existingEnvelope)) {
        return { deleted: 0 };
      }
      throw new Error('Audit not found');
    }
    if (storeName && existingAudit.storeName !== storeName) {
      throw new Error('Audit not found');
    }

    /* Write a tombstone for this timestamp. We keep the field in the
     * hash so the read-side merge sees the tombstone everywhere it
     * eventually propagates, even across stale replicas. */
    await kv.hset(AUDITS_HASH, {
      [timestamp]: JSON.stringify(buildTombstone(timestamp)),
    });
    return { deleted: 1 };
  }

  const audits = await readAuditsFromFile();
  const next = audits.filter((audit) => {
    if (audit.timestamp !== timestamp) return true;
    if (storeName && audit.storeName !== storeName) return true;
    return false;
  });

  if (next.length === audits.length) {
    throw new Error('Audit not found');
  }

  await writeAuditsToFile(next);
  return { deleted: audits.length - next.length };
}

export async function getPhotos({ timestamp, store } = {}) {
  const audits = await getAllAudits();
  const photos = [];

  for (const audit of audits) {
    for (const photo of audit.photos || []) {
      const entry = {
        timestamp: audit.timestamp,
        storeName: audit.storeName,
        section: photo.section,
        checkpoint: photo.checkpoint,
        data: photo.data,
      };

      if (timestamp && entry.timestamp !== timestamp) continue;
      if (store && entry.storeName !== store) continue;

      photos.push(entry);
    }
  }

  return photos;
}

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
const AUDITS_KV_KEY = 'frido:audits';
const TEST_STORE_PREFIX = 'KV Smoke ';

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
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

async function readAuditsFromKv() {
  try {
    const stored = await kv.get(AUDITS_KV_KEY);
    if (Array.isArray(stored)) {
      return stored.filter(Boolean);
    }
  } catch (err) {
    const msg = String(err?.message || err);
    if (!msg.includes('WRONGTYPE') && !msg.includes('wrong kind')) {
      throw err;
    }
  }

  try {
    const items = await kv.lrange(AUDITS_KV_KEY, 0, -1);
    if (!items?.length) return [];

    const audits = items.map(parseAuditItem).filter(Boolean);
    await kv.del(AUDITS_KV_KEY);
    await kv.set(AUDITS_KV_KEY, audits);
    return audits;
  } catch (err) {
    console.error('KV read/migration failed:', err);
    throw err;
  }
}

async function readAudits() {
  if (isKvConfigured()) {
    try {
      return await readAuditsFromKv();
    } catch (err) {
      console.error('KV read failed:', err);
      throw err;
    }
  }

  return readAuditsFromFile();
}

async function writeAudits(audits) {
  if (isKvConfigured()) {
    try {
      await kv.set(AUDITS_KV_KEY, audits);
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes('WRONGTYPE') || msg.includes('wrong kind')) {
        await kv.del(AUDITS_KV_KEY);
        await kv.set(AUDITS_KV_KEY, audits);
        return;
      }
      throw err;
    }
    return;
  }

  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify({ audits }, null, 2), 'utf8');
}

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

function removeSmokeTestAudits(audits) {
  return audits.filter(
    (audit) => !String(audit?.storeName || '').startsWith(TEST_STORE_PREFIX)
  );
}

export async function getAllAudits() {
  const audits = await readAudits();
  const cleaned = removeSmokeTestAudits(audits);
  if (cleaned.length !== audits.length) {
    await writeAudits(cleaned);
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

  const audits = await readAudits();
  const cleaned = removeSmokeTestAudits(audits);
  cleaned.push(audit);
  await writeAudits(cleaned);

  return {
    totalScore,
    sectionScores: sectionScoresArray,
    timestamp,
    rowNumber: cleaned.length,
  };
}

export async function deleteAudit({ timestamp, storeName } = {}) {
  if (!timestamp) {
    throw new Error('Missing audit timestamp');
  }

  const audits = await readAudits();
  const next = audits.filter((audit) => {
    if (audit.timestamp !== timestamp) return true;
    if (storeName && audit.storeName !== storeName) return true;
    return false;
  });

  if (next.length === audits.length) {
    throw new Error('Audit not found');
  }

  await writeAudits(next);
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

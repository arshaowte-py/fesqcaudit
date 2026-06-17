import fs from 'fs/promises';
import path from 'path';
import { getSupabaseAdmin, isSupabaseConfigured, supabaseConnectionError } from './supabase';

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
const TEST_STORE_PREFIX = 'KV Smoke ';
/** Ignore repeat submits for the same visit within this window (accidental double-tap / retry). */
const DUPLICATE_SUBMIT_WINDOW_MS = 10 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* File-mode helpers (used when Supabase is not configured)           */
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
/* Supabase helpers                                                   */
/* ------------------------------------------------------------------ */

function normalizeTimestamp(value) {
  if (!value) return value;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? value : new Date(ms).toISOString();
}

function rowToAudit(row) {
  if (!row) return null;
  const checkpoints = row.checkpoints || {};
  const { sectionScores, totalScore } = calculateAllScores(checkpoints);
  return {
    timestamp: normalizeTimestamp(row.timestamp),
    storeName: row.store_name,
    location: row.location || '',
    auditorName: row.auditor_name,
    auditeeName: row.auditee_name || '',
    visitDate: row.visit_date,
    sectionScores,
    totalScore,
    checkpoints,
    photos: row.photos || [],
  };
}

function auditToRow(audit) {
  return {
    timestamp: audit.timestamp,
    store_name: audit.storeName,
    location: audit.location || '',
    auditor_name: audit.auditorName,
    auditee_name: audit.auditeeName || '',
    visit_date: audit.visitDate,
    section_scores: audit.sectionScores,
    total_score: audit.totalScore,
    checkpoints: audit.checkpoints,
    photos: audit.photos || [],
  };
}

async function readAuditsFromSupabase() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('audits').select('*');

  if (error) {
    throw new Error(error.message || 'Failed to load audits');
  }

  return sortAudits((data || []).map(rowToAudit).filter(Boolean));
}

async function findSupabaseAuditRow(supabase, { timestamp, storeName }) {
  const targetMs = new Date(timestamp).getTime();
  if (Number.isNaN(targetMs)) {
    throw new Error('Invalid audit timestamp');
  }

  let query = supabase.from('audits').select('id, timestamp, store_name');
  if (storeName) {
    query = query.eq('store_name', storeName);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Failed to locate audit');
  }

  return (data || []).find((row) => {
    const rowMs = new Date(row.timestamp).getTime();
    return !Number.isNaN(rowMs) && rowMs === targetMs;
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function isSmokeTestAudit(audit) {
  return String(audit?.storeName || '').startsWith(TEST_STORE_PREFIX);
}

function calculateAllScores(sections) {
  let totalYes = 0;
  let totalNo = 0;
  const sectionScores = {};

  SECTIONS.forEach((sec) => {
    const sectionData = sections[sec.id] || {};
    let yes = 0;
    let no = 0;
    for (let q = 1; q <= sec.count; q++) {
      const cp = sectionData[`Q${q}`];
      if (!cp) continue;
      const a = (cp.answer || '').toUpperCase().trim();
      if (a === 'YES') { yes++; totalYes++; }
      else if (a === 'NO') { no++; totalNo++; }
    }
    const answered = yes + no;
    sectionScores[sec.id] = answered > 0 ? Math.round((yes / answered) * 100) : null;
  });

  const totalAnswered = totalYes + totalNo;
  const totalScore = totalAnswered > 0 ? Math.round((totalYes / totalAnswered) * 100) : null;

  return { sectionScores, totalScore };
}

function sortAudits(audits) {
  return [...audits].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime() || 0;
    const tb = new Date(b.timestamp).getTime() || 0;
    return ta - tb;
  });
}

function filterSmokeTests(audits) {
  return audits.filter((audit) => !isSmokeTestAudit(audit));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function isSameSubmittedContent(existing, payload) {
  const existingContent = {
    location: existing.location || '',
    auditeeName: existing.auditeeName || '',
    checkpoints: existing.checkpoints || {},
    photos: existing.photos || [],
  };
  const payloadContent = {
    location: payload.location || '',
    auditeeName: payload.auditeeName || '',
    checkpoints: payload.sections || {},
    photos: payload.photos || [],
  };
  return stableStringify(existingContent) === stableStringify(payloadContent);
}

function isRecentDuplicateCandidate(existing, payload, windowMs) {
  if (!existing) return false;
  const cutoff = Date.now() - windowMs;
  const ts = new Date(existing.timestamp).getTime();
  if (Number.isNaN(ts) || ts < cutoff) return false;
  return (
    existing.storeName === payload.storeName &&
    existing.auditorName === payload.auditorName &&
    existing.visitDate === payload.visitDate &&
    isSameSubmittedContent(existing, payload)
  );
}

async function findRecentDuplicateAudit(payload) {
  const windowMs = DUPLICATE_SUBMIT_WINDOW_MS;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    const { data, error } = await supabase
      .from('audits')
      .select('*')
      .eq('store_name', payload.storeName)
      .eq('auditor_name', payload.auditorName)
      .eq('visit_date', payload.visitDate)
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Duplicate audit lookup failed:', error);
      return null;
    }

    return (data || [])
      .map(rowToAudit)
      .find((audit) => isRecentDuplicateCandidate(audit, payload, windowMs)) || null;
  }

  const audits = await readAuditsFromFile();
  const match = [...audits]
    .reverse()
    .find((audit) => isRecentDuplicateCandidate(audit, payload, windowMs));
  return match || null;
}

function resultFromExistingAudit(audit, duplicate = true) {
  return {
    totalScore: audit.totalScore,
    sectionScores: audit.sectionScores,
    timestamp: audit.timestamp,
    rowNumber: null,
    duplicate,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export async function getAllAudits() {
  if (isSupabaseConfigured()) {
    const audits = await readAuditsFromSupabase();
    return filterSmokeTests(audits);
  }

  const audits = await readAuditsFromFile();
  const cleaned = filterSmokeTests(audits);
  if (cleaned.length !== audits.length) {
    await writeAuditsToFile(cleaned);
  }
  return sortAudits(cleaned);
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

  const { sectionScores, totalScore } = calculateAllScores(sections);

  const existing = await findRecentDuplicateAudit({
    storeName,
    location,
    auditorName,
    auditeeName,
    visitDate,
    sections,
    photos,
  });
  if (existing) {
    return resultFromExistingAudit(existing, true);
  }

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

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    let error;
    try {
      ({ error } = await supabase.from('audits').insert(auditToRow(audit)));
    } catch (err) {
      throw supabaseConnectionError(err);
    }

    if (error) {
      throw new Error(error.message || 'Failed to save audit');
    }

    const { count, error: countError } = await supabase
      .from('audits')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Audit count after insert failed:', countError);
      rowNumber = null;
    } else {
      rowNumber = typeof count === 'number' ? count : null;
    }
  } else {
    if (process.env.VERCEL) {
      throw new Error(
        'Production database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel, then redeploy.'
      );
    }
    const audits = await readAuditsFromFile();
    const cleaned = filterSmokeTests(audits);
    cleaned.push(audit);
    await writeAuditsToFile(cleaned);
    rowNumber = cleaned.length;
  }

  return {
    totalScore,
    sectionScores,
    timestamp,
    rowNumber,
    duplicate: false,
  };
}

export async function deleteAudit({ timestamp, storeName } = {}) {
  if (!timestamp) {
    throw new Error('Missing audit timestamp');
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const match = await findSupabaseAuditRow(supabase, { timestamp, storeName });

    if (!match) {
      throw new Error('Audit not found');
    }

    const deleteColumn = match.id != null ? 'id' : 'timestamp';
    const deleteValue = match.id != null ? match.id : match.timestamp;

    const { data, error } = await supabase
      .from('audits')
      .delete()
      .eq(deleteColumn, deleteValue)
      .select('timestamp');

    if (error) {
      throw new Error(error.message || 'Failed to delete audit');
    }

    if (!data?.length) {
      throw new Error('Audit not found');
    }

    return { deleted: data.length };
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

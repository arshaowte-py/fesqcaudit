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

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ audits: [] }, null, 2), 'utf8');
  }
}

async function readAudits() {
  if (isKvConfigured()) {
    try {
      const items = await kv.lrange(AUDITS_KV_KEY, 0, -1);
      return items
        .map((item) => {
          if (!item) return null;
          if (typeof item === 'string') {
            try {
              return JSON.parse(item);
            } catch {
              return null;
            }
          }
          return item;
        })
        .filter(Boolean);
    } catch (err) {
      console.error('KV read failed, falling back to local file:', err);
    }
  }

  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.audits) ? parsed.audits : [];
}

async function writeAudits(audits) {
  if (isKvConfigured()) {
    try {
      await kv.del(AUDITS_KV_KEY);
      if (audits.length) {
        await kv.rpush(
          AUDITS_KV_KEY,
          ...audits.map((audit) => JSON.stringify(audit))
        );
      }
      return;
    } catch (err) {
      console.error('KV write failed, falling back to local file:', err);
    }
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

  let rowNumber;

  if (isKvConfigured()) {
    try {
      rowNumber = await kv.rpush(AUDITS_KV_KEY, JSON.stringify(audit));
    } catch (err) {
      console.error('KV append failed, falling back to local file:', err);
      const audits = await readAudits();
      audits.push(audit);
      await writeAudits(audits);
      rowNumber = audits.length;
    }
  } else {
    const audits = await readAudits();
    const cleaned = removeSmokeTestAudits(audits);
    cleaned.push(audit);
    await writeAudits(cleaned);
    rowNumber = cleaned.length;
  }

  return {
    totalScore,
    sectionScores: sectionScoresArray,
    timestamp,
    rowNumber,
  };
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

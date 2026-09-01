import { randomUUID } from 'node:crypto';
import { getDb, getBucket } from './firebase-admin.js';

const COLLECTION = 'audits';
const PHOTO_PREFIX = 'audits';
const TEST_STORE_PREFIX = 'KV Smoke ';
/** Ignore repeat submits for the same visit within this window (double-tap / retry). */
const DUPLICATE_SUBMIT_WINDOW_MS = 10 * 60 * 1000;

const SECTIONS = [
  { id: 'S1', count: 5 },
  { id: 'S2', count: 1 },
  { id: 'S3', count: 1 },
  { id: 'S4', count: 17 },
  { id: 'S5', count: 5 },
  { id: 'S6', count: 6 },
  { id: 'S7', count: 35 },
];

/* ------------------------------------------------------------------ */
/* Photos — Cloud Storage, never Firestore                            */
/* ------------------------------------------------------------------ */

/**
 * Photos arrive from the browser as base64 data URLs, ~100 KB each, up to 5
 * per checkpoint across 70 checkpoints. Firestore caps a document at 1 MiB, so
 * the bytes cannot live on the audit document — they go to Cloud Storage and
 * the document keeps only object paths.
 */
function parseDataUrl(dataUrl) {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl ?? ''));
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function extensionFor(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

async function uploadPhotos(auditId, photos) {
  const list = Array.isArray(photos) ? photos : [];
  const stored = [];

  await Promise.all(list.map(async (photo, i) => {
    const parsed = parseDataUrl(photo?.data);
    if (!parsed) return;

    const objectPath = `${PHOTO_PREFIX}/${auditId}/${String(i).padStart(3, '0')}.${extensionFor(parsed.contentType)}`;
    await getBucket().file(objectPath).save(parsed.buffer, {
      contentType: parsed.contentType,
      resumable: false,
      metadata: { cacheControl: 'private, max-age=0' },
    });

    stored[i] = {
      section: photo.section ?? '',
      checkpoint: photo.checkpoint ?? '',
      path: objectPath,
      contentType: parsed.contentType,
    };
  }));

  return stored.filter(Boolean);
}

/** Read one stored photo back as the data URL the browser already expects. */
async function loadPhotoDataUrl(meta) {
  const [buf] = await getBucket().file(meta.path).download();
  return `data:${meta.contentType || 'image/jpeg'};base64,${buf.toString('base64')}`;
}

async function deletePhotos(photoMetas) {
  await Promise.all((photoMetas || []).map((p) =>
    p?.path ? getBucket().file(p.path).delete().catch(() => {}) : null
  ));
}

/* ------------------------------------------------------------------ */
/* Scoring                                                            */
/* ------------------------------------------------------------------ */

function calculateAllScores(sections) {
  let totalYes = 0;
  let totalNo = 0;
  const sectionScores = {};

  SECTIONS.forEach((sec) => {
    const sectionData = sections?.[sec.id] || {};
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
  return {
    sectionScores,
    totalScore: totalAnswered > 0 ? Math.round((totalYes / totalAnswered) * 100) : null,
  };
}

function isSmokeTestAudit(audit) {
  return String(audit?.storeName || '').startsWith(TEST_STORE_PREFIX);
}

/**
 * Client shape. `photos` carries metadata only — no bytes — so listing every
 * audit stays small; the detail view fetches bytes per audit via /api/get-photos.
 */
function docToAudit(doc) {
  const d = doc.data();
  const { sectionScores, totalScore } = calculateAllScores(d.checkpoints || {});
  return {
    id: doc.id,
    timestamp: d.timestamp,
    storeName: d.storeName,
    location: d.location || '',
    auditorName: d.auditorName,
    auditeeName: d.auditeeName || '',
    visitDate: d.visitDate,
    sectionScores,
    totalScore,
    checkpoints: d.checkpoints || {},
    photos: (d.photos || []).map(({ section, checkpoint }) => ({ section, checkpoint })),
  };
}

/* ------------------------------------------------------------------ */
/* Duplicate detection                                                */
/* ------------------------------------------------------------------ */

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

async function findRecentDuplicate(payload) {
  const cutoff = new Date(Date.now() - DUPLICATE_SUBMIT_WINDOW_MS).toISOString();

  // Backed by the composite index in firestore.indexes.json.
  const snap = await getDb().collection(COLLECTION)
    .where('storeName', '==', payload.storeName)
    .where('auditorName', '==', payload.auditorName)
    .where('visitDate', '==', payload.visitDate)
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  const incoming = stableStringify({
    location: payload.location || '',
    auditeeName: payload.auditeeName || '',
    checkpoints: payload.sections || {},
    photoCount: (payload.photos || []).length,
  });

  for (const doc of snap.docs) {
    const d = doc.data();
    const existing = stableStringify({
      location: d.location || '',
      auditeeName: d.auditeeName || '',
      checkpoints: d.checkpoints || {},
      photoCount: (d.photos || []).length,
    });
    if (existing === incoming) return docToAudit(doc);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export async function getAllAudits() {
  const snap = await getDb().collection(COLLECTION).orderBy('timestamp', 'asc').get();
  return snap.docs.map(docToAudit).filter((a) => !isSmokeTestAudit(a));
}

export async function addAudit(payload) {
  const { storeName, location, auditorName, auditeeName, visitDate, sections, photos } = payload;
  const { sectionScores, totalScore } = calculateAllScores(sections);

  const existing = await findRecentDuplicate(payload);
  if (existing) {
    return {
      totalScore: existing.totalScore,
      sectionScores: existing.sectionScores,
      timestamp: existing.timestamp,
      rowNumber: null,
      duplicate: true,
    };
  }

  const auditId = randomUUID();
  const timestamp = new Date().toISOString();
  const storedPhotos = await uploadPhotos(auditId, photos);

  await getDb().collection(COLLECTION).doc(auditId).set({
    timestamp,
    storeName,
    location: location || '',
    auditorName,
    auditeeName: auditeeName || '',
    visitDate,
    sectionScores,
    totalScore,
    checkpoints: sections || {},
    photos: storedPhotos,
    createdAt: timestamp,
  });

  return { totalScore, sectionScores, timestamp, rowNumber: null, duplicate: false };
}

export async function deleteAudit({ timestamp, storeName } = {}) {
  if (!timestamp) throw new Error('Missing audit timestamp');

  let query = getDb().collection(COLLECTION).where('timestamp', '==', timestamp);
  if (storeName) query = query.where('storeName', '==', storeName);

  const snap = await query.get();
  if (snap.empty) throw new Error('Audit not found');

  for (const doc of snap.docs) {
    await deletePhotos(doc.data().photos);
    await doc.ref.delete();
  }
  return { deleted: snap.size };
}

export async function getPhotos({ timestamp, store } = {}) {
  let query = getDb().collection(COLLECTION);
  if (timestamp) query = query.where('timestamp', '==', timestamp);
  if (store) query = query.where('storeName', '==', store);

  const snap = await query.get();
  const out = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    if (isSmokeTestAudit({ storeName: d.storeName })) continue;
    for (const meta of d.photos || []) {
      out.push({
        timestamp: d.timestamp,
        storeName: d.storeName,
        section: meta.section,
        checkpoint: meta.checkpoint,
        data: await loadPhotoDataUrl(meta),
      });
    }
  }
  return out;
}

import { getDb } from './firebase-admin.js';

/**
 * Fixed-window counters in Firestore, not in memory.
 *
 * The app runs as a Cloud Function that scales to many instances; an in-memory
 * counter would be per-instance and so would cap nothing. Firestore is the
 * only shared place all instances agree on. Increments run in a transaction so
 * concurrent requests cannot both read the same count and each decide they are
 * under the limit.
 */
const COLLECTION = 'throttle';

/** Firestore doc ids may not contain '/' and may not be '.' or '..'. */
function safeId(key) {
  return String(key).replace(/\//g, '_').slice(0, 400) || '_';
}

export async function consume(key, { limit, windowMs }) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(safeId(key));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;

    if (!data || typeof data.windowEnd !== 'number' || now >= data.windowEnd) {
      tx.set(ref, { count: 1, windowEnd: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (data.count >= limit) {
      return { allowed: false, retryAfterMs: data.windowEnd - now };
    }
    tx.update(ref, { count: data.count + 1 });
    return { allowed: true, retryAfterMs: 0 };
  });
}

/** Limits deliberately count code REQUESTS, not just verification attempts. */
export const LIMITS = {
  requestPerEmail: { limit: 5, windowMs: 15 * 60 * 1000 },
  requestPerIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  verifyPerIp: { limit: 30, windowMs: 15 * 60 * 1000 },
};

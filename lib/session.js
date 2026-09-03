import { getDb } from './firebase-admin.js';
import {
  SESSION_COOKIE, SESSION_TTL_MS, hashToken, newSessionToken, normalizeEmail,
} from './auth-rules.js';

const COLLECTION = 'sessions';

/**
 * Sessions are stored by the SHA-256 of the token, and the token itself never
 * touches the database. A dump of the `sessions` collection therefore contains
 * nothing that can be replayed as a cookie.
 */
export async function createSession(email) {
  const token = newSessionToken();
  const now = Date.now();
  await getDb().collection(COLLECTION).doc(hashToken(token)).set({
    email: normalizeEmail(email),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  });
  return token;
}

export async function readSession(token) {
  if (!token || typeof token !== 'string') return null;
  const ref = getDb().collection(COLLECTION).doc(hashToken(token));
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data();
  if (!data?.expiresAt || Date.parse(data.expiresAt) <= Date.now()) {
    await ref.delete().catch(() => {});
    return null;
  }
  return { email: data.email };
}

export async function destroySession(token) {
  if (!token) return;
  await getDb().collection(COLLECTION).doc(hashToken(token)).delete().catch(() => {});
}

/** Read the session for an incoming NextRequest, or null. */
export async function getSessionFromRequest(request) {
  const token = request?.cookies?.get?.(SESSION_COOKIE)?.value;
  return readSession(token);
}

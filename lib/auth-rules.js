import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Pure auth logic — no I/O, no Firebase, no network.
 *
 * Kept free of side effects so the rules that actually gate access (domain
 * check, token hashing, the production kill-switch on the dev fallback) can be
 * tested directly with `node --test`, without credentials or a bundler.
 */

export const ALLOWED_DOMAIN = 'myfrido.com';
export const SESSION_COOKIE = '__session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const OTP_TTL_SECONDS = 300;
export const MAX_OTP_ATTEMPTS = 5;
export const DEV_REQUEST_ID_PREFIX = 'dev:';

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function isEligibleAddress(email) {
  const e = normalizeEmail(email);
  if (!e || e.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  return e.endsWith(`@${ALLOWED_DOMAIN}`);
}

/** A session token the client holds. Only its hash is ever persisted. */
export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

/** Firestore document id for a session token. The token itself is never stored. */
export function hashToken(token) {
  return createHash('sha256').update(String(token), 'utf8').digest('hex');
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * Is the console-code dev fallback permitted?
 *
 * Enforced in BOTH directions by the callers: a `dev:` requestId can never be
 * ISSUED when this returns false, and can never be REDEEMED either. Missing
 * OTPless credentials therefore fail closed — they never silently downgrade to
 * a code we invented ourselves.
 */
export function devFallbackAllowed(env = process.env) {
  if (env.NODE_ENV === 'production') return false;
  if (env.K_SERVICE || env.FUNCTION_TARGET) return false; // running on Cloud Run/Functions
  return env.ALLOW_DEV_OTP === '1';
}

export function isDevRequestId(requestId) {
  return String(requestId ?? '').startsWith(DEV_REQUEST_ID_PREFIX);
}

/** `__session` — the ONLY cookie Firebase Hosting forwards. Not configurable. */
export function serializeSessionCookie(token, { maxAgeMs = SESSION_TTL_MS, secure = true } = {}) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearedSessionCookie({ secure = true } = {}) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

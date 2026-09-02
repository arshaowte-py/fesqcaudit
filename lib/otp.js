import { getDb } from './firebase-admin.js';
import {
  DEV_REQUEST_ID_PREFIX, MAX_OTP_ATTEMPTS, OTP_TTL_SECONDS,
  devFallbackAllowed, isDevRequestId, normalizeEmail,
} from './auth-rules.js';

const INITIATE_URL = 'https://auth.otpless.app/auth/v1/initiate/otp';
const VERIFY_URL = 'https://auth.otpless.app/auth/v1/verify/otp';
const PENDING = 'otpRequests';

/* ---------------------------------------------------------------- */
/* Credentials — fail closed                                        */
/* ---------------------------------------------------------------- */

/**
 * Injected by Cloud Functions from Secret Manager because server.js declares
 * them via defineSecret(). Absent credentials must make sign-in IMPOSSIBLE;
 * they must never fall back to a code we generated ourselves.
 */
function credentials() {
  const clientId = process.env.OTPLESS_CLIENT_ID?.trim();
  const clientSecret = process.env.OTPLESS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function otplessConfigured() {
  return credentials() !== null;
}

/* ---------------------------------------------------------------- */
/* OTPless API                                                      */
/* ---------------------------------------------------------------- */

export async function initiateOtp(email) {
  const creds = credentials();

  if (!creds) {
    // Both directions: cannot ISSUE a dev code unless explicitly in dev.
    if (devFallbackAllowed()) {
      const fake = `${DEV_REQUEST_ID_PREFIX}${Date.now()}`;
      console.warn(`[otp] DEV FALLBACK — no OTPless credentials. Code for ${email} is 000000`);
      return fake;
    }
    throw new Error('OTPless credentials are not configured');
  }

  const res = await fetch(INITIATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    },
    body: JSON.stringify({
      email,
      channels: ['EMAIL'],
      expiry: OTP_TTL_SECONDS,
      otpLength: 6,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`OTPless initiate failed (${res.status}): ${body?.message || res.statusText}`);
  }

  const requestId = body?.requestId || body?.data?.requestId;
  if (!requestId) throw new Error('OTPless initiate returned no requestId');

  return requestId;
}

export async function verifyOtp(requestId, otp) {
  if (isDevRequestId(requestId)) {
    // Both directions: cannot REDEEM a dev code outside dev either.
    if (!devFallbackAllowed()) return false;
    return String(otp) === '000000';
  }

  const creds = credentials();
  if (!creds) throw new Error('OTPless credentials are not configured');

  const res = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    },
    body: JSON.stringify({ requestId, otp: String(otp) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return false;
  return body?.isOTPVerified === true || body?.data?.isOTPVerified === true;
}

/* ---------------------------------------------------------------- */
/* Pending-request store — requestId only, never the code           */
/* ---------------------------------------------------------------- */

/**
 * Keyed by email as the DOCUMENT ID, which makes "one live code per person" a
 * property of the database rather than something the code has to remember to
 * enforce: issuing a new code overwrites the old one, so the previous code is
 * dead the moment a new one is sent.
 */
export async function putPendingOtp(email, requestId) {
  const now = Date.now();
  await getDb().collection(PENDING).doc(normalizeEmail(email)).set({
    requestId,
    attempts: 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + OTP_TTL_SECONDS * 1000).toISOString(),
  });
}

/**
 * Atomically claim one verification attempt. Returns the requestId to check,
 * or a reason it cannot be attempted. The increment is transactional so five
 * parallel guesses consume five attempts, not one.
 */
export async function claimOtpAttempt(email) {
  const db = getDb();
  const ref = db.collection(PENDING).doc(normalizeEmail(email));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: 'no-pending' };

    const data = snap.data();
    if (Date.parse(data.expiresAt) <= Date.now()) {
      tx.delete(ref);
      return { ok: false, reason: 'expired' };
    }
    if ((data.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      return { ok: false, reason: 'too-many-attempts' };
    }
    tx.update(ref, { attempts: (data.attempts ?? 0) + 1 });
    return { ok: true, requestId: data.requestId };
  });
}

export async function clearPendingOtp(email) {
  await getDb().collection(PENDING).doc(normalizeEmail(email)).delete().catch(() => {});
}

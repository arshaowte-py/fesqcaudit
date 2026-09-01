import { getDb } from './firebase-admin.js';
import {
  DEV_REQUEST_ID_PREFIX, MAX_OTP_ATTEMPTS, OTP_TTL_SECONDS,
  devFallbackAllowed, isDevRequestId, normalizeEmail,
} from './auth-rules.js';

const INITIATE_URL = 'https://auth.otpless.app/auth/v1/initiate/otp';
const VERIFY_URL = 'https://auth.otpless.app/auth/v1/verify/otp';
const PENDING = 'otpRequests';
const LATENCY_DOC = ['meta', 'otpLatency'];

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
/* Timing equalisation                                              */
/* ---------------------------------------------------------------- */

/**
 * An unknown address must take as long to answer as a real one, or response
 * time alone turns this endpoint into a staff directory.
 *
 * The sample recorded here is the WHOLE known-address handler duration, not
 * just the OTPless call: the real branch also does a throttle transaction and
 * an account lookup, so equalising against the HTTP call alone still left the
 * two branches visibly different. Both branches then pad to the same target,
 * which carries headroom over the observed average so the real branch
 * normally finishes inside it rather than overshooting and re-opening the gap.
 */
const MIN_EQUALISED_MS = 900;
const LATENCY_HEADROOM = 1.3;

export async function recordLatency(ms) {
  const ref = getDb().collection(LATENCY_DOC[0]).doc(LATENCY_DOC[1]);
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? Number(snap.get('emaMs')) : NaN;
    const ema = Number.isFinite(prev) ? prev * 0.8 + ms * 0.2 : ms;
    tx.set(ref, { emaMs: ema, updatedAt: new Date().toISOString() }, { merge: true });
  }).catch(() => {});
}

export async function expectedLatencyMs() {
  try {
    const snap = await getDb().collection(LATENCY_DOC[0]).doc(LATENCY_DOC[1]).get();
    const ema = Number(snap.get('emaMs'));
    const target = Number.isFinite(ema) ? Math.round(ema * LATENCY_HEADROOM) : 0;
    return Math.max(MIN_EQUALISED_MS, target);
  } catch {
    return MIN_EQUALISED_MS;
  }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, ms)));
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

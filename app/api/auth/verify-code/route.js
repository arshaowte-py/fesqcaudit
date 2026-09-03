import { NextResponse } from 'next/server';
import {
  isEligibleAddress, normalizeEmail, serializeSessionCookie, MAX_OTP_ATTEMPTS,
} from '../../../../lib/auth-rules';
import { ensureUser } from '../../../../lib/users';
import { verifyOtp, claimOtpAttempt, clearPendingOtp } from '../../../../lib/otp';
import { createSession } from '../../../../lib/session';
import { consume, LIMITS } from '../../../../lib/rate-limit';
import { clientIp } from '../../../../lib/request-ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BAD_CODE = { ok: false, error: 'That code is not valid or has expired.' };

function isSecureRequest(request) {
  return process.env.NODE_ENV === 'production'
    || request.headers.get('x-forwarded-proto') === 'https';
}

export async function POST(request) {
  const ip = clientIp(request);

  let email; let otp;
  try {
    ({ email, otp } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  email = normalizeEmail(email);
  otp = String(otp ?? '').trim();

  const byIp = await consume(`ver:ip:${ip}`, LIMITS.verifyPerIp);
  if (!byIp.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(byIp.retryAfterMs / 1000)) } }
    );
  }

  if (!isEligibleAddress(email) || !/^\d{6}$/.test(otp)) {
    return NextResponse.json(BAD_CODE, { status: 400 });
  }

  // Atomic: five parallel guesses consume five attempts, not one.
  const claim = await claimOtpAttempt(email);
  if (!claim.ok) {
    const status = claim.reason === 'too-many-attempts' ? 429 : 400;
    const error = claim.reason === 'too-many-attempts'
      ? `Too many incorrect attempts. Request a new code.`
      : BAD_CODE.error;
    return NextResponse.json({ ok: false, error }, { status });
  }

  let verified = false;
  try {
    verified = await verifyOtp(claim.requestId, otp);
  } catch (err) {
    console.error('[auth] verify failed:', err.message);
    return NextResponse.json({ ok: false, error: 'Sign-in is temporarily unavailable.' }, { status: 502 });
  }

  if (!verified) return NextResponse.json(BAD_CODE, { status: 400 });

  // The code checked out, so this mailbox is genuinely theirs. Create the
  // account now if it does not exist yet — no approval, no pre-registration.
  const account = await ensureUser(email);
  await clearPendingOtp(email);

  if (!account.ok) {
    return NextResponse.json(
      { ok: false, error: 'Access for this account has been revoked.' },
      { status: 403 }
    );
  }
  if (account.created) console.info(`[auth] auto-provisioned account for ${email}`);

  const token = await createSession(email);

  const res = NextResponse.json({ ok: true, email });
  res.headers.set(
    'Set-Cookie',
    serializeSessionCookie(token, { secure: isSecureRequest(request) })
  );
  return res;
}

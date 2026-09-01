import { NextResponse } from 'next/server';
import { isEligibleAddress, normalizeEmail } from '../../../../lib/auth-rules';
import { isKnownUser } from '../../../../lib/users';
import {
  otplessConfigured, initiateOtp, putPendingOtp, expectedLatencyMs, recordLatency, sleep,
} from '../../../../lib/otp';
import { consume, LIMITS } from '../../../../lib/rate-limit';
import { clientIp } from '../../../../lib/request-ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The one response an eligible address ever gets, whether or not it belongs to
 * a real account. Both branches below return exactly this, and take the same
 * amount of time to do it.
 */
const IDENTICAL = { ok: true, message: 'If that address has an account, a code is on its way.' };

export async function POST(request) {
  const started = Date.now();
  const ip = clientIp(request);

  let email;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  email = normalizeEmail(email);

  // Per-IP cap first, so it counts every request including ineligible ones.
  const byIp = await consume(`req:ip:${ip}`, LIMITS.requestPerIp);
  if (!byIp.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(byIp.retryAfterMs / 1000)) } }
    );
  }

  // Wrong domain is refused outright — this reveals nothing about who has an
  // account, only which domain the tool serves.
  if (!isEligibleAddress(email)) {
    return NextResponse.json(
      { ok: false, error: 'Use your @myfrido.com address.' },
      { status: 400 }
    );
  }

  // Checked BEFORE the account lookup so a credentials outage answers the same
  // way for everyone, rather than leaking which addresses exist.
  if (!otplessConfigured()) {
    console.error('[auth] OTPless credentials missing — refusing to issue any code.');
    return NextResponse.json(
      { ok: false, error: 'Sign-in is temporarily unavailable.' },
      { status: 503 }
    );
  }

  const byEmail = await consume(`req:email:${email}`, LIMITS.requestPerEmail);
  if (!byEmail.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many codes requested. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(byEmail.retryAfterMs / 1000)) } }
    );
  }

  // Read the shared target BEFORE branching so both paths pay for this read.
  const target = await expectedLatencyMs();
  const known = await isKnownUser(email);

  if (known) {
    try {
      const requestId = await initiateOtp(email);
      await putPendingOtp(email, requestId);
    } catch (err) {
      console.error('[auth] initiate failed:', err.message);
      return NextResponse.json(
        { ok: false, error: 'Sign-in is temporarily unavailable.' },
        { status: 502 }
      );
    }
    // Sampled before the pad, so the target tracks real work, not the padding.
    recordLatency(Date.now() - started).catch(() => {});
  }

  // BOTH branches land here: same body, same status, same duration. Nothing is
  // ever written to `users`, so asking for a code cannot create an account.
  await sleep(target - (Date.now() - started));
  return NextResponse.json(IDENTICAL);
}

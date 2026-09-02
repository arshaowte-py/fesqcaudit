import { NextResponse } from 'next/server';
import { isEligibleAddress, normalizeEmail } from '../../../../lib/auth-rules';
import { otplessConfigured, initiateOtp, putPendingOtp } from '../../../../lib/otp';
import { consume, LIMITS } from '../../../../lib/rate-limit';
import { clientIp } from '../../../../lib/request-ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SENT = { ok: true, message: 'A 6-digit code is on its way to your inbox.' };

export async function POST(request) {
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

  // The domain IS the access rule: any @myfrido.com address may sign in, and
  // the account is created on first successful verification.
  if (!isEligibleAddress(email)) {
    return NextResponse.json(
      { ok: false, error: 'Use your @myfrido.com address.' },
      { status: 400 }
    );
  }

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

  return NextResponse.json(SENT);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isEligibleAddress, normalizeEmail, hashToken, newSessionToken,
  serializeSessionCookie, clearedSessionCookie, devFallbackAllowed, isDevRequestId,
  SESSION_COOKIE,
} from '../lib/auth-rules.js';

test('only @myfrido.com addresses are eligible', () => {
  for (const good of ['a@myfrido.com', 'A.B@MyFrido.com', '  x@myfrido.com  ']) {
    assert.equal(isEligibleAddress(good), true, good);
  }
  for (const bad of [
    'x@gmail.com', 'x@notmyfrido.com', 'x@myfrido.com.evil.com',
    'nope', '@myfrido.com', '', null, undefined, 'a b@myfrido.com',
  ]) {
    assert.equal(isEligibleAddress(bad), false, String(bad));
  }
});

test('emails normalise to lowercase and trimmed', () => {
  assert.equal(normalizeEmail('  Foo.Bar@MyFrido.COM '), 'foo.bar@myfrido.com');
});

test('session cookie is __session, HttpOnly, SameSite=Strict', () => {
  // Firebase Hosting strips every cookie except __session, so the name is
  // load-bearing: any other name works locally and fails through Hosting.
  const c = serializeSessionCookie('TOKEN123');
  assert.ok(c.startsWith(`${SESSION_COOKIE}=TOKEN123`));
  assert.equal(SESSION_COOKIE, '__session');
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Strict/);
  assert.match(c, /Secure/);
  assert.match(clearedSessionCookie(), /Max-Age=0/);
});

test('tokens are unpredictable and only their hash is storable', () => {
  const a = newSessionToken();
  const b = newSessionToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 42);                       // 32 random bytes, base64url
  assert.equal(hashToken(a), hashToken(a));        // deterministic
  assert.notEqual(hashToken(a), hashToken(b));
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);    // sha-256 hex
  assert.ok(!hashToken(a).includes(a));            // hash does not embed token
});

test('dev OTP fallback refuses to run in production, in both directions', () => {
  // Cannot be enabled by NODE_ENV=production even with the flag set...
  assert.equal(devFallbackAllowed({ NODE_ENV: 'production', ALLOW_DEV_OTP: '1' }), false);
  // ...nor when running on Cloud Functions, whatever NODE_ENV claims.
  assert.equal(devFallbackAllowed({ NODE_ENV: 'development', ALLOW_DEV_OTP: '1', K_SERVICE: 'server' }), false);
  // ...and never without the explicit opt-in.
  assert.equal(devFallbackAllowed({ NODE_ENV: 'development' }), false);
  // Only a real dev box with the flag set.
  assert.equal(devFallbackAllowed({ NODE_ENV: 'development', ALLOW_DEV_OTP: '1' }), true);
  assert.equal(isDevRequestId('dev:123'), true);
  assert.equal(isDevRequestId('otpless-real-id'), false);
});

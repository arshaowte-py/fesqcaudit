#!/usr/bin/env node
/**
 * Post-deploy smoke check against the live Hosting URL.
 *
 * Exists because a CSP that blocks Next's inline bootstrap scripts is
 * invisible to every HTTP-level check: /login still returns 200 with valid
 * HTML and the right security headers, but React never hydrates and the sign-in
 * button never enables. The only way to catch it without a browser is to assert
 * that every inline <script> actually carries the nonce.
 *
 *   npm run smoke
 */
// Default to this repo's own Hosting URL, derived from .firebaserc — so no
// project id is ever written into a workflow file or a command line.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function defaultSite() {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const rc = JSON.parse(readFileSync(join(repoRoot, '.firebaserc'), 'utf8'));
  const projectId = rc?.projects?.default;
  if (!projectId) throw new Error('.firebaserc has no projects.default');
  return `https://${projectId}.web.app`;
}

const site = (process.argv[2] || defaultSite()).replace(/\/+$/, '');
console.log(`smoke: ${site}\n`);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// 1. Signed out, / must redirect rather than render the shell.
const root = await fetch(`${site}/`, { redirect: 'manual' });
check('signed-out / redirects', root.status === 307, `got ${root.status}`);
check('redirect is relative', root.headers.get('location') === '/login', root.headers.get('location'));

// 2. The login page must be able to hydrate.
const loginRes = await fetch(`${site}/login`);
const html = await loginRes.text();
check('/login renders', loginRes.status === 200, `got ${loginRes.status}`);

const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1]);
const unnonced = inline.filter((attrs) => !/\bnonce=/.test(attrs));
check(
  'every inline script carries a nonce',
  inline.length > 0 && unnonced.length === 0,
  `${inline.length} inline, ${unnonced.length} without a nonce`
);

const csp = loginRes.headers.get('content-security-policy') || '';
check('CSP present with a nonce', /script-src[^;]*'nonce-/.test(csp));
check('CSP has no unsafe-inline for scripts', !/script-src[^;]*'unsafe-inline'/.test(csp));

// 3. APIs must reject anonymous callers.
for (const [path, method] of [['get-audits', 'GET'], ['submit-audit', 'POST'], ['delete-audit', 'DELETE']]) {
  const r = await fetch(`${site}/api/${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : '{}',
  });
  check(`${method} /api/${path} is 401 when signed out`, r.status === 401, `got ${r.status}`);
}

// 4. Domain gate.
const outsider = await fetch(`${site}/api/auth/request-code`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'outsider@gmail.com' }),
});
check('non-myfrido address refused', outsider.status === 400, `got ${outsider.status}`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);

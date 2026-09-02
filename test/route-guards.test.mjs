import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Every API route must be behind the shared guard.
 *
 * This is the check that keeps a future route from shipping unauthenticated:
 * it enumerates the route files rather than trusting anyone to remember.
 */
const API_DIR = path.join(process.cwd(), 'app', 'api');
const PUBLIC_BY_DESIGN = new Set(['auth/request-code', 'auth/verify-code', 'auth/logout']);

function routeFiles(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...routeFiles(full, prefix ? `${prefix}/${entry}` : entry));
    } else if (entry === 'route.js') {
      out.push({ route: prefix, file: full });
    }
  }
  return out;
}

test('every API route either guards the session or is public by design', () => {
  const routes = routeFiles(API_DIR);
  assert.ok(routes.length > 0, 'found no API routes to check');

  const unguarded = [];
  for (const { route, file } of routes) {
    if (PUBLIC_BY_DESIGN.has(route)) continue;
    const src = readFileSync(file, 'utf8');
    const imports = /from '.*lib\/auth-guard'/.test(src);
    const calls = /require(Session|DeletePermission)\s*\(\s*request\s*\)/.test(src);
    if (!imports || !calls) unguarded.push(route);
  }

  assert.deepEqual(unguarded, [], `unguarded API routes: ${unguarded.join(', ')}`);
});

test('the shell route redirects signed-out visitors instead of rendering', () => {
  const src = readFileSync(path.join(process.cwd(), 'app', 'route.js'), 'utf8');
  assert.match(src, /getSessionFromRequest/);
  assert.match(src, /redirect\(/);
  assert.match(src, /307/);
});

test('the app shell is not served statically from public/', () => {
  // In public/ it would come straight off the CDN, ahead of the rewrite, and
  // the session check in app/route.js would never run.
  let inPublic = true;
  try { statSync(path.join(process.cwd(), 'public', 'index.html')); }
  catch { inPublic = false; }
  assert.equal(inPublic, false, 'public/index.html would bypass the auth gate');
});

test('redirects use a relative Location, never one built from request.url', () => {
  // Behind Firebase Hosting -> Cloud Run, request.url is the function's own
  // internal listener (https://localhost:3000). Building a redirect from it
  // sends real browsers to localhost, which only shows up through Hosting.
  const files = [
    path.join(process.cwd(), 'app', 'route.js'),
    path.join(process.cwd(), 'app', 'api', 'auth', 'logout', 'route.js'),
  ];
  for (const file of files) {
    const src = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '');   // ignore comments
    assert.ok(
      !/NextResponse\.redirect\s*\(\s*new URL/.test(src),
      `${path.basename(path.dirname(file))}/route.js builds a redirect from request.url`
    );
    assert.match(src, /Location:\s*'\//, `${file} should send a relative Location`);
  }
});

test('CSP is built per request with a nonce, not statically', () => {
  // A static `script-src 'self'` in next.config.js blocks Next's own inline
  // hydration scripts. The page still renders and still returns 200, but no
  // event handler is ever attached — the sign-in button never enables.
  const mwSrc = readFileSync(path.join(process.cwd(), 'middleware.js'), 'utf8');
  // Strip comments — the file explains why strict-dynamic is avoided, and the
  // check below must read the code, not the prose about it.
  const mw = mwSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.match(mw, /nonce-\$\{nonce\}/, 'middleware must put a nonce in script-src');
  assert.match(mw, /x-nonce/, 'Next reads the nonce from the request headers');
  assert.ok(
    !/'strict-dynamic'/.test(mw),
    "strict-dynamic makes browsers ignore 'self', which breaks the shell's /assets/*.js"
  );

  const cfg = readFileSync(path.join(process.cwd(), 'next.config.js'), 'utf8');
  assert.ok(
    !/Content-Security-Policy/i.test(cfg),
    'a static CSP in next.config.js would override the per-request nonce'
  );
});

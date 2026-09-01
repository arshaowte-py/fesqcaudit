const { Readable } = require('node:stream');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const next = require('next');

/**
 * OTPless credentials come from Secret Manager, not plain env vars. Declaring
 * them here is what makes Cloud Functions mount them, after which lib/otp.js
 * reads them from process.env at runtime.
 */
const otplessClientId = defineSecret('OTPLESS_CLIENT_ID');
const otplessClientSecret = defineSecret('OTPLESS_CLIENT_SECRET');

/**
 * The photo bucket lives in the same project. Its name is derived from the
 * project id the RUNTIME reports, so no project id is baked into the source.
 *
 * STORAGE_BUCKET, not FIREBASE_STORAGE_BUCKET: `FIREBASE_` is a reserved
 * env-var prefix on Cloud Functions and deploys are rejected if you set one.
 */
if (!process.env.STORAGE_BUCKET) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (projectId) process.env.STORAGE_BUCKET = `${projectId}-audit-photos`;
}

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

// Cached on globalThis so a warm instance prepares Next exactly once.
function ready() {
  if (!globalThis.__nextReady) globalThis.__nextReady = app.prepare();
  return globalThis.__nextReady;
}

/**
 * Hand Next a readable request body.
 *
 * onRequest runs an Express app in front of this handler, and Express's body
 * parser has ALREADY drained the request stream into req.rawBody. Next then
 * awaits a stream that will never emit again: every GET works, every POST
 * hangs silently until the 60s timeout and returns 504 with no exception and
 * nothing in the logs. Replaying rawBody through a fresh Readable gives Next a
 * stream it can actually consume.
 */
function withReplayedBody(req) {
  if (!req.rawBody || req.rawBody.length === 0) return req;

  const replay = new Readable({ read() {} });
  replay.push(req.rawBody);
  replay.push(null);

  replay.headers = req.headers;
  replay.rawHeaders = req.rawHeaders;
  replay.method = req.method;
  replay.url = req.url;
  replay.socket = req.socket;
  replay.connection = req.connection;
  replay.httpVersion = req.httpVersion;
  replay.httpVersionMajor = req.httpVersionMajor;
  replay.httpVersionMinor = req.httpVersionMinor;
  replay.trailers = req.trailers ?? {};
  replay.rawTrailers = req.rawTrailers ?? [];
  replay.complete = true;
  replay.aborted = false;
  replay.setTimeout = () => replay;

  return replay;
}

exports.server = onRequest(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 60,
    // Without an allUsers invoker binding every URL answers 403, which reads
    // like an app auth failure rather than a missing IAM binding.
    invoker: 'public',
    secrets: [otplessClientId, otplessClientSecret],
  },
  async (req, res) => {
    await ready();
    return handle(withReplayedBody(req), res);
  }
);

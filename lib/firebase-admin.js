import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Admin SDK handles, cached on `globalThis`.
 *
 * A module-level `let` is NOT enough: Next bundles each route handler
 * separately, so every route gets its own instance of this module and its own
 * empty cache. The second route to run then calls initializeApp() again and
 * throws "The default Firebase app already exists". globalThis is shared
 * across those bundles, so the cache actually holds.
 */
const g = globalThis;

function app() {
  if (!g.__auditApp) {
    g.__auditApp = getApps().length ? getApps()[0] : initializeApp();
  }
  return g.__auditApp;
}

export function getDb() {
  if (!g.__auditDb) {
    const db = getFirestore(app());
    // Must run before the instance is used for anything else.
    db.settings({ ignoreUndefinedProperties: true });
    g.__auditDb = db;
  }
  return g.__auditDb;
}

/**
 * The audit photo bucket.
 *
 * Read from STORAGE_BUCKET, not FIREBASE_STORAGE_BUCKET: `FIREBASE_` is a
 * reserved env-var prefix on Cloud Functions and setting it is rejected at
 * deploy time.
 */
export function getBucket() {
  if (!g.__auditBucket) {
    const name = process.env.STORAGE_BUCKET;
    if (!name) {
      throw new Error('STORAGE_BUCKET is not set — cannot resolve the photo bucket.');
    }
    g.__auditBucket = getStorage(app()).bucket(name);
  }
  return g.__auditBucket;
}

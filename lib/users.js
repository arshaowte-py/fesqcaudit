import { getDb } from './firebase-admin.js';
import { normalizeEmail } from './auth-rules.js';

/**
 * Who may sign in: an @myfrido.com address (checked in auth-rules) AND an
 * existing users/{email} document.
 *
 * The second gate is what makes "receiving a code never creates an account"
 * true — this module only ever READS. Nothing in the sign-in path writes to
 * `users`; accounts are created out of band via `npm run seed:user`.
 */
export async function isKnownUser(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  const snap = await getDb().collection('users').doc(e).get();
  return snap.exists && snap.get('disabled') !== true;
}

export async function touchUserLogin(email) {
  const e = normalizeEmail(email);
  await getDb().collection('users').doc(e).set(
    { lastLoginAt: new Date().toISOString() },
    { merge: true }
  );
}

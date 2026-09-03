import { getDb } from './firebase-admin.js';
import { normalizeEmail } from './auth-rules.js';

/**
 * Who may sign in: anyone with an @myfrido.com address (checked in
 * auth-rules). There is no approval step and no pre-registration — proving you
 * receive mail at an @myfrido.com address IS the authorisation.
 *
 * The account is created on FIRST SUCCESSFUL SIGN-IN, not when a code is
 * requested. That ordering matters: creating on request would let anyone spray
 * invented addresses and fill this collection with accounts nobody controls.
 * Creating on verification means a document only ever appears for a mailbox
 * someone has actually demonstrated access to.
 */
export async function ensureUser(email) {
  const e = normalizeEmail(email);
  const ref = getDb().collection('users').doc(e);
  const now = new Date().toISOString();
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      email: e,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      autoProvisioned: true,
      canDelete: false,   // deletion stays opt-in, granted with `npm run seed:user`
    });
    return { ok: true, created: true };
  }

  // The one remaining gate: an explicit block, for offboarding someone whose
  // mailbox still exists.
  if (snap.get('disabled') === true) return { ok: false, created: false };

  await ref.set({ lastLoginAt: now }, { merge: true });
  return { ok: true, created: false };
}

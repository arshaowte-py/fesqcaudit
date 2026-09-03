import { getDb } from './firebase-admin.js';

/**
 * Outbound mail, as a Firestore write.
 *
 * The app does not talk to any mail API. It appends a document to `mail` and
 * the Firebase "Trigger Email from Firestore" extension delivers it, writing
 * the outcome back onto the same document under `delivery`.
 *
 * Why this shape:
 *   - No mail vendor appears anywhere in application code, so changing
 *     provider is an extension config change, not a code change.
 *   - Delivery is decoupled from the request. The old Graph call ran inside
 *     the submit request and a slow mail API delayed the auditor's response.
 *   - Queued mail is durable. Nothing is silently dropped, which is what the
 *     previous Graph path did whenever credentials were absent.
 *
 * One caveat worth knowing: the extension fires on document CREATION. Mail
 * queued BEFORE the extension is installed will sit in the collection unsent —
 * it is recoverable (re-writing a document re-fires the trigger) but it does
 * not flush on its own. See the mail section of the README.
 *
 * The extension reads `to`, `cc` and `message`; every other field here is
 * ignored by it and exists so a human can tell what a queued document is.
 */
const COLLECTION = 'mail';

export function buildMailDocument({ to, cc = [], subject, html, kind = 'notification', context = {} }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) throw new Error('mail: no recipients');
  if (!subject) throw new Error('mail: no subject');
  if (!html) throw new Error('mail: no body');

  const doc = {
    to: recipients,
    message: { subject, html },
    kind,
    context,
    queuedAt: new Date().toISOString(),
  };

  const ccList = (Array.isArray(cc) ? cc : [cc]).filter(Boolean);
  if (ccList.length) doc.cc = ccList;

  return doc;
}

export async function queueMail(options) {
  const doc = buildMailDocument(options);
  const ref = await getDb().collection(COLLECTION).add(doc);
  return { queued: true, id: ref.id };
}

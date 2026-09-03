import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMailDocument } from '../lib/mail.js';

/**
 * The document shape is a contract with the Firebase "Trigger Email from
 * Firestore" extension: it reads `to`, `cc` and `message.{subject,html}`.
 * Getting it wrong means mail queues and never sends, with no error anywhere.
 */
test('builds the shape the email extension expects', () => {
  const doc = buildMailDocument({
    to: ['a@myfrido.com', 'b@myfrido.com'],
    cc: ['c@myfrido.com'],
    subject: 'QC Audit: Store X',
    html: '<p>body</p>',
    kind: 'audit-submitted',
    context: { storeName: 'Store X' },
  });

  assert.deepEqual(doc.to, ['a@myfrido.com', 'b@myfrido.com']);
  assert.deepEqual(doc.cc, ['c@myfrido.com']);
  assert.equal(doc.message.subject, 'QC Audit: Store X');
  assert.equal(doc.message.html, '<p>body</p>');
  assert.equal(doc.kind, 'audit-submitted');
  assert.ok(doc.queuedAt, 'queuedAt helps a human read the queue');
});

test('accepts a bare string recipient and omits empty cc', () => {
  const doc = buildMailDocument({ to: 'a@myfrido.com', subject: 's', html: 'h' });
  assert.deepEqual(doc.to, ['a@myfrido.com']);
  assert.ok(!('cc' in doc), 'an empty cc key would be sent to the extension as-is');
});

test('refuses to queue mail that can never be delivered', () => {
  // A document missing any of these queues successfully and then fails
  // silently inside the extension, which is the hardest kind of bug to see.
  assert.throws(() => buildMailDocument({ to: [], subject: 's', html: 'h' }), /no recipients/);
  assert.throws(() => buildMailDocument({ to: 'a@b.com', html: 'h' }), /no subject/);
  assert.throws(() => buildMailDocument({ to: 'a@b.com', subject: 's' }), /no body/);
});

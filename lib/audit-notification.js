import { buildAuditEmailContent, buildDeleteEmailContent } from './audit-email';
import { getAuditEmailRecipients } from './email-recipients';
import { queueMail } from './mail';

const TEST_STORE_PREFIX = 'KV Smoke ';
const DELETE_ALERT_RECIPIENTS = ['saiyed.a@myfrido.com', 'mehak.g@myfrido.com'];

function isSmokeTestAudit(audit) {
  return String(audit?.storeName || '').startsWith(TEST_STORE_PREFIX);
}

/**
 * Both notifiers queue a document and return. They never throw: a mail
 * problem must not fail an audit submission or deletion that already
 * succeeded.
 */
export async function notifyAuditSubmitted(audit) {
  if (isSmokeTestAudit(audit)) {
    return { queued: false, reason: 'smoke test audit skipped' };
  }

  const { to, cc } = getAuditEmailRecipients();
  const { subject, html } = buildAuditEmailContent(audit);

  try {
    const result = await queueMail({
      to, cc, subject, html,
      kind: 'audit-submitted',
      context: { storeName: audit.storeName, visitDate: audit.visitDate, timestamp: audit.timestamp },
    });
    console.info('Audit notification queued:', { id: result.id, store: audit.storeName, to, cc });
    return result;
  } catch (err) {
    console.error('Audit notification could not be queued:', err.message);
    return { queued: false, reason: err.message };
  }
}

export async function notifyAuditDeleted({ storeName, auditorName, auditeeName, visitDate, timestamp }) {
  const { subject, html } = buildDeleteEmailContent({
    storeName, auditorName, auditeeName, visitDate, timestamp,
  });

  try {
    const result = await queueMail({
      to: DELETE_ALERT_RECIPIENTS, subject, html,
      kind: 'audit-deleted',
      context: { storeName, timestamp },
    });
    console.info('Delete notification queued:', { id: result.id, store: storeName });
    return result;
  } catch (err) {
    console.error('Delete notification could not be queued:', err.message);
    return { queued: false, reason: err.message };
  }
}

import { buildAuditEmailContent, buildDeleteEmailContent } from './audit-email';
import { getAuditEmailRecipients } from './email-recipients';
import { sendGraphMail, isGraphMailConfigured } from './graph-mail';

const TEST_STORE_PREFIX = 'KV Smoke ';

function isSmokeTestAudit(audit) {
  return String(audit?.storeName || '').startsWith(TEST_STORE_PREFIX);
}

/**
 * Send QC audit notification email (non-throwing; logs errors).
 */
const DELETE_ALERT_RECIPIENTS = ['saiyed.a@myfrido.com', 'mehak.g@myfrido.com'];

export async function notifyAuditDeleted(audit) {
  if (!isGraphMailConfigured()) {
    console.warn('Delete email skipped: Graph mail not configured');
    return { sent: false, reason: 'not configured' };
  }

  const { subject, html } = buildDeleteEmailContent(audit);

  try {
    const result = await sendGraphMail({ to: DELETE_ALERT_RECIPIENTS, subject, html });
    console.info('Delete notification sent:', { store: audit.storeName });
    return result;
  } catch (err) {
    console.error('Delete notification failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

export async function notifyAuditSubmitted(audit) {
  if (isSmokeTestAudit(audit)) {
    return { sent: false, reason: 'smoke test audit skipped' };
  }

  if (!isGraphMailConfigured()) {
    console.warn(
      'Audit email skipped: set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, GRAPH_SENDER_UPN'
    );
    return { sent: false, reason: 'not configured' };
  }

  const { to, cc } = getAuditEmailRecipients();
  const { subject, html } = buildAuditEmailContent(audit);

  try {
    const result = await sendGraphMail({ to, cc, subject, html });
    console.info('Audit notification sent:', {
      store: audit.storeName,
      to,
      cc,
      subject,
    });
    return result;
  } catch (err) {
    console.error('Audit notification failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

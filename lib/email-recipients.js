/**
 * Default QC audit notification recipients.
 * Override with QC_AUDIT_EMAIL_TO / QC_AUDIT_EMAIL_CC (comma-separated).
 */

export const DEFAULT_EMAIL_TO = ['saiyed.a@myfrido.com'];

export const DEFAULT_EMAIL_CC = [
  'yogesh.t@myfrido.com',
  'mehak.g@myfrido.com',
  'nishrit.p@myfrido.com',
  'Siddhant.n@myfrido.com',
];

function parseList(value) {
  if (!value || !String(value).trim()) return null;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAuditEmailRecipients() {
  const to = parseList(process.env.QC_AUDIT_EMAIL_TO) || [...DEFAULT_EMAIL_TO];
  const cc = parseList(process.env.QC_AUDIT_EMAIL_CC) || [...DEFAULT_EMAIL_CC];
  return { to, cc };
}

import {
  SECTION_IDS,
  SECTION_NAMES,
  SECTION_COUNTS,
  CHECKPOINT_LABELS,
} from './audit-sections';
import { extractNoSkipIssues } from './audit-issues';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatVisitDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function answerStyle(answer) {
  const a = String(answer || '').toUpperCase();
  if (a === 'YES') return 'color:#15803d;font-weight:600';
  if (a === 'NO') return 'color:#dc2626;font-weight:700';
  if (a === 'SKIP') return 'color:#6b7280;font-weight:700';
  return 'color:#374151';
}

function renderSectionTable(sId, audit) {
  const checkpoints = audit.checkpoints || {};
  const sectionData = checkpoints[sId] || {};
  const score = audit.sectionScores?.[sId] ?? '—';
  const max = SECTION_COUNTS[sId];
  const showProductFields = sId === 'S4' || sId === 'S7';

  let rows = '';
  for (let q = 1; q <= max; q++) {
    const qKey = `Q${q}`;
    const cp = sectionData[qKey] || {};
    const labels = CHECKPOINT_LABELS[sId] || [];
    const label = labels[q - 1] || qKey;
    const productCols = showProductFields
      ? `<td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(cp.productName || '—')}</td>
         <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(cp.correctiveAction || '—')}</td>`
      : '';
    rows += `<tr>
      <td style="padding:6px 8px;border:1px solid #e5e7eb">${q}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(label)}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280">${escapeHtml(cp.spec || '—')}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;${answerStyle(cp.answer)}">${escapeHtml(cp.answer || '—')}</td>
      ${productCols}
      <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(cp.remark || '—')}</td>
    </tr>`;
  }

  const productHeaders = showProductFields
    ? `<th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Product name</th>
       <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Corrective action</th>`
    : '';

  return `
    <h3 style="margin:20px 0 8px;font-size:15px;color:#111">${escapeHtml(sId)} — ${escapeHtml(SECTION_NAMES[sId])} (${score}/${max})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">#</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Checkpoint</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Specification</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Answer</th>
          ${productHeaders}
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Remark</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildAuditEmailContent(audit) {
  const issues = extractNoSkipIssues(audit);
  const photoCount = (audit.photos || []).length;

  let issuesBlock = '';
  if (issues.length === 0) {
    issuesBlock = `<p style="color:#15803d;font-weight:600">No checkpoints marked NO or SKIP on this visit.</p>`;
  } else {
    let issueRows = '';
    issues.forEach((r) => {
      const statusColor = r.answer === 'NO' ? '#dc2626' : '#6b7280';
      issueRows += `<tr>
        <td style="padding:8px;border:1px solid #fecaca;font-size:12px;color:#6b7280">${escapeHtml(r.section)}</td>
        <td style="padding:8px;border:1px solid #fecaca">${escapeHtml(r.label)}</td>
        <td style="padding:8px;border:1px solid #fecaca;font-weight:700;color:${statusColor}">${escapeHtml(r.answer)}</td>
        <td style="padding:8px;border:1px solid #fecaca">${escapeHtml(r.remark || '—')}</td>
      </tr>`;
    });
    issuesBlock = `
      <p style="margin:0 0 8px"><strong>${issues.length}</strong> checkpoint${issues.length === 1 ? '' : 's'} marked NO or SKIP:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff5f5">
        <thead>
          <tr style="background:#fee2e2">
            <th style="padding:8px;border:1px solid #fecaca;text-align:left">Section</th>
            <th style="padding:8px;border:1px solid #fecaca;text-align:left">Checkpoint</th>
            <th style="padding:8px;border:1px solid #fecaca;text-align:left">Status</th>
            <th style="padding:8px;border:1px solid #fecaca;text-align:left">Remark</th>
          </tr>
        </thead>
        <tbody>${issueRows}</tbody>
      </table>`;
  }

  let fullCopy = '';
  SECTION_IDS.forEach((sId) => {
    fullCopy += renderSectionTable(sId, audit);
  });

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;color:#111;max-width:900px;margin:0 auto;padding:16px">
  <div style="border-bottom:3px solid #FFD400;padding-bottom:12px;margin-bottom:16px">
    <h1 style="margin:0;font-size:20px">Frido QC Audit — ${escapeHtml(audit.storeName)}</h1>
    <p style="margin:6px 0 0;color:#6b7280;font-size:14px">Automated notification · ${formatVisitDate(audit.visitDate || audit.timestamp)}</p>
  </div>

  <table style="width:100%;font-size:14px;margin-bottom:20px">
    <tr><td style="padding:4px 0;color:#6b7280;width:120px">Store</td><td><strong>${escapeHtml(audit.storeName)}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Location</td><td>${escapeHtml(audit.location || '—')}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Auditor</td><td>${escapeHtml(audit.auditorName)}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Auditee</td><td>${escapeHtml(audit.auditeeName || '—')}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Visit date</td><td>${formatVisitDate(audit.visitDate)}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Total score</td><td><strong>${audit.totalScore ?? 0} / 70</strong></td></tr>
    ${photoCount ? `<tr><td style="padding:4px 0;color:#6b7280">Photos</td><td>${photoCount} attached in QC portal</td></tr>` : ''}
  </table>

  <h2 style="font-size:16px;color:#dc2626;margin:24px 0 12px">NO &amp; SKIP checkpoints</h2>
  ${issuesBlock}

  <h2 style="font-size:16px;margin:28px 0 12px;border-top:1px solid #e5e7eb;padding-top:20px">Full response copy</h2>
  ${fullCopy}

  <p style="margin-top:24px;font-size:12px;color:#9ca3af">Sent from Frido QC Audit · ${new Date().toISOString()}</p>
</body>
</html>`;

  const issuePart =
    issues.length === 0
      ? 'no NO/SKIP'
      : `${issues.length} NO/SKIP issue${issues.length === 1 ? '' : 's'}`;

  const subject = `QC Audit: ${audit.storeName} — ${issuePart} — ${formatVisitDate(audit.visitDate)}`;

  return { subject, html, issueCount: issues.length };
}

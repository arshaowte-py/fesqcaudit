import {
  SECTION_IDS,
  SECTION_NAMES,
  SECTION_COUNTS,
  CHECKPOINT_LABELS,
} from './audit-sections';

export function extractNoSkipIssues(audit) {
  const checkpoints = audit.checkpoints || {};
  const rows = [];

  SECTION_IDS.forEach((sId) => {
    const cps = checkpoints[sId] || {};
    const maxQ = Math.max(
      SECTION_COUNTS[sId] || 0,
      ...Object.keys(cps).map((k) => parseInt(k.replace('Q', ''), 10) || 0),
      0
    );

    for (let q = 1; q <= maxQ; q++) {
      const qKey = `Q${q}`;
      const cp = cps[qKey];
      const answer = cp?.answer ? String(cp.answer).toUpperCase().trim() : null;
      if (answer !== 'NO' && answer !== 'SKIP') continue;

      const labels = CHECKPOINT_LABELS[sId] || [];
      rows.push({
        sectionId: sId,
        section: SECTION_NAMES[sId] || sId,
        label: labels[q - 1] || `${sId}-Q${q}`,
        answer,
        spec: cp?.spec || '',
        remark: cp?.remark || '',
        sortKey: `${sId}-Q${String(q).padStart(2, '0')}`,
      });
    }
  });

  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return rows;
}

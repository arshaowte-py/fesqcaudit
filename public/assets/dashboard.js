/* ═══════════════════════════════════════════
   FRIDO QC DASHBOARD — LOGIC (shell-compatible)
   Renders into #view-dashboard
   Six required widgets, grouped into thematic
   sections styled like the Frido Master Dashboard.
   ═══════════════════════════════════════════ */

const SECTION_NAMES = {
  S1: 'Store Cleanliness & Hygiene',
  S2: 'BOH Check',
  S3: 'Store Maintenance',
  S4: 'Merchandising & Display',
  S5: 'Stockroom Quality',
  S6: 'Store Operations & Compliance',
  S7: 'Product Quality & Condition',
};

const SECTION_COUNTS = { S1: 5, S2: 1, S3: 1, S4: 17, S5: 5, S6: 6, S7: 35 };

const CHECKPOINT_LABELS = {
  S1: ['Store floor is clean and free of dust', 'Display shelves cleaned and organized', 'AC / fans in working condition', 'No foul smell inside store', 'Dustbins available and emptied'],
  S2: ['BOH 5S'],
  S3: ['Check if any infra damaged'],
  S4: ['Display as per planogram', 'Bestsellers displayed in prime locations', 'New arrivals displayed properly', 'Seasonal products highlighted', 'Signage clean and correct', 'Mannequins properly dressed if available', 'Wedge stand availability', 'Maniquine for TNP', 'Maniquine for Barefoot and socks', 'Differentiators', 'Size chart', 'Footwear measurer', 'Stands Quality stickering/pasting', 'Fire Extinguisher', 'Staff Uniform', 'Cash counter lock check keys check', 'Cash register file'],
  S5: ['Stockroom organized by category and size', 'No leakage moisture or dust', 'Proper racks and bins available', 'FIFO followed for inventory', 'Damaged stock segregated and logged'],
  S6: ['Billing system working smoothly', 'CCTV working', 'Emergency exits clear', 'Customer feedback register updated', 'Inward and Outward file check', 'Compliance check'],
  S7: ['Zipper issue', 'Stains on cover', 'Firmness of cusions', 'Hardness of cusions', 'Bubbles', 'Cuts/Torn', 'Lints', 'TNP velcro loose', 'No faded', 'Hinges check', 'Stains', 'Lints', 'All Functions Check', 'Portable desk loose', 'No faded', 'Dust on boxes', 'Box condition', 'Sticker position', 'Stain', 'Wear and tare', 'Glue marks', 'Covers for shoes available', 'Damages', 'All latest models availability', 'Double stickering/MRP', 'Packaging condition', 'Dust/Dirt', 'Machine check', 'Cleanliness', 'Wiring check', 'Machine cleanliness 2D 3D', 'No damaged / defective products on display', 'No faded stained or torn products', 'Packaging intact and clean', 'Returned items checked before keeping back'],
};

const MASTER_STORES = [
  'Phoenix Marketcity Viman Nagar',
  'Amanora Mall Magarpatta',
  'Amar Tech Park Balewadi',
  'Elpro Mall PCMC',
  'Westend Mall Aundh Pune',
  'Kopa Mall Ghorpadi KP',
  'Mall of Asia Bangalore',
  'Lakeshore Mall Y Junction',
  'Sky City Mall Borivali',
  'Gachibowli Hyderabad',
  'Banjara Hills Hyderabad',
  'DLF Mall Gurgaon Delhi',
  'Bhartiya Mall Bangalore',
  'Kompally Hyderabad',
];

let allAudits = [];
let filteredAudits = [];

/* ─── Grade helpers ─── */
function getGrade(score) {
  if (score === 70) return { label: 'Perfect', cls: 'grade-perfect' };
  if (score >= 50) return { label: 'Good', cls: 'grade-good' };
  if (score >= 30) return { label: 'Needs Work', cls: 'grade-needs-work' };
  return { label: 'Critical', cls: 'grade-critical' };
}

/* ─── Utility ─── */
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/* ─── Icon library ─── */
const ICONS = {
  trophy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 4h3v3a3 3 0 0 1-3 3"/><path d="M7 4H4v3a3 3 0 0 0 3 3"/></svg>',
  bars: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  refresh: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  layers: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  spark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  chevron: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
};

function setStoreAccordionOpen(block, open) {
  const toggle = block.querySelector('.store-accordion-toggle');
  const panel = block.querySelector('.store-accordion-panel');
  if (!toggle || !panel) return;
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  panel.hidden = !open;
  block.classList.toggle('store-accordion--open', open);
}

function setAllStoreAccordions(container, open) {
  container.querySelectorAll('.store-accordion').forEach((block) => {
    setStoreAccordionOpen(block, open);
  });
}

function prependStoreAccordionToolbar(container) {
  const existing = container.querySelector('.store-accordion-toolbar');
  if (existing) existing.remove();

  const bar = el('div', 'store-accordion-toolbar');
  const expandBtn = el('button', 'store-accordion-toolbar-btn');
  expandBtn.type = 'button';
  expandBtn.textContent = 'Expand all stores';
  const collapseBtn = el('button', 'store-accordion-toolbar-btn');
  collapseBtn.type = 'button';
  collapseBtn.textContent = 'Collapse all stores';
  expandBtn.addEventListener('click', () => setAllStoreAccordions(container, true));
  collapseBtn.addEventListener('click', () => setAllStoreAccordions(container, false));
  bar.appendChild(expandBtn);
  bar.appendChild(collapseBtn);
  container.insertBefore(bar, container.firstChild);
}

function buildCollapsibleStoreBlock({ storeName, metaHtml = '', count, countLabel, contentNode, startExpanded = false }) {
  const block = el('div', 'store-accordion');
  const toggle = el('button', 'store-accordion-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', startExpanded ? 'true' : 'false');

  const label = countLabel || `${count} item${count !== 1 ? 's' : ''}`;
  toggle.innerHTML = `
    <span class="store-accordion-chevron" aria-hidden="true">${ICONS.chevron}</span>
    <span class="gap-pin">📍</span>
    <span class="store-accordion-title">${storeName}</span>
    ${metaHtml}
    <span class="store-accordion-count">${label}</span>`;

  const panel = el('div', 'store-accordion-panel');
  panel.hidden = !startExpanded;
  const scroll = el('div', 'store-accordion-panel-scroll');
  scroll.appendChild(contentNode);
  panel.appendChild(scroll);

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    setStoreAccordionOpen(block, !expanded);
  });

  if (startExpanded) block.classList.add('store-accordion--open');

  block.appendChild(toggle);
  block.appendChild(panel);
  return block;
}

/* ═══════════════════════════════════════════
   INIT — called by the shell
   ═══════════════════════════════════════════ */
window.initDashboard = function initDashboard() {
  const root = document.getElementById('view-dashboard');
  if (!root) return;

  allAudits = (window.fridoData && window.fridoData.audits) || [];

  root.innerHTML = '';

  // Page title row
  const titleRow = el('div', 'page-title-row');
  titleRow.innerHTML = `
    <div>
      <h1 class="page-title">Store Audit Dashboard</h1>
      <p class="page-subtitle">Track audit performance, coverage and section health across every Frido store.</p>
    </div>
  `;
  root.appendChild(titleRow);

  if (!allAudits.length) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = `
      <div class="empty-icon">${ICONS.list}</div>
      <h3>No audits yet</h3>
      <p>Submit your first store audit to populate the analytics.</p>
      <button class="btn-primary" onclick="switchView('audit-form')">Start First Audit &rarr;</button>
    `;
    root.appendChild(empty);
    return;
  }

  /* ── Filters ── */
  const filterRow = el('div', 'filter-row');
  filterRow.innerHTML = buildFilters();
  root.appendChild(filterRow);

  /* ── KPI row ── */
  const kpiRow = el('div', 'kpi-row');
  kpiRow.id = 'kpiRow';
  root.appendChild(kpiRow);

  /* ── GROUP 1: Performance Overview ── */
  const perfGroup = buildSectionGroup({
    icon: ICONS.trophy,
    title: 'Performance Overview',
    subtitle: 'Leadership board, store averages and audit volume',
    countId: 'perfCount',
  });
  perfGroup.body.appendChild(buildCardShell('leaderboardCard', ICONS.trophy, 'Store Leaderboard'));
  perfGroup.body.appendChild(buildCardShell('gradeDistCard', ICONS.layers, 'Grade Distribution'));
  perfGroup.body.appendChild(buildCardShell('scoreTrendCard', ICONS.spark, 'Score Trend'));
  perfGroup.body.appendChild(buildCardShell('storeAvgCard', ICONS.bars, 'Store-wise Average Score'));
  perfGroup.body.appendChild(buildCardShell('auditsPerStoreCard', ICONS.list, 'Audits Conducted Per Store'));
  perfGroup.countEl.textContent = '5 widgets';
  root.appendChild(perfGroup.section);

  /* ── GROUP 2: Audit Coverage ── */
  const coverGroup = buildSectionGroup({
    icon: ICONS.check,
    title: 'Audit Coverage',
    subtitle: 'Audited vs pending stores and re-audit gap tracking',
    countId: 'coverCount',
    iconVariant: 'blue',
  });
  coverGroup.body.appendChild(buildCardShell('auditStatusCard', ICONS.check, 'Audited vs Pending Stores'));
  coverGroup.body.appendChild(buildCardShell('gapCard', ICONS.refresh, 'Re-Audit Gap Analysis', { collapsible: true }));
  coverGroup.countEl.textContent = '2 widgets';
  root.appendChild(coverGroup.section);

  /* ── GROUP 3: Failed & Skipped Checkpoints ── */
  const issuesGroup = buildSectionGroup({
    icon: ICONS.list,
    title: 'Failed & Skipped Checkpoints',
    subtitle: 'NO and SKIP from each store\'s latest submitted audit',
    countId: 'issuesCount',
  });
  issuesGroup.body.appendChild(buildCardShell('issuesCard', ICONS.alert, 'Store-wise NO & SKIP', { collapsible: true }));
  issuesGroup.countEl.textContent = '1 widget';
  root.appendChild(issuesGroup.section);

  /* ── GROUP 4: Audit Health ── */
  const healthGroup = buildSectionGroup({
    icon: ICONS.alert,
    title: 'Audit Health',
    subtitle: 'Section-level failure rates across all visits',
    countId: 'healthCount',
    iconVariant: 'rose',
  });
  healthGroup.body.appendChild(buildCardShell('failureCard', ICONS.alert, 'Section Failure Rate'));
  healthGroup.countEl.textContent = '1 widget';
  root.appendChild(healthGroup.section);

  // Bind filter events
  root.querySelector('#filterStore').addEventListener('change', applyFilters);
  root.querySelector('#filterTime').addEventListener('change', applyFilters);
  root.querySelector('#filterGrade').addEventListener('change', applyFilters);

  populateStoreFilter();
  applyFilters();

  // Ensure widget sections are visible (KPI row renders outside these groups)
  root.querySelectorAll('.section-group').forEach((group, index) => {
    group.classList.add('section-group--visible');
    group.style.transitionDelay = `${index * 80}ms`;
  });
};

/* ─── Filter HTML ─── */
function buildFilters() {
  return `
    <select id="filterStore" class="filter-select">
      <option value="">All Stores</option>
    </select>
    <select id="filterTime" class="filter-select">
      <option value="">All Time</option>
      <option value="7">Last 7 Days</option>
      <option value="30">Last 30 Days</option>
      <option value="month">This Month</option>
    </select>
    <select id="filterGrade" class="filter-select">
      <option value="">All Grades</option>
      <option value="perfect">Perfect (70)</option>
      <option value="good">Good (50–69)</option>
      <option value="needs_work">Needs Work (30–49)</option>
      <option value="critical">Critical (&lt;30)</option>
    </select>`;
}

/* ─── Section Group skeleton (like Frido Master Dashboard) ─── */
function buildSectionGroup({ icon, title, subtitle, countId, iconVariant }) {
  const section = el('section', 'section-group');
  const iconCls = iconVariant ? `section-group-icon icon--${iconVariant}` : 'section-group-icon';
  section.innerHTML = `
    <div class="section-group-header">
      <div class="${iconCls}">${icon}</div>
      <div class="section-group-text">
        <div class="section-group-title">${title}</div>
        <div class="section-group-subtitle">${subtitle}</div>
      </div>
      <div class="section-group-count" id="${countId}"></div>
    </div>
    <div class="section-group-body"></div>
  `;
  return {
    section,
    body: section.querySelector('.section-group-body'),
    countEl: section.querySelector('.section-group-count'),
  };
}

/* ─── Card skeleton ─── */
function buildCardShell(id, icon, title, { collapsible = false, startExpanded = false } = {}) {
  const card = el('div', 'card');
  const headMarkup = `
    <div class="card-head-left">
      <span class="card-icon">${icon}</span>
      <h3 class="card-title">${title}</h3>
    </div>
    ${collapsible ? `<span class="card-head-chevron" aria-hidden="true">${ICONS.chevron}</span>` : ''}`;

  const body = el('div', 'card-body');
  body.id = id;

  if (collapsible) {
    card.classList.add('card--collapsible');
    const head = el('button', 'card-head card-head-toggle');
    head.type = 'button';
    head.innerHTML = headMarkup;
    head.setAttribute('aria-expanded', startExpanded ? 'true' : 'false');
    head.setAttribute('aria-controls', id);
    body.hidden = !startExpanded;
    card.classList.toggle('card--open', startExpanded);
    head.addEventListener('click', () => {
      const expanded = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      body.hidden = expanded;
      card.classList.toggle('card--open', !expanded);
    });
    card.appendChild(head);
  } else {
    const head = el('div', 'card-head');
    head.innerHTML = headMarkup;
    card.appendChild(head);
  }

  card.appendChild(body);
  return card;
}

/* ─── Store Filter Options ─── */
function populateStoreFilter() {
  const select = document.getElementById('filterStore');
  const stores = [...new Set(allAudits.map(a => a.storeName))].sort();
  stores.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

/* ─── Filtering ─── */
function parseVisitDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function applyFilters() {
  const store = document.getElementById('filterStore').value;
  const time = document.getElementById('filterTime').value;
  const grade = document.getElementById('filterGrade').value;
  const now = new Date();

  filteredAudits = allAudits.filter(a => {
    if (store && a.storeName !== store) return false;

    if (time) {
      const d = parseVisitDate(a.visitDate || a.timestamp);
      if (!d) return false;

      if (time === 'month') {
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      } else {
        const days = parseInt(time, 10);
        const cutoff = new Date(now);
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - days);
        d.setHours(0, 0, 0, 0);
        if (d < cutoff) return false;
      }
    }

    if (grade) {
      const s = a.totalScore;
      if (grade === 'perfect' && s !== 70) return false;
      if (grade === 'good' && (s < 50 || s > 69)) return false;
      if (grade === 'needs_work' && (s < 30 || s > 49)) return false;
      if (grade === 'critical' && s >= 30) return false;
    }

    return true;
  });

  renderKPIs();
  renderLeaderboard();
  renderGradeDistribution();
  renderScoreTrend();
  renderStoreAvg();
  renderAuditsPerStore();
  renderAuditStatus();
  renderGapAnalysis();
  renderIssueCheckpoints();
  renderFailureChart();
  renderFilterNotice();
}

function filterByStore(storeName) {
  const select = document.getElementById('filterStore');
  if (!select || !storeName) return;
  select.value = storeName;
  applyFilters();
}

/* ─── Interactive chart helpers ─── */
function renderInteractiveBars(container, items, { fillClass = 'score-row-bar-fill', onBarClick } = {}) {
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<p class="empty-msg">No data</p>';
    return;
  }

  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const chart = el('div', 'chart-bars');

  items.forEach((item, index) => {
    const pct = Math.min(100, (item.value / (item.max || maxVal)) * 100);
    const row = el('div', 'chart-bar-row');
    row.style.setProperty('--bar-delay', `${index * 60}ms`);

    const label = el('button', 'chart-bar-label');
    label.type = 'button';
    label.textContent = item.label;
    label.title = item.tooltip || item.label;
    if (onBarClick) {
      label.addEventListener('click', () => onBarClick(item));
    }

    const track = el('div', 'chart-bar-track');
    const fill = el('div', `chart-bar-fill ${fillClass}`);
    fill.style.width = '0%';
    fill.dataset.targetWidth = `${pct}%`;
    fill.setAttribute('role', 'presentation');

    const value = el('div', 'chart-bar-value');
    value.textContent = item.display ?? String(item.value);

    track.appendChild(fill);
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);

    if (item.tooltip) {
      row.setAttribute('title', item.tooltip);
    }

    chart.appendChild(row);
  });

  container.appendChild(chart);

  requestAnimationFrame(() => {
    chart.querySelectorAll('.chart-bar-fill').forEach((fillEl) => {
      fillEl.style.width = fillEl.dataset.targetWidth || '0%';
    });
  });
}

function renderFilterNotice() {
  const existing = document.getElementById('dashboardFilterNotice');
  if (existing) existing.remove();

  if (filteredAudits.length || !allAudits.length) return;

  const notice = el('div', 'info-banner');
  notice.id = 'dashboardFilterNotice';
  notice.innerHTML = `
    <span class="info-banner-icon">${ICONS.alert}</span>
    <div>
      <strong>No audits match the current filters.</strong>
      You have ${allAudits.length} saved audit${allAudits.length === 1 ? '' : 's'} — try setting time to <em>All Time</em> or clearing store/grade filters.
    </div>`;

  const kpiRow = document.getElementById('kpiRow');
  if (kpiRow) kpiRow.insertAdjacentElement('afterend', notice);
}

/* ═══════════════════════════════════════════
   WIDGETS
   ═══════════════════════════════════════════ */

/* ─── KPIs ─── */
function renderKPIs() {
  const row = document.getElementById('kpiRow');
  const total = filteredAudits.length;
  const avg = total ? (filteredAudits.reduce((s, a) => s + a.totalScore, 0) / total) : 0;
  const perfect = filteredAudits.filter(a => a.totalScore === 70).length;
  const critical = filteredAudits.filter(a => a.totalScore < 30).length;

  const avgCls = avg >= 50 ? 'green' : avg >= 30 ? 'orange' : 'red';

  row.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon">${ICONS.list}</div>
      <div class="kpi-label">TOTAL AUDITS</div>
      <div class="kpi-value">${total}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">${ICONS.spark}</div>
      <div class="kpi-label">AVG SCORE /70</div>
      <div class="kpi-value ${avgCls}">${avg.toFixed(1)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">${ICONS.trophy}</div>
      <div class="kpi-label">PERFECT SCORES</div>
      <div class="kpi-value green">${perfect}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">${ICONS.alert}</div>
      <div class="kpi-label">CRITICAL &lt;30</div>
      <div class="kpi-value red">${critical}</div>
    </div>`;
}

/* ─── Leaderboard (Widget 2: Leadership Board) ─── */
function renderLeaderboard() {
  const container = document.getElementById('leaderboardCard');
  if (!container) return;
  container.innerHTML = '';
  const storeMap = buildStoreMap();

  if (!storeMap.length) {
    container.innerHTML = '<p class="empty-msg">No data</p>';
    return;
  }

  const table = el('table', 'data-table');
  table.innerHTML = `<thead><tr>
    <th>RANK</th><th>STORE</th><th>AVG SCORE</th><th>AUDITS</th><th>GRADE</th>
  </tr></thead>`;
  const tbody = el('tbody');

  storeMap.forEach((s, i) => {
    const grade = getGrade(Math.round(s.avg));
    const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const rankContent = rankEmoji || (i + 1);

    const tr = el('tr');
    tr.className = 'leaderboard-row-clickable';
    tr.title = `Filter dashboard to ${s.name}`;
    tr.addEventListener('click', () => filterByStore(s.name));
    tr.innerHTML = `
      <td><span class="leaderboard-rank ${rankCls}">${rankContent}</span></td>
      <td style="font-weight:600">${s.name}</td>
      <td style="font-weight:700">${s.avg.toFixed(1)}</td>
      <td>${s.count}</td>
      <td><span class="grade-badge ${grade.cls}">${grade.label}</span></td>`;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  const wrap = el('div', 'table-wrap');
  wrap.appendChild(table);
  container.appendChild(wrap);
}

/* ─── Grade Distribution ─── */
function renderGradeDistribution() {
  const container = document.getElementById('gradeDistCard');
  if (!container) return;
  container.innerHTML = '';

  const buckets = [
    { key: 'perfect', label: 'Perfect', cls: 'grade-perfect', count: 0 },
    { key: 'good', label: 'Good', cls: 'grade-good', count: 0 },
    { key: 'needs_work', label: 'Needs Work', cls: 'grade-needs-work', count: 0 },
    { key: 'critical', label: 'Critical', cls: 'grade-critical', count: 0 },
  ];

  filteredAudits.forEach((a) => {
    const score = a.totalScore;
    if (score === 70) buckets[0].count++;
    else if (score >= 50) buckets[1].count++;
    else if (score >= 30) buckets[2].count++;
    else buckets[3].count++;
  });

  const total = filteredAudits.length;
  if (!total) {
    container.innerHTML = '<p class="empty-msg">No data</p>';
    return;
  }

  let gradientParts = [];
  let cursor = 0;
  const colors = ['#10B981', '#2563EB', '#FFD200', '#F43F5E'];

  buckets.forEach((b, i) => {
    const pct = (b.count / total) * 100;
    if (pct <= 0) return;
    gradientParts.push(`${colors[i]} ${cursor}% ${cursor + pct}%`);
    cursor += pct;
  });

  const donut = el('div', 'chart-donut-wrap');
  donut.innerHTML = `
    <div class="chart-donut" style="background: conic-gradient(${gradientParts.join(', ')})">
      <div class="chart-donut-hole">
        <div class="chart-donut-total">${total}</div>
        <div class="chart-donut-label">audits</div>
      </div>
    </div>
    <div class="chart-donut-legend"></div>`;

  const legend = donut.querySelector('.chart-donut-legend');
  buckets.forEach((b) => {
    if (!b.count) return;
    const pct = Math.round((b.count / total) * 100);
    const item = el('button', 'chart-legend-item');
    item.type = 'button';
    item.innerHTML = `
      <span class="chart-legend-dot ${b.cls}"></span>
      <span class="chart-legend-text">${b.label}</span>
      <span class="chart-legend-value">${b.count} (${pct}%)</span>`;
    item.title = `Filter by ${b.label} grade`;
    item.addEventListener('click', () => {
      const select = document.getElementById('filterGrade');
      if (select) {
        select.value = b.key;
        applyFilters();
      }
    });
    legend.appendChild(item);
  });

  container.appendChild(donut);
}

/* ─── Score Trend (line chart) ─── */
function renderScoreTrend() {
  const container = document.getElementById('scoreTrendCard');
  if (!container) return;
  container.innerHTML = '';

  if (filteredAudits.length < 2) {
    container.innerHTML = `
      <div class="chart-empty-hint">
        <span>${ICONS.spark}</span>
        <p>Score trend appears once you have 2 or more audits in the current filter.</p>
      </div>`;
    return;
  }

  const points = [...filteredAudits]
    .sort((a, b) => {
      const da = parseVisitDate(a.visitDate || a.timestamp)?.getTime() || 0;
      const db = parseVisitDate(b.visitDate || b.timestamp)?.getTime() || 0;
      return da - db;
    })
    .map((a) => ({
      score: a.totalScore,
      label: formatTrendLabel(a.visitDate || a.timestamp),
      store: a.storeName,
      tooltip: `${a.storeName} · ${formatTrendLabel(a.visitDate || a.timestamp)} · ${a.totalScore}/70`,
    }));

  const width = 480;
  const height = 160;
  const pad = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxScore = 70;

  const coords = points.map((p, i) => {
    const x = pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = pad.top + innerH - (p.score / maxScore) * innerH;
    return { ...p, x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${pad.top + innerH} L ${coords[0].x.toFixed(1)} ${pad.top + innerH} Z`;

  const wrap = el('div', 'chart-line-wrap');
  wrap.innerHTML = `
    <svg class="chart-line" viewBox="0 0 ${width} ${height}" role="img" aria-label="Audit score trend">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,210,0,0.35)"/>
          <stop offset="100%" stop-color="rgba(255,210,0,0.02)"/>
        </linearGradient>
      </defs>
      ${[0, 35, 70].map((tick) => {
        const y = pad.top + innerH - (tick / maxScore) * innerH;
        return `
          <line class="chart-grid-line" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/>
          <text class="chart-axis-label" x="${pad.left - 8}" y="${y + 4}" text-anchor="end">${tick}</text>`;
      }).join('')}
      <path class="chart-area" d="${areaPath}"/>
      <path class="chart-line-path" d="${linePath}"/>
      ${coords.map((c) => `
        <g class="chart-point-group">
          <circle class="chart-point-hit" cx="${c.x}" cy="${c.y}" r="12"/>
          <circle class="chart-point" cx="${c.x}" cy="${c.y}" r="4.5" data-tooltip="${escapeAttr(c.tooltip)}"/>
          <text class="chart-point-label" x="${c.x}" y="${height - 6}" text-anchor="middle">${c.label}</text>
        </g>`).join('')}
    </svg>
    <div class="chart-tooltip" id="scoreTrendTooltip" hidden></div>`;

  const tooltip = wrap.querySelector('#scoreTrendTooltip');
  wrap.querySelectorAll('.chart-point').forEach((dot) => {
    dot.addEventListener('mouseenter', (e) => {
      tooltip.hidden = false;
      tooltip.textContent = dot.dataset.tooltip || '';
      const rect = wrap.getBoundingClientRect();
      tooltip.style.left = `${e.clientX - rect.left}px`;
      tooltip.style.top = `${e.clientY - rect.top - 36}px`;
    });
    dot.addEventListener('mouseleave', () => {
      tooltip.hidden = true;
    });
  });

  container.appendChild(wrap);
}

function formatTrendLabel(dateStr) {
  const d = parseVisitDate(dateStr);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

/* ─── Store-wise Avg Score (Widget 1) ─── */
function renderStoreAvg() {
  const container = document.getElementById('storeAvgCard');
  if (!container) return;
  const storeMap = buildStoreMap();

  renderInteractiveBars(
    container,
    storeMap.map((s) => ({
      label: s.name,
      value: s.avg,
      max: 70,
      display: s.avg.toFixed(1),
      tooltip: `${s.name} · avg ${s.avg.toFixed(1)}/70 · ${s.count} audit${s.count !== 1 ? 's' : ''}`,
    })),
    {
      fillClass: 'chart-fill-gold',
      onBarClick: (item) => filterByStore(item.label),
    }
  );
}

/* ─── Audits Per Store (Widget 6) ─── */
function renderAuditsPerStore() {
  const container = document.getElementById('auditsPerStoreCard');
  if (!container) return;
  const storeMap = buildStoreMap();
  const sorted = [...storeMap].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sorted.map((s) => s.count), 1);

  renderInteractiveBars(
    container,
    sorted.map((s) => ({
      label: s.name,
      value: s.count,
      max: maxCount,
      display: String(s.count),
      tooltip: `${s.name} · ${s.count} audit${s.count !== 1 ? 's' : ''} · avg ${s.avg.toFixed(1)}/70`,
    })),
    {
      fillClass: 'chart-fill-ink',
      onBarClick: (item) => filterByStore(item.label),
    }
  );
}

/* ─── Audited vs Pending (Widget 4) ─── */
function renderAuditStatus() {
  const container = document.getElementById('auditStatusCard');
  if (!container) return;
  container.innerHTML = '';

  // Build map of audited store names (respect active filters)
  const auditedMap = {};
  filteredAudits.forEach(a => {
    const key = a.storeName;
    if (!auditedMap[key]) auditedMap[key] = 0;
    auditedMap[key]++;
  });

  let auditedCount = 0;
  let pendingCount = 0;

  // Mini summary on top
  const summary = el('div', 'status-summary');
  const wrapper = el('div', 'status-list');

  MASTER_STORES.forEach(master => {
    const keywords = master.replace(/,/g, ' ').split(/\s+/).filter(w => w.length > 2);
    let matchedKey = null;
    let matchedHits = 0;

    Object.keys(auditedMap).forEach(storeName => {
      const lower = storeName.toLowerCase();
      const hits = keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
      if (hits >= 2 || keywords.some(kw => kw.length > 4 && lower.includes(kw.toLowerCase()))) {
        if (!matchedKey || hits > matchedHits) {
          matchedKey = storeName;
          matchedHits = hits;
        }
      }
    });

    const row = el('div', 'status-row');
    if (matchedKey) {
      auditedCount++;
      row.innerHTML = `
        <span class="status-store-name">${master}</span>
        <span class="status-badge audited">✓ Audited &middot; ${auditedMap[matchedKey]}</span>`;
    } else {
      pendingCount++;
      row.innerHTML = `
        <span class="status-store-name">${master}</span>
        <span class="status-badge pending">⏳ Pending</span>`;
    }
    wrapper.appendChild(row);
  });

  summary.innerHTML = `
    <div class="status-summary-stat audited">
      <div class="status-summary-num">${auditedCount}</div>
      <div class="status-summary-lbl">Audited</div>
    </div>
    <div class="status-summary-stat pending">
      <div class="status-summary-num">${pendingCount}</div>
      <div class="status-summary-lbl">Pending</div>
    </div>
    <div class="status-summary-stat total">
      <div class="status-summary-num">${MASTER_STORES.length}</div>
      <div class="status-summary-lbl">Total Stores</div>
    </div>
  `;

  container.appendChild(summary);
  container.appendChild(wrapper);
}

/* ─── Gap Tracking (Widget 5) ─── */
function renderGapAnalysis() {
  const container = document.getElementById('gapCard');
  if (!container) return;
  container.innerHTML = '';

  const storeGroups = {};
  filteredAudits.forEach(a => {
    if (!storeGroups[a.storeName]) storeGroups[a.storeName] = [];
    storeGroups[a.storeName].push(a);
  });

  let hasContent = false;
  let storeBlockCount = 0;

  Object.keys(storeGroups).sort().forEach(storeName => {
    const audits = storeGroups[storeName].sort((a, b) =>
      new Date(a.visitDate || a.timestamp) - new Date(b.visitDate || b.timestamp)
    );

    if (audits.length < 2) return;

    const prev = audits[audits.length - 2];
    const latest = audits[audits.length - 1];
    const rows = [];

    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].forEach(sId => {
      const prevCps = (prev.checkpoints && prev.checkpoints[sId]) || {};
      const lateCps = (latest.checkpoints && latest.checkpoints[sId]) || {};
      const maxQ = Math.max(
        ...Object.keys(prevCps).map(k => parseInt(k.replace('Q', '')) || 0),
        ...Object.keys(lateCps).map(k => parseInt(k.replace('Q', '')) || 0),
        0
      );

      for (let q = 1; q <= maxQ; q++) {
        const qKey = `Q${q}`;
        const prevAns = prevCps[qKey] ? prevCps[qKey].answer : null;
        const lateAns = lateCps[qKey] ? lateCps[qKey].answer : null;

        if (prevAns === 'YES' && lateAns === 'YES') continue;
        if (!prevAns && !lateAns) continue;

        let status = '', statusCls = '';
        if (prevAns === 'NO' && lateAns === 'YES') {
          status = '✓ Gap Closed'; statusCls = 'gap-closed';
        } else if (prevAns === 'NO' && lateAns === 'NO') {
          status = '● Still Open'; statusCls = 'gap-open';
        } else if (prevAns === 'YES' && lateAns === 'NO') {
          status = '⚠ New Issue'; statusCls = 'gap-new';
        } else {
          if (lateAns === 'NO') { status = '⚠ New Issue'; statusCls = 'gap-new'; }
          else if (prevAns === 'NO') { status = '✓ Gap Closed'; statusCls = 'gap-closed'; }
          else continue;
        }

        const labels = CHECKPOINT_LABELS[sId] || [];
        const label = labels[q - 1] || `${sId}-Q${q}`;

        rows.push({ section: SECTION_NAMES[sId], label, prevAns: prevAns || '—', lateAns: lateAns || '—', status, statusCls });
      }
    });

    if (!rows.length) return;
    hasContent = true;
    storeBlockCount += 1;

    const table = el('table', 'data-table gap-table');
    table.innerHTML = `<thead><tr>
      <th>SECTION</th><th>CHECKPOINT</th><th>PREVIOUS</th><th>LATEST</th><th>STATUS</th>
    </tr></thead>`;
    const tbody = el('tbody');

    rows.forEach(r => {
      const tr = el('tr');
      tr.innerHTML = `
        <td style="font-size:12px;color:var(--mid-grey)">${r.section}</td>
        <td>${r.label}</td>
        <td><strong style="color:${r.prevAns === 'YES' ? 'var(--pass-green)' : 'var(--fail-red)'}">${r.prevAns}</strong></td>
        <td><strong style="color:${r.lateAns === 'YES' ? 'var(--pass-green)' : 'var(--fail-red)'}">${r.lateAns}</strong></td>
        <td><span class="${r.statusCls}">${r.status}</span></td>`;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    const wrap = el('div', 'table-wrap');
    wrap.appendChild(table);
    container.appendChild(buildCollapsibleStoreBlock({
      storeName,
      count: rows.length,
      countLabel: `${rows.length} gap${rows.length !== 1 ? 's' : ''}`,
      contentNode: wrap,
    }));
  });

  if (!hasContent) {
    container.innerHTML = `
      <div class="info-banner">
        <span class="info-banner-icon">${ICONS.refresh}</span>
        <div>
          <strong>Awaiting re-audits.</strong> Need at least 2 audits for the same store to compare gaps.
        </div>
      </div>`;
  } else if (storeBlockCount > 0) {
    prependStoreAccordionToolbar(container);
  }
}

/* ─── Failed & Skipped Checkpoints (store-wise, latest audit) ─── */
function getLatestAuditByStore(audits) {
  const map = {};
  audits.forEach((audit) => {
    const existing = map[audit.storeName];
    const auditTime = parseVisitDate(audit.visitDate || audit.timestamp)?.getTime() || 0;
    const existingTime = existing
      ? (parseVisitDate(existing.visitDate || existing.timestamp)?.getTime() || 0)
      : -1;
    if (!existing || auditTime >= existingTime) map[audit.storeName] = audit;
  });
  return map;
}

function renderIssueCheckpoints() {
  const container = document.getElementById('issuesCard');
  if (!container) return;
  container.innerHTML = '';

  const latestByStore = getLatestAuditByStore(filteredAudits);
  let hasContent = false;
  let storeBlockCount = 0;

  Object.keys(latestByStore).sort().forEach((storeName) => {
    const audit = latestByStore[storeName];
    const visitLabel = formatTrendLabel(audit.visitDate || audit.timestamp);
    const rows = [];

    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].forEach((sId) => {
      const cps = (audit.checkpoints && audit.checkpoints[sId]) || {};
      const maxQ = Math.max(
        SECTION_COUNTS[sId] || 0,
        ...Object.keys(cps).map((k) => parseInt(k.replace('Q', ''), 10) || 0),
        0
      );

      for (let q = 1; q <= maxQ; q++) {
        const qKey = `Q${q}`;
        const answer = cps[qKey] ? cps[qKey].answer : null;
        if (answer !== 'NO' && answer !== 'SKIP') continue;

        const labels = CHECKPOINT_LABELS[sId] || [];
        rows.push({
          section: SECTION_NAMES[sId],
          label: labels[q - 1] || `${sId}-Q${q}`,
          answer,
          sortKey: `${sId}-Q${String(q).padStart(2, '0')}`,
        });
      }
    });

    if (!rows.length) return;
    hasContent = true;
    storeBlockCount += 1;

    rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const table = el('table', 'data-table gap-table');
    table.innerHTML = `<thead><tr>
      <th>SECTION</th><th>CHECKPOINT</th><th>STATUS</th>
    </tr></thead>`;
    const tbody = el('tbody');

    rows.forEach((r) => {
      const answerCls = r.answer === 'NO' ? 'answer-no' : 'answer-skip';
      const tr = el('tr');
      tr.innerHTML = `
        <td style="font-size:12px;color:var(--mid-grey)">${r.section}</td>
        <td>${r.label}</td>
        <td><strong class="${answerCls}">${r.answer}</strong></td>`;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    const wrap = el('div', 'table-wrap');
    wrap.appendChild(table);
    container.appendChild(buildCollapsibleStoreBlock({
      storeName,
      metaHtml: `<span class="gap-store-meta">· Latest visit ${visitLabel}</span>`,
      count: rows.length,
      countLabel: `${rows.length} issue${rows.length !== 1 ? 's' : ''}`,
      contentNode: wrap,
    }));
  });

  if (!hasContent) {
    container.innerHTML = `
      <div class="info-banner">
        <span class="info-banner-icon">${ICONS.check}</span>
        <div>
          <strong>All clear.</strong> No checkpoints marked NO or SKIP in the current filter.
        </div>
      </div>`;
  } else if (storeBlockCount > 0) {
    prependStoreAccordionToolbar(container);
  }
}

/* ─── Section Failure Chart (Widget 7 / Audit Health) ─── */
function renderFailureChart() {
  const container = document.getElementById('failureCard');
  if (!container) return;
  container.innerHTML = '';
  const total = filteredAudits.length;

  if (!total) {
    container.innerHTML = '<p class="empty-msg">No data</p>';
    return;
  }

  const failureItems = [];
  ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].forEach((sId) => {
    let totalScore = 0;
    let maxPossible = 0;
    filteredAudits.forEach(a => {
      totalScore += a.sectionScores[sId] || 0;
      maxPossible += SECTION_COUNTS[sId];
    });

    const pct = maxPossible > 0 ? Math.round((1 - (totalScore / maxPossible)) * 100) : 0;

    let badgeCls = 'low', badgeText = 'Healthy';
    if (pct >= 75) { badgeCls = 'high'; badgeText = 'Critical'; }
    else if (pct >= 25) { badgeCls = 'medium'; badgeText = 'Watch'; }

    failureItems.push({
      label: `${sId} — ${SECTION_NAMES[sId]}`,
      value: pct,
      max: 100,
      display: `${pct}%`,
      badgeCls,
      badgeText,
      tooltip: `${SECTION_NAMES[sId]} · ${pct}% failure rate · ${badgeText}`,
    });
  });

  const chart = el('div', 'chart-bars chart-bars--failure');
  failureItems.forEach((item, index) => {
    const row = el('div', 'chart-bar-row chart-bar-row--failure');
    row.style.setProperty('--bar-delay', `${index * 50}ms`);
    row.title = item.tooltip;

    const label = el('div', 'chart-bar-label chart-bar-label--static');
    label.textContent = item.label;

    const track = el('div', 'chart-bar-track');
    const fill = el('div', 'chart-bar-fill chart-fill-failure');
    fill.style.width = '0%';
    fill.dataset.targetWidth = `${item.value}%`;
    track.appendChild(fill);

    const value = el('div', 'chart-bar-value');
    value.textContent = item.display;

    const badge = el('span', `failure-badge ${item.badgeCls}`);
    badge.textContent = item.badgeText;

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    row.appendChild(badge);
    chart.appendChild(row);
  });

  container.appendChild(chart);

  requestAnimationFrame(() => {
    chart.querySelectorAll('.chart-bar-fill').forEach((fillEl) => {
      fillEl.style.width = fillEl.dataset.targetWidth || '0%';
    });
  });
}

/* ─── Shared: build sorted store map ─── */
function buildStoreMap() {
  const map = {};
  filteredAudits.forEach(a => {
    if (!map[a.storeName]) map[a.storeName] = { name: a.storeName, scores: [], count: 0 };
    map[a.storeName].scores.push(a.totalScore);
    map[a.storeName].count++;
  });

  return Object.values(map)
    .map(s => ({ ...s, avg: s.scores.reduce((a, b) => a + b, 0) / s.count }))
    .sort((a, b) => b.avg - a.avg);
}

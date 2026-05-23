/* ──────────────────────────────────────────────
   Responses View – Frido QC Portal
   ────────────────────────────────────────────── */

const SECTION_META = {
  S1: { name: 'Store Cleanliness & Hygiene', count: 5 },
  S2: { name: 'BOH Check', count: 1 },
  S3: { name: 'Store Maintenance', count: 1 },
  S4: { name: 'Merchandising & Display', count: 17 },
  S5: { name: 'Stockroom Quality', count: 5 },
  S6: { name: 'Store Operations & Compliance', count: 6 },
  S7: { name: 'Product Quality & Condition', count: 35 },
};

/* ── Helpers ── */

function escapeHTML(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getScoreColor(score) {
  if (score >= 50) return 'green';
  if (score >= 30) return 'orange';
  return 'red';
}

function getGrade(score) {
  if (score === 70) return { label: 'Perfect', cls: 'grade-perfect' };
  if (score >= 50) return { label: 'Good', cls: 'grade-good' };
  if (score >= 30) return { label: 'Needs Work', cls: 'grade-needs-work' };
  return { label: 'Critical', cls: 'grade-critical' };
}

function getPillClass(score, max) {
  if (score >= max) return 'full';
  if (score > 0) return 'partial';
  return 'zero';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function matchesDateFilter(audit, filter) {
  if (filter === 'all') return true;
  const now = new Date();
  const visitDate = parseVisitDate(audit.visitDate);
  if (!visitDate) return true;

  if (filter === '7') {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);
    return visitDate >= cutoff;
  }
  if (filter === '30') {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    cutoff.setHours(0, 0, 0, 0);
    return visitDate >= cutoff;
  }
  if (filter === 'month') {
    return (
      visitDate.getMonth() === now.getMonth() &&
      visitDate.getFullYear() === now.getFullYear()
    );
  }
  return true;
}

function parseVisitDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function matchesCustomDateRange(audit, fromStr, toStr) {
  if (!fromStr && !toStr) return true;

  const visitDate = parseVisitDate(audit.visitDate);
  if (!visitDate) return false;

  if (fromStr) {
    const from = new Date(fromStr);
    from.setHours(0, 0, 0, 0);
    if (visitDate < from) return false;
  }

  if (toStr) {
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    if (visitDate > to) return false;
  }

  return true;
}

function applyDateFilters(audit, preset, fromStr, toStr) {
  if (fromStr || toStr) {
    return matchesCustomDateRange(audit, fromStr, toStr);
  }
  return matchesDateFilter(audit, preset);
}

function getAnswerClass(answer) {
  if (!answer) return '';
  const a = answer.toString().toUpperCase().trim();
  if (a === 'YES') return 'answer-yes';
  if (a === 'NO') return 'answer-no';
  if (a === 'SKIP' || a === 'N/A') return 'answer-skip';
  return '';
}

/* ── Photo Cache ── */
const _photoCache = {};

async function fetchPhotos(timestamp, store) {
  const key = `${timestamp}__${store}`;
  if (_photoCache[key]) return _photoCache[key];
  try {
    const params = new URLSearchParams();
    if (timestamp) params.set('timestamp', timestamp);
    if (store) params.set('store', store);
    const res = await fetch(`/api/get-photos?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch photos');
    const data = await res.json();
    _photoCache[key] = data;
    return data;
  } catch (err) {
    console.error('Photo fetch error:', err);
    return [];
  }
}

/* ── Lightbox ── */

function openLightbox(src) {
  const existing = document.querySelector('.lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&times;</button>
    <img src="${src}" alt="Audit photo" />
  `;
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('lightbox-close')) {
      lb.remove();
    }
  });
  document.body.appendChild(lb);

  // Close on Escape
  const onKey = (e) => {
    if (e.key === 'Escape') {
      lb.remove();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
}

/* ── Render Functions ── */

function renderPhotoGallery(photos, container) {
  if (!photos || photos.length === 0) {
    container.innerHTML = '<div class="no-photos">📷 No photos attached to this audit</div>';
    return;
  }

  let html = '<div class="photo-gallery-title">Attached Photos</div>';
  html += '<div class="photo-gallery">';
  photos.forEach((photo) => {
    const src = photo.data.startsWith('data:') ? photo.data : `data:image/jpeg;base64,${photo.data}`;
    html += `
      <div class="photo-thumb-card" onclick="openLightbox('${src.replace(/'/g, "\\'")}')">
        <img src="${src}" alt="${escapeHTML(photo.section)} – ${escapeHTML(photo.checkpoint)}" loading="lazy" />
        <div class="photo-thumb-info">
          <div class="photo-section">${escapeHTML(photo.section)}</div>
          <div>${escapeHTML(photo.checkpoint)}</div>
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderSectionDetail(sectionKey, audit) {
  const meta = SECTION_META[sectionKey];
  if (!meta) return '';

  const sectionScore = audit.sectionScores?.[sectionKey] ?? '—';
  const checkpoints = audit.checkpoints?.[sectionKey] || {};

  let html = `<div class="detail-section-title">${sectionKey} — ${escapeHTML(meta.name)} (${sectionScore}/${meta.count})</div>`;
  html += `<table class="detail-table">
    <thead><tr>
      <th>#</th><th>Checkpoint</th><th>Specification</th><th>Answer</th><th>Remark</th>
    </tr></thead><tbody>`;

  for (let q = 1; q <= meta.count; q++) {
    const qKey = `Q${q}`;
    const cp = checkpoints[qKey] || {};
    const answerCls = getAnswerClass(cp.answer);
    html += `<tr>
      <td>${q}</td>
      <td>${escapeHTML(qKey)}</td>
      <td>${escapeHTML(cp.spec || '—')}</td>
      <td class="${answerCls}">${escapeHTML(cp.answer || '—')}</td>
      <td>${escapeHTML(cp.remark || '—')}</td>
    </tr>`;
  }

  html += '</tbody></table>';
  return html;
}

function renderResponseDetail(audit) {
  let html = '<div class="detail-store-info">';
  const infoPairs = [
    ['Store', audit.storeName],
    ['Location', audit.location],
    ['Auditor', audit.auditorName],
    ['Auditee', audit.auditeeName],
    ['Visit Date', formatDate(audit.visitDate)],
  ];
  infoPairs.forEach(([label, value]) => {
    html += `<div class="detail-info-item">
      <label>${label}</label>
      <div class="value">${escapeHTML(value || '—')}</div>
    </div>`;
  });
  html += '</div>';

  // Section details
  Object.keys(SECTION_META).forEach((sKey) => {
    html += renderSectionDetail(sKey, audit);
  });

  // Photo gallery placeholder
  html += `<div class="photo-gallery-container"><div class="photos-loading">Loading photos…</div></div>`;

  return html;
}

function renderCard(audit, index) {
  const score = Number(audit.totalScore) || 0;
  const colorCls = getScoreColor(score);
  const grade = getGrade(score);

  let pillsHTML = '';
  Object.keys(SECTION_META).forEach((sKey) => {
    const s = Number(audit.sectionScores?.[sKey]) || 0;
    const max = SECTION_META[sKey].count;
    const pillCls = getPillClass(s, max);
    pillsHTML += `<span class="section-pill ${pillCls}">${sKey}: ${s}/${max}</span>`;
  });

  return `
    <div class="response-card" data-index="${index}">
      <div class="response-card-header" onclick="toggleResponseCard(${index})">
        <div class="response-card-left">
          <div class="response-store-name">${escapeHTML(audit.storeName)}</div>
          <div class="response-meta">
            <span>👤 ${escapeHTML(audit.auditorName)}</span>
            <span>📅 ${formatDate(audit.visitDate)}</span>
          </div>
        </div>
        <div class="response-card-right">
          <span class="grade-badge ${grade.cls}">${grade.label}</span>
          <span class="response-score ${colorCls}">${score}/70</span>
        </div>
      </div>
      <div class="response-sections-pills">${pillsHTML}</div>
      <div class="response-detail" id="response-detail-${index}"></div>
    </div>`;
}

/* ── Toggle Card Expand/Collapse ── */

async function toggleResponseCard(index) {
  const detail = document.getElementById(`response-detail-${index}`);
  const card = detail.closest('.response-card');
  if (!detail) return;

  if (detail.classList.contains('open')) {
    detail.classList.remove('open');
    card.classList.remove('expanded');
    return;
  }

  // Collapse all others
  document.querySelectorAll('.response-detail.open').forEach((d) => {
    d.classList.remove('open');
    d.closest('.response-card')?.classList.remove('expanded');
  });

  const audits = window.fridoData?.audits || [];
  const audit = audits[index];
  if (!audit) return;

  // Render detail content if empty
  if (!detail.innerHTML.trim() || detail.querySelector('.photos-loading') === null) {
    detail.innerHTML = renderResponseDetail(audit);
  }

  detail.classList.add('open');
  card.classList.add('expanded');

  // Fetch photos
  const galleryContainer = detail.querySelector('.photo-gallery-container');
  if (galleryContainer) {
    try {
      const photos = await fetchPhotos(audit.timestamp, audit.storeName);
      renderPhotoGallery(photos, galleryContainer);
    } catch {
      galleryContainer.innerHTML = '<div class="no-photos">📷 Could not load photos</div>';
    }
  }
}

/* ── Main Init ── */

function initResponses() {
  const root = document.getElementById('view-responses');
  if (!root) return;

  const audits = window.fridoData?.audits || [];

  // Build shell with page title row
  root.innerHTML = `
    <div class="page-title-row">
      <div>
        <h1 class="page-title">Response Copies</h1>
        <p class="page-subtitle">Browse every submitted audit, expand for full checkpoint details and attached photos.</p>
      </div>
    </div>
    <div class="responses-search-bar">
      <input
        class="responses-search-input"
        type="text"
        placeholder="Search by store name or auditor…"
        id="responses-search"
      />
    </div>
    <div class="responses-filters-row">
      <select class="responses-filter-select" id="responses-store-filter" aria-label="Filter by store">
        <option value="">All Stores</option>
      </select>
      <select class="responses-filter-select" id="responses-date-filter" aria-label="Filter by time period">
        <option value="all">All Time</option>
        <option value="7">Last 7 Days</option>
        <option value="30">Last 30 Days</option>
        <option value="month">This Month</option>
      </select>
      <div class="responses-date-range">
        <label class="responses-date-label">
          <span>From</span>
          <input type="date" class="responses-date-input" id="responses-date-from" aria-label="From date">
        </label>
        <label class="responses-date-label">
          <span>To</span>
          <input type="date" class="responses-date-input" id="responses-date-to" aria-label="To date">
        </label>
        <button type="button" class="responses-date-clear" id="responses-date-clear">Clear dates</button>
      </div>
    </div>
    <div class="responses-count" id="responses-count"></div>
    <div id="responses-list"></div>
  `;

  const searchInput = document.getElementById('responses-search');
  const storeFilter = document.getElementById('responses-store-filter');
  const dateFilter = document.getElementById('responses-date-filter');
  const dateFrom = document.getElementById('responses-date-from');
  const dateTo = document.getElementById('responses-date-to');
  const dateClear = document.getElementById('responses-date-clear');

  populateResponsesStoreFilter(storeFilter, audits);

  function renderList() {
    const query = (searchInput.value || '').toLowerCase().trim();
    const storeValue = storeFilter.value;
    const dateFil = dateFilter.value;
    const fromStr = dateFrom.value;
    const toStr = dateTo.value;
    const listEl = document.getElementById('responses-list');
    const countEl = document.getElementById('responses-count');

    const filtered = audits.filter((a) => {
      if (storeValue && a.storeName !== storeValue) return false;

      if (query) {
        const storeLower = (a.storeName || '').toLowerCase();
        const auditorLower = (a.auditorName || '').toLowerCase();
        if (!storeLower.includes(query) && !auditorLower.includes(query)) return false;
      }

      if (!applyDateFilters(a, dateFil, fromStr, toStr)) return false;

      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="responses-empty">
          <div class="responses-empty-icon">📋</div>
          <div>No audit responses found</div>
        </div>`;
      countEl.textContent = '0 results';
      return;
    }

    countEl.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;

    // Map filtered back to original indices
    let cardsHTML = '';
    filtered.forEach((audit) => {
      const originalIdx = audits.indexOf(audit);
      cardsHTML += renderCard(audit, originalIdx);
    });

    listEl.innerHTML = cardsHTML;
  }

  // Debounced search
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderList, 250);
  });

  dateFilter.addEventListener('change', renderList);
  storeFilter.addEventListener('change', renderList);
  dateFrom.addEventListener('change', renderList);
  dateTo.addEventListener('change', renderList);
  dateClear.addEventListener('click', () => {
    dateFrom.value = '';
    dateTo.value = '';
    renderList();
  });

  // Initial render
  renderList();
}

function populateResponsesStoreFilter(select, audits) {
  const stores = [...new Set(audits.map((a) => a.storeName).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  select.innerHTML = '<option value="">All Stores</option>';
  stores.forEach((store) => {
    const option = document.createElement('option');
    option.value = store;
    option.textContent = store;
    select.appendChild(option);
  });
}

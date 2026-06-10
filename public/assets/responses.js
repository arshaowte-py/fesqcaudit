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
  if (score == null) return 'orange';
  if (score >= 70) return 'green';
  if (score >= 40) return 'orange';
  return 'red';
}

function getGrade(score) {
  if (score == null) return { label: 'N/A', cls: 'grade-needs-work' };
  if (score === 100) return { label: 'Perfect', cls: 'grade-perfect' };
  if (score >= 70) return { label: 'Good', cls: 'grade-good' };
  if (score >= 40) return { label: 'Needs Work', cls: 'grade-needs-work' };
  return { label: 'Critical', cls: 'grade-critical' };
}

function getPillClass(score) {
  if (score == null) return 'zero';
  if (score === 100) return 'full';
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

function getPhotoSrc(data) {
  if (!data) return '';
  if (data.startsWith('data:')) return data;
  return `data:image/jpeg;base64,${data}`;
}

function injectPhotosIntoCheckpoints(photos, container) {
  if (!photos || photos.length === 0) return;

  const photoMap = {};
  photos.forEach((photo) => {
    if (!photo.section || !photo.checkpoint) return;
    const key = `${photo.section}||${photo.checkpoint}`;
    if (!photoMap[key]) photoMap[key] = [];
    photoMap[key].push(photo.data);
  });

  container.querySelectorAll('.cp-photos-cell').forEach((cell) => {
    const sKey = cell.dataset.section;
    const qKey = cell.dataset.qkey;
    if (!sKey || !qKey) return;
    const qIndex = parseInt(qKey.replace('Q', ''), 10) - 1;
    const label = (CHECKPOINT_LABELS[sKey] || [])[qIndex];
    if (!label) return;
    const cellPhotos = photoMap[`${sKey}||${label}`] || [];
    if (cellPhotos.length === 0) return;

    let html = '<div class="cp-photo-thumbs">';
    cellPhotos.forEach((data, idx) => {
      const src = getPhotoSrc(data);
      html += `<img src="${src}" class="cp-photo-thumb" alt="Photo ${idx + 1}" loading="lazy" />`;
    });
    html += '</div>';
    cell.innerHTML = html;

    cell.querySelectorAll('.cp-photo-thumb').forEach((img) => {
      img.addEventListener('click', () => openLightbox(img.src));
    });
  });
}

function renderPhotoGallery(photos, container) {
  if (!photos || photos.length === 0) {
    container.innerHTML = '<div class="no-photos">📷 No photos attached to this audit</div>';
    return;
  }

  let html = '<div class="photo-gallery-title">Attached Photos</div>';
  html += '<div class="photo-gallery">';
  photos.forEach((photo, idx) => {
    const src = getPhotoSrc(photo.data);
    html += `
      <div class="photo-thumb-card" data-photo-idx="${idx}">
        <img src="${src}" alt="${escapeHTML(photo.section)} – ${escapeHTML(photo.checkpoint)}" loading="lazy" />
        <div class="photo-thumb-info">
          <div class="photo-section">${escapeHTML(photo.section)}</div>
          <div>${escapeHTML(photo.checkpoint)}</div>
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.photo-thumb-card').forEach((card, idx) => {
    card.addEventListener('click', () => openLightbox(getPhotoSrc(photos[idx].data)));
  });
}

function renderSectionDetail(sectionKey, audit) {
  const meta = SECTION_META[sectionKey];
  if (!meta) return '';

  const sectionScore = audit.sectionScores?.[sectionKey] ?? '—';
  const checkpoints = audit.checkpoints?.[sectionKey] || {};

  const showProductFields = sectionKey === 'S4' || sectionKey === 'S7';

  const sectionDisplay = sectionScore != null ? `${sectionScore}%` : '—';
  let html = `<div class="detail-section-title">${sectionKey} — ${escapeHTML(meta.name)} (${sectionDisplay})</div>`;
  html += `<div class="detail-table-scroll"><table class="detail-table">
    <thead><tr>
      <th>#</th><th>Checkpoint</th><th>Specification</th><th>Answer</th>
      ${showProductFields ? '<th>Product name</th><th>Corrective action</th>' : ''}
      <th>Remark</th><th>Photos</th>
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
      ${showProductFields ? `<td>${escapeHTML(cp.productName || '—')}</td><td>${escapeHTML(cp.correctiveAction || '—')}</td>` : ''}
      <td>${escapeHTML(cp.remark || '—')}</td>
      <td class="cp-photos-cell" data-section="${sectionKey}" data-qkey="${qKey}"></td>
    </tr>`;
  }

  html += '</tbody></table></div>';
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

  return html;
}

function renderCard(audit, index) {
  const score = Number(audit.totalScore) || 0;
  const colorCls = getScoreColor(score);
  const grade = getGrade(score);
  const photoCount = (audit.photos || []).length;

  let pillsHTML = '';
  Object.keys(SECTION_META).forEach((sKey) => {
    const s = audit.sectionScores?.[sKey];
    const pillCls = getPillClass(s);
    const display = s != null ? `${s}%` : '—';
    pillsHTML += `<span class="section-pill ${pillCls}">${sKey}: ${display}</span>`;
  });

  return `
    <div class="response-card" data-index="${index}" data-timestamp="${escapeHTML(audit.timestamp)}">
      <div class="response-card-header" onclick="toggleResponseCard(${index})">
        <div class="response-card-left">
          <div class="response-store-name">${escapeHTML(audit.storeName)}</div>
          <div class="response-meta">
            <span>👤 ${escapeHTML(audit.auditorName)}</span>
            <span>📅 ${formatDate(audit.visitDate)}</span>
            ${photoCount ? `<span>📷 ${photoCount} photo${photoCount !== 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
        <div class="response-card-right">
          <button
            type="button"
            class="response-delete-btn"
            title="Delete this response"
            aria-label="Delete this response"
            data-timestamp="${escapeHTML(audit.timestamp)}"
            data-store="${escapeHTML(audit.storeName)}"
            data-auditor="${escapeHTML(audit.auditorName || '')}"
            data-auditee="${escapeHTML(audit.auditeeName || '')}"
            data-visitdate="${escapeHTML(audit.visitDate || '')}"
          >Delete</button>
          <span class="grade-badge ${grade.cls}">${grade.label}</span>
          <span class="response-score ${colorCls}">${score != null ? score + '%' : '—'}</span>
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

  // Render detail content once
  if (!detail.dataset.rendered) {
    detail.innerHTML = renderResponseDetail(audit);
    detail.dataset.rendered = '1';
  }

  detail.classList.add('open');
  card.classList.add('expanded');

  if (!detail.dataset.photosLoaded) {
    injectPhotosIntoCheckpoints(audit.photos || [], detail);
    detail.dataset.photosLoaded = '1';
  }
}

/* ── Delete Auth Modal ── */

const AUTHORIZED_PHONES = ['9930332459', '7987962503'];

function normalizePhone(input) {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function showDeleteAuthModal(storeName) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'delete-auth-overlay';
    overlay.innerHTML = `
      <div class="delete-auth-modal">
        <div class="delete-auth-title">Confirm Deletion</div>
        <div class="delete-auth-subtitle">Enter your authorization number to delete<br><strong>${escapeHTML(storeName || 'this audit')}</strong></div>
        <input type="tel" class="delete-auth-input" placeholder="Authorization number" autocomplete="off" />
        <div class="delete-auth-error" hidden></div>
        <div class="delete-auth-actions">
          <button type="button" class="delete-auth-cancel">Cancel</button>
          <button type="button" class="delete-auth-submit">Delete</button>
        </div>
      </div>`;

    const input = overlay.querySelector('.delete-auth-input');
    const errorEl = overlay.querySelector('.delete-auth-error');
    const cancelBtn = overlay.querySelector('.delete-auth-cancel');
    const submitBtn = overlay.querySelector('.delete-auth-submit');

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }

    function attempt() {
      const normalized = normalizePhone(input.value);
      if (AUTHORIZED_PHONES.includes(normalized)) {
        close(true);
      } else {
        errorEl.textContent = 'Invalid authorization number. Please try again.';
        errorEl.hidden = false;
        input.select();
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') attempt();
    }

    cancelBtn.addEventListener('click', () => close(false));
    submitBtn.addEventListener('click', attempt);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 50);
  });
}

/* ── Delete Response ── */

async function deleteResponseCopy(event, timestamp, storeName, auditorName, auditeeName, visitDate) {
  event.stopPropagation();

  const authorized = await showDeleteAuthModal(storeName);
  if (!authorized) return;

  try {
    const res = await fetch('/api/delete-audit', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp, storeName, auditorName, auditeeName, visitDate }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Delete failed');
    }

    await window.reloadAuditData();
    initResponses();

    if (typeof window.initDashboard === 'function' && document.getElementById('view-dashboard')?.classList.contains('active')) {
      window.initDashboard();
    }

    if (window.fridoAuditCache?.forget) {
      window.fridoAuditCache.forget(timestamp);
    }
  } catch (err) {
    console.error('Delete response error:', err);
    window.alert(err.message || 'Could not delete this response copy.');
  }
}

window.deleteResponseCopy = deleteResponseCopy;
window.toggleResponseCard = toggleResponseCard;
window.openLightbox = openLightbox;

/* ── Main Init ── */

window.initResponses = function initResponses() {
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

  function getAudits() {
    return Array.isArray(window.fridoData?.audits) ? window.fridoData.audits : [];
  }

  function renderList() {
    const audits = getAudits();
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

    listEl.querySelectorAll('.response-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        deleteResponseCopy(event, btn.dataset.timestamp, btn.dataset.store, btn.dataset.auditor, btn.dataset.auditee, btn.dataset.visitdate);
      });
    });
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
};

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

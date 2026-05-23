/* ═══════════════════════════════════════════
   FRIDO STORE AUDIT — FORM LOGIC
   All 70 checkpoints + scoring + submission
   ═══════════════════════════════════════════ */

const CHECKPOINTS = {
  S1: {
    title: 'Store Cleanliness and Hygiene',
    items: [
      { label: 'Store floor is clean and free of dust', spec: 'Floor should be clean without visible dust, stains, or waste material' },
      { label: 'Display shelves cleaned and organized', spec: 'Shelves should be dust free and products properly arranged' },
      { label: 'AC / fans in working condition', spec: 'AC and fans should function properly without abnormal noise' },
      { label: 'No foul smell inside store', spec: 'Store should maintain a fresh and hygienic environment' },
      { label: 'Dustbins available and emptied', spec: 'Dustbins should be available, clean, and regularly emptied' },
    ]
  },
  S2: {
    title: 'BOH check',
    items: [
      { label: 'BOH 5S', spec: 'Back office area should follow Sort, Set in Order, Shine, Standardize, and Sustain' },
    ]
  },
  S3: {
    title: 'Store Maintenance',
    items: [
      { label: 'Check if any infra damaged', spec: 'Store infrastructure should not have visible damage' },
    ]
  },
  S4: {
    title: 'Merchandising and Display',
    items: [
      { label: 'Display as per planogram', spec: 'Product display should match approved planogram' },
      { label: 'Bestsellers displayed in prime locations', spec: 'Bestselling products should have high visibility placement' },
      { label: 'New arrivals displayed properly', spec: 'New arrivals should be highlighted and properly arranged' },
      { label: 'Seasonal products highlighted', spec: 'Seasonal products should be prominently displayed' },
      { label: 'Signage clean and correct', spec: 'Signage should be clean, readable, and updated' },
      { label: 'Mannequins properly dressed if available', spec: 'Mannequins should display products properly and neatly' },
      { label: 'Wedge stand availability', spec: 'Wedge stands should be available and stable' },
      { label: 'Maniquine for TNP', spec: 'TNP mannequin should be available and properly maintained' },
      { label: 'Maniquine for Barefoot and socks', spec: 'Barefoot and socks mannequin should be available' },
      { label: 'Differentiators', spec: 'Product differentiators should be visible and correctly placed' },
      { label: 'Size chart', spec: 'Updated size chart should be available and readable' },
      { label: 'Footwear measurer', spec: 'Footwear measuring tool should be available and functional' },
      { label: 'Stands Quality, stickering/pasting', spec: 'Stands should be stable with proper stickering and finishing' },
      { label: 'Fire Extinguisher', spec: 'Fire extinguisher should be available and within validity' },
      { label: 'Staff Uniform', spec: 'Staff should wear approved uniform and ID card' },
      { label: 'Cash counter lock check, keys check', spec: 'Counter locks and keys should function properly' },
      { label: 'Cash register file', spec: 'Cash register records should be updated and available' },
    ]
  },
  S5: {
    title: 'Stockroom Quality',
    items: [
      { label: 'Stockroom organized by category and size', spec: 'Stock should be arranged category-wise and size-wise' },
      { label: 'No leakage, moisture or dust', spec: 'Stockroom should be free from leakage, moisture, and dust' },
      { label: 'Proper racks and bins available', spec: 'Storage racks and bins should be available and usable' },
      { label: 'FIFO followed for inventory', spec: 'Inventory should follow First In First Out method' },
      { label: 'Damaged stock segregated and logged', spec: 'Damaged stock should be separately identified and recorded' },
    ]
  },
  S6: {
    title: 'Store Operations and Compliance',
    items: [
      { label: 'Billing system working smoothly', spec: 'Billing software and printer should function properly' },
      { label: 'CCTV working', spec: 'CCTV cameras should be operational and recording' },
      { label: 'Emergency exits clear', spec: 'Emergency exits should remain accessible without blockage' },
      { label: 'Customer feedback register updated', spec: 'Feedback register should be available and updated' },
      { label: 'Inward and Outward file check', spec: 'Inward and outward records should be updated and maintained' },
    ]
  },
  S7: {
    title: 'Product Quality and Condition',
    subCategories: {
      'FRIDO HOME': [0, 8],
      'FRIDO WORK': [9, 14],
      'FRIDO ORTHOTICS': [15, 17],
      'FRIDO WALK': [18, 23],
      'FRIDO INSOLES': [24, 26],
      'FRIDO PODIATRY': [27, 30],
      'GENERAL': [31, 34],
    },
    items: [
      { label: 'Zipper issue', spec: 'Zipper should open and close smoothly without damage' },
      { label: 'Stains on cover', spec: 'No visible stains, spots, or dirt marks allowed' },
      { label: 'Firmness of cusions', spec: 'Cushion firmness should match approved master sample' },
      { label: 'Hardness of cusions', spec: 'Foam hardness should be within approved quality standard' },
      { label: 'Bubbles', spec: 'No air bubbles or uneven foam surface allowed' },
      { label: 'Cuts/Torn', spec: 'No cuts, tears, or damages acceptable' },
      { label: 'Lints', spec: 'Product surface should be free from lint and loose fibers' },
      { label: 'TNP velcro loose', spec: 'Velcro should be properly stitched and firmly attached' },
      { label: 'No faded', spec: 'Product color should be uniform without fading' },
      
      { label: 'Hinges check', spec: 'Hinges should move smoothly without looseness' },
      { label: 'Stains', spec: 'Product should be free from stains and contamination' },
      { label: 'Lints', spec: 'Product surface should be free from lint and loose fibers' },
      { label: 'All Functions Check', spec: 'All product functions should work properly' },
      { label: 'Portable desk loose', spec: 'Portable desk should be stable and properly fixed' },
      { label: 'No faded', spec: 'Product color should be uniform without fading' },
      
      { label: 'Dust on boxes', spec: 'Boxes should be clean and dust free' },
      { label: 'Box condition', spec: 'Box should not be crushed, torn, or damaged' },
      { label: 'Sticker position', spec: 'Sticker should be correctly aligned and readable' },
      
      { label: 'Stain', spec: 'No stain marks should be visible' },
      { label: 'Wear and tare', spec: 'No excessive wear and tear acceptable' },
      { label: 'Glue marks', spec: 'No visible excess glue marks allowed' },
      { label: 'Covers for shoes available', spec: 'Shoe covers should be available with display products' },
      { label: 'Damages', spec: 'No physical damage acceptable' },
      { label: 'All latest models availability', spec: 'Latest approved models should be available in display' },
      
      { label: 'Double stickering/MRP', spec: 'Only one correct MRP sticker should be present' },
      { label: 'Packaging condition', spec: 'Packaging should be intact, sealed, and clean' },
      { label: 'Dust/Dirt', spec: 'Products should be free from dust and dirt' },
      
      { label: 'Machine check', spec: 'Machines should operate properly without abnormality' },
      { label: 'Cleanliness', spec: 'Equipment and area should be properly cleaned' },
      { label: 'Wiring check', spec: 'Wiring should be safe, insulated, and properly connected' },
      { label: 'Machine cleanliness - 2D, 3D', spec: '2D and 3D machines should be clean and dust free' },
      
      { label: 'No damaged / defective products on display', spec: 'Display products should be free from defects' },
      { label: 'No faded, stained or torn products', spec: 'Products should not have fading, stains, or tears' },
      { label: 'Packaging intact and clean', spec: 'Packaging should be properly sealed and clean' },
      { label: 'Returned items checked before keeping back', spec: 'Returned products should pass QC before restocking' },
    ]
  },
};

/* ─── State ─── */
const state = {};          // { S1: { Q1: { answer, remark, photos[] } } }
const MAX_PHOTOS_PER_CHECKPOINT = 5;

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
  buildSections();
  recalcScore();

  document.getElementById('btnSubmit').addEventListener('click', handleSubmit);
  document.getElementById('btnNewAudit').addEventListener('click', resetForm);
});

/* ─── Build Sections ─── */
function buildSections() {
  const container = document.getElementById('sectionsContainer');
  const sectionIds = Object.keys(CHECKPOINTS);

  sectionIds.forEach((sId, sIdx) => {
    const sec = CHECKPOINTS[sId];
    state[sId] = {};

    const card = document.createElement('div');
    card.className = 'section-card';
    card.id = `section-${sId}`;

    // Header
    const header = document.createElement('div');
    header.className = 'section-header' + (sIdx === 0 ? ' open' : '');
    header.innerHTML = `
      <div class="section-header-left">
        <span class="section-num">${sId}</span>
        <span class="section-title">${sec.title}</span>
      </div>
      <div class="section-header-right">
        <span class="badge-pass">✓</span>
        <span class="section-score" id="score-${sId}">0/${sec.items.length}</span>
        <span class="chevron">▾</span>
      </div>`;
    header.addEventListener('click', () => {
      header.classList.toggle('open');
      body.classList.toggle('open');
    });

    // Body
    const body = document.createElement('div');
    body.className = 'section-body' + (sIdx === 0 ? ' open' : '');

    sec.items.forEach((item, qIdx) => {
      // Sub-category chips for S7
      if (sec.subCategories) {
        for (const [catName, [start]] of Object.entries(sec.subCategories)) {
          if (qIdx === start) {
            const chip = document.createElement('div');
            chip.className = 'sub-category';
            chip.textContent = catName;
            body.appendChild(chip);
          }
        }
      }

      const qKey = `Q${qIdx + 1}`;
      state[sId][qKey] = { answer: '', spec: item.spec, remark: '', photos: [] };

      const row = document.createElement('div');
      row.className = 'cp-row';
      row.id = `row-${sId}-${qKey}`;

      row.innerHTML = `
        <div class="cp-num">${qIdx + 1}</div>
        <div class="cp-info">
          <div class="cp-label">${item.label}</div>
          <input type="text" class="cp-spec-input" id="spec-${sId}-${qKey}"
                 value="${item.spec}" placeholder="Add Specifications" data-s="${sId}" data-q="${qKey}">
        </div>
        <div class="cp-toggles">
          <button type="button" class="toggle-btn yes" data-s="${sId}" data-q="${qKey}" data-v="YES">YES</button>
          <button type="button" class="toggle-btn no"  data-s="${sId}" data-q="${qKey}" data-v="NO">NO</button>
          <button type="button" class="toggle-btn skip" data-s="${sId}" data-q="${qKey}" data-v="SKIP">SKIP</button>
        </div>
        <div class="cp-extras">
          <input type="text" class="cp-remark" id="remark-${sId}-${qKey}"
                 placeholder="Add remarks" data-s="${sId}" data-q="${qKey}">
          <div class="cp-photo-gallery" id="photogallery-${sId}-${qKey}"></div>
          <button type="button" class="cp-photo-btn" id="photobtn-${sId}-${qKey}"
                  title="Attach photos (0/5)">📷</button>
          <input type="file" accept="image/*" multiple
                 style="display:none" id="photoinput-${sId}-${qKey}">
        </div>`;

      body.appendChild(row);

      // Toggle button events
      row.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = btn.dataset.s, q = btn.dataset.q, v = btn.dataset.v;
          state[s][q].answer = v;
          const siblings = btn.parentElement.querySelectorAll('.toggle-btn');
          siblings.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          row.classList.remove('error');
          recalcScore();
        });
      });

      // Spec event
      const specInput = row.querySelector('.cp-spec-input');
      specInput.addEventListener('input', () => {
        state[sId][qKey].spec = specInput.value;
        specInput.classList.remove('error');
        row.classList.remove('error');
      });

      // Remark event
      const remarkInput = row.querySelector('.cp-remark');
      remarkInput.addEventListener('input', () => {
        state[sId][qKey].remark = remarkInput.value;
        remarkInput.classList.remove('error');
        row.classList.remove('error');
      });

      // Photo events
      const photoBtn = row.querySelector('.cp-photo-btn');
      const photoInput = row.querySelector('input[type="file"]');
      photoBtn.addEventListener('click', () => {
        if (state[sId][qKey].photos.length >= MAX_PHOTOS_PER_CHECKPOINT) {
          showToast(`Maximum ${MAX_PHOTOS_PER_CHECKPOINT} photos per checkpoint`);
          return;
        }
        photoInput.click();
      });
      photoInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const current = state[sId][qKey].photos.length;
        const remaining = MAX_PHOTOS_PER_CHECKPOINT - current;
        if (remaining <= 0) {
          showToast(`Maximum ${MAX_PHOTOS_PER_CHECKPOINT} photos per checkpoint`);
          photoInput.value = '';
          return;
        }

        const toProcess = files.slice(0, remaining);
        if (files.length > remaining) {
          showToast(`Only ${remaining} more photo(s) allowed (max ${MAX_PHOTOS_PER_CHECKPOINT})`);
        }

        Promise.all(toProcess.map(file => new Promise(resolve => {
          compressImage(file, 200 * 1024, resolve);
        }))).then(results => {
          state[sId][qKey].photos.push(...results);
          renderPhotoThumbs(sId, qKey, row);
          updatePhotoBtn(photoBtn, state[sId][qKey].photos.length);
          photoInput.value = '';
        });
      });
    });

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);
  });
}

function renderPhotoThumbs(sId, qKey, row) {
  const gallery = row.querySelector('.cp-photo-gallery');
  if (!gallery) return;

  gallery.innerHTML = '';
  state[sId][qKey].photos.forEach((base64, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'cp-thumb-wrap';

    const img = document.createElement('img');
    img.className = 'cp-thumb';
    img.src = base64;
    img.alt = `Photo ${idx + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'cp-thumb-remove';
    removeBtn.setAttribute('aria-label', 'Remove photo');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state[sId][qKey].photos.splice(idx, 1);
      renderPhotoThumbs(sId, qKey, row);
      updatePhotoBtn(row.querySelector('.cp-photo-btn'), state[sId][qKey].photos.length);
    });

    wrap.appendChild(img);
    wrap.appendChild(removeBtn);
    gallery.appendChild(wrap);
  });
}

function updatePhotoBtn(btn, count) {
  if (!btn) return;
  const max = MAX_PHOTOS_PER_CHECKPOINT;
  btn.classList.toggle('has-photo', count > 0);
  btn.dataset.count = count > 0 ? String(count) : '';
  btn.disabled = count >= max;
  btn.title = count >= max
    ? `Maximum ${max} photos reached`
    : `Attach photos (${count}/${max})`;
}

/* ─── Scoring ─── */
function recalcScore() {
  let total = 0;
  const sectionIds = Object.keys(CHECKPOINTS);

  sectionIds.forEach((sId, sIdx) => {
    const sec = CHECKPOINTS[sId];
    let yesCount = 0;
    for (let i = 0; i < sec.items.length; i++) {
      if (state[sId][`Q${i + 1}`].answer === 'YES') { yesCount++; }
    }
    total += yesCount;

    const badge = document.getElementById(`score-${sId}`);
    badge.textContent = `${yesCount}/${sec.items.length}`;
    badge.className = 'section-score ' + (yesCount === sec.items.length ? 'pass' : (yesCount > 0 ? 'partial' : 'fail'));

    const header = document.querySelector(`#section-${sId} .section-header`);
    header.classList.toggle('passed', yesCount === sec.items.length);
  });

  document.getElementById('scoreValue').textContent = total;
}

/* ─── Image compression ─── */
function compressImage(file, maxBytes, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const maxDim = 800;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width *= ratio; height *= ratio;
      }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      let quality = 0.8;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > maxBytes * 1.37 && quality > 0.1) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      callback(result);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ─── Validation ─── */
function validate() {
  let firstError = null;
  let valid = true;

  // Store details
  const fields = [
    { id: 'storeName', fg: 'fg-storeName' },
    { id: 'auditorName', fg: 'fg-auditorName' },
    { id: 'visitDate', fg: 'fg-visitDate' },
  ];
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    const fg = document.getElementById(f.fg);
    if (!el.value.trim()) {
      fg.classList.add('error');
      if (!firstError) firstError = fg;
      valid = false;
    } else {
      fg.classList.remove('error');
    }
  });

  // Checkpoints
  for (const sId of Object.keys(CHECKPOINTS)) {
    const sec = CHECKPOINTS[sId];
    for (let i = 0; i < sec.items.length; i++) {
      const qKey = `Q${i + 1}`;
      const cp = state[sId][qKey];
      const row = document.getElementById(`row-${sId}-${qKey}`);
      const remark = document.getElementById(`remark-${sId}-${qKey}`);
      let rowError = false;

      if (!cp.answer) {
        rowError = true;
      }
      const specInput = document.getElementById(`spec-${sId}-${qKey}`);
      if (!cp.spec.trim()) {
        specInput.classList.add('error');
        rowError = true;
      } else {
        specInput.classList.remove('error');
      }
      if ((cp.answer === 'NO' || cp.answer === 'SKIP') && !cp.remark.trim()) {
        remark.classList.add('error');
        rowError = true;
      } else {
        remark.classList.remove('error');
      }

      if (rowError) {
        row.classList.add('error');
        if (!firstError) {
          firstError = row;
          // Open section
          const sectionBody = row.closest('.section-body');
          const sectionHeader = sectionBody.previousElementSibling;
          if (!sectionBody.classList.contains('open')) {
            sectionBody.classList.add('open');
            sectionHeader.classList.add('open');
          }
        }
        valid = false;
      } else {
        row.classList.remove('error');
      }
    }
  }

  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return valid;
}

/* ─── Submit ─── */
async function handleSubmit() {
  if (!validate()) {
    showToast('Please complete all required fields');
    return;
  }

  showOverlay('loadingOverlay');

  // Build sections data
  const sections = {};
  const photos = [];

  for (const sId of Object.keys(CHECKPOINTS)) {
    sections[sId] = {};
    const sec = CHECKPOINTS[sId];
    for (let i = 0; i < sec.items.length; i++) {
      const qKey = `Q${i + 1}`;
      const cp = state[sId][qKey];
      sections[sId][qKey] = {
        answer: cp.answer,
        spec: cp.spec,
        remark: cp.remark,
      };
      if (cp.photos && cp.photos.length) {
        cp.photos.forEach((photoData) => {
          photos.push({
            section: sId,
            checkpoint: sec.items[i].label,
            data: photoData,
          });
        });
      }
    }
  }

  const payload = {
    storeName: document.getElementById('storeName').value,
    location: document.getElementById('location').value,
    auditorName: document.getElementById('auditorName').value,
    auditeeName: document.getElementById('auditeeName').value,
    visitDate: document.getElementById('visitDate').value,
    sections,
    photos,
  };

  try {
    const res = await fetch('/api/submit-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    hideOverlay('loadingOverlay');

    if (data.success) {
      if (typeof window.reloadAuditData === 'function') {
        await window.reloadAuditData();
      }
      showSuccess(data.totalScore, data.sectionScores, payload);
    } else {
      showToast('Submission failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    hideOverlay('loadingOverlay');
    showToast('Network error — please try again');
  }
}

/* ─── Success ─── */
function showSuccess(total, sectionScores, payload) {
  const starsEl = document.getElementById('successStars');
  starsEl.innerHTML = '';
  const starCount = Math.round(total / 10); // 0-7 stars based on 70 scale
  for (let i = 0; i < 7; i++) {
    const span = document.createElement('span');
    span.textContent = i < starCount ? '★' : '☆';
    span.style.color = i < starCount ? '#FFD400' : '#E8E8E8';
    starsEl.appendChild(span);
  }

  document.getElementById('successDetails').innerHTML = `
    <div><strong>Store:</strong> ${payload.storeName}</div>
    <div><strong>Date:</strong> ${payload.visitDate}</div>
    <div><strong>Auditor:</strong> ${payload.auditorName}</div>
    <div><strong>Total Score:</strong> ${total} / 70</div>`;

  showOverlay('successOverlay');
}

/* ─── Reset ─── */
function resetForm() {
  hideOverlay('successOverlay');
  document.getElementById('storeName').value = '';
  document.getElementById('location').value = '';
  document.getElementById('auditorName').value = '';
  document.getElementById('auditeeName').value = '';
  document.getElementById('visitDate').value = '';

  for (const sId of Object.keys(state)) {
    for (const qKey of Object.keys(state[sId])) {
      state[sId][qKey] = { answer: '', spec: '', remark: '', photos: [] };
      const row = document.getElementById(`row-${sId}-${qKey}`);
      row.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('selected'));
      row.querySelector('.cp-spec-input').value = '';
      row.querySelector('.cp-spec-input').classList.remove('error');
      row.querySelector('.cp-remark').value = '';
      row.classList.remove('error');
      const gallery = row.querySelector('.cp-photo-gallery');
      if (gallery) gallery.innerHTML = '';
      updatePhotoBtn(row.querySelector('.cp-photo-btn'), 0);
    }
  }

  recalcScore();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── Helpers ─── */
function showOverlay(id) { document.getElementById(id).classList.add('active'); }
function hideOverlay(id) { document.getElementById(id).classList.remove('active'); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('active');
  setTimeout(() => t.classList.remove('active'), 3500);
}

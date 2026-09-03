/* ═══════════════════════════════════════════════════
   FRIDO QC PORTAL — App Shell JavaScript
   Sidebar (48px collapsed / 240px expanded overlay),
   header scroll-shadow, view routing, shared data load.
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── DOM References ──────────────────────────────────
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarOpenBtn = document.getElementById('sidebarOpenBtn');
  const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const mainHeader = document.getElementById('mainHeader');
  const navItems = document.querySelectorAll('.sidebar-nav-item');
  const views = document.querySelectorAll('.view');
  const globalSearch = document.getElementById('globalSearch');

  // ── Sidebar Expand / Collapse ──────────────────────
  const DESKTOP_SIDEBAR_MQ = window.matchMedia('(min-width: 1025px)');

  function isDesktopSidebar() {
    return DESKTOP_SIDEBAR_MQ.matches;
  }

  function expandSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('expanded');
    if (!isDesktopSidebar() && sidebarOverlay) {
      sidebarOverlay.classList.add('active');
    }
  }

  function collapseSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('expanded');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  }

  function toggleSidebar() {
    if (sidebar.classList.contains('expanded')) {
      collapseSidebar();
    } else {
      expandSidebar();
    }
  }

  // Desktop: hover the yellow accent strip to open, leave to close
  if (sidebar) {
    sidebar.addEventListener('mouseenter', () => {
      if (isDesktopSidebar()) expandSidebar();
    });
    sidebar.addEventListener('mouseleave', () => {
      if (isDesktopSidebar()) collapseSidebar();
    });
  }

  // Mobile / tablet: tap to toggle
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      if (!isDesktopSidebar()) toggleSidebar();
    });
  }
  if (sidebarOpenBtn) {
    sidebarOpenBtn.addEventListener('click', () => {
      if (!isDesktopSidebar()) expandSidebar();
    });
  }
  if (sidebarCollapseBtn) {
    sidebarCollapseBtn.addEventListener('click', () => {
      if (!isDesktopSidebar()) collapseSidebar();
    });
  }
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', collapseSidebar);

  DESKTOP_SIDEBAR_MQ.addEventListener('change', (e) => {
    if (e.matches) {
      collapseSidebar();
    }
  });

  // Keyboard escape closes sidebar on mobile
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('expanded') && window.innerWidth <= 1024) {
      collapseSidebar();
    }
  });

  // ── Header scroll shadow ───────────────────────────
  let lastScroll = 0;
  function onScroll() {
    const y = window.scrollY;
    if (mainHeader) {
      if (y > 4) mainHeader.classList.add('scrolled');
      else mainHeader.classList.remove('scrolled');
    }
    lastScroll = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── View Routing ───────────────────────────────────
  async function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetView = document.getElementById('view-' + viewId);
    const targetNav = document.querySelector("[data-view='" + viewId + "']");

    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    // Refresh shared data when opening data-driven views
    if (viewId === 'dashboard' || viewId === 'responses') {
      await loadSharedData();
    }

    // View-specific initializers
    if (viewId === 'dashboard' && typeof initDashboard === 'function') initDashboard();
    if (viewId === 'responses' && typeof initResponses === 'function') initResponses();

    // On mobile, collapse sidebar after nav
    if (window.innerWidth <= 1024) collapseSidebar();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.switchView = switchView;

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
    });
  });

  // ── Global Search (Ctrl+K) ─────────────────────────
  if (globalSearch) {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        globalSearch.focus();
        globalSearch.select();
      }
    });

    globalSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') globalSearch.blur();
      if (e.key === 'Enter') {
        const q = (globalSearch.value || '').trim();
        if (!q) return;
        // Route to Response Copies and prefill its search if available
        switchView('responses');
        setTimeout(() => {
          const responsesSearch = document.getElementById('responses-search');
          if (responsesSearch) {
            responsesSearch.value = q;
            responsesSearch.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 80);
      }
    });
  }

  // ── Shared Data Store ──────────────────────────────
  window.fridoData = {
    audits: [],
    photos: [],
    loaded: false
  };

  const LOCAL_CACHE_KEY = 'frido:audits:local-cache:v1';
  const LOCAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  function readLocalAuditCache() {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const cutoff = Date.now() - LOCAL_CACHE_TTL_MS;
      return parsed.filter((audit) => {
        if (!audit?.timestamp) return false;
        const t = new Date(audit.timestamp).getTime();
        return !Number.isNaN(t) && t >= cutoff;
      });
    } catch (err) {
      console.warn('Local audit cache read failed:', err);
      return [];
    }
  }

  function writeLocalAuditCache(audits) {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(audits));
    } catch (err) {
      console.warn('Local audit cache write failed:', err);
    }
  }

  function rememberSubmittedAudit(audit) {
    if (!audit?.timestamp) return;
    const cache = readLocalAuditCache();
    const filtered = cache.filter((a) => a.timestamp !== audit.timestamp);
    filtered.push(audit);
    writeLocalAuditCache(filtered);
  }

  function forgetCachedAudit(timestamp) {
    if (!timestamp) return;
    const cache = readLocalAuditCache();
    writeLocalAuditCache(cache.filter((a) => a.timestamp !== timestamp));
  }

  function mergeWithLocalCache(serverAudits) {
    const merged = new Map();
    serverAudits.forEach((audit) => {
      if (audit?.timestamp) merged.set(audit.timestamp, audit);
    });

    const cache = readLocalAuditCache();
    cache.forEach((audit) => {
      if (audit?.timestamp && !merged.has(audit.timestamp)) {
        merged.set(audit.timestamp, audit);
      }
    });

    const list = Array.from(merged.values());
    list.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime() || 0;
      const tb = new Date(b.timestamp).getTime() || 0;
      return ta - tb;
    });
    return list;
  }

  function reconcileLocalCacheWith(serverAudits) {
    const serverTimestamps = new Set(
      serverAudits
        .map((audit) => audit?.timestamp)
        .filter(Boolean)
    );
    const cache = readLocalAuditCache();
    const remaining = cache.filter((audit) => !serverTimestamps.has(audit.timestamp));
    if (remaining.length !== cache.length) {
      writeLocalAuditCache(remaining);
    }
  }

  window.fridoAuditCache = {
    remember: rememberSubmittedAudit,
    forget: forgetCachedAudit,
    read: readLocalAuditCache,
  };

  async function fetchAudits() {
    const res = await fetch('/api/get-audits', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function loadSharedData() {
    let serverAudits = [];
    try {
      serverAudits = await fetchAudits();
    } catch (err) {
      console.error('Audit fetch failed:', err);
    }

    const merged = mergeWithLocalCache(serverAudits);
    reconcileLocalCacheWith(serverAudits);

    window.fridoData.audits = merged;
    window.fridoData.loaded = true;
    return merged;
  }

  window.reloadAuditData = loadSharedData;

  // ── Initialization ─────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    await loadSharedData();
    await switchView('dashboard');

    // Desktop: sidebar starts collapsed (icon strip + accent line)
    // Mobile: also collapsed (off-canvas) by default
    collapseSidebar();
  });

  // ── Resize handling ────────────────────────────────
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    if (lastWidth > 1024 && w <= 1024 && sidebar.classList.contains('expanded')) {
      // Entering mobile while expanded: keep expanded but show overlay
      if (sidebarOverlay) sidebarOverlay.classList.add('active');
    } else if (lastWidth <= 1024 && w > 1024) {
      // Entering desktop: hide overlay
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
    lastWidth = w;
  });

})();

/* Service worker registration — moved here from an inline <script> in the page
   so the CSP can be script-src 'self' with no 'unsafe-inline'. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=17')
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.error('SW registration failed:', err));
  });
}

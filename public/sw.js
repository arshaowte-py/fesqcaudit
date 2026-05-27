const CACHE_NAME = 'frido-qc-cache-v9';
const ASSETS = [
  '/',
  '/index.html',
  '/assets/app.css',
  '/assets/app.js',
  '/assets/audit-form.css',
  '/assets/audit-form.js',
  '/assets/dashboard.css',
  '/assets/dashboard.js',
  '/assets/responses.css',
  '/assets/responses.js',
  '/assets/frido-logo.svg',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@1,700&display=swap'
];

// Install Event — Cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — Clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Network first with cache fallback
self.addEventListener('fetch', (e) => {
  // Ignore API requests
  if (e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache the updated network response
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(e.request);
      })
  );
});

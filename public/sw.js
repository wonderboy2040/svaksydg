// ===========================================
// SVAKS Service Worker
// Caches app shell + assets for offline use
// ===========================================

const CACHE_NAME = 'svaks-cache-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/_redirects',
  '/404.html',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  console.log('[SVAKS SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SVAKS SW] Caching app shell');
        // Use addAll but ignore individual failures (some assets may 404)
        return Promise.allSettled(
          APP_SHELL.map(url => cache.add(url).catch(e => console.warn('[SVAKS SW] Failed to cache', url, e.message)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SVAKS SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SVAKS SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Navigation requests (HTML): network-first, fallback to cache, then offline page
// - Static assets (JS/CSS/images): stale-while-revalidate (instant load + background update)
// - Google APIs (script.google.com): network-only (don't cache dynamic data)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests to Google Apps Script (cloud sync data must be fresh)
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleusercontent.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    // Network-only for these — don't intercept
    return;
  }

  // Navigation requests (HTML pages) — network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the latest version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', responseClone));
          return response;
        })
        .catch(() => {
          // Network failed — try cache
          return caches.match('/index.html')
            .then(cached => cached || caches.match('/404.html'));
        })
    );
    return;
  }

  // Static assets — stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => cached); // Network failed — return cached version (or undefined)

      // Return cached immediately if available, otherwise wait for network
      return cached || fetchPromise;
    })
  );
});

// Listen for messages from the client (e.g., manual cache clear)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
      .then(() => console.log('[SVAKS SW] All caches cleared'));
  }
});

// Background Sync: when browser detects connectivity restored,
// fire a sync event that the page can listen for to retry pending pushes
self.addEventListener('sync', (event) => {
  if (event.tag === 'svaks-sync') {
    console.log('[SVAKS SW] Background sync triggered — notifying clients');
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'BACKGROUND_SYNC' }));
      })
    );
  }
});

// Push notifications (future use)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SVAKS Notification';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url || '/'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.data || '/');
      }
    })
  );
});

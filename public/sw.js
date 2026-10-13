// Ekoyini service worker — makes the site installable and keeps the
// app shell loading on flaky township data. Deliberately NEVER caches
// API, order, admin or webhook requests: prices, stock and order status
// must always be live.
const CACHE = 'ekoyini-shell-v1';
const SHELL = ['/index.html', '/shop.html', '/cart.html', '/track.html', '/profile.html', '/style.css', '/premium.css', '/script.js', '/auth.js', '/pricing.js', '/images/brand/ekoyini-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isLiveRequest(url) {
  return url.origin !== self.location.origin ||
    /^\/(api|order|orders|admin|webhooks)(\/|$)/.test(url.pathname);
}

// Network first, cache as fallback — customers always get the newest
// version when online, and the last good copy when offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || isLiveRequest(url)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/index.html')))
  );
});

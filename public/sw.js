// Ekoyini service worker — makes the site installable and keeps the
// app shell loading on flaky township data. Deliberately NEVER caches
// API, order, admin or webhook requests: prices, stock and order status
// must always be live.
const CACHE = 'ekoyini-shell-v27';
const SHELL = ['/index.html', '/shop.html', '/cart.html', '/track.html', '/profile.html', '/style.css', '/premium.css', '/home.css', '/home-app.css', '/app.css', '/script.js', '/auth.js', '/pricing.js', '/shelf-order.js', '/images/brand/ekoyini-icon.png'];

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
    /^\/(api|order|orders|admin|webhooks|pay)(\/|$)/.test(url.pathname);
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

// Order alerts from the server (web push, lib/push.js). They arrive even
// when the dashboard is closed or the phone is in another app. Every push
// must show a notification (iPhone cancels alerts that stay silent).
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Ekoyini', {
    body: data.body || '',
    tag: data.tag || 'ekoyini',
    renotify: true,
    requireInteraction: !!data.urgent,
    vibrate: [200, 100, 200, 100, 200],
    icon: '/images/brand/favicon-192.png',
    badge: '/images/brand/favicon-192.png',
    data: { url: data.url || '/admin/admin.html' },
  }));
});

// Tapping an order alert (admin dashboard) opens or focuses it.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/admin/admin.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.includes('/admin/'));
      return open ? open.focus() : self.clients.openWindow(target);
    })
  );
});

/* Crown Cement SCM app — service worker (this app only; it lives in its own folder and never touches the other app)
   - HTML pages and .js scripts: network first (new uploads reach phones straight away), cached copy when offline
   - icons / scripts / manifest: cached, refreshed in the background
   - Google Apps Script calls and every other site are NEVER cached or touched
   Bump CACHE_VERSION when you change this file or app-mobile.js. */
var CACHE_VERSION = 'pi-app-v11';
var SHELL = ['./', './index.html', './app-mobile.js', './app-notify.js', './ticker.js', './ports.js', './table-tools.js', './manifest.webmanifest', './icons/192.png', './icons/512.png', './login.html', './dashboard.html'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE_VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));   // 'reload' = always fetch fresh copies, never the browser's old HTTP cache   // a file you have not uploaded yet must not break install
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('pi-app-') === 0 && k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// tapping a phone notification: bring the app to the front and tell it which notification was tapped
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var id = (e.notification.data || {}).id || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) { list[i].postMessage({ type: 'notify-click', id: id }); return list[i].focus(); } }
    return self.clients.openWindow('./?notify=' + encodeURIComponent(id));
  }));
});
self.addEventListener('message', function (e) { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;      // POSTs / Apps Script / CDNs go straight to the network
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1 || /\.js$/.test(url.pathname)) {   // pages AND scripts: network first, so ticker.js / app-*.js changes reach phones at once
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); }); }
      return res;                                                                 // a real 404 from the server is shown as it is, never cached
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./index.html') || new Response('<h2 style="font-family:sans-serif;padding:24px">You are offline.</h2>', { headers: { 'Content-Type': 'text/html' } });
      });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});

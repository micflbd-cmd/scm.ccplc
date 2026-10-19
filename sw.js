/* Crown Cement SCM — service worker (shared by the SCM app and the C&F Agent app)
   - HTML pages: network first (so every new version you upload reaches phones straight away), cached copy when offline
   - icons / scripts / manifests: cached, refreshed in the background
   - Google Apps Script calls (script.google.com) and every other site are NEVER cached or touched
   Bump CACHE_VERSION when you change this file or app-mobile.js. */
var CACHE_VERSION = 'scm-v2';
var SHELL = ['./pi-data-input.html', './cnf-agent-portal.html', './login.html', './dashboard.html', './app-mobile.js',
  './manifest-pi.webmanifest', './manifest-cnf.webmanifest',
  './icons/pi-192.png', './icons/pi-512.png', './icons/cnf-192.png', './icons/cnf-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE_VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));   // a file you have not uploaded yet must not break install
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;      // POSTs / Apps Script / CDNs go straight to the network
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./pi-data-input.html') || new Response('<h2 style="font-family:sans-serif;padding:24px">You are offline.</h2>', { headers: { 'Content-Type': 'text/html' } });
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

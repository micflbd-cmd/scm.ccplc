/* Crown Cement SCM app — service worker (this app only; it lives in its own folder and never touches the other app)
   - HTML pages and .js scripts: network first (new uploads reach phones straight away), cached copy when offline
   - icons / scripts / manifest: cached, refreshed in the background
   - Google Apps Script calls and every other site are NEVER cached or touched
   Bump CACHE_VERSION when you change this file or app-mobile.js. */
var CACHE_VERSION = 'pi-app-v32';
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
// ---- PHONE PUSH (works with the app closed) ----
// The server sends an EMPTY push (a "ring"). Here we ask the Apps Script what is new (action pushPull, authorised by this device's own key)
// and show every item as a pop-up. The address / key are saved by the page (message 'push-config') in the Cache API, which survives restarts.
var PUSH_CFG_CACHE = 'pi-push-cfg', PUSH_CFG_KEY = './__push-config__';
function pushCfgSave(cfg) { return caches.open(PUSH_CFG_CACHE).then(function (c) { return c.put(PUSH_CFG_KEY, new Response(JSON.stringify(cfg), { headers: { 'Content-Type': 'application/json' } })); }); }
function pushCfgRead() { return caches.open(PUSH_CFG_CACHE).then(function (c) { return c.match(PUSH_CFG_KEY); }).then(function (r) { return r ? r.json() : null; }).catch(function () { return null; }); }
function pushShow(i) {
  return self.registration.showNotification(i.title || 'Crown Cement', { body: i.body || '', tag: i.id || ('n' + Date.now()), renotify: true, icon: 'icons/192.png', badge: 'icons/192.png', vibrate: [200, 100, 200, 100, 200], data: { id: i.id || '', tab: i.tab || '' } });
}
self.addEventListener('push', function (e) {
  e.waitUntil(pushCfgRead().then(function (cfg) {
    var generic = function () {       // the browser requires a visible notification for every push — unless one is already showing
      return self.registration.getNotifications().then(function (l) { return l.length ? null : pushShow({ id: 'generic', title: '🔔 Crown Cement', body: 'There is new activity — open the app to see it.' }); });
    };
    if (!cfg || !cfg.url || !cfg.sub || !cfg.key) return generic();
    return fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'pushPull', sub: cfg.sub, key: cfg.key }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { var items = (j && j.success && j.items) || []; return items.length ? Promise.all(items.map(pushShow)) : generic(); })
      .catch(generic);
  }));
});
self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  else if (e.data && e.data.type === 'push-config' && e.data.cfg) e.waitUntil(pushCfgSave(e.data.cfg));
});

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

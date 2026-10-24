/* Crown Cement — notification helper (one copy in each app folder)
   The app gives it a list of current notifications (AppNotify.sync). It remembers which ones are new, keeps an unread count,
   puts the number on the app icon (where the phone allows it) and shows a phone notification for NEW ones when the app is in the background.
   Limits: notifications arrive while the app is open or recently used. A fully closed app cannot be woken without a push server. */
(function () {
  'use strict';
  var o = { app: 'app', user: function () { return ''; }, onOpen: null, onNew: null, onChange: null, isRead: null, setRead: null, baselineRead: false };
  var list = [], pendingOpen = null, AN = {};
  try { pendingOpen = new URLSearchParams(location.search).get('notify') || null; } catch (e) {}
  function k(n) { return 'appNotify:' + o.app + ':' + String(o.user() || '') + ':' + n; }
  function get(n) { try { return JSON.parse(localStorage.getItem(k(n)) || 'null'); } catch (e) { return null; } }
  function put(n, v) { try { localStorage.setItem(k(n), JSON.stringify(v)); } catch (e) {} }
  function ids(a) { return a.map(function (i) { return i.id; }); }
  function readSet() { return get('read') || []; }

  AN.init = function (opts) { Object.keys(opts || {}).forEach(function (x) { o[x] = opts[x]; }); return AN; };
  AN.isRead = function (id) { return o.isRead ? !!o.isRead(id) : readSet().indexOf(id) !== -1; };
  AN.markRead = function (id) { AN.markMany([id]); };
  AN.markMany = function (arr) {
    if (o.setRead) o.setRead(arr);
    else { var r = readSet(); arr.forEach(function (id) { if (r.indexOf(id) === -1) r.push(id); }); put('read', r.slice(-1500)); }
    changed();
  };
  AN.markAllRead = function () { AN.markMany(ids(list)); };
  AN.items = function () { return list.slice(); };
  AN.unread = function () { return list.filter(function (i) { return !AN.isRead(i.id); }).length; };
  AN.supported = function () { return 'Notification' in window; };
  AN.permission = function () { return AN.supported() ? Notification.permission : 'unsupported'; };
  AN.canNotify = function () { return AN.permission() === 'granted'; };
  AN.enable = function () {
    if (!AN.supported()) return Promise.resolve('unsupported');
    return new Promise(function (res) { var p = Notification.requestPermission(function (s) { res(s); }); if (p && p.then) p.then(res); });
  };
  AN.test = function () { show({ id: 'test:' + Date.now(), title: 'Crown Cement — test notification', body: 'Phone notifications are working on this device.' }); };

  function badge() { var n = AN.unread(); try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {} }
  function changed() { badge(); if (o.onChange) { try { o.onChange(list, AN.unread()); } catch (e) {} } }
  function show(i) {
    var opt = { body: i.body || '', tag: i.id, icon: 'icons/192.png', badge: 'icons/192.png', data: { id: i.id } };
    var fallback = function () { try { new Notification(i.title, opt); } catch (e) {} };
    if (!('serviceWorker' in navigator)) return fallback();
    navigator.serviceWorker.getRegistration().then(function (reg) { if (reg && reg.showNotification) reg.showNotification(i.title, opt).catch(fallback); else fallback(); }).catch(fallback);
  }
  function announce(fresh) {
    if (!fresh.length) return;
    if (!document.hidden) { if (o.onNew) { try { o.onNew(fresh); } catch (e) {} } return; }     // app is on screen: the app shows its own message
    if (!AN.canNotify()) return;
    if (fresh.length > 3) show({ id: 'summary:' + Date.now(), title: fresh.length + ' new notifications', body: fresh.slice(0, 3).map(function (i) { return i.title; }).join(' · ') + ' …' });
    else fresh.forEach(show);
  }
  AN.sync = function (items) {
    list = (items || []).slice();
    var base = get('base');
    if (!base) {                                                                                 // first time on this device: do not flood — treat what exists now as already known
      if (o.baselineRead && !o.isRead) { var r = readSet(); list.forEach(function (i) { if (r.indexOf(i.id) === -1) r.push(i.id); }); put('read', r.slice(-1500)); }
      put('known', ids(list).slice(-1500)); put('base', 1);
    } else {
      var known = get('known') || [], fresh = list.filter(function (i) { return known.indexOf(i.id) === -1; });
      if (fresh.length) { put('known', known.concat(ids(fresh)).slice(-1500)); announce(fresh.filter(function (i) { return !AN.isRead(i.id); })); }
    }
    changed(); openPending();
  };
  function openId(id) { var it = list.filter(function (x) { return x.id === id; })[0]; if (it) { AN.markRead(id); if (o.onOpen) o.onOpen(it); return true; } return false; }
  function openPending() { if (pendingOpen && openId(pendingOpen)) pendingOpen = null; }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'notify-click') { if (!openId(e.data.id)) pendingOpen = e.data.id; }
  });
  window.AppNotify = AN;
})();

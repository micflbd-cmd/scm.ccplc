/* Crown Cement SCM — mobile app helper (used by pi-data-input.html and cnf-agent-portal.html)
   • registers the service worker (offline shell + fast start)        • "Install app" prompt (Android/desktop Chrome) and iPhone hint
   • offline banner (entries cannot be saved without internet)        • "new version ready" banner
   • touch-friendly tweaks, and (C&F app only) wraps wide tables so they scroll sideways on a phone */
(function () {
  'use strict';
  var d = document, root = d.documentElement, ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // ---------- styles ----------
  var css =
    'html{-webkit-text-size-adjust:100%}body{-webkit-tap-highlight-color:transparent}' +
    'button,a,select,input,label,summary{touch-action:manipulation}' +
    'body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}' +
    '@media(max-width:820px){input:not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea{font-size:16px!important}' +   // stops iPhone zooming into fields
    'button,.btn,.tab,.subtab,.nav-item{min-height:42px}}' +
    '#appBar{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:99999;background:#0a1e42;color:#fff;border-radius:12px;padding:11px 12px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 28px rgba(0,0,0,.35);font:600 13px/1.35 "Segoe UI",Arial,sans-serif;max-width:520px;margin:0 auto}' +
    '#appBar span{flex:1}#appBar button{border:0;border-radius:8px;padding:9px 14px;font:700 13px "Segoe UI",Arial,sans-serif;cursor:pointer}' +
    '#appBar .go{background:#2f9e5b;color:#fff}#appBar .x{background:transparent;color:#aab8d4;padding:9px 8px}' +
    '#appOff{position:fixed;top:0;left:0;right:0;z-index:99998;background:#c0392b;color:#fff;text-align:center;font:600 12.5px/1.4 "Segoe UI",Arial,sans-serif;padding:6px 10px;padding-top:calc(6px + env(safe-area-inset-top,0px))}';
  var st = d.createElement('style'); st.id = 'appMobileCss'; st.textContent = css; (d.head || root).appendChild(st);

  // ---------- small UI helpers ----------
  function el(html) { var t = d.createElement('div'); t.innerHTML = html; return t.firstChild; }
  function bar(id, html) { var old = d.getElementById(id); if (old) old.remove(); var b = el('<div id="' + id + '">' + html + '</div>'); d.body.appendChild(b); return b; }

  // ---------- install prompt ----------
  var deferred = null, DISMISS_KEY = 'appInstallDismissed';
  function dismissedRecently() { var t = Number(ls.get(DISMISS_KEY) || 0); return t && Date.now() - t < 14 * 864e5; }
  function hideBar() { var b = d.getElementById('appBar'); if (b) b.remove(); }
  function showInstall(text, withButton) {
    if (standalone || dismissedRecently() || !d.body) return;
    var b = bar('appBar', '<span>' + text + '</span>' + (withButton ? '<button class="go" type="button">Install</button>' : '') + '<button class="x" type="button" aria-label="Close">✕</button>');
    b.querySelector('.x').onclick = function () { ls.set(DISMISS_KEY, String(Date.now())); hideBar(); };
    var go = b.querySelector('.go');
    if (go) go.onclick = function () {
      if (!deferred) return; deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; hideBar(); });
    };
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; showInstall('📲 Install this app on your phone for quick access', true); });
  window.addEventListener('appinstalled', function () { deferred = null; hideBar(); });
  if (ios && !standalone) window.addEventListener('load', function () { setTimeout(function () { showInstall('📲 To install: tap <b>Share</b> ⬆ then <b>Add to Home Screen</b>', false); }, 2500); });

  // ---------- offline banner ----------
  function net() {
    var o = d.getElementById('appOff');
    if (navigator.onLine === false) { if (!o && d.body) bar('appOff', '⚠ You are offline — new entries cannot be saved until you reconnect.'); }
    else if (o) o.remove();
  }
  window.addEventListener('online', net); window.addEventListener('offline', net);

  // ---------- service worker + update banner ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var w = reg.installing; if (!w) return;
          w.addEventListener('statechange', function () {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              var b = bar('appBar', '<span>✨ A new version of the app is ready</span><button class="go" type="button">Reload</button>');
              b.querySelector('.go').onclick = function () { w.postMessage('SKIP_WAITING'); };
            }
          });
        });
      }).catch(function () {});
      var reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () { if (reloaded) return; reloaded = true; location.reload(); });
    });
  }

  // ---------- C&F app: wide tables scroll sideways instead of breaking the page ----------
  function wrapTables() {
    d.querySelectorAll('table').forEach(function (t) {
      var p = t.parentElement; if (!p || p.getAttribute('data-wrapped')) return;
      var ox = window.getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return;
      var w = d.createElement('div'); w.setAttribute('data-wrapped', '1'); w.style.cssText = 'overflow-x:auto;-webkit-overflow-scrolling:touch';
      p.insertBefore(w, t); w.appendChild(t);
    });
  }
  function ready() {
    net();
    if (root.getAttribute('data-app') === 'cnf') { wrapTables(); new MutationObserver(function () { wrapTables(); }).observe(d.body, { childList: true, subtree: true }); }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ready); else ready();
})();

/* Crown Cement — scrolling band for the Home pages
   Shows, as one endless moving strip:  (1) every item's unit price for last month  (2) every upcoming shipment (not yet arrived).
   Usage: AppTicker.init({anchor:'.content', where:'before'});  AppTicker.update(dashboardData);  AppTicker.show(true|false) */
(function () {
  'use strict';
  var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], COL = ['#2d6df6', '#8b46e6', '#e0414f', '#1aa6b7', '#f59a1c', '#2fb36d', '#d6458f', '#6c7a89'];
  var cfg = { anchor: null, where: 'before' }, band = null, visible = true, last = null, AT = {};
  // Only these raw materials appear in the band (prices and upcoming vessels). Change the list here, or set localStorage 'ccTickerMaterials' to a comma-separated list.
  var RAW = ['CLINKER', 'SLAG', 'GYPSUM', 'LIMESTONE', 'CRUSHED STONE', 'AGGREGATES STONE CHIPS', 'COARSE AGGREGATES', 'STEAM COAL', 'MILLING WHEAT', 'PP YARN', 'PP LAMINATION', 'POLYPROPYLENE COMPOUND PMOD', 'LDPE'];
  function nk(x) { return String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function rawKeys() { var c = ''; try { c = localStorage.getItem('ccTickerMaterials') || ''; } catch (e) {} return (c ? c.split(',') : RAW).map(nk).filter(Boolean); }
  function isRaw(item) { var k = nk(item); if (!k) return false; return rawKeys().some(function (r) { return k === r || (r.length >= 4 && k.indexOf(r) !== -1); }); }
  function ymd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(x) ? 0 : x; }
  function esc(x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function col(name) { var h = 0, s = String(name); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return COL[h % COL.length]; }
  function fmt(n, d) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function prev(t) { return t.m === 1 ? { y: t.y - 1, m: 12 } : { y: t.y, m: t.m - 1 }; }
  function dot(name) { return '<span class="tk-dot" style="background:' + col(name) + '">' + esc(String(name).charAt(0).toUpperCase()) + '</span>'; }

  function build(r) {
    var today = ymd(r.today) || (function () { var n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; })();
    var tKey = today.y * 372 + today.m * 31 + today.d, lm = prev(today), pm = prev(lm), lmK = lm.y * 12 + lm.m, pmK = pm.y * 12 + pm.m;
    var pis = (r.pis || []).filter(Boolean), ships = (r.ships || []).filter(Boolean), items = {}, piBy = {}, closed = {}, out = [];
    pis.forEach(function (p) {
      if (p.lcNo && !piBy[p.lcNo]) piBy[p.lcNo] = p; if (p.lcNo && p.closed) closed[p.lcNo] = 1;
      var it = String(p.item == null ? '' : p.item).trim(), d = ymd(p.piDate); if (!it || !d || !isRaw(it)) return;
      var q = num(p.qty), pr = num(p.unitPrice); if (!(pr > 0) && q > 0) pr = num(p.value) / q; if (!(pr > 0)) return;
      var k = it.toUpperCase(), o = items[k] || (items[k] = { name: it, uom: p.uom || 'MT', mo: {} }), key = d.y * 12 + d.m, w = q > 0 ? q : 1, m = o.mo[key] || (o.mo[key] = { s: 0, w: 0 });
      m.s += pr * w; m.w += w; if (p.uom) o.uom = p.uom;
    });
    Object.keys(items).sort().forEach(function (k) {
      var o = items[k], keys = Object.keys(o.mo).map(Number).sort(function (a, b) { return b - a; }); if (!keys.length) return;
      var useK = o.mo[lmK] ? lmK : keys[0], price = o.mo[useK].s / o.mo[useK].w, base = o.mo[useK === lmK ? pmK : keys.filter(function (x) { return x < useK; })[0]];
      var chg = base ? (price - base.s / base.w) / (base.s / base.w) * 100 : null, y = Math.floor((useK - 1) / 12), mo = ((useK - 1) % 12);
      out.push('<span class="tk-pill"><span class="tk-chip">' + (useK === lmK ? 'LAST MONTH' : 'LATEST') + '</span>' + dot(o.name) + '<b>' + esc(o.name) + '</b><span class="tk-pr">$' + fmt(price, 2) + '<small>/' + esc(o.uom) + '</small></span>' +
        (chg === null || Math.abs(chg) < 0.05 ? '' : '<span class="tk-chg ' + (chg > 0 ? 'up' : 'dn') + '">' + (chg > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(chg), 1) + '%</span>') + '<em>' + MON[mo] + ' ' + y + '</em></span>');
    });
    var up = ships.filter(function (s) { return !closed[s.lcNo] && !String(s.arrival || '').trim() && isRaw((piBy[s.lcNo] || {}).item); }).map(function (s) {
      var e = ymd(s.eta), p = piBy[s.lcNo] || {}; return { s: s, p: p, e: e, k: e ? e.y * 372 + e.m * 31 + e.d : 9e9 };
    }).sort(function (a, b) { return a.k - b.k; }).slice(0, 40);
    up.forEach(function (x) {
      var item = String(x.p.item || '').trim() || 'Shipment', q = num(x.s.qty), late = x.e && x.k < tKey, now = x.e && x.k === tKey;
      out.push('<span class="tk-pill"><span class="tk-chip ' + (late ? 'late' : now ? 'now' : 'up') + '">' + (late ? 'DELAYED' : now ? 'TODAY' : 'UPCOMING') + '</span>' + dot(item) + '<b>' + esc(item) + '</b><i>' + esc(x.s.vessel || x.s.bl || '') + (q > 0 ? ' · ' + fmt(q, 0) + ' ' + esc(x.p.uom || 'MT') : '') + '</i><em>' + (x.e ? x.e.d + ' ' + MON[x.e.m - 1] : 'ETA TBA') + '</em></span>');
    });
    return out;
  }

  function css() {
    if (document.getElementById('tkCss')) return; var s = document.createElement('style'); s.id = 'tkCss';
    s.textContent = '.tk-band{position:relative;overflow:hidden;background:linear-gradient(90deg,#0a0912,#14111d 55%,#0c1710);border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07);padding:10px 0;font-family:"Segoe UI",system-ui,Arial,sans-serif;-webkit-user-select:none;user-select:none}' +
      '.tk-track{display:flex;width:max-content;animation:tkmove 60s linear infinite;will-change:transform}.tk-band.hold .tk-track{animation-play-state:paused}@media(hover:hover){.tk-band:hover .tk-track{animation-play-state:paused}}.tk-set{display:flex;align-items:center;flex:none}' +
      '@keyframes tkmove{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
      '.tk-pill{display:inline-flex;align-items:center;gap:9px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.1);border-radius:99px;padding:6px 16px 6px 8px;color:#e9ecf5;font-size:14px;white-space:nowrap}' +
      '.tk-pill b{font-weight:800}.tk-pill i{font-style:normal;color:#aab3c7}.tk-pill em{font-style:normal;color:#8d97ad;font-size:13px;letter-spacing:.02em}.tk-pr{font-weight:800;color:#fff}.tk-pr small{font-weight:600;color:#8d97ad;margin-left:1px}' +
      '.tk-chip{background:#232a3b;color:#b9c2d6;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:800;letter-spacing:.07em}.tk-chip.late{background:#4a1d24;color:#ff8d98}.tk-chip.now{background:#3a3a14;color:#e3e37a}.tk-chip.up{background:#232a3b}' +
      '.tk-dot{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:800;flex:none}.tk-chg{font-size:12px;font-weight:800}.tk-chg.up{color:#ffb454}.tk-chg.dn{color:#7bd88f}' +
      '.tk-sep{color:#a3c93a;margin:0 22px;font-size:15px;flex:none}@media(max-width:600px){.tk-pill{font-size:12.5px;padding:5px 12px 5px 6px;gap:7px}.tk-sep{margin:0 14px}}' +
      '.tk-band.paused .tk-track{animation-play-state:paused}.tk-ctl{position:absolute;right:8px;top:50%;transform:translateY(-50%);z-index:3;border:0;border-radius:50%;width:28px;height:28px;background:rgba(10,9,18,.85);color:#cfd6e6;cursor:pointer;font-size:12px;box-shadow:0 0 0 1px rgba(255,255,255,.15)}.tk-msg{color:#cfd6e6;font-size:13.5px;padding:4px 22px;white-space:nowrap}';
    document.head.appendChild(s);
  }
  function measure() { if (!band || band.style.display === 'none') return; var set = band.querySelector('.tk-set'); if (!set) return; var w = set.offsetWidth; if (w) band.querySelector('.tk-track').style.animationDuration = Math.max(15, w / 55) + 's'; }
  function ensure() {
    if (band) return band; var a = typeof cfg.anchor === 'string' ? document.querySelector(cfg.anchor) : cfg.anchor; if (!a || !a.parentNode) return null;
    css(); band = document.createElement('div'); band.className = 'tk-band'; band.setAttribute('aria-label', 'Last month unit prices and upcoming shipments');
    band.addEventListener('touchstart', function () { band.classList.add('hold'); }, { passive: true }); band.addEventListener('touchend', function () { setTimeout(function () { band.classList.remove('hold'); }, 1500); }, { passive: true });
    band.addEventListener('touchcancel', function () { band.classList.remove('hold'); }, { passive: true });
    if (cfg.where === 'after') a.parentNode.insertBefore(band, a.nextSibling); else a.parentNode.insertBefore(band, a); return band;
  }
  var userPaused = false;                       // pause lasts for this visit only — after a reload the band always scrolls
  function paused() { return userPaused; }
  function msg(text) { var b = ensure(); if (!b) return; b.innerHTML = '<div class="tk-msg">' + esc(text) + '</div>'; b.style.display = visible ? '' : 'none'; }
  function render() {
    if (!last) return; var pills, b;
    try { pills = build(last); } catch (e) { msg('⚠ The band could not be built (' + e.message + ')'); return; }
    b = ensure(); if (!b) return;
    if (!pills.length) { var nm = {}; (last.pis || []).forEach(function (p) { if (p && p.item != null && String(p.item).trim()) nm[String(p.item).trim()] = 1; }); var ex = Object.keys(nm).slice(0, 4); msg('No raw-material prices or upcoming vessels to show yet.' + (ex.length ? ' Items in your sheet: ' + ex.join(', ') + ' — only items in the raw-material list appear here.' : '')); return; }
    var one = pills.join('<span class="tk-sep">✦</span>') + '<span class="tk-sep">✦</span>', reps = 1;
    b.style.display = visible ? '' : 'none'; b.innerHTML = '<div class="tk-track"><div class="tk-set" id="tkProbe">' + one + '</div></div>';
    var pw = (document.getElementById('tkProbe') || {}).offsetWidth || 0, vw = b.offsetWidth || window.innerWidth || 1200; if (pw > 0) reps = Math.max(1, Math.ceil((vw + 200) / pw));
    var grp = new Array(reps + 1).join(one), set = '<div class="tk-set">' + grp + '</div>';
    b.innerHTML = '<div class="tk-track">' + set + set.replace('class="tk-set"', 'class="tk-set" aria-hidden="true"') + '</div><button class="tk-ctl" type="button" aria-label="Pause or play" title="Pause / play">' + (paused() ? '▶' : '⏸') + '</button>';
    b.classList.toggle('paused', paused());
    b.querySelector('.tk-ctl').onclick = function () { var p = !b.classList.contains('paused'); b.classList.toggle('paused', p); this.textContent = p ? '▶' : '⏸'; userPaused = p; };
    b.style.display = visible ? '' : 'none'; if (visible) requestAnimationFrame(measure);
  }
  AT.init = function (o) { Object.keys(o || {}).forEach(function (k) { cfg[k] = o[k]; }); return AT; };
  AT.update = function (r) { if (!r) return; last = r; render(); };
  AT.message = function (text) { if (!last) msg(text); else if (/⚠/.test(text) && band) { /* keep the last good band; the dashboard shows the warning */ } };
  AT.show = function (f) { visible = !!f; if (band) { band.style.display = (visible && band.querySelector('.tk-track')) ? '' : 'none'; if (visible) requestAnimationFrame(measure); } };
  AT.version = '2026-10-22'; AT._build = build; window.AppTicker = AT;
})();

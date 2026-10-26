/* Crown Cement — table toolbar (one copy in each app folder)
   Adds to a table:  [📅 from – to]  [↻ Refresh]  [Order: Newest first / Oldest first]
   The date column is found automatically (first column whose cells are dates). Tables without a date column get Refresh only.
   Usage: TableTools.attach(tableElement, tbodyElement)   ·   the page defines window.ccTableRefresh(table) for the Refresh button. */
(function () {
  'use strict';
  var MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function pd(t) {
    t = String(t == null ? '' : t).trim(); var m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})[-\/ ]([A-Za-z]{3})[a-z]*[-\/ ,]*(\d{4})/.exec(t))) { var i = MON.indexOf(m[2].toLowerCase()); if (i >= 0) return Date.UTC(+m[3], i, +m[1]); }
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t))) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    return null;
  }
  function isMsg(tr) { return tr.cells.length === 1 && tr.cells[0].colSpan > 1; }
  function css() {
    if (document.getElementById('ttCss')) return; var s = document.createElement('style'); s.id = 'ttCss';
    s.textContent = '.tt-hide{display:none!important}.tt-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px}' +
      '.tt-dates{display:flex;align-items:center;gap:8px;background:#16264a;border:1px solid #2b3d6b;border-radius:10px;padding:6px 12px;color:#fff;max-width:100%}' +
      '.tt-dates input{background:transparent;border:0;color:#fff;color-scheme:dark;font:600 13px "Segoe UI",system-ui,Arial,sans-serif;padding:5px 2px;min-width:0;width:132px;min-height:0!important}' +
      '.tt-bar button{border:0;border-radius:10px;padding:10px 16px;font:700 14px "Segoe UI",system-ui,Arial,sans-serif;color:#fff;cursor:pointer;min-height:40px}' +
      '.tt-ref{background:#0d1b3d}.tt-ord{background:#2563eb}.tt-bar.tt-nodate .tt-dates,.tt-bar.tt-nodate .tt-ord{display:none}' +
      '@media(max-width:620px){.tt-dates{flex:1 1 100%}.tt-dates input{flex:1;width:auto}.tt-bar button{flex:1}}';
    document.head.appendChild(s);
  }
  function attach(table, tb) {
    if (!table || !tb || table.getAttribute('data-tt')) return; table.setAttribute('data-tt', '1'); css();
    var st = { from: '', to: '', order: 'new' }, busy = false;
    var bar = document.createElement('div'); bar.className = 'tt-bar tt-nodate';
    bar.innerHTML = '<div class="tt-dates"><span aria-hidden="true">📅</span><input type="date" class="tt-from" aria-label="From date"><span>–</span><input type="date" class="tt-to" aria-label="To date"></div>' +
      '<button type="button" class="tt-ref">↻ Refresh</button><button type="button" class="tt-ord">Order: Newest first</button>';
    var anchor = table, p = table.parentElement;
    while (p && p.children.length === 1 && p !== document.body && /tbl-scroll|auto|scroll/.test((p.className || '') + ' ' + (p.style && p.style.overflowX || ''))) { anchor = p; p = p.parentElement; }
    anchor.parentNode.insertBefore(bar, anchor);
    var fromI = bar.querySelector('.tt-from'), toI = bar.querySelector('.tt-to'), ord = bar.querySelector('.tt-ord'), ref = bar.querySelector('.tt-ref');
    function dateCol() {
      var heads = [].map.call(table.querySelectorAll('thead th'), function (h) { return h.textContent || ''; });
      var rows = [].filter.call(tb.rows, function (r) { return !isMsg(r); }).slice(0, 40), best = -1, bs = 0;
      if (!rows.length) return -1;
      for (var c = 0; c < heads.length; c++) {
        var ok = 0, tot = 0;
        rows.forEach(function (r) { var td = r.cells[c]; if (!td) return; var t = td.textContent.trim(); if (!t || t === '—' || t === '-') return; tot++; if (pd(t) !== null) ok++; });
        if (ok && ok / tot >= 0.6) { var sc = ok / tot + (/date|received|eta|created|sent|dt\b|on$/i.test(heads[c]) ? 1 : 0) - c / 100; if (sc > bs) { bs = sc; best = c; } }
      }
      return best;
    }
    function apply() {
      if (busy) return; busy = true;
      try {
        var col = dateCol(), rows = [].filter.call(tb.rows, function (r) { return !isMsg(r); });
        bar.classList.toggle('tt-nodate', col < 0);
        if (col < 0) { rows.forEach(function (r) { r.classList.remove('tt-hide'); }); return; }
        var f = st.from ? Date.parse(st.from + 'T00:00:00Z') : null, t = st.to ? Date.parse(st.to + 'T00:00:00Z') : null;
        var arr = rows.map(function (r, i) { return { r: r, d: pd(r.cells[col] && r.cells[col].textContent), i: i }; });
        arr.forEach(function (o) { o.r.classList.toggle('tt-hide', (f !== null || t !== null) && (o.d === null || (f !== null && o.d < f) || (t !== null && o.d > t))); });
        arr.sort(function (a, b) {
          if (a.d === null && b.d === null) return a.i - b.i; if (a.d === null) return 1; if (b.d === null) return -1;
          return a.d === b.d ? a.i - b.i : (st.order === 'new' ? b.d - a.d : a.d - b.d);
        });
        if (arr.some(function (o, i) { return o.r !== rows[i]; })) arr.forEach(function (o) { tb.appendChild(o.r); });
        var h0 = (table.querySelector('thead th') || {}).textContent || '';   // keep a "#" / "SL" serial column in order
        if (/^\s*(#|sl\.?|s\/?n|no\.?)\s*$/i.test(h0)) arr.forEach(function (o, i) { var td = o.r.cells[0]; if (td && /^\d+$/.test(td.textContent.trim())) td.textContent = String(i + 1); });
      } finally { mo.takeRecords(); busy = false; }
    }
    function poke() { var c = document.createComment(''); tb.appendChild(c); tb.removeChild(c); }   // tells the page's pager to re-count rows
    var mo = new MutationObserver(function () { apply(); }); mo.observe(tb, { childList: true });
    fromI.addEventListener('change', function () { st.from = fromI.value; apply(); poke(); });
    toI.addEventListener('change', function () { st.to = toI.value; apply(); poke(); });
    ord.addEventListener('click', function () { st.order = st.order === 'new' ? 'old' : 'new'; ord.textContent = 'Order: ' + (st.order === 'new' ? 'Newest first' : 'Oldest first'); apply(); poke(); });
    ref.addEventListener('click', function () {
      ref.disabled = true; var old = ref.textContent; ref.textContent = '↻ Refreshing…';
      try { if (window.ccTableRefresh) window.ccTableRefresh(table); } catch (e) {}
      setTimeout(function () { ref.disabled = false; ref.textContent = old; }, 1500);
    });
    apply();
  }
  window.TableTools = { attach: attach, parseDate: pd, version: '2026-10-24' };
})();

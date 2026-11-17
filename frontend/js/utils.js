/* Shared helpers: formatting, escaping, icons. Everything hangs off window.RETAIN (no modules, so it works from file://). */
(function (R) {
  'use strict';

  /* ---------- Escaping ---------- */
  R.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- Numbers ---------- */
  R.toNumber = function (v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  };

  /** Accepts 0–1 fractions or 0–100 percentages; always returns a 0–1 fraction (or null). */
  R.normalizeRate = function (v) {
    var n = R.toNumber(v);
    if (n === null) return null;
    return n > 1 ? n / 100 : n;
  };

  R.fmtInt = function (v) {
    var n = R.toNumber(v);
    return n === null ? '—' : Math.round(n).toLocaleString('en-US');
  };

  R.fmtDecimal = function (v, digits) {
    var n = R.toNumber(v);
    return n === null ? '—' : n.toFixed(digits === undefined ? 1 : digits);
  };

  R.fmtPercent = function (v, digits) {
    var n = R.normalizeRate(v);
    return n === null ? '—' : (n * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  };

  /** "num__Tenure" -> "Tenure", "cat__Gender_Male" -> "Gender: Male" */
  R.cleanFeatureName = function (name) {
    var s = String(name === null || name === undefined ? '' : name).replace(/^(num|cat|remainder)__/, '');
    var m = s.match(/^(PreferredLoginDevice|PreferredPaymentMode|Gender|PreferedOrderCat|MaritalStatus)_(.+)$/);
    return m ? m[1] + ': ' + m[2] : s;
  };

  /* ---------- Risk ---------- */
  R.RISK_LEVELS = ['High', 'Medium', 'Low'];
  R.RISK_COLORS = { High: '#DC5555', Medium: '#8b97a3', Low: '#28A879' };
  // Neutral series for anything that is NOT a risk level (red/green stay reserved).
  R.NEUTRAL_SERIES = ['#E6EBF0', '#8b97a3', '#54616e', '#3f5a74', '#2b4157', '#22384d'];

  R.normalizeRisk = function (v) {
    if (v === null || v === undefined || v === '') return null;
    var s = String(v).toLowerCase();
    if (s.indexOf('high') !== -1) return 'High';
    if (s.indexOf('med') !== -1 || s.indexOf('mod') !== -1) return 'Medium';
    if (s.indexOf('low') !== -1) return 'Low';
    return String(v);
  };

  /* ---------- Icons (inline SVG, Lucide-style strokes) ---------- */
  var ICONS = {
    layout: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    trendDown: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
    shieldAlert: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    chevDown: '<path d="m6 9 6 6 6-6"/>',
    chevLeft: '<path d="m15 18-6-6 6-6"/>',
    chevRight: '<path d="m9 18 6-6-6-6"/>',
    arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    sort: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    flask: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  };

  R.icon = function (name, size, cls) {
    return (
      '<svg class="icon ' + (cls || '') + '" xmlns="http://www.w3.org/2000/svg" width="' + (size || 18) + '" height="' + (size || 18) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || '') + '</svg>'
    );
  };

  R.logo = function () {
    return (
      '<div class="logo"><svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">' +
      '<rect width="32" height="32" rx="7" fill="#0e1e2e" stroke="rgba(255,255,255,0.14)"/>' +
      '<path d="M10 23V9h7.2c2.6 0 4.3 1.5 4.3 3.9 0 1.9-1.1 3.2-2.8 3.7L22.4 23h-3.3l-3.2-5.9H12.9V23H10zm2.9-8.3h4c1.2 0 1.9-.7 1.9-1.8s-.7-1.8-1.9-1.8h-4v3.6z" fill="#fff"/>' +
      '<circle cx="24" cy="9" r="2.2" fill="#28A879"/></svg><span class="logo-word">RETAIN</span></div>'
    );
  };

  R.pages = {};
})((window.RETAIN = window.RETAIN || {}));

/* App shell: navigation, hash router, mobile drawer and connection status. */
(function (R) {
  'use strict';
  var esc = R.esc;

  var ROUTES = {
    '/predict': { label: 'Churn Prediction', icon: 'crosshair', page: 'predict' },
    '/models': { label: 'Model Performance', icon: 'gauge', page: 'models' },
  };
  var ORDER = ['/predict', '/models'];
  var DEFAULT_PATH = '/predict';

  function $(id) { return document.getElementById(id); }

  function renderNav() {
    $('nav').innerHTML =
      '<p class="nav-label">Analytics</p>' +
      ORDER.map(function (p) {
        var r = ROUTES[p];
        return '<a href="#' + p + '" data-route="' + p + '">' + R.icon(r.icon, 18) + esc(r.label) + '</a>';
      }).join('');
  }

  function currentPath() {
    return (location.hash || '').replace(/^#/, '') || DEFAULT_PATH;
  }

  function updateActive(path) {
    Array.prototype.forEach.call($('nav').querySelectorAll('a'), function (a) {
      var on = a.getAttribute('data-route') === path;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  /* ---------- Drawer ---------- */
  function openDrawer() { $('sidebar').classList.add('open'); $('backdrop').classList.add('open'); }
  function closeDrawer() { $('sidebar').classList.remove('open'); $('backdrop').classList.remove('open'); }

  /* ---------- Connection status ---------- */
  function renderConnection() {
    var s = R.mode.get();
    var dot = '', label = 'Not connected yet';
    if (s.status === 'ok') { dot = 'ok'; label = 'Backend connected'; }
    else if (s.status === 'error') { dot = 'err'; label = 'Backend unreachable'; }

    var host = (window.location && window.location.host) || 'same origin';
    if (R.API_URL) {
      try { host = new URL(R.API_URL).host; } catch (e) { host = R.API_URL; }
    }
    $('connection').innerHTML =
      '<div class="conn"><div class="conn-line"><span class="dot ' + dot + '"></span>' + esc(label) + '</div>' +
      '<p class="conn-host">' + esc(host) + '</p></div>';
  }

  /* ---------- Router ---------- */
  function route() {
    var path = currentPath();
    var r = ROUTES[path];
    if (!r) { location.replace('#' + DEFAULT_PATH); return; }
    var view = $('view');
    updateActive(path);
    closeDrawer();
    document.title = r.label + ' — RETAIN';
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    view.innerHTML = '';
    try {
      R.pages[r.page].mount(view);
    } catch (e) {
      if (window.console) console.error(e);
      view.innerHTML = R.ui.error({ kind: 'invalid', message: 'This page failed to load: ' + e.message });
      R.ui.wireError(view, route);
    }
  }

  function init() {
    $('logo-desktop').innerHTML = R.logo();
    $('logo-mobile').innerHTML = R.logo();
    $('open-menu').innerHTML = R.icon('menu', 20);
    $('close-menu').innerHTML = R.icon('x', 18);
    $('banner').innerHTML = '';
    renderNav();
    renderConnection();

    $('open-menu').addEventListener('click', openDrawer);
    $('close-menu').addEventListener('click', closeDrawer);
    $('backdrop').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    $('nav').addEventListener('click', closeDrawer);

    R.mode.subscribe(renderConnection);

    window.addEventListener('hashchange', route);
    route();

    // Lightweight health ping so the sidebar reflects the live backend immediately.
    if (R.api.getHealth) R.api.getHealth().catch(function () { /* status is updated by the transport */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.RETAIN);

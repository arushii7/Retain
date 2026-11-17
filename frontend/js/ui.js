/* Reusable UI building blocks. Most return HTML strings; ui.table is a small stateful component. */
(function (R) {
  'use strict';
  var esc = R.esc;
  var icon = R.icon;
  var ui = (R.ui = {});

  /** Delegated click handling: <button data-action="x"> -> handlers.x(el, event) */
  ui.bindActions = function (root, handlers) {
    root.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!el || !root.contains(el)) return;
      var fn = handlers[el.getAttribute('data-action')];
      if (fn) fn(el, e);
    });
  };

  ui.pageHeader = function (title, desc, actions) {
    return (
      '<div class="page-head"><div><h1>' + esc(title) + '</h1>' + (desc ? '<p>' + esc(desc) + '</p>' : '') + '</div>' +
      (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>'
    );
  };

  ui.cardHead = function (title, subtitle, action) {
    return (
      '<div class="card-head"><div><h3>' + esc(title) + '</h3>' + (subtitle ? '<p>' + esc(subtitle) + '</p>' : '') + '</div>' +
      (action ? '<div>' + action + '</div>' : '') + '</div>'
    );
  };
  ui.cardBody = function (html, cls) { return '<div class="card-body' + (cls ? ' ' + cls : '') + '">' + html + '</div>'; };
  ui.card = function (head, body, cls) { return '<div class="card' + (cls ? ' ' + cls : '') + '">' + (head || '') + (body || '') + '</div>'; };

  ui.kpi = function (o) {
    return (
      '<div class="card kpi"><div class="kpi-top"><span class="kpi-label">' + esc(o.label) + '</span>' +
      (o.icon ? '<span class="kpi-icon ' + (o.tone || '') + '">' + icon(o.icon, 16) + '</span>' : '') + '</div>' +
      '<p class="kpi-value">' + esc(o.value) + '</p>' + (o.hint ? '<p class="kpi-hint">' + esc(o.hint) + '</p>' : '') + '</div>'
    );
  };

  ui.metric = function (label, value, highlight) {
    return '<div class="metric' + (highlight ? ' hl' : '') + '"><p class="metric-label">' + esc(label) + '</p><p class="metric-value">' + esc(value) + '</p></div>';
  };

  ui.riskBadge = function (level) {
    var risk = R.normalizeRisk(level);
    if (!risk) return '<span class="faint">—</span>';
    var cls = risk === 'High' ? 'high' : risk === 'Low' ? 'low' : 'medium';
    return '<span class="badge ' + cls + '"><span class="dot"></span>' + esc(risk) + '</span>';
  };

  /* ---------------- States ---------------- */
  ui.loading = function (label) {
    return '<div class="state full" role="status" aria-live="polite"><span class="spinner"></span><p>' + esc(label || 'Loading data…') + '</p></div>';
  };

  var ERR = {
    config: ['serverOff', 'Backend address not configured'],
    network: ['wifiOff', 'Cannot connect to the RETAIN backend'],
    timeout: ['wifiOff', 'The backend took too long to respond'],
    http: ['alert', 'The backend returned an error'],
    validation: ['alert', 'The backend rejected the request'],
    invalid: ['alert', 'Unexpected response from the backend'],
  };

  ui.error = function (err, opts) {
    opts = opts || {};
    var kind = (err && err.kind) || 'unknown';
    var copy = ERR[kind] || ['alert', 'Something went wrong'];
    var ic = copy[0] === 'serverOff' ? 'wifiOff' : copy[0];
    var canDemo = R.DEMO_ENABLED && kind !== 'validation' && R.mode.get().mode !== 'demo';
    var help = '';
    if (kind === 'network' || kind === 'config' || kind === 'timeout') {
      help =
        '<p class="help">Make sure the FastAPI service is running and that <code>API_URL</code> in <code>js/config.js</code>' +
        (R.API_URL ? ' (currently <code>' + esc(R.API_URL) + '</code>)' : '') + ' points to it and that CORS allows this origin.</p>';
    }
    return (
      '<div class="state ' + (opts.compact ? 'compact' : 'full') + '" role="alert"><span class="state-icon alert">' + icon(ic, 20) + '</span>' +
      '<div><h3>' + esc(copy[1]) + '</h3><p>' + esc((err && err.message) || 'An unexpected error occurred.') + '</p>' + help + '</div>' +
      '<div class="state-actions">' +
      '<button type="button" class="btn btn-secondary" data-gate="retry">' + icon('refresh', 15) + ' Try again</button>' +
      (canDemo ? '<button type="button" class="btn btn-secondary" data-gate="demo">' + icon('flask', 15) + ' Explore in demo mode</button>' : '') +
      '</div></div>'
    );
  };

  /** Wire the buttons produced by ui.error inside `el`. */
  ui.wireError = function (el, onRetry) {
    var r = el.querySelector('[data-gate="retry"]');
    var d = el.querySelector('[data-gate="demo"]');
    if (r) r.addEventListener('click', onRetry);
    if (d) d.addEventListener('click', function () { R.mode.set('demo'); });
  };

  ui.empty = function (o) {
    return (
      '<div class="state' + (o.compact ? ' compact' : '') + '"><span class="state-icon">' + icon(o.icon || 'inbox', 20) + '</span>' +
      '<div><h3>' + esc(o.title) + '</h3>' + (o.description ? '<p>' + esc(o.description) + '</p>' : '') + '</div>' + (o.action || '') + '</div>'
    );
  };

  /** Show loading, run fetcher, then render(data) or an error state with retry / demo buttons. */
  ui.gate = function (root, fetcher, render, label) {
    var tok = (root._tok = (root._tok || 0) + 1);
    root.innerHTML = ui.loading(label);
    fetcher().then(
      function (data) {
        if (root._tok !== tok) return;
        try {
          render(data);
        } catch (e) {
          if (window.console) console.error(e);
          root.innerHTML = ui.error({ kind: 'invalid', message: 'The response could not be displayed: ' + e.message });
          ui.wireError(root, function () { ui.gate(root, fetcher, render, label); });
        }
      },
      function (err) {
        if (root._tok !== tok) return;
        root.innerHTML = ui.error(err);
        ui.wireError(root, function () { ui.gate(root, fetcher, render, label); });
      }
    );
  };

  /* ---------------- Controls ---------------- */
  ui.segmented = function (options, value, action, label) {
    return (
      '<div class="seg" role="tablist" aria-label="' + esc(label || '') + '">' +
      options.map(function (o) {
        return '<button type="button" role="tab" aria-selected="' + (o.value === value) + '" class="' + (o.value === value ? 'active' : '') + '" data-action="' + esc(action) + '" data-value="' + esc(o.value) + '">' + esc(o.label) + '</button>';
      }).join('') + '</div>'
    );
  };

  ui.select = function (o) {
    var html =
      '<div class="select-wrap"><select id="' + esc(o.id) + '"' + (o.name ? ' data-name="' + esc(o.name) + '"' : '') +
      ' class="select' + (o.placeholder && o.value === '' ? ' placeholder' : '') + (o.invalid ? ' invalid' : '') + '"' +
      (o.invalid ? ' aria-invalid="true"' : '') + '>';
    if (o.placeholder) html += '<option value="" disabled' + (o.value === '' ? ' selected' : '') + '>' + esc(o.placeholder) + '</option>';
    o.options.forEach(function (opt) {
      html += '<option value="' + esc(opt.value) + '"' + (opt.value === o.value ? ' selected' : '') + '>' + esc(opt.label) + '</option>';
    });
    return html + '</select>' + icon('chevDown', 16, 'chev') + '</div>';
  };

  ui.numberInput = function (o) {
    return (
      '<input class="input' + (o.invalid ? ' invalid' : '') + (o.cls ? ' ' + o.cls : '') + '" type="number" inputmode="decimal" id="' + esc(o.id) + '"' +
      (o.name ? ' data-name="' + esc(o.name) + '"' : '') + ' min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" value="' + esc(o.value) + '" placeholder="' + esc(o.placeholder || '') + '"' +
      (o.invalid ? ' aria-invalid="true"' : '') + ' />'
    );
  };

  ui.sliderPct = function (value, min, max) {
    var n = value === '' || value === null || value === undefined ? NaN : Number(value);
    return isFinite(n) ? Math.min(100, Math.max(0, ((n - min) / (max - min)) * 100)) : 0;
  };

  ui.slider = function (o) {
    var n = o.value === '' ? NaN : Number(o.value);
    var rv = isFinite(n) ? Math.min(o.max, Math.max(o.min, n)) : o.min;
    return (
      '<div class="slider-row"><input type="range" id="' + esc(o.id) + '-range" aria-label="' + esc(o.label || o.id) + ' slider" data-role="range" data-name="' + esc(o.name) +
      '" min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" value="' + rv + '" style="--fill:' + ui.sliderPct(o.value, o.min, o.max).toFixed(2) + '%" />' +
      ui.numberInput({ id: o.id, name: o.name, min: o.min, max: o.max, step: o.step, value: o.value, invalid: o.invalid, placeholder: '—' }) + '</div>'
    );
  };

  /** Field wrapper: label + control + hint/error message line. */
  ui.field = function (o) {
    var msg = o.error || o.hint || '';
    return (
      '<div class="field" data-field="' + esc(o.name) + '"><div class="field-head"><label for="' + esc(o.id) + '">' + esc(o.label) + '</label>' +
      (o.unit ? '<span class="unit">' + esc(o.unit) + '</span>' : '') + '</div>' + o.control +
      '<p class="field-msg' + (o.error ? ' error' : '') + '" id="' + esc(o.id) + '-msg"' + (o.error ? ' role="alert"' : '') + (msg ? '' : ' hidden') + '>' + esc(msg) + '</p></div>'
    );
  };

  /* ---------------- Table ---------------- */
  /**
   * ui.table(container, { columns, rows, rowKey, pageSize, initialSort:{key,dir}, empty:html|fn, rowClass:fn })
   * columns: [{ key, header, sortable, align:'right', accessor(row), render(row)->html, className }]
   * Returns { setRows(rows) }.
   */
  ui.table = function (container, opts) {
    var cols = opts.columns;
    var rows = opts.rows || [];
    var size = opts.pageSize || 10;
    var sort = opts.initialSort || null;
    var page = 0;

    function getter(col) { return col.accessor || function (r) { return r[col.key]; }; }

    function sortedRows() {
      if (!sort) return rows;
      var col = cols.filter(function (c) { return c.key === sort.key; })[0];
      if (!col) return rows;
      var get = getter(col);
      var dir = sort.dir === 'asc' ? 1 : -1;
      return rows.slice().sort(function (a, b) {
        var av = get(a), bv = get(b);
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
      });
    }

    function render() {
      if (!rows.length) {
        container.innerHTML = typeof opts.empty === 'function' ? opts.empty() : opts.empty || '';
        return;
      }
      var all = sortedRows();
      var pages = Math.max(1, Math.ceil(all.length / size));
      if (page > pages - 1) page = pages - 1;
      var visible = all.slice(page * size, page * size + size);

      var html = '<div class="table-wrap"><table><thead><tr>';
      cols.forEach(function (c) {
        var active = sort && sort.key === c.key;
        var inner = esc(c.header);
        if (c.sortable) {
          var ic = !active ? 'sort' : sort.dir === 'asc' ? 'arrowUp' : 'arrowDown';
          inner = '<button type="button" class="sort-btn' + (active ? ' active' : '') + '" data-sort="' + esc(c.key) + '">' + esc(c.header) + icon(ic, 12) + '</button>';
        }
        html += '<th scope="col" class="' + (c.align === 'right' ? 'num' : '') + '"' + (active ? ' aria-sort="' + (sort.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' + inner + '</th>';
      });
      html += '</tr></thead><tbody>';
      visible.forEach(function (row) {
        html += '<tr class="' + (opts.rowClass ? opts.rowClass(row) || '' : '') + '">';
        cols.forEach(function (c) {
          var cell;
          if (c.render) cell = c.render(row);
          else {
            var v = getter(c)(row);
            cell = esc(v === null || v === undefined || v === '' ? '—' : v);
          }
          html += '<td class="' + (c.align === 'right' ? 'num ' : '') + (c.className || '') + '">' + cell + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';

      if (pages > 1) {
        html +=
          '<div class="pager"><span>' + (page * size + 1) + '–' + Math.min((page + 1) * size, all.length) + ' of ' + all.length.toLocaleString('en-US') + '</span>' +
          '<div class="pager-ctrl"><button type="button" data-go="-1" aria-label="Previous page"' + (page === 0 ? ' disabled' : '') + '>' + icon('chevLeft', 16) + '</button>' +
          '<span class="tnum" style="padding:0 8px">Page ' + (page + 1) + ' / ' + pages + '</span>' +
          '<button type="button" data-go="1" aria-label="Next page"' + (page >= pages - 1 ? ' disabled' : '') + '>' + icon('chevRight', 16) + '</button></div></div>';
      }
      container.innerHTML = html;
    }

    container.addEventListener('click', function (e) {
      var s = e.target.closest ? e.target.closest('[data-sort]') : null;
      if (s && container.contains(s)) {
        var key = s.getAttribute('data-sort');
        if (!sort || sort.key !== key) sort = { key: key, dir: 'desc' };
        else if (sort.dir === 'desc') sort = { key: key, dir: 'asc' };
        else sort = null;
        render();
        return;
      }
      var g = e.target.closest ? e.target.closest('[data-go]') : null;
      if (g && container.contains(g) && !g.disabled) {
        page += Number(g.getAttribute('data-go'));
        render();
      }
    });

    render();
    return {
      setRows: function (r) { rows = r; page = 0; render(); },
    };
  };
})(window.RETAIN);

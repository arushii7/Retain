(function (R) {
  'use strict';
  var ui = R.ui, ch = R.charts, esc = R.esc;

  var METRICS = [
    { key: 'accuracy', label: 'Accuracy', color: '#E6EBF0', help: 'Share of all predictions that were correct.' },
    { key: 'precision', label: 'Precision', color: '#8b97a3', help: 'Of customers flagged as churners, the share who really churned.' },
    { key: 'recall', label: 'Recall', color: '#54616e', help: 'Of customers who really churned, the share the model caught.' },
    { key: 'f1', label: 'F1-score', color: '#3f6b8f', help: 'Harmonic mean of precision and recall.' },
  ];

  function content(root, data) {
    var models = data.models;
    var bestName = data.bestModel;
    var leader = models.filter(function (m) { return m.name === bestName; })[0] || null;
    var best = {};
    METRICS.forEach(function (c) {
      best[c.key] = Math.max.apply(null, models.map(function (m) { return m[c.key] === null ? -1 : m[c.key]; }));
    });

    var html = '<div class="stack">';

    if (leader) {
      html +=
        '<div class="card leader"><div class="leader-inner"><div class="leader-id"><span class="leader-icon">' + R.icon('trophy', 22) + '</span>' +
        '<div><p class="kpi-label">Current leading model</p><h2>' + esc(leader.name) + '</h2></div></div>' +
        '<div class="metric-grid four">' +
        METRICS.map(function (c) { return ui.metric(c.label, R.fmtPercent(leader[c.key]), c.key === 'f1'); }).join('') +
        '</div></div></div>';
    }

    html += ui.card(
      ui.cardHead('Model comparison', 'Held-out test set performance'),
      ui.cardBody(
        ch.vbar({
          data: models, categoryKey: 'name',
          series: METRICS.map(function (c) { return { key: c.key, name: c.label, color: c.color }; }),
          domain: [0, 1], valueFormatter: function (v) { return R.fmtPercent(v); }, tickFormatter: function (v) { return R.fmtPercent(v, 0); },
          legend: true, height: 340,
        })
      )
    );

    html += ui.card(ui.cardHead('Metrics by model', 'Best value in each column is highlighted'), '<div id="model-table"></div>');

    html += ui.card(
      ui.cardHead('How to read these metrics'),
      ui.cardBody(
        '<dl class="defs">' +
          METRICS.map(function (c) {
            return '<div><dt><span class="swatch" style="background:' + c.color + '"></span>' + esc(c.label) + '</dt><dd>' + esc(c.help) + '</dd></div>';
          }).join('') + '</dl>'
      )
    );
    html += '</div>';
    root.innerHTML = html;

    var columns = [
      {
        key: 'name', header: 'Model', sortable: true,
        render: function (m) {
          return '<span style="display:inline-flex;align-items:center;gap:8px;font-weight:500">' + esc(m.name) +
            (m.name === bestName ? '<span class="badge leading">' + R.icon('trophy', 11) + ' Leading</span>' : '') + '</span>';
        },
      },
    ].concat(
      METRICS.map(function (c) {
        return {
          key: c.key, header: c.label, sortable: true, align: 'right',
          render: function (m) {
            var isBest = m[c.key] !== null && m[c.key] === best[c.key];
            return '<span class="' + (isBest ? 'best' : '') + '">' + esc(R.fmtPercent(m[c.key])) + '</span>';
          },
        };
      })
    );
    ui.table(root.querySelector('#model-table'), {
      columns: columns, rows: models, pageSize: 10,
      rowClass: function (m) { return m.name === bestName ? 'row-lead' : ''; },
    });
  }

  R.pages.models = {
    mount: function (view) {
      view.innerHTML = ui.pageHeader('Model Performance', 'How each candidate model performs on the same held-out customers, and which one is currently leading.') + '<div id="gate"></div>';
      var root = view.querySelector('#gate');
      ui.gate(root, R.api.getModelPerformance, function (data) {
        if (!data.models.length) {
          root.innerHTML = ui.card('', ui.empty({ icon: 'gauge', title: 'No model metrics', description: 'The backend did not return any model results.' }));
          return;
        }
        content(root, data);
      }, 'Loading model metrics…');
    },
  };
})(window.RETAIN);

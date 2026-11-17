/* Hand-built CSS/SVG charts. No libraries. Each function returns an HTML string. */
(function (R) {
  'use strict';
  var esc = R.esc;
  var charts = (R.charts = {});

  function niceMax(v) {
    if (!(v > 0)) return 1;
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    var nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * exp;
  }

  /**
   * Vertical (grouped) bar chart.
   * o: { data:[{name,…}], categoryKey='name', series:[{key,name,color}], height=260, valueFormatter, tickFormatter,
   *      domain:[0,max], cellColors:[…] (per category, single series), legend:bool, activeKey, clickable:bool, action:'select-seg' }
   */
  charts.vbar = function (o) {
    var series = o.series;
    var data = o.data || [];
    var catKey = o.categoryKey || 'name';
    var h = o.height || 260;
    var vf = o.valueFormatter || R.fmtInt;
    var tf = o.tickFormatter || vf;
    var max;
    var n;
    if (o.domain) {
      max = o.domain[1];
      n = 4;
    } else {
      var m = 0;
      data.forEach(function (d) {
        series.forEach(function (s) { m = Math.max(m, Number(d[s.key]) || 0); });
      });
      max = niceMax(m);
      n = 5;
    }

    var html = '<div class="vchart"><div class="vplot" style="height:' + h + 'px">';
    for (var i = 0; i <= n; i++) {
      html += '<div class="vtick' + (i === 0 ? ' zero' : '') + '" style="bottom:' + ((i / n) * 100).toFixed(2) + '%"><span>' + esc(tf((max * i) / n)) + '</span></div>';
    }
    html += '<div class="vgroups">';
    data.forEach(function (d, di) {
      var key = d[catKey];
      var dim = o.activeKey && key !== o.activeKey;
      var tag = o.clickable ? 'button type="button" data-action="' + esc(o.action || 'select-seg') + '" data-name="' + esc(key) + '"' : 'div';
      var close = o.clickable ? 'button' : 'div';
      html += '<' + tag + ' class="vgroup' + (dim ? ' dim' : '') + '"' + (o.clickable ? ' aria-label="' + esc(key) + '"' : '') + '><div class="vbars">';
      series.forEach(function (s) {
        var v = Number(d[s.key]) || 0;
        var pct = Math.min(100, Math.max(0, (v / max) * 100));
        var color = o.cellColors ? o.cellColors[di % o.cellColors.length] : s.color;
        var label = (series.length > 1 ? s.name : key) + ': ' + vf(v);
        html += '<div class="vbar" data-tip="' + esc(label) + '" style="height:' + pct.toFixed(2) + '%;background:' + esc(color) + '"></div>';
      });
      html += '</div></' + close + '>';
    });
    html += '</div></div><div class="vlabels">';
    data.forEach(function (d) { html += '<div class="vlabel">' + esc(d[catKey]) + '</div>'; });
    html += '</div>';
    if (o.legend) {
      html += '<div class="legend">';
      series.forEach(function (s) { html += '<span><i style="background:' + esc(s.color) + '"></i>' + esc(s.name) + '</span>'; });
      html += '</div>';
    }
    return html + '</div>';
  };

  /** Horizontal bar rows. o: { data:[{name,value}], valueFormatter, color } */
  charts.hbars = function (o) {
    var data = o.data || [];
    var vf = o.valueFormatter || R.fmtInt;
    var max = 0;
    data.forEach(function (d) { max = Math.max(max, Number(d.value) || 0); });
    if (!(max > 0)) max = 1;
    var html = '<div class="hrows">';
    data.forEach(function (d) {
      var v = Number(d.value) || 0;
      html +=
        '<div class="hrow"><div class="hlabel" title="' + esc(d.name) + '">' + esc(d.name) + '</div>' +
        '<div class="htrack"><div class="hbar" style="width:' + ((v / max) * 100).toFixed(2) + '%;background:' + esc(o.color || '#E6EBF0') + '"></div></div>' +
        '<div class="hval">' + esc(vf(v)) + '</div></div>';
    });
    return html + '</div>';
  };

  /** Donut with legend. o: { data:[{name,value,color}], centerValue, centerLabel } */
  charts.donut = function (o) {
    var data = (o.data || []).filter(function (d) { return d.value > 0 || true; });
    var total = data.reduce(function (s, d) { return s + (Number(d.value) || 0); }, 0);
    var r = 38;
    var C = 2 * Math.PI * r;
    var gap = data.length > 1 ? 2 : 0;
    var offset = 0;
    var svg = '<svg viewBox="0 0 100 100" role="img" aria-label="' + esc(o.centerLabel || 'Distribution') + '">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="16"/>';
    data.forEach(function (d) {
      var v = Number(d.value) || 0;
      if (!total || v <= 0) return;
      var len = (v / total) * C;
      var draw = Math.max(0, len - gap);
      svg +=
        '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + esc(d.color) + '" stroke-width="16" stroke-dasharray="' + draw.toFixed(3) + ' ' + (C - draw).toFixed(3) +
        '" stroke-dashoffset="' + (-offset).toFixed(3) + '" transform="rotate(-90 50 50)"><title>' + esc(d.name + ': ' + R.fmtInt(v) + ' (' + ((v / total) * 100).toFixed(1) + '%)') + '</title></circle>';
      offset += len;
    });
    svg += '</svg>';

    var html = '<div><div class="donut">' + svg + '<div class="donut-center">';
    if (o.centerValue !== undefined) html += '<span class="donut-value">' + esc(o.centerValue) + '</span>';
    if (o.centerLabel) html += '<span class="donut-label">' + esc(o.centerLabel) + '</span>';
    html += '</div></div><ul class="donut-legend">';
    data.forEach(function (d) {
      var v = Number(d.value) || 0;
      html +=
        '<li><span class="swatch" style="background:' + esc(d.color) + '"></span><span>' + esc(d.name) + '</span><span class="v">' + esc(R.fmtInt(v)) +
        '</span><span class="p">' + (total ? ((v / total) * 100).toFixed(1) + '%' : '—') + '</span></li>';
    });
    return html + '</ul></div>';
  };
})(window.RETAIN);

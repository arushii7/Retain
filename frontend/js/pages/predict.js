(function (R) {
  'use strict';
  var ui = R.ui, esc = R.esc, F = R.form;

  var BY_NAME = {};
  F.ALL_FIELDS.forEach(function (f) { BY_NAME[f.name] = f; });

  function controlHtml(f, value, invalid) {
    var id = 'f-' + f.name;
    if (f.type === 'select') return ui.select({ id: id, name: f.name, value: value, options: f.options, placeholder: 'Select…', invalid: invalid });
    if (f.type === 'slider') return ui.slider({ id: id, name: f.name, label: f.label, min: f.min, max: f.max, step: f.step, value: value, invalid: invalid });
    return ui.numberInput({ id: id, name: f.name, min: f.min, max: f.max, step: f.step, value: value, invalid: invalid, placeholder: f.min + ' – ' + f.max });
  }

  function ring(probability, color) {
    var size = 168, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    var p = Math.min(1, Math.max(0, probability || 0));
    return (
      '<div class="ring"><svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Churn probability ' + esc(R.fmtPercent(probability)) + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' +
      (p * c).toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>' +
      '<div class="ring-center"><span class="ring-value">' + esc(R.fmtPercent(probability)) + '</span><span class="ring-label">churn probability</span></div></div>'
    );
  }

  function resultHtml(res) {
    var tone = res.risk === 'High' ? 'alert' : res.risk === 'Low' ? 'success' : res.risk === 'Medium' ? 'neutral' : res.churn ? 'alert' : 'success';
    var color = tone === 'alert' ? '#DC5555' : tone === 'success' ? '#28A879' : '#8b97a3';
    var statusCls = res.churn === null ? '' : res.churn ? 'status-churn' : 'status-stay';
    var recs = res.recommendations.length
      ? '<ol>' + res.recommendations.map(function (t) { return '<li>' + R.icon('checkCircle', 16) + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ol>'
      : '<p class="muted">The backend did not return recommendations for this customer.</p>';
    return (
      (res.isDemo ? '<div class="demo-note">' + R.icon('flask', 14) + ' Demo estimate from a simple heuristic — not a model prediction.</div>' : '') +
      '<div class="result-pad">' + ring(res.probability, color) +
      '<dl class="facts">' +
      '<div><dt>Predicted status</dt><dd class="' + statusCls + '">' + esc(res.statusLabel || '—') + '</dd></div>' +
      '<div><dt>Risk category</dt><dd>' + ui.riskBadge(res.risk) + '</dd></div>' +
      '<div><dt>Customer segment</dt><dd>' + esc(res.segment || '—') + '</dd></div></dl>' +
      '<div class="recs"><h4>Retention recommendations</h4>' + recs + '</div></div>'
    );
  }

  R.pages.predict = {
    mount: function (view) {
      var values = F.emptyValues();
      var errors = {};
      var touched = {};
      var run = { status: 'idle' };
      var root = document.createElement('div');
      view.innerHTML = '';
      view.appendChild(root);

      function draw() {
        var groups = F.GROUPS.map(function (g) {
          return ui.card(
            ui.cardHead(g.title, g.description),
            ui.cardBody(
              '<div class="form-grid">' +
                g.fields.map(function (f) {
                  return ui.field({ id: 'f-' + f.name, name: f.name, label: f.label, unit: f.unit, hint: f.hint, error: errors[f.name], control: controlHtml(f, values[f.name], !!errors[f.name]) });
                }).join('') + '</div>'
            )
          );
        }).join('');

        var actions =
          '<button type="button" class="btn btn-secondary" data-action="sample">' + R.icon('pencil', 15) + ' Fill sample customer</button>' +
          '<button type="button" class="btn btn-secondary" data-action="reset">' + R.icon('reset', 15) + ' Reset</button>';

        root.innerHTML =
          ui.pageHeader('Churn Prediction', "Enter a customer's profile to estimate their probability of churning, see their risk category and get retention recommendations.", actions) +
          '<div class="predict-layout"><form id="predict-form" novalidate class="stack">' + groups +
          '<div><button type="submit" class="btn btn-primary btn-lg" id="predict-btn">' + R.icon('crosshair', 18) + ' Predict Churn</button>' +
          '<p class="form-summary" id="form-summary" role="alert" hidden></p></div></form>' +
          '<div class="predict-side"><div class="card">' + ui.cardHead('Prediction', 'Model output for the customer entered') + '<div id="result"></div></div></div></div>';
        renderResult();
        updateSummary();
        setBusy(run.status === 'loading');
      }

      function renderResult() {
        var el = root.querySelector('#result');
        if (!el) return;
        if (run.status === 'idle') {
          el.innerHTML = ui.empty({ compact: true, icon: 'crosshair', title: 'No prediction yet', description: 'Complete the form and select Predict Churn to see the result here.' });
        } else if (run.status === 'loading') {
          el.innerHTML = '<div class="state" style="min-height:260px" role="status" aria-live="polite"><span class="spinner"></span><p>Scoring customer…</p></div>';
        } else if (run.status === 'error') {
          el.innerHTML = '<div style="padding:16px">' + ui.error(run.error, { compact: true }) + '</div>';
          ui.wireError(el, submit);
        } else {
          el.innerHTML = resultHtml(run.result);
        }
      }

      function setBusy(busy) {
        var b = root.querySelector('#predict-btn');
        if (!b) return;
        b.disabled = busy;
        b.innerHTML = busy ? '<span class="spinner sm"></span> Predicting…' : R.icon('crosshair', 18) + ' Predict Churn';
      }

      function updateSummary() {
        var el = root.querySelector('#form-summary');
        if (!el) return;
        var count = Object.keys(errors).filter(function (k) { return errors[k]; }).length;
        el.hidden = !count;
        el.textContent = count ? 'Please fix ' + count + (count === 1 ? ' field' : ' fields') + ' before predicting.' : '';
      }

      function showFieldState(name) {
        var f = BY_NAME[name];
        var err = errors[name] || '';
        var wrap = root.querySelector('[data-field="' + name + '"]');
        if (!wrap) return;
        Array.prototype.forEach.call(wrap.querySelectorAll('.input, .select'), function (el) {
          el.classList.toggle('invalid', !!err);
          if (err) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
        });
        var msg = wrap.querySelector('.field-msg');
        var text = err || f.hint || '';
        msg.textContent = text;
        msg.hidden = !text;
        msg.classList.toggle('error', !!err);
        if (err) msg.setAttribute('role', 'alert'); else msg.removeAttribute('role');
      }

      function onValue(target) {
        var name = target.getAttribute('data-name');
        if (!name) return;
        var f = BY_NAME[name];
        var wrap = target.closest('[data-field]');
        values[name] = target.value;
        if (f.type === 'slider' && wrap) {
          var range = wrap.querySelector('input[type="range"]');
          var num = wrap.querySelector('input[type="number"]');
          if (target === range) {
            num.value = range.value;
            values[name] = range.value;
          } else {
            var n = target.value === '' ? NaN : Number(target.value);
            range.value = isFinite(n) ? Math.min(f.max, Math.max(f.min, n)) : f.min;
          }
          range.style.setProperty('--fill', ui.sliderPct(values[name], f.min, f.max).toFixed(2) + '%');
        }
        if (f.type === 'select') target.classList.remove('placeholder');
        if (touched[name] || errors[name]) {
          errors[name] = F.validateField(f, values[name]);
          showFieldState(name);
          updateSummary();
        }
      }

      function submit() {
        var errs = F.validateAll(values);
        var names = Object.keys(errs);
        if (names.length) {
          errors = errs;
          F.ALL_FIELDS.forEach(function (f) { touched[f.name] = true; showFieldState(f.name); });
          updateSummary();
          var first = F.ALL_FIELDS.filter(function (f) { return errs[f.name]; })[0];
          var el = root.querySelector('#f-' + first.name);
          if (el) el.focus();
          return;
        }
        run = { status: 'loading' };
        renderResult();
        setBusy(true);
        R.api.predictChurn(F.buildPayload(values)).then(
          function (result) {
            if (!root.isConnected) return;
            run = { status: 'done', result: result };
            renderResult();
            setBusy(false);
          },
          function (error) {
            if (!root.isConnected) return;
            run = { status: 'error', error: error };
            renderResult();
            setBusy(false);
          }
        );
      }

      root.addEventListener('input', function (e) { onValue(e.target); });
      root.addEventListener('change', function (e) { onValue(e.target); });
      root.addEventListener('focusout', function (e) {
        var name = e.target.getAttribute && e.target.getAttribute('data-name');
        if (!name) return;
        touched[name] = true;
        errors[name] = F.validateField(BY_NAME[name], values[name]);
        showFieldState(name);
        updateSummary();
      });
      root.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
      ui.bindActions(root, {
        sample: function () { values = Object.assign({}, F.SAMPLE_VALUES); errors = {}; touched = {}; draw(); },
        reset: function () { values = F.emptyValues(); errors = {}; touched = {}; run = { status: 'idle' }; draw(); },
      });

      draw();
    },
  };
})(window.RETAIN);

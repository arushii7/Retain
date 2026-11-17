/**
 * RETAIN API service.
 * All data is fetched live from the FastAPI backend (RETAIN_CONFIG.API_URL).
 * Demo mode has been removed: there is no synthetic fallback data.
 * Responses are normalised into camelCase view-models so pages don't depend on exact backend key names.
 */
(function (R) {
  'use strict';

  var cfg = window.RETAIN_CONFIG || {};
  R.API_URL = String(cfg.API_URL || '').replace(/\/+$/, '');
  R.SAME_ORIGIN = !R.API_URL;
  R.DEMO_ENABLED = false;

  function endpoint(path) {
    return R.API_URL ? R.API_URL + path : path; // empty API_URL -> same origin as the page
  }

  /* ---------------- Connection status store ---------------- */
  var state = { mode: 'live', status: 'idle' }; // status: idle | ok | error
  var listeners = [];
  function emit(prev) {
    listeners.slice().forEach(function (fn) { fn(state, prev); });
  }

  R.mode = {
    get: function () { return state; },
    subscribe: function (fn) { listeners.push(fn); },
    set: function () { /* demo mode removed */ },
    setStatus: function (status) {
      if (state.status === status) return;
      var prev = state;
      state = { mode: 'live', status: status };
      emit(prev);
    },
  };

  /* ---------------- Errors ---------------- */
  function ApiError(message, opts) {
    this.name = 'ApiError';
    this.message = message;
    opts = opts || {};
    this.kind = opts.kind || 'unknown'; // config | network | timeout | http | validation | invalid
    this.status = opts.status;
  }
  ApiError.prototype = Object.create(Error.prototype);
  R.ApiError = ApiError;

  function detailMessage(data, status) {
    var detail = data && (data.detail !== undefined ? data.detail : data.message);
    if (Array.isArray(detail)) {
      detail = detail.map(function (d) {
        var loc = (d.loc || []).filter(function (x) { return x !== 'body'; }).join('.');
        return (loc ? loc + ': ' : '') + d.msg;
      }).join('; ');
    }
    return typeof detail === 'string' && detail ? detail : 'The server responded with status ' + status + '.';
  }

  /* ---------------- Transport ---------------- */
  function request(path, opts) {
    opts = opts || {};
    if (R.SAME_ORIGIN && window.location.protocol === 'file:') {
      R.mode.setStatus('error');
      return Promise.reject(new ApiError('This page was opened from a file. Serve it from the backend at http://localhost:8000 or set API_URL in js/config.js.', { kind: 'config' }));
    }

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 30000) : null;
    var headers = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    var pending;
    try {
      pending = fetch(endpoint(path), {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller ? controller.signal : undefined,
      });
    } catch (e) {
      pending = Promise.reject(e); // e.g. fetch unavailable -> same handling as a network failure
    }

    return pending
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        R.mode.setStatus('error');
        if (err && err.name === 'AbortError') {
          throw new ApiError('The request timed out before the backend responded.', { kind: 'timeout' });
        }
        throw new ApiError('Could not reach the backend' + (R.API_URL ? ' at ' + R.API_URL : '') + '.', { kind: 'network' });
      })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!res.ok) {
            R.mode.setStatus('ok');
            throw new ApiError(detailMessage(data, res.status), { kind: res.status === 422 ? 'validation' : 'http', status: res.status });
          }
          if (data === null || typeof data !== 'object') {
            R.mode.setStatus('error');
            throw new ApiError('The backend returned a response that is not valid JSON.', { kind: 'invalid' });
          }
          R.mode.setStatus('ok');
          return data;
        });
      });
  }

  /* ---------------- Normalisers ---------------- */
  function list(v) { return Array.isArray(v) ? v : []; }
  function text(v) { return v === null || v === undefined || v === '' ? null : String(v); }
  function pick() {
    for (var i = 0; i < arguments.length; i++) if (arguments[i] !== undefined && arguments[i] !== null) return arguments[i];
    return undefined;
  }

  function normalizeMetrics(m) {
    m = m || {};
    return {
      accuracy: R.normalizeRate(m.accuracy),
      precision: R.normalizeRate(m.precision),
      recall: R.normalizeRate(m.recall),
      f1: R.normalizeRate(pick(m.f1_score, m.f1, m.f1Score)),
    };
  }

  function segmentLabel(c) {
    var named = text(pick(c.segment, c.customer_segment, c.cluster_name));
    if (named) return named;
    var id = pick(c.cluster_id, c.cluster, c.Cluster);
    return id === undefined ? null : 'Cluster ' + id;
  }

  function splitRecommendations(recs) {
    if (typeof recs === 'string') {
      return recs.split(/(?<=\.)\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return list(recs)
      .map(function (r) {
        return typeof r === 'string' ? r : r ? text(pick(r.text, r.action, r.recommendation)) : null;
      })
      .filter(Boolean);
  }

  function normalizePrediction(d) {
    var probability = R.normalizeRate(pick(d.churn_probability, d.probability, d.churn_prob));
    var raw = pick(d.churn_prediction, d.predicted_churn, d.prediction, d.churn_status);
    var churn = null;
    if (typeof raw === 'string') churn = !/^(no|not|0|false|stay|retain|will not)/i.test(raw.trim());
    else if (raw !== undefined) churn = Boolean(Number(raw));
    else if (probability !== null) churn = probability >= 0.5;

    var recs = pick(d.recommendations, d.retention_recommendations, d.retention_recommendation, d.recommendation, []);
    return {
      probability: probability,
      churn: churn,
      statusLabel:
        typeof d.churn_status === 'string' && d.churn_status ? d.churn_status : churn === null ? null : churn ? 'Likely to churn' : 'Likely to stay',
      risk: R.normalizeRisk(pick(d.risk_category, d.risk)),
      segment: segmentLabel(d),
      recommendations: splitRecommendations(recs),
      isDemo: false,
    };
  }

  function normalizeModels(d) {
    var models = pick(d.models, d.results, Array.isArray(d) ? d : null);
    if (!models) {
      // allow an object keyed by model name: { "Random Forest": { accuracy: … } }
      models = Object.keys(d)
        .filter(function (k) { return d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]); })
        .map(function (k) { return Object.assign({ name: k }, d[k]); });
    }
    var rows = list(models).map(function (m) {
      return Object.assign({ name: text(pick(m.name, m.model)) || 'Unknown' }, normalizeMetrics(m));
    });
    var best = text(pick(d.best_model, d.leading_model));
    if (!best && rows.length) {
      best = rows.reduce(function (a, b) { return (b.f1 === null ? -1 : b.f1) > (a.f1 === null ? -1 : a.f1) ? b : a; }).name;
    }
    return { models: rows, bestModel: best };
  }

  /* ---------------- Public API ---------------- */
  R.api = {
    getHealth: function () {
      return request('/api/health', {});
    },
    predictChurn: function (features) {
      return request('/api/predict', { method: 'POST', body: features }).then(normalizePrediction);
    },
    getModelPerformance: function () {
      return request('/api/model-performance', {}).then(normalizeModels);
    },
  };
})(window.RETAIN);

/**
 * RETAIN configuration.
 *
 * Leave API_URL empty to call the FastAPI backend on the same origin that served this page
 * (the recommended setup: open http://localhost:8000). Set it to e.g. 'http://localhost:8000'
 * only if you host the frontend separately from the backend.
 */
window.RETAIN_CONFIG = {
  API_URL: '',

  // Demo mode is disabled: every result comes from the saved models via the live API.
  ENABLE_DEMO_MODE: false,
};

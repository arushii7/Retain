# RETAIN backend (FastAPI)

Serves the two-page RETAIN frontend from the saved notebook artifacts. Nothing is retrained.

## Run

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open <http://localhost:8000>. The frontend is served from the sibling `frontend/` folder.

## Endpoints

| Method | Path | Depends on | Returns |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Readiness, loaded files, versions and any problems |
| POST | `/api/predict` | churn + segmentation joblib | Probability, status, risk, segment, recommendations |
| GET | `/api/model-performance` | performance joblib | Metrics for the four models + leading model |

`POST /api/predict` takes the 18 **original** features (unscaled, not one-hot encoded); the saved pipelines do the
preprocessing. Category values the model never saw (e.g. `Gender: "Robot"`) are rejected with a 422.

## Artifacts

Required:

- `retain_churn_model.joblib`
- `retain_segmentation_model.joblib`
- `retain_model_performance.joblib`

Optional:

- `retain_customer_analysis.csv` — only used for cluster display names. It never blocks start-up or predictions, and no
  specific columns (including `Churn`) are required.

## Logic preserved from the notebook

- Churn decision threshold: probability `>= 0.5`.
- Risk: `Low < 0.30 <= Medium < 0.60 <= High`.
- Recommendations: the notebook's `generate_recommendation()` rules, returned as a list.
- Segment for a new customer: the saved `cluster_preprocessor` then `kmeans_model.predict`.
- Leading model: highest saved F1-score (Random Forest for the supplied artifact).

## Settings (environment variables, all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `RETAIN_ARTIFACT_DIR` | `./artifacts` | Where the model files live |
| `RETAIN_CORS_ORIGINS` | `*` | Allowed browser origins |
| `RETAIN_FRONTEND_DIR` | `../frontend` | Folder served at `/` |
| `RETAIN_CLUSTER_NAMES` | auto | JSON map of cluster id to display name |

## Check it

With the server running:

```powershell
python smoke_test.py
```

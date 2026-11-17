# RETAIN

RETAIN is an e-commerce customer churn prediction and retention analytics app.
It has exactly two pages:

- **Churn Prediction** — the 18 original customer features, scored by the saved Random Forest pipeline.
- **Model Performance** — accuracy, precision, recall and F1 for the four trained models, read from the saved metrics.

## Run it

From the project root:

```powershell
cd backend
uvicorn main:app --reload --port 8000
```

Then open <http://localhost:8000>.

The backend serves the frontend and the API from the same origin, so there is nothing else to configure.
If the packages are not installed yet:

```powershell
cd backend
pip install -r requirements.txt
```

## Structure

```
RETAIN/
  frontend/
    index.html
    css/styles.css
    js/                 config, API client, UI components and the two pages
  backend/
    main.py             FastAPI routes; serves the frontend
    retain_service.py   loads the saved artifacts and serves predictions / metrics
    schemas.py          validation for the 18 customer features
    requirements.txt
    smoke_test.py       quick API check (python smoke_test.py)
    artifacts/
      retain_churn_model.joblib
      retain_segmentation_model.joblib
      retain_model_performance.joblib
      retain_customer_analysis.csv   (optional)
  notebooks/
    AIML_ProjectM2.ipynb               original notebook, unchanged
```

## Notes

- Models are **not** retrained and the ML pipeline is unchanged. All numbers come from the saved `.joblib` artifacts.
- The historical CSV is optional. It is only used to give the KMeans clusters friendlier display names; it never blocks
  predictions, the model-performance page or start-up.
- Demo mode is disabled. Every result is produced by the live backend.
- Check `http://localhost:8000/api/health` for artifact status and `http://localhost:8000/docs` for the API docs.

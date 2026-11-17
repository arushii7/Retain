"""
RETAIN API — FastAPI service for the RETAIN frontend.

Run (from this folder):
    uvicorn main:app --reload --port 8000

Environment variables (all optional):
    RETAIN_ARTIFACT_DIR    folder holding the model artifacts            (default: ./artifacts)
    RETAIN_CORS_ORIGINS    comma-separated allowed origins, or *         (default: *)
    RETAIN_FRONTEND_DIR    folder with the frontend's index.html to serve (default: ../frontend, skipped if missing)
    RETAIN_CLUSTER_NAMES   JSON mapping cluster id -> name, e.g. {"0":"Newer","1":"Established"}
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from retain_service import FeatureValueError, RetainService
from schemas import CustomerFeatures, PredictionResponse

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s: %(message)s")
log = logging.getLogger("retain")

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = Path(os.getenv("RETAIN_ARTIFACT_DIR", BASE_DIR / "artifacts"))
FRONTEND_DIR = Path(os.getenv("RETAIN_FRONTEND_DIR", BASE_DIR.parent / "frontend"))
CORS_ORIGINS = [o.strip() for o in os.getenv("RETAIN_CORS_ORIGINS", "*").split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.service = RetainService(ARTIFACT_DIR)  # loads the notebook's artifacts once
    yield


app = FastAPI(title="RETAIN API", version="1.0.0", description="Churn prediction and model performance.", lifespan=lifespan)

# No cookies/credentials are used, so a wildcard origin is safe for local development.
# For production set RETAIN_CORS_ORIGINS to your real frontend origin(s).
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


def get_service(request: Request) -> RetainService:
    return request.app.state.service


# Plain `def` endpoints: FastAPI runs them in a thread pool, so CPU-bound sklearn calls don't block the event loop.
@app.get("/api/health", tags=["system"])
def health(request: Request):
    """Always available. Shows which artifacts loaded and why not if they didn't."""
    return request.app.state.service.health()


@app.post("/api/predict", response_model=PredictionResponse, tags=["prediction"])
def predict(features: CustomerFeatures, service: RetainService = Depends(get_service)):
    if not service.prediction_ready:
        raise HTTPException(
            status_code=503,
            detail="Prediction model is not ready: " + " | ".join(service.problems) + " — see GET /api/health.",
        )
    try:
        return service.predict(features.model_dump())
    except FeatureValueError as exc:
        raise HTTPException(status_code=422, detail=exc.problems) from exc
    except Exception as exc:  # noqa: BLE001
        log.exception("Prediction failed")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {type(exc).__name__}: {exc}") from exc


@app.get("/api/model-performance", tags=["analytics"])
def model_performance(service: RetainService = Depends(get_service)):
    if not service.performance_ready:
        raise HTTPException(
            status_code=503,
            detail="Model performance metrics are not ready: " + " | ".join(service.performance_problems) + " — see GET /api/health.",
        )
    return service.model_performance()


# Serve the frontend from the same origin (http://localhost:8000) if it sits next to this folder.
# Mounted LAST so it never shadows the /api routes.
if FRONTEND_DIR.is_dir() and (FRONTEND_DIR / "index.html").exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
    log.info("Serving frontend from %s", FRONTEND_DIR)

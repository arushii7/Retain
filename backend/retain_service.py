"""
RETAIN model service.

Loads the artifacts exported by the project notebook ONCE at start-up. Nothing is trained or invented here:
every prediction and every metric comes from the saved model files.

Required for predictions:
  retain_churn_model.joblib         {'model': Pipeline, 'input_features': [...], 'model_name': 'Random Forest'}
  retain_segmentation_model.joblib  {'model': KMeans, 'preprocessor': ColumnTransformer, 'input_features': [...], 'n_clusters': k}

Required for the Model Performance page:
  retain_model_performance.joblib   {'Logistic Regression': {accuracy, precision, recall, f1_score}, ...}

Optional:
  retain_customer_analysis.csv      only used to give the KMeans clusters friendlier display names.
                                    It is never required, never validated for specific columns, and its absence
                                    does not stop the API from starting or from serving predictions.
"""
from __future__ import annotations

import json
import logging
import math
import os
import warnings
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

log = logging.getLogger("retain")

CHURN_MODEL_FILE = "retain_churn_model.joblib"
SEGMENTATION_MODEL_FILE = "retain_segmentation_model.joblib"
PERFORMANCE_FILE = "retain_model_performance.joblib"
ANALYSIS_FILE = "retain_customer_analysis.csv"

# Identical to the notebook: Low < 0.30 <= Medium < 0.60 <= High, and Predicted_Churn = probability >= 0.5
LOW_MAX = 0.30
MEDIUM_MAX = 0.60
DECISION_THRESHOLD = 0.5


# --------------------------------------------------------------------------- helpers
def clean_number(value: Any, digits: int | None = None) -> float | None:
    """JSON cannot carry NaN/Infinity, so turn them (and anything non-numeric) into None."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return round(f, digits) if digits is not None else f


def assign_risk(probability: float) -> str:
    """Same rule as the notebook's assign_risk()."""
    if probability < LOW_MAX:
        return "Low"
    if probability < MEDIUM_MAX:
        return "Medium"
    return "High"


def generate_recommendations(row: dict[str, Any]) -> list[str]:
    """
    Port of the notebook's generate_recommendation(), returning a list instead of one joined string.
    `row` needs: Churn_Probability, Complain, SatisfactionScore, DaySinceLastOrder, OrderCount, Tenure, Cluster.
    """
    if row["Churn_Probability"] < LOW_MAX:
        return ["Maintain engagement through loyalty rewards."]

    recs: list[str] = []
    if row["Complain"] == 1:
        recs.append("Prioritise customer support and complaint resolution.")
    if row["SatisfactionScore"] <= 2:
        recs.append("Offer personalised service recovery.")
    if row["DaySinceLastOrder"] >= 7:
        recs.append("Launch a personalised re-engagement campaign.")
    if row["OrderCount"] <= 2:
        recs.append("Offer a first-time or repeat-purchase incentive.")
    if row["Tenure"] <= 2:
        recs.append("Introduce an early customer onboarding campaign.")
    if row["Cluster"] == 1:
        recs.append("Consider a loyalty reward for this established customer.")
    if not recs:
        recs.append("Send personalised product recommendations and monitor engagement.")
    return recs


class FeatureValueError(Exception):
    """Raised when a categorical value was never seen by the model. `problems` is a FastAPI-style 422 detail list."""

    def __init__(self, problems: list[dict[str, Any]]):
        super().__init__("; ".join(p["msg"] for p in problems))
        self.problems = problems


# --------------------------------------------------------------------------- service
class RetainService:
    def __init__(self, artifact_dir: Path):
        self.artifact_dir = Path(artifact_dir)

        # Problems are split so each feature only depends on the artifacts it actually needs.
        self.problems: list[str] = []              # blocks predictions (churn + segmentation)
        self.performance_problems: list[str] = []  # blocks the model-performance page only
        self.warnings: list[str] = []              # non-fatal notes (optional CSV, version hints, …)

        self.model = None
        self.input_features: list[str] = []
        self.model_name = "Random Forest"
        self.categories: dict[str, list[str]] = {}

        self.kmeans = None
        self.cluster_preprocessor = None
        self.n_clusters: int | None = None

        self.performance: dict[str, dict[str, float]] = {}

        self.analysis: pd.DataFrame | None = None   # optional; used only for cluster display names
        self.cluster_names: dict[int, str] = {}

        self._load()

    # ------------------------------------------------------------------ readiness
    @property
    def prediction_ready(self) -> bool:
        return not self.problems

    @property
    def performance_ready(self) -> bool:
        return not self.performance_problems

    @property
    def ready(self) -> bool:
        """Overall readiness: both active pages can be served."""
        return self.prediction_ready and self.performance_ready

    # ------------------------------------------------------------------ loading
    def _load_joblib(self, filename: str, problems: list[str]) -> Any | None:
        path = self.artifact_dir / filename
        if not path.exists():
            problems.append(f"Missing file: {filename} (expected in {self.artifact_dir.resolve()})")
            return None
        try:
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                obj = joblib.load(path)
            for w in caught:
                self.warnings.append(f"{filename}: {w.message}")
            return obj
        except Exception as exc:  # noqa: BLE001 - surface any unpickling problem to the operator
            problems.append(
                f"Could not load {filename}: {type(exc).__name__}: {exc}. "
                "This usually means scikit-learn/pandas versions differ from the notebook; install the versions in requirements.txt."
            )
            return None

    def _load(self) -> None:
        churn = self._load_joblib(CHURN_MODEL_FILE, self.problems)
        seg = self._load_joblib(SEGMENTATION_MODEL_FILE, self.problems)
        perf = self._load_joblib(PERFORMANCE_FILE, self.performance_problems)

        if churn is not None:
            try:
                self.model = churn["model"]
                self.input_features = list(churn["input_features"])
                self.model_name = str(churn.get("model_name", self.model_name))
                self._read_categories()
            except Exception as exc:  # noqa: BLE001
                self.problems.append(f"{CHURN_MODEL_FILE} does not look like the notebook's artifact: {exc!r}")

        if seg is not None:
            try:
                self.kmeans = seg["model"]
                self.cluster_preprocessor = seg["preprocessor"]
                self.n_clusters = int(seg.get("n_clusters", getattr(self.kmeans, "n_clusters", 0)))
            except Exception as exc:  # noqa: BLE001
                self.problems.append(f"{SEGMENTATION_MODEL_FILE} does not look like the notebook's artifact: {exc!r}")

        if perf is not None:
            try:
                self.performance = {
                    str(name): {k: float(m[k]) for k in ("accuracy", "precision", "recall", "f1_score")} for name, m in perf.items()
                }
            except Exception as exc:  # noqa: BLE001
                self.performance_problems.append(f"{PERFORMANCE_FILE} does not look like the notebook's artifact: {exc!r}")

        # The historical CSV is optional. It never blocks predictions or model performance.
        self._load_analysis_optional()
        if self.analysis is not None:
            self._name_clusters()

        if self.ready:
            log.info(
                "RETAIN service ready: prediction model=%s, clusters=%s, performance models=%s",
                self.model_name, self.n_clusters, sorted(self.performance),
            )
        else:
            for p in self.problems + self.performance_problems:
                log.error("RETAIN not ready: %s", p)

    def _load_analysis_optional(self) -> None:
        """Best-effort load of the optional historical CSV; used only for cluster display names."""
        path = self.artifact_dir / ANALYSIS_FILE
        if not path.exists():
            self.warnings.append(
                f"Optional file {ANALYSIS_FILE} is not present; cluster display names will use the default labels."
            )
            return
        try:
            df = pd.read_csv(path)
        except Exception as exc:  # noqa: BLE001 - optional data must never be fatal
            self.warnings.append(f"Optional file {ANALYSIS_FILE} could not be read ({exc!r}); using default cluster labels.")
            return

        if "Cluster" not in df.columns:
            self.warnings.append(
                f"Optional file {ANALYSIS_FILE} has no 'Cluster' column; using default cluster labels."
            )
            return
        self.analysis = df

    def _read_categories(self) -> None:
        """Remember which category values the model was trained on, so unseen values can be rejected instead of silently ignored."""
        try:
            pre = self.model.named_steps["preprocessor"]
            for name, transformer, cols in pre.transformers_:
                if name == "cat":
                    encoder = transformer.named_steps["encoder"]
                    self.categories = {c: [str(x) for x in cats] for c, cats in zip(cols, encoder.categories_)}
        except Exception as exc:  # noqa: BLE001
            self.warnings.append(f"Could not read categorical options from the model ({exc!r}); category values will not be validated.")

    def _name_clusters(self) -> None:
        """
        Friendly segment names. Override with RETAIN_CLUSTER_NAMES='{"0":"…","1":"…"}'.
        Otherwise, for the notebook's 2-cluster result, the higher-tenure cluster is 'Established Customers' and the other
        'Newer Customers' (decided from the data, not from the cluster number). Anything else is labelled 'Cluster N'.
        """
        if self.analysis is None or "Tenure" not in self.analysis.columns:
            return

        try:
            ids = sorted(int(c) for c in self.analysis["Cluster"].unique())
        except Exception:  # noqa: BLE001 - optional convenience only
            return
        names = {c: f"Cluster {c}" for c in ids}

        override = os.getenv("RETAIN_CLUSTER_NAMES")
        if override:
            try:
                names.update({int(k): str(v) for k, v in json.loads(override).items()})
            except (ValueError, AttributeError) as exc:
                self.warnings.append(f"RETAIN_CLUSTER_NAMES ignored (invalid JSON: {exc})")
        elif len(ids) == 2:
            try:
                tenure = self.analysis.groupby("Cluster")["Tenure"].mean()
                hi, lo = int(tenure.idxmax()), int(tenure.idxmin())
            except Exception:  # noqa: BLE001 - optional convenience only
                return
            # Only name them if the tenure gap is clear (the notebook's clusters: ~16 vs ~7 months); otherwise keep "Cluster N".
            if hi != lo and tenure[lo] > 0 and tenure[hi] / tenure[lo] >= 1.5:
                names[hi], names[lo] = "Established Customers", "Newer Customers"
        self.cluster_names = names

    def segment_name(self, cluster_id: int) -> str:
        return self.cluster_names.get(int(cluster_id), f"Cluster {int(cluster_id)}")

    # ------------------------------------------------------------------ model performance
    def best_model(self) -> str | None:
        """Leading model = highest F1-score in the exported performance table (Random Forest for the saved artifact)."""
        if not self.performance:
            return None
        return max(self.performance.items(), key=lambda kv: kv[1]["f1_score"])[0]

    def model_performance(self) -> dict[str, Any]:
        return {
            "best_model": self.best_model(),
            "models": [{"name": name, **metrics} for name, metrics in self.performance.items()],
        }

    # ------------------------------------------------------------------ prediction
    def _check_categories(self, features: dict[str, Any]) -> None:
        problems = []
        for column, allowed in self.categories.items():
            value = str(features.get(column))
            if value not in allowed:
                problems.append(
                    {"loc": ["body", column], "msg": f"'{value}' is not a value the model was trained on. Allowed: {', '.join(allowed)}", "type": "value_error"}
                )
        if problems:
            raise FeatureValueError(problems)

    def predict(self, features: dict[str, Any]) -> dict[str, Any]:
        """`features` are the 18 ORIGINAL customer columns; the saved pipelines do all scaling/encoding."""
        self._check_categories(features)

        frame = pd.DataFrame([{c: features[c] for c in self.input_features}], columns=self.input_features)

        probability = float(self.model.predict_proba(frame)[0][1])
        cluster = int(self.kmeans.predict(self.cluster_preprocessor.transform(frame))[0])
        churn = probability >= DECISION_THRESHOLD

        recs = generate_recommendations({**features, "Churn_Probability": probability, "Cluster": cluster})

        return {
            "churn_probability": round(probability, 4),
            "churn_prediction": int(churn),
            "churn_status": "Likely to churn" if churn else "Likely to stay",
            "risk_category": assign_risk(probability),
            "customer_segment": self.segment_name(cluster),
            "cluster_id": cluster,
            "recommendations": recs,
        }

    # ------------------------------------------------------------------ health
    def health(self) -> dict[str, Any]:
        import sklearn

        return {
            "status": "ok" if self.ready else ("degraded" if self.prediction_ready or self.performance_ready else "unavailable"),
            "ready": self.ready,
            "prediction_ready": self.prediction_ready,
            "performance_ready": self.performance_ready,
            "problems": self.problems,
            "performance_problems": self.performance_problems,
            "warnings": self.warnings,
            "artifact_dir": str(self.artifact_dir.resolve()),
            "files": {
                name: (self.artifact_dir / name).exists()
                for name in (CHURN_MODEL_FILE, SEGMENTATION_MODEL_FILE, PERFORMANCE_FILE, ANALYSIS_FILE)
            },
            "optional_csv_loaded": self.analysis is not None,
            "clusters": self.n_clusters,
            "leading_model": self.best_model(),
            "prediction_model": self.model_name,
            "scikit_learn": sklearn.__version__,
            "pandas": pd.__version__,
        }

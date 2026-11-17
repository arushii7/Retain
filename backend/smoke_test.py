"""
Quick check that the running RETAIN API works. No extra packages needed.

    python smoke_test.py                      # tests http://localhost:8000
    python smoke_test.py http://localhost:8000
"""
import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")

SAMPLE_CUSTOMER = {
    "Tenure": 4, "CityTier": 3, "WarehouseToHome": 24, "PreferredLoginDevice": "Mobile Phone",
    "PreferredPaymentMode": "Cash on Delivery", "Gender": "Female", "PreferedOrderCat": "Fashion",
    "MaritalStatus": "Single", "HourSpendOnApp": 2, "NumberOfDeviceRegistered": 4, "SatisfactionScore": 2,
    "NumberOfAddress": 5, "Complain": 1, "OrderAmountHikeFromlastYear": 14, "CouponUsed": 1, "OrderCount": 2,
    "DaySinceLastOrder": 18, "CashbackAmount": 120,
}


def call(path, body=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"} if body is not None else {},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read() or b"{}")
    except urllib.error.URLError as err:
        sys.exit(f"Cannot reach {BASE} ({err.reason}). Is the server running? Start it with: uvicorn main:app --port 8000")


failed = 0


def show(label, ok, detail=""):
    global failed
    failed += 0 if ok else 1
    print(f"  {'PASS' if ok else 'FAIL'}  {label} {detail}")


status, health = call("/api/health")
show("health", status == 200 and health.get("ready"), f"-> prediction_ready={health.get('prediction_ready')}, performance_ready={health.get('performance_ready')}, leading={health.get('leading_model')}")
if not health.get("ready"):
    print("\nThe API is up but not all artifacts loaded:")
    for p in health.get("problems", []) + health.get("performance_problems", []):
        print("  -", p)
    sys.exit(1)
for w in health.get("warnings", []):
    print("  note:", w)

status, p = call("/api/predict", SAMPLE_CUSTOMER)
show(
    "predict",
    status == 200 and all(k in p for k in ("churn_probability", "churn_prediction", "risk_category", "customer_segment", "recommendations")),
    f"-> {p.get('churn_probability')} / {p.get('churn_status')} / {p.get('risk_category')} / {p.get('customer_segment')}",
)

status, m = call("/api/model-performance")
names = [row.get("name") for row in m.get("models", [])]
show(
    "model-performance",
    status == 200 and len(names) == 4,
    f"-> {names}, leading model: {m.get('best_model')}",
)

status, bad = call("/api/predict", {**SAMPLE_CUSTOMER, "Gender": "Robot"})
show("rejects unseen category", status == 422)

print("\nAll good." if not failed else f"\n{failed} check(s) failed.")
sys.exit(1 if failed else 0)

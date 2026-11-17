"""Request/response models. Field names are the ORIGINAL dataset column names (the frontend sends them unchanged)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class CustomerFeatures(BaseModel):
    """The 18 original customer features. Ranges are sanity limits only; the model decides the actual risk."""

    model_config = ConfigDict(extra="forbid")

    Tenure: float = Field(ge=0, le=1000, allow_inf_nan=False, description="Months with the company")
    CityTier: int = Field(ge=1, le=3)
    WarehouseToHome: float = Field(ge=0, le=10000, allow_inf_nan=False, description="Distance, km")
    PreferredLoginDevice: str = Field(min_length=1)
    PreferredPaymentMode: str = Field(min_length=1)
    Gender: str = Field(min_length=1)
    PreferedOrderCat: str = Field(min_length=1)  # (sic) spelled as in the dataset
    MaritalStatus: str = Field(min_length=1)
    HourSpendOnApp: float = Field(ge=0, le=24, allow_inf_nan=False)
    NumberOfDeviceRegistered: int = Field(ge=0, le=100)
    SatisfactionScore: int = Field(ge=1, le=5)
    NumberOfAddress: int = Field(ge=0, le=1000)
    Complain: int = Field(ge=0, le=1)
    OrderAmountHikeFromlastYear: float = Field(ge=0, le=1000, allow_inf_nan=False)
    CouponUsed: int = Field(ge=0, le=1000)
    OrderCount: int = Field(ge=0, le=10000)
    DaySinceLastOrder: float = Field(ge=0, le=10000, allow_inf_nan=False)
    CashbackAmount: float = Field(ge=0, le=1_000_000, allow_inf_nan=False)


class PredictionResponse(BaseModel):
    churn_probability: float
    churn_prediction: int
    churn_status: str
    risk_category: str
    customer_segment: str
    cluster_id: int
    recommendations: list[str]

from app.services.adapters import (
    adapt_weather_api,
    adapt_earthquake_api,
    adapt_elevation_api,
    build_ml_input
)

import pandas as pd
from fastapi import APIRouter, HTTPException, Depends, status, Request
from typing import Dict, Any
from loguru import logger
import numpy as np
from datetime import datetime

from app.schemas.prediction import (
    PredictionRequest,
    PredictionResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    RiskLevel
)
from app.ml.registry.model_store import ModelRegistry
from app.core.config import settings

router = APIRouter()


def model_inference(model, scaler, features, input_dict):
    # Convert dict to DataFrame with all required columns
    X = pd.DataFrame([input_dict])
    
    # Align columns with model's trained feature order
    feature_cols = list(model.feature_names_in_)
    X = X[feature_cols]
    
    # Scale the data (produces numpy array)
    X_scaled = scaler.transform(X)
    
    # Reconstruct DataFrame with feature names to avoid warning
    X_scaled_df = pd.DataFrame(X_scaled, columns=feature_cols)
    
    # Predict with proper feature names
    return float(model.predict_proba(X_scaled_df)[0][1])


def calculate_confidence(probability):
    if probability >= 0.8 or probability <= 0.2:
        return "High"
    if probability >= 0.6 or probability <= 0.4:
        return "Medium"
    return "Low"


def get_model_registry(request: Request) -> ModelRegistry:
    return request.app.state.model_registry


# -----------------------------
# SINGLE PREDICTION
# -----------------------------
@router.post("/single", response_model=PredictionResponse)
async def predict_single(
    request: PredictionRequest,
    model_registry: ModelRegistry = Depends(get_model_registry)
):
    try:
        logger.info(f"Prediction request: {request.location_name}")

        # INPUT
        weather = request.weather
        earthquake = request.earthquake
        elevation = request.elevation

        # ADAPTERS
        weather_out = adapt_weather_api(weather)
        quake_out = adapt_earthquake_api(earthquake)
        terrain_out = adapt_elevation_api(elevation)

        # MODEL
        model = model_registry.get_model("landslide_model")
        scaler = model_registry.get_model("scaler")
        features = model_registry.get_model("features")

        if not model or not scaler or not features:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Model not available"
            )

        # BUILD INPUT
        ml_input = build_ml_input(features, weather_out, quake_out, terrain_out)
        print("ML INPUT:", ml_input)
        logger.debug(f"ML INPUT: {ml_input}")

        # PREDICT
        probability = model_inference(model, scaler, features, ml_input)

        # RISK LEVEL
        if probability >= 0.9:
            risk_level = RiskLevel.SEVERE
        elif probability >= 0.7:
            risk_level = RiskLevel.HIGH
        elif probability >= 0.4:
            risk_level = RiskLevel.MODERATE
        else:
            risk_level = RiskLevel.LOW

        confidence = calculate_confidence(probability)

        return PredictionResponse(
            location_name=request.location_name,
            latitude=request.latitude,
            longitude=request.longitude,
            probability=float(probability),
            risk_level=risk_level,
            confidence=confidence,
            feature_importance={},
            model_version=settings.MODEL_VERSION,
            timestamp=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# -----------------------------
# BATCH PREDICTION
# -----------------------------
@router.post("/batch", response_model=BatchPredictionResponse)
async def predict_batch(
    request: BatchPredictionRequest,
    model_registry: ModelRegistry = Depends(get_model_registry)
):
    try:
        predictions = []

        for location in request.locations:
            pred_request = PredictionRequest(
                location_name=location.location_name,
                latitude=location.latitude,
                longitude=location.longitude,
                weather=location.weather,
                earthquake=location.earthquake,
                elevation=location.elevation
            )

            result = await predict_single(pred_request, model_registry)
            predictions.append(result)

        return BatchPredictionResponse(
            predictions=predictions,
            total_locations=len(predictions),
            timestamp=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Batch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# RISK ZONE (SIMPLIFIED)
# -----------------------------

@router.get("/risk-zones", response_model=Dict[str, Any])
async def get_risk_zones(
    min_latitude: float,
    max_latitude: float,
    min_longitude: float,
    max_longitude: float,
    grid_size: int = 10,
    model_registry: ModelRegistry = Depends(get_model_registry)
):
    try:
        logger.info(f"Risk zone request: [{min_latitude}, {max_latitude}] x [{min_longitude}, {max_longitude}]")

        if grid_size > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Grid size too large (max: 50x50)"
            )

        lat_points = np.linspace(min_latitude, max_latitude, grid_size)
        lon_points = np.linspace(min_longitude, max_longitude, grid_size)

        model = model_registry.get_model("landslide_model")
        scaler = model_registry.get_model("scaler")
        features = model_registry.get_model("features")

        if not model:
            raise HTTPException(
                status_code=503,
                detail="Model not available"
            )

        risk_grid = []

        for lat in lat_points:
            row = []
            for lon in lon_points:

                # 🔥 Simulated API-like data (since real APIs not used here)
                weather = {
                    "main": {
                        "humidity": np.random.uniform(60, 95),
                        "pressure": np.random.uniform(980, 1020),
                        "temp": np.random.uniform(290, 305)
                    },
                    "rain": {
                        "1h": np.random.uniform(0, 20)
                    },
                    "wind": {
                        "speed": np.random.uniform(0, 15)
                    }
                }

                earthquake = {
                    "features": [
                        {
                            "properties": {"mag": np.random.uniform(3, 6)},
                            "geometry": {"coordinates": [lon, lat, 10]}
                        }
                    ]
                }

                elevation = [
                    np.random.uniform(500, 1500),
                    np.random.uniform(500, 1500)
                ]

                # 🔥 APPLY ADAPTERS
                weather_out = adapt_weather_api(weather)
                quake_out = adapt_earthquake_api(earthquake)
                terrain_out = adapt_elevation_api(elevation)

                # BUILD INPUT
                ml_input = build_ml_input(features, weather_out, quake_out, terrain_out)
                print("ML INPUT:", ml_input)
                logger.debug(f"ML INPUT: {ml_input}")

                # PREDICT
                prob = model_inference(model, scaler, features, ml_input)

                row.append({
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "probability": float(prob)
                })

            risk_grid.append(row)

        return {
            "grid": risk_grid,
            "grid_size": grid_size,
            "bounds": {
                "min_latitude": min_latitude,
                "max_latitude": max_latitude,
                "min_longitude": min_longitude,
                "max_longitude": max_longitude
            },
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Risk zone error: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

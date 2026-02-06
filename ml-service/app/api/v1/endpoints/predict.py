"""
Prediction endpoints for landslide risk assessment.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from typing import List, Dict, Any
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


def get_model_registry(request: Request) -> ModelRegistry:
    """Dependency to get model registry from app state."""
    return request.app.state.model_registry


@router.post("/single", response_model=PredictionResponse)
async def predict_single(
    request: PredictionRequest,
    model_registry: ModelRegistry = Depends(get_model_registry)
):
    """
    Predict landslide risk for a single location.
    
    Returns prediction with probability, risk level, and confidence.
    """
    try:
        logger.info(f"Single prediction request for location: {request.location_name}")
        
        # Prepare features
        features = np.array([request.features.model_dump().values()])
        
        # Get ensemble prediction
        ensemble_model = model_registry.get_model("ensemble")
        if not ensemble_model:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Ensemble model not available"
            )
        
        # Predict
        probability = ensemble_model.predict_proba(features)[0][1]
        
        # Determine risk level
        if probability >= settings.SEVERE_RISK_THRESHOLD:
            risk_level = RiskLevel.SEVERE
        elif probability >= settings.HIGH_RISK_THRESHOLD:
            risk_level = RiskLevel.HIGH
        elif probability >= settings.MODERATE_RISK_THRESHOLD:
            risk_level = RiskLevel.MODERATE
        elif probability >= settings.LOW_RISK_THRESHOLD:
            risk_level = RiskLevel.LOW
        else:
            risk_level = RiskLevel.VERY_LOW
        
        # Get feature importance (from XGBoost)
        xgb_model = model_registry.get_model("xgboost")
        feature_importance = {}
        if xgb_model and hasattr(xgb_model, 'feature_importances_'):
            importances = xgb_model.feature_importances_
            feature_names = settings.FEATURE_COLUMNS
            feature_importance = {
                name: float(imp) 
                for name, imp in zip(feature_names, importances)
            }
            # Sort by importance
            feature_importance = dict(
                sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
            )
        
        # Calculate confidence (using ensemble variance)
        model_predictions = []
        for model_name in ["xgboost", "lightgbm", "random_forest", "neural_network", "svm"]:
            model = model_registry.get_model(model_name)
            if model:
                pred = model.predict_proba(features)[0][1]
                model_predictions.append(pred)
        
        confidence = 1.0 - np.std(model_predictions) if len(model_predictions) > 1 else 0.8
        confidence = min(max(confidence, 0.0), 1.0)  # Clamp to [0, 1]
        
        response = PredictionResponse(
            location_name=request.location_name,
            latitude=request.latitude,
            longitude=request.longitude,
            probability=float(probability),
            risk_level=risk_level,
            confidence=float(confidence),
            feature_importance=feature_importance,
            model_version=settings.MODEL_VERSION,
            timestamp=datetime.utcnow()
        )
        
        logger.info(f"Prediction complete: {risk_level.value} risk ({probability:.3f})")
        return response
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )


@router.post("/batch", response_model=BatchPredictionResponse)
async def predict_batch(
    request: BatchPredictionRequest,
    model_registry: ModelRegistry = Depends(get_model_registry)
):
    """
    Predict landslide risk for multiple locations in batch.
    
    More efficient than multiple single predictions.
    """
    try:
        logger.info(f"Batch prediction request for {len(request.locations)} locations")
        
        if len(request.locations) > settings.MAX_BATCH_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Batch size exceeds maximum of {settings.MAX_BATCH_SIZE}"
            )
        
        predictions = []
        
        for location in request.locations:
            # Reuse single prediction logic
            pred_request = PredictionRequest(
                location_name=location.location_name,
                latitude=location.latitude,
                longitude=location.longitude,
                features=location.features
            )
            
            pred_response = await predict_single(pred_request, model_registry)
            predictions.append(pred_response)
        
        return BatchPredictionResponse(
            predictions=predictions,
            total_locations=len(predictions),
            timestamp=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch prediction failed: {str(e)}"
        )


@router.get("/risk-zones", response_model=Dict[str, Any])
async def get_risk_zones(
    min_latitude: float,
    max_latitude: float,
    min_longitude: float,
    max_longitude: float,
    grid_size: int = 10,
    model_registry: ModelRegistry = Depends(get_model_registry)
):
    """
    Generate risk heatmap for a geographic area.
    
    Returns a grid of risk probabilities for visualization.
    """
    try:
        logger.info(f"Risk zone request: [{min_latitude}, {max_latitude}] x [{min_longitude}, {max_longitude}]")
        
        if grid_size > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Grid size too large (max: 50x50)"
            )
        
        # Generate grid points
        lat_points = np.linspace(min_latitude, max_latitude, grid_size)
        lon_points = np.linspace(min_longitude, max_longitude, grid_size)
        
        risk_grid = []
        
        for lat in lat_points:
            row = []
            for lon in lon_points:
                # In production, fetch actual features for this location
                # For now, use simulated features based on location
                features = _generate_simulated_features(lat, lon)
                
                ensemble_model = model_registry.get_model("ensemble")
                if ensemble_model:
                    features_array = np.array([list(features.values())])
                    prob = float(ensemble_model.predict_proba(features_array)[0][1])
                else:
                    prob = 0.5  # Default
                
                row.append({
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "probability": prob
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
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Risk zone generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Risk zone generation failed: {str(e)}"
        )


def _generate_simulated_features(lat: float, lon: float) -> Dict[str, float]:
    """Generate simulated features based on location (for demo purposes)."""
    # In production, this would query actual data sources
    np.random.seed(int((lat + lon) * 1000))
    
    return {
        "rainfall_intensity": np.random.uniform(50, 200),
        "soil_moisture": np.random.uniform(30, 80),
        "ndvi": np.random.uniform(0.2, 0.8),
        "slope_angle": np.random.uniform(10, 45),
        "elevation": np.random.uniform(500, 3000),
        "lithology_code": np.random.randint(1, 10),
        "land_use_code": np.random.randint(1, 8),
        "distance_to_road": np.random.uniform(0, 5000),
        "distance_to_river": np.random.uniform(0, 3000),
        "drainage_density": np.random.uniform(0.5, 3.0),
        "curvature": np.random.uniform(-0.5, 0.5),
        "aspect": np.random.uniform(0, 360),
        "twi": np.random.uniform(5, 15),
        "historical_landslides": np.random.randint(0, 20),
        "precipitation_30d": np.random.uniform(200, 600),
        "temperature": np.random.uniform(15, 30),
        "humidity": np.random.uniform(60, 95)
    }

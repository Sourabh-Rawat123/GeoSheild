"""
Pydantic schemas for prediction requests and responses.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    """Risk level classification."""
    VERY_LOW = "Very Low"
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    SEVERE = "Severe"


class FeatureSet(BaseModel):
    """Input features for landslide prediction."""
    rainfall_intensity: float = Field(..., description="Rainfall intensity in mm", ge=0, le=500)
    soil_moisture: float = Field(..., description="Soil moisture percentage", ge=0, le=100)
    ndvi: float = Field(..., description="Normalized Difference Vegetation Index", ge=-1, le=1)
    slope_angle: float = Field(..., description="Slope angle in degrees", ge=0, le=90)
    elevation: float = Field(..., description="Elevation in meters", ge=0, le=9000)
    lithology_code: int = Field(..., description="Rock type code", ge=1, le=15)
    land_use_code: int = Field(..., description="Land use classification code", ge=1, le=10)
    distance_to_road: float = Field(..., description="Distance to nearest road in meters", ge=0)
    distance_to_river: float = Field(..., description="Distance to nearest river in meters", ge=0)
    drainage_density: float = Field(..., description="Drainage density", ge=0, le=10)
    curvature: float = Field(..., description="Terrain curvature", ge=-1, le=1)
    aspect: float = Field(..., description="Aspect in degrees", ge=0, le=360)
    twi: float = Field(..., description="Topographic Wetness Index", ge=0, le=30)
    historical_landslides: int = Field(..., description="Historical landslide count", ge=0)
    precipitation_30d: float = Field(..., description="30-day precipitation in mm", ge=0, le=2000)
    temperature: float = Field(..., description="Temperature in Celsius", ge=-20, le=50)
    humidity: float = Field(..., description="Humidity percentage", ge=0, le=100)

    class Config:
        json_schema_extra = {
            "example": {
                "rainfall_intensity": 150.5,
                "soil_moisture": 65.3,
                "ndvi": 0.45,
                "slope_angle": 32.5,
                "elevation": 1850.0,
                "lithology_code": 5,
                "land_use_code": 3,
                "distance_to_road": 250.0,
                "distance_to_river": 180.0,
                "drainage_density": 1.8,
                "curvature": 0.15,
                "aspect": 135.0,
                "twi": 8.5,
                "historical_landslides": 3,
                "precipitation_30d": 450.0,
                "temperature": 22.5,
                "humidity": 78.0
            }
        }


class PredictionRequest(BaseModel):
    """Request schema for single prediction."""
    location_name: str = Field(..., description="Name of the location")
    latitude: float = Field(..., description="Latitude in decimal degrees", ge=-90, le=90)
    longitude: float = Field(..., description="Longitude in decimal degrees", ge=-180, le=180)
    features: FeatureSet = Field(..., description="Feature set for prediction")

    class Config:
        json_schema_extra = {
            "example": {
                "location_name": "Kedarnath, Uttarakhand",
                "latitude": 30.7346,
                "longitude": 79.0669,
                "features": {
                    "rainfall_intensity": 150.5,
                    "soil_moisture": 65.3,
                    "ndvi": 0.45,
                    "slope_angle": 32.5,
                    "elevation": 1850.0,
                    "lithology_code": 5,
                    "land_use_code": 3,
                    "distance_to_road": 250.0,
                    "distance_to_river": 180.0,
                    "drainage_density": 1.8,
                    "curvature": 0.15,
                    "aspect": 135.0,
                    "twi": 8.5,
                    "historical_landslides": 3,
                    "precipitation_30d": 450.0,
                    "temperature": 22.5,
                    "humidity": 78.0
                }
            }
        }


class PredictionResponse(BaseModel):
    """Response schema for single prediction."""
    location_name: str
    latitude: float
    longitude: float
    probability: float = Field(..., description="Landslide probability", ge=0, le=1)
    risk_level: RiskLevel
    confidence: float = Field(..., description="Prediction confidence", ge=0, le=1)
    feature_importance: Dict[str, float] = Field(default_factory=dict)
    model_version: str
    timestamp: datetime
    
    recommended_actions: Optional[List[str]] = None

    @validator('recommended_actions', always=True)
    def set_recommended_actions(cls, v, values):
        """Auto-generate recommended actions based on risk level."""
        if v is not None:
            return v
        
        risk_level = values.get('risk_level')
        actions = {
            RiskLevel.VERY_LOW: [
                "Continue normal monitoring",
                "Review historical data periodically"
            ],
            RiskLevel.LOW: [
                "Increase monitoring frequency",
                "Check drainage systems",
                "Monitor weather forecasts"
            ],
            RiskLevel.MODERATE: [
                "Alert local authorities",
                "Prepare evacuation routes",
                "Increase monitoring to hourly intervals",
                "Restrict access to vulnerable areas"
            ],
            RiskLevel.HIGH: [
                "Issue evacuation advisory",
                "Mobilize emergency services",
                "Continuous real-time monitoring",
                "Close roads in high-risk zones",
                "Activate emergency shelters"
            ],
            RiskLevel.SEVERE: [
                "IMMEDIATE EVACUATION REQUIRED",
                "Deploy rescue teams",
                "Establish emergency command center",
                "Block all access to danger zones",
                "Activate disaster response protocols"
            ]
        }
        return actions.get(risk_level, [])

    class Config:
        json_schema_extra = {
            "example": {
                "location_name": "Kedarnath, Uttarakhand",
                "latitude": 30.7346,
                "longitude": 79.0669,
                "probability": 0.874,
                "risk_level": "High",
                "confidence": 0.92,
                "feature_importance": {
                    "rainfall_intensity": 0.25,
                    "soil_moisture": 0.18,
                    "slope_angle": 0.15,
                    "elevation": 0.12
                },
                "model_version": "production",
                "timestamp": "2025-11-16T10:30:00Z",
                "recommended_actions": [
                    "Issue evacuation advisory",
                    "Mobilize emergency services"
                ]
            }
        }


class BatchPredictionRequest(BaseModel):
    """Request schema for batch predictions."""
    locations: List[PredictionRequest] = Field(..., description="List of locations to predict")

    @validator('locations')
    def validate_batch_size(cls, v):
        """Validate batch size limits."""
        if len(v) > 100:
            raise ValueError("Batch size cannot exceed 100 locations")
        if len(v) == 0:
            raise ValueError("Batch must contain at least one location")
        return v


class BatchPredictionResponse(BaseModel):
    """Response schema for batch predictions."""
    predictions: List[PredictionResponse]
    total_locations: int
    timestamp: datetime
    
    summary: Optional[Dict[str, int]] = None

    @validator('summary', always=True)
    def calculate_summary(cls, v, values):
        """Calculate summary statistics."""
        if v is not None:
            return v
        
        predictions = values.get('predictions', [])
        summary = {
            "total": len(predictions),
            "very_low": sum(1 for p in predictions if p.risk_level == RiskLevel.VERY_LOW),
            "low": sum(1 for p in predictions if p.risk_level == RiskLevel.LOW),
            "moderate": sum(1 for p in predictions if p.risk_level == RiskLevel.MODERATE),
            "high": sum(1 for p in predictions if p.risk_level == RiskLevel.HIGH),
            "severe": sum(1 for p in predictions if p.risk_level == RiskLevel.SEVERE)
        }
        return summary

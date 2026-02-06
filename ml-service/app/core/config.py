"""
Configuration settings for ML Service.

Loads configuration from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    APP_NAME: str = "GeoShield AI ML Service"
    VERSION: str = "3.2.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    WORKERS: int = 4
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://localhost:5173",
        "https://geoshield.ai"
    ]
    
    # Database
    DATABASE_URL: str = "postgresql://geoshield:geoshield123@localhost:5432/geoshield_gis"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str = "redis://:redis123@localhost:6379/0"
    REDIS_POOL_SIZE: int = 10
    CACHE_TTL: int = 3600  # 1 hour
    
    # Object Storage (MinIO/S3)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET: str = "geoshield-models"
    MINIO_SECURE: bool = False
    
    # MLflow
    MLFLOW_TRACKING_URI: str = "http://localhost:5000"
    MLFLOW_EXPERIMENT_NAME: str = "landslide_prediction"
    
    # Model Paths
    MODEL_REGISTRY_PATH: str = "./models"
    MODEL_VERSION: str = "production"
    
    # Model Configuration
    ENSEMBLE_WEIGHTS: dict = {
        "xgboost": 0.25,
        "lightgbm": 0.25,
        "random_forest": 0.20,
        "neural_network": 0.15,
        "svm": 0.15
    }
    
    # Feature Configuration
    FEATURE_COLUMNS: List[str] = [
        "rainfall_intensity",
        "soil_moisture",
        "ndvi",
        "slope_angle",
        "elevation",
        "lithology_code",
        "land_use_code",
        "distance_to_road",
        "distance_to_river",
        "drainage_density",
        "curvature",
        "aspect",
        "twi",
        "historical_landslides",
        "precipitation_30d",
        "temperature",
        "humidity"
    ]
    
    N_FEATURES: int = 17
    N_PCA_COMPONENTS: int = 10
    
    # Prediction Thresholds
    LOW_RISK_THRESHOLD: float = 0.3
    MODERATE_RISK_THRESHOLD: float = 0.5
    HIGH_RISK_THRESHOLD: float = 0.7
    SEVERE_RISK_THRESHOLD: float = 0.9
    
    # Training Configuration
    TRAIN_TEST_SPLIT: float = 0.2
    VALIDATION_SPLIT: float = 0.1
    RANDOM_STATE: int = 42
    CROSS_VALIDATION_FOLDS: int = 5
    
    # XGBoost Hyperparameters
    XGBOOST_N_ESTIMATORS: int = 500
    XGBOOST_MAX_DEPTH: int = 8
    XGBOOST_LEARNING_RATE: float = 0.05
    XGBOOST_SUBSAMPLE: float = 0.8
    XGBOOST_COLSAMPLE_BYTREE: float = 0.8
    
    # LightGBM Hyperparameters
    LIGHTGBM_N_ESTIMATORS: int = 500
    LIGHTGBM_MAX_DEPTH: int = 7
    LIGHTGBM_LEARNING_RATE: float = 0.05
    LIGHTGBM_NUM_LEAVES: int = 64
    
    # Random Forest Hyperparameters
    RF_N_ESTIMATORS: int = 1000
    RF_MAX_DEPTH: int = 15
    RF_MIN_SAMPLES_SPLIT: int = 5
    RF_MIN_SAMPLES_LEAF: int = 2
    
    # Neural Network Configuration
    NN_HIDDEN_LAYERS: List[int] = [128, 64, 32, 16]
    NN_DROPOUT_RATE: float = 0.3
    NN_LEARNING_RATE: float = 0.001
    NN_BATCH_SIZE: int = 32
    NN_EPOCHS: int = 100
    NN_EARLY_STOPPING_PATIENCE: int = 10
    
    # SVM Configuration
    SVM_KERNEL: str = "rbf"
    SVM_C: float = 1.0
    SVM_GAMMA: str = "scale"
    
    # SMOTE Configuration
    SMOTE_SAMPLING_STRATEGY: float = 0.5
    SMOTE_K_NEIGHBORS: int = 5
    
    # Performance
    MAX_BATCH_SIZE: int = 100
    REQUEST_TIMEOUT: int = 30
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>"
    
    # Monitoring
    ENABLE_PROMETHEUS: bool = True
    PROMETHEUS_PORT: int = 9091
    
    # Security
    API_KEY_ENABLED: bool = False
    API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()

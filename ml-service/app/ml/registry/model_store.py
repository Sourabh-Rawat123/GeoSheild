"""
Model Registry for managing trained ML models.

Handles loading, caching, and serving multiple model types.
"""

from typing import Dict, Optional, Any, List
import joblib
import pickle
from pathlib import Path
import os
from loguru import logger
import asyncio

from app.core.config import settings


class ModelRegistry:
    """
    Central registry for managing machine learning models.
    
    Features:
    - Lazy loading of models
    - In-memory caching
    - Version management
    - Health checking
    """
    
    def __init__(self):
        """Initialize model registry."""
        self.models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, Dict] = {}
        self.models_path = Path(settings.MODEL_REGISTRY_PATH)
        self.loaded = False
        
        # Ensure models directory exists
        self.models_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Model registry initialized at {self.models_path}")
    
    async def load_models(self):
        """Load all available models from disk."""
        try:
            logger.info("Loading models...")
            
            # Model files to load
            model_files = {
                "xgboost": "xgboost_model.pkl",
                "lightgbm": "lightgbm_model.pkl",
                "random_forest": "random_forest_model.pkl",
                "svm": "svm_model.pkl",
                "neural_network": "neural_network_model.pkl",
                "ensemble": "ensemble_model.pkl",
                "preprocessor": "preprocessor.pkl",
                "pca": "pca_model.pkl"
            }
            
            loaded_count = 0
            
            for model_name, filename in model_files.items():
                model_path = self.models_path / filename
                
                if model_path.exists():
                    try:
                        # Load model
                        with open(model_path, 'rb') as f:
                            model = joblib.load(f)
                        
                        self.models[model_name] = model
                        
                        # Load metadata if exists
                        metadata_path = self.models_path / f"{model_name}_metadata.pkl"
                        if metadata_path.exists():
                            with open(metadata_path, 'rb') as f:
                                self.model_metadata[model_name] = pickle.load(f)
                        
                        loaded_count += 1
                        logger.info(f"✓ Loaded {model_name} model")
                        
                    except Exception as e:
                        logger.error(f"✗ Failed to load {model_name}: {e}")
                else:
                    logger.warning(f"⚠ Model file not found: {filename}")
            
            if loaded_count == 0:
                logger.warning("No models loaded. Creating dummy models for demo...")
                self._create_dummy_models()
            
            self.loaded = True
            logger.info(f"Model loading complete: {loaded_count}/{len(model_files)} models loaded")
            
        except Exception as e:
            logger.error(f"Error during model loading: {e}")
            raise
    
    def _create_dummy_models(self):
        """Create dummy models for demonstration purposes."""
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler
        import numpy as np
        
        logger.info("Creating dummy models for demo...")
        
        # Create simple RandomForest as dummy ensemble
        X_dummy = np.random.rand(100, settings.N_FEATURES)
        y_dummy = np.random.randint(0, 2, 100)
        
        dummy_model = RandomForestClassifier(n_estimators=10, random_state=42)
        dummy_model.fit(X_dummy, y_dummy)
        
        # Use same model for all types (just for demo)
        self.models["ensemble"] = dummy_model
        self.models["xgboost"] = dummy_model
        self.models["lightgbm"] = dummy_model
        self.models["random_forest"] = dummy_model
        self.models["svm"] = dummy_model
        self.models["neural_network"] = dummy_model
        
        # Dummy preprocessor
        scaler = StandardScaler()
        scaler.fit(X_dummy)
        self.models["preprocessor"] = scaler
        
        logger.info("✓ Dummy models created successfully")
    
    def get_model(self, model_name: str) -> Optional[Any]:
        """
        Get a specific model by name.
        
        Args:
            model_name: Name of the model (e.g., 'xgboost', 'ensemble')
        
        Returns:
            Model object or None if not found
        """
        return self.models.get(model_name)
    
    def get_metadata(self, model_name: str) -> Optional[Dict]:
        """Get metadata for a specific model."""
        return self.model_metadata.get(model_name, {})
    
    def is_ready(self) -> bool:
        """Check if registry is ready to serve predictions."""
        return self.loaded and "ensemble" in self.models
    
    def get_loaded_models(self) -> List[str]:
        """Get list of loaded model names."""
        return list(self.models.keys())
    
    def save_model(self, model_name: str, model: Any, metadata: Optional[Dict] = None):
        """
        Save a model to disk and register it.
        
        Args:
            model_name: Name to register the model under
            model: Model object to save
            metadata: Optional metadata dictionary
        """
        try:
            # Save model
            model_path = self.models_path / f"{model_name}_model.pkl"
            with open(model_path, 'wb') as f:
                joblib.dump(model, f, compress=3)
            
            # Save metadata
            if metadata:
                metadata_path = self.models_path / f"{model_name}_metadata.pkl"
                with open(metadata_path, 'wb') as f:
                    pickle.dump(metadata, f)
            
            # Register in memory
            self.models[model_name] = model
            if metadata:
                self.model_metadata[model_name] = metadata
            
            logger.info(f"✓ Saved and registered model: {model_name}")
            
        except Exception as e:
            logger.error(f"Error saving model {model_name}: {e}")
            raise
    
    def unload_model(self, model_name: str):
        """Unload a model from memory."""
        if model_name in self.models:
            del self.models[model_name]
            logger.info(f"Unloaded model: {model_name}")
    
    def reload_model(self, model_name: str):
        """Reload a specific model from disk."""
        self.unload_model(model_name)
        
        model_path = self.models_path / f"{model_name}_model.pkl"
        if model_path.exists():
            with open(model_path, 'rb') as f:
                model = joblib.load(f)
            self.models[model_name] = model
            logger.info(f"Reloaded model: {model_name}")
        else:
            logger.error(f"Model file not found: {model_path}")
    
    async def cleanup(self):
        """Cleanup resources on shutdown."""
        logger.info("Cleaning up model registry...")
        self.models.clear()
        self.model_metadata.clear()
        self.loaded = False
        logger.info("Model registry cleanup complete")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about all loaded models."""
        return {
            "loaded_models": self.get_loaded_models(),
            "total_models": len(self.models),
            "registry_path": str(self.models_path),
            "is_ready": self.is_ready(),
            "models_metadata": {
                name: {
                    "type": type(model).__name__,
                    "metadata": self.get_metadata(name)
                }
                for name, model in self.models.items()
            }
        }

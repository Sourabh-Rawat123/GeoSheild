from typing import Dict, Optional, Any, List
import joblib
import pickle
from pathlib import Path
import os
from loguru import logger
import asyncio

from app.core.config import settings


class ModelRegistry:

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, Dict] = {}
        self.models_path = Path(settings.MODEL_REGISTRY_PATH)
        self.loaded = False

        self.models_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Model registry initialized at {self.models_path}")

    # ✅ FIXED FUNCTION
    async def load_models(self):
        try:
            logger.info("Loading models...")
            loaded_count = 0

            # -----------------------------
            # LOAD YOUR ML MODEL
            # -----------------------------
            custom_model_path = self.models_path / "landslide_risk_pipeline.pkl"

            if custom_model_path.exists():
                try:
                    with open(custom_model_path, "rb") as f:
                        pipeline = joblib.load(f)

                    # ✅ IMPORTANT: store correctly
                    self.models["landslide_model"] = pipeline["model"]
                    self.models["scaler"] = pipeline["scaler"]
                    self.models["features"] = pipeline["features"]

                    loaded_count += 1
                    logger.info("✓ Loaded landslide ML model")

                except Exception as e:
                    logger.error(f"✗ Failed to load landslide model: {e}")

            else:
                logger.warning(f"⚠ Model file not found: {custom_model_path}")

            # -----------------------------
            # OPTIONAL FALLBACK
            # -----------------------------
            if loaded_count == 0:
                logger.warning("No models loaded, using dummy model")
                self._create_dummy_models()

            self.loaded = True
            logger.info(f"Model loading complete: {loaded_count} model(s) loaded")

        except Exception as e:
            logger.error(f"Error during model loading: {e}")
            raise

    # KEEP THIS SAME
    def _create_dummy_models(self):
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler
        import numpy as np

        logger.info("Creating dummy models for demo...")

        X_dummy = np.random.rand(100, settings.N_FEATURES)
        y_dummy = np.random.randint(0, 2, 100)

        dummy_model = RandomForestClassifier(n_estimators=10, random_state=42)
        dummy_model.fit(X_dummy, y_dummy)

        self.models["landslide_model"] = dummy_model

        scaler = StandardScaler()
        scaler.fit(X_dummy)

        self.models["scaler"] = scaler
        self.models["features"] = [f"f{i}" for i in range(settings.N_FEATURES)]

        logger.info("✓ Dummy models created successfully")

    def get_model(self, model_name: str) -> Optional[Any]:
        return self.models.get(model_name)

    def get_metadata(self, model_name: str) -> Optional[Dict]:
        return self.model_metadata.get(model_name, {})

    # ✅ FIXED THIS
    def is_ready(self) -> bool:
        return self.loaded and "landslide_model" in self.models

    def get_loaded_models(self) -> List[str]:
        return list(self.models.keys())

    def save_model(self, model_name: str, model: Any, metadata: Optional[Dict] = None):
        try:
            model_path = self.models_path / f"{model_name}_model.pkl"
            with open(model_path, 'wb') as f:
                joblib.dump(model, f, compress=3)

            if metadata:
                metadata_path = self.models_path / f"{model_name}_metadata.pkl"
                with open(metadata_path, 'wb') as f:
                    pickle.dump(metadata, f)

            self.models[model_name] = model
            if metadata:
                self.model_metadata[model_name] = metadata

            logger.info(f"✓ Saved and registered model: {model_name}")

        except Exception as e:
            logger.error(f"Error saving model {model_name}: {e}")
            raise

    def unload_model(self, model_name: str):
        if model_name in self.models:
            del self.models[model_name]
            logger.info(f"Unloaded model: {model_name}")

    def reload_model(self, model_name: str):
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
        logger.info("Cleaning up model registry...")
        self.models.clear()
        self.model_metadata.clear()
        self.loaded = False
        logger.info("Model registry cleanup complete")

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "loaded_models": self.get_loaded_models(),
            "total_models": len(self.models),
            "registry_path": str(self.models_path),
            "is_ready": self.is_ready(),
        }
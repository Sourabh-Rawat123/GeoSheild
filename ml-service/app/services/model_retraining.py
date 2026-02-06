"""
Continuous Learning Service - Retrain ML Model with Real-time Feedback
Runs periodically (daily/weekly) to improve model accuracy
"""
import pickle
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from pathlib import Path
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ModelRetrainingService:
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent.parent.parent
        self.model_path = self.base_dir / "ml-service" / "models"
        self.data_path = self.base_dir / "ml-service" / "datasets"
        
    def collect_real_time_data_from_db(self):
        """
        Step 1: Collect predictions made + actual outcomes
        Query MongoDB for predictions with verified outcomes
        """
        from pymongo import MongoClient
        import os
        
        client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/geoshield'))
        db = client.geoshield
        
        # Get predictions where outcome was verified
        predictions = db.predictions.find({
            'outcome_verified': True,
            'createdAt': {'$gte': datetime.now() - pd.Timedelta(days=30)}
        })
        
        training_data = []
        for pred in predictions:
            # Extract features and actual outcome
            features = {
                'rainfall_24h': pred.get('weather', {}).get('currentRainfall', 0),
                'rainfall_72h': pred.get('weather', {}).get('forecast72h', 0),
                'slope': pred.get('features', {}).get('slope', 0),
                'elevation': pred.get('features', {}).get('elevation', 0),
                'temperature': pred.get('weather', {}).get('temperature', 0),
                'humidity': pred.get('weather', {}).get('humidity', 0),
                # ... more features
                'actual_landslide': pred.get('actual_outcome', 0)  # 0 or 1
            }
            training_data.append(features)
        
        logger.info(f"Collected {len(training_data)} real-time training samples")
        return pd.DataFrame(training_data)
    
    def merge_with_historical_data(self, new_data):
        """
        Step 2: Combine new real-time data with historical training data
        """
        # Load original training data
        historical_csv = self.data_path / "landslide_events.csv"
        historical_df = pd.read_csv(historical_csv)
        
        # Merge with new data
        combined_df = pd.concat([historical_df, new_data], ignore_index=True)
        
        # Remove duplicates, balance classes
        logger.info(f"Combined dataset: {len(combined_df)} samples")
        return combined_df
    
    def retrain_model(self, training_data):
        """
        Step 3: Retrain RandomForest model with new data
        """
        # Prepare features and target
        X = training_data.drop(['actual_landslide'], axis=1)
        y = training_data['actual_landslide']
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train new model
        logger.info("Training new RandomForest model...")
        model = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1
        )
        model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        logger.info(f"New model accuracy: {accuracy:.4f}")
        logger.info(f"\n{classification_report(y_test, y_pred)}")
        
        return model, accuracy
    
    def version_and_save_model(self, model, accuracy):
        """
        Step 4: Save new model with version number
        Keep old models as backups
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        version = f"v{timestamp}"
        
        # Archive old model
        old_model_path = self.model_path / "landslide_risk_pipeline (1).pkl"
        if old_model_path.exists():
            archive_path = self.model_path / "archive" / f"model_backup_{timestamp}.pkl"
            archive_path.parent.mkdir(exist_ok=True)
            old_model_path.rename(archive_path)
            logger.info(f"Archived old model to {archive_path}")
        
        # Save new model
        model_data = {
            'model': model,
            'version': version,
            'accuracy': accuracy,
            'trained_at': datetime.now().isoformat(),
            'features': list(model.feature_names_in_)
        }
        
        with open(old_model_path, 'wb') as f:
            pickle.dump(model_data, f)
        
        logger.info(f"New model saved: {version} (accuracy: {accuracy:.4f})")
        return version
    
    def run_retraining_cycle(self):
        """
        Complete retraining workflow
        Call this function on a schedule (daily/weekly)
        """
        logger.info("=" * 50)
        logger.info("Starting model retraining cycle...")
        logger.info("=" * 50)
        
        try:
            # Step 1: Collect new data from production
            new_data = self.collect_real_time_data_from_db()
            
            if len(new_data) < 10:
                logger.warning("Insufficient new data for retraining (need at least 10 samples)")
                return False
            
            # Step 2: Merge with historical data
            combined_data = self.merge_with_historical_data(new_data)
            
            # Step 3: Retrain model
            new_model, accuracy = self.retrain_model(combined_data)
            
            # Step 4: Save and version
            version = self.version_and_save_model(new_model, accuracy)
            
            logger.info(f"✓ Retraining completed successfully: {version}")
            return True
            
        except Exception as e:
            logger.error(f"Retraining failed: {e}")
            return False

# Scheduler integration
if __name__ == "__main__":
    service = ModelRetrainingService()
    service.run_retraining_cycle()

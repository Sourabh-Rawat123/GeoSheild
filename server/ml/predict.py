"""
ML Prediction Script for Backend Integration
This script is called directly by the Node.js backend to make predictions

ARCHITECTURE:
1. Backend passes: GPS coordinates + Live API data
2. Script loads: District CSV data + Historical CSV data
3. Script combines: CSV reference data + Live API data
4. Script runs: Trained model from ml-service folder
5. Returns: Prediction result
"""
import sys
import json
import pickle
import pandas as pd
import numpy as np
from pathlib import Path

# Define functions that pickle expects (from model training)
def model_inference(features):
    """
    Dummy inference function for unpickling compatibility.
    This function might have been used during model training.
    """
    return features

def determine_final_risk(probability):
    """
    Determine risk level from probability.
    This function might have been used during model training.
    """
    if probability < 0.3:
        return "LOW"
    elif probability < 0.6:
        return "MODERATE"
    elif probability < 0.8:
        return "HIGH"
    else:
        return "CRITICAL"

# Configure paths to ml-service folder
BASE_DIR = Path(__file__).parent.parent.parent
MODEL_PATH = BASE_DIR / "ml-service" / "models" / "landslide_risk_pipeline (1).pkl"

# CSV files for reference data
EVENTS_CSV_PATH = BASE_DIR / "ml-service" / "datasets" / "landslide_events.csv"
DISTRICT_CSV_PATH = BASE_DIR / "ml-service" / "datasets" / "district_risk_rank.csv"
CLASSIFICATION_CSV_PATH = BASE_DIR / "ml-service" / "datasets" / "landslide_classification.csv"
STATE_STATS_CSV_PATH = BASE_DIR / "ml-service" / "datasets" / "state_landslide_statistics.csv"

class LandslideMLPredictor:
    def __init__(self):
        self.model = None
        self.feature_names = None
        self.events_df = None
        self.district_df = None
        self.classification_df = None
        self.state_stats_df = None
        self._load_model()
        self._load_csv_reference_data()
    
    def _load_model(self):
        """Load the pre-trained ML model from ml-service folder"""
        try:
            with open(MODEL_PATH, 'rb') as f:
                loaded = pickle.load(f)
                
            # Check if it's a dict containing the model
            if isinstance(loaded, dict):
                print(f"[DEBUG] Loaded pickle is a dict with keys: {list(loaded.keys())}", file=sys.stderr)
                # Try common keys where model might be stored
                if 'model' in loaded:
                    self.model = loaded['model']
                elif 'pipeline' in loaded:
                    self.model = loaded['pipeline']
                elif 'estimator' in loaded:
                    self.model = loaded['estimator']
                else:
                    # Use the first value that looks like a model
                    for key, value in loaded.items():
                        if hasattr(value, 'predict_proba'):
                            print(f"[DEBUG] Found model in key: {key}", file=sys.stderr)
                            self.model = value
                            break
                    else:
                        raise ValueError(f"Could not find model in dict. Keys: {list(loaded.keys())}")
                        
                # Store feature names if available
                if 'features' in loaded:
                    self.feature_names = loaded['features']
                    print(f"[DEBUG] Model expects {len(self.feature_names)} features: {self.feature_names}", file=sys.stderr)
                else:
                    self.feature_names = None
            else:
                self.model = loaded
                self.feature_names = None
                
            print(f"[DEBUG] Model loaded successfully: {type(self.model).__name__}", file=sys.stderr)
        except Exception as e:
            print(json.dumps({
                "error": f"Failed to load model: {str(e)}",
                "success": False
            }), file=sys.stderr)
            sys.exit(1)
    
    def _load_csv_reference_data(self):
        """Load all CSV reference data for district-level information"""
        try:
            # Historical events data
            self.events_df = pd.read_csv(EVENTS_CSV_PATH)
            
            # District risk rankings
            self.district_df = pd.read_csv(DISTRICT_CSV_PATH)
            
            # Classification data
            try:
                self.classification_df = pd.read_csv(CLASSIFICATION_CSV_PATH)
            except:
                self.classification_df = None
            
            # State statistics
            try:
                self.state_stats_df = pd.read_csv(STATE_STATS_CSV_PATH)
            except:
                self.state_stats_df = None
                
        except Exception as e:
            # CSV data is reference only - non-critical
            self.events_df = None
            self.district_df = None
    
    def get_historical_score(self, latitude, longitude, radius_km=50):
        """
        Calculate historical risk score based on nearby events (10% weight)
        """
        if self.events_df is None or self.events_df.empty:
            return 0.0
        
        try:
            # Calculate distance to all events
            def haversine_distance(lat1, lon1, lat2, lon2):
                R = 6371  # Earth's radius in km
                dlat = np.radians(lat2 - lat1)
                dlon = np.radians(lon2 - lon1)
                a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon/2)**2
                c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))
                return R * c
            
            # Filter events within radius
            if 'latitude' in self.events_df.columns and 'longitude' in self.events_df.columns:
                self.events_df['distance'] = self.events_df.apply(
                    lambda row: haversine_distance(latitude, longitude, row['latitude'], row['longitude']),
                    axis=1
                )
                nearby_events = self.events_df[self.events_df['distance'] <= radius_km]
                
                if len(nearby_events) == 0:
                    return 0.0
                
                # Calculate score based on number and proximity of events
                # More events and closer events = higher risk
                event_count = len(nearby_events)
                avg_distance = nearby_events['distance'].mean()
                
                # Normalize: more events = higher score, closer = higher score
                count_score = min(event_count / 10, 1.0)  # Max at 10 events
                proximity_score = 1 - (avg_distance / radius_km)  # Closer = higher
                
                return (count_score * 0.6 + proximity_score * 0.4)  # Combined score 0-1
            
        except Exception as e:
            # Return neutral score on error
            return 0.0
        
        return 0.0
    
    def get_district_info(self, latitude, longitude):
        """
        Look up district information from CSV based on GPS coordinates
        This provides reference data about the district's historical risk
        """
        district_info = {
            'district_rank': 0,
            'district_name': 'Unknown',
            'state_name': 'Unknown',
            'risk_multiplier': 1.0
        }
        
        if self.district_df is None or self.district_df.empty:
            return district_info
        
        try:
            # Simple approach: Find closest district from historical events
            # In production, you'd use a proper geocoding service or shapefile
            if self.events_df is not None and not self.events_df.empty:
                # Find nearest event to get district context
                def distance(lat1, lon1, lat2, lon2):
                    return ((lat1 - lat2)**2 + (lon1 - lon2)**2)**0.5
                
                if 'latitude' in self.events_df.columns and 'longitude' in self.events_df.columns:
                    self.events_df['dist'] = self.events_df.apply(
                        lambda row: distance(latitude, longitude, row.get('latitude', 0), row.get('longitude', 0)),
                        axis=1
                    )
                    nearest = self.events_df.nsmallest(1, 'dist')
                    
                    if not nearest.empty and 'district' in nearest.columns:
                        district_name = nearest.iloc[0].get('district', 'Unknown')
                        
                        # Look up district rank from CSV
                        district_match = self.district_df[
                            self.district_df['district'].str.lower() == district_name.lower()
                        ]
                        
                        if not district_match.empty:
                            rank = district_match.iloc[0].get('rank', 0)
                            state = district_match.iloc[0].get('state', 'Unknown')
                            
                            district_info['district_rank'] = int(rank)
                            district_info['district_name'] = district_name
                            district_info['state_name'] = state
                            
                            # Higher rank = higher risk (rank 1 is most dangerous)
                            # Convert rank to risk multiplier (1-72 → 2.0-1.0)
                            district_info['risk_multiplier'] = max(1.0, 2.0 - (rank / 72))
        
        except Exception as e:
            # Return default on error
            pass
        
        return district_info
    
    def predict(self, features_dict, latitude, longitude):
        """
        Make ML prediction using the trained model
        
        INTEGRATION BRIDGE:
        - Takes GPS coordinates (latitude, longitude)
        - Receives live API data from backend (weather, seismic, etc.)
        - Looks up district CSV reference data
        - Combines all inputs and passes to trained model
        
        Input features from live APIs:
        - temperature, humidity, pressure, wind_speed (from weather API)
        - rainfall_24h, rainfall_72h (from weather API)
        - elevation, slope (from elevation API)
        - earthquake_count, max_earthquake_magnitude (from seismic API)
        - soil_moisture, ndvi, distance_to_fault, population_density
        """
        try:
            # Step 1: Get district reference data from CSV
            district_info = self.get_district_info(latitude, longitude)
            
            # DEBUG: Log district lookup
            print(f"[DEBUG] District Lookup: {district_info['district_name']}, {district_info['state_name']} (Rank: {district_info['district_rank']}, Multiplier: {district_info['risk_multiplier']:.2f})", file=sys.stderr)
            
            # Step 2: Build feature array using the exact features the model expects
            if self.feature_names:
                # Use the feature names from model training
                feature_list = self.feature_names
                print(f"[DEBUG] Using model's expected features: {feature_list}", file=sys.stderr)
                
                # Map our live API data to model's expected features
                mapped_features = {}
                
                # Rainfall triggers
                rainfall_24h = features_dict.get('rainfall_24h', 0)
                rainfall_72h = features_dict.get('rainfall_72h', 0)
                mapped_features['rainfall_trigger_prob'] = min(1.0, (rainfall_24h / 100 + rainfall_72h / 300) / 2)
                mapped_features['trigger_rainfall'] = 1 if rainfall_24h > 50 else 0
                
                # Earthquake triggers
                eq_count = features_dict.get('earthquake_count', 0)
                eq_mag = features_dict.get('max_earthquake_magnitude', 0)
                mapped_features['earthquake_trigger_prob'] = min(1.0, (eq_count / 10 + eq_mag / 10) / 2)
                mapped_features['trigger_earthquake'] = 1 if eq_count > 0 else 0
                
                # Human activity trigger (based on population density)
                pop_density = features_dict.get('population_density', 0)
                mapped_features['human_activity_trigger_prob'] = min(1.0, pop_density / 5000)
                mapped_features['trigger_anthropogenic'] = 1 if pop_density > 1000 else 0
                
                # Monsoon indicators (based on season and rainfall)
                import datetime
                current_month = datetime.datetime.now().month
                is_monsoon = 1 if 6 <= current_month <= 9 else 0
                mapped_features['monsoon_2014'] = is_monsoon
                mapped_features['monsoon_2017'] = is_monsoon
                
                # Classification types (defaulted, would need historical data)
                mapped_features['field_based'] = 0
                mapped_features['event_based'] = 1  # We're doing event-based prediction
                
                print(f"[DEBUG] Mapped features from API data: rainfall_trigger={mapped_features['rainfall_trigger_prob']:.2f}, eq_trigger={mapped_features['earthquake_trigger_prob']:.2f}", file=sys.stderr)
                
                # Build feature vector in correct order
                features = [mapped_features.get(fname, 0.0) for fname in feature_list]
            else:
                # Fallback to default feature list (but model expects specific ones)
                feature_list = [
                    'latitude', 'longitude', 'temperature', 'humidity', 'pressure',
                    'wind_speed', 'rainfall_24h', 'rainfall_72h', 'elevation', 'slope',
                    'earthquake_count', 'max_earthquake_magnitude', 'soil_moisture',
                    'ndvi', 'distance_to_fault', 'population_density'
                ]
            
            # Create feature vector from live API data
            features = []
            for feature_name in feature_list:
                value = features_dict.get(feature_name, 0.0)
                features.append(float(value))
            
            # DEBUG: Log feature values
            print(f"[DEBUG] Input Features ({len(features)} total): {dict(zip(feature_list[:8], features[:8]))}", file=sys.stderr)
            print(f"[DEBUG] Rainfall 24h: {features_dict.get('rainfall_24h', 0)}, Elevation: {features_dict.get('elevation', 0)}, Slope: {features_dict.get('slope', 0)}", file=sys.stderr)
            
            # Convert to numpy array
            X = np.array([features])
            
            # Step 3: Run trained model from ml-service folder
            probability = float(self.model.predict_proba(X)[0][1])
            
            # DEBUG: Log raw model output
            print(f"[DEBUG] Raw Model Probability: {probability:.4f}", file=sys.stderr)
            
            # Step 4: Apply district risk multiplier from CSV data
            # This adjusts prediction based on historical district patterns
            adjusted_probability = min(probability * district_info['risk_multiplier'], 1.0)
            
            # DEBUG: Log adjustment
            print(f"[DEBUG] Adjusted Probability: {adjusted_probability:.4f} (after {district_info['risk_multiplier']:.2f}x multiplier)", file=sys.stderr)
            
            # Calculate confidence based on probability distance from 0.5
            confidence = abs(adjusted_probability - 0.5) * 2  # 0.5 -> 0%, 0/1 -> 100%
            
            # Determine risk level
            if adjusted_probability < 0.3:
                risk_level = "LOW"
            elif adjusted_probability < 0.6:
                risk_level = "MODERATE"
            elif adjusted_probability < 0.8:
                risk_level = "HIGH"
            else:
                risk_level = "CRITICAL"
            
            print(f"[DEBUG] Final Risk Level: {risk_level} (Confidence: {confidence:.2f})", file=sys.stderr)
            
            return {
                "success": True,
                "ml_probability": adjusted_probability,
                "raw_probability": probability,  # Before district adjustment
                "risk_level": risk_level,
                "confidence": confidence,
                "feature_count": len(features),
                "district_info": district_info  # CSV reference data used
            }
            
        except Exception as e:
            print(f"[ERROR] Prediction failed: {str(e)}", file=sys.stderr)
            return {
                "success": False,
                "error": f"ML prediction failed: {str(e)}",
                "ml_probability": 0.5,
                "risk_level": "UNKNOWN",
                "confidence": 0.0
            }

def main():
    """
    Main entry point - receives JSON input from Node.js backend
    
    BRIDGE FLOW:
    1. Backend fetches live API data (weather, seismic, elevation)
    2. Backend sends: GPS coordinates + live API features
    3. This script:
       - Loads district CSV reference data
       - Loads trained model from ml-service folder
       - Combines CSV data + live API data
       - Runs prediction through trained model
    4. Returns: Prediction + district context to backend
    
    Expected input format:
    {
        "latitude": 30.7333,
        "longitude": 76.7794,
        "features": {
            "temperature": 25.5,       # From weather API
            "humidity": 70,             # From weather API
            "rainfall_24h": 15.2,       # From weather API
            "elevation": 500,           # From elevation API
            "earthquake_count": 2,      # From seismic API
            ...
        }
    }
    """
    try:
        # Read input from stdin
        raw_input = sys.stdin.read()
        print(f"[DEBUG] Received raw input (first 200 chars): {raw_input[:200]}", file=sys.stderr)
        
        # Parse JSON
        try:
            input_data = json.loads(raw_input)
            print(f"[DEBUG] Parsed input type: {type(input_data)}", file=sys.stderr)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON input: {str(e)}. Raw input: {raw_input[:100]}")
        
        # Validate input_data is a dict
        if not isinstance(input_data, dict):
            raise ValueError(f"Input data must be a dict, got {type(input_data)}. Value: {str(input_data)[:100]}")
        
        # Initialize predictor (loads model + CSV files from ml-service)
        predictor = LandslideMLPredictor()
        
        # Extract GPS coordinates and live API features
        latitude = input_data.get('latitude')
        longitude = input_data.get('longitude')
        features = input_data.get('features', {})
        
        print(f"[DEBUG] Extracted data - lat: {latitude}, lon: {longitude}, features: {type(features)}", file=sys.stderr)
        
        # Validate required fields
        if latitude is None or longitude is None:
            raise ValueError(f"Missing latitude or longitude. Input keys: {list(input_data.keys())}")
        
        # Add coordinates to features
        features['latitude'] = latitude
        features['longitude'] = longitude
        
        # Run ML prediction (combines CSV reference data + live API data)
        ml_result = predictor.predict(features, latitude, longitude)
        
        # Ensure ml_result is a dict and successful
        if not isinstance(ml_result, dict):
            raise ValueError(f"ML prediction returned invalid type: {type(ml_result)}")
        
        if not ml_result.get('success', False):
            raise ValueError(ml_result.get('error', 'ML prediction returned failure'))
        
        # Get historical event score from CSV
        historical_score = predictor.get_historical_score(latitude, longitude)
        
        # Combine results
        result = {
            "success": True,
            "ml_result": ml_result,
            "historical_score": historical_score,
            "latitude": latitude,
            "longitude": longitude
        }
        
        # Output JSON to stdout
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "ml_result": {
                "success": False,
                "ml_probability": 0.5,
                "risk_level": "UNKNOWN",
                "confidence": 0.0
            },
            "historical_score": 0.0
        }
        # Print error to stderr for logging
        print(f"[ERROR] Main function failed: {str(e)}", file=sys.stderr)
        # Print result to stdout (even on error)
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()

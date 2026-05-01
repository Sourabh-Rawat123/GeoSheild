import math

RAINFALL_NORMALIZATION_MM = 15.0
EARTHQUAKE_NORMALIZATION_MAG = 7.0
SLOPE_NORMALIZATION_METERS = 100.0
SLOPE_TRIGGER_THRESHOLD_METERS = 50.0
ELEVATION_POINT_DISTANCE_METERS = 100.0
MONSOON_2014_RAIN_THRESHOLD_MM = 10.0
MONSOON_2014_LOW_RAIN_SCALE = 5.0
MONSOON_2014_HIGH_RAIN_SCALE = 45.0
MONSOON_2017_LOW_RAIN_SCALE = 9.0
MONSOON_2017_HIGH_RAIN_SCALE = 6.0
FIELD_BASED_SCALE = 1800.0
EVENT_BASED_BASELINE = 6500.0
EVENT_BASED_RANGE = 1900.0


def _safe_float(value, default=0.0):
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, value))


def _extract_elevations(elevation_data):
    if isinstance(elevation_data, dict):
        results = elevation_data.get("results", [])
        return [_safe_float(point.get("elevation")) for point in results if isinstance(point, dict)]

    if isinstance(elevation_data, list):
        elevations = []
        for point in elevation_data:
            if isinstance(point, dict):
                elevations.append(_safe_float(point.get("elevation")))
            else:
                elevations.append(_safe_float(point))
        return elevations

    return []


def _monsoon_2014_signal(rainfall):
    if rainfall <= MONSOON_2014_RAIN_THRESHOLD_MM:
        return rainfall * MONSOON_2014_LOW_RAIN_SCALE

    return min(
        1800.0,
        ((rainfall - MONSOON_2014_RAIN_THRESHOLD_MM) * MONSOON_2014_HIGH_RAIN_SCALE) + 50.0
    )


def _monsoon_2017_signal(rainfall):
    if rainfall <= MONSOON_2014_RAIN_THRESHOLD_MM:
        return rainfall * MONSOON_2017_LOW_RAIN_SCALE

    return min(
        350.0,
        ((rainfall - MONSOON_2014_RAIN_THRESHOLD_MM) * MONSOON_2017_HIGH_RAIN_SCALE) + 90.0
    )


# ---------------------------------------
# WEATHER ADAPTER
# ---------------------------------------
def adapt_weather_api(data):
    rain_data = data.get("rain", {}) if isinstance(data, dict) else {}
    main_data = data.get("main", {}) if isinstance(data, dict) else {}
    wind_data = data.get("wind", {}) if isinstance(data, dict) else {}

    rainfall = max(
        _safe_float(rain_data.get("1h")),
        _safe_float(rain_data.get("3h")),
    )
    humidity = _safe_float(main_data.get("humidity"))
    pressure = _safe_float(main_data.get("pressure"), 1013.0)
    temp = _safe_float(main_data.get("temp"), 300.0) - 273.15
    wind_speed = _safe_float(wind_data.get("speed"))

    rainfall_trigger_prob = _clamp(rainfall / RAINFALL_NORMALIZATION_MM)
    trigger_rainfall = 1 if rainfall > 10 else 0

    return {
        "rainfall": rainfall,
        "rainfall_trigger_prob": rainfall_trigger_prob,
        "trigger_rainfall": trigger_rainfall,
        "monsoon_2014": _monsoon_2014_signal(rainfall),
        "monsoon_2017": _monsoon_2017_signal(rainfall),
        "context": {
            "humidity": humidity,
            "pressure": pressure,
            "temperature": temp,
            "wind_speed": wind_speed
        }
    }


# ---------------------------------------
# EARTHQUAKE ADAPTER
# ---------------------------------------
def adapt_earthquake_api(data):
    features = data.get("features", []) if isinstance(data, dict) else []

    if not features:
        return {
            "magnitude": 0.0,
            "depth": 0.0,
            "earthquake_trigger_prob": 0.0,
            "trigger_earthquake": 0
        }

    strongest_quake = max(
        features,
        key=lambda quake: _safe_float(quake.get("properties", {}).get("mag")),
    )
    magnitude = _safe_float(strongest_quake.get("properties", {}).get("mag"))
    coordinates = strongest_quake.get("geometry", {}).get("coordinates", [])
    depth = _safe_float(coordinates[2]) if len(coordinates) > 2 else 0.0

    earthquake_trigger_prob = _clamp(magnitude / EARTHQUAKE_NORMALIZATION_MAG)
    if depth > 50:
        earthquake_trigger_prob *= 0.8

    return {
        "magnitude": magnitude,
        "depth": depth,
        "earthquake_trigger_prob": _clamp(earthquake_trigger_prob),
        "trigger_earthquake": 1 if magnitude >= 4.0 else 0
    }


# ---------------------------------------
# ELEVATION ADAPTER
# ---------------------------------------
def adapt_elevation_api(elevation_points):
    elevation_points = _extract_elevations(elevation_points)

    if len(elevation_points) < 2:
        elevation = elevation_points[0] if elevation_points else 0.0
        return {
            "slope": 0.0,
            "slope_angle": 0.0,
            "slope_trigger": 0,
            "slope_trigger_prob": 0.0,
            "elevation": elevation
        }

    e1, e2 = elevation_points[0], elevation_points[1]
    slope = abs(e2 - e1)
    slope_angle = abs(math.atan(slope / ELEVATION_POINT_DISTANCE_METERS) * (180 / math.pi))

    return {
        "slope": slope,
        "slope_angle": slope_angle,
        "slope_trigger": 1 if slope > SLOPE_TRIGGER_THRESHOLD_METERS else 0,
        "slope_trigger_prob": _clamp(slope / SLOPE_NORMALIZATION_METERS),
        "elevation": max(elevation_points)
    }


def build_ml_input(feature_cols, weather_out, quake_out, terrain_out=None):
    terrain_out = terrain_out or {}

    rainfall_prob = weather_out.get("rainfall_trigger_prob", 0.0)
    earthquake_prob = quake_out.get("earthquake_trigger_prob", 0.0)
    slope_prob = terrain_out.get("slope_trigger_prob", 0.0)
    slope_trigger = terrain_out.get("slope_trigger", 0)

    human_activity_trigger_prob = _clamp(
        (0.50 * slope_prob) +
        (0.30 * rainfall_prob) +
        (0.20 * earthquake_prob)
    )
    physical_event_intensity = _clamp(
        (0.45 * rainfall_prob) +
        (0.35 * earthquake_prob) +
        (0.20 * slope_prob)
    )
    field_based = (slope_prob ** 3) * FIELD_BASED_SCALE

    engineered_input = {
        "monsoon_2014": weather_out.get("monsoon_2014", 0),
        "monsoon_2017": weather_out.get("monsoon_2017", 0),
        "rainfall_trigger_prob": rainfall_prob,
        "earthquake_trigger_prob": earthquake_prob,
        "human_activity_trigger_prob": human_activity_trigger_prob,
        "field_based": field_based,
        "event_based": EVENT_BASED_BASELINE - (physical_event_intensity * EVENT_BASED_RANGE),
        "trigger_anthropogenic": 1 if human_activity_trigger_prob >= 0.5 else 0,
        "trigger_earthquake": quake_out.get("trigger_earthquake", 0),
        "trigger_rainfall": weather_out.get("trigger_rainfall", 0),
        # Debug/forward-compatible fields. They are kept out of the model frame
        # unless the trained feature list explicitly contains them.
        "slope": terrain_out.get("slope", 0.0),
        "slope_trigger": slope_trigger,
        "slope_angle": terrain_out.get("slope_angle", 0.0),
        "elevation": terrain_out.get("elevation", 0.0),
        "rainfall": weather_out.get("rainfall", 0.0),
        "earthquake_magnitude": quake_out.get("magnitude", 0.0),
        "temperature": weather_out.get("context", {}).get("temperature", 0.0),
        "humidity": weather_out.get("context", {}).get("humidity", 0.0),
    }

    ml_input = dict.fromkeys(feature_cols, 0.0)
    for key, value in engineered_input.items():
        ml_input[key] = value

    return ml_input

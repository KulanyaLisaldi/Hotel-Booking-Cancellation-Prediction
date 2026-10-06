import math
import sys
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import joblib

PREPROCESSOR_PATH = PROJECT_ROOT / "final_preprocessor.pkl"
MODEL_PATH = PROJECT_ROOT / "final_random_forest.pkl"

final_preprocessor = joblib.load(PREPROCESSOR_PATH)
final_random_forest = joblib.load(MODEL_PATH)

REQUIRED_FEATURES = [
    "hotel",
    "lead_time",
    "arrival_date_year",
    "arrival_date_month",
    "arrival_date_week_number",
    "arrival_date_day_of_month",
    "meal",
    "country",
    "market_segment",
    "distribution_channel",
    "is_repeated_guest",
    "previous_cancellations",
    "previous_bookings_not_canceled",
    "reserved_room_type",
    "deposit_type",
    "customer_type",
    "adr",
    "required_car_parking_spaces",
    "total_of_special_requests",
    "total_stay",
    "total_guests",
]

CATEGORICAL_FEATURES = [
    "hotel",
    "arrival_date_month",
    "meal",
    "country",
    "market_segment",
    "distribution_channel",
    "reserved_room_type",
    "deposit_type",
    "customer_type",
]

MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]

INTEGER_RULES = {
    "lead_time": (
        "Must be an integer greater than or equal to 0.",
        lambda value: value >= 0,
    ),
    "arrival_date_year": (
        "Must be an integer greater than or equal to 2000.",
        lambda value: value >= 2000,
    ),
    "arrival_date_week_number": (
        "Must be an integer between 1 and 53.",
        lambda value: 1 <= value <= 53,
    ),
    "arrival_date_day_of_month": (
        "Must be an integer between 1 and 31.",
        lambda value: 1 <= value <= 31,
    ),
    "is_repeated_guest": (
        "Must be 0 or 1.",
        lambda value: value in (0, 1),
    ),
    "previous_cancellations": (
        "Must be an integer greater than or equal to 0.",
        lambda value: value >= 0,
    ),
    "previous_bookings_not_canceled": (
        "Must be an integer greater than or equal to 0.",
        lambda value: value >= 0,
    ),
    "required_car_parking_spaces": (
        "Must be an integer greater than or equal to 0.",
        lambda value: value >= 0,
    ),
    "total_of_special_requests": (
        "Must be an integer greater than or equal to 0.",
        lambda value: value >= 0,
    ),
    "total_stay": (
        "Must be an integer greater than or equal to 0.",
        lambda value: value >= 0,
    ),
    "total_guests": (
        "Must be an integer greater than or equal to 1.",
        lambda value: value >= 1,
    ),
}

LEARNED_CATEGORIES = {
    column: [str(category) for category in categories]
    for column, categories in zip(
        final_preprocessor.categorical_columns,
        final_preprocessor.encoder.categories_,
    )
}
LEARNED_CATEGORY_SETS = {
    column: set(categories)
    for column, categories in LEARNED_CATEGORIES.items()
}

app = Flask(__name__)
CORS(app)


def is_integer_value(value):
    return isinstance(value, int) and not isinstance(value, bool)


def is_numeric_value(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    if isinstance(value, float) and not math.isfinite(value):
        return False
    return True


def category_error(field):
    allowed = LEARNED_CATEGORIES[field]
    if field == "country":
        return "Must be a country code learned during training."
    if len(allowed) <= 12:
        return "Must be one of: " + ", ".join(allowed) + "."
    return "Must be a category learned during training."


def validate_categorical(field, value):
    if not isinstance(value, str):
        return "Must be a text value."
    if value.strip() == "":
        return "Value cannot be empty."
    if field == "arrival_date_month":
        if value not in MONTHS or value not in LEARNED_CATEGORY_SETS[field]:
            return "Must be a full English month name, from January through December."
        return None
    if value not in LEARNED_CATEGORY_SETS[field]:
        return category_error(field)
    return None


def validate_input(payload):
    errors = {}
    for field in REQUIRED_FEATURES:
        value = payload[field]
        if value is None:
            errors[field] = "Value is required."
            continue

        if field in CATEGORICAL_FEATURES:
            error = validate_categorical(field, value)
        elif field == "adr":
            error = None if is_numeric_value(value) else "Must be a number."
        else:
            message, is_in_range = INTEGER_RULES[field]
            error = None if is_integer_value(value) and is_in_range(value) else message

        if error:
            errors[field] = error
    return errors


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Hotel Booking Cancellation Prediction API is running",
        "model_loaded": final_random_forest is not None,
        "preprocessor_loaded": final_preprocessor is not None,
    })


@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({
            "error": "Request body must be a JSON object.",
        }), 400

    missing_fields = [
        field for field in REQUIRED_FEATURES
        if field not in payload
    ]
    if missing_fields:
        return jsonify({
            "error": "Missing required fields.",
            "missing_fields": missing_fields,
        }), 400

    validation_errors = validate_input(payload)
    if validation_errors:
        return jsonify({
            "error": "Invalid input.",
            "validation_errors": validation_errors,
        }), 400

    try:
        input_df = pd.DataFrame(
            [[payload[field] for field in REQUIRED_FEATURES]],
            columns=REQUIRED_FEATURES,
        )
        transformed = final_preprocessor.transform(input_df)

        if transformed.shape[1] != final_random_forest.n_features_in_:
            return jsonify({
                "error": "Transformed feature count does not match the trained model.",
            }), 500

        prediction = int(final_random_forest.predict(transformed)[0])
        probabilities = final_random_forest.predict_proba(transformed)[0]
        probability_by_class = {
            int(class_label): float(class_probability)
            for class_label, class_probability in zip(
                final_random_forest.classes_,
                probabilities,
            )
        }

        if prediction == 1:
            prediction_label = "Cancelled"
        elif prediction == 0:
            prediction_label = "Not Cancelled"
        else:
            return jsonify({
                "error": "Unexpected prediction class.",
            }), 500

        if 0 not in probability_by_class or 1 not in probability_by_class:
            return jsonify({
                "error": "Model probability classes are unavailable.",
            }), 500

        return jsonify({
            "prediction": prediction,
            "prediction_label": prediction_label,
            "probability_not_cancelled": probability_by_class[0],
            "probability_cancelled": probability_by_class[1],
        })
    except (TypeError, ValueError, KeyError):
        return jsonify({
            "error": "Invalid input for prediction.",
        }), 400
    except Exception:
        app.logger.exception("Prediction failed")
        return jsonify({
            "error": "Prediction failed.",
        }), 500


if __name__ == "__main__":
    app.run(debug=True)

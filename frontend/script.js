const predictionForm = document.getElementById("prediction-form");
const predictionResult = document.getElementById("prediction-result");
const predictButton = document.getElementById("predict-button");
const resetButton = document.getElementById("reset-button");

const PREDICT_URL = "http://127.0.0.1:5000/predict";

const FEATURE_NAMES = [
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
];

const NUMERIC_FIELDS = new Set([
    "lead_time",
    "arrival_date_year",
    "arrival_date_week_number",
    "arrival_date_day_of_month",
    "is_repeated_guest",
    "previous_cancellations",
    "previous_bookings_not_canceled",
    "adr",
    "required_car_parking_spaces",
    "total_of_special_requests",
    "total_stay",
    "total_guests",
]);

function readPayload() {
    const payload = {};

    FEATURE_NAMES.forEach(function (name) {
        const value = predictionForm.elements[name].value;
        payload[name] = NUMERIC_FIELDS.has(name) ? Number(value) : value;
    });

    return payload;
}

function formatPercent(value) {
    return (Number(value) * 100).toFixed(2) + "%";
}

function clearResultState() {
    predictionResult.classList.remove("cancelled", "not-cancelled");
}

function showMessage(message) {
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    predictionResult.hidden = false;
    clearResultState();
    predictionResult.replaceChildren(paragraph);
}

function showPrediction(data) {
    clearResultState();

    if (data.prediction_label === "Cancelled") {
        predictionResult.classList.add("cancelled");
    } else if (data.prediction_label === "Not Cancelled") {
        predictionResult.classList.add("not-cancelled");
    }

    const prediction = document.createElement("p");
    prediction.textContent = "Prediction: " + data.prediction_label;

    const cancellationProbability = document.createElement("p");
    cancellationProbability.textContent =
        "Cancellation Probability: " + formatPercent(data.probability_cancelled);

    const notCancellationProbability = document.createElement("p");
    notCancellationProbability.textContent =
        "Not Cancellation Probability: " + formatPercent(data.probability_not_cancelled);

    predictionResult.hidden = false;
    predictionResult.replaceChildren(
        prediction,
        cancellationProbability,
        notCancellationProbability
    );
}

function showValidationError(data) {
    clearResultState();

    const intro = document.createElement("p");
    intro.textContent = "The booking details could not be predicted.";

    const list = document.createElement("ul");

    if (data.validation_errors && typeof data.validation_errors === "object") {
        Object.keys(data.validation_errors).forEach(function (field) {
            const item = document.createElement("li");
            item.textContent = field + ": " + data.validation_errors[field];
            list.appendChild(item);
        });
    }

    if (Array.isArray(data.missing_fields)) {
        data.missing_fields.forEach(function (field) {
            const item = document.createElement("li");
            item.textContent = "Missing required field: " + field;
            list.appendChild(item);
        });
    }

    predictionResult.hidden = false;

    if (list.childElementCount > 0) {
        predictionResult.replaceChildren(intro, list);
        return;
    }

    const fallback = document.createElement("p");
    fallback.textContent = typeof data.error === "string"
        ? data.error
        : "The prediction request was rejected.";
    predictionResult.replaceChildren(fallback);
}

predictionForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    predictButton.disabled = true;
    predictButton.textContent = "Predicting...";

    try {
        const payload = readPayload();
        const response = await fetch(PREDICT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            showMessage("The prediction server returned an unexpected response.");
            return;
        }

        if (!response.ok) {
            showValidationError(data);
            return;
        }

        showPrediction(data);
    } catch (error) {
        showMessage(
            "Could not connect to the prediction server. Please make sure the Flask backend is running."
        );
    } finally {
        predictButton.disabled = false;
        predictButton.textContent = "Predict Cancellation";
    }
});

resetButton.addEventListener("click", function () {
    predictionForm.reset();
    predictionResult.hidden = true;
    predictionResult.classList.remove("cancelled", "not-cancelled");
    predictionResult.replaceChildren();
});

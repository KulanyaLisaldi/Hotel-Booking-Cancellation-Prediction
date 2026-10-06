const predictionForm = document.getElementById("prediction-form");
const predictionResult = document.getElementById("prediction-result");
const predictButton = document.getElementById("predict-button");
const resetButton = document.getElementById("reset-button");
const backButton = document.getElementById("back-button");
const nextButton = document.getElementById("next-button");
const reviewSummary = document.getElementById("review-summary");
const stepError = document.getElementById("step-error");
const formSteps = Array.from(document.querySelectorAll(".form-step"));
const progressSteps = Array.from(document.querySelectorAll(".progress-step"));

const PREDICT_URL = "http://127.0.0.1:5000/predict";
const STEP_COUNT = 5;

let currentStep = 1;

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

function hideResult() {
    predictionResult.hidden = true;
    clearResultState();
    predictionResult.replaceChildren();
}

function showMessage(message) {
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    predictionResult.hidden = false;
    clearResultState();
    predictionResult.replaceChildren(paragraph);
    predictionResult.scrollIntoView({ block: "nearest" });
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
    predictionResult.scrollIntoView({ block: "nearest" });
}

function showValidationError(data) {
    clearResultState();

    const intro = document.createElement("p");
    intro.textContent = typeof data.error === "string"
        ? data.error
        : "The booking details could not be predicted.";

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

    if (Array.isArray(data.unexpected_fields)) {
        data.unexpected_fields.forEach(function (field) {
            const item = document.createElement("li");
            item.textContent = "Unexpected field: " + field;
            list.appendChild(item);
        });
    }

    predictionResult.hidden = false;

    if (list.childElementCount > 0) {
        predictionResult.replaceChildren(intro, list);
        predictionResult.scrollIntoView({ block: "nearest" });
        return;
    }

    const fallback = document.createElement("p");
    fallback.textContent = typeof data.error === "string"
        ? data.error
        : "The prediction request was rejected.";
    predictionResult.replaceChildren(fallback);
    predictionResult.scrollIntoView({ block: "nearest" });
}

function fieldsInStep(step) {
    return Array.from(formSteps[step - 1].querySelectorAll("input, select, textarea"));
}

function fieldLabel(field) {
    const label = predictionForm.querySelector('label[for="' + field.id + '"]');
    return label ? label.textContent : field.name;
}

function clearFieldErrors(fields) {
    fields.forEach(function (field) {
        field.classList.remove("is-invalid");
        field.removeAttribute("aria-invalid");
    });
}

function clearStepError() {
    stepError.hidden = true;
    stepError.replaceChildren();
}

function prepareFieldValidity(step) {
    fieldsInStep(step).forEach(function (field) {
        field.setCustomValidity("");
    });

    if (step === 3 && predictionForm.elements.country.value.trim() === "") {
        predictionForm.elements.country.setCustomValidity(
            "Enter a country code. The value cannot be empty."
        );
    }
}

function collectInvalidFields(step) {
    prepareFieldValidity(step);
    return fieldsInStep(step).filter(function (field) {
        return !field.checkValidity();
    });
}

function showStepError(fields) {
    const intro = document.createElement("p");
    intro.textContent = "Please correct the following before continuing.";

    const list = document.createElement("ul");
    fields.forEach(function (field) {
        const item = document.createElement("li");
        item.textContent = fieldLabel(field) + ": " + field.validationMessage;
        list.appendChild(item);
    });

    stepError.hidden = false;
    stepError.replaceChildren(intro, list);
    stepError.scrollIntoView({ block: "nearest" });
}

function markInvalid(fields) {
    fields.forEach(function (field) {
        field.classList.add("is-invalid");
        field.setAttribute("aria-invalid", "true");
    });
    showStepError(fields);
    fields[0].focus();
    fields[0].reportValidity();
}

function validateStep(step) {
    const fields = fieldsInStep(step);
    clearFieldErrors(fields);
    const invalid = collectInvalidFields(step);

    if (invalid.length === 0) {
        clearStepError();
        return true;
    }

    markInvalid(invalid);
    return false;
}

function findFirstInvalidStep() {
    for (let step = 1; step <= 4; step += 1) {
        if (collectInvalidFields(step).length > 0) {
            return step;
        }
    }
    return null;
}

function renderReview() {
    reviewSummary.replaceChildren();

    formSteps.slice(0, 4).forEach(function (section) {
        Array.from(section.querySelectorAll("input, select, textarea")).forEach(function (field) {
            const item = document.createElement("div");
            item.className = "review-item";

            const term = document.createElement("dt");
            term.textContent = fieldLabel(field);

            const description = document.createElement("dd");
            if (field.tagName === "SELECT" && field.selectedIndex >= 0) {
                description.textContent = field.options[field.selectedIndex].textContent;
            } else {
                description.textContent = field.value;
            }

            item.append(term, description);
            reviewSummary.appendChild(item);
        });
    });
}

function showStep(step, options) {
    currentStep = step;

    formSteps.forEach(function (section, index) {
        section.hidden = index + 1 !== step;
    });

    progressSteps.forEach(function (item, index) {
        const itemStep = index + 1;
        item.classList.toggle("is-active", itemStep === step);
        item.classList.toggle("is-complete", itemStep < step);
        if (itemStep === step) {
            item.setAttribute("aria-current", "step");
        } else {
            item.removeAttribute("aria-current");
        }
    });

    backButton.hidden = step === 1;
    nextButton.hidden = step === STEP_COUNT;
    predictButton.hidden = step !== STEP_COUNT;
    resetButton.hidden = step !== STEP_COUNT;
    clearStepError();

    if (step === STEP_COUNT) {
        renderReview();
    }

    if (options && options.focus) {
        const heading = formSteps[step - 1].querySelector("h2");
        if (heading) {
            heading.setAttribute("tabindex", "-1");
            heading.focus();
        }
    }
}

function setBusy(isBusy) {
    predictButton.disabled = isBusy;
    backButton.disabled = isBusy;
    nextButton.disabled = isBusy;
    resetButton.disabled = isBusy;
    predictButton.textContent = isBusy ? "Predicting..." : "Predict Cancellation";
}

function clearResolvedFieldError(event) {
    const field = event.target;
    if (!field.classList || !field.classList.contains("is-invalid")) {
        return;
    }
    if (typeof field.setCustomValidity === "function") {
        field.setCustomValidity("");
    }
    if (typeof field.checkValidity === "function" && field.checkValidity()) {
        field.classList.remove("is-invalid");
        field.removeAttribute("aria-invalid");
    }
}

predictionForm.addEventListener("input", clearResolvedFieldError);
predictionForm.addEventListener("change", clearResolvedFieldError);

predictionForm.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") {
        return;
    }
    const tag = event.target.tagName;
    if (tag !== "INPUT" && tag !== "SELECT") {
        return;
    }
    if (currentStep === STEP_COUNT) {
        return;
    }
    event.preventDefault();
    nextButton.click();
});

nextButton.addEventListener("click", function () {
    if (!validateStep(currentStep)) {
        return;
    }
    hideResult();
    showStep(currentStep + 1, { focus: true });
});

backButton.addEventListener("click", function () {
    if (currentStep === 1) {
        return;
    }
    hideResult();
    showStep(currentStep - 1, { focus: true });
});

predictButton.addEventListener("click", function (event) {
    const invalidStep = findFirstInvalidStep();
    if (invalidStep === null) {
        return;
    }
    event.preventDefault();
    showStep(invalidStep);
    validateStep(invalidStep);
});

predictionForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (currentStep !== STEP_COUNT) {
        return;
    }

    const invalidStep = findFirstInvalidStep();
    if (invalidStep !== null) {
        showStep(invalidStep);
        validateStep(invalidStep);
        return;
    }

    setBusy(true);

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
        setBusy(false);
    }
});

resetButton.addEventListener("click", function () {
    predictionForm.reset();
    formSteps.slice(0, 4).forEach(function (section) {
        clearFieldErrors(Array.from(section.querySelectorAll("input, select, textarea")));
    });
    fieldsInStep(3).forEach(function (field) {
        field.setCustomValidity("");
    });
    reviewSummary.replaceChildren();
    hideResult();
    showStep(1);
});

showStep(1);

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
const REQUIRED_MESSAGE = "This field is required.";

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

const FIELD_RULES = {
    lead_time: {
        integer: true,
        min: 0,
        invalidNumber: "Lead Time must be a whole number.",
        outOfRange: "Lead Time cannot be negative.",
    },
    arrival_date_year: {
        integer: true,
        min: 2000,
        invalidNumber: "Arrival Year must be a whole number.",
        outOfRange: "Arrival Year must be 2000 or later.",
    },
    arrival_date_week_number: {
        integer: true,
        min: 1,
        max: 53,
        invalidNumber: "Arrival Week Number must be between 1 and 53.",
        outOfRange: "Arrival Week Number must be between 1 and 53.",
    },
    arrival_date_day_of_month: {
        integer: true,
        min: 1,
        max: 31,
        invalidNumber: "Arrival Day must be between 1 and 31.",
        outOfRange: "Arrival Day must be between 1 and 31.",
    },
    total_stay: {
        integer: true,
        min: 0,
        invalidNumber: "Total Stay must be a whole number.",
        outOfRange: "Total Stay cannot be negative.",
    },
    total_guests: {
        integer: true,
        min: 1,
        invalidNumber: "Total Guests must be at least 1.",
        outOfRange: "Total Guests must be at least 1.",
    },
    previous_cancellations: {
        integer: true,
        min: 0,
        invalidNumber: "Previous Cancellations cannot be negative.",
        outOfRange: "Previous Cancellations cannot be negative.",
    },
    previous_bookings_not_canceled: {
        integer: true,
        min: 0,
        invalidNumber: "Previous Bookings Not Canceled cannot be negative.",
        outOfRange: "Previous Bookings Not Canceled cannot be negative.",
    },
    adr: {
        integer: false,
        min: 0,
        invalidNumber: "ADR must be a valid number.",
        outOfRange: "ADR cannot be negative.",
    },
    required_car_parking_spaces: {
        integer: true,
        min: 0,
        invalidNumber: "Parking Spaces cannot be negative.",
        outOfRange: "Parking Spaces cannot be negative.",
    },
    total_of_special_requests: {
        integer: true,
        min: 0,
        invalidNumber: "Special Requests cannot be negative.",
        outOfRange: "Special Requests cannot be negative.",
    },
};

function readPayload() {
    commitCountry();
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

function errorElement(field) {
    return document.getElementById(field.id + "-error");
}

function stepForField(field) {
    const section = field.closest(".form-step");
    return section ? Number(section.dataset.step) : 1;
}

function commitCountry() {
    const field = predictionForm.elements.country;
    const normalized = field.value.trim().toUpperCase();
    if (field.value !== normalized) {
        field.value = normalized;
    }
}

function isIntegerText(text) {
    return /^-?\d+$/.test(text);
}

function isDecimalText(text) {
    return /^-?(?:\d+\.?\d*|\.\d+)$/.test(text) && Number.isFinite(Number(text));
}

function messageFor(field) {
    if (field.tagName === "SELECT") {
        const allowed = Array.from(field.options).some(function (option) {
            return option.value === field.value;
        });
        return field.value !== "" && allowed ? "" : REQUIRED_MESSAGE;
    }

    if (field.name === "country") {
        return field.value.trim() === "" ? REQUIRED_MESSAGE : "";
    }

    const rule = FIELD_RULES[field.name];
    if (!rule) {
        return field.value.trim() === "" ? REQUIRED_MESSAGE : "";
    }

    if (field.validity && field.validity.badInput) {
        return rule.invalidNumber;
    }

    const text = field.value.trim();
    if (text === "") {
        return REQUIRED_MESSAGE;
    }

    if (rule.integer) {
        if (!isIntegerText(text)) {
            return rule.invalidNumber;
        }
        const value = Number(text);
        if (value < rule.min || (rule.max !== undefined && value > rule.max)) {
            return rule.outOfRange;
        }
        return "";
    }

    if (!isDecimalText(text)) {
        return rule.invalidNumber;
    }
    if (Number(text) < rule.min) {
        return rule.outOfRange;
    }
    return "";
}

function showFieldError(field, message) {
    const error = errorElement(field);
    field.classList.add("input-invalid");
    field.setAttribute("aria-invalid", "true");
    if (!error) {
        return;
    }
    error.hidden = false;
    error.textContent = message;
    field.setAttribute("aria-describedby", error.id);
}

function clearFieldError(field) {
    const error = errorElement(field);
    field.classList.remove("input-invalid");
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    if (!error) {
        return;
    }
    error.hidden = true;
    error.textContent = "";
}

function clearAllFieldErrors() {
    FEATURE_NAMES.forEach(function (name) {
        clearFieldError(predictionForm.elements[name]);
    });
}

function applyStepErrors(step) {
    const fields = fieldsInStep(step);
    let firstInvalid = null;

    fields.forEach(function (field) {
        const message = messageFor(field);
        if (message) {
            showFieldError(field, message);
            if (!firstInvalid) {
                firstInvalid = field;
            }
            return;
        }
        clearFieldError(field);
    });

    if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ block: "nearest" });
    }

    return firstInvalid === null;
}

function firstInvalidStep() {
    commitCountry();
    for (let step = 1; step <= 4; step += 1) {
        const invalid = fieldsInStep(step).some(function (field) {
            return messageFor(field) !== "";
        });
        if (invalid) {
            return step;
        }
    }
    return null;
}

function blockInvalidSubmission() {
    const step = firstInvalidStep();
    if (step === null) {
        return false;
    }
    showStep(step);
    applyStepErrors(step);
    return true;
}

function clearStepError() {
    stepError.hidden = true;
    stepError.replaceChildren();
}

function refreshFieldError(field) {
    if (!field || !field.classList || !field.classList.contains("input-invalid")) {
        return;
    }
    const message = messageFor(field);
    if (message) {
        showFieldError(field, message);
        return;
    }
    clearFieldError(field);
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

    if (options && options.focusHeading) {
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

function showBackendFieldErrors(data) {
    const validationErrors = data.validation_errors;
    if (!validationErrors || typeof validationErrors !== "object") {
        return false;
    }

    let firstField = null;
    Object.keys(validationErrors).forEach(function (name) {
        const field = predictionForm.elements[name];
        if (!field) {
            return;
        }
        showFieldError(field, String(validationErrors[name]));
        if (!firstField || stepForField(field) < stepForField(firstField)) {
            firstField = field;
        }
    });

    if (!firstField) {
        return false;
    }

    showStep(stepForField(firstField));
    firstField.focus();
    firstField.scrollIntoView({ block: "nearest" });
    return true;
}

function responseHasGeneralError(data) {
    if (Array.isArray(data.missing_fields) && data.missing_fields.length > 0) {
        return true;
    }
    if (Array.isArray(data.unexpected_fields) && data.unexpected_fields.length > 0) {
        return true;
    }
    if (!data.validation_errors || typeof data.validation_errors !== "object") {
        return typeof data.error === "string";
    }
    return Object.keys(data.validation_errors).some(function (name) {
        return !predictionForm.elements[name];
    });
}

predictionForm.addEventListener("input", function (event) {
    refreshFieldError(event.target);
});

predictionForm.addEventListener("change", function (event) {
    refreshFieldError(event.target);
});

predictionForm.elements.country.addEventListener("blur", function () {
    commitCountry();
    refreshFieldError(predictionForm.elements.country);
});

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
    if (currentStep === 3) {
        commitCountry();
    }
    if (!applyStepErrors(currentStep)) {
        return;
    }
    hideResult();
    showStep(currentStep + 1, { focusHeading: true });
});

backButton.addEventListener("click", function () {
    if (currentStep === 1) {
        return;
    }
    hideResult();
    showStep(currentStep - 1, { focusHeading: true });
});

predictButton.addEventListener("click", function (event) {
    if (blockInvalidSubmission()) {
        event.preventDefault();
    }
});

predictionForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (currentStep !== STEP_COUNT) {
        return;
    }

    if (blockInvalidSubmission()) {
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
            const mapped = showBackendFieldErrors(data);
            if (!mapped || responseHasGeneralError(data)) {
                showValidationError(data);
            } else {
                hideResult();
            }
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
    clearAllFieldErrors();
    reviewSummary.replaceChildren();
    hideResult();
    showStep(1);
});

showStep(1);

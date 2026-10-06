# Hotel Booking Cancellation Prediction Using Machine Learning

## 1. Project Overview

This project predicts whether a hotel booking is likely to be cancelled. It uses a machine-learning model trained on historical hotel booking records.

The prediction target is `is_canceled`:

- `0` = Not Cancelled
- `1` = Cancelled

The final model is a tuned Random Forest Classifier. The reported results describe performance on the evaluation data. They are not a claim of perfect accuracy.

## 2. Dataset

The project uses the Hotel Booking Demand dataset, stored in this project as `hotel_bookings.csv`.

- Original dataset: 119,390 rows and 32 columns
- After cleaning and feature engineering: 85,134 rows and 27 columns

The 27-column table is the cleaned dataset after `total_stay` and `total_guests` were added. The five original stay and guest component columns were still present at that stage. They were removed later, before the final model was trained.

The cleaned data was split before encoding and scaling:

- 80% training: 68,107 rows
- 20% testing: 17,027 rows

The split used stratification on `is_canceled` and `random_state=42`, so the class proportions were preserved and the split can be repeated.

## 3. Data Preparation

The notebook applied the following preparation steps before modelling:

- Missing `country` values were filled with the category `Unknown`.
- Four missing `children` values were filled with the median, which was 0.
- Exact duplicate rows were removed, and one copy of each identical record was kept.
- Bookings with zero total guests were removed.
- One negative ADR value and one extreme ADR value of 5400 were removed. Other high positive ADR values were kept.
- Leakage features were removed: `reservation_status` and `reservation_status_date`.
- Timing-sensitive features were removed: `assigned_room_type`, `booking_changes`, and `days_in_waiting_list`.
- `company` and `agent` were also removed. `company` was mostly missing, and `agent` was a high-cardinality identifier.
- Categorical inputs were one-hot encoded.
- Numerical inputs were scaled with `StandardScaler`.
- The binary input `is_repeated_guest` was left as 0 or 1.

Two features were engineered from existing columns:

```text
total_stay = stays_in_weekend_nights + stays_in_week_nights
total_guests = adults + children + babies
```

These five component features were then removed from the final model inputs, because the engineered totals already represent them:

- `stays_in_weekend_nights`
- `stays_in_week_nights`
- `adults`
- `children`
- `babies`

After that selection, 21 raw predictors remained. Encoding expanded them to 236 features.

## 4. Models Evaluated

Four classifiers were evaluated:

- Logistic Regression
- Decision Tree
- Random Forest
- Gradient Boosting

Each model was compared with stratified 5-fold cross-validation. The primary selection metric was ROC-AUC. Accuracy, precision, recall, and F1-score were also recorded.

## 5. Final Model Performance

The final model is the tuned Random Forest. It was selected primarily because it achieved the strongest ROC-AUC performance.

Tuned cross-validation ROC-AUC: 0.8883

Test results:

- ROC-AUC: 0.8945
- Accuracy: 0.8282
- Precision: 0.7658
- Recall: 0.5465
- F1-score: 0.6378

## 6. Deployment Architecture

The web application sends one booking through the saved preprocessor and then through the saved model:

```text
21 raw booking inputs
        ↓
final_preprocessor.pkl
        ↓
236 transformed features
        ↓
final_random_forest.pkl
        ↓
Prediction and probabilities
```

The 21 inputs are transformed as follows:

- 9 categorical inputs are one-hot encoded
- 11 numerical inputs are scaled with `StandardScaler`
- 1 binary input, `is_repeated_guest`, is passed through unchanged

The model returns class `0` or `1`, together with the probability of each class.

## 7. Technologies Used

The deployed application uses:

- Python 3.14
- Flask
- Flask-Cors
- pandas
- NumPy
- scikit-learn
- joblib
- SciPy
- HTML
- CSS
- Vanilla JavaScript

No database is required for the current prediction application.

## 8. Project Structure

Important files in the project root and application folders:

- `backend/app.py` — Flask API. It loads the saved preprocessor and model, validates the 21 booking inputs, and returns the prediction.
- `frontend/index.html` — booking form, page layout, and result area.
- `frontend/style.css` — visual styling for the form, buttons, and result card.
- `frontend/script.js` — sends the form to the prediction API and displays the returned result.
- `final_random_forest.pkl` — saved tuned Random Forest used by the API.
- `final_preprocessor.pkl` — saved 21-input preprocessor used by the deployed application.
- `fitted_final_preprocessor.py` — Python class required to load `final_preprocessor.pkl`.
- `preprocessor.pkl` — earlier preprocessing artifact fitted on 26 raw columns. The deployed application does not use this file.
- `hotel_bookings.csv` — Hotel Booking Demand dataset used in the notebook.
- `Hotel_Booking_Cancellation_Evaluation1.ipynb` — notebook containing the data preparation, model evaluation, and saved results.
- `requirements.txt` — pinned Python packages needed to run the prediction application.

`preprocessor.pkl` is kept as the earlier fitted preprocessor. The running application uses `final_preprocessor.pkl`.

## 9. How to Run the Project

Use two terminals. Start both commands from the project root unless a step says otherwise, and leave both terminals open while using the application.

Install the dependencies once:

```text
python -m pip install -r requirements.txt
```

Start the backend:

```text
python backend\app.py
```

Flask runs at:

```text
http://127.0.0.1:5000
```

Open a second terminal, move into the frontend folder, and start the page server:

```text
cd frontend
python -m http.server 5500
```

Open the application at:

```text
http://127.0.0.1:5500
```

Both terminals should remain running while the application is in use. The page sends booking details to the Flask server on port 5000.

## 10. API Endpoints

`GET /`

Checks that the backend is running and that the model and preprocessor have been loaded.

`POST /predict`

Receives the 21 booking details and returns the cancellation prediction. A successful response includes:

- `prediction`
- `prediction_label`
- `probability_cancelled`
- `probability_not_cancelled`

`prediction` is `0` for Not Cancelled and `1` for Cancelled. The two probability fields are the model's estimated probabilities for those classes. Invalid or incomplete input is rejected by the backend.

## 11. Application Features

The current application includes:

- a 21-input booking form
- backend validation of required fields, types, and allowed ranges
- categorical validation against the categories learned during training
- a cancellation prediction
- display of the cancellation and not-cancellation probabilities
- a responsive layout for wider and smaller screens
- a prediction result card
- a Reset Form button that clears the form and the displayed result without calling the API

## 12. Important Note

This is an academic machine-learning mini-project. A prediction reflects patterns learned from the historical Hotel Booking Demand dataset. It is an estimate of cancellation risk, not a guaranteed outcome for a future booking.

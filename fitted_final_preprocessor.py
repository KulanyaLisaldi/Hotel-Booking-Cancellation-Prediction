"""21-input deployment preprocessor built from the fitted 26-input preprocessor.

The class must live in this importable module so joblib can reload
final_preprocessor.pkl in a later process.
"""

from copy import deepcopy

import numpy as np
from scipy import sparse
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import StandardScaler

REMOVED_NUMERIC = [
    "stays_in_weekend_nights",
    "stays_in_week_nights",
    "adults",
    "children",
    "babies",
]


def slice_fitted_scaler(old_scaler, removed_names):
    """Copy StandardScaler statistics, omitting the removed numeric columns."""
    old_names = list(old_scaler.feature_names_in_)
    if old_names[4:9] != removed_names:
        raise ValueError(
            "Saved scaler columns 4:9 are not the five removed component features."
        )

    keep_idx = [i for i, name in enumerate(old_names) if name not in removed_names]
    keep_names = [old_names[i] for i in keep_idx]

    scaler = StandardScaler(copy=True, with_mean=True, with_std=True)
    scaler.n_features_in_ = len(keep_idx)
    scaler.feature_names_in_ = np.asarray(keep_names, dtype=object)
    scaler.mean_ = np.asarray(old_scaler.mean_, dtype=np.float64)[keep_idx].copy()
    scaler.var_ = np.asarray(old_scaler.var_, dtype=np.float64)[keep_idx].copy()
    scaler.scale_ = np.asarray(old_scaler.scale_, dtype=np.float64)[keep_idx].copy()
    scaler.n_samples_seen_ = np.float64(old_scaler.n_samples_seen_)
    return scaler, keep_names


class FittedFinalPreprocessor(BaseEstimator, TransformerMixin):
    """21-input transformer using fitted state copied from preprocessor.pkl."""

    def __init__(
        self,
        encoder,
        scaler,
        categorical_columns,
        numerical_columns,
        binary_columns,
    ):
        self.encoder = encoder
        self.scaler = scaler
        self.categorical_columns = list(categorical_columns)
        self.numerical_columns = list(numerical_columns)
        self.binary_columns = list(binary_columns)

    def fit(self, X, y=None):
        # Statistics were copied from the saved training fit.
        return self

    def transform(self, X):
        categorical = self.encoder.transform(X[self.categorical_columns])
        numerical = self.scaler.transform(X[self.numerical_columns])
        binary = np.asarray(X[self.binary_columns], dtype=np.float64)
        return sparse.hstack([categorical, numerical, binary], format="csr")

    def get_feature_names_out(self):
        categorical_names = [
            f"categorical__{name}"
            for name in self.encoder.get_feature_names_out(self.categorical_columns)
        ]
        numerical_names = [f"numerical__{name}" for name in self.numerical_columns]
        binary_names = [f"binary__{name}" for name in self.binary_columns]
        return np.asarray(
            categorical_names + numerical_names + binary_names,
            dtype=object,
        )


def build_final_preprocessor(old_preprocessor):
    """Return a 21-input transformer using copied fitted state."""
    encoder = deepcopy(old_preprocessor.named_transformers_["categorical"])
    scaler, numerical_columns = slice_fitted_scaler(
        old_preprocessor.named_transformers_["numerical"],
        REMOVED_NUMERIC,
    )
    binary_columns = list(
        old_preprocessor.named_transformers_["binary"].feature_names_in_
    )
    return FittedFinalPreprocessor(
        encoder=encoder,
        scaler=scaler,
        categorical_columns=list(encoder.feature_names_in_),
        numerical_columns=numerical_columns,
        binary_columns=binary_columns,
    )

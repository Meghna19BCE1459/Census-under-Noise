"""
data_loader.py

Loads and cleans the UCI "Adult" (Census Income) dataset, and computes the
TRUE (non-private) aggregate statistics that every differentially private
query in this app is measured against.

Keeping "ground truth" computation totally separate from the DP mechanisms
(dp_engine.py) is deliberate: it makes it obvious, when reading the code,
exactly which numbers are sensitive (touch raw records) and which are safe
to hand to the frontend as-is (the DP-released ones).
"""
from functools import lru_cache
from pathlib import Path

import pandas as pd

DATA_PATH = Path(__file__).parent / "adult-all.csv"

COLUMNS = [
    "age", "workclass", "fnlwgt", "education", "education_num",
    "marital_status", "occupation", "relationship", "race", "sex",
    "capital_gain", "capital_loss", "hours_per_week", "native_country",
    "income",
]


@lru_cache(maxsize=1)
def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(
        DATA_PATH, header=None, names=COLUMNS,
        na_values="?", skipinitialspace=True,
    )
    df = df.dropna().reset_index(drop=True)
    df["income_bin"] = (df["income"].str.strip() == ">50K").astype(int)
    for col in ["workclass", "education", "marital_status", "occupation",
                "race", "sex", "native_country", "income"]:
        df[col] = df[col].str.strip()
    return df


def age_bounds():
    df = load_dataset()
    return float(df["age"].min()), float(df["age"].max())


def hours_bounds():
    df = load_dataset()
    return float(df["hours_per_week"].min()), float(df["hours_per_week"].max())


def dataset_size() -> int:
    return len(load_dataset())


def true_summary() -> dict:
    """Ground-truth aggregates, used only server-side to compute DP releases
    (and shown in the UI explicitly labelled 'true answer' for teaching
    purposes -- a production DP system would never expose this endpoint)."""
    df = load_dataset()
    n = len(df)
    amin, amax = age_bounds()
    hmin, hmax = hours_bounds()

    def cat_hist(col, top=10):
        vc = df[col].value_counts().head(top)
        return [{"label": k, "count": int(v)} for k, v in vc.items()]

    def bin_hist(series, edges):
        vc = pd.cut(series, bins=edges, right=False).value_counts().sort_index()
        return [
            {"label": f"{int(i.left)}-{int(i.right)}", "lo": float(i.left),
             "hi": float(i.right), "count": int(c)}
            for i, c in vc.items()
        ]

    age_bins = list(range(int(amin) - int(amin) % 5, int(amax) + 6, 5))
    hours_bins = list(range(0, int(hmax) + 11, 10))

    sex_income = (
        df.groupby("sex")["income_bin"].agg(["sum", "count"]).reset_index()
    )
    race_income = (
        df.groupby("race")["income_bin"].agg(["sum", "count"]).reset_index()
    )

    return {
        "n": n,
        "ageBounds": [amin, amax],
        "hoursBounds": [hmin, hmax],
        "meanAge": float(df["age"].mean()),
        "meanHours": float(df["hours_per_week"].mean()),
        "meanEducationNum": float(df["education_num"].mean()),
        "highEarnerCount": int(df["income_bin"].sum()),
        "lowEarnerCount": int(n - df["income_bin"].sum()),
        "ageHist": bin_hist(df["age"], age_bins),
        "hoursHist": bin_hist(df["hours_per_week"], hours_bins),
        "educationHist": cat_hist("education"),
        "workclassHist": cat_hist("workclass"),
        "raceHist": cat_hist("race"),
        "sexHist": cat_hist("sex"),
        "sexIncome": [
            {"group": r["sex"], "highEarners": int(r["sum"]), "total": int(r["count"])}
            for _, r in sex_income.iterrows()
        ],
        "raceIncome": [
            {"group": r["race"], "highEarners": int(r["sum"]), "total": int(r["count"])}
            for _, r in race_income.iterrows()
        ],
    }

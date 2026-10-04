"""Derive US adult prevalence weights for models/us-lifestyle-2026.olm.

Population-average normalization (spec/OLM-SPEC.md section 4.2) needs the share
of the population in each level of each factor. This script computes them from
NHANES 2017-March 2020 prepandemic public-use files, using the survey weights,
for adults aged 20 and over.

Data (public domain, US federal government):
  https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/default.aspx?Cycle=2017-2020
  Files: P_DEMO.xpt, P_BMX.xpt, P_SMQ.xpt, P_PAQ.xpt

Usage:
  python3 -m venv .venv && .venv/bin/pip install pandas
  # download the four .xpt files into a folder, then:
  .venv/bin/python models/derivations/nhanes_prevalence.py path/to/folder

Weighted shares are approximate: they ignore NHANES's complex-design variance
(fine for point estimates) and are not age-specific.
"""

import sys
from pathlib import Path

import pandas as pd


def load(folder: Path) -> pd.DataFrame:
    files = ["P_DEMO", "P_BMX", "P_SMQ", "P_PAQ"]
    frames = [pd.read_sas(folder / f"{f}.xpt", format="xport") for f in files]
    df = frames[0]
    for frame in frames[1:]:
        df = df.merge(frame, on="SEQN", how="left")
    return df[df["RIDAGEYR"] >= 20]


def shares(categories: pd.Series, weights: pd.Series, order: list[str]) -> dict[str, float]:
    known = categories.notna() & weights.gt(0)
    total = weights[known].sum()
    return {c: float(weights[known & (categories == c)].sum() / total) for c in order}


def smoking(df: pd.DataFrame) -> pd.Series:
    """never / former_quit_* / current, from SMQ020, SMQ040 and time since quitting."""
    ever = df["SMQ020"]
    now = df["SMQ040"]
    unit_years = df["SMQ050U"].map({1: 1 / 365.25, 2: 7 / 365.25, 3: 1 / 12, 4: 1.0})
    years_since_quit = df["SMQ050Q"].where(df["SMQ050Q"] < 66666) * unit_years
    quit_age = df["RIDAGEYR"] - years_since_quit

    def bucket(age: float) -> str | None:
        if pd.isna(age):
            return None
        if age < 35:
            return "former_quit_before_35"
        if age < 45:
            return "former_quit_35_44"
        if age < 55:
            return "former_quit_45_54"
        return "former_quit_55_plus"

    out = pd.Series(None, index=df.index, dtype="object")
    out[ever == 2] = "never"
    out[(ever == 1) & now.isin([1, 2])] = "current"
    former = (ever == 1) & (now == 3)
    out[former] = quit_age[former].map(bucket)
    return out


def bmi(df: pd.DataFrame) -> pd.Series:
    edges = [0, 18.5, 25, 30, 35, 40, 1000]
    labels = ["<18.5", "18.5-25", "25-30", "30-35", "35-40", "40+"]
    return pd.cut(df["BMXBMI"], bins=edges, labels=labels, right=False).astype("object")


def activity(df: pd.DataFrame) -> pd.Series:
    """Leisure-time moderate-equivalent minutes per week (vigorous minutes count twice)."""

    def weekly(did: str, days: str, minutes: str, factor: int) -> pd.Series:
        valid_days = df[days].where(df[days].between(1, 7))
        valid_min = df[minutes].where(df[minutes] < 7777)
        mins = (valid_days * valid_min * factor).where(df[did] == 1)
        return mins.where(df[did] != 2, 0.0)

    vigorous = weekly("PAQ650", "PAQ655", "PAD660", 2)
    moderate = weekly("PAQ665", "PAQ670", "PAD675", 1)
    total = vigorous + moderate
    # Bands match the MET-hour categories of Arem et al. 2015 (1 MET-h = 20 moderate minutes).
    edges = [0, 1, 150, 300, 450, 800, 1500, 1e9]
    labels = ["0", "1-150", "150-300", "300-450", "450-800", "800-1500", "1500+"]
    return pd.cut(total, bins=edges, labels=labels, right=False).astype("object")


def main() -> None:
    df = load(Path(sys.argv[1]))
    results = {
        "smoking_status (interview weights)": shares(
            smoking(df),
            df["WTINTPRP"],
            ["never", "former_quit_before_35", "former_quit_35_44", "former_quit_45_54", "former_quit_55_plus", "current"],
        ),
        "bmi (examination weights)": shares(
            bmi(df), df["WTMECPRP"], ["<18.5", "18.5-25", "25-30", "30-35", "35-40", "40+"]
        ),
        "mvpa_minutes_per_week (interview weights)": shares(
            activity(df), df["WTINTPRP"], ["0", "1-150", "150-300", "300-450", "450-800", "800-1500", "1500+"]
        ),
    }
    for name, values in results.items():
        print(name)
        for level, share in values.items():
            print(f"  {level:>24}: {share:.3f}")


if __name__ == "__main__":
    main()

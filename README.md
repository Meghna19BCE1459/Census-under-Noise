# Census Under Noise: A Differential Privacy Census Dashboard

An interactive dashboard that shows how differential privacy noise affects
real census data, and visualizes the privacy-utility tradeoff live. Built on
the real **UCI Adult (Census Income)** dataset (45,222 records after
cleaning), not a toy example.
<img width="959" height="522" alt="1" src="https://github.com/user-attachments/assets/0fb28c19-c32e-4b55-93c7-125ba3c95700" />
<img width="959" height="529" alt="2" src="https://github.com/user-attachments/assets/58bab60a-33e6-4176-acb7-b351fffd1f62" />
<img width="959" height="497" alt="3" src="https://github.com/user-attachments/assets/85dab8be-cb25-495c-9c4f-cb17d0127b87" />


**Stack:** Python + [OpenDP](https://opendp.org) backend (FastAPI), React +
D3.js frontend.

Every noisy value shown in the UI is computed server-side by OpenDP's actual
`make_laplace` / `make_gaussian` measurements, calibrated with OpenDP's own
`binary_search_param` privacy accountant, not a hand-rolled `np.random`
formula. There's also a companion single-file `dp_dashboard.html` at the
repo root: the same UI wired to client-side JS math instead of a live
backend, useful as a zero-setup preview.

## Why this exists

Most differential privacy tutorials are static notebooks: you scroll past a
plot, maybe change one constant, re-run a cell. This project turns the same
ideas into something you can operate: drag epsilon, flip mechanisms, watch
the tradeoff move in real time, on data with actual demographic structure
(age, income, race, sex) rather than a synthetic Gaussian blob.

## Project structure

```
census-under-noise/
├── backend/
│   ├── app.py            FastAPI app, all HTTP endpoints
│   ├── dp_engine.py       OpenDP mechanism wiring, sensitivities, privacy accounting
│   ├── data_loader.py     loads + cleans adult-all.csv, computes ground truth
│   ├── adult-all.csv      the real dataset
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js         fetch wrapper for the backend
│   │   └── components/    EpsilonDial, QueryExplorer, DPHistogram, TradeoffCurve, DotPlot, AboutMath
│   └── package.json
└── dp_dashboard.html      standalone single-file preview (no backend needed)
```

## Running it

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Check it's alive: `curl http://localhost:8000/api/health`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # points VITE_API_URL at the backend above
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

### Zero-setup preview

Just open `dp_dashboard.html` directly in a browser. It re-implements the
same Laplace/Gaussian mechanisms in plain JS against pre-computed aggregate
statistics from the same dataset, so the numbers match the full app closely.
It isn't calling a real DP library, though, so treat it as a demo of the UI
and math, not the production path.

## The privacy math, briefly

**Laplace mechanism.** For a query `f` with global sensitivity `Δf` (the
most one person's presence/absence can change the true answer), release
`f(D) + Lap(Δf / ε)`. This satisfies pure `ε`-differential privacy.

**Gaussian mechanism.** Release `f(D) + N(0, σ²)`, calibrated so the result
satisfies `(ε, δ)`-differential privacy. `δ` is the probability the guarantee
fails to hold, so it should sit far below `1/n`.

**Sensitivities used in this app:**
- Counting queries (e.g. "how many people earn >$50K") → `Δ = 1`.
- Bounded mean queries (e.g. mean age) → `Δ = (max − min) / n`, treating
  the dataset size `n` as public. A fully rigorous pipeline would also spend
  privacy budget on a noisy count of `n` rather than assuming it's free.

**Composition.** Every query in the "Query explorer" and "Privacy-utility
curve" tabs is treated as the only thing this dataset will ever answer. In
reality, every query drawn from the same data spends from one shared privacy
budget: ten queries at `ε = 1` each cost `ε = 10` total under basic
composition (less under advanced composition, but never zero). The one
built-in exception is the **DP histogram** tab: because each record falls
into exactly one bin, noising every bin independently at scale `1/ε` still
only costs `ε` in total. This is *parallel composition*, and it's why
histograms are one of the few multi-query releases you get "for free."

This app does not track a running privacy budget across requests. A
production system (e.g. via OpenDP's `PrivacyAccountant` or Google's
differential-privacy library's `ProportionQuery` budgeting) would refuse
further queries once the budget is exhausted.

## Data

[UCI Machine Learning Repository, Adult (Census Income)](https://archive.ics.uci.edu/dataset/2/adult),
extracted from the 1994 US Census Bureau database by Barry Becker. Rows with
missing values are dropped, leaving 45,222 of the original 48,842 records.

## Possible extensions

- Real running privacy-budget accountant across the whole session (spend
  down a fixed total `ε` as the user issues queries).
- Swap in Google's `differential-privacy` library alongside OpenDP to
  compare calibration between the two.
- Add a synthetic-data tab: fit a DP-noised histogram-based generator and
  let users compare synthetic vs. real distributions.
- CSV upload so people can point the same mechanisms at their own data.

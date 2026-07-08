"""
app.py

FastAPI backend for the Differential Privacy Demo Dashboard.

Run with:
    uvicorn app:app --reload --port 8000

Endpoints
---------
GET  /api/health                     liveness check
GET  /api/queries                    list of available DP queries + metadata
GET  /api/dataset/summary            true (non-private) aggregate stats -- shown
                                      in the UI explicitly labelled as ground
                                      truth for teaching purposes only
POST /api/query                      one noisy release of a chosen query
POST /api/simulate                   many independent noisy releases of one query
                                      (for the sampling-distribution plot)
POST /api/histogram                  a full DP histogram release (age or hours)
POST /api/tradeoff                   analytic + simulated error-vs-epsilon curve
"""
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import data_loader
import dp_engine

app = FastAPI(title="Differential Privacy Demo Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _summary():
    return data_loader.true_summary()


def _catalogue():
    s = _summary()
    return dp_engine.build_query_catalogue(
        s, data_loader.age_bounds(), data_loader.hours_bounds()
    )


def _find_query(query_id: str):
    for q in _catalogue():
        if q.id == query_id:
            return q
    raise HTTPException(status_code=404, detail=f"Unknown query id '{query_id}'")


class QueryRequest(BaseModel):
    queryId: str
    epsilon: float = Field(gt=0)
    mechanism: Literal["laplace", "gaussian"] = "laplace"
    delta: float = Field(default=1e-5, gt=0, lt=1)


class SimulateRequest(QueryRequest):
    numDraws: int = Field(default=200, ge=1, le=2000)


class HistogramRequest(BaseModel):
    attribute: Literal["age", "hours"]
    epsilon: float = Field(gt=0)
    mechanism: Literal["laplace", "gaussian"] = "laplace"
    delta: float = Field(default=1e-5, gt=0, lt=1)


class TradeoffRequest(BaseModel):
    queryId: str
    mechanism: Literal["laplace", "gaussian"] = "laplace"
    delta: float = Field(default=1e-5, gt=0, lt=1)


@app.get("/api/health")
def health():
    return {"status": "ok", "datasetRows": data_loader.dataset_size()}


@app.get("/api/queries")
def list_queries():
    return [
        {"id": q.id, "label": q.label, "kind": q.kind, "unit": q.unit,
         "sensitivity": q.sensitivity_fn()}
        for q in _catalogue()
    ]


@app.get("/api/dataset/summary")
def dataset_summary():
    return _summary()


@app.post("/api/query")
def run_query(req: QueryRequest):
    q = _find_query(req.queryId)
    sensitivity = q.sensitivity_fn()
    true_value = q.true_value_fn()
    noisy_value = dp_engine.release_value(
        true_value, sensitivity, req.epsilon, req.mechanism, req.delta
    )
    expected_err = dp_engine.expected_abs_error(
        sensitivity, req.epsilon, req.mechanism, req.delta
    )
    return {
        "queryId": q.id,
        "trueValue": true_value,
        "noisyValue": noisy_value,
        "absoluteError": abs(noisy_value - true_value),
        "expectedAbsoluteError": expected_err,
        "sensitivity": sensitivity,
    }


@app.post("/api/simulate")
def simulate(req: SimulateRequest):
    q = _find_query(req.queryId)
    sensitivity = q.sensitivity_fn()
    true_value = q.true_value_fn()
    draws = dp_engine.release_many(
        true_value, sensitivity, req.epsilon, req.mechanism, req.delta, req.numDraws
    )
    return {"queryId": q.id, "trueValue": true_value, "draws": draws}


@app.post("/api/histogram")
def histogram(req: HistogramRequest):
    s = _summary()
    hist = s["ageHist"] if req.attribute == "age" else s["hoursHist"]
    out = []
    for bucket in hist:
        noisy = dp_engine.release_value(
            bucket["count"], 1.0, req.epsilon, req.mechanism, req.delta
        )
        out.append({
            "label": bucket["label"],
            "count": bucket["count"],
            "noisyCount": max(0.0, noisy),
        })
    return {"attribute": req.attribute, "bins": out}


@app.post("/api/tradeoff")
def tradeoff(req: TradeoffRequest):
    q = _find_query(req.queryId)
    sensitivity = q.sensitivity_fn()
    eps_grid = np.logspace(-2, 1, 40)
    analytic = [
        {"eps": float(e),
         "err": dp_engine.expected_abs_error(sensitivity, float(e), req.mechanism, req.delta)}
        for e in eps_grid
    ]
    sim_eps = np.logspace(-2, 1, 13)
    simulated = []
    for e in sim_eps:
        draws = dp_engine.release_many(0.0, sensitivity, float(e), req.mechanism, req.delta, 100)
        simulated.append({"eps": float(e), "err": float(np.mean(np.abs(draws)))})
    return {"queryId": q.id, "sensitivity": sensitivity,
            "analytic": analytic, "simulated": simulated}

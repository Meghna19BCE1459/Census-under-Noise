import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import EpsilonDial from "./components/EpsilonDial";
import QueryExplorer from "./components/QueryExplorer";
import DPHistogram from "./components/DPHistogram";
import TradeoffCurve from "./components/TradeoffCurve";
import AboutMath from "./components/AboutMath";

const TABS = [
  { id: "explorer", label: "Query explorer" },
  { id: "histogram", label: "DP histogram" },
  { id: "tradeoff", label: "Privacy–utility curve" },
];

export default function App() {
  const [tab, setTab] = useState("explorer");
  const [epsilon, setEpsilon] = useState(1.0);
  const [mechanism, setMechanism] = useState("laplace");
  const [delta, setDelta] = useState(0.00001);
  const [resampleTick, setResampleTick] = useState(0);
  const [queries, setQueries] = useState(null);
  const [summary, setSummary] = useState(null);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    api
      .listQueries()
      .then(setQueries)
      .catch((e) => setApiError(e.message));
    api.datasetSummary().then(setSummary).catch(() => {});
  }, []);

  const resample = useCallback(() => setResampleTick((t) => t + 1), []);

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">A differential privacy census dashboard</p>
        <h1>Census under noise</h1>
        <p className="sub">
          <b>How much does privacy cost?</b> Real 1994 US census data{summary ? `, ` : ""}
          {summary && <b>{summary.n.toLocaleString()} records</b>}
          {summary ? " after cleaning. " : ". "}
          Move the privacy dial and watch true statistics get obscured by calibrated noise, the mathematical price
          of protecting any one person's record. Every noisy value on this page is computed live by a FastAPI backend
          using the <b>OpenDP</b> library, not simulated in the browser.
        </p>
      </header>

      {apiError && (
        <div className="error-banner">
          Could not reach the API at the configured URL ({apiError}). Make sure the backend is running:{" "}
          <code>uvicorn app:app --reload --port 8000</code>
        </div>
      )}

      <div className="howto">
        <h3>What you're looking at</h3>
        <ol>
          <li>
            <b>Two numbers, one true, one fuzzed.</b> Every query below computes the real answer from
            {summary ? ` ${summary.n.toLocaleString()}` : " 45,222"} real people via the OpenDP-backed API, then adds
            random mathematical noise before showing it to you. That's how differential privacy publishes statistics
            without exposing anyone's individual record.
          </li>
          <li>
            <b>The epsilon dial controls how much noise.</b> Drag it left for strong privacy (more noise, less
            accurate), right for weak privacy (less noise, more accurate). This is the core tradeoff the whole field
            is built around.
          </li>
          <li>
            <b>The noisy number changes every time on purpose.</b> Switching tabs, changing the query, or clicking{" "}
            <code>↻ Draw new noise sample</code> all trigger a fresh API call that draws a new random value. If it
            looked the same every time, it wouldn't be private.
          </li>
          <li>
            <b>"Expected average error" is different from "this draw."</b> One is a single random outcome; the other
            is what the math predicts you'd see on average across many draws. Only the epsilon, mechanism, or query
            changes the second one.
          </li>
        </ol>
        <div className="tip">
          <span className="icon">ⓘ</span>
          <p>
            <b>Where the effect is easiest to see:</b> pick a smaller count like "high earners who are female" rather
            than a full-dataset total, and drag epsilon all the way to the far left (0.01) then far right (10):
            small nudges near the middle barely move large numbers, since noise scales with sensitivity, not with how
            big the true value is.
          </p>
        </div>
      </div>

      <EpsilonDial
        epsilon={epsilon}
        setEpsilon={setEpsilon}
        mechanism={mechanism}
        setMechanism={setMechanism}
        delta={delta}
        setDelta={setDelta}
        onResample={resample}
      />

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {queries && tab === "explorer" && (
        <QueryExplorer queries={queries} epsilon={epsilon} mechanism={mechanism} delta={delta} resampleTick={resampleTick} />
      )}
      {tab === "histogram" && (
        <DPHistogram epsilon={epsilon} mechanism={mechanism} delta={delta} resampleTick={resampleTick} />
      )}
      {queries && tab === "tradeoff" && (
        <TradeoffCurve queries={queries} epsilon={epsilon} mechanism={mechanism} delta={delta} />
      )}

      <AboutMath />

      <p className="footnote">
        Data: UCI Machine Learning Repository, Adult (Census Income) dataset, 1994 US Census Bureau extract
        {summary ? ` · n = ${summary.n.toLocaleString()} after removing missing values` : ""}
      </p>
    </div>
  );
}

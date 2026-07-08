import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import DotPlot from "./DotPlot";

export default function QueryExplorer({ queries, epsilon, mechanism, delta, resampleTick }) {
  const [queryId, setQueryId] = useState(queries[0]?.id);
  const [result, setResult] = useState(null);
  const [draws, setDraws] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!queryId) return;
    try {
      setError(null);
      const [r, sim] = await Promise.all([
        api.runQuery({ queryId, epsilon, mechanism, delta }),
        api.simulate({ queryId, epsilon, mechanism, delta, numDraws: 200 }),
      ]);
      setResult(r);
      setDraws(sim.draws);
    } catch (e) {
      setError(e.message);
    }
  }, [queryId, epsilon, mechanism, delta, resampleTick]);

  useEffect(() => {
    load();
  }, [load]);

  const q = queries.find((d) => d.id === queryId);
  const fmt = (v) => {
    if (!q) return v;
    if (q.kind === "count") return Math.round(v).toLocaleString();
    return `${v.toFixed(2)} ${q.unit}`;
  };

  return (
    <>
      <div className="card">
        <h2>Ask a statistical question</h2>
        <p className="desc">
          Pick a query. We compute the true answer on the real dataset, then release it through the noisy mechanism
          above. Prefer a smaller-count query (like the female or White high-earner counts) if you want the noise to
          be visually obvious.
        </p>
        <select value={queryId} onChange={(e) => setQueryId(e.target.value)}>
          {queries.map((q) => (
            <option key={q.id} value={q.id}>
              {q.label}
            </option>
          ))}
        </select>
        {error && <div className="error-banner">{error}</div>}
        {result && (
          <>
            <div className="stat-grid">
              <div className="stat-box true">
                <div className="k">True answer</div>
                <div className="v">{fmt(result.trueValue)}</div>
              </div>
              <div className="stat-box noisy">
                <div className="k">DP-released answer (this draw)</div>
                <div className="v">{fmt(result.noisyValue)}</div>
              </div>
            </div>
            <div className="err-line">
              Absolute error this draw: <b>{result.absoluteError.toFixed(3)}</b> &middot; expected (average)
              absolute error at &epsilon;={epsilon.toFixed(2)}: <b>{result.expectedAbsoluteError.toFixed(3)}</b>
            </div>
            <p className="hint-line">
              "This draw" is one random outcome and will change every time you resample. "Expected average error"
              only changes when you move epsilon, switch mechanism, or switch query.
            </p>
          </>
        )}
      </div>
      <div className="card">
        <h2>Where repeated releases land</h2>
        <p className="desc">
          200 independent noisy draws of the same query at the current &epsilon;, computed live by the OpenDP-backed
          API. The spread of amber bars around the teal "true" line is exactly the price of privacy at this setting.
        </p>
        {draws && result ? <DotPlot trueValue={result.trueValue} draws={draws} /> : <div className="loading">Loading…</div>}
      </div>
    </>
  );
}

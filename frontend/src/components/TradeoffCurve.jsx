import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { api } from "../api";

function renderChart(ref, data, epsilon) {
  const { analytic, simulated } = data;
  const w = 860,
    h = 340,
    margin = { top: 16, right: 20, bottom: 40, left: 56 };
  const svg = d3.select(ref.current);
  svg.selectAll("*").remove();
  svg.attr("width", "100%").attr("viewBox", `0 0 ${w} ${h}`);

  const x = d3.scaleLog().domain([0.01, 10]).range([margin.left, w - margin.right]);
  const y = d3
    .scaleLog()
    .domain(d3.extent(analytic, (d) => d.err))
    .nice()
    .range([h - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .attr("class", "axis")
    .call(d3.axisBottom(x).ticks(5, "~s"));
  svg.append("g").attr("transform", `translate(${margin.left},0)`).attr("class", "axis").call(d3.axisLeft(y).ticks(5, "~s"));

  const line = d3
    .line()
    .x((d) => x(d.eps))
    .y((d) => y(d.err));

  svg.append("path").datum(analytic).attr("d", line).attr("fill", "none").attr("stroke", "var(--signal)").attr("stroke-width", 2);

  svg
    .selectAll(".simdot")
    .data(simulated)
    .join("circle")
    .attr("cx", (d) => x(d.eps))
    .attr("cy", (d) => y(Math.max(d.err, y.domain()[0])))
    .attr("r", 3.5)
    .attr("fill", "var(--noise)")
    .attr("stroke", "var(--bg)")
    .attr("stroke-width", 1);

  const curEps = Math.min(10, Math.max(0.01, epsilon));
  const nearest = analytic.reduce((a, b) => (Math.abs(b.eps - curEps) < Math.abs(a.eps - curEps) ? b : a));
  svg
    .append("line")
    .attr("x1", x(curEps))
    .attr("x2", x(curEps))
    .attr("y1", margin.top)
    .attr("y2", h - margin.bottom)
    .attr("stroke", "var(--text)")
    .attr("stroke-dasharray", "3,3")
    .attr("stroke-width", 1);
  svg
    .append("circle")
    .attr("cx", x(curEps))
    .attr("cy", y(Math.max(nearest.err, y.domain()[0])))
    .attr("r", 6)
    .attr("fill", "none")
    .attr("stroke", "var(--text)")
    .attr("stroke-width", 2);
  svg
    .append("text")
    .attr("x", x(curEps) + 8)
    .attr("y", margin.top + 10)
    .attr("fill", "var(--text)")
    .attr("font-family", "var(--mono)")
    .attr("font-size", 11)
    .text("your dial");
}

export default function TradeoffCurve({ queries, epsilon, mechanism, delta }) {
  const [queryId, setQueryId] = useState(queries[0]?.id);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  const load = useCallback(async () => {
    if (!queryId) return;
    try {
      setError(null);
      const res = await api.tradeoff({ queryId, mechanism, delta });
      setData(res);
    } catch (e) {
      setError(e.message);
    }
  }, [queryId, mechanism, delta]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (ref.current && data) renderChart(ref, data, epsilon);
  }, [data, epsilon]);

  return (
    <div className="card">
      <h2>Expected error vs. privacy budget</h2>
      <p className="desc">
        The fundamental tradeoff: lower &epsilon; means stronger privacy but noisier answers. Line = analytic
        expectation from the calibrated OpenDP mechanism, dots = 100-draw simulation at each &epsilon;. The marker
        shows your current dial position.
      </p>
      <select value={queryId} onChange={(e) => setQueryId(e.target.value)}>
        {queries.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
          </option>
        ))}
      </select>
      {error && <div className="error-banner">{error}</div>}
      {!data && !error && <div className="loading">Loading…</div>}
      <svg ref={ref} />
      {data && (
        <p className="hint-line">
          Both axes are log-scaled: the tradeoff compounds multiplicatively, not by fixed amounts, so small drags
          near either end of the epsilon dial matter far more than they look like they should.
        </p>
      )}
    </div>
  );
}

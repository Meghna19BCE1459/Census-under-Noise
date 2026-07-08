import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { api } from "../api";

function renderChart(ref, bins) {
  const w = 860,
    h = 320,
    margin = { top: 16, right: 16, bottom: 40, left: 52 };
  const svg = d3.select(ref.current);
  svg.selectAll("*").remove();
  svg.attr("width", "100%").attr("viewBox", `0 0 ${w} ${h}`);

  const x0 = d3.scaleBand().domain(bins.map((d) => d.label)).range([margin.left, w - margin.right]).padding(0.25);
  const x1 = d3.scaleBand().domain(["true", "noisy"]).range([0, x0.bandwidth()]).padding(0.1);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => Math.max(d.count, d.noisyCount)) * 1.1])
    .range([h - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .attr("class", "axis")
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end");

  svg.append("g").attr("transform", `translate(${margin.left},0)`).attr("class", "axis").call(d3.axisLeft(y).ticks(6));

  y.ticks(6).forEach((yy) => {
    svg
      .append("line")
      .attr("class", "gridline")
      .attr("x1", margin.left)
      .attr("x2", w - margin.right)
      .attr("y1", y(yy))
      .attr("y2", y(yy));
  });

  const groups = svg
    .selectAll(".grp")
    .data(bins)
    .join("g")
    .attr("transform", (d) => `translate(${x0(d.label)},0)`);

  groups
    .append("rect")
    .attr("x", x1("true"))
    .attr("width", x1.bandwidth())
    .attr("y", (d) => y(d.count))
    .attr("height", (d) => y(0) - y(d.count))
    .attr("fill", "var(--signal)");

  groups
    .append("rect")
    .attr("x", x1("noisy"))
    .attr("width", x1.bandwidth())
    .attr("y", (d) => y(Math.max(0, d.noisyCount)))
    .attr("height", (d) => y(0) - y(Math.max(0, d.noisyCount)))
    .attr("fill", "var(--noise)");
}

export default function DPHistogram({ epsilon, mechanism, delta, resampleTick }) {
  const [attribute, setAttribute] = useState("age");
  const [bins, setBins] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.histogram({ attribute, epsilon, mechanism, delta });
      setBins(res.bins);
    } catch (e) {
      setError(e.message);
    }
  }, [attribute, epsilon, mechanism, delta, resampleTick]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (ref.current && bins) renderChart(ref, bins);
  }, [bins]);

  return (
    <div className="card">
      <h2>Release a full histogram</h2>
      <p className="desc">
        Each bar gets independent noise. Because a person appears in exactly one bin, releasing the whole histogram
        still only costs &epsilon; total: this is <i>parallel composition</i>.
      </p>
      <select value={attribute} onChange={(e) => setAttribute(e.target.value)}>
        <option value="age">Age distribution</option>
        <option value="hours">Hours worked per week</option>
      </select>
      <div className="legend" style={{ marginTop: 16 }}>
        <span>
          <span className="swatch" style={{ background: "var(--signal)" }}></span>True count
        </span>
        <span>
          <span className="swatch" style={{ background: "var(--noise)" }}></span>DP-released count
        </span>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {!bins && !error && <div className="loading">Loading…</div>}
      <svg ref={ref} />
      {bins && (
        <p className="hint-line">
          Watch the smallest bars (e.g. ages 85–90, which has only 13 real people): noise is added equally to every
          bin, so tiny bins get thrown around proportionally far more than large ones.
        </p>
      )}
    </div>
  );
}

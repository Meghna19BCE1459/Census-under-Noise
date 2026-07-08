import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function DotPlot({ trueValue, draws }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || draws == null || draws.length === 0) return;
    const w = 860,
      h = 130,
      margin = { top: 14, right: 24, bottom: 28, left: 24 };

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("width", "100%").attr("viewBox", `0 0 ${w} ${h}`);

    const ext = d3.extent(draws.concat([trueValue]));
    const pad = (ext[1] - ext[0]) * 0.1 || 1;
    const x = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).range([margin.left, w - margin.right]);

    svg
      .append("g")
      .attr("transform", `translate(0,${h - margin.bottom})`)
      .attr("class", "axis")
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(".3~s")));

    const bins = d3.bin().domain(x.domain()).thresholds(40)(draws);
    const y = d3.scaleLinear().domain([0, d3.max(bins, (d) => d.length) || 1]).range([h - margin.bottom, margin.top]);

    svg
      .selectAll("rect")
      .data(bins)
      .join("rect")
      .attr("x", (d) => x(d.x0) + 1)
      .attr("width", (d) => Math.max(1, x(d.x1) - x(d.x0) - 1))
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => y(0) - y(d.length))
      .attr("fill", "var(--noise)")
      .attr("opacity", 0.75);

    svg
      .append("line")
      .attr("x1", x(trueValue))
      .attr("x2", x(trueValue))
      .attr("y1", margin.top)
      .attr("y2", h - margin.bottom)
      .attr("stroke", "var(--signal)")
      .attr("stroke-width", 2);

    svg
      .append("text")
      .attr("x", x(trueValue))
      .attr("y", margin.top - 2)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--signal)")
      .attr("font-family", "var(--mono)")
      .attr("font-size", 10)
      .text("true");
  }, [trueValue, draws]);

  return <svg ref={ref} />;
}

export default function AboutMath() {
  return (
    <details className="about">
      <summary>How the noise is actually computed ↓</summary>
      <div className="about-body">
        <p>
          <b style={{ color: "var(--text)" }}>Laplace mechanism.</b> For a query <code>f</code> with global
          sensitivity Δf (the most one person's record can change the true answer), release{" "}
          <code>f(D) + Lap(Δf / ε)</code>. Satisfies pure ε-differential privacy. The backend calls OpenDP's{" "}
          <code>make_laplace</code> directly rather than sampling by hand.
        </p>
        <p>
          <b style={{ color: "var(--text)" }}>Gaussian mechanism.</b> Release <code>f(D) + N(0, σ²)</code>, satisfying{" "}
          <span className="warn">(ε, δ)</span>-differential privacy: it leaks with probability δ, which is why δ
          should be far smaller than 1/n. The scale is found via OpenDP's own <code>binary_search_param</code>{" "}
          against the requested (ε, δ), not a formula we wrote ourselves.
        </p>
        <p>
          <b style={{ color: "var(--text)" }}>Sensitivity per query type.</b> Counting queries have Δ = 1: adding or
          removing one person changes a count by at most one. Bounded mean queries use Δ = (max−min)/n, treating the
          record count n as public.
        </p>
        <p>
          <b style={{ color: "var(--text)" }}>Composition caveat.</b> Every tab here treats its query as the{" "}
          <i>only</i> thing ever released from this dataset. A real system spends a finite total privacy budget
          across every query it will ever answer. Ask ten questions at ε = 1 each and you've spent ε = 10, not ε = 1.
          The histogram tab is the exception: because each record lands in exactly one bin,{" "}
          <i>parallel composition</i> means noising every bin independently at scale 1/ε still only costs ε total,
          regardless of bin count.
        </p>
      </div>
    </details>
  );
}

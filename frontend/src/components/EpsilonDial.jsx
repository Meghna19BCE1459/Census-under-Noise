function regimeFor(eps) {
  if (eps <= 0.15) return { c: "strong", l: "strong privacy" };
  if (eps <= 1.5) return { c: "moderate", l: "moderate privacy" };
  if (eps <= 5) return { c: "weak", l: "weak privacy" };
  return { c: "minimal", l: "minimal privacy" };
}

export default function EpsilonDial({
  epsilon,
  setEpsilon,
  mechanism,
  setMechanism,
  delta,
  setDelta,
  onResample,
}) {
  const regime = regimeFor(epsilon);
  const sliderValue = Math.log10(epsilon);

  return (
    <div className="dial-panel">
      <div className="dial-row">
        <div className="dial-col">
          <div className="dial-label">
            <span>Privacy budget &epsilon; (epsilon)</span>
            <span>
              <span className="dial-readout">
                {epsilon < 1 ? epsilon.toFixed(2) : epsilon.toFixed(epsilon < 10 ? 1 : 0)}
              </span>
              <span className={`regime ${regime.c}`}>{regime.l}</span>
            </span>
          </div>
          <input
            type="range"
            min={-2}
            max={1}
            step={0.01}
            value={sliderValue}
            onChange={(e) => setEpsilon(Math.pow(10, Number(e.target.value)))}
          />
          <div className="ticks">
            <span>0.01, strong privacy</span>
            <span>0.1</span>
            <span>1</span>
            <span>10, weak privacy</span>
          </div>
        </div>
        <div className="side-controls">
          <div className="dial-label" style={{ marginBottom: 2 }}>
            Mechanism
          </div>
          <div className="toggle-group">
            <button
              className={mechanism === "laplace" ? "active" : ""}
              onClick={() => setMechanism("laplace")}
            >
              Laplace
            </button>
            <button
              className={mechanism === "gaussian" ? "active" : ""}
              onClick={() => setMechanism("gaussian")}
            >
              Gaussian
            </button>
          </div>
          {mechanism === "gaussian" && (
            <div className="field-row">
              <span>&delta; =</span>
              <input
                type="number"
                value={delta}
                step={0.00001}
                onChange={(e) => setDelta(Math.max(1e-8, Number(e.target.value) || 0.00001))}
              />
            </div>
          )}
          <button className="resample" onClick={onResample}>
            ↻ Draw new noise sample
          </button>
        </div>
      </div>
    </div>
  );
}

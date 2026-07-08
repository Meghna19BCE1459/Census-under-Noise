"""
dp_engine.py

All differential privacy math lives here, built on the OpenDP library
(https://opendp.org). Nothing in this file trusts the caller's epsilon
blindly -- we always go through OpenDP's own `binary_search_param` to find
the noise scale that provably achieves the requested privacy guarantee for
a given mechanism and sensitivity, the same way you would in a real OpenDP
pipeline. That is the whole point of using a vetted library instead of
hand-rolling `np.random.laplace(0, sensitivity/epsilon)`: the library
proves the mechanism satisfies the stated (epsilon, delta) guarantee.

Query catalogue and sensitivities
----------------------------------
- Counting queries (e.g. "how many people earn >$50K")
    sensitivity = 1: one person joining or leaving the dataset changes a
    count by at most 1.
- Bounded mean queries (e.g. "average age")
    sensitivity = (upper - lower) / n: releasing a mean over a public,
    fixed-size dataset with a publicly known value range. Changing one
    person's value from `lower` to `upper` moves the mean by exactly this
    amount. NOTE: this assumes `n` itself is public/non-sensitive, which is
    a simplification made explicit in the README -- a fully rigorous
    pipeline would also budget epsilon for a private count of `n`.
- Histogram queries
    sensitivity = 1 per bin, and thanks to *parallel composition* (each
    record contributes to exactly one bin), releasing every bin
    independently at scale 1/epsilon costs epsilon in TOTAL, not
    epsilon * num_bins.

Composition
-----------
Every query and every histogram bin computed via `release_*` below is
treated as an independent release for teaching purposes. In a real system,
every query drawn from the same dataset spends from one finite epsilon
budget (basic composition: budgets add; advanced composition grows
sub-linearly). This app does not track a running budget across requests --
see the README for why that's out of scope for a demo.
"""
from dataclasses import dataclass
from typing import Literal

import numpy as np
from opendp.mod import enable_features, binary_search_param
from opendp.measurements import make_laplace, make_gaussian
from opendp.domains import atom_domain
from opendp.metrics import absolute_distance

enable_features("contrib")

Mechanism = Literal["laplace", "gaussian"]

_FLOAT_DOMAIN = atom_domain(T=float, nan=False)
_FLOAT_METRIC = absolute_distance(T=float)


def _make_measurement(mechanism: Mechanism, scale: float):
    if mechanism == "laplace":
        return make_laplace(_FLOAT_DOMAIN, _FLOAT_METRIC, scale=scale)
    return make_gaussian(_FLOAT_DOMAIN, _FLOAT_METRIC, scale=scale)


def scale_for_epsilon(sensitivity: float, epsilon: float,
                       mechanism: Mechanism, delta: float = 1e-5) -> float:
    """Uses OpenDP's own privacy accountant (via binary search over the
    measurement's `.map()`) to find the noise scale that achieves the
    requested privacy guarantee -- rather than trusting a closed-form
    formula we wrote ourselves."""
    if mechanism == "laplace":
        d_out = epsilon
        return binary_search_param(
            lambda s: make_laplace(_FLOAT_DOMAIN, _FLOAT_METRIC, scale=s),
            d_in=sensitivity, d_out=d_out,
        )
    else:
        # OpenDP's zCDP-based make_gaussian is calibrated in terms of a
        # single divergence bound; we convert the (epsilon, delta) target to
        # the equivalent rho via the standard zCDP<->approxDP conversion,
        # then search for the scale that meets that rho.
        rho = ((np.sqrt(np.log(1 / delta) + epsilon) - np.sqrt(np.log(1 / delta))) ** 2)
        rho = max(rho, 1e-12)
        return binary_search_param(
            lambda s: make_gaussian(_FLOAT_DOMAIN, _FLOAT_METRIC, scale=s),
            d_in=sensitivity, d_out=rho,
        )


def release_value(true_value: float, sensitivity: float, epsilon: float,
                   mechanism: Mechanism, delta: float = 1e-5) -> float:
    """Applies one noisy draw of the requested mechanism to `true_value`."""
    scale = scale_for_epsilon(sensitivity, epsilon, mechanism, delta)
    measurement = _make_measurement(mechanism, scale)
    return measurement(float(true_value))


def release_many(true_value: float, sensitivity: float, epsilon: float,
                  mechanism: Mechanism, delta: float, num_draws: int) -> list:
    """Independent repeated releases of the same query -- used to show the
    sampling distribution of a DP mechanism (the 'where releases land' view)."""
    scale = scale_for_epsilon(sensitivity, epsilon, mechanism, delta)
    measurement = _make_measurement(mechanism, scale)
    return [measurement(float(true_value)) for _ in range(num_draws)]


def expected_abs_error(sensitivity: float, epsilon: float,
                        mechanism: Mechanism, delta: float = 1e-5) -> float:
    """Analytic E[|noise|] for the calibrated scale, used to draw the
    privacy-utility tradeoff curve without re-simulating at every epsilon."""
    scale = scale_for_epsilon(sensitivity, epsilon, mechanism, delta)
    if mechanism == "laplace":
        return scale  # E[|Laplace(0, b)|] = b
    return scale * np.sqrt(2 / np.pi)  # E[|N(0, sigma^2)|] = sigma * sqrt(2/pi)


@dataclass
class QueryDef:
    id: str
    label: str
    kind: Literal["count", "mean"]
    sensitivity_fn: "callable"
    true_value_fn: "callable"
    unit: str = ""


def build_query_catalogue(summary: dict, age_bounds, hours_bounds) -> list:
    n = summary["n"]
    amin, amax = age_bounds
    hmin, hmax = hours_bounds
    sex_income = {d["group"]: d for d in summary["sexIncome"]}
    race_income = {d["group"]: d for d in summary["raceIncome"]}

    return [
        QueryDef(
            id="countHigh", label="Count: number of people earning >$50K/yr",
            kind="count", sensitivity_fn=lambda: 1.0,
            true_value_fn=lambda: summary["highEarnerCount"],
        ),
        QueryDef(
            id="meanAge", label="Mean: average age", kind="mean",
            sensitivity_fn=lambda: (amax - amin) / n,
            true_value_fn=lambda: summary["meanAge"], unit="yrs",
        ),
        QueryDef(
            id="meanHours", label="Mean: average hours worked per week",
            kind="mean", sensitivity_fn=lambda: (hmax - hmin) / n,
            true_value_fn=lambda: summary["meanHours"], unit="hrs",
        ),
        QueryDef(
            id="countFemaleHigh", label="Count: high earners who are female",
            kind="count", sensitivity_fn=lambda: 1.0,
            true_value_fn=lambda: sex_income["Female"]["highEarners"],
        ),
        QueryDef(
            id="countWhiteHigh", label="Count: high earners who are White",
            kind="count", sensitivity_fn=lambda: 1.0,
            true_value_fn=lambda: race_income["White"]["highEarners"],
        ),
    ]

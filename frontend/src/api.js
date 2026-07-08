const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function request(path, options) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),
  listQueries: () => request("/queries"),
  datasetSummary: () => request("/dataset/summary"),
  runQuery: (body) =>
    request("/query", { method: "POST", body: JSON.stringify(body) }),
  simulate: (body) =>
    request("/simulate", { method: "POST", body: JSON.stringify(body) }),
  histogram: (body) =>
    request("/histogram", { method: "POST", body: JSON.stringify(body) }),
  tradeoff: (body) =>
    request("/tradeoff", { method: "POST", body: JSON.stringify(body) }),
};

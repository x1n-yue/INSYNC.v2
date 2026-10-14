import { internMetrics } from "./metrics";

// Only authorized metadata enters this derivation. No Storage requests, flexible
// submissions, historic approval rows or displayed-page arrays establish clearance.
export function rosterMetrics(rows, attendance, documents, now = new Date()) {
  const group = values => {
    if (!Array.isArray(values)) return null;
    const result = new Map();
    for (const row of values) {
      if (!result.has(row.intern_id)) result.set(row.intern_id, []);
      result.get(row.intern_id).push(row);
    }
    return result;
  };
  const hours = group(attendance), requirements = group(documents);
  return [...new Map(rows.map(r => [r.id, r])).values()].map(row => {
    const metric = internMetrics({ internId: row.id, required: row.required,
      attendance: hours ? hours.get(row.id) || [] : null,
      documents: requirements ? requirements.get(row.id) || [] : null, now });
    return { ...row, hours: metric.verified, logged: metric.logged, cleared: metric.cleared,
      status: metric.risk, remaining: metric.remaining, riskReasons: metric.riskReasons };
  });
}

export function rosterSummary(rows, rosterKnown = true) {
  // IDs, rather than display names or requirement counts, identify interns.
  const distinct = new Map();
  for (const row of rows) {
    const prior = distinct.get(row.id);
    distinct.set(row.id, prior && (prior.cleared !== row.cleared || prior.status !== row.status)
      ? { ...prior, cleared: null, status: "Unknown" } : row);
  }
  const values = [...distinct.values()];
  const count = classify => {
    if (!rosterKnown) return { count: null, unknown: null, complete: false };
    let confirmed = 0, unknown = 0;
    for (const row of values) {
      const result = classify(row);
      if (result === true) confirmed++;
      else if (result !== false) unknown++;
    }
    return { count: confirmed, unknown, complete: unknown === 0 };
  };
  return { total: rosterKnown ? values.length : null,
    cleared: count(row => row.cleared),
    atRisk: count(row => row.status === "At Risk" ? true : ["Completed", "On Track"].includes(row.status) ? false : null) };
}

export function filterRosterMetric(rows, view) {
  return rows.filter(row => view === "cleared" ? row.cleared === true : view === "at-risk" ? row.status === "At Risk" : true);
}

export const INSTRUCTOR_METRIC_RULES = {
  cleared: "Verified hours meet the saved target; all four standard types and every current custom clearance requirement have valid current-version approval. Flexible submissions do not count.",
  atRisk: "Verified hours below the saved target, plus a Needs Revision clearance requirement or at least 7 Manila calendar days since the last valid closed attendance.",
};

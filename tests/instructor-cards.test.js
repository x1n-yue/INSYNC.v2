import { describe, expect, it } from "vitest";
import { internMetrics } from "../src/lib/metrics";
import { filterRosterMetric, rosterMetrics, rosterSummary } from "../src/lib/rosterMetrics";
import { filterRoster, paginate } from "../src/lib/lists";

const owner = "00000000-0000-4000-8000-000000000101", reviewer = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-10-13T02:00:00Z");
const row = { id: owner, required: 8, name: "Assigned Intern", sectionId: "section-a" };
const attendance = (date = "2026-10-12", verified = true) => ({ id: "attendance", intern_id: owner, log_date: date, time_in: "08:00:00", time_out: "16:00:00",
  clocked_in_at: `${date}T00:00:00Z`, clocked_out_at: `${date}T08:00:00Z`, hours: 8, verified, verified_by: verified ? reviewer : null });
const docs = ["moa", "endorsement", "consent", "medical"].map((doc_type, i) => ({ id: `requirement-${i}`, intern_id: owner, doc_type, name: doc_type,
  status: "Approved", upload_version: 1, review_revision: 1, file_path: `${owner}/version-1-${i}.pdf`, file_name: `${doc_type}.pdf`, reviewed_by: reviewer, reviewed_at: "2026-10-12T09:00:00Z" }));
const derive = (patch = {}) => rosterMetrics([patch.row || row], patch.attendance === undefined ? [attendance()] : patch.attendance,
  patch.documents === undefined ? docs : patch.documents, patch.now || now);

describe("Instructor clearance uses the shared current-requirement calculation", () => {
  it("counts exact verified target and every standard/custom current approval once", () => {
    const custom = { ...docs[0], id: "custom", doc_type: "custom", name: "Custom MOA" };
    const result = derive({ documents: [...docs, custom] });
    expect(result[0].cleared).toBe(true);
    expect(result[0].cleared).toBe(internMetrics({ internId: owner, required: 8, attendance: [attendance()], documents: [...docs, custom], now }).cleared);
    expect(rosterSummary([...result, ...result]).cleared).toEqual({ count: 1, unknown: 0, complete: true });
  });
  it.each([
    ["insufficient verified hours", { row: { ...row, required: 8.01 } }],
    ["logged target without verification", { attendance: [attendance("2026-10-12", false)] }],
    ["missing Medical", { documents: docs.slice(0, 3) }],
    ["Pending current file", { documents: docs.map((d, i) => i ? d : { ...d, status: "Pending", reviewed_by: null, reviewed_at: null }) }],
    ["superseded approval does not approve a replacement", { documents: docs.map((d, i) => i ? d : { ...d, upload_version: 2, review_revision: 0, file_path: `${owner}/version-2.pdf`, status: "Pending", reviewed_by: null, reviewed_at: null }) }],
    ["flexible approval only", { documents: [] }],
    ["unapproved custom requirement", { documents: [...docs, { ...docs[0], id: "custom", doc_type: "custom", status: "Pending" }] }],
  ])("does not clear %s", (_name, patch) => {
    expect(rosterSummary(derive(patch)).cleared).toEqual({ count: 0, unknown: 0, complete: true });
  });
  it.each([
    ["failed attendance retrieval", { attendance: null }], ["failed requirement retrieval", { documents: null }],
    ["invalid stored target", { row: { ...row, required: null } }],
    ["legacy or invalid attendance", { attendance: [{ ...attendance(), clocked_in_at: null }] }],
    ["version-zero approval", { documents: docs.map(d => ({ ...d, upload_version: 0 })) }],
    ["invalid approval evidence", { documents: docs.map(d => ({ ...d, reviewed_at: null })) }],
    ["distinct duplicate requirement types", { documents: [...docs, { ...docs[0], id: "duplicate-moa" }] }],
  ])("keeps %s Unknown instead of certifying zero", (_name, patch) => {
    const result = rosterSummary(derive(patch));
    expect(result.cleared).toEqual({ count: 0, unknown: 1, complete: false });
    expect(result.atRisk).toEqual({ count: 0, unknown: 1, complete: false });
    expect(filterRosterMetric(derive(patch), "cleared")).toEqual([]);
  });
});

describe("documented D13 risk and complete-roster counting", () => {
  it("uses exactly seven Manila calendar days, not the device's UTC day", () => {
    const data = { row: { ...row, required: 16 }, attendance: [attendance("2026-10-06")] };
    expect(derive({ ...data, now: new Date("2026-10-12T15:59:59Z") })[0].status).toBe("On Track");
    const risk = derive({ ...data, now: new Date("2026-10-12T16:00:00Z") })[0];
    expect(risk.status).toBe("At Risk"); expect(risk.riskReasons[0]).toMatchObject({ kind: "inactivity", lastDate: "2026-10-06" });
  });
  it("explains current revision requirements only with a known verified-hours shortfall", () => {
    const documents = docs.map((d, i) => i ? d : { ...d, status: "Needs Revision" });
    const risk = derive({ row: { ...row, required: 16 }, documents })[0];
    expect(risk.riskReasons).toEqual([{ kind: "revision", documentId: "requirement-0", message: "Needs Revision: moa" }]);
    expect(derive({ documents })[0].status).toBe("On Track");
  });
  it("does not classify low progress, ordinary Pending requirements or evaluation absence as risk", () => {
    expect(derive({ row: { ...row, required: 486 }, documents: docs.map(d => ({ ...d, status: "Pending" })) })[0].status).toBe("On Track");
    const noHistory = derive({ attendance: [], documents: [] });
    expect(rosterSummary(noHistory).atRisk).toEqual({ count: 0, unknown: 1, complete: false });
  });
  it.each([null, "2026-01-01", "2027-01-01"])("unsupported/missing deadline %s does not invent an overdue-risk rule", deadline => {
    const result = derive({ row: { ...row, required: 16 }, documents: docs.map(d => ({ ...d, status: "Pending", due_date: deadline })) });
    expect(result[0].status).toBe("On Track");
  });
  it("keeps confirmed results when a different intern is unknown, across multiple pages and filters", () => {
    const rows = Array.from({ length: 65 }, (_, i) => ({ id: `intern-${i}`, name: `Intern ${i}`, sectionId: i % 2 ? "a" : "b", cleared: i < 12 ? true : i === 64 ? null : false, status: i < 12 ? "Completed" : i < 22 ? "At Risk" : i === 64 ? "Unknown" : "On Track" }));
    const summary = rosterSummary(rows);
    expect(summary).toEqual({ total: 65, cleared: { count: 12, unknown: 1, complete: false }, atRisk: { count: 10, unknown: 1, complete: false } });
    expect(paginate(filterRosterMetric(rows, "cleared"), 2, 10).rows).toHaveLength(2);
    expect(filterRosterMetric(filterRoster(rows, "Intern 1", "a"), "cleared").map(r => r.id)).toEqual(["intern-1", "intern-11"]);
    expect(rosterSummary(rows)).toEqual(summary);
  });
  it("distinguishes a confirmed empty roster from an unavailable roster", () => {
    expect(rosterSummary([]).cleared).toEqual({ count: 0, unknown: 0, complete: true });
    expect(rosterSummary([], false)).toEqual({ total: null, cleared: { count: null, unknown: null, complete: false }, atRisk: { count: null, unknown: null, complete: false } });
  });
  it("never double-counts repeated intern IDs, and conflicting copies remain unknown", () => {
    const first = { id: owner, cleared: true, status: "Completed" };
    expect(rosterSummary([first, first]).total).toBe(1);
    expect(rosterSummary([first, { ...first, cleared: false }]).cleared).toEqual({ count: 0, unknown: 1, complete: false });
  });
});

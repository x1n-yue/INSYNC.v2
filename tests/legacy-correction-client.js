// Historical transport adapters ONLY for pre-M15 regression tests. Never imported by the app.
import { recordRpc } from "../src/lib/authority";
import { rubricScore } from "../src/lib/business";
export async function reviewCorrections(client, ids, decision, note = null) {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const failed = (error) => unique.map((id) => ({ id, ok: false, data: null, error }));
  try {
    const { data, error } = await client.rpc("review_exceptions", { p_ids: unique, p_decision: decision, p_note: note });
    if (error) return failed(error.message);
    // Reject missing, duplicate, foreign or inconsistent results. A transport
    // success alone is never evidence that all selected requests were reviewed.
    if (!Array.isArray(data) || data.length !== unique.length || new Set(data.map((r) => r.id)).size !== unique.length
      || data.some((r) => !unique.includes(r.id) || typeof r.ok !== "boolean"
        || (r.ok && (r.data?.id !== r.id || r.data?.status !== decision)) || (!r.ok && !r.error))) {
      return failed("Incomplete review response; refresh before retrying.");
    }
    return unique.map((id) => data.find((r) => r.id === id));
  } catch (error) {
    return failed(error.message || "Review request failed; refresh before retrying.");
  }
}

export function saveEvaluation(client, internId, criteria, feedback, submissionId) {
  if (rubricScore(criteria) === null || feedback.length > 500 || !submissionId) return Promise.resolve({ ok: false, data: null, error: "Complete all four criteria; feedback maximum 500 characters" });
  return recordRpc(client, "submit_evaluation", { p_intern_id: internId, p_criteria: criteria, p_feedback: feedback, p_submission_id: submissionId });
}

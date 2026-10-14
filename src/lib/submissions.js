import { recordRpc } from "./authority";
import { signedFileLink, validateDocument } from "./documents";

export const SUBMISSION_FILE_LIMIT = 10;
export const SUBMISSION_TOTAL_LIMIT = 50 * 1024 * 1024;
const standardNames={moa:'MOA',endorsement:'Endorsement Letter',consent:'Consent Form',medical:'Medical Certificate'};
export function submissionTypeOptions(rows,internId) {
  if(!Array.isArray(rows) || rows.some(r=>!r.id || r.intern_id!==internId || typeof r.name!=='string' || !r.name.trim() || typeof r.doc_type!=='string')
    || new Set(rows.map(r=>r.id)).size!==rows.length) throw new Error('Assigned document types are incomplete. Retry before selecting a requirement.');
  const options=rows.map(r=>({id:r.id,name:standardNames[r.doc_type.toLowerCase()]||r.name.trim(),type:r.doc_type,status:r.status}));
  return options.map(o=>({...o,label:options.filter(x=>x.name.toLowerCase()===o.name.toLowerCase()).length>1
    ? `${o.name} · ${standardNames[o.type.toLowerCase()]?'Standard requirement':'Custom requirement'} · ${o.id.slice(-8)}`:o.name}));
}
export function submissionDraftTitle(selection,otherTitle,options,optionsError='') {
  if(selection==='other') return otherTitle.trim()?{ok:true,title:otherTitle.trim()}:{ok:false,error:'Enter a document title for Other document.'};
  if(optionsError || !Array.isArray(options)) return {ok:false,error:'Assigned document types are unavailable. Retry or choose Other document.'};
  const option=options.find(o=>o.id===selection);
  return option?{ok:true,title:option.name}:{ok:false,error:'Select a document type.'};
}
export function validateSubmission(title, description, files) {
  const errors = [];
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200) errors.push("Title must contain 1–200 characters.");
  if (typeof description !== "string" || description.length > 2000) errors.push("Description must be at most 2,000 characters.");
  if (!Array.isArray(files) || !files.length || files.length > SUBMISSION_FILE_LIMIT) errors.push("Select 1–10 files.");
  if (Array.isArray(files)) {
    files.forEach((f, i) => { const error = validateDocument(f); if (error) errors.push(`File ${i + 1} (${f?.name || "unnamed"}): ${error}.`); });
    if (files.reduce((n, f) => n + (Number.isSafeInteger(f?.size) ? f.size : 0), 0) > SUBMISSION_TOTAL_LIMIT) errors.push("Total file size must not exceed 50 MiB.");
  }
  return errors;
}
export async function recoverSubmission(client, versionId, ownerId) {
  const outcome = await recordRpc(client, "cancel_submission", { p_version_id: versionId });
  const fail = error => ({ ok: false, cleanupPending: true, versionId, error });
  if (!outcome.ok || outcome.data.id !== versionId) return fail(outcome.error || "Recovery response unknown; retry recovery.");
  if (outcome.data.committed === true && outcome.data.submission?.intern_id === ownerId && Number(outcome.data.version) > 0)
    return { ok: true, data: outcome.data.submission, reconciled: true, committedVersion: outcome.data.version };
  const files = outcome.data.files;
  if (outcome.data.committed !== false || !Array.isArray(files) || !files.length || files.length > 10 ||
    new Set(files.map(f => f.path)).size !== files.length || files.some(f => !f.path?.startsWith(`${ownerId}/`) || typeof f.object_exists !== "boolean"))
    return fail("Incomplete recovery response; preserve staged files and retry.");
  const failures = [];
  for (const file of files) {
    try {
      const { data, error } = await client.storage.from("documents").remove([file.path]);
      if (error || !Array.isArray(data) || !(data.length === 1 || (data.length === 0 && file.object_exists === false)))
        failures.push(error?.message || "Storage removal unconfirmed");
    } catch (error) { failures.push(error.message || "Storage removal failed"); }
  }
  return failures.length ? fail(`Cleanup pending: ${failures.join("; ")}`) :
    { ok: false, cleanupPending: false, versionId, error: "Submission did not commit; abandoned staged files removed. Your draft is retained." };
}
export async function uploadSubmission(client, { ownerId, submission, title, description, files, attemptId }, onProgress = () => {}) {
  const errors = validateSubmission(title, description, files);
  if (errors.length) return { ok: false, error: errors.join(" ") };
  const args = { p_attempt_id: attemptId, p_submission_id: submission?.id || null, p_title: title.trim(), p_description: description,
    p_files: files.map(f => ({ name: f.name, mime: f.type, size: f.size })),
    p_expected_version: Number(submission?.current_version ?? 0), p_expected_revision: Number(submission?.review_revision ?? 0) };
  let reservation = await recordRpc(client, "stage_submission", args);
  // Known SQL rejections rolled back the reservation transaction. Transport,
  // HTTP and unknown-code failures still require idempotent reconciliation.
  const rejected = result => !result.ok && ["P0001","42501","40001","23514","23503","22023","22P02"].includes(result.errorCode);
  if (rejected(reservation)) return { ...reservation, cleanupPending: false };
  // One idempotent retry reconciles a lost reservation response without creating
  // a second set. The caller retains attemptId until its outcome is resolved.
  if (!reservation.ok) reservation = await recordRpc(client, "stage_submission", args);
  if (!reservation.ok) return { ...reservation, cleanupPending: true, versionId: attemptId };
  const version = reservation.data.version, reserved = reservation.data.files;
  if (reservation.data.id !== attemptId || version?.id !== attemptId || version.intern_id !== ownerId ||
    (submission && version.submission_id !== submission.id) || !Array.isArray(reserved) || reserved.length !== files.length ||
    new Set(reserved.map(f => f.id)).size !== files.length || reserved.some((f, i) =>
      f.version_id !== attemptId || f.ordinal !== i + 1 || f.file_name !== files[i].name || f.mime_type !== files[i].type || Number(f.byte_size) !== files[i].size ||
      !f.file_path?.startsWith(`${ownerId}/${version.submission_id}/${attemptId}/`)))
    return { ok: false, cleanupPending: true, versionId: attemptId, error: "Invalid reservation response; refresh and recover before retrying." };
  if (version.committed_at) return recoverSubmission(client, attemptId, ownerId);
  let failure;
  try {
    for (let i = 0; i < files.length; i++) {
      onProgress({ index: i, completed: i, total: files.length, state: "uploading" });
      const { error } = await client.storage.from("documents").upload(reserved[i].file_path, files[i], { upsert: false, contentType: files[i].type });
      if (error) throw new Error(`${files[i].name}: ${error.message}`);
      onProgress({ index: i, completed: i + 1, total: files.length, state: "uploaded" });
    }
    onProgress({ completed: files.length, total: files.length, state: "finalizing" });
    const result = await recordRpc(client, "finalize_submission", { p_version_id: attemptId });
    if (result.ok && result.data.id === version.submission_id && result.data.intern_id === ownerId && Number(result.data.current_version) > Number(version.expected_version)) return result;
    failure = result.error || "Finalization response unconfirmed";
  } catch (error) { failure = error.message || "Upload failed"; }
  const recovery = await recoverSubmission(client, attemptId, ownerId);
  return recovery.ok ? recovery : { ...recovery, error: `${failure}. ${recovery.error}` };
}
export async function submissionFileLink(client, file, download = false) {
  const access = await recordRpc(client, "submission_file_access", { p_id: file.id, p_version_id: file.version_id });
  return access.ok ? signedFileLink(client, access.data, download) : access;
}
export function reviewSubmission(client, submission, status, note) {
  if (!["Approved", "Needs Revision"].includes(status) || note.length > 500 || (status === "Needs Revision" && !note.trim()))
    return Promise.resolve({ ok: false, error: "Revision explanation required; maximum 500 characters." });
  return recordRpc(client, "review_submission", { p_id: submission.id, p_version: Number(submission.current_version),
    p_revision: Number(submission.review_revision), p_status: status, p_note: note.trim() || null });
}

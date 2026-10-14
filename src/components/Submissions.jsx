import { useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { completeRows } from "../lib/workflows";
import { recordRpc } from "../lib/authority";
import { recoverSubmission, reviewSubmission, uploadSubmission, validateSubmission, submissionTypeOptions, submissionDraftTitle } from "../lib/submissions";
import { paginate } from "../lib/lists";
import { Pagination } from "./ListControls";
import DocumentActions from "./DocumentActions";
import { useToast } from "./Toast";
import { EmptyState, LoadingState, StatusBadge } from "./UI";

const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "Unavailable";
export default function Submissions({ internId, owner = false }) {
  const { toast } = useToast();
  const id = useId(), sequence = useRef(0), inFlight = useRef(false), attempt = useRef(null), picker = useRef(null);
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [title, setTitle] = useState(""), [description, setDescription] = useState(""), [files, setFiles] = useState([]), [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(null), [notes, setNotes] = useState({});
  const [recovery, setRecovery] = useState([]), [recoveryError, setRecoveryError] = useState(""), [page, setPage] = useState(1);
  const [documentType,setDocumentType]=useState(''), [typeOptions,setTypeOptions]=useState(null);
  const [typesLoading,setTypesLoading]=useState(false), [typesError,setTypesError]=useState('');
  const typesSequence=useRef(0);
  const loadTypes=useCallback(async()=>{
    if(!owner) return;
    const request=++typesSequence.current;
    setTypesLoading(true);setTypesError('');
    try{
      const rows=await completeRows(supabase,'documents',internId,'id,intern_id,doc_type,name,status');
      const options=submissionTypeOptions(rows,internId);
      if(request===typesSequence.current) setTypeOptions(options);
    }catch(failure){if(request===typesSequence.current) setTypesError(failure.message||'Document types unavailable. Retry.');}
    finally{if(request===typesSequence.current) setTypesLoading(false);}
  },[internId,owner]);
  useEffect(()=>{const guard=typesSequence;loadTypes();return()=>{guard.current++;};},[loadTypes]);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setError("");
    try {
      const [submissions, versions, evidence, reviews] = await Promise.all(
        ["submissions", "submission_versions", "submission_files", "submission_reviews"].map(table => completeRows(supabase, table, internId)));
      if (request !== sequence.current) return;
      for (const v of versions.filter(v=>v.committed_at)) {
        if (!Array.isArray(v.manifest) || evidence.filter(f=>f.version_id===v.id).length!==v.manifest.length)
          throw new Error("Submission file evidence changed or is incomplete; refresh before reviewing.");
      }
      for (const s of submissions.filter(s=>Number(s.current_version)>0)) {
        const current=versions.find(v=>v.submission_id===s.id && Number(v.version_no)===Number(s.current_version) && v.committed_at);
        if (!current || current.status!==s.status || Number(current.review_revision)!==Number(s.review_revision) ||
          (s.status!=="Pending" && !reviews.some(r=>r.version_id===current.id && Number(r.review_revision)===Number(s.review_revision) && r.status===s.status)))
          throw new Error("Submission version or review changed during loading; refresh before reviewing.");
      }
      setData({ submissions: submissions.filter(s => Number(s.current_version)>0).sort((a,b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id)),
        versions, files: evidence, reviews });
      if (owner) {
        const result = await recordRpc(supabase, "submission_recovery_list");
        if (request !== sequence.current) return;
        if (result.ok && result.data.id === internId && Array.isArray(result.data.versions)) { setRecovery(result.data.versions); setRecoveryError(""); }
        else setRecoveryError(result.error || "Recovery list unavailable; refresh.");
      }
    } catch (failure) {
      if (request === sequence.current) { setData(null); setError(failure.message || "Submissions unavailable; retry."); }
    } finally { if (request === sequence.current) setLoading(false); }
  }, [internId, owner]);
  useEffect(() => { const guard=sequence; load(); return () => { guard.current++; }; }, [load]);
  const resetDraft = () => { setEditing(null); setDocumentType(''); setTitle(""); setDescription(""); setFiles([]); setProgress(null); attempt.current=null; if(picker.current) picker.current.value=""; };
  const save = async () => {
    if (inFlight.current) return;
    const choice=editing?{ok:true,title:title.trim()}:submissionDraftTitle(documentType,title,typeOptions,typesLoading?'Loading document types':typesError);
    if(!choice.ok){setError(choice.error);return;}
    const submissionTitle=choice.title;
    const problems = validateSubmission(submissionTitle, description, files);
    if (problems.length) { setError(problems.join(" ")); return; }
    const fingerprint = JSON.stringify([editing?.id, editing?.current_version, editing?.review_revision, submissionTitle, description, files.map(f => [f.name,f.size,f.type,f.lastModified])]);
    if (attempt.current && attempt.current.fingerprint !== fingerprint) {
      setError("Recover the previous attempt before changing and submitting this draft."); return;
    }
    attempt.current ||= { id: crypto.randomUUID(), fingerprint };
    inFlight.current=true; setBusy(true); setError("");
    try {
      const result = await uploadSubmission(supabase, { ownerId: internId, submission: editing, title:submissionTitle, description, files, attemptId: attempt.current.id }, setProgress);
      if (result.ok) { toast("Complete file set submitted for review", "success"); resetDraft(); }
      else { setError(result.error); setProgress({completed:0,total:files.length,state:result.cleanupPending ? "Recovery required; submission unconfirmed" : "Failed; abandoned staged files removed"}); if (!result.cleanupPending) attempt.current=null; }
      await load();
      if (!result.ok) setError(result.error);
    } finally { inFlight.current=false; setBusy(false); }
  };
  const clean = async versionId => {
    if (inFlight.current) return;
    inFlight.current=true; setBusy(true);
    try {
      const result = await recoverSubmission(supabase, versionId, internId);
      if (result.ok) { toast("Committed submission recovered; evidence retained", "success"); if (attempt.current?.id===versionId) resetDraft(); }
      else toast(result.error, result.cleanupPending ? "error" : "info");
      if (!result.cleanupPending && attempt.current?.id===versionId) attempt.current=null;
      await load();
    } finally { inFlight.current=false; setBusy(false); }
  };
  const decide = async (submission, status) => {
    if (inFlight.current) return;
    inFlight.current=true; setBusy(true);
    try {
      const result = await reviewSubmission(supabase, submission, status, notes[submission.id] || "");
      if (result.ok) { toast(status === "Approved" ? "File set approved" : "Revision requested", "success"); setNotes(prev => ({ ...prev, [submission.id]: "" })); }
      else toast(`${result.error} Refresh before retrying if the outcome is unknown.`, "error");
      await load();
    } finally { inFlight.current=false; setBusy(false); }
  };
  const result = paginate(data?.submissions || [], page, 10);
  return <section className="space-y-4" aria-label="Flexible submissions">
    <div><h2 className="text-lg font-semibold">Flexible submissions</h2>
      <p className="text-sm muted-copy">Submit any relevant documents as a named file set. Approval here does not satisfy the separate clearance checklist below.</p></div>
    {owner && <div className="surface-card space-y-3">
      <h3 className="font-semibold">{editing ? `Resubmit ${editing.title} — new version` : "New submission"}</h3>
      {!editing && <>
        <div>
          <label htmlFor={`${id}-type`} className="block text-sm">Document type</label>
          <select id={`${id}-type`} required disabled={busy} value={documentType} onChange={e=>setDocumentType(e.target.value)} className="form-control">
            <option value="">Select document type</option>
            {(typeOptions||[]).map(o=><option key={o.id} value={o.id} disabled={typesLoading||Boolean(typesError)}>{o.label}</option>)}
            <option value="other">Other document</option>
          </select>
        </div>
        <button disabled={busy||typesLoading} onClick={loadTypes} className="text-sm underline">Refresh document types</button>
        {typesLoading && <p role="status" className="text-sm muted-copy">Loading assigned document types…</p>}
        {typesError && <p role="alert" className="text-sm">{typesError} <button disabled={busy||typesLoading} onClick={loadTypes} className="underline">Retry document types</button></p>}
        {!typesLoading&&!typesError&&typeOptions?.length===0&&<p className="text-sm muted-copy">No assigned document types. Choose Other document.</p>}
        {documentType&&documentType!=='other'&&<p className="text-sm muted-copy">This remains a flexible submission and does not satisfy clearance. <a href="#intern-clearance-requirements" className="underline">Go to clearance requirements</a> to upload against the selected requirement.</p>}
      </>}
      {(editing||documentType==='other')&&<label htmlFor={`${id}-title`} className="block text-sm">Document title<input id={`${id}-title`} required disabled={busy} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} className="form-control" /></label>}
      <label htmlFor={`${id}-description`} className="block text-sm">Description (optional)<textarea id={`${id}-description`} disabled={busy} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="form-control" /></label>
      <label htmlFor={`${id}-files`} className="block text-sm">Files (required)
        <input ref={picker} id={`${id}-files`} disabled={busy} type="file" multiple accept="application/pdf,image/jpeg,image/png" className="form-control"
          onChange={e=>{ setFiles(Array.from(e.target.files || [])); setProgress(null); }} /></label>
      <p className="text-sm muted-copy">1–10 PDF/JPEG/PNG files. Maximum 10 MiB each and 50 MiB total. Selecting again replaces the draft file list.</p>
      {files.length>0 && <ul className="text-sm space-y-1">{files.map((f,i)=><li key={i} className="break-words">{i+1}. {f.name} · {(f.size/1048576).toFixed(2)} MiB{progress && i<progress.completed ? " · Uploaded (awaiting complete-set commit)" : ""}</li>)}</ul>}
      {progress && <div role="status" className="text-sm"><progress aria-label="Files uploaded" value={progress.completed} max={progress.total} /> {progress.completed}/{progress.total} files · {progress.state}</div>}
      <div className="flex flex-wrap gap-3"><button disabled={busy || loading} onClick={save} className="action-primary">{busy ? "Working…" : "Submit complete file set"}</button>
        {editing && <button disabled={busy || Boolean(attempt.current)} onClick={resetDraft} className="action-secondary">Cancel resubmission</button>}</div>
      {attempt.current && !busy && <button onClick={()=>clean(attempt.current.id)} className="action-secondary">Recover previous attempt / clean abandoned files</button>}
    </div>}
    <button disabled={busy || loading} onClick={load} className="action-secondary">{loading ? "Loading submissions…" : "Refresh submissions"}</button>
    {loading && <LoadingState>Loading submission records…</LoadingState>}
    {error && <p role="alert" className="text-sm">{error} <button disabled={busy || loading} onClick={load} className="underline">Retry read</button></p>}
    {owner && <div className="space-y-2 text-sm">
      {recoveryError && <p role="alert">{recoveryError}</p>}
      {recovery.map(v=><div key={v.id} className="surface-card">Unfinished upload: {v.title} · {timestamp(v.created_at)}
        <button disabled={busy} onClick={()=>clean(v.id)} className="action-secondary ml-2">Recover / abandon and clean up</button></div>)}
    </div>}
    {!loading && data && !result.total && <div className="surface-card"><EmptyState title="No committed flexible submissions yet." /></div>}
    {data && <>
      <Pagination result={result} onPage={setPage} label="submissions" disabled={busy} />
      {result.rows.map(s=><article key={s.id} className="surface-card space-y-3">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold break-words">{s.title}</h3><span className="submission-version">Version {s.current_version} · <StatusBadge status={s.status} /></span></div>
        {s.description && <p className="text-sm whitespace-pre-wrap break-words">{s.description}</p>}
        {s.note && <p className="text-sm whitespace-pre-wrap break-words"><strong>Review explanation:</strong> {s.note}</p>}
        {s.reviewed_by && <p className="text-xs muted-copy break-words">Reviewer UUID: {s.reviewed_by} · {timestamp(s.reviewed_at)}</p>}
        {data.files.filter(f=>data.versions.some(v=>v.id===f.version_id && v.submission_id===s.id && Number(v.version_no)===Number(s.current_version))).sort((a,b)=>a.ordinal-b.ordinal).map(f=><div key={f.id} className="border rounded-lg p-3">
          <p className="text-sm break-words">{f.file_name} · {(Number(f.byte_size)/1048576).toFixed(2)} MiB</p><DocumentActions doc={f} /></div>)}
        {owner ? <button disabled={busy || Boolean(attempt.current)} className="action-secondary" onClick={()=>{ setEditing(s); setTitle(s.title); setDescription(s.description); setFiles([]); setProgress(null); if(picker.current)picker.current.value=""; }}>Resubmit a new file set</button> :
          s.status==="Pending" && <div className="space-y-2">
            <label htmlFor={`${id}-${s.id}-note`} className="block text-sm">Review explanation (required to request revision)
              <textarea id={`${id}-${s.id}-note`} disabled={busy} maxLength={500} value={notes[s.id] || ""} onChange={e=>setNotes(p=>({...p,[s.id]:e.target.value}))} rows={2} className="form-control" /></label>
            <p className="text-xs muted-copy">Applies to the entire file set in version {s.current_version}, revision {s.review_revision}.</p>
            <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>decide(s,"Approved")} className="action-primary">Approve version {s.current_version}</button>
              <button disabled={busy || !notes[s.id]?.trim()} onClick={()=>decide(s,"Needs Revision")} className="action-secondary">Request revision</button></div>
          </div>}
        <details><summary className="cursor-pointer text-sm font-medium">Submission versions and review history</summary>
          {data.versions.filter(v=>v.submission_id===s.id && v.committed_at).sort((a,b)=>Number(b.version_no)-Number(a.version_no)).map(v=><div key={v.id} className="mt-3 border rounded-lg p-3 space-y-2">
            <p className="text-sm">Version {v.version_no} · {v.title} · Submitted {timestamp(v.committed_at)}</p>
            <p className="text-sm whitespace-pre-wrap break-words">{v.description}</p>
            {data.files.filter(f=>f.version_id===v.id).sort((a,b)=>a.ordinal-b.ordinal).map(f=><div key={f.id}><span className="text-sm break-words">{f.file_name}</span><DocumentActions doc={f} /></div>)}
            {data.reviews.filter(r=>r.version_id===v.id).sort((a,b)=>Number(a.review_revision)-Number(b.review_revision)).map(r=><p key={r.id} className="text-xs whitespace-pre-wrap break-words">{r.status} · Reviewer UUID {r.reviewed_by} · {timestamp(r.reviewed_at)}{r.note ? ` · ${r.note}` : ""}</p>)}
            {!data.reviews.some(r=>r.version_id===v.id) && <p className="text-xs muted-copy">No review committed for this version.</p>}
          </div>)}
        </details>
      </article>)}
    </>}
  </section>;
}

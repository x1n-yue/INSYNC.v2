import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { completeRows } from "../lib/workflows";
import { requestResult } from '../lib/requests';
import Modal from "./Modal";
import DocumentActions from "./DocumentActions";
import { EmptyState, ErrorNotice, LoadingState, StatusBadge } from "./UI";

const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "Unavailable";
export default function DocumentHistory({ doc }) {
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false);
  const [data, setData] = useState(null), [error, setError] = useState("");
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setData(null); setError("");
    try {
      const [versions, reviews, current] = await Promise.all([
        ...["document_versions", "document_review_events"].map(table => completeRows(supabase, table, doc.intern_id)),
        requestResult(supabase.from('documents').select('id,intern_id,legacy_evidence').eq('id',doc.id).single(),'Legacy evidence retrieval failed')]);
      if (request !== sequence.current) return;
      if(current.error||current.data?.id!==doc.id||current.data?.intern_id!==doc.intern_id)throw new Error('Legacy metadata unavailable; retry');
      setData({ versions: versions.filter(v => v.document_id === doc.id && v.committed_at).sort((a, b) => Number(b.version_no) - Number(a.version_no)),
        reviews: reviews.filter(r => r.document_id === doc.id), legacy:current.data.legacy_evidence });
    } catch (failure) {
      if (request === sequence.current) {
        console.error("Document history retrieval failed:", failure.message);
        setError("Document history unavailable. Check your connection and retry.");
      }
    } finally { if (request === sequence.current) setLoading(false); }
  }, [doc.id, doc.intern_id]);
  useEffect(() => {
    const guard = sequence;
    if (open) load();
    return () => { guard.current++; };
  }, [open, load, doc.upload_version, doc.review_revision]);
  return <div className="mt-3">
    <button className="action-secondary text-xs" onClick={() => setOpen(true)}>File &amp; review history</button>
    {open && <Modal title={`${doc.name} — history`} onClose={() => setOpen(false)}>
      <div className="space-y-4">
        <p className="text-sm muted-copy">Previous files and review explanations are retained. This history does not change the current clearance requirement.</p>
        <p className="text-xs muted-copy">Files that predate version history may have unavailable metadata. Contact your administrator if an earlier file is missing; unknown evidence is not reconstructed.</p>
        {loading && <LoadingState>Loading history…</LoadingState>}
        {error && <ErrorNotice title="History unavailable" onRetry={load}>{error}</ErrorNotice>}
        {data?.legacy&&<article className="surface-card space-y-2">
          <h3 className="font-semibold">Legacy file · {data.legacy.file_name || 'File name not recorded'}</h3>
          <p className="text-sm">Stored legacy status: {data.legacy.status || 'Unknown'}. Evidence unverified; this does not approve the current requirement.</p>
          <p className="text-xs muted-copy">Captured before replacement: {timestamp(data.legacy.captured_at)} · Original saved review date: {timestamp(data.legacy.reviewed_at)}</p>
          {data.legacy.note&&<p className="text-sm whitespace-pre-wrap break-words">Original saved note: {data.legacy.note}</p>}
          <DocumentActions doc={{id:doc.id,intern_id:doc.intern_id,file_name:data.legacy.file_name,
            file_path:data.legacy.file_path?.startsWith(`${doc.intern_id}/`)?data.legacy.file_path:null,legacy_snapshot:true}} />
        </article>}
        {data?.versions.length === 0 && <EmptyState title="No committed versions recorded">Legacy files may predate version history. Their evidence has not been reconstructed.</EmptyState>}
        {data?.versions.map(v => <article className="surface-card space-y-2" key={v.id}>
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Version {v.version_no} · {v.file_name}</h3><StatusBadge status={v.status} /></div>
          <p className="text-xs muted-copy">Submitted: {timestamp(v.committed_at)}{Number(v.version_no) === Number(doc.upload_version) ? " · Current file" : " · Previous file"}</p>
          <DocumentActions doc={{ ...v, history_version_id: v.id, upload_version: v.version_no }} />
          {data.reviews.filter(r => r.version_id === v.id).sort((a, b) => Number(a.review_revision) - Number(b.review_revision)).map(r => <div className="border-t pt-2 text-sm" key={r.id}>
            <StatusBadge status={r.status} /><p className="text-xs muted-copy">{timestamp(r.reviewed_at)} · Review {r.review_revision}</p>
            {r.note && <p className="whitespace-pre-wrap break-words">{r.note}</p>}
          </div>)}
        </article>)}
      </div>
    </Modal>}
  </div>;
}

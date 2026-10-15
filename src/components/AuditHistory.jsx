import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { recordRpc } from "../lib/authority";
import { calendarDate } from "../lib/lists";
import { Pagination } from "./ListControls";
import { EmptyState, ErrorNotice, LoadingState } from "./UI";
import { ReportDownloads } from "./ReportsPanel";
const categories=["logbook_submissions","logbook_versions","logbook_events","profiles","interns","companies","course_sections","academic_years","attendance_logs","attendance_sheet_evidence","manual_attendance_events","attendance_exceptions","evaluations","supervisor_assignments","supervisor_evaluations","evaluation_reviews","evaluation_routing_events","evaluation_adjustment_events","documents","document_versions","document_review_events","submissions","submission_versions","submission_files","submission_reviews","announcements","alerts"];
export default function AuditHistory({ refreshKey }) {
  const [filters,setFilters]=useState({actor:"",action:"",category:"",start:"",end:""});
  const [page,setPage]=useState(1),[size,setSize]=useState(25),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [retry,setRetry]=useState(0),sequence=useRef(0);
  const change=(key,value)=>{setFilters(p=>({...p,[key]:value}));setPage(1);};
  useEffect(()=>{
    const guard=sequence;
    const request=++sequence.current;
    setData(null);setError("");setLoading(true);
    let validation="";
    if ((filters.start && calendarDate(filters.start)===null) || (filters.end && calendarDate(filters.end)===null)) validation="Enter valid calendar dates.";
    if (filters.start && filters.end && filters.start>filters.end) validation="Start date must be on or before end date.";
    if(validation){setError(validation);setLoading(false);return;}
    const timer=setTimeout(async()=>{
      const result=await recordRpc(supabase,"audit_history",{p_actor:filters.actor,p_action:filters.action,p_category:filters.category,
        p_from:filters.start||null,p_to:filters.end||null,p_page:page,p_size:size});
      if(request!==sequence.current)return;
      const d=result.data;
      if(!result.ok) setError(result.error);
      else if(d.id!=="audit-history" || !Number.isSafeInteger(d.total) || d.total<0 || !Number.isSafeInteger(d.page) || d.page<1 ||
        d.pages!==Math.max(1,Math.ceil(d.total/size)) || d.page>d.pages || d.size!==size || !Array.isArray(d.rows) ||
        d.rows.length!==Math.min(size,Math.max(0,d.total-(d.page-1)*size)) || new Set(d.rows.map(r=>r.id)).size!==d.rows.length)
        setError("Incomplete audit page; refresh and retry.");
      else setData({...d,from:d.total?(d.page-1)*size+1:0,to:Math.min(d.page*size,d.total)});
      setLoading(false);
    },200);
    return()=>{clearTimeout(timer);guard.current++;};
  },[filters,page,size,retry,refreshKey]);
  return <section className="space-y-3 p-4">
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <label htmlFor="audit-actor" className="text-sm">Actor name or UUID<input id="audit-actor" type="search" maxLength={200} value={filters.actor} onChange={e=>change("actor",e.target.value)} className="form-control" /></label>
      <label htmlFor="audit-action" className="text-sm">Action<input id="audit-action" type="search" maxLength={200} value={filters.action} onChange={e=>change("action",e.target.value)} className="form-control" /></label>
      <label htmlFor="audit-category" className="text-sm">Category<select id="audit-category" value={filters.category} onChange={e=>change("category",e.target.value)} className="form-control"><option value="">All categories, including legacy</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label htmlFor="audit-start" className="text-sm">From (Manila date)<input id="audit-start" type="date" value={filters.start} onChange={e=>change("start",e.target.value)} className="form-control" /></label>
      <label htmlFor="audit-end" className="text-sm">Through (inclusive)<input id="audit-end" type="date" value={filters.end} onChange={e=>change("end",e.target.value)} className="form-control" /></label>
      <label htmlFor="audit-size" className="text-sm">Rows per page<select id="audit-size" value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}} className="form-control">{[10,25,50,100].map(n=><option key={n}>{n}</option>)}</select></label>
    </div>
    <p className="text-sm muted-copy">Filters search the complete authorized history on the server. Latest first, with record ID breaking timestamp ties. Legacy events remain unverified. Concurrent changes can shift pages; refresh when needed.</p>
    <button disabled={loading} onClick={()=>setRetry(n=>n+1)} className="action-secondary">Refresh history</button>
    <div className="surface-card p-3 space-y-2"><p className="text-sm">Export the complete matching audit history with the filters above (independent of the visible page). Informational report.</p>
      <ReportDownloads role="admin" reportKey="audit" filters={{...filters,mode:'audit'}} /></div>
    {loading && <LoadingState>Loading audit history…</LoadingState>}
    {error && <ErrorNotice onRetry={()=>setRetry(n=>n+1)}>{error}</ErrorNotice>}
    {data && <>
      <Pagination result={data} onPage={setPage} label="audit events" />
      {!data.total && <EmptyState title="No audit events match these filters." />}
      {data.rows.map(l=><article key={l.id} className="border rounded-lg p-3 grid sm:grid-cols-[12rem_1fr] gap-2">
        <div className="text-sm break-words"><time dateTime={l.created_at}>{l.created_at && Number.isFinite(Date.parse(l.created_at)) ? new Date(l.created_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"}) : "Date unavailable"}</time>
          <p className="font-medium">{l.actor_name || "Actor unavailable"}</p><p className="text-xs muted-copy">{l.actor_id || "No recorded actor UUID"}</p></div>
        <div className="min-w-0 break-words"><p className="text-xs font-medium">{l.source==="database-trigger-v2" ? "Trusted database event" : "Legacy / provenance unverified"}</p><p className="text-sm font-semibold">{l.action || "Action unavailable"}</p><p className="text-sm muted-copy">{l.detail}</p></div>
      </article>)}
      <Pagination result={data} onPage={setPage} label="audit events" />
    </>}
  </section>;
}

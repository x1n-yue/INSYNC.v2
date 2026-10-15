import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { completeRows } from '../lib/workflows';
import { recordRpc } from '../lib/authority';
import { ErrorNotice } from './UI';
import { useToast } from './Toast';
import EvaluationCriteria from './EvaluationCriteria';
export default function SupervisorAssignments({ users,interns,companies,onChanged }) {
  const {toast}=useToast();
  const [assignments,setAssignments]=useState([]),[sources,setSources]=useState([]),[reviews,setReviews]=useState([]),[events,setEvents]=useState([]);
  const [supervisor,setSupervisor]=useState(''),[intern,setIntern]=useState(''),[source,setSource]=useState(''),[reason,setReason]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[showHistory,setShowHistory]=useState(false);
  const lock=useRef(false);
  const load=useCallback(async()=>{try{const [a,s,r,e]=await Promise.all(['supervisor_assignments','supervisor_evaluations','evaluation_reviews','evaluation_routing_events'].map(t=>completeRows(supabase,t)));setAssignments(a);setSources(s);setReviews(r);setEvents(e);setError('');}catch(e){setError(e.message);}},[]);
  useEffect(()=>{load();},[load]);
  const person=id=>users.find(u=>u.id===id)?.full_name||id;
  const selected=users.find(u=>u.id===supervisor),selectedSource=sources.find(s=>s.id===source),selectedReview=reviews.find(r=>r.id===source);
  const change=async(name,args)=>{if(lock.current)return;lock.current=true;setBusy(true);try{const result=await recordRpc(supabase,name,args);if(!result.ok)return toast(result.error,'error');toast('Assignment change saved','success');setReason('');await load();onChanged?.();}finally{lock.current=false;setBusy(false);}};
  return <section className="surface-card p-4 space-y-4" aria-label="Supervisor assignments and evaluation oversight">
    <h2 className="text-lg font-semibold">Supervisor assignments</h2><p className="text-sm muted-copy">Set the Supervisor company in Account Management, then explicitly assign each Intern. End affected assignments before changing company, role or status.</p>
    {error&&<ErrorNotice onRetry={load}>{error}</ErrorNotice>}
    <div className="grid md:grid-cols-2 gap-3"><label className="text-sm">Supervisor<select disabled={busy} className="form-control" value={supervisor} onChange={e=>{setSupervisor(e.target.value);setIntern('');}}><option value="">Choose Active Supervisor</option>{users.filter(u=>u.role==='supervisor'&&u.status==='Active').map(u=><option key={u.id} value={u.id}>{u.full_name} · {companies.find(c=>c.id===u.supervisor_company_id)?.name||u.supervisor_company_id}</option>)}</select></label>
      <label className="text-sm">Intern in Supervisor company<select disabled={busy} className="form-control" value={intern} onChange={e=>setIntern(e.target.value)}><option value="">Choose Active Intern</option>{interns.filter(i=>selected&&i.company_id===selected.supervisor_company_id&&users.some(u=>u.id===i.id&&u.role==='intern'&&u.status==='Active')).map(i=><option key={i.id} value={i.id}>{person(i.id)} · {users.find(u=>u.id===i.id)?.student_id||i.id}</option>)}</select></label></div>
    <button className="action-primary" disabled={busy||!supervisor||!intern||!!error} onClick={()=>change('admin_set_supervision',{p_supervisor_id:supervisor,p_intern_id:intern,p_assigned:true})}>Assign Intern to Supervisor</button>
    <button className="action-secondary ml-2" disabled={busy} onClick={load}>Refresh oversight</button>
    {assignments.filter(a=>!a.ended_at).map(a=><div className="flex flex-wrap items-center gap-3 border-t pt-3" key={a.id}><p className="text-sm">{person(a.supervisor_id)} → {person(a.intern_id)} · {companies.find(c=>c.id===a.company_id)?.name||a.company_id}</p><button className="action-secondary" disabled={busy} onClick={()=>change('admin_set_supervision',{p_supervisor_id:a.supervisor_id,p_intern_id:a.intern_id,p_assigned:false})}>End assignment</button></div>)}
    <button className="action-secondary" onClick={()=>setShowHistory(!showHistory)}>Assignment history</button>
    {showHistory&&assignments.filter(a=>a.ended_at).map(a=><p key={a.id} className="text-sm">{person(a.supervisor_id)} → {person(a.intern_id)} · ended {a.ended_at} by {person(a.ended_by)} · {a.company_id}</p>)}
    <h2 className="text-lg font-semibold">Evaluation oversight and explicit rerouting</h2>
    <label className="block text-sm">Source evaluation<select className="form-control" disabled={busy} value={source} onChange={e=>{setSource(e.target.value);setReason('');}}><option value="">Choose evaluation</option>{sources.map(s=><option key={s.id} value={s.id}>{person(s.intern_id)} · {s.evaluation_date} · {reviews.find(r=>r.id===s.id)?.status||s.status} · {s.id}</option>)}</select></label>
    {selectedSource&&<div className="space-y-3"><p className="text-sm">Original Supervisor: {person(selectedSource.supervisor_id)} · Original company: {selectedSource.company_id} · Original Coordinator: {person(selectedSource.coordinator_id)} · version {selectedSource.version}</p><EvaluationCriteria criteria={selectedSource.criteria}/><p>Original score: {selectedSource.overall_score??'Draft'}/100</p><p className="whitespace-pre-wrap break-words">{selectedSource.feedback}</p>
      {selectedReview&&<><p>Routed to: {person(selectedReview.coordinator_id)} · {selectedReview.status}</p><p className="whitespace-pre-wrap break-words">{selectedReview.summary}</p></>}
      {selectedReview&&selectedReview.status!=='Published to Intern'&&<><p className="text-sm">Reroute to the Intern’s current Active Coordinator. The original company must still match. This explicitly clears the previous review draft and records the reason.</p><label className="block text-sm">Reassignment reason<textarea className="form-control" maxLength={2000} disabled={busy} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="action-primary" disabled={busy||!reason.trim()||!interns.find(i=>i.id===selectedSource.intern_id)?.instructor_id} onClick={()=>change('admin_reroute_evaluation',{p_id:source,p_coordinator_id:interns.find(i=>i.id===selectedSource.intern_id)?.instructor_id,p_reason:reason,p_expected_revision:selectedReview.revision})}>Reroute and clear prior draft</button></>}
      {events.filter(e=>e.source_id===source).map(e=><p className="text-xs" key={e.id}>{e.created_at}: {person(e.previous_coordinator_id)} → {person(e.coordinator_id)} · {e.reason} · Admin {person(e.actor_id)}</p>)}
    </div>}
  </section>;
}

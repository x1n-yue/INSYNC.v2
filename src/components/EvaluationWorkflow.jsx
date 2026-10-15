import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { recordRpc, manilaDate } from '../lib/authority';
import { completeRows } from '../lib/workflows';
import { rubricScore, evaluationResult } from '../lib/business';
import { adjustmentError, emptyChoices, feedbackText, reviewMode } from '../lib/evaluationFeedback';
import { paginate } from '../lib/lists';
import { Pagination } from './ListControls';
import EvaluationCriteria from './EvaluationCriteria';
import EvaluationRatings from './EvaluationRatings';
import CoordinatorFeedback, { RatingAdjustments } from './CoordinatorFeedback';
import { PageHeader, ErrorNotice, LoadingState, EmptyState, StatusBadge } from './UI';
import { IconFileText, IconUsers } from './Icons';
import Modal from './Modal';
import { useToast } from './Toast';

export function EvaluationFinal({ evaluation }) {
  return <div className="space-y-3">
    <p className="text-xs muted-copy">{evaluation.provenance === 'supervisor_review' ? 'Reviewed Supervisor evaluation' : 'Legacy Coordinator evaluation'} · {evaluation.evaluation_date || 'Date recorded at publication'}</p>
    <EvaluationCriteria criteria={evaluation.competencies} />
    <p className="text-xl font-bold">{evaluationResult(evaluation) ?? 'Unavailable'}/100</p>
    {[['Summary',evaluation.feedback],['Strengths',evaluation.strengths],['Areas for improvement',evaluation.improvements],['Guidance',evaluation.guidance]].map(([label,value])=>value && <div key={label}><h3 className="font-semibold text-sm">{label}</h3><p className="whitespace-pre-wrap break-words text-sm">{value}</p></div>)}
  </div>;
}
const blank = (internId='') => ({id:crypto.randomUUID(),intern_id:internId,evaluation_date:manilaDate(),criteria:{},feedback:'',version:0});
const writtenFields = review => Object.fromEntries(['summary','strengths','improvements','guidance'].map(key=>[key,review[key]||'']));
function SourceDetail({ source,label }) {
  return <div className="evaluation-source-detail">
    <dl className="evaluation-field-grid text-sm">{[['Intern',label(source.intern_id)],['Evaluation date (Manila)',source.evaluation_date],['Supervisor',source.supervisor_id],['Company',source.company_id],['Original Coordinator',source.coordinator_id||'Resolved on submission'],['Source version',source.version],['Submitted (Manila)',source.submitted_at?new Date(source.submitted_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):'Private draft']].map(([key,value])=><div key={key}><dt className="muted-copy">{key}</dt><dd className="break-words">{value}</dd></div>)}</dl>
    <EvaluationCriteria criteria={source.criteria}/><p className="font-semibold">Original server score: {source.overall_score??'Incomplete draft'}/100</p>
    <div><h3 className="font-semibold text-sm">Supervisor feedback</h3><p className="whitespace-pre-wrap break-words text-sm">{source.feedback||'No personal feedback recorded.'}</p></div>
  </div>;
}
export default function EvaluationWorkflow({ supervisor=false,roster=[],onChanged,assignedOnly=false,rosterLoading=false,rosterError='',onRefreshRoster,initialInternId='' }) {
  const { toast }=useToast();
  const [sources,setSources]=useState([]),[reviews,setReviews]=useState([]),[finals,setFinals]=useState([]);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [form,setForm]=useState(()=>initialInternId?blank(initialInternId):null),[review,setReview]=useState(null),[preview,setPreview]=useState(false),[detail,setDetail]=useState(null);
  const [mode,setMode]=useState(supervisor?'drafts':'queue'),[search,setSearch]=useState(''),[page,setPage]=useState(1),[size,setSize]=useState(10);
  const lock=useRef(false),generation=useRef(0);
  const load=useCallback(async()=>{
    const request=++generation.current;setLoading(true);setError('');
    try {
      const [s,r,f]=await Promise.all([completeRows(supabase,'supervisor_evaluations'),supervisor?[]:completeRows(supabase,'evaluation_reviews'),supervisor?[]:completeRows(supabase,'evaluations')]);
      if(request!==generation.current)return;setSources(s);setReviews(r);setFinals(f);
    }catch(e){if(request===generation.current)setError(e.message);}
    finally{if(request===generation.current)setLoading(false);}
  },[supervisor]);
  useEffect(()=>{
    load();const refresh=()=>{if(document.visibilityState==='visible'&&!lock.current)load();};
    const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);
    const guard=generation;return()=>{guard.current++;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[load]);
  const label=id=>roster.find(i=>i.id===id)?.full_name||roster.find(i=>i.id===id)?.name||id;
  const canCreate=supervisor&&!rosterLoading&&!rosterError&&roster.length>0;
  const newEvaluation=()=>{if(canCreate&&!busy&&!form)setForm(blank());};
  const saveSource=async submit=>{
    if(lock.current)return;lock.current=true;setBusy(true);
    try {
      const result=await recordRpc(supabase,'save_supervisor_evaluation',{p_id:form.id,p_intern_id:form.intern_id,p_date:form.evaluation_date,p_criteria:form.criteria,p_feedback:form.feedback,p_expected_version:form.version,p_submit:submit});
      if(!result.ok){toast(result.error,'error');return;}
      setForm(submit?null:result.data);toast(submit?'Submitted to Coordinator':'Supervisor draft saved','success');await load();onChanged?.();
    }finally{lock.current=false;setBusy(false);}
  };
  const source=review&&sources.find(s=>s.id===review.id);
  let fields=review?writtenFields(review):null,textError='';
  if(review?.feedback_mode==='selected') {
    try {fields=feedbackText(review.feedback_choices,review.additional_remarks);}catch(e){textError=e.message;}
  }
  const reasonError=review&&source?adjustmentError(source.criteria,review.criteria,review.adjustment_reasons):null;
  const reviewValid=review&&!textError&&!reasonError;
  const publishValid=reviewValid&&fields.summary.trim()&&(review.feedback_mode!=='selected'||review.feedback_choices.overall.length===1);
  const editReview=patch=>{setReview(current=>({...current,...patch}));setPreview(false);};
  const openReview=row=>{
    const r=reviews.find(r=>r.id===row.id);
    setReview({...r,feedback_mode:reviewMode(r),feedback_choices:r.feedback_choices||emptyChoices(),additional_remarks:r.additional_remarks||'',adjustment_reasons:r.adjustment_reasons||{}});setPreview(false);
  };
  const switchFeedback=mode=>{
    const patch={feedback_mode:mode};
    if(mode==='written'&&review.written_feedback)Object.assign(patch,review.written_feedback);
    editReview(patch);
  };
  const saveReview=async publish=>{
    if(lock.current||!reviewValid)return;lock.current=true;setBusy(true);
    try {
      const result=await recordRpc(supabase,'save_evaluation_review_v2',{p_id:review.id,p_expected_revision:review.revision,p_mode:review.feedback_mode,p_choices:review.feedback_choices,p_remarks:review.additional_remarks,p_written:writtenFields(review),p_criteria:review.criteria,p_adjustments:review.adjustment_reasons,p_expected_feedback:fields,p_publish:publish});
      if(!result.ok){toast(result.error,'error');return;}
      setReview(publish?null:{...result.data,feedback_choices:result.data.feedback_choices||emptyChoices()});setPreview(false);
      toast(publish?'Published to Intern':'Coordinator draft saved','success');await load();onChanged?.();
    }finally{lock.current=false;setBusy(false);}
  };
  let records=mode==='published'?finals:sources.filter(s=>supervisor?(mode==='drafts'?s.status==='Supervisor Draft':s.status==='Submitted to Coordinator'):reviews.some(r=>r.id===s.id&&(mode==='drafts'?r.status==='Coordinator Draft':r.status!=='Published to Intern')));
  records=records.filter(r=>!assignedOnly||roster.some(i=>i.id===r.intern_id));
  const unfilteredCount=records.length;
  records=records.filter(r=>`${label(r.intern_id)} ${r.id} ${r.evaluation_date||''}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||b.id.localeCompare(a.id));
  const result=paginate(records,page,size);
  const tabs=supervisor?[['drafts','Supervisor Drafts'],['submitted','Submitted History']]:[['queue','Awaiting Review'],['drafts','Coordinator Drafts'],['published','Published History']];
  const newAction=<button className="action-primary" disabled={busy||!!form||!canCreate} onClick={newEvaluation}>New Evaluation</button>;
  const emptyTitle=search.trim()?'No search results':supervisor&&rosterError?'Assignments unavailable':supervisor&&!rosterLoading&&!roster.length?'No assigned interns':mode==='submitted'?'No submitted evaluations yet':mode==='drafts'?'No evaluations yet':mode==='published'?'No published evaluations yet':'No evaluations awaiting review';
  const emptyDescription=search.trim()?'Try another intern name, identifier or date, or clear the search.':supervisor&&rosterError?'Retry the assigned-intern lookup before creating an evaluation.':supervisor&&!rosterLoading&&!roster.length?'Ask Admin to assign Active interns in your company before creating an evaluation.':supervisor?'Start a private evaluation for an assigned intern. Submitted evaluations will appear in Submitted History.':'Submitted Supervisor evaluations appear here when routed to you and authorized by your current assignment.';
  return <section className="evaluation-workflow" aria-label="Evaluation workflow">
    {supervisor&&<PageHeader eyebrow="Supervisor workspace" title="Evaluations" description="Create private drafts and track evaluations submitted to the OJT Coordinator." actions={newAction}/>}
    <div className="evaluation-tabs" role="group" aria-label="Evaluation views">{tabs.map(([id,title])=><button key={id} type="button" className="evaluation-tab" aria-pressed={mode===id} disabled={busy} onClick={()=>{setMode(id);setPage(1);}}>{title}</button>)}</div>
    {supervisor&&rosterError&&<ErrorNotice title="Assigned interns unavailable" onRetry={onRefreshRoster}>{rosterError}</ErrorNotice>}
    {supervisor&&!rosterLoading&&!rosterError&&!roster.length&&records.length>0&&<p className="evaluation-context-note" role="status">No Active interns are currently assigned to you. Your own evaluation history remains available; ask Admin to configure assignments before creating or editing a draft.</p>}
    {form&&<section className="surface-card evaluation-editor" aria-label="Supervisor evaluation editor">
      <div className="evaluation-editor-header"><div><h2>{form.version?'Edit Evaluation Draft':'New Evaluation'}</h2><p className="text-sm muted-copy">Private until you submit it to the Coordinator.</p></div><StatusBadge status="Supervisor Draft"/></div>
      <div className="evaluation-field-grid">
        <label className="evaluation-field">Assigned Intern<select aria-label="Assigned Intern" className="form-control" disabled={busy||form.version>0||rosterLoading} value={form.intern_id} onChange={e=>setForm({...form,intern_id:e.target.value})}><option value="">Choose assigned Intern</option>{roster.map(i=><option key={i.id} value={i.id}>{label(i.id)} · {i.student_id||i.id}</option>)}</select></label>
        <label className="evaluation-field">Evaluation date (Manila)<input className="form-control" disabled={busy} type="date" value={form.evaluation_date} onChange={e=>setForm({...form,evaluation_date:e.target.value})}/></label>
      </div>
      {onRefreshRoster&&<div className="evaluation-actions"><button className="action-secondary" disabled={busy||rosterLoading} onClick={onRefreshRoster}>Refresh assigned interns</button><span className="text-xs muted-copy">Only Active interns explicitly assigned to you are available.</span></div>}
      <EvaluationRatings value={form.criteria} disabled={busy} onChange={criteria=>setForm({...form,criteria})}/>
      <label className="evaluation-field">Personal feedback<textarea className="form-control" rows={4} maxLength={2000} disabled={busy} value={form.feedback} onChange={e=>setForm({...form,feedback:e.target.value})}/></label>
      <p className="text-xs muted-copy">All four ratings and an Active assigned Coordinator are required to submit. Submitted versions are locked.</p>
      <div className="evaluation-actions"><button className="action-secondary" disabled={busy||!canCreate||!roster.some(i=>i.id===form.intern_id)||!form.evaluation_date} onClick={()=>saveSource(false)}>Save Draft</button><button className="action-primary" disabled={busy||!canCreate||!roster.some(i=>i.id===form.intern_id)||!form.evaluation_date||rubricScore(form.criteria)===null} onClick={()=>saveSource(true)}>Submit to Coordinator</button><button className="action-secondary" disabled={busy} onClick={()=>setForm(null)}>Close editor</button></div>
    </section>}
    {review&&source&&<section className="surface-card evaluation-editor" aria-label="Coordinator evaluation editor">
      <div className="evaluation-editor-header"><div><h2>Review {label(source.intern_id)}</h2><p className="text-sm muted-copy">Keep original ratings unless the evidence supports a change.</p></div><StatusBadge status="Coordinator Draft"/></div>
      <details className="evaluation-source-reference" open><summary>Original Supervisor evaluation — read-only</summary><SourceDetail source={source} label={label}/></details>
      <h3>Final criterion ratings</h3>
      <EvaluationRatings value={review.criteria} disabled={busy} onChange={criteria=>editReview({criteria,adjustment_reasons:Object.fromEntries(Object.entries(review.adjustment_reasons).filter(([id])=>criteria[id]!==source.criteria[id]))})}/>
      <RatingAdjustments original={source.criteria} criteria={review.criteria} reasons={review.adjustment_reasons} onChange={adjustment_reasons=>editReview({adjustment_reasons})} disabled={busy} legacyReason={review.legacy_adjustment_reason||(Object.keys(review.adjustment_reasons).length===0?review.adjustment_reason:'')}/>
      {reasonError&&<p className="text-sm muted-copy" role="status">{reasonError}</p>}
      <div className="evaluation-actions" role="group" aria-label="Feedback method"><button className="action-secondary" aria-pressed={review.feedback_mode==='selected'} disabled={busy} onClick={()=>switchFeedback('selected')}>Use selectable feedback</button><button className="action-secondary" aria-pressed={review.feedback_mode==='written'} disabled={busy} onClick={()=>switchFeedback('written')}>Use written feedback</button></div>
      {review.feedback_mode==='selected'?<>
        <CoordinatorFeedback choices={review.feedback_choices} onChange={feedback_choices=>editReview({feedback_choices})} remarks={review.additional_remarks} onRemarks={additional_remarks=>editReview({additional_remarks})} disabled={busy}/>
        <div className="evaluation-generated" aria-label="Generated student-facing feedback"><h3>Student-facing feedback</h3>{textError?<p role="alert">{textError}</p>:Object.entries(fields).map(([key,value])=>value&&<p className="text-sm whitespace-pre-wrap" key={key}>{value}</p>)}{!fields.summary&&<p className="text-sm muted-copy">Select overall feedback to prepare the summary. Nothing is inferred from the score.</p>}</div>
      </>:<>
        <p className="text-sm muted-copy">Your saved written feedback is preserved. Select “Use selectable feedback” to explicitly prepare a standard version; the saved written version is retained separately.</p>
        {Object.entries({summary:'Student-facing summary',strengths:'Strengths',improvements:'Areas for improvement',guidance:'Guidance'}).map(([key,title])=><label className="evaluation-field" key={key}>{title}<textarea className="form-control" rows={3} maxLength={2000} disabled={busy} value={review[key]} onChange={e=>editReview({[key]:e.target.value})}/></label>)}
      </>}
      <div className="evaluation-actions"><button className="action-secondary" disabled={busy||!reviewValid} onClick={()=>saveReview(false)}>Save Draft</button><button className="action-secondary" disabled={busy||!publishValid} onClick={()=>setPreview(true)}>Preview Intern Evaluation</button><button className="action-primary" disabled={busy||!preview||!publishValid} onClick={()=>saveReview(true)}>Publish to Intern</button><button className="action-secondary" disabled={busy} onClick={()=>{setReview(null);setPreview(false);}}>Close editor</button></div>
      {preview&&<section className="evaluation-generated" aria-label="Intern-facing preview"><h3>Intern-facing preview · {label(source.intern_id)}</h3><EvaluationFinal evaluation={{provenance:'supervisor_review',evaluation_date:source.evaluation_date,competencies:review.criteria,overall_score:rubricScore(review.criteria),feedback:fields.summary,strengths:fields.strengths,improvements:fields.improvements,guidance:fields.guidance}}/></section>}
    </section>}
    <div className="surface-card evaluation-results">
      <div className="evaluation-toolbar">
        <label className="evaluation-search">Search evaluations<input className="form-control" type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Intern name, identifier or date"/></label>
        <label className="evaluation-field">Rows per page<select className="form-control" value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}>{[10,25,50].map(n=><option key={n}>{n}</option>)}</select></label>
        <div className="evaluation-actions"><span className="text-xs muted-copy" role="status">{records.length} of {unfilteredCount} evaluations</span><button className="action-secondary" disabled={busy||loading} onClick={load}>Refresh evaluations</button></div>
      </div>
      {error?<ErrorNotice title="Evaluation records unavailable" onRetry={load}>{error}</ErrorNotice>:loading||(!records.length&&supervisor&&rosterLoading)?<LoadingState>Loading evaluations and checking assignments…</LoadingState>:records.length?result.rows.map(row=><article className="evaluation-result" key={row.id}>
        <div className="evaluation-result-header"><div><h2 className="break-words">{label(row.intern_id)}</h2><p className="text-xs muted-copy">{row.evaluation_date||'Legacy date'}{row.version?` · version ${row.version}`:''}</p></div><StatusBadge status={mode==='published'?'Published to Intern':reviews.find(r=>r.id===row.id)?.status||row.status}/></div>
        {mode==='published'?<EvaluationFinal evaluation={row}/>:<>
          <EvaluationCriteria criteria={row.criteria}/><p className="text-sm font-semibold">Source score: {row.overall_score??'Draft incomplete'}/100</p>
          <div className="evaluation-actions">{supervisor?<>
            {row.status==='Supervisor Draft'&&<button className="action-secondary" disabled={busy||!!form||!canCreate||!roster.some(i=>i.id===row.intern_id)} onClick={()=>setForm(row)}>Open Draft</button>}
            <button className="action-secondary" disabled={busy} onClick={()=>setDetail(row)}>{row.status==='Supervisor Draft'?'View draft details':'View submitted evaluation'}</button>
          </>:<button className="action-primary" disabled={busy} onClick={()=>openReview(row)}>Review and simplify</button>}</div>
        </>}
      </article>):<EmptyState title={emptyTitle} icon={supervisor&&!roster.length?<IconUsers size={24}/>:<IconFileText size={24}/>} actions={search.trim()?<button className="action-secondary" onClick={()=>{setSearch('');setPage(1);}}>Clear search</button>:canCreate?newAction:null}>{emptyDescription}</EmptyState>}
      {!error&&!loading&&records.length>0&&<Pagination result={result} onPage={setPage} label="evaluations" disabled={busy}/>}
    </div>
    {detail&&<Modal title={detail.status==='Supervisor Draft'?'Evaluation draft details':'Submitted evaluation'} width="800px" className="evaluation-dialog" onClose={()=>setDetail(null)}><SourceDetail source={detail} label={label}/><p className="text-xs muted-copy mt-4">{detail.status==='Supervisor Draft'?'Private draft.':'Submitted source version is immutable.'}</p></Modal>}
  </section>;
}

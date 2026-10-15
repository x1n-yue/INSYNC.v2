import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { recordRpc,manilaDate } from '../lib/authority';
import { downloadArtifact } from '../lib/exports';
import { formatClockTime } from '../lib/attendance';
import { attendanceEvidence } from '../lib/hours';
import { paginate } from '../lib/lists';
import { sheetContext,manualSessionPreview,manualFormError,manualDetails,attendanceSheetLink,verifyManualAttendance,attendanceSource,FALLBACK_REASONS } from '../lib/companyAttendance';
import { companySheetModel,companySheetPdf } from '../lib/companyAttendanceSheet';
import { ErrorNotice,EmptyState,StatusBadge } from './UI';
import { Pagination } from './ListControls';
import { useToast } from './Toast';
import Modal from './Modal';
import './companyAttendance.css';
const nameOf=intern=>intern.full_name||intern.profiles?.full_name||intern.name||intern.id;
const stamp=value=>value?new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):'Not recorded';
const newForm=internId=>({internId,date:manilaDate(),endDate:manilaDate(),timeIn:'',timeOut:'',companyId:'',companyName:'',supervisor:'',reason:'no_connectivity',explanation:'',remarks:'',signatures:false});
export function AttendanceSourceBadge({row}) { return <span className={`company-attendance-source ${row.attendance_source==='manual_company_sheet'?'paper-source-manual':''}`}>{attendanceSource(row)}</span>; }

export function CompanyAttendancePrint({ internId,interns=[] }) {
  const {toast}=useToast(),[open,setOpen]=useState(false),[selected,setSelected]=useState(internId||''),[context,setContext]=useState(null),[company,setCompany]=useState(''),[start,setStart]=useState(manilaDate()),[end,setEnd]=useState(manilaDate()),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!open||!selected)return;let cancelled=false;setContext(null);setError('');setBusy(true);
    sheetContext(supabase,selected).then(result=>{if(cancelled)return;if(result.ok){setContext(result.data);setCompany(result.data.current_company_id||'');}else setError(result.error);setBusy(false);});return()=>{cancelled=true;};
  },[selected,open]);
  const download=async()=>{setBusy(true);setError('');try{const artifact=await companySheetPdf(companySheetModel(context,company,start,end));downloadArtifact(artifact);toast('Company Attendance Sheet downloaded. Print in advance and keep a copy at the company.','success');}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <><button className="action-secondary" onClick={()=>setOpen(true)}>Download blank company sheet</button>{open&&<Modal title="Company Attendance Sheet" width="720px" className="company-attendance" busy={busy} onClose={()=>setOpen(false)}>
    <div className="paper-stack"><p className="text-sm muted-copy">Print sheets in advance and keep copies at the company. During an outage, use paper without accessing INSync. A company logbook with all required fields and signatures is also acceptable.</p>
      {!internId&&<label>Assigned Intern<select aria-label="Assigned Intern" className="form-control" disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose assigned Intern</option>{interns.map(i=><option key={i.id} value={i.id}>{nameOf(i)}</option>)}</select></label>}
      {error&&<ErrorNotice>{error}</ErrorNotice>}
      {context&&<><p className="text-sm">{context.intern_name} · {context.identifier}</p><label>Company<select aria-label="Company" className="form-control" disabled={busy} value={company} onChange={e=>setCompany(e.target.value)}><option value="">Choose company</option>{context.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></>}
      <div className="paper-field-grid"><label>Covered period start<input className="form-control" type="date" disabled={busy} value={start} onChange={e=>setStart(e.target.value)}/></label><label>Covered period end<input className="form-control" type="date" disabled={busy} value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
      <p className="text-xs muted-copy">Landscape A4 PDF, with one row per Manila start date and repeating headings. The existing one-session-per-day model applies; overnight sessions require an end date.</p>
      <button className="action-primary" disabled={busy||!context||!company||!start||!end} onClick={download}>{busy?'Preparing…':'Download A4 PDF to print'}</button>
    </div>
  </Modal>}</>;
}

export function ManualAttendanceDetails({ row,staff=false,onVerified,onRevise }) {
  const {toast}=useToast(),[open,setOpen]=useState(false),[link,setLink]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reviewed,setReviewed]=useState(false);
  const d=row.manual_details||{},evidence=attendanceEvidence(row);
  useEffect(()=>{setReviewed(false);setLink(null);},[row.manual_revision,row.manual_evidence_id,row.clocked_in_at,row.clocked_out_at]);
  const preview=async()=>{setBusy(true);setError('');setLink(null);const result=await attendanceSheetLink(supabase,row.manual_evidence_id);if(result.ok)setLink(result);else setError(result.error);setBusy(false);};
  useEffect(()=>{if(!link)return;const timeout=setTimeout(()=>{setLink(null);setReviewed(false);},Math.max(1,link.expiresAt-Date.now()));return()=>clearTimeout(timeout);},[link]);
  const verify=async()=>{setBusy(true);setError('');const result=await verifyManualAttendance(supabase,row,reviewed);if(result.ok&&result.data.verified===true&&result.data.manual_revision===row.manual_revision){toast('Manual attendance explicitly verified','success');setOpen(false);onVerified?.();}else setError(result.error||'Verification could not be confirmed. Refresh before retrying.');setBusy(false);};
  return <><button className="action-secondary" onClick={()=>{setReviewed(false);setLink(null);setError('');setOpen(true);}}>View manual attendance</button>{open&&<Modal title={attendanceSource(row)} width="900px" className="company-attendance" busy={busy} onClose={()=>setOpen(false)}><div className="paper-stack">
    <div className="paper-actions"><AttendanceSourceBadge row={row}/><StatusBadge status={row.verified?'Verified':'Unverified'}/></div>
    <dl className="paper-field-grid text-sm">{[['Attendance start date (Manila)',row.log_date],['Time In / Out (Manila)',`${stamp(row.clocked_in_at)} → ${stamp(row.clocked_out_at)}`],['Calculated hours',evidence.state==='closed'?Number(evidence.logged).toFixed(2):'Unavailable'],[row.logbook_submission_id?'Company at submission':'Company as printed on sheet',d.company_on_sheet],[row.logbook_submission_id?'Recorded company snapshot':'Registered company at encoding',d.registered_company_name],[row.logbook_submission_id?'Submitting Supervisor':'Supervisor printed name',d.supervisor_on_sheet],['Fallback reason',FALLBACK_REASONS[d.fallback_reason]],['Other explanation',d.reason_explanation||'Not applicable'],['Encoder',row.logbook_submission_id?'OJT Coordinator':row.encoded_by],['Encoded later (Manila)',stamp(row.encoded_at)],['Verified by / at',row.verified?`${row.logbook_submission_id?'OJT Coordinator':row.verified_by} · ${stamp(row.verified_at)}`:'Not verified'],['Revision',row.manual_revision],['Remarks',d.remarks||'None']].filter(([label])=>!row.logbook_submission_id||!['Fallback reason','Other explanation','Revision'].includes(label)).map(([label,value])=><div key={label}><dt className="muted-copy">{label}</dt><dd className="break-words whitespace-pre-wrap">{value||'Unavailable'}</dd></div>)}</dl>
    {staff?<><button className="action-secondary" disabled={busy} onClick={preview}>{busy?'Opening evidence…':'Preview signed evidence'}</button>{link&&<section className="paper-stack" aria-label="Private signed attendance evidence"><a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">Open {link.name} in a new tab (private link expires in 60 seconds)</a>{link.mime==='application/pdf'?<iframe className="paper-evidence" src={link.url} title="Signed company attendance sheet PDF"/>:<img className="paper-evidence-image" src={link.url} alt="Uploaded signed company attendance sheet or logbook"/>}</section>}
      {!row.verified&&onVerified&&<><label className="paper-checkbox"><input type="checkbox" disabled={busy||!link} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed this encoded session, calculated hours, company/Supervisor details and the Intern and Supervisor signatures in the evidence.</label><div className="paper-actions"><button className="action-primary" disabled={busy||!reviewed||!link||evidence.state!=='closed'} onClick={verify}>{busy?'Verifying…':'Verify manual attendance'}</button>{onRevise&&<button className="action-secondary" disabled={busy} onClick={()=>{setOpen(false);onRevise(row);}}>Revise unverified entry</button>}</div></>}
    </>:<p className="text-sm muted-copy">Signed paper files are restricted to authorized staff because a sheet may include other Interns. Your own source, hours and verification status remain visible here.</p>}
    {error&&<ErrorNotice>{error}</ErrorNotice>}
  </div></Modal>}</>;
}

export function ManualAttendanceWorkspace({ interns=[],records,onChanged }) {
  const availableInterns=interns.filter(i=>i.profiles?.status==='Active'||i.accountStatus==='Active');
  const {toast}=useToast(),[form,setForm]=useState(null),[editing,setEditing]=useState(null),[revisionReason,setRevisionReason]=useState(''),[context,setContext]=useState(null),[contextBusy,setContextBusy]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[evidenceId,setEvidenceId]=useState('');
  const lock=useRef(false);
  useEffect(()=>{
    if(!form?.internId)return;let cancelled=false;setContextBusy(true);setContext(null);
    sheetContext(supabase,form.internId).then(result=>{if(cancelled)return;if(result.ok){setContext(result.data);if(!editing)setForm(current=>({...current,companyId:result.data.current_company_id||'',companyName:result.data.companies.find(c=>c.id===result.data.current_company_id)?.name||''}));}else setError(result.error);setContextBusy(false);});return()=>{cancelled=true;};
  },[form?.internId,editing]);
  const revise=row=>{const start=new Date(Date.parse(row.clocked_in_at)+8*3600000).toISOString(),end=new Date(Date.parse(row.clocked_out_at)+8*3600000).toISOString(),d=row.manual_details;
    setEditing(row);setForm({...newForm(row.intern_id),date:start.slice(0,10),endDate:end.slice(0,10),timeIn:start.slice(11,19),timeOut:end.slice(11,19),companyId:d.company_id,companyName:d.company_on_sheet,supervisor:d.supervisor_on_sheet,reason:d.fallback_reason,explanation:d.reason_explanation,remarks:d.remarks,signatures:false});setEvidenceId(row.manual_evidence_id);setError('');setRevisionReason('');};
  const preview=form?manualSessionPreview(form,records||[],new Date(),editing?.id):null,validation=form?manualFormError(form):null;
  const save=async()=>{if(lock.current||validation||preview.error||!evidenceId)return;lock.current=true;setBusy(true);setError('');try{
    const args={p_id:editing?.id,p_in:preview.start,p_out:preview.end,p_evidence:evidenceId,p_details:manualDetails(form)};
    const result=await recordRpc(supabase,'revise_manual_attendance',{...args,p_revision:editing.manual_revision,p_reason:revisionReason.trim()});
    if(!result.ok){setError(result.error);return;}
    if(result.data.intern_id!==form.internId||result.data.attendance_source!=='manual_company_sheet'){setError('Manual attendance outcome could not be confirmed. Refresh and retry the same entry.');return;}
    toast(result.data.verified?'This attendance already exists and has been explicitly verified.':editing?'Unverified manual attendance revised; evidence history retained':'Manual attendance saved as Unverified. Review and explicitly verify it separately.','success');setForm(null);setEditing(null);onChanged?.();
  }finally{lock.current=false;setBusy(false);}};
  return <section className="surface-card company-attendance paper-stack" aria-label="Company Attendance Sheet fallback">
    <div className="paper-actions paper-heading"><div><h2 className="font-semibold">Historical Coordinator-entered attendance</h2><p className="text-sm muted-copy">Existing manual records retain their evidence and explicit verification. New logbooks are submitted by Supervisors in Manual Attendance.</p></div><div className="paper-actions"><CompanyAttendancePrint interns={interns}/></div></div>
    {form&&<section className="paper-stack paper-form" aria-label="Manual attendance entry"><h3 className="font-semibold">Revise historical unverified attendance</h3>
      <p className="text-sm muted-copy">Use the names and attendance dates on the signed sheet. Retained company choices include current membership and recorded assignment history; confirm the company actually used on that date.</p>
      <fieldset disabled={busy||contextBusy} className="paper-stack paper-fieldset"><div className="paper-field-grid">
        <label>Assigned Intern<select aria-label="Assigned Intern" className="form-control" value={form.internId} disabled onChange={e=>{setForm(newForm(e.target.value));setEvidenceId('');setError('');}}><option value="">Choose assigned Intern</option>{availableInterns.map(i=><option key={i.id} value={i.id}>{nameOf(i)}</option>)}</select></label>
        <label>Company reference<select aria-label="Company reference" className="form-control" value={form.companyId} disabled onChange={e=>{setForm({...form,companyId:e.target.value,companyName:context.companies.find(c=>c.id===e.target.value)?.name||''});setEvidenceId('');}}><option value="">Choose company</option>{context?.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Company name on signed sheet<input className="form-control" maxLength={200} value={form.companyName} onChange={e=>setForm({...form,companyName:e.target.value})}/></label>
        <label>Supervisor printed name on sheet<input className="form-control" maxLength={200} value={form.supervisor} onChange={e=>setForm({...form,supervisor:e.target.value})}/></label>
        <label>Attendance date (Manila)<input className="form-control" type="date" max={manilaDate()} value={form.date} onChange={e=>setForm({...form,date:e.target.value,endDate:e.target.value})}/></label>
        <label>Time In (Manila)<input className="form-control" type="time" step="1" value={form.timeIn} onChange={e=>setForm({...form,timeIn:e.target.value})}/></label>
        <label>Time Out date (Manila)<input className="form-control" type="date" max={manilaDate()} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label>
        <label>Time Out (Manila)<input className="form-control" type="time" step="1" value={form.timeOut} onChange={e=>setForm({...form,timeOut:e.target.value})}/></label>
        <label>Fallback reason<select aria-label="Fallback reason" className="form-control" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value,explanation:''})}>{Object.entries(FALLBACK_REASONS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
        {form.reason==='other'&&<label>Explain Other<input className="form-control" minLength={10} maxLength={500} value={form.explanation} onChange={e=>setForm({...form,explanation:e.target.value})}/></label>}
      </div><label>Remarks (optional)<textarea className="form-control" rows={3} maxLength={500} value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label>
      {editing&&<label>Reason for revising this unverified entry<textarea className="form-control" rows={2} minLength={10} maxLength={500} value={revisionReason} onChange={e=>setRevisionReason(e.target.value)}/></label>}
      <div className="paper-preview" aria-label="Manual session preview">{preview.error?<p className="text-sm">{preview.error}</p>:<><p className="text-sm">{form.date} {form.timeIn} → {form.endDate} {form.timeOut} (Asia/Manila)</p><p className="font-semibold">{preview.hours.toFixed(2)} logged hours preview · 0 verified hours</p><p className="text-xs muted-copy">The server calculates exact elapsed hours; no new deductions or schedules apply.</p></>}</div>
      <label className="paper-checkbox"><input type="checkbox" checked={form.signatures} onChange={e=>setForm({...form,signatures:e.target.checked})}/>I reviewed the Intern and Company Supervisor signatures and the attendance information on the signed evidence.</label>
      </fieldset>
      {contextBusy&&<p role="status">Loading authorized company context…</p>}{busy&&<progress aria-label="Manual attendance operation in progress"/>}{error&&<ErrorNotice>{error}</ErrorNotice>}
      <p className="text-xs muted-copy">{validation||(!evidenceId?'Successfully upload or select signed evidence before saving.':'Saving creates an unverified entry. Verification is a separate staff review.')}</p>
      <div className="paper-actions"><button className="action-primary" disabled={busy||contextBusy||!Array.isArray(records)||!!validation||!!preview.error||!evidenceId||(editing&&(revisionReason.trim().length<10||!/[\p{L}]/u.test(revisionReason)))} onClick={save}>{busy?'Saving…':editing?'Save unverified revision':'Save unverified attendance'}</button><button className="action-secondary" disabled={busy} onClick={()=>{setForm(null);setEditing(null);}}>Close entry</button></div>
    </section>}
    <ManualAttendanceHistory rows={records} interns={interns} onChanged={onChanged} onRevise={revise}/>
  </section>;
}
export function ManualAttendanceHistory({ rows,interns=[],onChanged,onRevise }) {
  const [search,setSearch]=useState(''),[page,setPage]=useState(1);
  const label=id=>nameOf(interns.find(i=>i.id===id)||{id});
  const result=paginate((rows||[]).filter(r=>r.attendance_source==='manual_company_sheet'&&!r.logbook_submission_id&&`${label(r.intern_id)} ${r.log_date}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>b.log_date.localeCompare(a.log_date)||b.id.localeCompare(a.id)),page,10);
  return <section className="company-attendance paper-stack" aria-label="Manual attendance history"><h3 className="font-semibold">Manual attendance history</h3><label className="paper-search">Search manual attendance<input className="form-control" type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Intern name or attendance date"/></label>
    {!Array.isArray(rows)?<ErrorNotice>Attendance unavailable. Refresh before reviewing.</ErrorNotice>:result.total?<div className="paper-results">{result.rows.map(row=><article className="paper-row" key={row.id}><div><h4 className="font-semibold">{label(row.intern_id)} · {row.log_date}</h4><p className="text-xs muted-copy">{attendanceSource(row)} · {formatClockTime(row.clocked_in_at)} → {formatClockTime(row.clocked_out_at)} · {Number(row.hours).toFixed(2)} logged hours</p></div><div className="paper-actions"><StatusBadge status={row.verified?'Verified':'Unverified'}/><ManualAttendanceDetails row={row} staff onVerified={onChanged} onRevise={onRevise}/></div></article>)}<Pagination result={result} onPage={setPage} label="manual attendance"/></div>:<EmptyState title={search?'No search results':'No manual attendance yet'}>Paper entries will appear here after authorized Coordinator encoding.</EmptyState>}
  </section>;
}

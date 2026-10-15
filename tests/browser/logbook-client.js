// Isolated transport for rendered UI tests. Native SQL tests prove authorization.
import {supabase as base,setupError} from './company-attendance-client';
import {fixture} from './synthetic-client';
export {setupError};
const {state,me,persist}=fixture,c=window.__audit;
for(const t of ['logbook_submissions','logbook_versions','logbook_events'])state[t]||=[];
state.logbookObjects||={};
const ok=data=>({data:structuredClone(data),error:null}),fail=message=>({data:null,error:{message,code:'P0001'}});
const allowed=s=>me.role==='admin'||me.role==='supervisor'&&s.supervisor_id===me.id||me.role==='instructor'&&s.coordinator_id===me.id;
const current=s=>state.logbook_versions.find(v=>v.submission_id===s.id&&v.version===s.current_version);
export const supabase={...base,storage:{...base.storage,from(bucket){const storage=base.storage.from(bucket);if(bucket!=='attendance-evidence')return storage;return {...storage,
 upload:async(path,file)=>{if(c.logbookUploadHold)await new Promise(resolve=>c.releaseLogbookUpload=resolve);if(c.logbookUploadFailure)return fail('Upload failed. Retry the same selected pages.');state.logbookObjects[path]={size:file.size,mime:file.type};persist();return ok({path});},
 createSignedUrl:async(path,ttl)=>{const e=state.attendance_sheet_evidence.find(e=>e.file_path===path),s=state.logbook_submissions.find(s=>s.id===e?.logbook_submission_id);if(!s)return storage.createSignedUrl(path,ttl);if(!allowed(s))return fail('Private evidence denied');return ok({signedUrl:`${location.origin}/fixture-private-attendance.pdf?ttl=${ttl}&mime=${encodeURIComponent(e.mime_type)}`});}
 };}},async rpc(name,p={}){
 if(name==='logbook_queue'){if(c.logbookReadHold)await new Promise(resolve=>c.releaseLogbookRead=resolve);if(c.logbookReadFailure)return fail('Submission history unavailable');const result=state.logbook_submissions.filter(allowed).filter(s=>me.role!=='instructor'||current(s).status!=='Draft').filter(s=>!p.p_after||s.id>p.p_after).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,p.p_size).map(s=>({...s,current:current(s),history:state.logbook_versions.filter(v=>v.submission_id===s.id),files:state.attendance_sheet_evidence.filter(e=>e.logbook_submission_id===s.id),current_coordinator_id:fixture.INSTRUCTOR}));return ok(result);}
 if(name==='save_logbook_draft'){
  let s=state.logbook_submissions.find(s=>s.id===p.p_id);
  if(!s){const i=state.interns.find(i=>i.id===p.p_intern);s={id:p.p_id,intern_id:i.id,supervisor_id:me.id,supervisor_name:me.full_name,intern_name:state.profiles.find(u=>u.id===i.id).full_name,company_id:i.company_id,company_name:state.companies.find(c=>c.id===i.company_id).name,current_version:1,coordinator_id:null};state.logbook_submissions.push(s);}
  let v=current(s);if(v?.status==='Returned for Correction'){s.current_version++;v=null;}
  if(!v){v={submission_id:s.id,version:s.current_version,revision:0,status:'Draft'};state.logbook_versions.push(v);}
  Object.assign(v,{revision:v.revision+1,date_start:p.p_start,date_end:p.p_end,remarks:p.p_remarks,evidence_ids:p.p_evidence});for(const id of p.p_evidence)state.attendance_sheet_evidence.find(e=>e.id===id).committed_at||=new Date().toISOString();persist();return ok(v);
 }
 if(name==='stage_logbook_evidence'){
  let e=state.attendance_sheet_evidence.find(e=>e.id===p.p_id);if(!e){const s=state.logbook_submissions.find(s=>s.id===p.p_submission);e={id:p.p_id,logbook_submission_id:s.id,company_id:s.company_id,participant_ids:[s.intern_id],uploaded_by:me.id,file_name:p.p_name,mime_type:p.p_mime,byte_size:p.p_size,file_path:`sheets/${p.p_id}.pdf`,expires_at:new Date(Date.now()+900000).toISOString()};state.attendance_sheet_evidence.push(e);persist();}return ok(e);
 }
 if(name==='finish_attendance_sheet') {const e=state.attendance_sheet_evidence.find(e=>e.id===p.p_id);if(!e?.logbook_submission_id)return base.rpc(name,p);if(!state.logbookObjects[e.file_path])return fail('Complete validated evidence upload required');e.ready_at||=new Date().toISOString();persist();return ok(e);}
 if(name==='submit_logbook'){if(c.missingCoordinator)return fail('No eligible assigned OJT Coordinator. Draft and evidence are saved.');const s=state.logbook_submissions.find(s=>s.id===p.p_id),v=current(s);if(v.status==='Pending Review')return ok(v);s.coordinator_id=fixture.INSTRUCTOR;Object.assign(v,{status:'Pending Review',submitted_at:new Date().toISOString(),receiving_coordinator_id:s.coordinator_id,revision:v.revision+1});persist();if(c.logbookSubmitLostResponse){c.logbookSubmitLostResponse=false;return fail('Submission response lost. Retry without changing your draft.');}return ok(v);}
 if(name==='return_logbook'){const s=state.logbook_submissions.find(s=>s.id===p.p_id),v=current(s);Object.assign(v,{status:'Returned for Correction',return_reason:p.p_reason,returned_by:me.id,returned_at:new Date().toISOString(),revision:v.revision+1});persist();return ok(v);}
 if(name==='verify_record_logbook'){
  if(c.logbookVerifyFailure)return fail('Session 2: Attendance overlaps an existing online or manual session');
  const s=state.logbook_submissions.find(s=>s.id===p.p_id),v=current(s);if(v.status==='Verified'&&v.request_id===p.p_request)return ok(v);
  for(const r of p.p_sessions){const date=new Date(Date.parse(r.time_in)+8*3600000).toISOString(),out=new Date(Date.parse(r.time_out)+8*3600000).toISOString();state.attendance_logs.push({id:crypto.randomUUID(),intern_id:s.intern_id,log_date:date.slice(0,10),time_in:date.slice(11,19),time_out:out.slice(11,19),clocked_in_at:r.time_in,clocked_out_at:r.time_out,hours:(Date.parse(r.time_out)-Date.parse(r.time_in))/3600000,verified:true,verified_by:me.id,verified_at:new Date().toISOString(),attendance_source:'manual_company_sheet',manual_evidence_id:v.evidence_ids[0],manual_revision:1,manual_details:{company_on_sheet:s.company_name,registered_company_name:s.company_name,supervisor_on_sheet:s.supervisor_name,remarks:'',signatures_reviewed:true,source_label:'Manual — Company Logbook'},encoded_by:me.id,encoded_at:new Date().toISOString(),logbook_submission_id:s.id,logbook_version:v.version});}
  Object.assign(v,{status:'Verified',verified_by:me.id,verified_at:new Date().toISOString(),request_id:p.p_request,recorded_sessions:p.p_sessions,revision:v.revision+1});persist();if(c.logbookLostResponse){c.logbookLostResponse=false;return fail('Network response lost. Keep this form and retry.');}return ok(v);
 }
 if(name==='attendance_sheet_access'){const e=state.attendance_sheet_evidence.find(e=>e.id===p.p_id),s=state.logbook_submissions.find(s=>s.id===e?.logbook_submission_id);if(!s)return base.rpc(name,p);if(!allowed(s))return fail('Evidence denied');return ok({bucket:'attendance-evidence',path:e.file_path,name:e.file_name,mime:e.mime_type});}
 return base.rpc(name,p);
}};

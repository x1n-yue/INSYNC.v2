// Synthetic transports for actual React UI. Authorization proof is native SQL.
import { supabase as base,setupError } from './supervisor-client';
import { fixture } from './synthetic-client';
export {setupError};
const {state,me,persist}=fixture,control=window.__audit;
for(const t of ['attendance_sheet_evidence','manual_attendance_events'])state[t]||=[];
const ok=data=>({data:structuredClone(data),error:null}),fail=message=>({data:null,error:{message,code:'P0001'}});
const owns=id=>me.role==='admin'||(me.role==='instructor'&&state.interns.some(i=>i.id===id&&i.instructor_id===me.id));
const sheetAllowed=e=>me.role==='admin'||(me.role==='instructor'&&e.participant_ids.every(owns));
control.manualObjects||={};
export const supabase={...base,from(table){const q=base.from(table);if(['attendance_sheet_evidence','manual_attendance_events'].includes(table))q.execute=async()=>{
 if(control.manualReadFailure)return fail('Synthetic evidence list failure');let rows=state[table].filter(e=>table==='attendance_sheet_evidence'?sheetAllowed(e):owns(e.intern_id)).filter(r=>q.filters.every(f=>f(r)));rows.sort((a,b)=>{for(const [key,asc] of q.orders){const c=String(a[key]).localeCompare(String(b[key]));if(c)return asc?c:-c;}return 0;});const count=rows.length;return {data:q.head?null:structuredClone(rows.slice(0,q.cap)),count,error:null};};return q;
},storage:{...base.storage,from(bucket){if(bucket!=='attendance-evidence')return base.storage.from(bucket);return {
 upload:async(path,file)=>{if(control.manualUploadHold)await new Promise(resolve=>control.releaseManualUpload=resolve);if(control.manualUploadFailure)return fail('Synthetic upload failed; retain receipt for retry');control.manualObjects[path]={size:file.size,mime:file.type};return ok({path});},
 remove:async paths=>{paths.forEach(path=>delete control.manualObjects[path]);return ok(paths.map(name=>({name})));},
 createSignedUrl:async(path,ttl)=>{const e=state.attendance_sheet_evidence.find(e=>e.file_path===path);if(!e||!sheetAllowed(e))return fail('Private evidence denied');control.manualSignedRequests=(control.manualSignedRequests||[]).concat({path,ttl});return ok({signedUrl:`${location.origin}/fixture-private-attendance.pdf?ttl=${ttl}`});}
};}},async rpc(name,p={}){
 if(name==='attendance_sheet_context'){if(control.manualContextFailure)return fail('Synthetic company context failed');if(!(me.id===p.p_intern&&me.role==='intern')&&!owns(p.p_intern))return fail('Unassigned Intern');const i=state.interns.find(i=>i.id===p.p_intern),person=state.profiles.find(u=>u.id===p.p_intern);return ok({intern_id:i.id,intern_name:person.full_name,identifier:person.student_id||i.id,current_company_id:i.company_id,companies:state.companies.filter(c=>c.id===i.company_id)});}
 if(name==='stage_attendance_sheet'){if(me.role!=='instructor'||p.p_participants.some(id=>!owns(id)))return fail('Assigned Coordinator required');let e=state.attendance_sheet_evidence.find(e=>e.id===p.p_id);if(!e){e={id:p.p_id,company_id:p.p_company,participant_ids:p.p_participants,file_path:`sheets/${p.p_id}.pdf`,file_name:p.p_name,mime_type:p.p_mime,byte_size:p.p_size,uploaded_by:me.id,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+900000).toISOString(),ready_at:null,committed_at:null,abandoned_at:null};state.attendance_sheet_evidence.push(e);persist();}return ok(e);}
 if(name==='finish_attendance_sheet'){const e=state.attendance_sheet_evidence.find(e=>e.id===p.p_id);if(!e||!control.manualObjects[e.file_path])return fail('Complete validated evidence upload required');e.ready_at||=new Date().toISOString();persist();return ok(e);}
 if(name==='cancel_attendance_sheet'){const e=state.attendance_sheet_evidence.find(e=>e.id===p.p_id);if(e.committed_at)return fail('Referenced evidence must be preserved');e.abandoned_at=new Date().toISOString();persist();return ok({...e,object_exists:Boolean(control.manualObjects[e.file_path])});}
 if(name==='record_manual_attendance'||name==='revise_manual_attendance'){
  if(control.manualSaveFailure)return fail('Synthetic attendance save failed');let r=state.attendance_logs.find(r=>r.id===p.p_id);if(r&&name==='record_manual_attendance')return ok(r);
  const e=state.attendance_sheet_evidence.find(e=>e.id===p.p_evidence);if(!e?.ready_at)return fail('Validated evidence required');
  if(!r){r={id:p.p_id,intern_id:p.p_intern,created_at:new Date().toISOString(),manual_revision:0,encoded_by:me.id,encoded_at:new Date().toISOString()};state.attendance_logs.push(r);}
  const start=new Date(Date.parse(p.p_in)+8*3600000).toISOString(),end=new Date(Date.parse(p.p_out)+8*3600000).toISOString();
  Object.assign(r,{attendance_source:'manual_company_sheet',clocked_in_at:p.p_in,clocked_out_at:p.p_out,log_date:start.slice(0,10),time_in:start.slice(11,19),time_out:end.slice(11,19),hours:(Date.parse(p.p_out)-Date.parse(p.p_in))/3600000,verified:false,verified_by:null,verified_at:null,manual_revision:r.manual_revision+1,manual_evidence_id:p.p_evidence,manual_details:{...p.p_details,company_id:e.company_id,registered_company_name:state.companies.find(c=>c.id===e.company_id).name}});e.committed_at||=new Date().toISOString();persist();if(control.manualSaveLostResponse){control.manualSaveLostResponse=false;return fail('Synthetic save response lost; retry the same entry');}return ok(r);
 }
 if(name==='attendance_sheet_access'){const e=state.attendance_sheet_evidence.find(e=>e.id===p.p_id);if(!e||!sheetAllowed(e))return fail('Evidence denied');return ok({bucket:'attendance-evidence',path:e.file_path,name:e.file_name,mime:e.mime_type});}
 if(name==='verify_manual_attendance'){if(!p.p_reviewed)return fail('Explicit review required');const r=state.attendance_logs.find(r=>r.id===p.p_id);Object.assign(r,{verified:true,verified_by:me.id,verified_at:new Date().toISOString()});persist();return ok(r);}
 return base.rpc(name,p);
}};

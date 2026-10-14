// Extends the isolated UI fixture. Never imported into normal application builds.
import {supabase as base,setupError} from './audit-client';
import {fixture} from './synthetic-client';
const {state,me,persist}=fixture,control=window.__audit;
state.documents.forEach(d=>{if(!Object.hasOwn(d,'legacy_evidence'))d.legacy_evidence=null;});
control.resetRequests=0;control.passwordUpdates=0;control.recoveryFailure=false;control.holdRecovery=false;
export {setupError};
const ok=data=>({data:structuredClone(data),error:null}),fail=message=>({data:null,error:{message,code:'P0001'}});
export const supabase={...base,auth:{...base.auth,
  async resetPasswordForEmail(_email,_options){control.resetRequests++;if(control.holdRecovery)await new Promise(r=>{control.releaseRecovery=r;});return control.recoveryFailure?fail('Synthetic recovery delivery failure'):{error:null};},
  async getUser(){return ok({user:{id:me.id}});},
  async updateUser(){control.passwordUpdates++;return control.recoveryFailure?fail('Synthetic password update failure'):ok({user:{id:me.id}});},
},async rpc(name,p={}){
  if(name==='finalize_document_upload') {
    const v=state.document_versions.find(v=>v.id===p.p_upload_id),d=state.documents.find(d=>d.id===v?.document_id);
    const previous=d?.upload_version===0&&d.file_path?structuredClone(d):null;
    const result=await base.rpc(name,p);
    if(!result.error&&previous&&!d.legacy_evidence){d.legacy_evidence={...previous,captured_at:new Date().toISOString(),provenance:'stored-legacy-metadata-unverified'};persist();return ok(d);}
    return result;
  }
  if(name==='legacy_document_access') {
    control.calls.push(name);const d=state.documents.find(d=>d.id===p.p_id),old=d?.legacy_evidence;
    if(!old||!state.objects[old.file_path])return fail('Legacy file unavailable');return ok({id:d.id,file_path:old.file_path,file_name:old.file_name});
  }
  if(name==='admin_set_current_year') {
    control.calls.push(name);if(control.failMutation===name)return fail('Synthetic current year rejection');
    const r=state.academic_years.find(y=>y.id===p.p_id);if(!r||r.archived_at)return fail('Active year required');
    const previous=state.academic_years.find(y=>y.is_current)?.id||null;if(previous!==p.p_id&&previous!==p.p_expected_current)return fail('Current year changed');
    state.academic_years.forEach(y=>{y.is_current=y.id===r.id;});persist();return ok({id:r.id,year:r,previous_id:previous});
  }
  if(name==='admin_add_requirement') {
    control.calls.push(name);
    if(control.failMutation===name)return fail('Synthetic requirement rejection');
    let r=state.documents.find(d=>d.id===p.p_request_id);
    if(!r){r={id:p.p_request_id,intern_id:p.p_intern_id,name:p.p_name,doc_type:`custom:${p.p_request_id}`,status:'Pending',upload_version:0,review_revision:0,created_at:new Date().toISOString()};state.documents.push(r);persist();}
    return ok(r);
  }
  if(name==='verify_attendance') {
    control.calls.push(name);if(control.failMutation===name)return fail('Synthetic verification rejection');
    const r=state.attendance_logs.find(d=>d.id===p.p_id);
    if(!r||r.clocked_in_at!==p.p_expected_in||r.clocked_out_at!==p.p_expected_out)return fail('Attendance changed');
    r.verified=true;r.verified_by=me.id;persist();return ok(control.offsetAttendanceResponse?{...r,
      clocked_in_at:r.clocked_in_at.replace('Z','+00:00'),clocked_out_at:r.clocked_out_at.replace('Z','+00:00')}:r);
  }
  return base.rpc(name,p);
}};

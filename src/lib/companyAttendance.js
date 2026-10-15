import { recordRpc } from './authority';
import { calendarDate } from './lists';
import { validateDocument } from './documents';
import { attendanceEvidence } from './hours';
export const ATTENDANCE_COLUMNS='id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,verified_by,accomplishment,attendance_source,manual_evidence_id,manual_details,manual_revision,encoded_by,encoded_at,revised_by,revised_at,revision_reason,verified_at,logbook_submission_id,logbook_version';
export const FALLBACK_REASONS={no_connectivity:'No internet / mobile data',system_unavailable:'System unavailable',other:'Other'};
export const attendanceSource=row=>row.attendance_source==='manual_company_sheet'?(row.logbook_submission_id?'Manual — Company Logbook':'Manual — Company Attendance Sheet'):'Online / legacy clock record';
export function localAttendanceInstant(date,time) {
  if(calendarDate(date)===null||!/^\d{2}:\d{2}(?::\d{2})?$/.test(time||''))return null;
  const [h,m,s=0]=time.split(':').map(Number);if(h>23||m>59||s>59)return null;
  const result=new Date(`${date}T${time.length===5?`${time}:00`:time}+08:00`);
  return Number.isFinite(result.getTime())?result.toISOString():null;
}
export function manualSessionPreview(form,records=[],now=new Date(),exclude=null) {
  const start=localAttendanceInstant(form.date,form.timeIn),end=localAttendanceInstant(form.endDate,form.timeOut);
  if(!start||!end)return {error:'Enter valid attendance and Time Out dates and both times (Asia/Manila).'};
  const seconds=(Date.parse(end)-Date.parse(start))/1000;
  if(seconds<=0)return {error:'Time Out must follow Time In. Overnight sessions need an explicit next-day Time Out date.'};
  if(seconds>57600)return {error:'The existing attendance model permits sessions up to 16 hours.'};
  if(Date.parse(end)>now.getTime()||Date.parse(start)>now.getTime())return {error:'Future attendance is not permitted.'};
  const other=records.filter(r=>r.intern_id===form.internId&&r.id!==exclude);
  if(other.some(r=>!r.time_out))return {error:'An online attendance session is open. Manual entry cannot close or replace it.'};
  if(other.some(r=>Date.parse(r.clocked_in_at)===Date.parse(start)&&Date.parse(r.clocked_out_at)===Date.parse(end)))return {error:'This exact attendance session already exists.'};
  if(other.some(r=>Date.parse(r.clocked_in_at)<Date.parse(end)&&Date.parse(r.clocked_out_at)>Date.parse(start)))return {error:'This session overlaps existing attendance.'};
  if(other.some(r=>r.log_date===form.date))return {error:'One record per Intern per Manila start date is supported. This date already has attendance.'};
  return {start,end,hours:seconds/3600,error:null};
}
export function manualDetails(form) {
  return {company_on_sheet:form.companyName.trim(),supervisor_on_sheet:form.supervisor.trim(),fallback_reason:form.reason,
    reason_explanation:form.reason==='other'?form.explanation.trim():'',remarks:form.remarks.trim(),signatures_reviewed:form.signatures};
}
export function manualFormError(form) {
  if(!form.internId||!form.companyId||!form.companyName.trim()||!form.supervisor.trim())return 'Choose an assigned Intern and company; enter the names shown on the signed sheet.';
  if(form.companyName.length>200||form.supervisor.length>200||!FALLBACK_REASONS[form.reason]||form.remarks.length>500)return 'Check the company, Supervisor, reason and remarks limits.';
  if(form.reason==='other'&&(form.explanation.trim().length<10||form.explanation.length>500||!/[\p{L}]/u.test(form.explanation)))return 'Other requires a meaningful 10–500 character explanation.';
  if(!form.signatures)return 'Confirm that you reviewed the Intern and Supervisor signatures.';
  return null;
}
export async function sheetContext(client,internId) {
  try {
    const {data,error}=await client.rpc('attendance_sheet_context',{p_intern:internId});if(error)throw error;
    if(data?.intern_id!==internId||!Array.isArray(data.companies))throw new Error('Sheet context unavailable. Refresh after the M17 database update.');
    return {ok:true,data};
  }catch(error){return {ok:false,error:error.message};}
}
// Keep a stable attempt/receipt across network failures. Reconcile before retrying
// upload/finalization; only explicit cancellation removes unreferenced bytes.
export async function uploadAttendanceSheet(client,attempt,file,onProgress=()=>{}) {
  const validation=validateDocument(file);if(validation)return {ok:false,error:validation};
  if(file.name.length>200)return {ok:false,error:'Use a filename of at most 200 characters.'};
  onProgress('Reserving evidence upload…');
  const staged=await recordRpc(client,'stage_attendance_sheet',{p_id:attempt.id,p_company:attempt.companyId,p_participants:attempt.participants,p_name:file.name,p_mime:file.type,p_size:file.size});
  if(!staged.ok)return {...staged,uploadId:attempt.id};
  const e=staged.data;
  if(!e.file_path?.startsWith(`sheets/${attempt.id}.`)||e.company_id!==attempt.companyId)return {ok:false,error:'Invalid evidence reservation. Refresh before retrying.',uploadId:attempt.id};
  if(e.ready_at)return recordRpc(client,'finish_attendance_sheet',{p_id:attempt.id});
  try {
    // A previous upload may have succeeded although its response was lost.
    const reconciliation=await recordRpc(client,'finish_attendance_sheet',{p_id:attempt.id});
    if(reconciliation.ok)return reconciliation;
    if(reconciliation.errorCode&&reconciliation.errorCode!=='P0001')return {...reconciliation,uploadId:attempt.id};
    onProgress('Uploading signed sheet…');
    const {error}=await client.storage.from('attendance-evidence').upload(e.file_path,file,{upsert:false,contentType:file.type});
    onProgress('Validating uploaded evidence…');
    const finished=await recordRpc(client,'finish_attendance_sheet',{p_id:attempt.id});
    if(finished.ok)return finished;
    return {ok:false,error:error?.message||finished.error,uploadId:attempt.id};
  }catch(error){return {ok:false,error:`Upload outcome not confirmed: ${error.message}. Retry this upload or explicitly abandon it.`,uploadId:attempt.id};}
}
export async function abandonAttendanceSheet(client,id) {
  const result=await recordRpc(client,'cancel_attendance_sheet',{p_id:id});if(!result.ok)return result;
  if(result.data.object_exists===false)return {ok:true};
  if(result.data.object_exists!==true)return {ok:false,error:'Cleanup status unavailable. Retry recovery before removing any bytes.'};
  try {
    const {data,error}=await client.storage.from('attendance-evidence').remove([result.data.file_path]);
    return error?{ok:false,error:`Cleanup pending: ${error.message}`}:
      Array.isArray(data)&&data.length===1?{ok:true}:{ok:false,error:'Byte cleanup not confirmed. Retry recovery; if assignments changed, ask the operator to inspect the unused upload.'};
  }catch(error){return {ok:false,error:`Cleanup pending: ${error.message}`};}
}
export async function attendanceSheetLink(client,id) {
  try {
    const {data:file,error}=await client.rpc('attendance_sheet_access',{p_id:id});if(error)throw error;
    if(file?.bucket!=='attendance-evidence'||!file.path?.startsWith('sheets/'))throw new Error('Invalid private evidence access response.');
    const expiresAt=Date.now()+60000;
    const {data,error:linkError}=await client.storage.from(file.bucket).createSignedUrl(file.path,60);if(linkError)throw linkError;
    const url=new URL(data?.signedUrl);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Invalid evidence link.');
    if(Date.now()>=expiresAt)throw new Error('Evidence link expired. Request another preview.');
    return {ok:true,url:url.href,name:file.name,mime:file.mime,expiresAt};
  }catch(error){return {ok:false,error:error.message};}
}
export async function verifyManualAttendance(client,row,reviewed) {
  if(!reviewed||attendanceEvidence(row).state!=='closed')return {ok:false,error:'Review the signed evidence and valid closed session before verifying.'};
  return recordRpc(client,'verify_manual_attendance',{p_id:row.id,p_revision:row.manual_revision,p_evidence:row.manual_evidence_id,p_expected_in:row.clocked_in_at,p_expected_out:row.clocked_out_at,p_reviewed:true});
}

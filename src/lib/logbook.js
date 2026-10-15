import { recordRpc } from './authority';
import { validateDocument } from './documents';
import { manualSessionPreview } from './companyAttendance';

export function logbookRpc(client,name,args) {
 return recordRpc({rpc:async(n,p)=>{
  const result=await client.rpc(n,p);
  const normalize=row=>row?.submission_id?{...row,id:row.submission_id}:row;
  return {...result,data:Array.isArray(result.data)?result.data.map(normalize):normalize(result.data)};
 }},name,args);
}

export async function logbookQueue(client) {
 const rows=[]; let after=null;
 for (;;) {
  const {data,error}=await client.rpc('logbook_queue',{p_after:after,p_size:100});
  if(error)throw error;
  if(!Array.isArray(data)||data.some((r,i)=>!r.id||(i?r.id<=data[i-1].id:after&&r.id<=after)))throw new Error('Submission history changed; refresh.');
  if(!data.length)return rows;
  rows.push(...data);after=data.at(-1).id;
  if(rows.length>50000)throw new Error('Submission history exceeds the supported read limit.');
 }
}
export function logbookSessions(rows,internId,records,start,end) {
 const result=[],seen=[];
 if(!rows.length||rows.length>62)return {error:'Enter 1–62 attendance sessions.'};
 for(let n=0;n<rows.length;n++) {
  const row=rows[n],p=manualSessionPreview({...row,internId},[...records,...seen]);
  if(p.error)return {error:`Session ${n+1}: ${p.error}`};
  if(row.date<start||row.endDate>end)return {error:`Session ${n+1}: dates must fall within the submitted covered period.`};
  result.push({time_in:p.start,time_out:p.end});seen.push({id:`preview-${n}`,intern_id:internId,log_date:row.date,clocked_in_at:p.start,clocked_out_at:p.end,time_out:row.timeOut});
 }
 return {sessions:result,hours:result.reduce((n,r)=>n+(Date.parse(r.time_out)-Date.parse(r.time_in))/3600000,0)};
}
export async function uploadLogbookPage(client,submission,attempt,file,onProgress=()=>{}) {
 const error=validateDocument(file);if(error)return {ok:false,error};
 if(file.name.length>200)return {ok:false,error:'Use filenames of at most 200 characters.'};
 onProgress('Preparing private upload…');
 const staged=await recordRpc(client,'stage_logbook_evidence',{p_id:attempt,p_submission:submission,p_name:file.name,p_mime:file.type,p_size:file.size});
 if(!staged.ok)return staged;
 if(!staged.data.file_path?.startsWith(`sheets/${attempt}.`))return {ok:false,error:'Upload reservation unavailable. Refresh and retry.'};
 let done=await recordRpc(client,'finish_attendance_sheet',{p_id:attempt});
 if(done.ok)return done;
 if(done.errorCode&&done.errorCode!=='P0001')return done;
 try {
  onProgress('Uploading signed logbook page…');
  const {error:uploadError}=await client.storage.from('attendance-evidence').upload(staged.data.file_path,file,{upsert:false,contentType:file.type});
  onProgress('Checking uploaded evidence…');
  done=await recordRpc(client,'finish_attendance_sheet',{p_id:attempt});
  return done.ok?done:{ok:false,error:uploadError?.message||done.error};
 }catch(e){return {ok:false,error:`Upload not confirmed: ${e.message}. Retry the same selected pages.`};}
}

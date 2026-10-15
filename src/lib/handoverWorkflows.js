import { recordRpc } from './authority';
import { attendanceEvidence } from './hours';

// PostgREST may encode the same instant with Z/+00:00 or a different fractional
// padding. Preserve all six PostgreSQL fractional digits when checking replies.
function instantKey(value) {
  if(typeof value!=='string') return null;
  const parts=value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/);
  if(!parts) return null;
  const seconds=Date.parse(parts[1]+parts[3]);
  return Number.isFinite(seconds)?`${seconds}:${(parts[2]||'').padEnd(6,'0')}`:null;
}

export async function setCurrentYear(client, yearId, expectedCurrent) {
  const result=await recordRpc(client,'admin_set_current_year',{p_id:yearId,p_expected_current:expectedCurrent||null});
  if(result.ok&&(result.data.year?.id!==yearId||result.data.year?.is_current!==true||result.data.year?.archived_at))
    return {ok:false,error:'Current year change could not be confirmed. Refresh before retrying.'};
  return result;
}

export async function addRequirement(client, internId, name, requestId) {
  const label = name.trim();
  if (!label || label.length > 200) return { ok: false, error: 'Enter a requirement name of 1–200 characters.' };
  const result = await recordRpc(client, 'admin_add_requirement', { p_intern_id: internId, p_name: label, p_request_id: requestId });
  if (result.ok && (result.data.id !== requestId || result.data.intern_id !== internId || result.data.name !== label
    || result.data.doc_type !== `custom:${requestId}`)) return { ok: false, error: 'Requirement outcome unknown; refresh before retrying.' };
  return result;
}

export async function verifyAttendance(client, row, now = new Date()) {
  if (attendanceEvidence(row, now).state !== 'closed') return { ok: false, error: 'Valid closed attendance required; unknown evidence cannot be verified.' };
  const expectedIn=instantKey(row.clocked_in_at),expectedOut=instantKey(row.clocked_out_at);
  if(!expectedIn||!expectedOut) return {ok:false,error:'Timestamp precision is unavailable. Refresh before verifying.'};
  const result=await recordRpc(client, 'verify_attendance', { p_id: row.id, p_expected_in: row.clocked_in_at, p_expected_out: row.clocked_out_at });
  if(result.ok && (result.data.intern_id!==row.intern_id || instantKey(result.data.clocked_in_at)!==expectedIn
    || instantKey(result.data.clocked_out_at)!==expectedOut || result.data.verified!==true || attendanceEvidence(result.data,now).state!=='closed'))
    return {ok:false,error:'Attendance verification could not be confirmed. Refresh before retrying.'};
  return result;
}

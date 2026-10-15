import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,beforeEach,afterEach,it,expect } from 'vitest';
import { disposablePostgres } from './disposable-postgres';
import { attendanceEvidence } from '../src/lib/hours';
const sql=f=>readFileSync(new URL(`../supabase/${f}`,import.meta.url),'utf8');
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=uid(1),C=uid(2),D=uid(3),S=uid(4),I=uid(5),J=uid(6),COMPANY=uid(10),OTHER=uid(11),E=uid(100),R=uid(200);
const start='2026-01-02T00:00:00Z',end='2026-01-02T08:15:30Z';
const details={company_on_sheet:'Company on signed sheet',supervisor_on_sheet:'Paper Supervisor',fallback_reason:'no_connectivity',reason_explanation:'',remarks:'Paper logbook evidence',signatures_reviewed:true};
let cluster,db;
async function act(actor,query,args=[],client=db) {
 await client.query('savepoint operation');
 try {await client.query(actor?'set local role authenticated':'set local role anon');await client.query("select set_config('request.jwt.claim.sub',$1,true)",[actor||'']);const rows=(await client.query(query,args)).rows;await client.query('set constraints all immediate');await client.query('reset role');await client.query('set constraints all deferred');await client.query('release savepoint operation');return rows;}
 catch(error){await client.query('rollback to savepoint operation');await client.query('reset role');await client.query('release savepoint operation');throw error;}
}
async function evidence({id=E,participants=[I],company=COMPANY,actor=C,finish=true}={}) {
 const [e]=await act(actor,'select * from public.stage_attendance_sheet($1,$2,$3,$4,$5,$6)',[id,company,participants,'signed-sheet.pdf','application/pdf',512]);
 await act(actor,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)', ['attendance-evidence',e.file_path,{mimetype:'application/pdf',size:512}]);
 if(finish)return (await act(actor,'select * from public.finish_attendance_sheet($1)',[id]))[0];return e;
}
const record=({id=R,intern=I,from=start,to=end,sheet=E,info=details,actor=C,client=db}={})=>act(actor,'select * from public.record_manual_attendance($1,$2,$3,$4,$5,$6)',[id,intern,from,to,sheet,info],client);
const verify=(r,actor=C,confirmed=true)=>act(actor,'select * from public.verify_manual_attendance($1,$2,$3,$4,$5,$6)',[r.id,r.manual_revision,r.manual_evidence_id,r.clocked_in_at,r.clocked_out_at,confirmed]);
beforeAll(async()=>{
 cluster=await disposablePostgres();db=await cluster.connect();db._types.setTypeParser(1082,v=>v);db._types.setTypeParser(1184,v=>v);await db.query(sql('tests/baseline.sql'));
 for(const f of ['M01_authority','M02_trusted_audit','M03_attendance_integrity','M04_private_documents_bucket','M06_rubric_hours','M07_account_lifecycle','M08_document_versions','M10_flexible_submissions','M11_admin_history','M12_handover_workflows','M13_coordinator_operations','M14_last_admin_protection','M15_supervisor_evaluations','M16_evaluation_controls','M17_company_attendance'])await db.query(sql(`migrations/${f}.sql`));
 await db.query(sql('inspection/09_company_attendance.sql'));
 for(const actor of [A,C,D,S,I,J])await db.query('insert into auth.users(id,email) values($1,$2)',[actor,`${actor}@example.invalid`]);
 await db.query("update public.profiles set role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end,status='Active'",[A,C,D]);
 await db.query('insert into public.companies(id,name) values($1,$2),($3,$4)',[COMPANY,'Company A',OTHER,'Company B']);
 await db.query('begin');await act(A,'select public.admin_update_account($1,$2)',[S,{role:'supervisor',company_id:COMPANY}]);
 for(const intern of [I,J])await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[intern,C,COMPANY]);
 await act(A,'select public.admin_set_supervision($1,$2,true)',[S,I]);await db.query('commit');
},60000);
afterAll(async()=>{if(cluster)await cluster.stop();},30000);
beforeEach(async()=>{await db.query('begin');});afterEach(async()=>{await db.query('rollback');});
it('creates exact server hours in the existing ledger, without verification or a parallel total',async()=>{
 await evidence();const [r]=await record();expect(r).toMatchObject({attendance_source:'manual_company_sheet',verified:false,verified_by:null,verified_at:null,encoded_by:C,manual_revision:1,log_date:'2026-01-02'});
 expect(Number(r.hours)).toBeCloseTo(8.258333333333333);expect(attendanceEvidence(r)).toMatchObject({state:'closed',logged:r.hours,verified:0});
 expect(Date.parse(r.encoded_at)).toBeGreaterThan(Date.parse(r.clocked_out_at));
 const [event]=await act(C,'select * from public.manual_attendance_events');expect(event.event_kind).toBe('created');expect(event.actor_id).toBe(C);expect(event.before_values).toBe(null);
 expect((await record())[0].id).toBe(R);expect((await act(C,'select * from public.manual_attendance_events')).length).toBe(1);
});
it('requires explicit evidence review; legacy verification cannot bypass the manual review action',async()=>{
 await evidence();const [r]=await record();await expect(verify(r,C,false)).rejects.toThrow(/Review current/);
 await expect(act(C,'select public.verify_attendance($1,$2,$3)',[R,start,end])).rejects.toThrow(/explicit manual/);
 const [v]=await verify(r);expect(v.verified).toBe(true);expect(v.verified_by).toBe(C);expect(v.verified_at).not.toBe(null);expect(attendanceEvidence(v).verified).toBeCloseTo(Number(v.hours));
 expect((await verify(r))[0].id).toBe(R);expect((await act(C,'select event_kind from public.manual_attendance_events order by created_at,id')).map(e=>e.event_kind).sort()).toEqual(['created','verified']);
});
it('rejects duplicate, overlap, open-session and same-day nonoverlap without changing existing attendance',async()=>{
 await evidence();await record();
 for(const [from,to,pattern] of [[start,end,/duplicate/],['2026-01-02T07:00:00Z','2026-01-02T09:00:00Z',/overlaps/],['2026-01-02T09:00:00Z','2026-01-02T10:00:00Z',/one session/]])await expect(record({id:uid(201),from,to})).rejects.toThrow(pattern);
 await act(I,'select public.clock_in()');await expect(record({id:uid(202),from:'2026-01-03T00:00:00Z',to:'2026-01-03T01:00:00Z'})).rejects.toThrow(/Open online/);
 expect((await act(C,'select * from public.attendance_logs')).length).toBe(2);
});
it('accepts non-overlapping sessions on different start dates with shared evidence; rejects cross-midnight overlaps',async()=>{
 await evidence();await record({from:'2026-01-02T15:00:00Z',to:'2026-01-02T17:00:00Z'});
 await expect(record({id:uid(201),from:'2026-01-02T16:30:00Z',to:'2026-01-02T18:00:00Z'})).rejects.toThrow(/overlaps/);
 const [r]=await record({id:uid(202),from:'2026-01-03T00:00:00Z',to:'2026-01-03T08:00:00Z'});expect(r.log_date).toBe('2026-01-03');
 expect((await act(C,'select count(*)::int n from public.attendance_logs'))[0].n).toBe(2);
});
it('rejects missing, reversed, excessive, infinite and future instants and invalid reason/signature payloads',async()=>{
 await evidence();for(const [from,to] of [[null,end],[start,null],[end,start],[start,'2026-01-03T01:00:00Z'],['infinity','infinity'],['2099-01-01T00:00:00Z','2099-01-01T01:00:00Z']])await expect(record({from,to})).rejects.toThrow(/timestamps|required|16 hours|Future/);
 for(const info of [{...details,signatures_reviewed:false},{...details,fallback_reason:'other',reason_explanation:'short'},{...details,fallback_reason:'forged'},{...details,encoder_id:A},{...details,supervisor_on_sheet:''}])await expect(record({info})).rejects.toThrow(/Confirm|Valid|valid|Other/);
 await expect(record({from:'2026-02-30T00:00:00Z'})).rejects.toThrow();expect((await act(C,'select * from public.attendance_logs')).length).toBe(0);
});
it('requires complete metadata-validated upload, honors reservation expiry and recovers cancellation without losing evidence',async()=>{
 const [e]=await act(C,'select * from public.stage_attendance_sheet($1,$2,$3,$4,$5,$6)',[E,COMPANY,[I],'sheet.png','image/png',200]);
 await expect(record()).rejects.toThrow(/Successfully uploaded/);await expect(act(C,'select public.finish_attendance_sheet($1)',[E])).rejects.toThrow(/validated evidence upload/);
 await act(C,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)', ['attendance-evidence',e.file_path,{mimetype:'image/png',size:201}]);
 await expect(act(C,'select public.finish_attendance_sheet($1)',[E])).rejects.toThrow(/validated evidence upload/);
 await act(C,'select public.cancel_attendance_sheet($1)',[E]);expect(await act(C,'delete from storage.objects where bucket_id=$1 and name=$2 returning name',['attendance-evidence',e.file_path])).toHaveLength(1);
 const completed=await evidence({id:uid(101)});await record({sheet:completed.id});await expect(act(C,'select public.cancel_attendance_sheet($1)',[completed.id])).rejects.toThrow(/preserved/);
 expect(await act(C,'delete from storage.objects where bucket_id=$1 and name=$2 returning name',['attendance-evidence',completed.file_path])).toEqual([]);
 await db.query("insert into public.attendance_sheet_evidence(id,company_id,participant_ids,uploaded_by,file_path,file_name,mime_type,byte_size,expires_at) values($1,$2,$3,$4,$5,'Expired.pdf','application/pdf',512,'2026-01-01')",[uid(105),COMPANY,[I],C,`sheets/${uid(105)}.pdf`]);
 await expect(act(C,'select public.finish_attendance_sheet($1)',[uid(105)])).rejects.toThrow(/expired/);
 await expect(act(C,"insert into storage.objects(bucket_id,name,metadata) values('attendance-evidence',$1,$2)",[`sheets/${uid(105)}.pdf`,{mimetype:'application/pdf',size:512}])).rejects.toThrow(/row-level security/);
});
it('blocks anonymous, Intern, Supervisor, Admin creation, unassigned Coordinator and cross-company upload',async()=>{
 await evidence();for(const actor of [null,I,J,S,A,D])await expect(record({actor})).rejects.toThrow(/permission denied|Assigned/);
 await expect(evidence({id:uid(101),company:OTHER})).rejects.toThrow(/assigned Active Intern/);
 await expect(act(C,'insert into public.attendance_logs(intern_id,log_date) values($1,$2)',[I,'2026-01-02'])).rejects.toThrow(/permission denied/);
 await expect(act(C,'update public.attendance_sheet_evidence set participant_ids=$1 where id=$2',[[I,J],E])).rejects.toThrow(/permission denied/);
 await act(A,'select public.admin_update_account($1,$2)',[D,{status:'Inactive'}]);expect((await act(D,'select public.current_role() role'))[0].role).toBe(null);await expect(record({actor:D})).rejects.toThrow(/Assigned/);
});
it('shared sheets never expose participant metadata or bytes to Interns; reassignment revokes staff access',async()=>{
 const e=await evidence({participants:[I,J]});await record();await record({id:uid(201),intern:J});
 for(const actor of [null,I,J,S,D]){expect(await act(actor,'select * from storage.objects where bucket_id=$1',['attendance-evidence'])).toEqual([]);if(actor){expect(await act(actor,'select * from public.attendance_sheet_evidence')).toEqual([]);await expect(act(actor,'select public.attendance_sheet_access($1)',[E])).rejects.toThrow(/Authorized/);}}
 expect((await act(I,'select * from public.attendance_logs')).map(r=>r.intern_id)).toEqual([I]);expect(await act(I,'select * from public.manual_attendance_events')).toEqual([]);
 expect((await act(C,'select public.attendance_sheet_access($1)',[E]))[0].attendance_sheet_access.path).toBe(e.file_path);
 await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[J,D,COMPANY]);
 expect(await act(C,'select * from public.attendance_sheet_evidence')).toEqual([]);expect(await act(D,'select * from public.attendance_sheet_evidence')).toEqual([]);
 expect((await act(A,'select * from public.attendance_sheet_evidence')).length).toBe(1);
});
it('retains printed company/Supervisor provenance and history after company changes and renames',async()=>{
 await evidence();const [r]=await record();await act(A,'select public.admin_set_supervision($1,$2,false)',[S,I]);await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,C,OTHER]);
 await db.query("update public.companies set name='Renamed company' where id=$1",[COMPANY]);
 const [retry]=await record();expect(retry.manual_details).toEqual(r.manual_details);expect(retry.manual_details.registered_company_name).toBe('Company A');
 const [revised]=await act(C,'select * from public.revise_manual_attendance($1,$2,$3,$4,$5,$6,$7)',[R,1,start,end,E,details,'Reviewed the original company and signed attendance']);expect(revised.manual_details.registered_company_name).toBe('Company A');
 const ctx=(await act(C,'select public.attendance_sheet_context($1)',[I]))[0].attendance_sheet_context;expect(ctx.companies.map(c=>c.id).sort()).toEqual([COMPANY,OTHER]);
 await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[J,C,OTHER]);
 const past=(await act(C,'select public.attendance_sheet_context($1)',[J]))[0].attendance_sheet_context;expect(past.companies.map(c=>c.id).sort()).toEqual([COMPANY,OTHER]);
});
it('unverified revisions use expected versions and audit full before/after; verified rows and evidence are immutable',async()=>{
 await evidence();const [r]=await record();
 const [changed]=await act(C,'select * from public.revise_manual_attendance($1,$2,$3,$4,$5,$6,$7)',[R,1,start,'2026-01-02T09:00:00Z',E,details,'Corrected transcription from signed evidence']);
 expect(changed.manual_revision).toBe(2);expect(changed.encoded_at).toEqual(r.encoded_at);expect(changed.revised_by).toBe(C);
 const event=(await act(C,"select * from public.manual_attendance_events where event_kind='revised'"))[0];expect(event.before_values.hours).toBe(Number(r.hours));expect(event.after_values.hours).toBe(9);
 await expect(verify(r)).rejects.toThrow(/Review current/);await verify(changed);
 await expect(act(C,'select public.revise_manual_attendance($1,$2,$3,$4,$5,$6,$7)',[R,2,start,end,E,details,'Attempt to modify verified attendance'])).rejects.toThrow(/unverified/);
 for(const query of ["update public.attendance_logs set hours=8 where id=$1",'delete from public.attendance_logs where id=$1']){await db.query('savepoint immutable');await expect(db.query(query,[R])).rejects.toThrow(/immutable|preserved/);await db.query('rollback to savepoint immutable');}
 await expect(act(C,'delete from public.manual_attendance_events')).rejects.toThrow(/permission denied/);
});
it('audit failure atomically rolls back manual creation, attachment commitment and hours',async()=>{
 await evidence();await db.query("create function public.synthetic_manual_audit_failure() returns trigger language plpgsql as $$ begin raise exception 'Synthetic manual audit failure'; end $$; create trigger synthetic_failure before insert on public.manual_attendance_events for each row execute function public.synthetic_manual_audit_failure()");
 await expect(record()).rejects.toThrow(/Synthetic manual audit failure/);expect(await act(C,'select * from public.attendance_logs')).toEqual([]);expect((await act(C,'select * from public.attendance_sheet_evidence'))[0].committed_at).toBe(null);
});
it('online clocking, accomplishment and ordinary verification stay separate and exception mutations stay retired',async()=>{
 const [open]=await act(I,'select * from public.clock_in()');
 await expect(act(I,'select public.clock_out($1,$2)',[open.id,'Completed online tasks'])).resolves.toHaveLength(1);
 const [row]=await act(C,'select * from public.attendance_logs where id=$1',[open.id]);expect(row.attendance_source).toBe('online');expect(row.accomplishment).toBe('Completed online tasks');
 const [verified]=await act(C,'select * from public.verify_attendance($1,$2,$3)',[row.id,row.clocked_in_at,row.clocked_out_at]);expect(verified.verified).toBe(true);
 await expect(act(I,'select public.submit_exception($1,$2,$3,$4,$5)', ['2026-01-02','08:00','17:00','Old client','2026-01-02'])).rejects.toThrow(/permission denied|does not exist/);
});
it('separate connections serialize lost-response retries, duplicate identities and competing online punches',async()=>{
 await evidence({participants:[I,J]});await db.query('commit');
 const one=await cluster.connect(),two=await cluster.connect();
 try {
  await one.query('begin');await two.query('begin');
  const [created]=await record({client:one});let completed=false;
  const retry=record({client:two}).then(rows=>{completed=true;return rows;});
  await new Promise(resolve=>setTimeout(resolve,100));expect(completed).toBe(false);await one.query('commit');
  expect((await retry)[0].id).toBe(created.id);await two.query('commit');
  expect((await db.query('select count(*)::int n from public.attendance_logs where id=$1',[R])).rows[0].n).toBe(1);
  expect((await db.query('select count(*)::int n from public.manual_attendance_events where attendance_id=$1',[R])).rows[0].n).toBe(1);
  await one.query('begin');await two.query('begin');
  await record({id:uid(210),from:'2026-01-03T00:00:00Z',to:'2026-01-03T08:00:00Z',client:one});
  const duplicate=record({id:uid(211),from:'2026-01-03T00:00:00Z',to:'2026-01-03T08:00:00Z',client:two});
  const rejection=expect(duplicate).rejects.toThrow(/duplicate/);await one.query('commit');await rejection;await two.query('rollback');
  await one.query('begin');await two.query('begin');await act(J,'select public.clock_in()',[],one);
  const manual=record({id:uid(220),intern:J,client:two});const openRejection=expect(manual).rejects.toThrow(/Open online/);await one.query('commit');await openRejection;await two.query('rollback');
 }finally{await Promise.all([one.end(),two.end()]);await db.query('begin');}
},20000);

import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,beforeEach,afterEach,it,expect } from 'vitest';
import { disposablePostgres } from './disposable-postgres';
import { attendanceEvidence } from '../src/lib/hours';
const sql=f=>readFileSync(new URL(`../supabase/${f}`,import.meta.url),'utf8');
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=uid(1),C=uid(2),D=uid(3),S=uid(4),I=uid(5),J=uid(6),COMPANY=uid(10),OTHER=uid(11),E=uid(100),R=uid(200);
const start='2026-01-02T00:00:00Z',end='2026-01-02T08:15:30Z';
let cluster,db;
async function act(actor,query,args=[],client=db) {
 await client.query('savepoint operation');
 try {await client.query(actor?'set local role authenticated':'set local role anon');await client.query("select set_config('request.jwt.claim.sub',$1,true)",[actor||'']);const rows=(await client.query(query,args)).rows;await client.query('set constraints all immediate');await client.query('reset role');await client.query('set constraints all deferred');await client.query('release savepoint operation');return rows;}
 catch(error){await client.query('rollback to savepoint operation');await client.query('reset role');await client.query('release savepoint operation');throw error;}
}
beforeAll(async()=>{
 cluster=await disposablePostgres();db=await cluster.connect();db._types.setTypeParser(1082,v=>v);db._types.setTypeParser(1184,v=>v);await db.query(sql('tests/baseline.sql'));
 for(const f of ['M01_authority','M02_trusted_audit','M03_attendance_integrity','M04_private_documents_bucket','M06_rubric_hours','M07_account_lifecycle','M08_document_versions','M10_flexible_submissions','M11_admin_history','M12_handover_workflows','M13_coordinator_operations','M14_last_admin_protection','M15_supervisor_evaluations','M16_evaluation_controls','M17_company_attendance','M18_supervisor_logbook'])await db.query(sql(`migrations/${f}.sql`));
 await db.query(sql('inspection/10_supervisor_logbook.sql'));
 for(const actor of [A,C,D,S,I,J])await db.query('insert into auth.users(id,email) values($1,$2)',[actor,`${actor}@example.invalid`]);
 await db.query("update public.profiles set role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end,status='Active'",[A,C,D]);
 await db.query('insert into public.companies(id,name) values($1,$2),($3,$4)',[COMPANY,'Company A',OTHER,'Company B']);
 await db.query('begin');await act(A,'select public.admin_update_account($1,$2)',[S,{role:'supervisor',company_id:COMPANY}]);
 for(const intern of [I,J])await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[intern,C,COMPANY]);
 await act(A,'select public.admin_set_supervision($1,$2,true)',[S,I]);await db.query('commit');
},60000);
afterAll(async()=>{if(cluster)await cluster.stop();},30000);
beforeEach(async()=>{await db.query('begin');});afterEach(async()=>{await db.query('rollback');});

const L=uid(300),K=uid(400);
const sessions=[{time_in:start,time_out:end},{time_in:'2026-01-03T00:00:00+00:00',time_out:'2026-01-03T08:00:00+00:00'}];
const draft=(version=1,revision=0,evidence=[],opts={})=>act(S,'select * from public.save_logbook_draft($1,$2,$3,$4,$5,$6,$7,$8)',[opts.id||L,opts.intern||I,'2026-01-02','2026-01-04',opts.remarks||'Signed company logbook',evidence,version,revision]);
async function page(id=E,submission=L){
 const [e]=await act(S,'select * from public.stage_logbook_evidence($1,$2,$3,$4,$5)',[id,submission,'signed-logbook.pdf','application/pdf',512]);
 await act(S,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)', ['attendance-evidence',e.file_path,{mimetype:'application/pdf',size:512}]);
 return (await act(S,'select * from public.finish_attendance_sheet($1)',[id]))[0];
}
async function pending(){await draft();await page();const [d]=await draft(1,1,[E]);return (await act(S,'select * from public.submit_logbook($1,$2,$3)',[L,d.version,d.revision]))[0];}
const verify=(v,rows=sessions,actor=C,key=K,client=db)=>act(actor,'select * from public.verify_record_logbook($1,$2,$3,$4,$5,$6)',[L,v.version,v.revision,key,JSON.stringify(rows),true],client);
it('drafts and submissions credit no hours, route server-side and expose no source data to Interns',async()=>{
 await draft();await page();const [d]=await draft(1,1,[E]);
 expect((await act(C,'select * from public.logbook_queue()'))).toEqual([]);
 const [v]=await act(S,'select * from public.submit_logbook($1,$2,$3)',[L,d.version,d.revision]);expect(v.status).toBe('Pending Review');expect(v.receiving_coordinator_id).toBe(C);expect((await act(S,'select * from public.submit_logbook($1,$2,$3)',[L,d.version,d.revision]))[0].revision).toBe(v.revision);
 expect(await act(C,'select * from public.attendance_logs')).toEqual([]);
 expect(await act(I,'select * from public.logbook_submissions')).toEqual([]);expect(await act(I,'select * from public.logbook_versions')).toEqual([]);expect(await act(I,'select * from public.attendance_sheet_evidence')).toEqual([]);
 expect(await act(D,'select * from public.logbook_queue()')).toEqual([]);
 expect((await act(C,'select * from public.logbook_queue()'))[0].logbook_queue.company_name).toBe('Company A');
 await expect(act(I,'select public.attendance_sheet_access($1)',[E])).rejects.toThrow(/Authorized/);
 await expect(act(D,'select public.attendance_sheet_access($1)',[E])).rejects.toThrow(/Authorized/);
 expect((await act(C,'select public.attendance_sheet_access($1)',[E]))[0].attendance_sheet_access.bucket).toBe('attendance-evidence');
});
it('only explicit assigned Active Supervisors may create drafts/uploads; API mutations and old new-entry RPCs are closed',async()=>{
 await expect(draft(1,0,[],{intern:J})).rejects.toThrow(/explicitly assigned/);
 await expect(act(C,'select public.save_logbook_draft($1,$2,$3,$4,$5,$6,$7,$8)',[L,I,'2026-01-02','2026-01-04','',[],1,0])).rejects.toThrow(/Supervisor/);
 await expect(act(null,'select public.logbook_queue()')).rejects.toThrow(/permission denied/);
 await expect(act(S,'insert into public.logbook_submissions(id) values($1)',[L])).rejects.toThrow(/permission denied/);
 await draft();await act(A,'select public.admin_set_supervision($1,$2,false)',[S,I]);await db.query("update public.profiles set status='Inactive' where id=$1",[S]);
 await expect(page()).rejects.toThrow(/current assignment/);expect(await act(S,'select * from public.logbook_submissions')).toEqual([]);
 for(const query of ['select public.stage_attendance_sheet($1,$2,$3,$4,$5,$6)','select public.record_manual_attendance($1,$2,$3,$4,$5,$6)']){
  await expect(act(C,query,query.includes('stage_')?[E,COMPANY,[I],'x.pdf','application/pdf',512]:[R,I,start,end,E,{}])).rejects.toThrow(/permission denied/);
 }
});
it('missing Coordinator preserves saved draft and evidence, and assignment termination blocks submission',async()=>{
 await draft();await page();const [d]=await draft(1,1,[E]);
 await act(A,'select public.admin_set_assignment($1,null,$2,null,8)',[I,COMPANY]);
 await expect(act(S,'select public.submit_logbook($1,$2,$3)',[L,1,d.revision])).rejects.toThrow(/No eligible assigned/);
 expect((await act(S,'select * from public.logbook_versions'))[0].status).toBe('Draft');expect((await act(S,'select * from public.attendance_sheet_evidence'))[0].committed_at).not.toBe(null);
 await act(A,'select public.admin_set_supervision($1,$2,false)',[S,I]);await expect(act(S,'select public.submit_logbook($1,$2,$3)',[L,1,d.revision])).rejects.toThrow(/assignment/);
});
it('atomic multi-date verification creates authoritative hours and immutable verified ledger rows exactly once',async()=>{
 const v=await pending();const [done]=await verify(v);expect(done.status).toBe('Verified');expect(done.verified_by).toBe(C);expect(done.verified_at).toBeTruthy();
 const rows=await act(I,'select * from public.attendance_logs order by log_date');expect(rows).toHaveLength(2);
 expect(rows.every(r=>r.verified&&r.verified_by===C&&r.logbook_submission_id===L&&r.encoded_by===C)).toBe(true);
 expect(rows.reduce((n,r)=>n+Number(r.hours),0)).toBeCloseTo(16.258333333333333);expect(rows.reduce((n,r)=>n+Number(attendanceEvidence(r).verified),0)).toBeCloseTo(16.258333333333333);
 expect((await verify(v))[0].status).toBe('Verified');expect(await act(I,'select * from public.attendance_logs')).toHaveLength(2);
 await expect(verify(v,sessions,C,uid(401))).rejects.toThrow(/already reviewed/);
 await db.query('savepoint imm');await expect(db.query('update public.attendance_logs set hours=1 where logbook_submission_id=$1',[L])).rejects.toThrow(/immutable/);await db.query('rollback to savepoint imm');
 expect((await act(C,"select * from public.logbook_events where event_kind='verified_and_recorded'"))).toHaveLength(1);
});
it.each([
 ['duplicate',[sessions[0],sessions[0]],/Session 2: Exact duplicate/],
 ['overlap',[sessions[0],{time_in:'2026-01-02T01:00:00Z',time_out:'2026-01-02T03:00:00Z'}],/Session 2: Attendance overlaps/],
 ['same day',[{time_in:start,time_out:'2026-01-02T01:00:00Z'},{time_in:'2026-01-02T02:00:00Z',time_out:'2026-01-02T03:00:00Z'}],/Session 2: Existing model/],
 ['covered dates',[sessions[0],{time_in:'2026-01-05T00:00:00Z',time_out:'2026-01-05T01:00:00Z'}],/Session 2: Session dates/],
 ['reversed',[sessions[0],{time_in:end,time_out:start}],/Session 2: Both timestamps/],
 ['future',[sessions[0],{time_in:'2099-01-01T00:00:00Z',time_out:'2099-01-01T01:00:00Z'}],/Session 2: Future/],
 ['duration',[sessions[0],{time_in:'2026-01-03T00:00:00Z',time_out:'2026-01-03T17:00:00Z'}],/Session 2: Existing attendance limit/],
 ['missing offset',[{time_in:'2026-01-02T08:00:00',time_out:'2026-01-02T09:00:00'}],/canonical timestamps/],
 ['infinite',[{time_in:'infinityZ',time_out:'infinityZ'}],/Session 1:/]
])('%s fails the entire transaction without attendance or status change',async(_,rows,error)=>{
 const v=await pending();await expect(verify(v,rows)).rejects.toThrow(error);
 expect(await act(C,'select * from public.attendance_logs')).toEqual([]);expect((await act(C,'select * from public.logbook_versions'))[0].status).toBe('Pending Review');
});
it('existing open online attendance blocks verification without closing or changing it',async()=>{
 const v=await pending();const [open]=await act(I,'select * from public.clock_in()');await expect(verify(v)).rejects.toThrow(/Open online/);
 expect((await act(I,'select * from public.attendance_logs'))[0]).toMatchObject({id:open.id,time_out:null,verified:false});
});
it('return requires meaningful reason, credits zero hours, preserves source versions and supports revised resubmission',async()=>{
 const v=await pending();await expect(act(C,'select public.return_logbook($1,$2,$3,$4)',[L,1,v.revision,'bad'])).rejects.toThrow(/10–1000/);
 const [returned]=await act(C,'select * from public.return_logbook($1,$2,$3,$4)',[L,1,v.revision,'Supervisor signature is missing on the last page.']);
 expect(returned.status).toBe('Returned for Correction');expect(await act(I,'select * from public.attendance_logs')).toEqual([]);
 const [revised]=await draft(1,returned.revision,[E],{remarks:'Signature clarified in retained signed evidence'});expect(revised.version).toBe(2);
 expect((await act(S,'select * from public.logbook_versions order by version'))[0].return_reason).toContain('signature');
 const [newv]=await act(S,'select * from public.submit_logbook($1,$2,$3)',[L,2,revised.revision]);await verify(newv);expect(await act(S,'select * from public.logbook_versions')).toHaveLength(2);
 await expect(act(S,'select public.cancel_attendance_sheet($1)',[E])).rejects.toThrow(/preserved/);
});
it('changed assignment never silently routes; explicit Admin reroute preserves original receiving identity and audit',async()=>{
 const v=await pending();await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,D,COMPANY]);
 expect(await act(C,'select * from public.logbook_queue()')).toEqual([]);expect(await act(D,'select * from public.logbook_queue()')).toEqual([]);
 await expect(verify(v)).rejects.toThrow(/receiving/);
 await act(A,'select public.admin_reroute_logbook($1,$2,$3,$4,$5)',[L,D,1,v.revision,'Reassigned to the current authorized Coordinator']);
 const [snapshot]=await act(D,'select * from public.logbook_versions');expect(snapshot.receiving_coordinator_id).toBe(C);expect(snapshot.revision).toBe(v.revision+1);
 await expect(verify(v,sessions,D)).rejects.toThrow(/version changed/);await verify(snapshot,sessions,D);
 expect((await act(A,"select * from public.logbook_events where event_kind='admin_rerouted'"))[0].before_values.coordinator_id).toBe(C);
});
it('cross-company changes block review and reroute while keeping Supervisor history and snapshots',async()=>{
 const v=await pending();await act(A,'select public.admin_set_supervision($1,$2,false)',[S,I]);await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,C,OTHER]);
 await expect(verify(v)).rejects.toThrow(/receiving/);await expect(act(A,'select public.admin_reroute_logbook($1,$2,$3,$4,$5)',[L,C,1,v.revision,'Attempt to route across companies'])).rejects.toThrow(/preserved company/);
 expect((await act(S,'select * from public.logbook_submissions'))[0].company_id).toBe(COMPANY);
});
it('audit failure rolls back every recorded row and status',async()=>{
 const v=await pending();await db.query("create function public.synthetic_logbook_audit_failure() returns trigger language plpgsql as $$ begin if new.event_kind='verified_and_recorded' then raise exception 'Synthetic logbook audit failure'; end if; return new; end $$; create trigger synthetic_logbook_failure before insert on public.logbook_events for each row execute function public.synthetic_logbook_audit_failure()");
 await expect(verify(v)).rejects.toThrow(/Synthetic logbook audit failure/);expect(await act(I,'select * from public.attendance_logs')).toEqual([]);
 expect((await act(C,'select * from public.logbook_versions'))[0].status).toBe('Pending Review');
});
it('only abandoned unreferenced uploads can be removed; drafts freeze saved bytes',async()=>{
 await draft();const e=await page();await act(S,'select public.cancel_attendance_sheet($1)',[E]);
 expect(await act(S,"delete from storage.objects where bucket_id='attendance-evidence' and name=$1 returning *",[e.file_path])).toHaveLength(1);
 await page(uid(101));await draft(1,1,[uid(101)]);await expect(act(S,'select public.cancel_attendance_sheet($1)',[uid(101)])).rejects.toThrow(/preserved/);
 expect(await act(S,"delete from storage.objects where bucket_id='attendance-evidence' returning *")).toEqual([]);
});
it('same-company second Supervisor and unassigned/expired sessions cannot read or mutate another submission',async()=>{
 const v=await pending(),second=uid(7);await db.query('insert into auth.users(id,email) values($1,$2)',[second,'second-supervisor@example.invalid']);
 await act(A,'select public.admin_update_account($1,$2)',[second,{role:'supervisor',status:'Active',company_id:COMPANY}]);await act(A,'select public.admin_set_supervision($1,$2,true)',[second,I]);
 expect(await act(second,'select * from public.logbook_queue()')).toEqual([]);expect(await act(second,'select * from public.attendance_sheet_evidence where id=$1',[E])).toEqual([]);
 await expect(act(second,'select public.attendance_sheet_access($1)',[E])).rejects.toThrow(/Authorized/);await expect(verify(v,sessions,second)).rejects.toThrow(/Coordinator/);await expect(verify(v,sessions,I)).rejects.toThrow(/Coordinator/);await expect(verify(v,sessions,null)).rejects.toThrow(/permission denied/);
 await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,D,COMPANY]);await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[J,D,COMPANY]);await act(A,'select public.admin_update_account($1,$2)',[C,{status:'Inactive'}]);await expect(verify(v)).rejects.toThrow(/Coordinator/);
});
it('multiple evidence pages commit with the draft, reject forged files and enforce file/total limits',async()=>{
 await draft();await page();await page(uid(101));const [d]=await draft(1,1,[E,uid(101)]);expect(d.evidence_ids).toHaveLength(2);expect((await act(S,'select * from public.attendance_sheet_evidence')).every(e=>e.committed_at)).toBe(true);
 await expect(draft(1,d.revision,[E,E])).rejects.toThrow(/at most 10/);await expect(draft(1,d.revision,[uid(999)])).rejects.toThrow(/uploaded private/);
 const ids=[];for(let n=0;n<6;n++){const eid=uid(110+n);const [e]=await act(S,'select * from public.stage_logbook_evidence($1,$2,$3,$4,$5)',[eid,L,'large.pdf','application/pdf',10485760]);await act(S,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['attendance-evidence',e.file_path,{mimetype:'application/pdf',size:10485760}]);await act(S,'select public.finish_attendance_sheet($1)',[eid]);ids.push(eid);}
 await expect(draft(1,d.revision,ids)).rejects.toThrow(/50 MiB/);expect((await act(S,'select * from public.logbook_versions'))[0].evidence_ids).toEqual([E,uid(101)]);
});
it('expired reservations and mismatched Storage metadata cannot finalize or be committed',async()=>{
 await draft();const [e]=await act(S,'select * from public.stage_logbook_evidence($1,$2,$3,$4,$5)',[E,L,'signed.pdf','application/pdf',512]);
 await act(S,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['attendance-evidence',e.file_path,{mimetype:'image/png',size:512}]);await expect(act(S,'select public.finish_attendance_sheet($1)',[E])).rejects.toThrow(/validated/);
 // Simulate elapsed reservation time without mutating an immutable receipt identity.
 await db.query('alter table public.attendance_sheet_evidence disable trigger m17_sheet_history');await db.query("update public.attendance_sheet_evidence set expires_at=clock_timestamp()-interval '1 second' where id=$1",[E]);await db.query('alter table public.attendance_sheet_evidence enable trigger m17_sheet_history');
 await expect(act(S,'select public.finish_attendance_sheet($1)',[E])).rejects.toThrow(/expired/);expect(await act(S,"insert into storage.objects(bucket_id,name,metadata) values('attendance-evidence','sheets/forged.pdf','{}') returning *").catch(e=>e.message)).toMatch(/row-level security/);
});
it('ended-and-recreated supervision does not authorize an old unfinished upload or draft',async()=>{
 await draft();const [e]=await act(S,'select * from public.stage_logbook_evidence($1,$2,$3,$4,$5)',[E,L,'signed.pdf','application/pdf',512]);
 await act(A,'select public.admin_set_supervision($1,$2,false)',[S,I]);await act(A,'select public.admin_set_supervision($1,$2,true)',[S,I]);
 await expect(act(S,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['attendance-evidence',e.file_path,{mimetype:'application/pdf',size:512}])).rejects.toThrow(/row-level security/);
 await expect(draft(1,1)).rejects.toThrow(/assignment changed/);await expect(act(S,'select public.finish_attendance_sheet($1)',[E])).rejects.toThrow(/assignment/);
});
it('null expected revisions cannot bypass optimistic concurrency and submitted versions cannot be edited',async()=>{
 const v=await pending();await expect(draft(1,v.revision,[E],{remarks:'Silent replacement attempt'})).rejects.toThrow(/immutable/);
 await expect(act(C,'select public.return_logbook($1,$2,$3,$4)',[L,1,null,'Requesting a clearer signed image'])).rejects.toThrow(/changed/);
 await expect(act(A,'select public.admin_reroute_logbook($1,$2,$3,$4,$5)',[L,C,1,null,'Attempt to omit expected revision'])).rejects.toThrow(/Current unresolved/);
});
it('current private drafts after return stay hidden from Coordinator while prior submitted evidence remains readable',async()=>{
 const v=await pending();const [r]=await act(C,'select * from public.return_logbook($1,$2,$3,$4)',[L,1,v.revision,'Include the missing signature on the evidence.']);await draft(1,r.revision,[E],{remarks:'Private unsent Supervisor remarks'});
 expect((await act(C,'select * from public.logbook_versions')).every(v=>v.status!=='Draft')).toBe(true);expect((await act(C,'select * from public.logbook_events')).every(e=>e.event_kind!=='draft_saved')).toBe(true);expect(await act(C,'select * from public.logbook_queue()')).toEqual([]);
 await expect(act(C,'select public.attendance_sheet_access($1)',[E])).resolves.toHaveLength(1);
});
it('historical Coordinator manual records retain their own evidence, revision and explicit verification contracts',async()=>{
 // Trusted fixture creates the legacy row shape via retained implementation; API grants remain revoked.
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[C]);
 const [e]=(await db.query('select * from public.stage_attendance_sheet($1,$2,$3,$4,$5,$6)',[E,COMPANY,[I],'legacy.pdf','application/pdf',512])).rows;
 await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['attendance-evidence',e.file_path,{mimetype:'application/pdf',size:512}]);await act(C,'select public.finish_attendance_sheet($1)',[E]);
 const details={company_on_sheet:'Historical company',supervisor_on_sheet:'Historical paper Supervisor',fallback_reason:'system_unavailable',reason_explanation:'',remarks:'Legacy Coordinator encoding',signatures_reviewed:true};
 const [old]=(await db.query('select * from public.record_manual_attendance($1,$2,$3,$4,$5,$6)',[R,I,start,end,E,details])).rows;expect(old.logbook_submission_id).toBe(null);expect(old.verified).toBe(false);
 const [revised]=await act(C,'select * from public.revise_manual_attendance($1,$2,$3,$4,$5,$6,$7)',[R,1,start,'2026-01-02T09:00:00Z',E,details,'Corrected historical transcription from original evidence']);
 const [done]=await act(C,'select * from public.verify_manual_attendance($1,$2,$3,$4,$5,true)',[R,2,E,revised.clocked_in_at,revised.clocked_out_at]);expect(done.verified).toBe(true);expect(done.logbook_submission_id).toBe(null);
});
it('concurrent retries and competing reviewers serialize; online punches prevent an entire new batch',async()=>{
 const v=await pending();await db.query('commit');const one=await cluster.connect(),two=await cluster.connect();
 try{
  await one.query('begin');await two.query('begin');await verify(v,sessions,C,K,one);let completed=false;const same=verify(v,sessions,C,K,two).then(r=>{completed=true;return r;});await new Promise(r=>setTimeout(r,100));expect(completed).toBe(false);await one.query('commit');expect((await same)[0].status).toBe('Verified');await two.query('commit');
  await one.query('begin');await two.query('begin');await verify(v,sessions,C,K,one);const denied=expect(verify(v,sessions,C,uid(401),two)).rejects.toThrow(/already reviewed/);await one.query('commit');await denied;await two.query('rollback');
  expect((await db.query('select count(*)::int n from public.attendance_logs where logbook_submission_id=$1',[L])).rows[0].n).toBe(2);
  await db.query('begin');await act(S,'select public.save_logbook_draft($1,$2,$3,$4,$5,$6,1,0)',[uid(301),I,'2026-01-04','2026-01-04','Another signed logbook',[]]);await page(uid(101),uid(301));const [d]=await act(S,'select * from public.save_logbook_draft($1,$2,$3,$4,$5,$6,1,1)',[uid(301),I,'2026-01-04','2026-01-04','Another signed logbook',[uid(101)]]);const [next]=await act(S,'select * from public.submit_logbook($1,1,$2)',[uid(301),d.revision]);await db.query('commit');
  await one.query('begin');await two.query('begin');const [open]=await act(I,'select * from public.clock_in()',[],one);
  const blocked=expect(act(C,'select public.verify_record_logbook($1,1,$2,$3,$4,true)',[uid(301),next.revision,uid(402),JSON.stringify([{time_in:'2026-01-04T00:00:00Z',time_out:'2026-01-04T08:00:00Z'}])],two)).rejects.toThrow(/Open online/);
  await one.query('commit');await blocked;expect((await act(I,'select * from public.attendance_logs where id=$1',[open.id],two))[0].time_out).toBe(null);await two.query('rollback');
  expect((await db.query('select status from public.logbook_versions where submission_id=$1',[uid(301)])).rows[0].status).toBe('Pending Review');
 }finally{await one.end();await two.end();await db.query('begin');}
},20000);

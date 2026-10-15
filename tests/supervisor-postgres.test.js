import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,beforeEach,afterEach,it,expect } from 'vitest';
import { disposablePostgres } from './disposable-postgres';
const sql=f=>readFileSync(new URL(`../supabase/${f}`,import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),C=id(2),D=id(3),S=id(4),T=id(5),I=id(6),J=id(7),K=id(8),X=id(90),Y=id(91),E=id(100);
const ratings={punctuality:4,performance:5,conduct:3,communication:2};
let cluster,db;
async function act(actor,q,args=[]) {
  await db.query('savepoint action');
  try {await db.query(actor?'set local role authenticated':'set local role anon');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor||'']);const rows=(await db.query(q,args)).rows;
    await db.query('set constraints all immediate');await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub','',true)");await db.query('set constraints all deferred');await db.query('release savepoint action');return rows;
  } catch(e) {await db.query('rollback to savepoint action');await db.query('reset role');await db.query('release savepoint action');throw e;}
}
const source=(actor=S,intern=I,submit=true,version=0,criteria=ratings,key=E,feedback='PRIVATE SOURCE')=>act(actor,'select * from public.save_supervisor_evaluation($1,$2,$3,$4,$5,$6,$7)',[key,intern,'2026-10-14',JSON.stringify(criteria),feedback,version,submit]);
const review=(actor=C,publish=false,revision=0,criteria=ratings,reason='',summary='Clear student summary')=>act(actor,'select * from public.save_evaluation_review($1,$2,$3,$4,$5,$6,$7,$8,$9)',[E,revision,summary,'Strength','Improve','Guidance',criteria,reason,publish]);
beforeAll(async()=>{
  cluster=await disposablePostgres();db=await cluster.connect();await db.query(sql('tests/baseline.sql'));
  for(const f of ['M01_authority','M02_trusted_audit','M03_attendance_integrity','M04_private_documents_bucket','M06_rubric_hours','M07_account_lifecycle','M08_document_versions','M10_flexible_submissions','M11_admin_history','M12_handover_workflows','M13_coordinator_operations','M14_last_admin_protection','M15_supervisor_evaluations'])await db.query(sql(`migrations/${f}.sql`));
  for(const actor of [A,C,D,S,T,I,J,K])await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{\"role\":\"supervisor\",\"requested_role\":\"supervisor\"}')",[actor,`${actor}@example.invalid`]);
  await db.query("update public.profiles set role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end,status='Active'",[A,C,D]);
  await db.query('insert into public.companies(id,name) values($1,$2),($3,$4)',[X,'Company A',Y,'Company B']);
},60000);
afterAll(async()=>{if(cluster)await cluster.stop();},30000);
beforeEach(async()=>{
  await db.query('begin');
  for(const supervisor of [S,T])await act(A,'select public.admin_update_account($1,$2)',[supervisor,{role:'supervisor',company_id:X}]);
  for(const [intern,company] of [[I,X],[J,X],[K,Y]])await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[intern,C,company]);
  await act(A,'select public.admin_set_supervision($1,$2,true)',[S,I]);
});
afterEach(async()=>{await db.query('rollback');});
it('trusted provisioning, public metadata never promotes; last Admin protection retained',async()=>{
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(300),'pending@example.invalid',{role:'supervisor',requested_role:'admin'}]);
  expect((await db.query('select role,status from public.profiles where id=$1',[id(300)])).rows[0]).toEqual({role:'intern',status:'Pending'});
  await expect(act(A,'select public.admin_update_account($1,$2)',[A,{role:'supervisor',company_id:X}])).rejects.toThrow(/at least one Active Admin/);
  await expect(act(C,'select public.admin_update_account($1,$2)',[T,{role:'admin'}])).rejects.toThrow(/Active Admin/);
});
it('only explicitly assigned same-company active interns; no directory, attendance, documents or reports scope',async()=>{
  expect((await act(S,'select * from public.supervisor_roster()')).map(r=>r.id)).toEqual([I]);
  expect(await act(T,'select * from public.supervisor_roster()')).toEqual([]);
  for(const table of ['interns','attendance_logs','documents','evaluations','evaluation_reviews','announcements','audit_logs'])expect(await act(S,`select * from public.${table}`)).toEqual([]);
  expect((await act(S,'select id from public.profiles')).map(r=>r.id)).toEqual([S]);
  await expect(source(S,J)).rejects.toThrow(/assigned Intern/);await expect(source(S,K)).rejects.toThrow(/assigned Intern/);
  await expect(act(A,'select public.admin_set_supervision($1,$2,true)',[S,K])).rejects.toThrow(/same available company/);
  await expect(act(S,'select public.admin_set_supervision($1,$2,true)',[S,J])).rejects.toThrow(/Active Admin/);
});
it('draft privacy, optimistic version and missing eligible Coordinator handling',async()=>{
  const [draft]=await source(S,I,false,0,{});expect(draft.status).toBe('Supervisor Draft');expect(draft.overall_score).toBeNull();
  expect(await act(C,'select id from public.supervisor_evaluations')).toEqual([]);expect(await act(I,'select id from public.supervisor_evaluations')).toEqual([]);
  await expect(source(S,I,false,0)).rejects.toThrow(/version/);
  await act(A,'select public.admin_set_assignment($1,null,$2,null,8)',[I,X]);
  await expect(source(S,I,true,draft.version)).rejects.toThrow(/No eligible assigned OJT Coordinator/);
  expect((await db.query('select count(*)::int n from public.evaluation_reviews')).rows[0].n).toBe(0);
});
it('authoritative scoring, atomic submission, exact retries and immutable original',async()=>{
  const [s]=await source();expect(s).toMatchObject({supervisor_id:S,intern_id:I,company_id:X,coordinator_id:C,overall_score:75,status:'Submitted to Coordinator'});
  expect(s.submitted_at).toBeTruthy();expect((await source())[0].id).toBe(E);
  await expect(source(S,I,true,0,ratings,E,'Changed')).rejects.toThrow(/immutable/);
  await expect(source(T,I)).rejects.toThrow(/ownership/);
  await expect(act(S,'update public.supervisor_evaluations set feedback=$1 where id=$2',['Forged',E])).rejects.toThrow(/permission denied/);
  await db.query('savepoint immutable_probe');
  await expect(db.query('update public.supervisor_evaluations set feedback=$1 where id=$2',['Silent',E])).rejects.toThrow(/immutable/);
  await db.query('rollback to savepoint immutable_probe');
  expect((await db.query('select count(*)::int n from public.evaluation_reviews')).rows[0].n).toBe(1);
});
it('Coordinator scope, adjusted ratings reason, final-only student interface and retry publication',async()=>{
  await source();await expect(review(D)).rejects.toThrow(/Routed evaluation/);await expect(review(S)).rejects.toThrow(/Routed evaluation/);
  const changed={...ratings,punctuality:5};await expect(review(C,false,0,changed)).rejects.toThrow(/Explain changes/);
  const [draft]=await review(C,false,0,changed,'INTERNAL REASON');expect(draft.status).toBe('Coordinator Draft');
  expect(await act(I,'select * from public.evaluations')).toEqual([]);expect(await act(I,'select * from public.evaluation_reviews')).toEqual([]);
  const [published]=await review(C,true,draft.revision,changed,'INTERNAL REASON');expect(published.status).toBe('Published to Intern');
  const [final]=await act(I,'select * from public.evaluations');expect(final).toMatchObject({overall_score:'80',source_evaluation_id:E,source_version:2,feedback:'Clear student summary',provenance:'supervisor_review'});
  expect(JSON.stringify(final)).not.toMatch(/PRIVATE SOURCE|INTERNAL REASON/);expect(await act(J,'select * from public.evaluations')).toEqual([]);
  expect(await act(I,'select * from public.supervisor_evaluations')).toEqual([]);
  expect((await review(C,true,draft.revision,changed,'INTERNAL REASON'))[0].final_evaluation_id).toBe(final.id);
  await expect(review(C,true,published.revision,ratings,'','Changed')).rejects.toThrow(/immutable/);
  expect((await db.query('select count(*)::int n from public.evaluations')).rows[0].n).toBe(1);
});
it('assignment/company lifecycle preserves provenance, blocks incompatible changes and explicitly reroutes',async()=>{
  await source();await review();
  for(const patch of [{role:'intern'},{status:'Inactive'},{company_id:Y}])await expect(act(A,'select public.admin_update_account($1,$2)',[S,patch])).rejects.toThrow(/End affected/);
  await expect(act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,C,Y])).rejects.toThrow(/End affected/);
  await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,D,X]);
  expect(await act(C,'select id from public.supervisor_evaluations')).toEqual([]);expect(await act(D,'select id from public.supervisor_evaluations')).toEqual([]);
  await expect(review(C,true,1)).rejects.toThrow(/Routed evaluation/);
  const [r]=await act(A,'select * from public.admin_reroute_evaluation($1,$2,$3,$4)',[E,D,'Explicit handover',1]);expect(r).toMatchObject({summary:'',coordinator_id:D,status:'Submitted to Coordinator',revision:2});
  expect((await act(D,'select coordinator_id from public.supervisor_evaluations'))[0].coordinator_id).toBe(C);
  expect((await act(A,'select reason from public.evaluation_routing_events'))[0].reason).toBe('Explicit handover');
  await act(A,'select public.admin_set_supervision($1,$2,false)',[S,I]);
  await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,D,Y]);
  await expect(review(D,true,2)).rejects.toThrow(/Routed evaluation/);
  expect((await act(S,'select company_id from public.supervisor_evaluations'))[0].company_id).toBe(X);
  expect((await db.query('select ended_at from public.supervisor_assignments')).rows[0].ended_at).toBeTruthy();
});
it('retired mutations denied, historical corrections unchanged, legacy evaluations remain readable',async()=>{
  await db.query("insert into public.attendance_exceptions(id,intern_id,log_date,claimed_time_in,claimed_time_out,claimed_end_date,reason,status) values($1,$2,'2020-01-01','08:00','09:00','2020-01-01','Historical request','Pending')",[id(400),I]);
  const historical=(await db.query('select * from public.attendance_exceptions')).rows;
  await db.query("insert into public.evaluations(intern_id,evaluator_id,competencies,overall_score,feedback) values($1,$2,$3,75,'Legacy')",[I,C,ratings]);
  expect((await act(I,'select provenance from public.evaluations'))[0].provenance).toBe('legacy_coordinator');
  for(const actor of [null,A,C,I,S]) {
    await expect(act(actor,"select public.submit_correction('2026-10-13','08:00','09:00','2026-10-13','Retired')")).rejects.toThrow(/permission denied/);
    await expect(act(actor,"select public.review_exception($1,'Approved',null)",[id(400)])).rejects.toThrow(/permission denied/);
    await expect(act(actor,"select public.review_exceptions(array[$1]::uuid[],'Approved',null)",[id(400)])).rejects.toThrow(/permission denied/);
    await expect(act(actor,'select public.submit_evaluation($1,$2,$3,$4)',[I,ratings,'Old client',id(401)])).rejects.toThrow(/permission denied/);
  }
  expect((await db.query("select to_regclass('public.attendance_exceptions') historical,to_regprocedure('public.correction_instants(date,time,time,date)') validator")).rows[0].historical).toBeTruthy();
  expect((await db.query('select * from public.attendance_exceptions')).rows).toEqual(historical);
  expect((await act(I,'select id from public.attendance_exceptions'))[0].id).toBe(id(400));
});
it('inactive accounts, anonymous operations, forged identities and invalid ratings fail closed',async()=>{
  await expect(source(null)).rejects.toThrow(/permission denied/);
  await expect(source(C)).rejects.toThrow(/Active Supervisor/);
  await expect(source(S,I,true,0,{...ratings,conduct:6})).rejects.toThrow(/ratings/);
  await expect(source(S,I,false,0,{punctuality:0})).rejects.toThrow(/ratings/);
  await expect(source(S,I,false,0,{forged:5})).rejects.toThrow(/criteria/);
  await expect(source(S,I,false,0,[])).rejects.toThrow(/object/);
  await expect(source(S,I,false,null)).rejects.toThrow(/version zero/);
  await act(A,'select public.admin_set_supervision($1,$2,false)',[S,I]);
  await act(A,'select public.admin_update_account($1,$2)',[S,{status:'Inactive'}]);
  expect(await act(S,'select * from public.supervisor_roster()')).toEqual([]);
  expect((await act(S,'select public.my_profile() p'))[0].p).toEqual({id:S,status:'Inactive'});
  await expect(source()).rejects.toThrow(/Active Supervisor/);
});
it('audit faults roll back source submission and publication atomically',async()=>{
  await db.query("create function public.synthetic_audit_failure() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit unavailable'; end $$; create trigger fixture_fault before insert on public.audit_logs for each row execute function public.synthetic_audit_failure()");
  await expect(source()).rejects.toThrow(/Synthetic audit/);
  expect((await db.query('select count(*)::int n from public.supervisor_evaluations')).rows[0].n).toBe(0);
  expect((await db.query('select count(*)::int n from public.evaluation_reviews')).rows[0].n).toBe(0);
  await db.query('drop trigger fixture_fault on public.audit_logs');await source();
  await db.query('create trigger fixture_fault before insert on public.audit_logs for each row execute function public.synthetic_audit_failure()');
  await expect(review(C,true)).rejects.toThrow(/Synthetic audit/);
  expect((await db.query('select count(*)::int n from public.evaluations')).rows[0].n).toBe(0);
  expect((await db.query('select status from public.evaluation_reviews')).rows[0].status).toBe('Submitted to Coordinator');
});
it('clocking, accomplishments, authorized closed verification and DTR reads remain available',async()=>{
  const [open]=await act(I,'select * from public.clock_in()');
  const [closed]=await act(I,'select * from public.clock_out($1,$2)',[open.id,'Completed fixture work']);
  const instant=(await db.query('select clocked_in_at::text start,clocked_out_at::text finish from public.attendance_logs where id=$1',[closed.id])).rows[0];
  expect(closed.verified).toBe(false);expect(closed.accomplishment).toBe('Completed fixture work');
  await expect(act(S,'select public.verify_attendance($1,$2,$3)',[closed.id,instant.start,instant.finish])).rejects.toThrow(/not permitted|assigned|staff|review/i);
  const [verified]=await act(C,'select * from public.verify_attendance($1,$2,$3)',[closed.id,instant.start,instant.finish]);
  expect(verified.verified).toBe(true);expect(verified.verified_by).toBe(C);
  expect((await act(I,'select * from public.attendance_logs'))[0].id).toBe(open.id);
  expect(await act(J,'select * from public.attendance_logs')).toEqual([]);
});
it('new functions use trusted owners, fixed search paths, controlled grants and restrictive private RLS',async()=>{
  const rows=(await db.query("select proname,pg_get_userbyid(proowner) owner,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon from pg_proc where proname in ('save_supervisor_evaluation','save_evaluation_review','admin_reroute_evaluation','supervisor_roster','admin_set_supervision')")).rows;
  expect(rows).toHaveLength(5);for(const r of rows){expect(r.owner).toBe('postgres');expect(r.anon).toBe(false);expect(r.proconfig).toEqual(['search_path=pg_catalog, public']);}
  await source();await db.query('create policy synthetic_or on public.supervisor_evaluations for select to authenticated using(true); create policy synthetic_or on public.evaluation_reviews for select to authenticated using(true)');
  expect(await act(I,'select * from public.supervisor_evaluations')).toEqual([]);expect(await act(I,'select * from public.evaluation_reviews')).toEqual([]);
});
it('old destructive cleanup and retired-demo tools reject the new schema without deleting history',async()=>{
  await source();const before=(await db.query('select * from public.supervisor_evaluations')).rows;
  for(const file of ['INSync_Clear_Operational_Data.sql','demo/demo_data_seed.sql','demo/demo_data_cleanup.sql']) {
    await db.query('savepoint obsolete_tool');
    await expect(db.query(sql(file).replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,''))).rejects.toThrow(/unsupported after M15/);
    await db.query('rollback to savepoint obsolete_tool');
  }
  expect((await db.query('select * from public.supervisor_evaluations')).rows).toEqual(before);
});
it('separate-connection overlapping submission and publication commit only once',async()=>{
  // This final case commits synthetic fixtures ONLY in our disposable loopback cluster.
  await db.query('commit');
  const one=await cluster.connect(),two=await cluster.connect();
  async function start(client,actor){await client.query('begin');await client.query('set local role authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);}
  await start(one,S);await start(two,S);
  const query='select * from public.save_supervisor_evaluation($1,$2,$3,$4,$5,0,true)',args=[E,I,'2026-10-14',ratings,'PRIVATE SOURCE'];
  const first=(await one.query(query,args)).rows[0];let done=false;
  const second=two.query(query,args).then(r=>{done=true;return r.rows[0];});
  await new Promise(resolve=>setTimeout(resolve,100));expect(done).toBe(false);await one.query('commit');expect((await second).id).toBe(first.id);await two.query('commit');
  await start(one,C);await start(two,C);
  const publish='select * from public.save_evaluation_review($1,0,$2,$3,$4,$5,$6,$7,true)',fields=[E,'Summary','Strength','Improve','Guidance',ratings,''];
  const published=(await one.query(publish,fields)).rows[0];done=false;
  const retry=two.query(publish,fields).then(r=>{done=true;return r.rows[0];});await new Promise(resolve=>setTimeout(resolve,100));expect(done).toBe(false);
  await one.query('commit');expect((await retry).final_evaluation_id).toBe(published.final_evaluation_id);await two.query('commit');
  expect((await db.query('select count(*)::int n from public.evaluations')).rows[0].n).toBe(1);
});

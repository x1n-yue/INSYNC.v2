import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,beforeEach,afterEach,describe,it,expect} from 'vitest';
import {disposablePostgres} from './disposable-postgres';
const sql=f=>readFileSync(new URL(`../supabase/${f}`,import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),IA=id(2),IB=id(3),SA=id(4),SB=id(5),P=id(6);
let cluster,db;
async function act(actor,query,args=[]) {
  await db.query('savepoint operation');
  try {
    await db.query(actor?'set local role authenticated':'set local role anon');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor||'']);
    const result=(await db.query(query,args)).rows;
    await db.query('set constraints all immediate');await db.query('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',true)");
    await db.query('set constraints all deferred');await db.query('release savepoint operation');return result;
  }catch(e){await db.query('rollback to savepoint operation');await db.query('reset role');await db.query('release savepoint operation');throw e;}
}
const send=(actor=IA,target=SA,request=id(100),title='Fixture announcement')=>act(actor,'select * from public.send_announcement($1,$2,$3,$4)',[request,title,'No real recipients',target]);
const counts=async()=> (await db.query('select (select count(*) from public.announcements)::int announcements,(select count(*) from public.audit_logs)::int audits')).rows;
beforeAll(async()=>{
  cluster=await disposablePostgres();db=await cluster.connect();await db.query(sql('tests/baseline.sql'));
  for(const f of ['M01_authority.sql','M02_trusted_audit.sql','M03_attendance_integrity.sql','M04_private_documents_bucket.sql','M06_rubric_hours.sql','M07_account_lifecycle.sql','M08_document_versions.sql','M10_flexible_submissions.sql','M11_admin_history.sql'])await db.query(sql(`migrations/${f}`));
  expect((await db.query("select to_regprocedure('public.verify_attendance(uuid,timestamptz,timestamptz)') installed")).rows[0].installed).toBeNull();
  // Reproduce the reported missing table grant before the focused repair.
  await db.query('revoke select,insert on public.announcements from authenticated');
  await db.query(sql('migrations/M13_coordinator_operations.sql'));
  await db.query(sql('migrations/M13_coordinator_operations.sql'));
  for(const actor of [A,IA,IB,SA,SB,P])await db.query('insert into auth.users(id,email) values($1,$2)',[actor,`${actor}@example.invalid`]);
  await db.query("update public.profiles set role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end,status=case when id=$4 then 'Pending' else 'Active' end",[A,IA,IB,P]);
},60000);
afterAll(async()=>{if(cluster)await cluster.stop();},30000);
beforeEach(async()=>{
  await db.query('begin');
  await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SA,IA]);
  await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SB,IB]);
  await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[P,IA]);
});
afterEach(async()=>{await db.query('rollback');});
describe('M13 controlled Coordinator operations, native isolated PostgreSQL',()=>{
  it('repairs exact RPC contracts/grants while denying raw announcement writes and anonymous calls',async()=>{
    const rows=(await db.query(`select proname,proargnames,prosecdef,proconfig,
      has_function_privilege('authenticated',p.oid,'EXECUTE') auth,has_function_privilege('anon',p.oid,'EXECUTE') anon
      from pg_proc p where p.oid in ('public.send_announcement(uuid,text,text,uuid)'::regprocedure,'public.verify_attendance(uuid,timestamptz,timestamptz)'::regprocedure)`)).rows;
    expect(rows).toHaveLength(2);for(const r of rows){expect(r).toMatchObject({prosecdef:true,auth:true,anon:false});expect(r.proconfig).toEqual(['search_path=pg_catalog, public']);}
    expect(rows.find(r=>r.proname==='verify_attendance').proargnames).toEqual(['p_id','p_expected_in','p_expected_out']);
    await expect(act(IA,"insert into public.announcements(instructor_id,title,body,target,target_intern_id) values($1,'Bypass','No','Personal',$2)",[IA,SA])).rejects.toThrow(/permission denied/);
    await expect(send(null)).rejects.toThrow(/permission denied/);
  });
  it('freezes an assigned individual, shows sender history and recipient visibility after reassignment',async()=>{
    const [row]=await send();expect(row.recipient_ids).toEqual([SA]);
    expect(await act(IA,'select id from public.announcements')).toEqual([{id:row.id}]);
    expect(await act(SA,'select id from public.announcements')).toEqual([{id:row.id}]);
    expect(await act(SB,'select id from public.announcements')).toEqual([]);
    expect(await act(IB,'select id from public.announcements')).toEqual([]);
    await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SA,IB]);
    expect((await act(SA,'select recipient_ids from public.announcements'))[0].recipient_ids).toEqual([SA]);
    const before=await counts();expect((await send())[0].id).toBe(row.id);expect(await counts()).toEqual(before);
  });
  it('roster sends target only assigned Active Interns; retries keep the original audience',async()=>{
    const [row]=await send(IA,null);expect(row.recipient_ids).toEqual([SA]);
    await act(A,"select public.admin_update_account($1,'{\"status\":\"Active\"}')",[P]);
    expect((await send(IA,null))[0].recipient_ids).toEqual([SA]);
    expect((await send(IA,null,id(101)))[0].recipient_ids.sort()).toEqual([SA,P].sort());
  });
  it.each([[IA,SB],[IA,P],[IB,SA],[SA,SA],[P,SA]])('denies author %s / recipient %s without partial records',async(actor,target)=>{
    const before=await counts();await expect(send(actor,target)).rejects.toMatchObject({code:'42501'});expect(await counts()).toEqual(before);
  });
  it('denies suspended authors, empty assigned rosters, and altered retry content',async()=>{
    await send();const before=await counts();await expect(send(IA,SA,id(100),'Different')).rejects.toMatchObject({code:'40001'});expect(await counts()).toEqual(before);
    await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SA,IB]);
    await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[P,IB]);
    await expect(send(IA,null,id(102))).rejects.toMatchObject({code:'42501'});
    await act(A,"select public.admin_update_account($1,'{\"status\":\"Inactive\"}')",[IA]);
    await expect(send()).rejects.toMatchObject({code:'42501'});
  });
  it('executes the read-only operator verification without touching historical data',async()=>{
    await send();const before=await counts();
    // Inspection owns a top-level read-only transaction; avoid nesting BEGIN
    // inside this test's historical fixture transaction.
    const inspection=sql('inspection/06_coordinator_operations.sql').replace('BEGIN READ ONLY;','').replace('ROLLBACK;','');
    const results=await db.query(inspection);
    expect(results.find(r=>r.fields.some(f=>f.name==='signature')).rows.every(r=>r.installed)).toBe(true);
    expect(results.find(r=>r.fields.some(f=>f.name==='authenticated_insert')).rows.find(r=>r.table_name==='announcements'))
      .toMatchObject({rls_enabled:true,authenticated_select:true,authenticated_insert:false,authenticated_update:false,authenticated_delete:false});
    expect(await counts()).toEqual(before);
  });
  it('rolls back announcement, audience and audit if mandatory auditing fails',async()=>{
    await db.query(`create function public.fixture_audit_failure() returns trigger language plpgsql as $$begin raise exception 'Fixture audit unavailable'; end$$;
      create trigger z_fixture_failure after insert on public.announcements for each row execute function public.fixture_audit_failure()`);
    const before=await counts();await expect(send()).rejects.toThrow('Fixture audit unavailable');expect(await counts()).toEqual(before);
  });
  it('detects audience trigger drift and rolls back the whole operation',async()=>{
    await db.query(`create function public.fixture_audience_drift() returns trigger language plpgsql as $$begin new.recipient_ids:=array['${SB}'::uuid];return new;end$$;
      create trigger z_fixture_audience before insert on public.announcements for each row execute function public.fixture_audience_drift()`);
    const before=await counts();await expect(send()).rejects.toThrow('audience/content changed');expect(await counts()).toEqual(before);
  });
  it('verifies genuine closed evidence idempotently without changing timestamps or hours',async()=>{
    const row=(await db.query(`insert into public.attendance_logs(intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified)
      values($1,'2026-10-01','08:00','08:00:01','2026-10-01T00:00:00Z','2026-10-01T00:00:01Z',1::numeric/3600,false) returning *`,[SA])).rows[0];
    const args=[row.id,row.clocked_in_at,row.clocked_out_at],query='select * from public.verify_attendance($1,$2,$3)';
    await expect(act(IB,query,args)).rejects.toMatchObject({code:'42501'});
    await expect(act(IA,query,[row.id,row.clocked_in_at,'2026-10-01T00:00:02Z'])).rejects.toMatchObject({code:'40001'});
    expect((await db.query('select verified from public.attendance_logs where id=$1',[row.id])).rows[0].verified).toBe(false);
    const [r]=await act(IA,query,args);expect(r).toMatchObject({verified:true,verified_by:IA,hours:row.hours});
    const before=await counts();expect((await act(IA,query,args))[0].hours).toBe(row.hours);expect(await counts()).toEqual(before);
  });
  it('rejects open and invalid historical evidence without changes',async()=>{
    await db.query(`insert into public.attendance_logs(id,intern_id,log_date,time_in,clocked_in_at,verified)
      values($1,$2,'2026-10-01','08:00','2026-10-01T00:00:00Z',false)`,[id(90),SA]);
    const before=(await db.query('select to_jsonb(t) row from public.attendance_logs t')).rows;
    await expect(act(IA,'select * from public.verify_attendance($1,$2,$3)',[id(90),'2026-10-01T00:00:00Z',null])).rejects.toMatchObject({code:'40001'});
    // Deliberately invalid legacy fixture: not a live-data correction.
    await db.query('alter table public.attendance_logs drop constraint m03_attendance_interval');
    await db.query("update public.attendance_logs set time_out='09:00',clocked_out_at='2026-10-01T01:00:00Z',hours=99 where id=$1",[id(90)]);
    const invalid=(await db.query('select to_jsonb(t) row from public.attendance_logs t')).rows;
    await expect(act(IA,'select * from public.verify_attendance($1,$2,$3)',[id(90),'2026-10-01T00:00:00Z','2026-10-01T01:00:00Z'])).rejects.toThrow(/trustworthy/);
    expect((await db.query('select to_jsonb(t) row from public.attendance_logs t')).rows).toEqual(invalid);expect(before[0].row.verified).toBe(false);
  });
});

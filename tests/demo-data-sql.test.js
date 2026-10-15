// No environment files, credentials or Supabase connection. OWN native fixture only.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { installLegacyM14 } from './legacy-install';
import { disposablePostgres } from './disposable-postgres';

const sql = f => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
const content = f => sql(`demo/${f}`).replace(/^BEGIN(?: READ ONLY)?;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
const approved = text => text.replace("confirmed_project_ref='CHECK_NEW_PROJECT_BANNER_FIRST'", "confirmed_project_ref='tcntyrwwqzyyqlzdtuer'");
const seed = approved(content('demo_data_seed.sql'));
const cleanup = approved(content('demo_data_cleanup.sql'));
const verify = content('demo_data_verify.sql');
const prefix = 'de600001-2026-4000-8000-';
const demoId = n => `${prefix}${String(n).padStart(12,'0')}`;
// Random stand-in account UUIDs prove scripts resolve provided emails, not fixture IDs.
const A = randomUUID(), C = randomUUID(), I = randomUUID();
const COMPANY = randomUUID(), SECTION = randomUUID();
let cluster, db;

async function fixture(client) {
  await client.query(sql('tests/baseline.sql').split('create table public.companies')[0]);
  await client.query(`alter table auth.users add column deleted_at timestamptz,add column email_confirmed_at timestamptz;
    update storage.buckets set file_size_limit=10485760,allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'] where id='documents';
    grant select,insert,delete on storage.objects to authenticated;`);
  await installLegacyM14(client,{initial:true});
  for (const [id,email] of [[A,'fangonbernstain566@gmail.com'],[C,'mangokamen1@gmail.com'],[I,'hhimii.mu@gmail.com']]) {
    await client.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id,email]);
  }
  // Trusted local fixture bootstrap only, never included in delivered demo scripts.
  await client.query("update public.profiles set role=case when id=$1 then 'admin' when id=$2 then 'instructor' else 'intern' end,status='Active'", [A,C]);
  await client.query("insert into public.companies(id,name) values($1,'Disposable fixture company')", [COMPANY]);
  await client.query("insert into public.course_sections(id,name) values($1,'Disposable fixture section')", [SECTION]);
  await client.query('begin');
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [A]);
  await client.query('select public.admin_set_assignment($1,$2,$3,$4,486)', [I,C,COMPANY,SECTION]);
  await client.query("select set_config('request.jwt.claim.sub','',true)");
  await client.query('commit');
}
async function asActor(actor, statement, args=[]) {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
  try { return await db.query(statement,args); }
  finally { await db.query("select set_config('request.jwt.claim.sub','',true)"); }
}
async function expectFailure(statement, message) {
  await db.query('savepoint attempted');
  await expect(db.query(statement)).rejects.toThrow(message);
  await db.query('rollback to savepoint attempted');
}
async function authenticated(actor, statement, args=[]) {
  await db.query('savepoint api');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    const result = await db.query(statement,args);
    await db.query('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',true)");
    await db.query('release savepoint api');
    return result;
  } catch (error) {
    await db.query('rollback to savepoint api');
    await db.query('release savepoint api');
    throw error;
  }
}
async function counts(client=db) {
  const tables=['attendance_logs','attendance_exceptions','documents','evaluations','announcements','audit_logs'];
  const result={};
  for(const table of tables)result[table]=(await client.query(`select count(*)::int n from public.${table}`)).rows[0].n;
  return result;
}
async function identitySnapshot() {
  return (await db.query(`select
    (select jsonb_agg(to_jsonb(x) order by x.id) from auth.users x) users,
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.profiles x) profiles,
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.interns x) assignments`)).rows;
}
beforeAll(async()=>{ cluster=await disposablePostgres(); db=await cluster.connect(); await fixture(db); },60000);
afterAll(async()=>{ if(cluster)await cluster.stop(); },30000);
beforeEach(async()=>{ await db.query("begin; set local timezone='UTC'"); });
afterEach(async()=>{ await db.query('rollback'); });

describe('historical demo SQL on M14 native PostgreSQL schema',()=>{
  it('seeds valid weekday evidence, pending checklist, server-scored evaluation and frozen recipients without account/Storage changes',async()=>{
    const before=await identitySnapshot();
    await db.query(seed);
    expect(await identitySnapshot()).toEqual(before);
    const logs=(await db.query('select * from public.attendance_logs order by id')).rows;
    expect(logs).toHaveLength(6);
    expect(logs.filter(a=>a.verified)).toHaveLength(4);
    expect(logs.every(a=>a.intern_id===I && (a.verified?a.verified_by===C:a.verified_by===null))).toBe(true);
    const [hours]=(await db.query(`select sum(hours)::numeric logged,sum(hours) filter(where verified)::numeric verified,
      bool_and(log_date=(clocked_in_at at time zone 'Asia/Manila')::date
       and time_in=(clocked_in_at at time zone 'Asia/Manila')::time
       and time_out=(clocked_out_at at time zone 'Asia/Manila')::time
       and hours=extract(epoch from clocked_out_at-clocked_in_at)/3600
       and clocked_out_at-clocked_in_at<=interval '16 hours'
       and log_date<(clock_timestamp() at time zone 'Asia/Manila')::date
       and extract(isodow from log_date) between 1 and 5) valid from public.attendance_logs`)).rows;
    expect(hours).toEqual({logged:'45.0000000000000000',verified:'30.0000000000000000',valid:true});
    const corrections=(await db.query(`select e.* from public.attendance_exceptions e
      where not exists(select 1 from public.attendance_logs a where a.intern_id=e.intern_id and a.log_date=e.log_date)`)).rows;
    expect(corrections).toHaveLength(1);expect(corrections[0]).toMatchObject({status:'Pending',reviewed_by:null,review_note:null});
    const docs=(await db.query('select * from public.documents')).rows;
    expect(docs).toHaveLength(5);expect(docs.every(d=>d.status==='Pending'&&d.file_path===null&&d.file_name===null&&d.upload_version==='0')).toBe(true);
    expect((await db.query('select overall_score,submission_id,evaluator_id from public.evaluations')).rows[0])
      .toEqual({overall_score:'84',submission_id:demoId(402),evaluator_id:C});
    const anns=(await db.query('select instructor_id,recipient_ids from public.announcements')).rows;
    expect(anns).toHaveLength(2);expect(anns.every(a=>a.instructor_id===C&&JSON.stringify(a.recipient_ids)===JSON.stringify([I]))).toBe(true);
    expect((await db.query('select auth.uid() id')).rows[0].id).toBeNull();
    for(const table of ['storage.objects','public.document_versions','public.document_review_events','public.submissions','public.submission_files','public.alerts'])
      expect((await db.query(`select count(*)::int n from ${table}`)).rows[0].n).toBe(0);
    const audit=(await db.query(`select event_data->>'table' tab,actor_id,event_data->>'context' context
      from public.audit_logs where event_data->>'record_id' like $1`,[`${prefix}%`])).rows;
    expect(audit).toHaveLength(15);
    expect(audit.filter(x=>x.tab==='announcements').every(x=>x.actor_id===C&&x.context==='authenticated')).toBe(true);
    expect(audit.filter(x=>x.tab!=='announcements').every(x=>x.actor_id===null&&x.context==='system-or-sql')).toBe(true);
    const report=await db.query(verify);
    const summary=JSON.parse(report.find(x=>x.rows?.[0]?.demo_summary).rows[0].demo_summary);
    expect(summary.demo_hours).toEqual({logged:45,verified:30,unverified:15});
    expect(summary.seeded_counts.requirement.present).toBe(5);expect(summary.retained_trusted_audit_events).toBe(15);
  });

  it('refuses second application without any further writes',async()=>{
    await db.query(seed);const before=await counts();
    await expectFailure(seed,/already applied|collision/);expect(await counts()).toEqual(before);
  });
  it('supports all three authenticated roles and removes Coordinator evidence access after reassignment while preserving message recipients',async()=>{
    await db.query(seed);
    for (const actor of [A,C,I]) {
      expect((await authenticated(actor,'select count(*)::int n from public.attendance_logs')).rows[0].n).toBe(6);
      expect((await authenticated(actor,'select count(*)::int n from public.documents')).rows[0].n).toBe(5);
      expect((await authenticated(actor,'select count(*)::int n from public.evaluations')).rows[0].n).toBe(1);
      expect((await authenticated(actor,'select count(*)::int n from public.announcements')).rows[0].n).toBe(2);
    }
    await authenticated(A,'select public.admin_set_assignment($1,null,$2,$3,486)',[I,COMPANY,SECTION]);
    for (const table of ['attendance_logs','documents','evaluations'])
      expect((await authenticated(C,`select count(*)::int n from public.${table}`)).rows[0].n).toBe(0);
    expect((await authenticated(I,'select count(*)::int n from public.announcements')).rows[0].n).toBe(2);
    expect((await authenticated(C,'select count(*)::int n from public.announcements')).rows[0].n).toBe(2);
  });
  it('requires explicit new-project operator attestation',async()=>{
    const before=await counts();await expectFailure(content('demo_data_seed.sql'),/Verify the NEW SQL Editor project/);
    expect(await counts()).toEqual(before);
  });
  it('refuses non-postgres operators',async()=>{
    await db.query('savepoint role_test');await db.query('set local role authenticated');
    await expect(db.query(seed)).rejects.toThrow(/trusted postgres/);
    await db.query('rollback to savepoint role_test');
  });
  it.each([A,C,I])('refuses an unconfirmed account (%s)',async actor=>{
    await db.query('update auth.users set email_confirmed_at=null where id=$1',[actor]);
    const before=await counts();await expectFailure(seed,/exactly one confirmed/);expect(await counts()).toEqual(before);
  });
  it('refuses inactive Intern and wrong Coordinator role',async()=>{
    await db.query("update public.profiles set status='Inactive' where id=$1",[I]);
    await expectFailure(seed,/intern \/ Active/);
    await db.query("update public.profiles set status='Active' where id=$1",[I]);
    await db.query("update public.profiles set role='intern' where id=$1",[C]);
    await expectFailure(seed,/instructor \/ Active/);
  });
  it('refuses missing accounts without provisioning replacements',async()=>{
    await db.query("update auth.users set email='fixture-changed@example.invalid' where id=$1",[C]);
    const before=await identitySnapshot();await expectFailure(seed,/exactly one confirmed/);expect(await identitySnapshot()).toEqual(before);
  });
  it.each(['instructor_id','company_id','section_id'])('requires the saved %s assignment',async column=>{
    await db.query(`update public.interns set ${column}=null where id=$1`,[I]);
    const before=await identitySnapshot();await expectFailure(seed,/Admin UI first/);expect(await identitySnapshot()).toEqual(before);
  });
  it('refuses a target reached by the demo hours, leaving the target unchanged',async()=>{
    await db.query('update public.interns set required_hours=30 where id=$1',[I]);
    await expectFailure(seed,/must stay below saved target/);
    expect((await db.query('select required_hours from public.interns where id=$1',[I])).rows[0].required_hours).toBe('30');
  });
  it('refuses an existing open session instead of inventing closed/verified evidence',async()=>{
    await authenticated(I,'select public.clock_in()');
    const before=await counts();await expectFailure(seed,/open or unknown attendance/);expect(await counts()).toEqual(before);
  });
  it('skips occupied dates and retains pre-existing requirements unchanged',async()=>{
    await asActor(A,'select public.attach_standard_docs($1)',[I]);
    const original=(await db.query('select * from public.documents order by id')).rows;
    const id=randomUUID();
    await db.query(`with d as (select (clock_timestamp() at time zone 'Asia/Manila')::date-n AS business_day from generate_series(1,7) n
      where extract(isodow from (clock_timestamp() at time zone 'Asia/Manila')::date-n) between 1 and 5 order by n limit 1),
      ts as (select (business_day+time '08:30') at time zone 'Asia/Manila' started from d)
      insert into public.attendance_logs(id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,verified_by)
      select $1,$2,(started at time zone 'Asia/Manila')::date,'08:30','16:00',started,started+interval '7.5 hours',7.5,true,$3 from ts`,[id,I,C]);
    await db.query(seed);
    expect((await db.query('select * from public.documents where id<>$1 order by id',[demoId(305)])).rows).toEqual(original);
    const [n]=(await db.query('select count(*)::int n,sum(hours) filter(where verified)::numeric verified from public.attendance_logs')).rows;
    expect(n).toMatchObject({n:7,verified:'37.5000000000000000'});
    await db.query(cleanup);
    expect((await db.query('select * from public.documents order by id')).rows).toEqual(original);
    expect((await db.query('select id from public.attendance_logs')).rows).toEqual([{id}]);
  });
  it('rolls back every demo insert if announcement auditing fails late',async()=>{
    await db.query(`create function public.test_demo_fault() returns trigger language plpgsql as $$begin raise exception 'Synthetic announcement failure'; end$$;
      create trigger z_test_demo_fault after insert on public.announcements for each row execute function public.test_demo_fault()`);
    const before=await counts();await expectFailure(seed,/Synthetic announcement failure/);expect(await counts()).toEqual(before);
    expect((await db.query('select auth.uid() id')).rows[0].id).toBeNull();
  });
  it('cleans only exact tagged rows, retains audits/accounts, and cleanup is a repeat-safe no-op',async()=>{
    await db.query(seed);const before=await identitySnapshot();const audits=(await counts()).audit_logs;
    await db.query(cleanup);expect(await identitySnapshot()).toEqual(before);
    const after=await counts();expect(after).toEqual({attendance_logs:0,attendance_exceptions:0,documents:0,evaluations:0,announcements:0,audit_logs:audits+15});
    await db.query(cleanup);expect(await counts()).toEqual(after);
    await expectFailure(seed,/already applied/);expect(await counts()).toEqual(after);
  });
  it('refuses cleanup after a real upload reservation, retaining all records',async()=>{
    await db.query(seed);
    await asActor(I,"select public.stage_document_upload($1,'Evidence.pdf','application/pdf',20,0)",[demoId(301)]);
    const before=await counts();await expectFailure(cleanup,/file\/reservation\/review evidence/);expect(await counts()).toEqual(before);
    expect((await db.query('select count(*)::int n from public.document_versions')).rows[0].n).toBe(1);
  });
  it('refuses changed tagging instead of guessing cleanup ownership',async()=>{
    await db.query(seed);await db.query("update public.evaluations set feedback='Changed outside seed' where id=$1",[demoId(401)]);
    const before=await counts();await expectFailure(cleanup,/provenance\/owner\/tag mismatch/);expect(await counts()).toEqual(before);
  });
  it('retains newly generated attendance after live-style correction approval',async()=>{
    await db.query(seed);await asActor(C,"select public.review_exception($1,'Approved',null)",[demoId(201)]);
    const generated=(await db.query('select id from public.attendance_logs where id::text not like $1',[`${prefix}%`])).rows;
    expect(generated).toHaveLength(1);
    await db.query(cleanup);
    expect((await db.query('select id,hours,verified from public.attendance_logs')).rows).toEqual([{id:generated[0].id,hours:'7.0000000000000000',verified:true}]);
  });
  it('blocks broadcast to a fourth active assigned account',async()=>{
    const fourth=randomUUID();
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'fourth-fixture@example.invalid',now())",[fourth]);
    await db.query("update public.profiles set status='Active' where id=$1",[fourth]);
    await asActor(A,'select public.admin_set_assignment($1,$2,$3,$4,486)',[fourth,C,COMPANY,SECTION]);
    const before=await counts();await expectFailure(seed,/roster contains other interns/);expect(await counts()).toEqual(before);
  });
  it('refuses reserved UUID collisions and preserves the unrelated row',async()=>{
    await db.query("insert into public.documents(id,intern_id,doc_type,name) values($1,$2,'custom:existing','Existing untouched')",[demoId(301),I]);
    const before=await counts();await expectFailure(seed,/collision/);expect(await counts()).toEqual(before);
    await expectFailure(cleanup,/provenance\/owner\/tag mismatch/);expect(await counts()).toEqual(before);
  });

  it('executes the full transaction-wrapped files and enforces read-only verification on a second disposable fixture',async()=>{
    const isolated=await disposablePostgres();
    try{
      const client=await isolated.connect();await fixture(client);
      await client.query(approved(sql('demo/demo_data_seed.sql')));
      const before=await counts(client);
      const report=await client.query(sql('demo/demo_data_verify.sql'));
      expect(JSON.parse(report.find(x=>x.rows?.[0]?.demo_summary).rows[0].demo_summary).seeded_counts.attendance.present).toBe(6);
      expect(await counts(client)).toEqual(before);
      await client.query(approved(sql('demo/demo_data_cleanup.sql')));
      expect((await counts(client)).attendance_logs).toBe(0);
    }finally{await isolated.stop();}
  },60000);
});

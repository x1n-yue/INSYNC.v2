import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { disposablePostgres } from './disposable-postgres.js';

const sql = (name) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
const update = sql('INSync_Consolidated_Update.sql');
const files = ['M01_authority.sql', 'M02_trusted_audit.sql', 'M03_attendance_integrity.sql',
  'M04_private_documents_bucket.sql', 'M06_rubric_hours.sql', 'M07_account_lifecycle.sql',
  'M08_document_versions.sql', 'M10_flexible_submissions.sql', 'M11_admin_history.sql', 'M12_handover_workflows.sql', 'M13_coordinator_operations.sql', 'M14_last_admin_protection.sql'];
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Exact operator-supplied body, independently reproduced here as catalog evidence.
const inspectedYearGuard = `begin
 if exists(select 1 from public.interns where academic_year_id=old.id)
   or exists(select 1 from public.attendance_logs where academic_year_id=old.id)
   or exists(select 1 from public.attendance_exceptions where academic_year_id=old.id)
   or exists(select 1 from public.evaluations where academic_year_id=old.id)
   or exists(select 1 from public.documents where academic_year_id=old.id)
 then raise exception 'Academic year is in use by assignments or historical records; retain it for history' using errcode='23503'; end if;
 return old;
end`;
async function inspectedYearExtension(db) {
  // Representative nullable UUID/FK definitions, not inferred live definitions.
  for (const tab of ['interns','attendance_logs','attendance_exceptions','evaluations','documents']) {
    await db.query(`alter table public.${tab} add column academic_year_id uuid references public.academic_years(id)`);
  }
  await db.query(`create function public.guard_academic_year_delete() returns trigger
    language plpgsql set search_path=pg_catalog,public as $body$${inspectedYearGuard}$body$;
    create trigger m11_retain_year before delete on public.academic_years
    for each row execute function public.guard_academic_year_delete()`);
}
let cluster, control, next = 0;
const clients = [];

beforeAll(async () => { cluster = await disposablePostgres(); control = await cluster.connect(); }, 60000);
afterAll(async () => { await Promise.all(clients.map((db) => db.end())); if (cluster) await cluster.stop(); }, 30000);
afterEach(async () => {
  // Only databases we created inside our own fresh cluster, never external names.
  for (const db of clients.splice(0)) {
    const name = db.database;
    if (!/^consolidated_\d+$/.test(name)) throw new Error('Refusing nonfixture database cleanup');
    await db.end(); await control.query(`drop database ${name}`);
  }
}, 30000);
async function database(initial = false, stage = 0) {
  const name = `consolidated_${++next}`;
  await control.query(`create database ${name}`);
  // Credentials exclusively belong to our freshly started loopback fixture cluster.
  const pg = await import('pg');
  const db = new pg.default.Client({ ...control.connectionParameters, password: control.password, database: name });
  await db.connect(); clients.push(db);
  if (initial) {
    const provider = sql('tests/baseline.sql').split('create table public.companies')[0]
      .replace("insert into storage.buckets(id,public) values('documents',false),('other',false);", '')
      .replace('create table storage.buckets(id text primary key,', 'create table storage.buckets(id text primary key,name text,');
    // Roles are cluster-wide; create only on the first fixture.
    await db.query(provider.replace(/create role (anon|authenticated) nologin;/g, ''));
    await db.query(sql('initial_schema.sql'));
  } else await db.query(sql('tests/baseline.sql').replace(/create role (anon|authenticated) nologin;/g, ''));
  for (const name of files.slice(0, stage)) await db.query(sql(`migrations/${name}`));
  return db;
}
async function apply(db) {
  try { await db.query(update); } catch (error) {
    await db.query('rollback');
    error.message += ` [SQL context: ${error.where || ''}; position: ${error.position || ''}]`;
    throw error;
  }
}
async function as(db, actor, query, args = []) {
  await db.query('begin');
  try {
    await db.query(actor ? 'set local role authenticated' : 'set local role anon');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor || '']);
    const result = (await db.query(query, args)).rows;
    await db.query('commit'); return result;
  } catch (error) { await db.query('rollback'); throw error; }
}
async function accounts(db) {
  for (const n of [1, 2, 3, 4, 5]) await db.query('insert into auth.users(id,email) values($1,$2)', [uid(n), `fixture${n}@example.invalid`]);
  await db.query("update public.profiles set role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end,status='Active'", [uid(1), uid(2), uid(3)]);
  await db.query('update public.interns set instructor_id=$1 where id=$2', [uid(2), uid(4)]);
  await db.query('update public.interns set instructor_id=$1 where id=$2', [uid(3), uid(5)]);
}
async function evidence(db) {
  await as(db, uid(1), 'select public.attach_standard_docs($1)', [uid(4)]);
  const doc = (await db.query("select id from public.documents where intern_id=$1 and doc_type='moa'", [uid(4)])).rows[0];
  const [{ r: staged }] = await as(db, uid(4), "select public.stage_document_upload($1,'Evidence.pdf','application/pdf',20,0) r", [doc.id]);
  const r = staged.upload;
  await as(db, uid(4), "insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)", [r.file_path, { size: 20, mimetype: 'application/pdf' }]);
  await as(db, uid(4), 'select public.finalize_document_upload($1)', [r.id]);
  await as(db, uid(2), "select public.review_document_version($1,'Approved',null,1,0)", [doc.id]);
  const [{ r: flex }] = await as(db, uid(4), "select public.stage_submission($1,null,'Week one','Preserve this history',$2,0,0) r", [uid(100), JSON.stringify([{ name: 'Weekly.pdf', mime: 'application/pdf', size: 30 }])]);
  for (const f of flex.files) await as(db, uid(4), "insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)", [f.file_path, { size: Number(f.byte_size), mimetype: f.mime_type }]);
  const [{ id }] = await as(db, uid(4), 'select * from public.finalize_submission($1)', [flex.id]);
  await as(db, uid(2), "select public.review_submission($1,1,0,'Needs Revision','Include supervisor signature')", [id]);
  await as(db, uid(2), 'select public.submit_evaluation($1,$2,$3,$4)', [uid(4), { punctuality: 5, performance: 4, conduct: 3, communication: 2 }, 'Historical feedback', uid(101)]);
  if((await db.query("select to_regprocedure('public.send_announcement(uuid,text,text,uuid)') installed")).rows[0].installed)
    await as(db, uid(2), "select public.send_announcement($1,'Fixture notice','No live messages',null)", [uid(102)]);
  else // Historical fixtures deliberately exercise the supported pre-M13 path.
    await as(db, uid(2), "insert into public.announcements(instructor_id,title,body,target) values($1,'Fixture notice','No live messages','All Interns')", [uid(2)]);
  const [clock] = await as(db, uid(4), 'select * from public.clock_in()');
  await as(db, uid(4), "select public.clock_out($1,'Fixture accomplishment')", [clock.id]);
  await as(db, uid(4), "select public.submit_correction((clock_timestamp() at time zone 'Asia/Manila')::date-1,'08:00','17:00',(clock_timestamp() at time zone 'Asia/Manila')::date-1,'Fixture correction')");
}
async function snapshot(db) {
  const names = (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map((r) => r.tablename);
  const result = {};
  for (const name of [...names.map((n) => `public.${n}`), 'auth.users', 'storage.objects']) {
    result[name] = (await db.query(`select to_jsonb(t) as data from ${name} t order by id`)).rows;
  }
  return result;
}

describe('consolidated existing-database update (native synthetic PostgreSQL)', () => {
  beforeAll(async () => { await control.query('create role anon nologin; create role authenticated nologin'); });

  it('installs final contracts on the supported empty initial baseline and runs twice', async () => {
    const db = await database(true); await apply(db); await apply(db);
    expect((await db.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n).toBe(18);
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'pending@example.invalid','{\"role\":\"admin\"}')", [uid(10)]);
    expect((await db.query('select role,status from public.profiles where id=$1', [uid(10)])).rows[0]).toEqual({ role: 'intern', status: 'Pending' });
    expect(await as(db, uid(10), 'select * from public.documents')).toEqual([]);
    expect((await db.query("select count(*)::int n from pg_constraint where conname like 'm03_%' or conname like 'm06_%' and contype='c'")).rows[0].n).toBeGreaterThanOrEqual(6);
  }, 60000);

  it('preserves baseline accounts, assignments, legacy evidence and invalid old rubric/attendance', async () => {
    const db = await database();
    for (const n of [1, 2, 4]) await db.query('insert into auth.users(id,email) values($1,$2)', [uid(n), `legacy${n}@example.invalid`]);
    await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,'a@example.invalid','Existing Admin','admin','Active'),($2,'i@example.invalid','Existing Instructor','instructor','Active'),($3,'s@example.invalid','Existing Intern','intern','Active')", [uid(1), uid(2), uid(4)]);
    await db.query('insert into public.interns(id,instructor_id) values($1,$2)', [uid(4), uid(2)]);
    await db.query("insert into public.attendance_logs(intern_id,log_date,time_in,time_out,hours,verified,accomplishment) values($1,'2020-01-01','08:00','17:00',9,true,'Original legacy record')", [uid(4)]);
    await db.query("insert into public.documents(intern_id,doc_type,name,status,file_path) values($1,'MOA','Legacy signed MOA','Approved','original/legacy.pdf')", [uid(4)]);
    await db.query("insert into public.evaluations(intern_id,feedback,overall_score) values($1,'Unconverted rubric',null)", [uid(4)]);
    await db.query("insert into public.audit_logs(actor_id,action,detail) values($1,'Legacy action','Keep provenance unchanged')", [uid(1)]);
    const before = await snapshot(db); await apply(db); await apply(db); const after = await snapshot(db);
    for (const [table, rows] of Object.entries(before)) {
      expect(after[table]).toHaveLength(rows.length);
      for (let i = 0; i < rows.length; i++) expect(after[table][i].data).toMatchObject(rows[i].data);
    }
    expect((await db.query('select upload_version from public.documents')).rows[0].upload_version).toBe('0');
    expect((await db.query("select convalidated from pg_constraint where conname='m06_evaluation_rubric'")).rows[0].convalidated).toBe(false);
    expect((await db.query('select count(*)::int n from public.document_versions')).rows[0].n).toBe(0);
  }, 60000);

  it.each([1, 3, 6, 7, 8, 9, 10])('upgrades installed prefix %s and preserves modern records on two runs', async (stage) => {
    const db = await database(false, stage); await accounts(db);
    if (stage === 9) await evidence(db);
    const before = await snapshot(db); await apply(db); await apply(db); const after = await snapshot(db);
    for (const [table, records] of Object.entries(before)) {
      expect(after[table]).toHaveLength(records.length);
      for (let i = 0; i < records.length; i++) expect(after[table][i].data).toMatchObject(records[i].data);
    }
    expect(await as(db, uid(3), 'select * from public.documents where intern_id=$1', [uid(4)])).toEqual([]);
    await expect(as(db, uid(3), 'select public.admin_set_assignment($1,$2,null,null,100)', [uid(4), uid(3)])).rejects.toThrow(/Active Admin/);
    expect((await db.query("select has_function_privilege('authenticated','public.review_document(uuid,text,text,text)','EXECUTE') allowed")).rows[0].allowed).toBe(false);
  }, 60000);

  it('retains applied M05/M09 validation and NOT NULL rather than downgrading', async () => {
    const db = await database(false, 9);
    await db.query(sql('migrations/M05_validate_attendance.sql')); await db.query(sql('migrations/M09_validate_domain.sql'));
    await apply(db); await apply(db);
    expect((await db.query("select convalidated from pg_constraint where conname='m06_evaluation_rubric'")).rows[0].convalidated).toBe(true);
    expect((await db.query("select attnotnull from pg_attribute where attrelid='public.evaluations'::regclass and attname='overall_score'")).rows[0].attnotnull).toBe(true);
  }, 60000);

  it('accepts independently applied M04 and legacy defaults, then executes documented verification queries', async () => {
    const db = await database(false, 1);
    await db.query(sql('migrations/M04_private_documents_bucket.sql'));
    await db.query("alter table public.profiles alter column status set default 'Active'");
    await apply(db); await apply(db);
    const guide = sql('INSync_Consolidated_Update_README.md');
    const verification = guide.match(/```sql\r?\n([\s\S]*?)```/)[1];
    const results = await db.query(verification);
    expect(results[0].rows).toHaveLength(18);
    expect(results[1].rows.every((r) => r.installed)).toBe(true);
    expect(results.find((r) => r.fields.some((f) => f.name === 'index_name')).rows).toHaveLength(10);
    expect(results.find((r) => r.fields.some((f) => f.name === 'tgname')).rows).toHaveLength(31);
    expect(results.find((r) => r.fields.some((f) => f.name === 'policyname')).rows.filter((r) => /^m\d\d_/.test(r.policyname))).toHaveLength(51);
  }, 60000);

  it('repairs outdated compatible function, policy, ACL and disabled trigger definitions', async () => {
    const db = await database(false, 9);
    await db.query("create or replace function public.my_profile() returns jsonb language sql as $$ select '{}'::jsonb $$; grant execute on function public.my_profile() to anon; grant update(role) on public.profiles to authenticated; alter policy m01_interns_read on public.interns using(true); alter table public.interns disable trigger m11_assignment_archive_guard");
    await apply(db);
    expect((await db.query("select prosecdef,proconfig from pg_proc where oid='public.my_profile()'::regprocedure")).rows[0]).toMatchObject({ prosecdef: true, proconfig: ['search_path=pg_catalog, public'] });
    expect((await db.query("select has_column_privilege('authenticated','public.profiles','role','UPDATE') allowed")).rows[0].allowed).toBe(false);
    await expect(as(db, null, 'select * from public.profiles')).rejects.toThrow(/permission denied/);
  }, 60000);

  it('reports an unfamiliar m11_retain_year with actionable diagnostics and preserves its protection', async () => {
    // Synthetic reproduction of the reported NAME, not a claim about the live body.
    const db = await database(false, 9);
    await accounts(db);
    await db.query("insert into public.academic_years(label,is_current) values('Historical fixture year',false)");
    await db.query(`create function public.fixture_retain_year() returns trigger
      language plpgsql set search_path=pg_catalog,public as $$
      begin raise exception 'Fixture history must remain'; end $$;
      create trigger m11_retain_year before delete on public.academic_years
      for each row execute function public.fixture_retain_year()`);
    const before = await snapshot(db);
    const definition = (await db.query(`select pg_get_triggerdef(t.oid) trigger_definition,
      pg_get_functiondef(t.tgfoid) function_definition from pg_trigger t
      where t.tgrelid='public.academic_years'::regclass and t.tgname='m11_retain_year'`)).rows;
    const error = await apply(db).catch((e) => e);
    expect(error).toMatchObject({ code: 'P0001' });
    expect(error.message).toContain('Unexpected trigger public.academic_years.m11_retain_year');
    expect(error.detail).toContain('name alone cannot establish compatible behavior');
    expect(error.hint).toContain('05_consolidated_trigger_compatibility.sql');
    expect(await snapshot(db)).toEqual(before);
    expect((await db.query(`select pg_get_triggerdef(t.oid) trigger_definition,
      pg_get_functiondef(t.tgfoid) function_definition from pg_trigger t
      where t.tgrelid='public.academic_years'::regclass and t.tgname='m11_retain_year'`)).rows).toEqual(definition);

    const results = await db.query(sql('inspection/05_consolidated_trigger_compatibility.sql'));
    const triggers = results.find((r) => r.fields.some((f) => f.name === 'tgname')).rows;
    expect(triggers.find((r) => r.tgname === 'm11_retain_year')).toMatchObject({
      table_schema: 'public', table_name: 'academic_years', enabled_mode: 'O',
      function_schema: 'public', function_name: 'fixture_retain_year', function_owner: 'postgres',
    });
    const functions = results.find((r) => r.fields.some((f) => f.name === 'function_definition')).rows;
    expect(functions.find((r) => r.function_name === 'fixture_retain_year').function_definition).toContain('Fixture history must remain');
    expect(await snapshot(db)).toEqual(before);
    await expect(db.query('delete from public.academic_years')).rejects.toThrow('Fixture history must remain');
    expect(await snapshot(db)).toEqual(before);
  }, 60000);

  it('recognizes the inspected retention guard but stops on unreviewed cohort columns without losing history', async () => {
    const db = await database(false, 9);
    await accounts(db);
    await inspectedYearExtension(db);
    await db.query("insert into public.academic_years(id,label,is_current) values($1,'Referenced historical year',false)",[uid(900)]);
    await db.query('update public.interns set academic_year_id=$1 where id=$2',[uid(900),uid(4)]);
    const before = await snapshot(db);
    const beforeDefinition = (await db.query("select pg_get_functiondef('public.guard_academic_year_delete()'::regprocedure) def")).rows;
    const error = await apply(db).catch((e) => e);
    expect(error.message).toMatch(/Incompatible column public\.\w+\.academic_year_id/);
    expect(error.hint).toContain('foreign keys, indexes and dependent routines require review');
    expect(await snapshot(db)).toEqual(before);
    expect((await db.query("select pg_get_functiondef('public.guard_academic_year_delete()'::regprocedure) def")).rows).toEqual(beforeDefinition);
    await expect(db.query('delete from public.academic_years where id=$1',[uid(900)])).rejects.toMatchObject({code:'23503'});

    const results = await db.query(sql('inspection/05_consolidated_trigger_compatibility.sql'));
    expect(results.find((r)=>r.fields.some((f)=>f.name==='column_type')).rows).toHaveLength(5);
    expect(results.find((r)=>r.fields.some((f)=>f.name==='constraint_name')).rows).toHaveLength(5);
    expect(results.find((r)=>r.fields.some((f)=>f.name==='cohort_function_definition')).rows[0].function_name).toBe('guard_academic_year_delete');
    expect(await snapshot(db)).toEqual(before);
    // Formatting changes alone do not turn the inspected body into an unknown one.
    await db.query(`create or replace function public.guard_academic_year_delete() returns trigger
      language plpgsql set search_path=pg_catalog,public as $body$\n${inspectedYearGuard.replaceAll('\n','\n  ')}\n$body$`);
    await expect(apply(db)).rejects.toThrow(/Incompatible column public\.\w+\.academic_year_id/);
  },60000);

  it.each(['body','owner','security definer','search path','disabled','timing'])(
    'rejects %s drift on the inspected retention trigger before accepting cohort data', async (kind) => {
      const db = await database(false,9);
      await inspectedYearExtension(db);
      if (kind==='body') await db.query(`create or replace function public.guard_academic_year_delete() returns trigger
        language plpgsql set search_path=pg_catalog,public as $$begin return old; end$$`);
      if (kind==='owner') await db.query('alter function public.guard_academic_year_delete() owner to authenticated');
      if (kind==='security definer') await db.query('alter function public.guard_academic_year_delete() security definer');
      if (kind==='search path') await db.query('alter function public.guard_academic_year_delete() set search_path=public');
      if (kind==='disabled') await db.query('alter table public.academic_years disable trigger m11_retain_year');
      if (kind==='timing') await db.query(`drop trigger m11_retain_year on public.academic_years;
        create trigger m11_retain_year after delete on public.academic_years
        for each row execute function public.guard_academic_year_delete()`);
      const before=await snapshot(db);
      await expect(apply(db)).rejects.toThrow('Unexpected trigger public.academic_years.m11_retain_year');
      expect(await snapshot(db)).toEqual(before);
    },60000);

  it('keeps unrelated bucket policy semantics and rerun predicates stable; blocks document OR bypass', async () => {
    const db = await database();
    await db.query("alter policy legacy_storage on storage.objects using ((bucket_id <> 'documents' and true) or true) with check(true)");
    await apply(db);
    const before = (await db.query("select qual,with_check from pg_policies where policyname='legacy_storage'")).rows;
    await apply(db);
    expect((await db.query("select qual,with_check from pg_policies where policyname='legacy_storage'")).rows).toEqual(before);
    expect(await as(db, null, "insert into storage.objects(bucket_id,name) values('other','other-bucket') returning name")).toHaveLength(1);
    await expect(as(db, null, "insert into storage.objects(bucket_id,name) values('documents','forbidden')")).rejects.toThrow(/row-level security/);
  }, 60000);

  it.each(['duplicate', 'type', 'constraint', 'overload', 'signature', 'trigger', 'index', 'missing bucket', 'missing baseline', 'assignment', 'populated partial evidence', 'conflicting current years', 'malformed legacy snapshot'])('aborts %s incompatibility without changing records', async (kind) => {
    const db = await database(false, kind === 'index' ? 9 : 0);
    if (kind === 'duplicate') {
      await db.query("insert into auth.users(id,email) values($1,'dup@example.invalid')", [uid(4)]);
      await db.query("insert into public.profiles(id,full_name,email,role,status) values($1,'Duplicate','dup@example.invalid','intern','Pending')", [uid(4)]);
      await db.query('insert into public.interns(id) values($1)', [uid(4)]);
      await db.query("insert into public.documents(intern_id,doc_type,name) values($1,'MOA','first'),($1,'MOA','second')", [uid(4)]);
    }
    if (kind === 'type') await db.query('alter table public.interns alter column required_hours type text');
    if (kind === 'constraint') await db.query('alter table public.interns add constraint m06_required_hours check(true)');
    if (kind === 'overload') await db.query('create function public.my_profile(text) returns jsonb language sql as $$ select null::jsonb $$');
    if (kind === 'signature') await db.query('create function public.my_profile() returns text language sql as $$ select null::text $$');
    if (kind === 'trigger') await db.query('create trigger unrelated_guard before insert on public.profiles for each row execute function public.handle_new_user()');
    if (kind === 'index') await db.query('drop index public.m11_audit_order; create index m11_audit_order on public.audit_logs(action)');
    if (kind === 'missing bucket') await db.query("delete from storage.buckets where id='documents'");
    if (kind === 'missing baseline') await db.query('alter table public.companies rename to retained_companies');
    if (kind === 'assignment') {
      await db.query("insert into auth.users(id,email) values($1,'missing@example.invalid')", [uid(4)]);
      await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,'missing@example.invalid','Missing extension','intern','Active')", [uid(4)]);
    }
    if (kind === 'populated partial evidence') await db.query('create table public.submissions(id uuid primary key default gen_random_uuid()); insert into public.submissions default values');
    if (kind === 'conflicting current years') await db.query("insert into public.academic_years(label,is_current) values('Year one',true),('Year two',true)");
    if(kind==='malformed legacy snapshot') {
      await db.query('alter table public.documents add column legacy_evidence jsonb');
      await db.query("insert into auth.users(id,email) values($1,'legacy@example.invalid');",[uid(4)]);
      await db.query("insert into public.profiles(id,email,full_name,role,status) values($1,'legacy@example.invalid','Legacy','intern','Pending')",[uid(4)]);
      await db.query('insert into public.interns(id) values($1)',[uid(4)]);
      await db.query("insert into public.documents(intern_id,doc_type,name,legacy_evidence) values($1,'moa','Legacy','{\"id\":\"wrong\"}')",[uid(4)]);
    }
    const before = await snapshot(db);
    await expect(apply(db)).rejects.toThrow(/Duplicate|Incompatible|Unexpected|Outdated|Missing|Conflicting|anomaly/);
    expect(await snapshot(db)).toEqual(before);
  }, 60000);
});

import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { installLegacyM14 } from './legacy-install';
import { disposablePostgres } from './disposable-postgres.js';

const sql = (name) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
const cleanup = sql('INSync_Clear_Operational_Data.sql');
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const kept = ['auth.users', 'public.profiles', 'public.interns', 'public.companies', 'public.course_sections', 'public.academic_years'];
let cluster, db;
beforeAll(async () => {
  cluster = await disposablePostgres(); db = await cluster.connect();
  await db.query(sql('tests/baseline.sql'));
  await installLegacyM14(db);
  for (let n = 1; n <= 4; n++) await db.query('insert into auth.users(id,email) values($1,$2)', [uid(n), `fixture${n}@example.invalid`]);
  await db.query("update public.profiles set role=case when id=$1 then 'admin' when id=$2 then 'instructor' else 'intern' end,status=case when id=$3 then 'Pending' else 'Active' end", [uid(1), uid(2), uid(4)]);
  await db.query("insert into public.companies(id,name) values($1,'Fixture Company')", [uid(10)]);
  await db.query("insert into public.course_sections(id,name) values($1,'Fixture Section')", [uid(11)]);
  await db.query("insert into public.academic_years(id,label,is_current) values($1,'Fixture Year',true)", [uid(12)]);
  await db.query('update public.interns set instructor_id=$1,company_id=$2,section_id=$3,required_hours=600 where id=$4', [uid(2), uid(10), uid(11), uid(3)]);
}, 60000);
afterAll(async () => { if (cluster) await cluster.stop(); }, 30000);
afterEach(async () => { if (db) await db.query('rollback'); });

async function snapshot() {
  const result = {};
  for (const name of kept) result[name] = (await db.query(`select to_jsonb(t) data from ${name} t order by id`)).rows;
  return result;
}
async function apply(text = cleanup) {
  let report;
  const notice = ({ message }) => {
    const prefix = 'INSync cleanup result: ';
    if (message.startsWith(prefix)) report = JSON.parse(message.slice(prefix.length));
  };
  db.on('notice', notice);
  try {
    const result = await db.query(text);
    return { result, report };
  } catch (error) { await db.query('rollback'); throw error; }
  finally { db.off('notice', notice); }
}
async function fixtures() {
  await db.query('begin');
  await db.query('set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid(1)]);
  await db.query('select public.attach_standard_docs($1)', [uid(3)]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid(3)]);
  const doc = (await db.query("select id from public.documents where doc_type='moa' and intern_id=$1", [uid(3)])).rows[0];
  const version = (await db.query("select public.stage_document_upload($1,'Fixture.pdf','application/pdf',20,0) r", [doc.id])).rows[0].r.upload;
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)", [version.file_path, { size: 20, mimetype: 'application/pdf' }]);
  await db.query('select public.finalize_document_upload($1)', [version.id]);
  const flexible = (await db.query("select public.stage_submission($1,null,'Fixture set','',$2,0,0) r", [uid(101), JSON.stringify([{ name: 'Photo.png', mime: 'image/png', size: 30 }])])).rows[0].r;
  for (const f of flexible.files) await db.query("insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)", [f.file_path, { size: 30, mimetype: 'image/png' }]);
  const submission = (await db.query('select * from public.finalize_submission($1)', [flexible.id])).rows[0];
  await db.query('select public.clock_in()');
  await db.query("select public.submit_correction((clock_timestamp() at time zone 'Asia/Manila')::date-1,'08:00','17:00',(clock_timestamp() at time zone 'Asia/Manila')::date-1,'Fixture reason')");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid(2)]);
  await db.query("select public.review_document_version($1,'Approved',null,1,0)", [doc.id]);
  await db.query("select public.review_submission($1,1,0,'Needs Revision','Include signature')", [submission.id]);
  await db.query('select public.submit_evaluation($1,$2,null,$3)', [uid(3), { punctuality: 5, performance: 4, conduct: 3, communication: 2 }, uid(102)]);
  await db.query("select public.send_announcement($1,'Fixture','Synthetic recipients only',null)", [uid(103)]);
  await db.query('reset role');
  await db.query("select set_config('request.jwt.claim.sub','',true)");
  await db.query("insert into public.alerts(intern_id,type,detail) values($1,'fixture','Fixture detail')", [uid(3)]);
  await db.query('commit');
}

describe('historical M14 operational cleanup (only disposable PostgreSQL fixtures)', () => {
  it('deletes all 13 operational tables in FK order; preserves accounts/targets/assignments/master data and Storage', async () => {
    await fixtures();
    const before = await snapshot();
    const objects = (await db.query('select to_jsonb(t) data from storage.objects t order by id')).rows;
    const { result, report: summary } = await apply();
    expect(result.command).toBe('DO');
    expect(summary.mode).toBe('deleted');
    const report = summary.tables;
    expect(report).toHaveLength(13);
    expect(report.every((r) => Number(r.deleted_rows) > 0)).toBe(true);
    expect(await snapshot()).toEqual(before);
    expect((await db.query('select to_jsonb(t) data from storage.objects t order by id')).rows).toEqual(objects);
    for (const r of report) expect((await db.query(`select count(*)::int n from ${r.table_name}`)).rows[0].n).toBe(0);
    await apply(); expect(await snapshot()).toEqual(before);
    // It preserves the Pending account gate too.
    expect((await db.query('select role,status from public.profiles where id=$1', [uid(4)])).rows[0]).toEqual({ role: 'intern', status: 'Pending' });
  }, 60000);

  it('supports a full dry run that rolls all deletions and generated audits back', async () => {
    await fixtures();
    const before = (await db.query('select count(*)::int n from public.audit_logs')).rows[0].n;
    const { report } = await apply(cleanup.replace('dry_run boolean := false', 'dry_run boolean := true'));
    expect(report.mode).toBe('dry-run (rolled back)');
    expect((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n).toBe(before);
    expect((await db.query('select count(*)::int n from public.documents')).rows[0].n).toBe(4);
  }, 60000);

  it('rolls back if a custom trigger modifies a protected account', async () => {
    // Build this case independently of the dry-run test's retained fixture rows.
    await apply(); await fixtures();
    const before = await snapshot();
    await db.query("create function public.fixture_tamper() returns trigger language plpgsql as $$ begin update public.profiles set full_name='Changed' where id='00000000-0000-4000-8000-000000000003'; return old; end $$; create trigger fixture_tamper before delete on public.documents for each row execute function public.fixture_tamper()");
    await expect(apply()).rejects.toThrow(/Protected accounts\/master data changed/);
    expect(await snapshot()).toEqual(before);
    expect((await db.query('select count(*)::int n from public.documents')).rows[0].n).toBe(4);
    await db.query('drop trigger fixture_tamper on public.documents; drop function public.fixture_tamper()');
  }, 60000);

  it('reproduces missing ON COMMIT DROP temp tables between autocommitted statements; new block needs no session state', async () => {
    const before = await snapshot();
    await db.query('create temp table insync_cleanup_preserved(table_name text,row_id text,digest text) on commit drop');
    await expect(db.query("insert into pg_temp.insync_cleanup_preserved values('fixture','fixture','fixture')"))
      .rejects.toMatchObject({ code: '42P01' });
    expect((await db.query("select to_regclass('pg_temp.insync_cleanup_preserved') installed")).rows[0].installed).toBeNull();
    expect(cleanup).not.toMatch(/CREATE TEMP TABLE|pg_temp\./i);
    const { report } = await apply();
    expect(report.mode).toBe('deleted');
    expect(await snapshot()).toEqual(before);
  }, 60000);

  it('does not disguise a real trigger error as a successful dry run', async () => {
    await apply(); await fixtures();
    const before = await snapshot();
    await db.query("create function public.fixture_fail() returns trigger language plpgsql as $$ begin raise exception using errcode='P9001',message='Fixture trigger failure'; end $$; create trigger fixture_fail before delete on public.documents for each row execute function public.fixture_fail()");
    await expect(apply(cleanup.replace('dry_run boolean := false', 'dry_run boolean := true')))
      .rejects.toMatchObject({ code: 'P9001', message: 'Fixture trigger failure' });
    expect(await snapshot()).toEqual(before);
    expect((await db.query('select count(*)::int n from public.documents')).rows[0].n).toBe(4);
    await db.query('drop trigger fixture_fail on public.documents; drop function public.fixture_fail()');
  }, 60000);
});

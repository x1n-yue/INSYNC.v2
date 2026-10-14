// Local PostgreSQL only, with synthetic Supabase provider schemas; no env/remote access.
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { disposablePostgres } from './disposable-postgres';

const read = f => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
// Own each outer transaction; the installer's contents execute within it.
const install = read('INSync_Fresh_Install.sql').replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
const bootstrap = [...read('INSync_New_Project_Setup_README.md').matchAll(/```sql\n([\s\S]*?)```/g)]
  .map(match => match[1]).find(block => block.includes('owner_id uuid'))
  .replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
let cluster, db;
beforeAll(async () => { cluster = await disposablePostgres(); db = await cluster.connect(); }, 60000);
afterAll(async () => { if (cluster) await cluster.stop(); }, 30000);
beforeEach(async () => {
  await db.query('begin');
  await db.query(read('tests/baseline.sql').split('create table public.companies')[0]);
  await db.query(`alter table auth.users add column deleted_at timestamptz, add column email_confirmed_at timestamptz;
    update storage.buckets set file_size_limit=10485760,
    allowed_mime_types=ARRAY['image/png','application/pdf','image/jpeg'] where id='documents';
    grant select,insert,delete on storage.objects to authenticated;`);
});
afterEach(async () => { await db.query('rollback'); });

describe('new-project fresh installation preconditions', () => {
  it('installs on an empty provider baseline, accepts reordered exact MIME types and creates no accounts', async () => {
    await db.query(install);
    expect((await db.query('select count(*)::int n from public.profiles')).rows[0].n).toBe(0);
    expect((await db.query("select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity")).rows[0].n).toBe(18);
    expect((await db.query("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace")).rows[0].n).toBe(56);
    expect((await db.query("select count(*)::int n from pg_policies where schemaname='public'")).rows[0].n).toBe(43);
    expect((await db.query("select count(*)::int n from pg_policies where schemaname='storage'")).rows[0].n).toBe(8);
    expect((await db.query("select count(*)::int n from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_created' and tgenabled='O'")).rows[0].n).toBe(1);
    expect((await db.query("select count(*)::int n from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace='public'::regnamespace and not t.tgisinternal")).rows[0].n).toBe(30);
    // Execute the published read-only diagnostics against the installed catalog.
    await db.query(read('INSync_New_Project_Verify.sql').replace(/^BEGIN READ ONLY;\s*$/m, '').replace(/^COMMIT;\s*$/m, ''));
    const [row] = (await db.query(`select
      has_table_privilege('authenticated','public.announcements','SELECT') readable,
      has_table_privilege('authenticated','public.announcements','INSERT') raw_write,
      has_function_privilege('authenticated','public.send_announcement(uuid,text,text,uuid)','EXECUTE') send,
      has_function_privilege('anon','public.send_announcement(uuid,text,text,uuid)','EXECUTE') anonymous_send`)).rows;
    expect(row).toEqual({ readable: true, raw_write: false, send: true, anonymous_send: false });
    const [rpc] = (await db.query("select proargnames from pg_proc where oid='public.verify_attendance(uuid,timestamptz,timestamptz)'::regprocedure")).rows;
    expect(rpc.proargnames).toEqual(['p_id', 'p_expected_in', 'p_expected_out']);
    // Signup never trusts privileged metadata, even on a completely new installation.
    const id = '00000000-0000-4000-8000-000000000001';
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'fixture@example.invalid','{\"role\":\"admin\",\"full_name\":\"Fixture\"}')", [id]);
    expect((await db.query('select role,status from public.profiles where id=$1', [id])).rows[0]).toEqual({ role: 'intern', status: 'Pending' });
  });

  it('refuses a missing documents bucket before creating application tables', async () => {
    await db.query("delete from storage.buckets where id='documents'");
    await expect(db.query(install)).rejects.toThrow(/private documents bucket/);
  });

  it.each([
    'public=true', 'file_size_limit=20971520',
    "allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','text/plain']",
    "allowed_mime_types=ARRAY['application/pdf','image/png']",
  ])('refuses incompatible bucket settings: %s', async change => {
    await db.query(`update storage.buckets set ${change} where id='documents'`);
    await expect(db.query(install)).rejects.toThrow(/private documents bucket/);
  });

  it('refuses disabled provider Storage RLS', async () => {
    await db.query('alter table storage.objects disable row level security');
    await expect(db.query(install)).rejects.toThrow(/Storage RLS must remain enabled/);
  });

  it('refuses an unrelated public table instead of resetting it', async () => {
    await db.query('create table public.unrelated_application(id int)');
    await expect(db.query(install)).rejects.toThrow(/blank application tables/);
  });

  it('refuses unrelated public routines', async () => {
    await db.query('create function public.unrelated_function() returns int language sql as $$select 1$$');
    await expect(db.query(install)).rejects.toThrow(/Unreviewed public routines/);
  });

  it('refuses unrelated public enum types', async () => {
    await db.query("create type public.unrelated_enum as enum ('unrelated')");
    await expect(db.query(install)).rejects.toThrow(/Unreviewed public types/);
  });

  it('refuses a second installation without changing existing application data', async () => {
    await db.query(install);
    const id = '00000000-0000-4000-8000-000000000002';
    await db.query("insert into auth.users(id,email) values($1,'retained@example.invalid')", [id]);
    await db.query('savepoint replay');
    await expect(db.query(install)).rejects.toThrow(/blank application tables/);
    await db.query('rollback to savepoint replay');
    expect((await db.query('select id,role,status from public.profiles')).rows).toEqual([{ id, role: 'intern', status: 'Pending' }]);
  });

  it('does not repair missing provider privileges with blanket grants', async () => {
    await db.query('revoke delete on storage.objects from authenticated');
    await expect(db.query(install)).rejects.toThrow(/Provider Storage privileges require review/);
  });

  it('bootstraps only the explicitly verified confirmed owner and refuses a replay', async () => {
    await db.query(install);
    const owner = '00000000-0000-4000-8000-000000000003';
    const other = '00000000-0000-4000-8000-000000000004';
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.invalid',now()),($2,'other@example.invalid',now())", [owner, other]);
    const query = bootstrap.replace('YOUR-VERIFIED-NEW-AUTH-UUID', owner).replace('YOUR-VERIFIED-OWNER-EMAIL', 'owner@example.invalid');
    await db.query(query);
    expect((await db.query('select role,status from public.profiles where id=$1', [owner])).rows[0]).toEqual({ role: 'admin', status: 'Active' });
    expect((await db.query('select role,status from public.profiles where id=$1', [other])).rows[0]).toEqual({ role: 'intern', status: 'Pending' });
    await expect(db.query(query)).rejects.toThrow(/An Active Admin exists/);
  });

  it.each([false, true])('refuses owner bootstrap with unconfirmed or mismatched identity (confirmed: %s)', async confirmed => {
    await db.query(install);
    const owner = '00000000-0000-4000-8000-000000000005';
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)', [owner, 'owner@example.invalid', confirmed ? new Date() : null]);
    const query = bootstrap.replace('YOUR-VERIFIED-NEW-AUTH-UUID', owner)
      .replace('YOUR-VERIFIED-OWNER-EMAIL', confirmed ? 'wrong@example.invalid' : 'owner@example.invalid');
    await db.query('savepoint identity_check');
    await expect(db.query(query)).rejects.toThrow(/Verify the owner identity and confirm email/);
    await db.query('rollback to savepoint identity_check');
    expect((await db.query('select role,status from public.profiles where id=$1', [owner])).rows[0]).toEqual({ role: 'intern', status: 'Pending' });
  });
});

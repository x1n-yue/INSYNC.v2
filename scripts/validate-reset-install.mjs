// Private recovery rehearsal + fresh-install verification. OWN loopback server
// only, using the same isolated process helper as the native regression suites.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {disposablePostgres} from '../tests/disposable-postgres.js';
const read=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8').replace(/^\uFEFF/,'');
const cp=JSON.parse(JSON.parse(read('.insync-recovery/pre-reset-exact.json')).rows.find(r=>r.checkpoint_json).checkpoint_json);
const cluster=await disposablePostgres();let db;const passed=[];
try{
 db=await cluster.connect();
 await db.query("set timezone='UTC'");
 await db.query(read('supabase/tests/baseline.sql').split('create table public.companies')[0]);
 await db.query(`create role service_role nologin bypassrls;
  alter table auth.users add column email_confirmed_at timestamptz,add column deleted_at timestamptz;
  update storage.buckets set file_size_limit=10485760,allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'] where id='documents';
  grant all on storage.objects to authenticated,anon;`);
 for(const a of cp.auth_identities)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[a.id,a.email]);
 for(const o of cp.storage_objects)await db.query('insert into storage.objects(id,bucket_id,name) values($1,$2,$3)',[o.id,o.bucket_id,o.name]);
 await db.query(read('.insync-recovery/application-recovery.sql'));
 for(const t of cp.triggers.filter(t=>t.schema!=='public'&&t.function.startsWith('public.')))await db.query(t.definition);
 for(const p of cp.policies.filter(p=>p.schemaname==='storage'))await db.query(`CREATE POLICY "${p.policyname}" ON storage.objects AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(r=>r==='public'?'PUBLIC':`"${r}"`).join(',')}${p.qual?` USING (${p.qual})`:''}${p.with_check?` WITH CHECK (${p.with_check})`:''}`);
 const fingerprints=async()=>{
  const result={};for(const t of Object.keys(cp.public_data))result[t]=(await db.query(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by id::text),'[]'::jsonb)::text) fingerprint from public."${t}" x`)).rows[0].fingerprint;return result;
 };
 assert.deepEqual(await fingerprints(),cp.data_fingerprints);passed.push('Recovery checkpoint recreates original 18-table data exactly, including numeric precision');
 const protectedSnapshot=async()=> (await db.query(`select jsonb_build_object('users',(select jsonb_agg(to_jsonb(u) order by id) from auth.users u),
  'objects',(select jsonb_agg(to_jsonb(o) order by id) from storage.objects o),
  'triggers',(select jsonb_agg(pg_get_triggerdef(oid)) from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal),
  'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='storage')) value`)).rows[0].value;
 const before=await protectedSnapshot();
 // Changed checkpoint data must fail before deletion.
 await db.query("insert into public.companies(name) values('Synthetic checkpoint drift')");
 await assert.rejects(db.query(read('.insync-recovery/execute-reset-rebuild.sql')),/Checkpoint data changed/);await db.query('rollback');
 await db.query("delete from public.companies where name='Synthetic checkpoint drift'");
 // Trusted audit adds history on those fixture writes; restore exact baseline.
 await db.query('delete from public.audit_logs');
 await db.query('insert into public.audit_logs select * from jsonb_populate_recordset(null::public.audit_logs,$1::jsonb)',[JSON.stringify(cp.public_data.audit_logs)]);
 passed.push('Checkpoint drift stops reset without dropping records');
 // Unexpected external dependency: RESTRICT rolls the entire operation back.
 await db.query('create schema unrelated; create view unrelated.fixture_view as select id from public.profiles');
 await assert.rejects(db.query(read('.insync-recovery/execute-reset-rebuild.sql')),/depend|dependency/);await db.query('rollback');
 assert.deepEqual(await fingerprints(),cp.data_fingerprints);await db.query('drop view unrelated.fixture_view;drop schema unrelated');passed.push('Unrelated cross-schema view prevents reset with full rollback');
 await db.query(read('.insync-recovery/execute-reset-rebuild.sql'));
 assert.deepEqual(await protectedSnapshot(),before);passed.push('Atomic reset/rebuild preserves Auth users, Storage objects, Auth trigger and Storage policies');
 const rows=await db.query(`select (select count(*) from pg_tables where schemaname='public') tables,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') routines,
  (select count(*) from pg_policies where schemaname='public') policies,
  (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not tgisinternal) triggers,
  (select count(*) from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not convalidated) unvalidated`);
 assert.equal(Number(rows.rows[0].tables),18);assert.equal(Number(rows.rows[0].routines),56);assert.equal(Number(rows.rows[0].unvalidated),0);passed.push('18 tables / 56 current routines / fully validated fresh constraints installed');
 for(const t of ['attendance_logs','evaluations','announcements','documents','document_versions','submissions','companies','course_sections','academic_years'])assert.equal((await db.query(`select count(*)::int n from public.${t}`)).rows[0].n,0);
 const actual=(await db.query('select id,role,status from public.profiles order by id')).rows;
 assert.deepEqual(actual,cp.public_data.profiles.map(p=>({id:p.id,role:p.role,status:p.status})).sort((a,b)=>a.id.localeCompare(b.id)));passed.push('Only previously verified profile roles/statuses restored; test operational/master data removed');
 await db.query("insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000009999','fixture@example.invalid','{\"role\":\"admin\",\"requested_role\":\"instructor\"}')");
 assert.deepEqual((await db.query("select role,status from public.profiles where email='fixture@example.invalid'")).rows,[{role:'intern',status:'Pending'}]);passed.push('New registration ignores privileged metadata and creates Pending Intern');
 await assert.rejects(db.query(read('supabase/INSync_Fresh_Install.sql')),/blank application/);await db.query('rollback');passed.push('Fresh script refuses replay over existing application records');
 writeFileSync(new URL('../.insync-recovery/local-validation.json',import.meta.url),JSON.stringify({isolated:true,passed,catalog:rows.rows[0]},null,2));
 console.log(JSON.stringify({isolated:true,passed,catalog:rows.rows[0]},null,2));
}catch(e){console.error('Local reset validation failed:',e.message,e.where||'');process.exitCode=1;}
finally{if(db)await db.end();await cluster.stop();}

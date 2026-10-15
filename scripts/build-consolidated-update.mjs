// Offline generator. Starts only our disposable loopback PostgreSQL; no external URL.
// The output is a standalone SQL Editor script, never a bootstrap or migration replay.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { disposablePostgres } from '../tests/disposable-postgres.js';

const read = (name) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
const migrations = ['M01_authority.sql', 'M02_trusted_audit.sql', 'M03_attendance_integrity.sql',
  'M04_private_documents_bucket.sql', 'M06_rubric_hours.sql', 'M07_account_lifecycle.sql',
  'M08_document_versions.sql', 'M10_flexible_submissions.sql', 'M11_admin_history.sql', 'M12_handover_workflows.sql', 'M13_coordinator_operations.sql', 'M14_last_admin_protection.sql', 'M15_supervisor_evaluations.sql', 'M16_evaluation_controls.sql', 'M17_company_attendance.sql', 'M18_supervisor_logbook.sql'];
const baseTables = ['companies', 'course_sections', 'academic_years', 'profiles', 'interns',
  'attendance_logs', 'attendance_exceptions', 'evaluations', 'documents', 'announcements', 'alerts', 'audit_logs'];
const tables = [...baseTables, 'logbook_submissions','logbook_versions','logbook_events', 'attendance_sheet_evidence','manual_attendance_events','document_versions', 'document_review_events', 'submissions',
  'submission_versions', 'submission_files', 'submission_reviews', 'supervisor_assignments', 'supervisor_evaluations', 'evaluation_reviews', 'evaluation_routing_events', 'evaluation_adjustment_events'];

async function catalog(db) {
  await db.query('set search_path=pg_catalog');
  const rows = async (query) => (await db.query(query, [tables])).rows;
  return {
    columns: await rows(`select c.relname as tab, a.attname as name, format_type(a.atttypid,a.atttypmod) as type,
      a.attnotnull as required, pg_get_expr(d.adbin,d.adrelid) as def
      from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
      left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      where n.nspname='public' and c.relname=any($1) and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`),
    constraints: await rows(`select c.relname as tab, x.conname as name,x.contype as kind,
      regexp_replace(pg_get_constraintdef(x.oid),' NOT VALID$','') as def, x.convalidated as validated
      from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1) and x.contype<>'t' order by c.relname,x.conname`),
    indexes: await rows(`select t.relname as tab,i.relname as name,pg_get_indexdef(i.oid) as def
      from pg_index x join pg_class i on i.oid=x.indexrelid join pg_class t on t.oid=x.indrelid
      join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=any($1)
      and not exists(select 1 from pg_constraint z where z.conindid=i.oid) order by i.relname`),
    functions: (await db.query(`select p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
      p.oid::regprocedure::text as identity,pg_get_function_result(p.oid) as result,
      p.proargnames as names,p.proargmodes::text[] as modes,pg_get_functiondef(p.oid) as def,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as allowed
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname`)).rows,
    triggers: (await db.query(`select n.nspname as schema,c.relname as tab,t.tgname as name,pg_get_triggerdef(t.oid) as def
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where not t.tgisinternal and ((n.nspname='public' and c.relname=any($1)) or (n.nspname='auth' and c.relname='users'))
      order by n.nspname,c.relname,t.tgname`, [tables])).rows,
    policies: (await db.query(`select schemaname as schema,tablename as tab,policyname as name,permissive,roles::text[],cmd,qual,with_check
      from pg_policies where (schemaname='public' and tablename=any($1))
      or (schemaname='storage' and tablename='objects' and policyname<>'legacy_storage') order by schemaname,tablename,policyname`, [tables])).rows,
    grants: await rows(`select c.relname as tab, x.privilege_type as privilege
      from pg_class c join pg_namespace n on n.oid=c.relnamespace,
      lateral aclexplode(c.relacl) x where n.nspname='public' and c.relname=any($1)
      and x.grantee='authenticated'::regrole order by c.relname,x.privilege_type`),
    columnGrants: await rows(`select c.relname as tab,a.attname as name,x.privilege_type as privilege
      from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid,
      lateral aclexplode(a.attacl) x where n.nspname='public' and c.relname=any($1)
      and x.grantee='authenticated'::regrole order by c.relname,a.attname,x.privilege_type`),
  };
}

const cluster = await disposablePostgres();
let target, baseline, synthetic;
try {
  const db = await cluster.connect();
  const provider = read('tests/baseline.sql').split('create table public.companies')[0]
    .replace("insert into storage.buckets(id,public) values('documents',false),('other',false);", '')
    .replace('create table storage.buckets(id text primary key,', 'create table storage.buckets(id text primary key,name text,');
  await db.query(provider);
  await db.query(read('initial_schema.sql'));
  baseline = await catalog(db);
  for (const name of migrations) await db.query(read(`migrations/${name}`));
  target = await catalog(db);
} finally { await cluster.stop(); }
const fixtureCluster = await disposablePostgres();
try {
  const db = await fixtureCluster.connect();
  await db.query(read('tests/baseline.sql'));
  synthetic = await catalog(db);
} finally { await fixtureCluster.stop(); }

const attendanceBucket=read('migrations/M17_company_attendance.sql').match(/-- M17_BUCKET_BEGIN:[^\n]*\n([\s\S]*?)-- M17_BUCKET_END/)[1];
// The legacy catalog differs only in these defaults / equivalent score expression
// from the seed-free initial catalog. No destructive bootstrap is executed here.
const legacyColumns = baseline.columns.map((r) => ({ ...r,
  def: r.tab === 'profiles' && r.name === 'status' ? "'Active'::text"
    : r.tab === 'interns' && r.name === 'status' ? "'On Track'::text" : r.def }));
const variants = (rows, key) => [...new Map(rows.map((r) => [key(r), r])).values()];
const baseColumns = variants([...baseline.columns, ...synthetic.columns, ...legacyColumns], JSON.stringify);
// M09 may already have made overall_score NOT NULL. Never weaken that state.
baseColumns.push({ ...baseline.columns.find((r) => r.tab === 'evaluations' && r.name === 'overall_score'), required: true });
const baseConstraints = variants([...baseline.constraints, ...synthetic.constraints].map(({ validated: _v, ...r }) => r), JSON.stringify);
const legacyScore = baseConstraints.find((r) => r.tab === 'evaluations' && r.name === 'evaluations_overall_score_check');
baseConstraints.push({ ...legacyScore, def: 'CHECK (((overall_score >= (0)::numeric) AND (overall_score <= (100)::numeric)))' });
const upgradedColumns = target.columns.filter((r) => !baseline.columns.some((b) => b.tab === r.tab && b.name === r.name && b.def === r.def));
const upgradedConstraints = target.constraints.filter((r) => !baseline.constraints.some((b) => b.tab === r.tab && b.name === r.name && b.def === r.def));
const sources = migrations.map((name) => ({ name, sha256: createHash('sha256').update(read(`migrations/${name}`)).digest('hex') }));
for (const fn of target.functions) {
  fn.source = [...migrations].reverse().find((name) => new RegExp(`create(?: or replace)? function public\\.${fn.name}\\s*\\(`, 'i').test(read(`migrations/${name}`)));
}
const manifest = { baseTables, tables, baseColumns, baseConstraints, columns: upgradedColumns,
  constraints: upgradedConstraints, indexes: target.indexes, functions: target.functions,
  triggers: target.triggers, policies: target.policies, grants: target.grants, columnGrants: target.columnGrants };
manifest.baselineChecks = baseline.constraints.filter((r) => r.kind === 'c').map(r => target.constraints.find(t=>t.tab===r.tab&&t.name===r.name)||r);
// Operator-supplied catalog evidence, 2026-10-13. This is retained in place,
// not installed on baselines or rewritten into the repository's M11 contract.
manifest.retainedAcademicYearGuardBody = `begin
 if exists(select 1 from public.interns where academic_year_id=old.id)
   or exists(select 1 from public.attendance_logs where academic_year_id=old.id)
   or exists(select 1 from public.attendance_exceptions where academic_year_id=old.id)
   or exists(select 1 from public.evaluations where academic_year_id=old.id)
   or exists(select 1 from public.documents where academic_year_id=old.id)
 then raise exception 'Academic year is in use by assignments or historical records; retain it for history' using errcode='23503'; end if;
 return old;
end`;

const sql = `-- INSync consolidated EXISTING-database updater, generated 2026-10-13.
-- Read INSync_Consolidated_Update_README.md; take a provider backup and rehearse first.
-- Latest final contracts; NOT a concatenation/replay of migration files.
-- Represented sources (hashes identify the exact reviewed SQL):
${sources.map((s) => `-- migrations/${s.name} SHA256 ${s.sha256}`).join('\n')}
-- M05/M09 are excluded deferred historical validation; existing validation is retained.
-- No seeds, resets, historical conversions, Auth accounts, file deletion or CLI ledger writes.
-- All operations are transactional (ordinary indexes, no CONCURRENTLY operations).
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SET LOCAL check_function_bodies = off;
SELECT pg_catalog.pg_advisory_xact_lock(404,1);

-- Temporary manifest/helper disappear at commit; nothing is added to migration history.
CREATE TEMP TABLE insync_update_contract (value jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE insync_retained_trigger_contract (
 table_oid oid NOT NULL, trigger_name text NOT NULL, trigger_definition text NOT NULL,
 function_oid oid NOT NULL, function_definition text NOT NULL, function_acl text,
 enabled_mode "char" NOT NULL
) ON COMMIT DROP;
INSERT INTO pg_temp.insync_update_contract VALUES ($insync_manifest$
${JSON.stringify(manifest, null, 2)}
$insync_manifest$::jsonb);

-- M01 ownership/security preflight, generalized to supported intermediate installs.
DO $preflight$
DECLARE m jsonb; r record; t text; cols text; populated boolean;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 IF current_user <> 'postgres' OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'INSync requires the reviewed postgres SQL operator with trusted ownership'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated')
 THEN RAISE EXCEPTION 'Supabase anon/authenticated roles required; do not manufacture provider roles'; END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls))
 OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE (rolsuper OR rolbypassrls)
  AND (pg_catalog.pg_has_role('anon',oid,'MEMBER') OR pg_catalog.pg_has_role('authenticated',oid,'MEMBER')))
 THEN RAISE EXCEPTION 'API roles have trusted privileges: inspect role membership before updating'; END IF;
 IF pg_catalog.to_regclass('auth.users') IS NULL OR pg_catalog.to_regclass('storage.objects') IS NULL OR pg_catalog.to_regclass('storage.buckets') IS NULL
 THEN RAISE EXCEPTION 'Real Supabase Auth/Storage catalog required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Provider Storage object RLS is disabled: restore reviewed provider configuration before updating'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='storage.objects'::regclass AND attname='metadata' AND atttypid='jsonb'::regtype AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Inspect provider storage.objects.metadata JSONB size/mimetype contract (M08/M10)'; END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='documents')
 THEN RAISE EXCEPTION 'Missing documents bucket: inspect Storage configuration; create the reviewed private 10 MiB PDF/JPEG/PNG bucket using the provider'; END IF;
 FOR t IN SELECT jsonb_array_elements_text(m->'baseTables') LOOP
  IF pg_catalog.to_regclass(format('public.%I',t)) IS NULL
  THEN RAISE EXCEPTION 'Missing baseline public.%: restore/reconcile the existing 12-table catalog. Do not run initial_schema.sql on existing accounts',t; END IF;
 END LOOP;
 -- Stable lock order; maintenance window prevents live writes/DDL during verification.
 FOR t IN SELECT jsonb_array_elements_text(m->'tables') ORDER BY 1 LOOP
  IF pg_catalog.to_regclass(format('public.%I',t)) IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=pg_catalog.to_regclass(format('public.%I',t)) AND relkind='r' AND relowner='postgres'::regrole AND NOT relispartition AND NOT relforcerowsecurity)
   THEN RAISE EXCEPTION 'Unsupported ownership/table kind/forced RLS on public.%: review manually',t; END IF;
   EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
  END IF;
 END LOOP;
 LOCK TABLE auth.users,storage.objects,storage.buckets IN SHARE ROW EXCLUSIVE MODE;
 FOR r IN SELECT n.nspname,c.relname,t.tgname,t.oid AS trigger_oid FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal
  AND ((n.nspname='public' AND m->'tables' ? c.relname) OR (n.nspname='auth' AND c.relname='users')) LOOP
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'triggers') e WHERE e->>'schema'=r.nspname AND e->>'tab'=r.relname AND e->>'name'=r.tgname)
  THEN
   -- Preserve ONLY the complete inspected retention contract. Matching a name
   -- or a prefix alone is never sufficient. No trigger/function/grant is altered.
   IF r.nspname='public' AND r.relname='academic_years' AND r.tgname='m11_retain_year'
    AND EXISTS (
     SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_catalog.pg_language l ON l.oid=p.prolang
     WHERE t.oid=r.trigger_oid AND t.tgtype=11 AND t.tgenabled='O' AND t.tgnargs=0
      AND t.tgattr=''::int2vector AND t.tgqual IS NULL AND t.tgconstraint=0
      AND NOT t.tgdeferrable AND NOT t.tginitdeferred AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
      AND n.nspname='public' AND p.proname='guard_academic_year_delete'
      AND p.proowner='postgres'::regrole AND p.prokind='f' AND p.pronargs=0
      AND p.prorettype='trigger'::regtype AND NOT p.proretset AND NOT p.prosecdef
      AND NOT p.proisstrict AND NOT p.proleakproof AND p.provolatile='v' AND p.proparallel='u'
      AND l.lanname='plpgsql' AND p.proconfig=ARRAY['search_path=pg_catalog, public']
      AND regexp_replace(p.prosrc,'[[:space:]]','','g')=regexp_replace(m->>'retainedAcademicYearGuardBody','[[:space:]]','','g')
    ) THEN
    INSERT INTO pg_temp.insync_retained_trigger_contract
     SELECT t.tgrelid,t.tgname,pg_catalog.pg_get_triggerdef(t.oid),p.oid,
      pg_catalog.pg_get_functiondef(p.oid),p.proacl::text,t.tgenabled
     FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid WHERE t.oid=r.trigger_oid;
    CONTINUE;
   END IF;
   RAISE EXCEPTION 'Unexpected trigger %.%.%: inspect before updating',r.nspname,r.relname,r.tgname
   USING DETAIL='This trigger is not defined in the reviewed repository catalog. Its name alone cannot establish compatible behavior.',
    HINT='Run supabase/inspection/05_consolidated_trigger_compatibility.sql and review the trigger and function definitions. Do not drop or disable it, or bypass this guard.';
  END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created'
  AND tgfoid=pg_catalog.to_regprocedure('public.handle_new_user()') AND tgenabled IN ('O','A'))
 THEN RAISE EXCEPTION 'Expected active Auth signup trigger missing: reconcile operator setup first'; END IF;
 FOR r IN SELECT p.*,p.oid::regprocedure::text AS identity FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' LOOP
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(m->'functions') e WHERE e->>'name'=r.proname) THEN
   IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'functions') e WHERE e->>'identity'=r.identity)
   THEN RAISE EXCEPTION 'Unexpected overload %: inventory callers/dependencies; no function will be dropped',r.identity; END IF;
   IF r.proowner <> 'postgres'::regrole OR r.prokind <> 'f' THEN RAISE EXCEPTION 'Unexpected owner/routine kind on %',r.identity; END IF;
   IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'functions') e WHERE e->>'identity'=r.identity
    AND e->>'result'=pg_catalog.pg_get_function_result(r.oid)
    AND (e->'names'='null'::jsonb OR e->'names'=to_jsonb(r.proargnames))
    AND e->'modes'=coalesce(to_jsonb(r.proargmodes::text[]),'null'::jsonb))
   THEN RAISE EXCEPTION 'Incompatible return/argument contract %: plan a dependency-aware transition, no DROP/CASCADE attempted',r.identity; END IF;
  ELSIF r.prosecdef AND (pg_catalog.has_function_privilege('anon',r.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',r.oid,'EXECUTE'))
  THEN RAISE EXCEPTION 'Unexpected exposed SECURITY DEFINER %: review before updating',r.identity; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m')
  AND (pg_catalog.has_table_privilege('anon',c.oid,'SELECT') OR pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT')))
 THEN RAISE EXCEPTION 'Unexpected exposed public view: inspect permissions/dependencies'; END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects' AND p.permissive='RESTRICTIVE'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'policies') e WHERE e->>'schema'='storage' AND e->>'name'=p.policyname))
 THEN RAISE EXCEPTION 'Unexpected restrictive Storage policy: review provider/other-bucket behavior'; END IF;
 -- Inspect ALL existing column definitions; do not treat IF NOT EXISTS as repair.
 FOR r IN SELECT c.relname AS tab,a.attname AS name,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,
  pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS def,a.attgenerated,a.attidentity
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
  WHERE n.nspname='public' AND m->'tables' ? c.relname AND a.attnum>0 AND NOT a.attisdropped LOOP
  IF r.attgenerated<>'' OR r.attidentity<>'' OR NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements((m->'baseColumns')||(m->'columns')) e WHERE e->>'tab'=r.tab AND e->>'name'=r.name
    AND e->>'type'=r.type AND (e->>'required')::boolean=r.required AND e->>'def' IS NOT DISTINCT FROM r.def)
  THEN RAISE EXCEPTION 'Incompatible column public.%.% (type/nullability/default/generated): inspect and propose a safe conversion',r.tab,r.name
   USING HINT='For existing academic_year_id history columns, run supabase/inspection/05_consolidated_trigger_compatibility.sql. Their type, defaults, foreign keys, indexes and dependent routines require review; none will be dropped or guessed.';
  END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'baseColumns') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND attname=r.e->>'name' AND NOT attisdropped)
  THEN RAISE EXCEPTION 'Missing baseline column public.%.%: restore/reconcile explicitly',r.e->>'tab',r.e->>'name'; END IF;
 END LOOP;
 -- A populated, partially defined evidence table needs an explicit transition:
 -- defaults must not invent version identities, review statuses or timestamps.
 FOR r IN SELECT e FROM jsonb_array_elements(m->'columns') e LOOP
  IF pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND attname=r.e->>'name' AND NOT attisdropped) THEN
   IF NOT m->'baseTables' ? (r.e->>'tab') THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',r.e->>'tab') INTO populated;
    IF populated THEN RAISE EXCEPTION 'Incompatible populated partial evidence table public.% missing %: prepare a reviewed transition; no identity/status/timestamp backfill',r.e->>'tab',r.e->>'name'; END IF;
   ELSIF r.e->>'tab'='documents' AND r.e->>'name' IN ('upload_version','review_revision') THEN
    FOREACH t IN ARRAY ARRAY['document_versions','document_review_events'] LOOP
     IF pg_catalog.to_regclass(format('public.%I',t)) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',t) INTO populated;
      IF populated THEN RAISE EXCEPTION 'Incompatible current document version contract: missing documents.% with existing % history; no version-zero backfill',r.e->>'name',t; END IF;
     END IF;
    END LOOP;
   END IF;
  END IF;
 END LOOP;
 FOR r IN SELECT c.relname AS tab,x.conname AS name,regexp_replace(pg_catalog.pg_get_constraintdef(x.oid),' NOT VALID$','') AS def
  FROM pg_catalog.pg_constraint x JOIN pg_catalog.pg_class c ON c.oid=x.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND m->'tables' ? c.relname AND x.contype<>'t' LOOP
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements((m->'baseConstraints')||(m->'constraints')) e WHERE e->>'tab'=r.tab AND e->>'name'=r.name AND e->>'def'=r.def)
  THEN RAISE EXCEPTION 'Incompatible/unreviewed constraint public.%.%: inspect definition, no constraint is dropped',r.tab,r.name; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'baseConstraints') e WHERE e->>'kind'<>'c' LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND conname=r.e->>'name' AND convalidated)
  THEN RAISE EXCEPTION 'Missing/unvalidated baseline constraint public.%.%: reconcile baseline before updating',r.e->>'tab',r.e->>'name'; END IF;
 END LOOP;
 -- M03/M07/M08 hard gates: no guessed deduplication, relationships or evidence.
 IF EXISTS (SELECT 1 FROM public.attendance_logs GROUP BY intern_id,log_date HAVING count(*)>1)
 OR EXISTS (SELECT 1 FROM public.attendance_logs WHERE time_out IS NULL GROUP BY intern_id HAVING count(*)>1)
 OR EXISTS (SELECT 1 FROM public.attendance_exceptions WHERE status='Pending' GROUP BY intern_id,log_date HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Duplicate attendance daily/open/Pending identities: run inspection/03_phase2_attendance.sql and review per-record repairs'; END IF;
 IF EXISTS (SELECT 1 FROM public.documents GROUP BY intern_id,doc_type HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Duplicate clearance requirement identity: run inspection/04_phase4_domain.sql and preserve evidence in a reviewed repair'; END IF;
 IF EXISTS (SELECT 1 FROM public.profiles p LEFT JOIN public.interns i ON i.id=p.id LEFT JOIN public.profiles staff ON staff.id=i.instructor_id
  WHERE (p.role='intern' AND i.id IS NULL) OR (i.instructor_id IS NOT NULL AND (p.role<>'intern' OR staff.role IS DISTINCT FROM 'instructor' OR staff.status IS DISTINCT FROM 'Active')))
 THEN RAISE EXCEPTION 'Legacy role/assignment anomaly: review inspection/04_phase4_domain.sql; no account or assignment repaired'; END IF;
 IF (SELECT count(*) FROM public.academic_years WHERE is_current)>1
 THEN RAISE EXCEPTION 'Conflicting current academic years: an authorized operator must review and explicitly choose one active year; no automatic repair'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='academic_years' AND column_name='archived_at') THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.academic_years WHERE is_current AND archived_at IS NOT NULL)' INTO populated;
  IF populated THEN RAISE EXCEPTION 'Incompatible archived current year: review and choose an active year before updating'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='legacy_evidence') THEN
  EXECUTE $check$SELECT EXISTS(SELECT 1 FROM public.documents d WHERE legacy_evidence IS NOT NULL AND (
   legacy_evidence->>'id' IS DISTINCT FROM d.id::text OR legacy_evidence->>'intern_id' IS DISTINCT FROM d.intern_id::text
   OR legacy_evidence->>'upload_version' IS DISTINCT FROM '0' OR legacy_evidence->>'provenance' IS DISTINCT FROM 'stored-legacy-metadata-unverified'))$check$ INTO populated;
  IF populated THEN RAISE EXCEPTION 'Incompatible legacy metadata snapshot: inspect original evidence; no reconstruction'; END IF;
 END IF;
END $preflight$;

-- M01/M02/M03/M06/M08/M10/M11 additive final columns and six evidence tables.
-- Missing old baseline tables are a prerequisite failure, never silently recreated.
DO $columns$
DECLARE m jsonb; t text; r record;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 FOR t IN SELECT jsonb_array_elements_text(m->'tables') LOOP
  IF pg_catalog.to_regclass(format('public.%I',t)) IS NULL THEN EXECUTE format('CREATE TABLE public.%I ()',t); END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'columns') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND attname=r.e->>'name' AND NOT attisdropped) THEN
   EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s%s%s',r.e->>'tab',r.e->>'name',r.e->>'type',
    CASE WHEN r.e->>'def' IS NULL THEN '' ELSE ' DEFAULT '||(r.e->>'def') END,
    CASE WHEN (r.e->>'required')::boolean THEN ' NOT NULL' ELSE '' END);
  END IF;
 END LOOP;
END $columns$;

-- Final function bodies only: superseded M01/M02/M03 and M08 helpers are folded
-- into their latest definitions. Identity-preserving CREATE OR REPLACE retains
-- dependent objects; preflight rejects unexpected overloads/incompatible returns.
${target.functions.map((fn) => `-- Latest source: migrations/${fn.source}; ${fn.identity}\n${fn.def};`).join('\n')}

-- M01/M03/M06/M08/M10 constraints; preserve already VALIDATED M05/M09 checks.
-- New-write CHECKs from M03/M06 remain NOT VALID on old history; no backfill.
DO $constraints$
DECLARE m jsonb; r record; actual text; already_valid boolean;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 -- M15 expands the reviewed three-role CHECK without touching rows. Preflight
 -- accepts only known baseline/final definitions, never arbitrary role drift.
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND conname='profiles_role_check'
 AND pg_get_constraintdef(oid) IS DISTINCT FROM (SELECT e->>'def' FROM jsonb_array_elements(m->'baselineChecks') e WHERE e->>'tab'='profiles' AND e->>'name'='profiles_role_check')) THEN
  ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
 END IF;
 -- Baseline CHECKs absent in a supported older catalog can be restored only
 -- by validating existing data. A violation aborts; no value is coerced/deleted.
 FOR r IN SELECT e FROM jsonb_array_elements(m->'baselineChecks') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND conname=r.e->>'name') THEN
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s',r.e->>'tab',r.e->>'name',r.e->>'def');
  ELSE
   EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',r.e->>'tab',r.e->>'name');
  END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'constraints') e ORDER BY CASE e->>'kind' WHEN 'p' THEN 0 WHEN 'u' THEN 1 WHEN 'c' THEN 2 ELSE 3 END LOOP
  SELECT regexp_replace(pg_catalog.pg_get_constraintdef(oid),' NOT VALID$',''),convalidated INTO actual,already_valid FROM pg_catalog.pg_constraint
   WHERE conrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND conname=r.e->>'name';
  IF NOT FOUND THEN
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s%s',r.e->>'tab',r.e->>'name',r.e->>'def',
    CASE WHEN NOT (r.e->>'validated')::boolean THEN ' NOT VALID' ELSE '' END);
  ELSIF actual<>r.e->>'def' THEN RAISE EXCEPTION 'Constraint definition conflict %.%',r.e->>'tab',r.e->>'name'; END IF;
  IF (r.e->>'validated')::boolean AND already_valid IS FALSE THEN
   EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',r.e->>'tab',r.e->>'name');
  END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'indexes') e LOOP
  IF pg_catalog.to_regclass(format('public.%I',r.e->>'name')) IS NULL THEN EXECUTE r.e->>'def'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index i WHERE i.indexrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'name'))
   AND i.indrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND i.indisvalid AND i.indisready AND pg_catalog.pg_get_indexdef(i.indexrelid)=r.e->>'def')
  THEN RAISE EXCEPTION 'Outdated/invalid index public.%: inspect dependencies, no DROP attempted',r.e->>'name'; END IF;
 END LOOP;
END $constraints$;

-- M01/M02/M06/M07/M08/M10/M11 final row/column ACL and RLS contracts.
${attendanceBucket}
-- Replace domain policies intentionally: old permissive OR policies defeat scope.
-- Preserve unrelated tables/functions/provider grants; clear API column grants too.
DO $security$
DECLARE m jsonb; t text; r record; cols text; ddl text;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 EXECUTE 'REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated';
 EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
 FOR t IN SELECT jsonb_array_elements_text(m->'tables') LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  FOR r IN SELECT policyname FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename=t LOOP EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,t); END LOOP;
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
  SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass(format('public.%I',t)) AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT(%s),INSERT(%s),UPDATE(%s),REFERENCES(%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,cols,cols,t);
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'grants') e LOOP EXECUTE format('GRANT %s ON TABLE public.%I TO authenticated',r.e->>'privilege',r.e->>'tab'); END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'columnGrants') e LOOP EXECUTE format('GRANT %s(%I) ON TABLE public.%I TO authenticated',r.e->>'privilege',r.e->>'name',r.e->>'tab'); END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'functions') e LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.e->>'identity');
  IF (r.e->>'allowed')::boolean THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',r.e->>'identity'); END IF;
 END LOOP;
 -- M01 other-bucket predicates stay effective; documents are excluded exactly
 -- once. Existing final managed Storage policies are replaced below, not wrapped.
 FOR r IN SELECT * FROM pg_catalog.pg_policies p WHERE schemaname='storage' AND tablename='objects'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'policies') e WHERE e->>'schema'='storage' AND e->>'name'=p.policyname) LOOP
  ddl:=format('ALTER POLICY %I ON storage.objects',r.policyname);
  IF r.cmd IN ('ALL','SELECT','UPDATE','DELETE') AND coalesce(r.qual,'') NOT LIKE '((bucket_id <> ''documents''::text) AND %)'
  THEN ddl:=ddl||format(' USING (bucket_id <> ''documents'' AND (%s))',coalesce(r.qual,'true')); END IF;
  IF r.cmd IN ('ALL','INSERT','UPDATE') AND coalesce(r.with_check,r.qual,'') NOT LIKE '((bucket_id <> ''documents''::text) AND %)'
  THEN ddl:=ddl||format(' WITH CHECK (bucket_id <> ''documents'' AND (%s))',coalesce(r.with_check,r.qual,'true')); END IF;
  IF ddl<>format('ALTER POLICY %I ON storage.objects',r.policyname) THEN EXECUTE ddl; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'policies') e LOOP
  IF r.e->>'schema'='storage' THEN EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects',r.e->>'name'); END IF;
  ddl:=format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',r.e->>'name',r.e->>'schema',r.e->>'tab',r.e->>'permissive',r.e->>'cmd',
   (SELECT string_agg(CASE WHEN x='public' THEN 'PUBLIC' ELSE quote_ident(x) END,',') FROM jsonb_array_elements_text(r.e->'roles') x));
  IF r.e->>'qual' IS NOT NULL THEN ddl:=ddl||' USING ('||(r.e->>'qual')||')'; END IF;
  IF r.e->>'with_check' IS NOT NULL THEN ddl:=ddl||' WITH CHECK ('||(r.e->>'with_check')||')'; END IF;
  EXECUTE ddl;
 END LOOP;
 -- M08 API DELETE is receipt-scoped by restrictive policies, never global cleanup.
 GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
 -- M04 hardens only this existing bucket. Existing object bytes/history retained.
 UPDATE storage.buckets SET public=false,file_size_limit=10485760,allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'] WHERE id='documents';
END $security$;

-- M01/M02/M03/M07/M08/M10/M11 final triggers, including deferred account guards.
-- Named known triggers are recreated to repair outdated timing/functions/enabling.
DO $triggers$
DECLARE m jsonb; r record;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'triggers') e LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I',r.e->>'name',r.e->>'schema',r.e->>'tab');
  EXECUTE r.e->>'def';
 END LOOP;
END $triggers$;
SET LOCAL check_function_bodies = on;

-- Fail before COMMIT if any final function/policy/ACL/trigger contract differs.
DO $verify$
DECLARE m jsonb; r record; actual record;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 FOR r IN SELECT * FROM pg_temp.insync_retained_trigger_contract LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
   WHERE t.tgrelid=r.table_oid AND t.tgname=r.trigger_name
    AND pg_catalog.pg_get_triggerdef(t.oid)=r.trigger_definition AND t.tgenabled=r.enabled_mode
    AND p.oid=r.function_oid AND p.proowner='postgres'::regrole
    AND pg_catalog.pg_get_functiondef(p.oid)=r.function_definition AND p.proacl::text IS NOT DISTINCT FROM r.function_acl)
  THEN RAISE EXCEPTION 'Retained academic-year protection changed; update aborted'; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'functions') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(r.e->>'identity') AND p.proowner='postgres'::regrole
   AND pg_catalog.pg_get_functiondef(p.oid)=r.e->>'def' AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
   AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')=(r.e->>'allowed')::boolean)
  THEN RAISE EXCEPTION 'Final RPC/security definition failed: %',r.e->>'identity'; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'triggers') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid=pg_catalog.to_regclass(format('%I.%I',r.e->>'schema',r.e->>'tab'))
   AND t.tgname=r.e->>'name' AND t.tgenabled='O' AND pg_catalog.pg_get_triggerdef(t.oid)=r.e->>'def')
  THEN RAISE EXCEPTION 'Final trigger failed: %.%.%',r.e->>'schema',r.e->>'tab',r.e->>'name'; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'policies') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname=r.e->>'schema' AND p.tablename=r.e->>'tab' AND p.policyname=r.e->>'name'
   AND p.permissive=r.e->>'permissive' AND p.cmd=r.e->>'cmd' AND to_jsonb(p.roles::text[])=r.e->'roles'
   AND p.qual IS NOT DISTINCT FROM r.e->>'qual' AND p.with_check IS NOT DISTINCT FROM r.e->>'with_check')
  THEN RAISE EXCEPTION 'Final policy failed: %.%.%',r.e->>'schema',r.e->>'tab',r.e->>'name'; END IF;
 END LOOP;
 FOR r IN SELECT c.oid,c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND m->'tables' ? c.relname LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=r.oid AND relrowsecurity)
   OR pg_catalog.has_table_privilege('anon',r.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  THEN RAISE EXCEPTION 'Final RLS/anon table access failed: %',r.relname; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a, LATERAL pg_catalog.aclexplode(a.attacl) x WHERE a.attrelid=r.oid
   AND x.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid) AND NOT EXISTS
    (SELECT 1 FROM jsonb_array_elements(m->'columnGrants') e WHERE x.grantee='authenticated'::regrole::oid
     AND e->>'tab'=r.relname AND e->>'name'=a.attname AND e->>'privilege'=x.privilege_type))
  THEN RAISE EXCEPTION 'Unexpected API column grant: %',r.relname; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.aclexplode((SELECT relacl FROM pg_catalog.pg_class WHERE oid=r.oid)) x
   WHERE x.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid) AND NOT EXISTS
    (SELECT 1 FROM jsonb_array_elements(m->'grants') e WHERE x.grantee='authenticated'::regrole::oid AND e->>'tab'=r.relname AND e->>'privilege'=x.privilege_type))
  THEN RAISE EXCEPTION 'Unexpected API table grant: %',r.relname; END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='documents' AND NOT public AND file_size_limit=10485760
  AND allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png']::text[])
 THEN RAISE EXCEPTION 'Private documents bucket verification failed'; END IF;
 RAISE NOTICE 'INSync final contracts installed. M05/M09 history validation remains a separate reviewed gate; live API/Auth/Storage still requires verification.';
END $verify$;
-- Delivered only on successful COMMIT; a rollback sends no schema-cache notification.
NOTIFY pgrst, 'reload schema';
COMMIT;
`;
writeFileSync(new URL('../supabase/INSync_Consolidated_Update.sql', import.meta.url), sql);
console.log(`Generated standalone updater: ${target.functions.length} final functions, ${target.policies.length} policies, ${target.triggers.length} triggers, ${target.indexes.length} indexes; ${Buffer.byteLength(sql)} bytes.`);

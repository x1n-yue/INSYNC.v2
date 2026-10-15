// Offline artifact generator; no network. Default: fresh installer only.
// --prepare-reset also reads a private checkpoint and prepares OLD reset artifacts;
// never use that flag for the new-project setup. This script executes no SQL.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8').replace(/^\uFEFF/,'');
const write=(f,s)=>writeFileSync(new URL(`../${f}`,import.meta.url),s);
const hash=s=>createHash('md5').update(s).digest('hex');
const quote=s=>`'${s.replaceAll("'","''")}'`;
const ident=s=>`"${s.replaceAll('"','""')}"`;
const consolidated=read('supabase/INSync_Consolidated_Update.sql');
const m=JSON.parse(consolidated.split('$insync_manifest$')[1]);
const kept=['public.handle_new_user()','public.can_read_document_object(text)','public.can_insert_reserved_document(text)','public.can_delete_staged_document(text)'];
const tables=m.tables;
const cols=[...new Map([...m.baseColumns].reverse().map(c=>[`${c.tab}.${c.name}`,c])).values(),...m.columns];
// First baseline variant is the seed-free baseline, not the historical variants.
for(const c of cols){const canonical=m.baseColumns.find(x=>x.tab===c.tab&&x.name===c.name);if(canonical)Object.assign(c,canonical);if(c.tab==='evaluations'&&c.name==='overall_score')c.required=true;}
const cons=[...new Map([...m.baseConstraints,...m.constraints].map(c=>[`${c.tab}.${c.name}`,c])).values()];
for(const c of cons){const canonical=m.baseConstraints.find(x=>x.tab===c.tab&&x.name===c.name);if(canonical&&!m.constraints.some(x=>x.tab===c.tab&&x.name===c.name))Object.assign(c,canonical);}
// Exact reviewed source coverage; no reset/demo fixture is executed or copied.
const sources=consolidated.split('\n').filter(l=>l.startsWith('-- migrations/'));
for(const line of sources){const match=line.match(/migrations\/(\S+) SHA256 ([A-Fa-f0-9]+)/);if(!match||createHash('sha256').update(read(`supabase/migrations/${match[1]}`)).digest('hex')!==match[2])throw Error('Consolidated definitions are stale; regenerate them offline before preparing reset');}
sources.unshift(`-- initial_schema.sql SHA256 ${createHash('sha256').update(read('supabase/initial_schema.sql')).digest('hex')}`);
sources.push(`-- M05_validate_attendance.sql SHA256 ${createHash('sha256').update(read('supabase/migrations/M05_validate_attendance.sql')).digest('hex')}`);
sources.push(`-- M09_validate_domain.sql SHA256 ${createHash('sha256').update(read('supabase/migrations/M09_validate_domain.sql')).digest('hex')}`);
const policies=m.policies;
const attendanceBucket=read('supabase/migrations/M17_company_attendance.sql').match(/-- M17_BUCKET_BEGIN:[^\n]*\n([\s\S]*?)-- M17_BUCKET_END/)[1];
const policyDDL=p=>`CREATE POLICY ${ident(p.name)} ON ${ident(p.schema)}.${ident(p.tab)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(r=>r==='public'?'PUBLIC':ident(r)).join(',')}\n${p.qual?` USING (${p.qual})`:''}${p.with_check?` WITH CHECK (${p.with_check})`:''};`;
const providerGuard=`DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Trusted postgres operator required'; END IF;
 IF to_regclass('auth.users') IS NULL OR to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL OR to_regprocedure('auth.uid()') IS NULL
 THEN RAISE EXCEPTION 'Real Supabase Auth/Storage provider baseline required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='documents' AND NOT public AND file_size_limit=10485760
  AND cardinality(allowed_mime_types)=3
  AND allowed_mime_types @> ARRAY['application/pdf','image/jpeg','image/png']
  AND allowed_mime_types <@ ARRAY['application/pdf','image/jpeg','image/png'])
 THEN RAISE EXCEPTION 'Provision/review the existing private documents bucket (10 MiB PDF/JPEG/PNG) first; no managed bucket changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Provider Storage RLS must remain enabled'; END IF;
END $$;`;
const freshBody=`SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';
SET LOCAL lock_timeout='10s';
SET LOCAL check_function_bodies=off;
SELECT pg_advisory_xact_lock(404,1);
${providerGuard}
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S'))
 THEN RAISE EXCEPTION 'Fresh installation requires blank application tables, not an existing-database update'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  AND p.oid::regprocedure::text NOT IN (${kept.map(quote).join(',')}))
 THEN RAISE EXCEPTION 'Unreviewed public routines remain; do not overwrite a shared application'; END IF;
 IF EXISTS(SELECT 1 FROM pg_type t WHERE t.typnamespace='public'::regnamespace)
 THEN RAISE EXCEPTION 'Unreviewed public types remain: fresh application requires a reviewed empty namespace'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE deleted_at IS NULL AND (email IS NULL OR btrim(email)=''))
 THEN RAISE EXCEPTION 'Retained Auth identity has no supported email: review reconciliation, no invented email'; END IF;
END $$;
${tables.map(tab=>`CREATE TABLE public.${ident(tab)} (\n${cols.filter(c=>c.tab===tab).map(c=>` ${ident(c.name)} ${c.type}${c.def?` DEFAULT ${c.def}`:''}${c.required?' NOT NULL':''}`).join(',\n')}\n);`).join('\n')}
-- Latest M01-M18 routines; M13 fixes the exact frontend RPC contracts.
${m.functions.map(f=>`-- Latest source: ${f.source||'reviewed consolidated contract'}; ${f.identity}\n${f.def};`).join('\n')}
-- Fresh data: M05/M09 checks are VALIDATED and score NOT NULL from creation.
${['p','u','c','f'].flatMap(kind=>cons.filter(c=>c.kind===kind).map(c=>`ALTER TABLE public.${ident(c.tab)} ADD CONSTRAINT ${ident(c.name)} ${c.def};`)).join('\n')}
${m.indexes.map(i=>`${i.def};`).join('\n')}
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
${tables.map(t=>`ALTER TABLE public.${ident(t)} ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON TABLE public.${ident(t)} FROM PUBLIC,anon,authenticated;`).join('\n')}
${m.grants.map(g=>`GRANT ${g.privilege} ON public.${ident(g.tab)} TO authenticated;`).join('\n')}
${m.columnGrants.map(g=>`GRANT ${g.privilege}(${ident(g.name)}) ON public.${ident(g.tab)} TO authenticated;`).join('\n')}
${m.functions.map(f=>`REVOKE ALL ON FUNCTION ${f.identity} FROM PUBLIC,anon,authenticated;${f.allowed?`\nGRANT EXECUTE ON FUNCTION ${f.identity} TO authenticated;`:''}`).join('\n')}
${policies.filter(p=>p.schema==='public').map(policyDDL).join('\n')}
-- Preserve existing application-owned Storage policies EXACTLY when compatible.
-- M17 creates its own private attendance-evidence bucket. Existing provider
-- tables, objects, other buckets and unrelated policies remain unchanged.
${attendanceBucket}
DO $storage$ DECLARE p jsonb; actual record; BEGIN
 FOR p IN SELECT * FROM jsonb_array_elements(${quote(JSON.stringify(policies.filter(p=>p.schema==='storage')))}::jsonb) LOOP
  SELECT * INTO actual FROM pg_policies WHERE schemaname='storage' AND tablename=p->>'tab' AND policyname=p->>'name';
  IF FOUND THEN
   IF actual.permissive<>p->>'permissive' OR actual.cmd<>p->>'cmd' OR to_jsonb(actual.roles::text[])<>p->'roles'
    OR actual.qual IS DISTINCT FROM p->>'qual' OR actual.with_check IS DISTINCT FROM p->>'with_check'
   THEN RAISE EXCEPTION 'Unreviewed Storage policy %: no provider policy overwritten',p->>'name'; END IF;
  ELSE
   EXECUTE (CASE p->>'name' ${policies.filter(p=>p.schema==='storage').map(p=>`WHEN ${quote(p.name)} THEN ${quote(policyDDL(p))}`).join(' ')} END);
  END IF;
 END LOOP;
 IF NOT has_table_privilege('authenticated','storage.objects','SELECT') OR NOT has_table_privilege('authenticated','storage.objects','INSERT') OR NOT has_table_privilege('authenticated','storage.objects','DELETE')
 THEN RAISE EXCEPTION 'Provider Storage privileges require review; no blanket provider grants added'; END IF;
END $storage$;
${m.triggers.filter(t=>t.schema==='public').map(t=>t.def+';').join('\n')}
-- Preserve the existing INSync signup integration, never delete Auth users.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created') THEN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created'
   AND tgenabled='O' AND pg_get_triggerdef(oid)=${quote(m.triggers.find(t=>t.schema==='auth').def)})
  THEN RAISE EXCEPTION 'Unreviewed Auth signup trigger: no provider trigger replaced'; END IF;
 ELSE
  ${m.triggers.find(t=>t.schema==='auth').def};
 END IF;
END $$;
SET LOCAL check_function_bodies=on;
-- All remaining Auth identities get only Pending Intern, without metadata roles.
INSERT INTO public.profiles(id,email,full_name,role,status,requested_role)
 SELECT id,email,email,'intern','Pending','intern' FROM auth.users WHERE deleted_at IS NULL;
INSERT INTO public.interns(id) SELECT id FROM public.profiles;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.profiles WHERE role<>'intern' OR status<>'Pending')
 THEN RAISE EXCEPTION 'Unexpected privileged Auth reconciliation'; END IF;
END $$;
NOTIFY pgrst,'reload schema';`;
write('supabase/INSync_Fresh_Install.sql',`-- Fresh, empty application catalog; existing Auth/Storage retained. NOT the updater.
-- NEW project: read INSync_New_Project_Setup_README.md. No reset is required.
-- Existing authorized rebuild only: INSync_Reset_Rebuild_README.md.
-- No account privileges inferred from metadata.
${sources.join('\n')}
BEGIN;
${freshBody}
COMMIT;
`);
if (!process.argv.includes('--prepare-reset')) {
 console.log(JSON.stringify({generated:['supabase/INSync_Fresh_Install.sql'],freshTables:tables.length,freshFunctions:m.functions.length,resetPrepared:false}));
 process.exit(0);
}
const raw=JSON.parse(read('.insync-recovery/pre-reset-exact.json')).rows.find(r=>r.checkpoint_json).checkpoint_json;
const cp=JSON.parse(raw);
if(cp.tables.length!==18||cp.tables.some(t=>!tables.includes(t.name)||t.owner!=='postgres'||t.kind!=='r'))throw Error('Unexpected/shared public relations: stop');
if(cp.types.some(t=>!['c','b'].includes(t.kind)||(!tables.includes(t.name)&&!tables.includes(t.name.slice(1)))))throw Error('Unreviewed public type');
if(cp.functions.some(f=>f.owner!=='postgres'))throw Error('Unexpected routine owner');
const scope={tables,functions:cp.functions.map(f=>({identity:f.identity,name:f.name,md5:hash(f.definition)})),triggers:cp.triggers.filter(t=>t.schema==='public'||t.function.startsWith('public.')),
 policies:cp.policies, fingerprints:cp.data_fingerprints,columns:cp.columns,constraints:cp.constraints,indexes:cp.indexes,types:cp.types,publications:cp.publications};
const resetBody=`SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(404,1);
CREATE TEMP TABLE insync_reset_scope(value jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO pg_temp.insync_reset_scope VALUES (${quote(JSON.stringify(scope))}::jsonb);
DO $reset$ DECLARE m jsonb; r record; fn jsonb; t text; actual text; progress boolean; remaining integer;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_reset_scope;
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Reset requires trusted postgres operator'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S') AND NOT m->'tables' ? c.relname)
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'functions') f WHERE f->>'identity'=p.oid::regprocedure::text))
 THEN RAISE EXCEPTION 'Unexpected/shared public object: stop reset'; END IF;
 IF EXISTS(SELECT 1 FROM pg_type t WHERE t.typnamespace='public'::regnamespace AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'types') x WHERE x->>'name'=t.typname AND x->>'kind'=t.typtype::text))
 THEN RAISE EXCEPTION 'Unreviewed public type: stop reset'; END IF;
 FOR t IN SELECT jsonb_array_elements_text(m->'tables') ORDER BY 1 LOOP
  IF to_regclass(format('public.%I',t)) IS NULL THEN RAISE EXCEPTION 'Reset scope changed/missing public.%',t; END IF;
  EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
  EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id::text),''[]''::jsonb)::text) FROM public.%I x',t) INTO actual;
  IF actual IS DISTINCT FROM m->'fingerprints'->>t THEN RAISE EXCEPTION 'Checkpoint data changed in public.%: recapture/review before deletion',t; END IF;
 END LOOP;
 FOR r IN SELECT c.relname AS tab,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,
  pg_get_expr(d.adbin,d.adrelid) AS def,a.attgenerated,a.attidentity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
  WHERE n.nspname='public' AND m->'tables' ? c.relname AND a.attnum>0 AND NOT a.attisdropped LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'columns') x WHERE x->>'table'=r.tab AND x->>'name'=r.name AND x->>'type'=r.type
   AND (x->>'required')::boolean=r.required AND x->>'default' IS NOT DISTINCT FROM r.def AND x->>'generated'=r.attgenerated AND x->>'identity'=r.attidentity)
  THEN RAISE EXCEPTION 'Unreviewed/changed column public.%.%: stop reset',r.tab,r.name; END IF;
 END LOOP;
 FOR r IN SELECT c.relname AS tab,x.* FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND m->'tables' ? c.relname LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'constraints') x WHERE x->>'schema'='public' AND x->>'table'=r.tab AND x->>'name'=r.conname AND x->>'definition'=pg_get_constraintdef(r.oid))
  THEN RAISE EXCEPTION 'Unreviewed/changed constraint: %.%',r.tab,r.conname; END IF;
 END LOOP;
 FOR r IN SELECT i.oid,i.relname FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid WHERE c.relnamespace='public'::regnamespace AND m->'tables' ? c.relname LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'indexes') x WHERE x->>'name'=r.relname AND x->>'definition'=pg_get_indexdef(r.oid))
  THEN RAISE EXCEPTION 'Unreviewed/changed index: %',r.relname; END IF;
 END LOOP;
 FOR fn IN SELECT * FROM jsonb_array_elements(m->'functions') LOOP
  IF to_regprocedure(fn->>'identity') IS NULL OR md5(pg_get_functiondef(to_regprocedure(fn->>'identity')))<>fn->>'md5'
  THEN RAISE EXCEPTION 'Routine definition changed since checkpoint: %',fn->>'identity'; END IF;
 END LOOP;
 -- Keep INSync's Auth trigger and eight Storage policies intact. Replace only
 -- their four PUBLIC helper bodies temporarily with fail-closed implementations.
 CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $block$ BEGIN RAISE EXCEPTION 'INSync rebuild in progress'; END $block$;
 CREATE OR REPLACE FUNCTION public.can_read_document_object(p_path text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS 'SELECT false';
 CREATE OR REPLACE FUNCTION public.can_insert_reserved_document(p_path text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS 'SELECT false';
 CREATE OR REPLACE FUNCTION public.can_delete_staged_document(p_path text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS 'SELECT false';
 -- No unreviewed dependency cascades. Remove only named application-owned objects.
 FOR r IN SELECT t.*,c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND m->'tables' ? c.relname AND NOT t.tgisinternal LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'triggers') x WHERE x->>'schema'='public' AND x->>'table'=r.relname AND x->>'name'=r.tgname AND x->>'definition'=pg_get_triggerdef(r.oid))
  THEN RAISE EXCEPTION 'Unreviewed trigger: %',r.tgname; END IF;
  EXECUTE format('DROP TRIGGER %I ON public.%I',r.tgname,r.relname);
 END LOOP;
 FOR r IN SELECT p.* FROM pg_policies p WHERE p.schemaname='public' AND m->'tables' ? p.tablename LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'policies') p WHERE p->>'schemaname'='public' AND p->>'tablename'=r.tablename AND p->>'policyname'=r.policyname AND p->>'qual' IS NOT DISTINCT FROM r.qual AND p->>'with_check' IS NOT DISTINCT FROM r.with_check)
  THEN RAISE EXCEPTION 'Unreviewed application policy: %',r.policyname; END IF;
  EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,r.tablename);
 END LOOP;
 FOR r IN SELECT c.relname,x.conname FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND m->'tables' ? c.relname ORDER BY CASE x.contype WHEN 'f' THEN 0 ELSE 1 END LOOP
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I RESTRICT',r.relname,r.conname);
 END LOOP;
 FOR r IN SELECT i.relname FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid WHERE m->'tables' ? c.relname AND c.relnamespace='public'::regnamespace LOOP
  EXECUTE format('DROP INDEX public.%I RESTRICT',r.relname);
 END LOOP;
 CREATE TEMP TABLE insync_drop_functions(identity text PRIMARY KEY) ON COMMIT DROP;
 INSERT INTO pg_temp.insync_drop_functions SELECT f->>'identity' FROM jsonb_array_elements(m->'functions') f WHERE f->>'identity' NOT IN (${kept.map(quote).join(',')});
 LOOP
  progress:=false;
  FOR r IN SELECT identity FROM pg_temp.insync_drop_functions ORDER BY identity LOOP
   BEGIN
    EXECUTE 'DROP FUNCTION '||r.identity||' RESTRICT';
    DELETE FROM pg_temp.insync_drop_functions WHERE identity=r.identity;progress:=true;
   EXCEPTION WHEN dependent_objects_still_exist THEN NULL;
   END;
  END LOOP;
  SELECT count(*) INTO remaining FROM pg_temp.insync_drop_functions;
  EXIT WHEN remaining=0;
  IF NOT progress THEN RAISE EXCEPTION 'Unreviewed routine/type/cross-schema dependency remains: reset rolled back; inspect pg_depend'; END IF;
 END LOOP;
 -- All incoming application FKs removed above; external dependencies cause
 -- RESTRICT to fail and the entire transaction to roll back, not cascade.
 FOR t IN SELECT jsonb_array_elements_text(m->'tables') ORDER BY 1 LOOP
  EXECUTE format('DROP TABLE public.%I RESTRICT',t);
 END LOOP;
END $reset$;`;
write('supabase/INSync_Test_Data_Reset.sql',`-- DESTRUCTIVE, checkpoint-bound INSync APPLICATION reset only.
-- Verified project reference: upnkotnmoeaykummcnlx (operator must verify connection).
-- Never drop a provider schema, Auth user, Storage object or unrelated application.
-- Prefer the atomic combined workflow described in INSync_Reset_Rebuild_README.md.
BEGIN;
${resetBody}
COMMIT;
`);
// Private original catalog + exact numeric JSON data recovery, independent of
// the current schema. Restoration requires blank public application relations.
const originalTables=cp.tables.map(t=>`CREATE TABLE public.${ident(t.name)} (\n${cp.columns.filter(c=>c.table===t.name).map(c=>` ${ident(c.name)} ${c.type}${c.default?` DEFAULT ${c.default}`:''}${c.required?' NOT NULL':''}`).join(',\n')}\n);`).join('\n');
function acl(aclString,object,type){
 const result=[`REVOKE ALL ON ${type} ${object} FROM PUBLIC,anon,authenticated,service_role;`];
 const entries=aclString?aclString.slice(1,-1).split(','):['=X/postgres','postgres=X/postgres'];
 const map=type==='FUNCTION'?{X:'EXECUTE'}:{a:'INSERT',r:'SELECT',w:'UPDATE',d:'DELETE',D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER'};
 for(const entry of entries){const [role,rest]=entry.split('='),rights=rest.split('/')[0];const grants=[...rights].filter(c=>map[c]).map(c=>map[c]);if(grants.length)result.push(`GRANT ${grants.join(',')} ON ${type} ${object} TO ${role?ident(role):'PUBLIC'};`);}
 return result.join('\n');
}
const restoreBody=`SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';
SET LOCAL check_function_bodies=off;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')) THEN RAISE EXCEPTION 'Recovery requires reviewed empty application tables'; END IF; END $$;
${originalTables}
${cp.functions.map(f=>f.definition+';').join('\n')}
${['p','u','c','f'].flatMap(kind=>cp.constraints.filter(c=>c.schema==='public'&&c.kind===kind).map(c=>`ALTER TABLE public.${ident(c.table)} ADD CONSTRAINT ${ident(c.name)} ${c.definition};`)).join('\n')}
${cp.indexes.filter(i=>i.standalone).map(i=>i.definition+';').join('\n')}
CREATE TEMP TABLE insync_recovery(value jsonb) ON COMMIT DROP;
INSERT INTO pg_temp.insync_recovery VALUES(${quote(raw)}::jsonb);
${['profiles','companies','course_sections','academic_years','interns',...tables.filter(t=>!['profiles','companies','course_sections','academic_years','interns'].includes(t))].map(t=>`INSERT INTO public.${ident(t)} SELECT * FROM jsonb_populate_recordset(NULL::public.${ident(t)},(SELECT value->'public_data'->${quote(t)} FROM pg_temp.insync_recovery));`).join('\n')}
${cp.tables.map(t=>`${t.rls?`ALTER TABLE public.${ident(t.name)} ENABLE ROW LEVEL SECURITY;`:''}\n${acl(t.acl,`public.${ident(t.name)}`,'TABLE')}`).join('\n')}
${cp.columns.filter(c=>c.acl).map(c=>{const entries=c.acl.slice(1,-1).split(',');return entries.map(e=>{const [role,x]=e.split('='), rights=x.split('/')[0],map={a:'INSERT',r:'SELECT',w:'UPDATE',x:'REFERENCES'};return [...rights].filter(k=>map[k]).map(k=>`GRANT ${map[k]}(${ident(c.name)}) ON public.${ident(c.table)} TO ${role?ident(role):'PUBLIC'};`).join('\n');}).join('\n');}).join('\n')}
${cp.functions.map(f=>acl(f.acl,f.identity,'FUNCTION')).join('\n')}
${cp.policies.filter(p=>p.schemaname==='public').map(p=>policyDDL({schema:p.schemaname,tab:p.tablename,name:p.policyname,...p})).join('\n')}
${cp.triggers.filter(t=>t.schema==='public').map(t=>t.definition+';').join('\n')}
NOTIFY pgrst,'reload schema';`;
write('.insync-recovery/application-recovery.sql',`-- PRIVATE schema and exact test data; preserve existing Auth/Storage first.\nBEGIN;\n${restoreBody}\nCOMMIT;\n`);
// Re-establish only trusted checkpoint profile roles matched to verified identities.
const approved=cp.public_data.profiles.filter(p=>cp.auth_identities.some(a=>a.id===p.id&&a.email===p.email&&a.confirmed&&!a.deleted));
if(approved.length!==cp.public_data.profiles.length||approved.filter(p=>p.role==='admin'&&p.status==='Active').length!==1)throw Error('Owner/Admin identity ambiguous; ask before assigning privileges');
const reconcile=`-- Private reconciliation from verified pre-reset profiles, never user metadata.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM jsonb_to_recordset(${quote(JSON.stringify(approved.map(p=>({id:p.id,email:p.email,full_name:p.full_name,role:p.role,status:p.status,student_id:p.student_id??null,organization:p.organization??null}))))}::jsonb)
  AS x(id uuid,email text,full_name text,role text,status text,student_id text,organization text) LOOP
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=r.id AND email=r.email AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Verified identity changed: stop privilege reconciliation'; END IF;
  UPDATE public.profiles SET full_name=r.full_name,student_id=r.student_id,organization=r.organization,role=r.role,status=r.status WHERE id=r.id;
 END LOOP;
END $$;`;
write('.insync-recovery/verified-profile-reconciliation.sql',`BEGIN;\n${reconcile}\nCOMMIT;\n`);
const protectedState=`jsonb_build_object(
 'users',(SELECT md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY id::text),'[]'::jsonb)::text) FROM auth.users u),
 'objects',(SELECT md5(coalesce(jsonb_agg(to_jsonb(o) ORDER BY id::text),'[]'::jsonb)::text) FROM storage.objects o),
 'buckets',(SELECT md5(coalesce(jsonb_agg(to_jsonb(b) ORDER BY id),'[]'::jsonb)::text) FROM storage.buckets b),
 'auth_triggers',(SELECT md5(coalesce(jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) ORDER BY tgname),'[]'::jsonb)::text) FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal),
 'storage_policies',(SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY policyname),'[]'::jsonb)::text) FROM pg_policies p WHERE schemaname='storage'))`;
write('.insync-recovery/execute-reset-rebuild.sql',`-- PRIVATE atomic reset+fresh install+verified role reconciliation.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';
SET LOCAL lock_timeout='10s';
LOCK TABLE auth.users,storage.objects,storage.buckets IN SHARE MODE;
CREATE TEMP TABLE insync_provider_checkpoint(value jsonb) ON COMMIT DROP;
INSERT INTO pg_temp.insync_provider_checkpoint SELECT ${protectedState};
${resetBody}
${freshBody}
${reconcile}
DO $$ BEGIN IF (SELECT value FROM pg_temp.insync_provider_checkpoint) IS DISTINCT FROM ${protectedState}
 THEN RAISE EXCEPTION 'Protected Auth/Storage state changed; entire rebuild rolled back'; END IF; END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
`);
mkdirSync(new URL('../.insync-recovery/',import.meta.url),{recursive:true});
console.log(JSON.stringify({generated:['supabase/INSync_Test_Data_Reset.sql','supabase/INSync_Fresh_Install.sql'],checkpointTables:tables.length,checkpointFunctions:cp.functions.length,retainedIntegrationFunctions:kept.length,freshFunctions:m.functions.length,confirmedIdentities:approved.length}));

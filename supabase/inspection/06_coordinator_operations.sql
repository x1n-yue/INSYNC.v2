-- Read-only evidence before/after M13; no accounts or attendance rows returned.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 pg_get_userbyid(c.relowner) AS owner,
 has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,
 has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update,
 has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_delete
FROM pg_class c WHERE c.oid IN ('public.announcements'::regclass,'public.attendance_logs'::regclass);

SELECT signature,to_regprocedure(signature) IS NOT NULL AS installed
FROM unnest(ARRAY['public.send_announcement(uuid,text,text,uuid)',
 'public.verify_attendance(uuid,timestamptz,timestamptz)']) signature;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS identity_arguments,
 pg_get_function_result(p.oid) AS result,pg_get_userbyid(p.proowner) AS owner,
 p.prosecdef AS security_definer,p.proconfig AS settings,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_execute,
 pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('send_announcement','verify_attendance','bind_announcement','write_trusted_audit')
ORDER BY p.proname,identity_arguments;

SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN ('announcements','attendance_logs')
ORDER BY tablename,policyname;
SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.announcements'::regclass,'public.attendance_logs'::regclass)
ORDER BY c.relname,t.tgname;
SELECT table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='announcements' AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY column_name,grantee,privilege_type;
ROLLBACK;

-- READ ONLY. Run only on the independently verified NEW project after installation.
-- These are catalog diagnostics, not a migration and not a substitute for role tests.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id='documents';

-- Expected: 18 application tables, all with RLS enabled.
SELECT c.relname AS application_table, c.relrowsecurity AS rls_enabled
FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
ORDER BY c.relname;

-- Expected: no rows (all fresh constraints validated).
SELECT c.relname, x.conname FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid
WHERE c.relnamespace='public'::regnamespace AND NOT x.convalidated;

-- Expected: 56 public routines; 43 public + 8 application Storage policies;
-- 30 public application triggers + one on_auth_user_created Auth trigger.
SELECT count(*) AS public_routines FROM pg_proc WHERE pronamespace='public'::regnamespace;
SELECT schemaname, count(*) AS policies FROM pg_policies
WHERE schemaname IN ('public','storage') GROUP BY schemaname ORDER BY schemaname;
SELECT n.nspname, c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND t.tgname='on_auth_user_created'))
ORDER BY n.nspname,c.relname,t.tgname;

-- Inspect exact arguments, security-definer flags, and protected search_paths.
SELECT p.oid::regprocedure AS signature, p.proargnames, p.prosecdef, p.proconfig,
       pg_get_userbyid(p.proowner) AS owner,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_execute
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
AND p.proname IN ('handle_new_user','send_announcement','verify_attendance',
                 'stage_submission','finalize_submission','review_submission',
                 'stage_document_upload','finalize_document_upload','review_document_version',
                 'submit_evaluation','admin_set_assignment','audit_history','my_profile')
ORDER BY p.proname,p.oid::regprocedure::text;

-- Expected: SELECT true; INSERT/UPDATE/DELETE false. Writes use controlled RPC.
SELECT has_table_privilege('authenticated','public.announcements','SELECT') AS history_read,
       has_table_privilege('authenticated','public.announcements','INSERT') AS raw_insert,
       has_table_privilege('authenticated','public.announcements','UPDATE') AS raw_update,
       has_table_privilege('authenticated','public.announcements','DELETE') AS raw_delete;

SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
WHERE (schemaname='public' AND tablename IN ('profiles','interns','announcements','attendance_logs'))
   OR (schemaname='storage' AND tablename='objects')
ORDER BY schemaname,tablename,policyname;
COMMIT;

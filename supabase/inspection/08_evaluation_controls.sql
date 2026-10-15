-- READ ONLY, M16 follow-up. Verify project banner tcntyrwwqzyyqlzdtuer separately.
begin read only;
select current_database(),current_user;
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public'
and table_name in ('evaluation_reviews','evaluation_adjustment_events') order by table_name,ordinal_position;
select p.oid::regprocedure signature,pg_get_userbyid(proowner) owner,prosecdef,proconfig,
has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated
from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in
('save_evaluation_review','save_evaluation_review_v2','evaluation_feedback_catalog','normalize_evaluation_choices','evaluation_feedback_text','evaluation_adjustment_text','guard_evaluation_adjustment_event','admin_reroute_evaluation');
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in ('evaluation_reviews','evaluation_adjustment_events');
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('evaluation_reviews','evaluation_adjustment_events') and grantee in ('PUBLIC','anon','authenticated');
select conname,pg_get_constraintdef(oid),convalidated from pg_constraint
where conrelid=to_regclass('public.evaluation_adjustment_events');
select tgname,pg_get_triggerdef(oid) from pg_trigger
where tgrelid=to_regclass('public.evaluation_adjustment_events') and not tgisinternal;
-- No source feedback, drafts or private reasons are selected by this inspection.
select 'evaluations' category,count(*) from public.evaluations union all
select 'attendance_exceptions',count(*) from public.attendance_exceptions union all
select 'attendance_logs',count(*) from public.attendance_logs union all
select 'audit_logs',count(*) from public.audit_logs;
commit;

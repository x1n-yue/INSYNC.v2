-- READ ONLY. Verify project banner tcntyrwwqzyyqlzdtuer independently.
begin read only;
select current_database(),current_user;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id in ('documents','attendance-evidence');
select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name in ('attendance_logs','attendance_sheet_evidence','manual_attendance_events','logbook_submissions','logbook_versions','logbook_events') order by table_name,ordinal_position;
select p.oid::regprocedure signature,pg_get_userbyid(proowner) owner,prosecdef,proconfig,
has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('anon',p.oid,'EXECUTE') anon
from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in
('logbook_queue','save_logbook_draft','stage_logbook_evidence','submit_logbook','return_logbook','verify_record_logbook','admin_reroute_logbook','attendance_sheet_context','stage_attendance_sheet','finish_attendance_sheet','cancel_attendance_sheet','attendance_sheet_access','attendance_sheet_object_allowed','record_manual_attendance','revise_manual_attendance','verify_manual_attendance','verify_attendance','verify_attendance_core','check_manual_session','manual_attendance_details','manual_company_allowed','clock_in','clock_out');
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename in ('attendance_logs','attendance_sheet_evidence','manual_attendance_events','logbook_submissions','logbook_versions','logbook_events')) or (schemaname='storage' and tablename='objects');
select table_name,grantee,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in ('attendance_logs','attendance_sheet_evidence','manual_attendance_events','logbook_submissions','logbook_versions','logbook_events') and grantee in ('PUBLIC','anon','authenticated');
select c.relname,conname,pg_get_constraintdef(x.oid),convalidated from pg_constraint x join pg_class c on c.oid=x.conrelid
where c.relnamespace='public'::regnamespace and c.relname in ('attendance_logs','attendance_sheet_evidence','manual_attendance_events','logbook_submissions','logbook_versions','logbook_events');
select c.relname,tgname,tgenabled,pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and c.relnamespace='public'::regnamespace and c.relname in ('attendance_logs','attendance_sheet_evidence','manual_attendance_events','logbook_submissions','logbook_versions','logbook_events');
select status,count(*) from public.logbook_versions group by status;
-- Reconcile existing row counts before/after rollout; no private sheets selected.
select 'attendance_logs' category,count(*) from public.attendance_logs union all
select 'attendance_exceptions',count(*) from public.attendance_exceptions union all
select 'audit_logs',count(*) from public.audit_logs;
commit;

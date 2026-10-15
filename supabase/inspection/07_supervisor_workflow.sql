-- READ ONLY. Verify SQL Editor project banner: tcntyrwwqzyyqlzdtuer.
-- This file does not prove project identity; the operator must verify the connection.
begin read only;
select current_database(),current_user,version();
select c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) owner
from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v','m') order by 1;
select conname,pg_get_constraintdef(oid),convalidated from pg_constraint
where conrelid in ('public.profiles'::regclass,'public.interns'::regclass,'public.evaluations'::regclass) order by conrelid,conname;
select p.oid::regprocedure signature,pg_get_userbyid(proowner) owner,prosecdef,proconfig,
has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated
from pg_proc p where p.pronamespace='public'::regnamespace order by 1;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies
where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','auth') order by 1,2,3;
select table_name,column_name,grantee,privilege_type from information_schema.column_privileges
where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by 1,2,3,4;
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by 1,2,3;
select p.role,p.status,count(*) from public.profiles p group by p.role,p.status;
select i.id,i.company_id,i.instructor_id,p.role,p.status from public.interns i join public.profiles p on p.id=i.id
left join public.profiles c on c.id=i.instructor_id
where p.role='intern' and p.status='Active' and (i.company_id is null or c.role is distinct from 'instructor' or c.status is distinct from 'Active');
-- Historical counts: repeat after migration; M15 must not remove any records.
select 'evaluations' category,count(*) from public.evaluations union all
select 'attendance_exceptions',count(*) from public.attendance_exceptions union all
select 'attendance_logs',count(*) from public.attendance_logs union all
select 'audit_logs',count(*) from public.audit_logs;
commit;

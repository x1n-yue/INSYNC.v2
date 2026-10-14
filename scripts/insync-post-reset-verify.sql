BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';
SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'),
 'routines',(SELECT jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'settings',p.proconfig) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid))) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND t.tgname='on_auth_user_created'))),
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname IN ('public','storage')),
 'rls',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'enabled',c.relrowsecurity,'force',c.relforcerowsecurity,'anon_read',has_table_privilege('anon',c.oid,'SELECT'))) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'),
 'unvalidated',(SELECT count(*) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid WHERE c.relnamespace='public'::regnamespace AND NOT x.convalidated),
 'indexes',(SELECT count(*) FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid WHERE c.relnamespace='public'::regnamespace AND NOT EXISTS(SELECT 1 FROM pg_constraint z WHERE z.conindid=x.indexrelid)),
 'profiles',(SELECT jsonb_agg(jsonb_build_object('id',id,'role',role,'status',status)) FROM public.profiles),
 'counts',jsonb_build_object('companies',(SELECT count(*) FROM public.companies),'sections',(SELECT count(*) FROM public.course_sections),'years',(SELECT count(*) FROM public.academic_years),
  'attendance',(SELECT count(*) FROM public.attendance_logs),'evaluations',(SELECT count(*) FROM public.evaluations),'announcements',(SELECT count(*) FROM public.announcements),'documents',(SELECT count(*) FROM public.documents),'versions',(SELECT count(*) FROM public.document_versions),'submissions',(SELECT count(*) FROM public.submissions),'profiles',(SELECT count(*) FROM public.profiles),'interns',(SELECT count(*) FROM public.interns),'audit',(SELECT count(*) FROM public.audit_logs)),
 'announcements_grants',jsonb_build_object('read',has_table_privilege('authenticated','public.announcements','SELECT'),'insert',has_table_privilege('authenticated','public.announcements','INSERT'),'update',has_table_privilege('authenticated','public.announcements','UPDATE'),'delete',has_table_privilege('authenticated','public.announcements','DELETE')),
 'orphan_objects',(SELECT jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)) FROM storage.objects o WHERE bucket_id='documents' AND NOT EXISTS(SELECT 1 FROM public.documents d WHERE d.file_path=o.name) AND NOT EXISTS(SELECT 1 FROM public.document_versions v WHERE v.file_path=o.name) AND NOT EXISTS(SELECT 1 FROM public.submission_files f WHERE f.file_path=o.name))
) AS verification;
ROLLBACK;

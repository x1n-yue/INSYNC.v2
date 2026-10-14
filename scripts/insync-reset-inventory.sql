-- Catalog/recovery read only. Output contains application test records: keep private.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
WITH snapshot AS (SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated,'identity',a.attidentity,'acl',a.attacl::text)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',x.conname,'kind',x.contype,'definition',pg_get_constraintdef(x.oid),'validated',x.convalidated,'reference',x.confrelid::regclass::text)) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' OR x.confrelid IN (SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',i.relname,'definition',pg_get_indexdef(i.oid),'standalone',NOT EXISTS(SELECT 1 FROM pg_constraint z WHERE z.conindid=i.oid))) FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'name',p.proname,'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')),
 'types',(SELECT jsonb_agg(jsonb_build_object('name',t.typname,'kind',t.typtype,'relation',t.typrelid::regclass::text,'owner',pg_get_userbyid(t.typowner))) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'function',t.tgfoid::regprocedure::text,'definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal),
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname IN ('public','storage')),
 'dependencies',(SELECT jsonb_agg(jsonb_build_object('object',pg_describe_object(d.classid,d.objid,d.objsubid),'reference',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'kind',d.deptype)) FROM pg_depend d WHERE (d.refclassid='pg_class'::regclass AND d.refobjid IN (SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')) OR (d.refclassid='pg_proc'::regclass AND d.refobjid IN (SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')) OR (d.refclassid='pg_type'::regclass AND d.refobjid IN (SELECT t.oid FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'))),
 'public_data',(SELECT jsonb_object_agg(tab,rows) FROM (
  SELECT 'profiles' tab,coalesce(jsonb_agg(to_jsonb(t)),'[]') rows FROM public.profiles t UNION ALL
  SELECT 'interns',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.interns t UNION ALL
  SELECT 'companies',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.companies t UNION ALL
  SELECT 'course_sections',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.course_sections t UNION ALL
  SELECT 'academic_years',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.academic_years t UNION ALL
  SELECT 'attendance_logs',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.attendance_logs t UNION ALL
  SELECT 'attendance_exceptions',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.attendance_exceptions t UNION ALL
  SELECT 'documents',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.documents t UNION ALL
  SELECT 'document_versions',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.document_versions t UNION ALL
  SELECT 'document_review_events',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.document_review_events t UNION ALL
  SELECT 'evaluations',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.evaluations t UNION ALL
  SELECT 'announcements',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.announcements t UNION ALL
  SELECT 'alerts',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.alerts t UNION ALL
  SELECT 'audit_logs',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.audit_logs t UNION ALL
  SELECT 'submissions',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.submissions t UNION ALL
  SELECT 'submission_versions',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.submission_versions t UNION ALL
  SELECT 'submission_files',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.submission_files t UNION ALL
  SELECT 'submission_reviews',coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.submission_reviews t) a),
 'auth_identities',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'confirmed',email_confirmed_at IS NOT NULL,'deleted',deleted_at IS NOT NULL)),'[]') FROM auth.users),
 'storage_objects',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket_id',bucket_id,'name',name)),'[]') FROM storage.objects),
 'storage_buckets',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types)) FROM storage.buckets),
 'publications',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') FROM pg_publication_tables p WHERE schemaname='public')
) AS checkpoint)
SELECT (checkpoint || jsonb_build_object('captured_at',clock_timestamp(),
 'data_fingerprints',(SELECT jsonb_object_agg(key,(SELECT md5(coalesce(jsonb_agg(x ORDER BY x->>'id'),'[]')::text) FROM jsonb_array_elements(value) x)) FROM jsonb_each(checkpoint->'public_data'))))::text AS checkpoint_json
FROM snapshot;
ROLLBACK;

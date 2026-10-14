-- Read-only protected state fingerprints; no credentials or private rows returned.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';
SELECT jsonb_build_object(
 'auth_users',(SELECT count(*) FROM auth.users),
 'auth_state',(SELECT md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY id::text),'[]'::jsonb)::text) FROM auth.users u),
 'storage_objects',(SELECT count(*) FROM storage.objects),
 'storage_state',(SELECT md5(coalesce(jsonb_agg(to_jsonb(o) ORDER BY id::text),'[]'::jsonb)::text) FROM storage.objects o),
 'buckets_state',(SELECT md5(coalesce(jsonb_agg(to_jsonb(b) ORDER BY id),'[]'::jsonb)::text) FROM storage.buckets b),
 'auth_triggers',(SELECT md5(coalesce(jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) ORDER BY tgname),'[]'::jsonb)::text) FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal),
 'storage_policies',(SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY policyname),'[]'::jsonb)::text) FROM pg_policies p WHERE schemaname='storage')
) AS protected_state;
ROLLBACK;

-- DESTRUCTIVE DATA CLEANUP, NOT A MIGRATION. Manual operator execution only.
-- Back up database + Storage bytes; pause app/signups/uploads before running.
-- Keeps ALL accounts (including Pending/Inactive), roles, credentials, approval
-- status, Intern extensions, saved targets, assignments, and master data.
-- Removes attendance, corrections, requirements/files' database references,
-- versions/reviews, flexible submissions, evaluations, announcements, alerts
-- and ALL audit history. Reattach standard requirements afterward via Admin.
-- Storage bytes/metadata are NOT deleted by this SQL. Remove files separately
-- using Supabase Storage dashboard or trusted server-side Storage API.
-- Never use DELETE FROM storage.objects to remove physical files.
-- Does not install missing migrations or repair schema/assignment anomalies.
-- Run this ENTIRE single DO statement. No temporary tables or session setup.
DO $cleanup$
DECLARE
  dry_run boolean := false; -- Set true to preview and roll back all deletions.
  kept text[] := ARRAY['auth.users','public.profiles','public.interns',
    'public.companies','public.course_sections','public.academic_years'];
  -- Children precede parents. audit_logs is LAST because DELETE triggers
  -- create trusted audit events, which this explicitly requested reset removes.
  cleared text[] := ARRAY['public.document_review_events',
    'public.document_versions','public.submission_reviews',
    'public.submission_files','public.submission_versions','public.submissions',
    'public.documents','public.attendance_exceptions','public.attendance_logs',
    'public.evaluations','public.announcements','public.alerts','public.audit_logs'];
  name text;
  n bigint;
  preserved jsonb := '{}'::jsonb;
  current_rows jsonb;
  report jsonb := '[]'::jsonb;
  verified boolean := false;
BEGIN
  IF current_user <> 'postgres' OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname='postgres' AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'Run only as the trusted postgres SQL Editor operator';
  END IF;
  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  PERFORM pg_catalog.set_config('lock_timeout','10s',true);
  PERFORM pg_catalog.pg_advisory_xact_lock(404,1);

  -- One statement is atomic, including when the editor executes statements in
  -- separate requests. This inner subtransaction also supports a true dry run.
  BEGIN
  FOREACH name IN ARRAY kept LOOP
    IF pg_catalog.to_regclass(name) IS NULL THEN
      RAISE EXCEPTION 'Missing protected table %: inspect baseline; nothing deleted',name;
    END IF;
    EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE',name);
    -- Full-row digests detect credential/profile/target/assignment changes
    -- without returning sensitive account values in SQL Editor results.
    EXECUTE pg_catalog.format(
      'SELECT coalesce(pg_catalog.jsonb_object_agg(id::text,
        pg_catalog.md5(pg_catalog.to_jsonb(t)::text)),''{}''::jsonb) FROM %s t',
      name) INTO current_rows;
    preserved := preserved || pg_catalog.jsonb_build_object(name,current_rows);
  END LOOP;

  -- Acquire every deletion lock before deleting any rows.
  FOREACH name IN ARRAY cleared LOOP
    IF pg_catalog.to_regclass(name) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE',name);
    END IF;
  END LOOP;

  FOREACH name IN ARRAY cleared LOOP
    IF pg_catalog.to_regclass(name) IS NULL THEN
      report := report || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'table_name',name,'deleted_rows',NULL,'result','Not installed; no deletion attempted'));
    ELSE
      EXECUTE format('DELETE FROM %s',name);
      GET DIAGNOSTICS n = ROW_COUNT;
      report := report || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'table_name',name,'deleted_rows',n,
        'result',CASE WHEN dry_run THEN 'Would delete; rolled back' ELSE 'Deleted' END));
    END IF;
  END LOOP;

  -- Abort/roll back if a custom FK or trigger touched any protected record.
  FOREACH name IN ARRAY kept LOOP
    EXECUTE pg_catalog.format(
      'SELECT coalesce(pg_catalog.jsonb_object_agg(id::text,
        pg_catalog.md5(pg_catalog.to_jsonb(t)::text)),''{}''::jsonb) FROM %s t',
      name) INTO current_rows;
    IF current_rows IS DISTINCT FROM preserved->name THEN
      RAISE EXCEPTION 'Protected accounts/master data changed in %: cleanup rolled back',name;
    END IF;
  END LOOP;

  FOREACH name IN ARRAY cleared LOOP
    IF pg_catalog.to_regclass(name) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %s',name) INTO n;
      IF n<>0 THEN
        RAISE EXCEPTION 'Cleanup incomplete: % still contains % rows; transaction aborted',name,n;
      END IF;
    END IF;
  END LOOP;
  verified := true;
  IF dry_run THEN
    RAISE EXCEPTION USING ERRCODE='P9001',MESSAGE='INSync cleanup dry run: roll back deletions';
  END IF;
  EXCEPTION WHEN SQLSTATE 'P9001' THEN
    -- Never treat a trigger failure as a successful dry run.
    IF NOT dry_run OR NOT verified THEN RAISE; END IF;
  END;

  RAISE NOTICE 'INSync cleanup result: %',pg_catalog.jsonb_build_object(
    'mode',CASE WHEN dry_run THEN 'dry-run (rolled back)' ELSE 'deleted' END,
    'tables',report);
END $cleanup$;

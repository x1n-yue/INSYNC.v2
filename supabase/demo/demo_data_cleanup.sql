-- Optional cleanup, only in the NEW project's SQL Editor as postgres.
-- Deletes exact seed-owned IDs only. Never deletes accounts, audit or Storage.
-- Refuses requirements with uploads/reservations/reviews; no evidence is erased.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='10s';
SET LOCAL insync_demo.confirmed_project_ref='CHECK_NEW_PROJECT_BANNER_FIRST';

DO $cleanup$
DECLARE
 tag constant text := '[INSync demo:tcntyrwwqzyyqlzdtuer:v1]';
 prefix constant text := 'de600001-2026-4000-8000-';
 student uuid; coordinator uuid; ids uuid[]; r record;
 wrong boolean; affected integer; total_deleted integer := 0;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Demo cleanup requires the trusted postgres SQL operator'; END IF;
 IF current_setting('insync_demo.confirmed_project_ref',true) IS DISTINCT FROM 'tcntyrwwqzyyqlzdtuer' THEN
  RAISE EXCEPTION 'Verify NEW project tcntyrwwqzyyqlzdtuer before replacing CHECK_NEW_PROJECT_BANNER_FIRST';
 END IF;
 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Use a clean trusted SQL Editor session without inherited user context'; END IF;
 PERFORM pg_advisory_xact_lock(404,1);
 IF (SELECT count(*) FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(p.email)='hhimii.mu@gmail.com' AND lower(u.email)='hhimii.mu@gmail.com')<>1
  OR (SELECT count(*) FROM public.profiles p JOIN auth.users u ON u.id=p.id
   WHERE lower(p.email)='mangokamen1@gmail.com' AND lower(u.email)='mangokamen1@gmail.com')<>1
 THEN RAISE EXCEPTION 'Cannot resolve original demo owners by exact email; inspect identities manually. No accounts changed'; END IF;
 SELECT p.id INTO student FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(p.email)='hhimii.mu@gmail.com' AND lower(u.email)='hhimii.mu@gmail.com';
 SELECT p.id INTO coordinator FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(p.email)='mangokamen1@gmail.com' AND lower(u.email)='mangokamen1@gmail.com';
 PERFORM 1 FROM public.profiles WHERE id=ANY(ARRAY[student,coordinator]) ORDER BY id FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended(student::text,101));

 -- Check ALL affected records before deleting ANY. An edited/misattributed tag
 -- or a reserved-ID collision aborts cleanup instead of guessing ownership.
 FOR r IN SELECT * FROM (VALUES
  ('attendance_logs',ARRAY[101,102,103,104,105,106],'accomplishment','intern_id'),
  ('attendance_exceptions',ARRAY[201],'reason','intern_id'),
  ('documents',ARRAY[301,302,303,304,305],'note','intern_id'),
  ('evaluations',ARRAY[401],'feedback','intern_id'),
  ('announcements',ARRAY[501,502],'title','instructor_id')) AS x(tab,slots,tag_column,owner_column) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||r.tab)
   AND tgfoid=to_regprocedure('public.write_trusted_audit()') AND tgenabled IN ('O','A') AND tgtype=29)
  THEN RAISE EXCEPTION 'Mandatory trusted audit required for cleanup of public.%',r.tab; END IF;
  SELECT array_agg((prefix||lpad(s::text,12,'0'))::uuid) INTO ids FROM unnest(r.slots) AS x(s);
  EXECUTE format('SELECT id FROM public.%I WHERE id=ANY($1) ORDER BY id FOR UPDATE',r.tab) USING ids;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I x WHERE x.id=ANY($1) AND
   (x.%I IS DISTINCT FROM $2 OR strpos(x.%I,$3) IS DISTINCT FROM 1 OR NOT EXISTS(
    SELECT 1 FROM public.audit_logs a WHERE a.source=''database-trigger-v2''
     AND a.event_data->>''table''=$4 AND a.event_data->>''operation''=''INSERT''
     AND a.event_data->>''record_id''=x.id::text)))',r.tab,r.owner_column,r.tag_column)
   INTO wrong USING ids,CASE WHEN r.tab='announcements' THEN coordinator ELSE student END,tag,r.tab;
  IF wrong THEN RAISE EXCEPTION 'Demo provenance/owner/tag mismatch in public.%; no rows deleted',r.tab; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.evaluations WHERE id=(prefix||'000000000401')::uuid
  AND (evaluator_id IS DISTINCT FROM coordinator OR submission_id IS DISTINCT FROM (prefix||'000000000402')::uuid))
 THEN RAISE EXCEPTION 'Demo evaluation identity changed; no cleanup performed'; END IF;
 IF EXISTS(SELECT 1 FROM public.announcements WHERE id=ANY(ARRAY[(prefix||'000000000501')::uuid,(prefix||'000000000502')::uuid])
  AND recipient_ids IS DISTINCT FROM ARRAY[student])
 THEN RAISE EXCEPTION 'Demo announcement audience changed; inspect rather than deleting other recipients history'; END IF;

 SELECT array_agg((prefix||lpad(s::text,12,'0'))::uuid) INTO ids FROM unnest(ARRAY[301,302,303,304,305]) AS x(s);
 IF EXISTS(SELECT 1 FROM public.documents d WHERE d.id=ANY(ids) AND
  (d.status<>'Pending' OR d.file_path IS NOT NULL OR d.file_name IS NOT NULL OR d.upload_version<>0
   OR d.review_revision<>0 OR d.reviewed_by IS NOT NULL OR d.reviewed_at IS NOT NULL OR d.legacy_evidence IS NOT NULL
   OR EXISTS(SELECT 1 FROM public.document_versions v WHERE v.document_id=d.id)
   OR EXISTS(SELECT 1 FROM public.document_review_events e WHERE e.document_id=d.id)))
 THEN RAISE EXCEPTION 'Demo requirement now has file/reservation/review evidence. Cleanup refuses ALL deletions; retain history and use a reviewed separate procedure'; END IF;

 FOR r IN SELECT * FROM (VALUES
  ('announcements',ARRAY[501,502]),('evaluations',ARRAY[401]),
  ('attendance_exceptions',ARRAY[201]),('attendance_logs',ARRAY[101,102,103,104,105,106]),
  ('documents',ARRAY[301,302,303,304,305])) AS x(tab,slots) LOOP
  SELECT array_agg((prefix||lpad(s::text,12,'0'))::uuid) INTO ids FROM unnest(r.slots) AS x(s);
  EXECUTE format('DELETE FROM public.%I WHERE id=ANY($1)',r.tab) USING ids;
  GET DIAGNOSTICS affected=ROW_COUNT;
  total_deleted := total_deleted+affected;
  RAISE NOTICE 'Removed % tagged demo rows from public.%',affected,r.tab;
 END LOOP;
 -- Attendance created by LIVE correction approval has a different UUID and is
 -- deliberately preserved, even if its date originated in the demo request.
 -- All pre-existing requirements and all seed/review/cleanup audit events remain.
 RAISE NOTICE 'Deleted % exact demo rows. Accounts, existing requirements, nonseed rows, audit history and all Storage untouched.',total_deleted;
END $cleanup$;
COMMIT;

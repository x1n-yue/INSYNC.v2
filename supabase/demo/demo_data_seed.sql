-- WRITE ONLY WHEN MANUALLY AUTHORIZED IN THE NEW PROJECT'S SQL EDITOR.
-- Intended project: tcntyrwwqzyyqlzdtuer. Never run on the old project.
-- Read README_DEMO_DATA.md. No accounts, assignments, schema or Storage changes.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';
SET LOCAL lock_timeout='10s';
-- Replace ONLY this placeholder after checking the SQL Editor project banner.
-- This is operator attestation, not automatic detection of the hosted project.
SET LOCAL insync_demo.confirmed_project_ref='CHECK_NEW_PROJECT_BANNER_FIRST';

DO $demo$
DECLARE
 tag constant text := '[INSync demo:tcntyrwwqzyyqlzdtuer:v1]';
 prefix constant text := 'de600001-2026-4000-8000-';
 slots constant integer[] := ARRAY[101,102,103,104,105,106,201,301,302,303,304,305,401,402,501,502];
 reserved uuid[];
 operator_admin uuid; coordinator uuid; student uuid;
 required numeric; previous_verified numeric; today date;
 dates date[]; started timestamptz; finished timestamptz;
 criteria constant jsonb := '{"punctuality":4,"performance":4,"conduct":5,"communication":4}';
 r record; n integer; collision boolean; inserted_docs integer := 0;
BEGIN
 IF to_regclass('public.supervisor_evaluations') IS NOT NULL THEN
  RAISE EXCEPTION 'Historical demo seed is unsupported after M15; use isolated four-role workflow fixtures instead';
 END IF;
 IF current_user <> 'postgres' THEN
  RAISE EXCEPTION 'Demo seed requires the trusted postgres SQL Editor operator';
 END IF;
 IF current_setting('insync_demo.confirmed_project_ref',true) IS DISTINCT FROM 'tcntyrwwqzyyqlzdtuer' THEN
  RAISE EXCEPTION 'Verify the NEW SQL Editor project tcntyrwwqzyyqlzdtuer, then replace CHECK_NEW_PROJECT_BANNER_FIRST; no data changed';
 END IF;
 IF to_regprocedure('auth.uid()') IS NULL OR to_regclass('auth.users') IS NULL THEN
  RAISE EXCEPTION 'Supabase Auth baseline required; this script creates no accounts';
 END IF;
 IF auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'Use a clean trusted SQL Editor session, without an inherited user JWT context';
 END IF;
 PERFORM pg_advisory_xact_lock(404,1); -- Same lifecycle/document/announcement lock.
 FOR r IN SELECT t FROM unnest(ARRAY['profiles','interns','attendance_logs','attendance_exceptions',
  'documents','document_versions','document_review_events','evaluations','announcements','audit_logs']) AS x(t) LOOP
  IF to_regclass('public.'||r.t) IS NULL THEN
   RAISE EXCEPTION 'Missing public.%: complete the current fresh installation before demo seeding',r.t;
  END IF;
 END LOOP;
 IF to_regprocedure('public.send_announcement(uuid,text,text,uuid)') IS NULL
  OR to_regprocedure('public.verify_attendance(uuid,timestamptz,timestamptz)') IS NULL
  OR to_regprocedure('public.rubric_score(jsonb)') IS NULL
  OR to_regprocedure('public.guard_last_active_admin()') IS NULL
  OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.documents'::regclass
   AND attname='legacy_evidence' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Current M01-M14 contracts are required; do not seed an incomplete installation'; END IF;
 FOR r IN SELECT tab FROM unnest(ARRAY['attendance_logs','attendance_exceptions','documents','evaluations','announcements']) AS x(tab) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||r.tab) AND relrowsecurity)
   OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||r.tab)
    AND tgfoid=to_regprocedure('public.write_trusted_audit()') AND tgenabled IN ('O','A') AND tgtype=29)
  THEN RAISE EXCEPTION 'Enabled RLS and mandatory trusted audit required on public.%',r.tab; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.announcements'::regclass
  AND tgfoid=to_regprocedure('public.bind_announcement()') AND tgenabled IN ('O','A') AND tgtype=7)
 THEN RAISE EXCEPTION 'Enabled authoritative announcement binding trigger required'; END IF;
 FOR r IN SELECT * FROM (VALUES
  ('attendance_logs','m03_attendance_interval'),('attendance_exceptions','m03_correction_interval'),
  ('attendance_exceptions','m03_correction_review'),('evaluations','m06_evaluation_rubric'),
  ('interns','m06_required_hours'),('documents','m08_requirement_identity')) AS x(tab,con) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.'||r.tab)
   AND conname=r.con AND convalidated)
  THEN RAISE EXCEPTION 'Validated constraint %.% required; review installation/validation gates first',r.tab,r.con; END IF;
 END LOOP;
 FOR r IN SELECT tab FROM unnest(ARRAY['attendance_logs','attendance_exceptions']) AS x(tab) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||r.tab)
   AND tgfoid=to_regprocedure('public.guard_attendance_future()') AND tgenabled IN ('O','A'))
  THEN RAISE EXCEPTION 'Enabled future-date guard required on public.%',r.tab; END IF;
 END LOOP;

 -- Resolve identities by verified Auth email; never trust metadata or infer privilege.
 FOR r IN SELECT * FROM (VALUES
  ('fangonbernstain566@gmail.com','admin'),('mangokamen1@gmail.com','instructor'),
  ('hhimii.mu@gmail.com','intern')) AS x(email,expected_role) LOOP
  SELECT count(*) INTO n FROM auth.users u JOIN public.profiles p ON p.id=u.id
  WHERE lower(u.email)=r.email AND lower(p.email)=r.email AND u.deleted_at IS NULL
   AND u.email_confirmed_at IS NOT NULL AND p.role=r.expected_role AND p.status='Active';
  IF n <> 1 OR (SELECT count(*) FROM auth.users WHERE lower(email)=r.email)<>1 THEN
   RAISE EXCEPTION 'Expected exactly one confirmed % / Active account for %. Use normal Auth confirmation/Admin account controls; seed changes no account',r.expected_role,r.email;
  END IF;
 END LOOP;
 SELECT p.id INTO operator_admin FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)='fangonbernstain566@gmail.com' AND lower(p.email)='fangonbernstain566@gmail.com';
 SELECT p.id INTO coordinator FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)='mangokamen1@gmail.com' AND lower(p.email)='mangokamen1@gmail.com';
 SELECT p.id INTO student FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)='hhimii.mu@gmail.com' AND lower(p.email)='hhimii.mu@gmail.com';
 PERFORM 1 FROM public.profiles WHERE id=ANY(ARRAY[operator_admin,coordinator,student]) ORDER BY id FOR SHARE;
 SELECT i.required_hours INTO required FROM public.interns i WHERE i.id=student
  AND i.instructor_id=coordinator AND i.company_id IS NOT NULL AND i.section_id IS NOT NULL FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Assign hhimii.mu@gmail.com to mangokamen1@gmail.com with company and section in the Admin UI first; this seed does not assign';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(student::text,101));
 -- A broadcast may not introduce demo messages to any fourth account.
 IF EXISTS(SELECT 1 FROM public.interns i JOIN public.profiles p ON p.id=i.id
  WHERE i.instructor_id=coordinator AND p.role='intern' AND p.status='Active' AND i.id<>student)
 THEN RAISE EXCEPTION 'Coordinator active roster contains other interns: demo broadcast would reach another account. No seed applied; use a dedicated demo roster or create messages separately in the app'; END IF;

 SELECT array_agg((prefix||lpad(s::text,12,'0'))::uuid) INTO reserved FROM unnest(slots) AS x(s);
 FOR r IN SELECT tab FROM unnest(ARRAY['attendance_logs','attendance_exceptions','documents','evaluations','announcements']) AS x(tab) LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=ANY($1))',r.tab) INTO collision USING reserved;
  IF collision THEN RAISE EXCEPTION 'Demo already applied or reserved UUID collision in public.%; nothing changed',r.tab; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.audit_logs WHERE source='database-trigger-v2'
  AND event_data->>'record_id'=ANY(ARRAY(SELECT x::text FROM unnest(reserved) AS t(x))))
  OR EXISTS(SELECT 1 FROM public.evaluations WHERE submission_id=(prefix||'000000000402')::uuid)
 THEN RAISE EXCEPTION 'Demo was already applied (including historical audit/retry identity). This is a one-time seed, even after cleanup'; END IF;

 IF NOT public.valid_required_hours(required) THEN RAISE EXCEPTION 'Saved required-hours target is invalid; fix it through Admin controls first'; END IF;
 IF EXISTS(SELECT 1 FROM public.attendance_logs WHERE intern_id=student AND
  (time_out IS NULL OR clocked_in_at IS NULL OR clocked_out_at IS NULL OR hours IS NULL
   OR clocked_out_at<=clocked_in_at OR clocked_out_at-clocked_in_at>interval '16 hours'
   OR hours<>extract(epoch FROM clocked_out_at-clocked_in_at)/3600
   OR (verified AND verified_by IS NULL)))
 THEN RAISE EXCEPTION 'Existing open or unknown attendance evidence: resolve it through supported workflows; no hours inferred or overwritten'; END IF;
 SELECT coalesce(sum(hours) FILTER(WHERE verified),0) INTO previous_verified FROM public.attendance_logs WHERE intern_id=student;
 IF previous_verified+30 >= required THEN
  RAISE EXCEPTION 'Demo adds 30 verified hours; existing % + 30 must stay below saved target %. No target or attendance changed',previous_verified,required;
 END IF;
 today := (clock_timestamp() AT TIME ZONE 'Asia/Manila')::date;
 SELECT array_agg(d ORDER BY d DESC) INTO dates FROM (
  SELECT today-offset_day AS d FROM generate_series(1,60) AS x(offset_day)
  WHERE extract(isodow FROM today-offset_day) BETWEEN 1 AND 5
   AND NOT EXISTS(SELECT 1 FROM public.attendance_logs a WHERE a.intern_id=student AND a.log_date=today-offset_day)
   AND NOT EXISTS(SELECT 1 FROM public.attendance_exceptions e WHERE e.intern_id=student
    AND e.log_date=today-offset_day AND e.status='Pending')
  ORDER BY d DESC LIMIT 7
 ) AS available;
 IF coalesce(cardinality(dates),0)<>7 THEN
  RAISE EXCEPTION 'Need seven unused past Monday-Friday dates within 60 days; no existing records overwritten';
 END IF;
 IF EXISTS(SELECT 1 FROM public.documents WHERE intern_id=student
  AND (doc_type IN ('moa','endorsement','consent','medical') OR (doc_type LIKE 'custom:%' AND name='Demo - Weekly Learning Summary'))
  AND (status<>'Pending' OR file_path IS NOT NULL OR file_name IS NOT NULL OR upload_version<>0
   OR review_revision<>0 OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR legacy_evidence IS NOT NULL))
 THEN RAISE EXCEPTION 'An existing requested requirement has evidence/review history; preserved unchanged. Use empty demo requirements, not an overwrite'; END IF;

 -- Six closed 08:30-16:00 elapsed sessions: 45 logged / 30 verified demo hours.
 FOR n IN 1..6 LOOP
  started := (dates[n]+time '08:30') AT TIME ZONE 'Asia/Manila';
  finished := (dates[n]+time '16:00') AT TIME ZONE 'Asia/Manila';
  INSERT INTO public.attendance_logs(id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,
   hours,accomplishment,verified,verified_by,created_at)
  VALUES((prefix||lpad((100+n)::text,12,'0'))::uuid,student,
   (started AT TIME ZONE 'Asia/Manila')::date,(started AT TIME ZONE 'Asia/Manila')::time,
   (finished AT TIME ZONE 'Asia/Manila')::time,started,finished,extract(epoch FROM finished-started)/3600,
   tag||' '||(ARRAY['Organized project reference materials.','Updated the assigned task checklist.',
    'Prepared a short progress summary.','Checked and corrected document formatting.',
    'Reviewed training notes and practiced the assigned workflow.','Prepared supporting material for the coordinator review.'])[n],
   n<=4,CASE WHEN n<=4 THEN coordinator ELSE NULL END,finished);
 END LOOP;
 INSERT INTO public.attendance_exceptions(id,intern_id,log_date,claimed_time_in,claimed_time_out,claimed_end_date,reason,status)
 VALUES((prefix||'000000000201')::uuid,student,dates[7],time '08:30',time '15:30',dates[7],
  tag||' I completed the assigned work but missed recording my attendance. Please review this seven-hour claim.','Pending');

 FOR r IN SELECT * FROM (VALUES
  (301,'moa','Memorandum of Agreement (MOA)'),(302,'endorsement','Endorsement Letter'),
  (303,'consent','Parent / Guardian Consent Form'),(304,'medical','Medical Certificate'),
  (305,'custom:'||prefix||'000000000305','Demo - Weekly Learning Summary')) AS x(slot,doc_type,name) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.documents d WHERE d.intern_id=student AND
   (d.doc_type=r.doc_type OR (r.slot=305 AND d.doc_type LIKE 'custom:%' AND d.name=r.name))) THEN
   INSERT INTO public.documents(id,intern_id,doc_type,name,status,note)
   VALUES((prefix||lpad(r.slot::text,12,'0'))::uuid,student,r.doc_type,r.name,'Pending',
    tag||' Empty demo requirement. Upload a real test file through the clearance workflow.');
   inserted_docs := inserted_docs+1;
  END IF;
 END LOOP;
 INSERT INTO public.evaluations(id,intern_id,evaluator_id,type,competencies,feedback,overall_score,submission_id)
 VALUES((prefix||'000000000401')::uuid,student,coordinator,'Demo progress evaluation',criteria,
  tag||' Consistent work quality and professional conduct. Continue giving concise progress updates.',
  public.rubric_score(criteria),(prefix||'000000000402')::uuid);

 -- Keep postgres as operator. Use ONLY a transaction-local author identity for
 -- the existing secure RPC/binding trigger; never supply/infer recipient_ids.
 PERFORM set_config('request.jwt.claim.sub',coordinator::text,true);
 IF auth.uid() IS DISTINCT FROM coordinator THEN
  RAISE EXCEPTION 'Auth provider does not support the expected transaction-local subject; no announcements or other demo rows committed';
 END IF;
 PERFORM public.send_announcement((prefix||'000000000501')::uuid,tag||' Class progress update',
  'Please keep accomplishments current and prepare your actual clearance files for review. This is a demonstration message.',NULL);
 PERFORM public.send_announcement((prefix||'000000000502')::uuid,tag||' Your document checklist',
  'Your empty document requirements are ready. Upload test evidence through My Documents; flexible submissions remain separate from clearance.',student);
 PERFORM set_config('request.jwt.claim.sub','',true);
 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Author context did not clear; seed rolled back'; END IF;
 RAISE NOTICE 'Demo prepared: 6 attendance (4 verified, 2 unverified), 1 Pending correction, % new empty requirements, 1 score-84 evaluation, 2 announcements. Accounts unchanged; trusted audits retained.',inserted_docs;
END $demo$;
COMMIT;

-- Focused existing-database repair: controlled, idempotent announcement sends
-- and the M12 attendance verification contract. No year/cohort/schema changes.
-- Requires reviewed M01 authority, M02 mandatory audit and M03 attendance integrity.
-- Safely rerunnable; operator runs manually. Existing evidence remains unchanged.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='10s';
SELECT pg_catalog.pg_advisory_xact_lock(404,1);

DO $preflight$
DECLARE r record; expected text[]; result_type oid;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'M13 requires the trusted postgres SQL operator'; END IF;
 IF to_regprocedure('public.current_role()') IS NULL OR to_regprocedure('public.can_review(uuid)') IS NULL
  OR to_regprocedure('public.bind_announcement()') IS NULL OR to_regprocedure('public.write_trusted_audit()') IS NULL
 THEN RAISE EXCEPTION 'M13 requires reviewed M01/M02 authority and audit helpers; inspect before applying'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.announcements'::regclass
  AND attname='recipient_ids' AND atttypid='uuid[]'::regtype AND NOT attisdropped)
 THEN RAISE EXCEPTION 'M13 requires M01 frozen recipient_ids UUID array'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.attendance_logs'::regclass
  AND conname='m03_attendance_interval' AND contype='c')
 THEN RAISE EXCEPTION 'M13 requires reviewed M03 attendance integrity; no timestamp/hour backfill attempted'; END IF;
 FOR r IN SELECT c.oid,c.relname,c.relowner,c.relrowsecurity FROM pg_class c
  WHERE c.oid IN ('public.announcements'::regclass,'public.attendance_logs'::regclass) LOOP
  IF r.relowner<>'postgres'::regrole OR NOT r.relrowsecurity
  THEN RAISE EXCEPTION 'M13 requires trusted ownership and RLS on public.%',r.relname; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
   WHERE t.tgrelid=r.oid AND t.tgfoid='public.write_trusted_audit()'::regprocedure
    AND t.tgenabled IN ('O','A') AND t.tgtype=29 AND p.proowner='postgres'::regrole AND p.prosecdef
    AND p.proconfig=ARRAY['search_path=pg_catalog, public'])
  THEN RAISE EXCEPTION 'M13 requires enabled M02 mandatory row audit on public.%',r.relname; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
  WHERE t.tgrelid='public.announcements'::regclass AND t.tgfoid='public.bind_announcement()'::regprocedure
   AND t.tgenabled IN ('O','A') AND t.tgtype=7 AND p.proowner='postgres'::regrole AND p.prosecdef
   AND p.proconfig=ARRAY['search_path=pg_catalog, public'])
 THEN RAISE EXCEPTION 'M13 requires the enabled M01 author/audience binding trigger'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='announcements'
  AND policyname NOT IN ('m01_announcements_read','m01_announcements_insert'))
 THEN RAISE EXCEPTION 'M13 found unreviewed announcement policies: inspect their definitions before applying; none removed'; END IF;
 FOR r IN SELECT p.*,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('verify_attendance','send_announcement') LOOP
  IF r.proname='verify_attendance' THEN
   expected:=ARRAY['p_id','p_expected_in','p_expected_out']; result_type:='public.attendance_logs'::regtype;
   IF r.oid IS DISTINCT FROM to_regprocedure('public.verify_attendance(uuid,timestamptz,timestamptz)')
   THEN RAISE EXCEPTION 'Unexpected verify_attendance overload: inspect dependencies; no function dropped'; END IF;
  ELSE
   expected:=ARRAY['p_request_id','p_title','p_body','p_target_intern_id']; result_type:='public.announcements'::regtype;
   IF r.oid IS DISTINCT FROM to_regprocedure('public.send_announcement(uuid,text,text,uuid)')
   THEN RAISE EXCEPTION 'Unexpected send_announcement overload: inspect dependencies; no function dropped'; END IF;
  END IF;
  IF r.proowner<>'postgres'::regrole OR r.prokind<>'f' OR r.prorettype<>result_type OR r.proretset
   OR r.proargnames IS DISTINCT FROM expected OR r.proargmodes IS NOT NULL
  THEN RAISE EXCEPTION 'Incompatible public.% owner/arguments/return contract: review a dependency-aware transition',r.proname; END IF;
 END LOOP;
END $preflight$;

CREATE OR REPLACE FUNCTION public.send_announcement(p_request_id uuid,p_title text,p_body text,p_target_intern_id uuid DEFAULT NULL)
RETURNS public.announcements LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE saved public.announcements; recipients uuid[]; actual uuid[];
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 IF public.current_role() IS NULL OR public.current_role() NOT IN ('instructor','admin')
 THEN RAISE EXCEPTION 'Active staff author required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 IF p_request_id IS NULL OR nullif(btrim(p_title),'') IS NULL OR nullif(btrim(p_body),'') IS NULL
 THEN RAISE EXCEPTION 'Retry identity, subject and message required'; END IF;
 SELECT * INTO saved FROM public.announcements WHERE id=p_request_id FOR UPDATE;
 IF FOUND THEN
  IF saved.instructor_id IS DISTINCT FROM auth.uid() OR saved.title IS DISTINCT FROM btrim(p_title)
   OR saved.body IS DISTINCT FROM btrim(p_body) OR saved.target_intern_id IS DISTINCT FROM p_target_intern_id
  THEN RAISE EXCEPTION 'Announcement retry identity reused with different content or author' USING errcode='40001'; END IF;
  RETURN saved; -- Recipients remain frozen, including after reassignment.
 END IF;
 SELECT coalesce(array_agg(i.id ORDER BY i.id),ARRAY[]::uuid[]) INTO recipients
 FROM public.interns i JOIN public.profiles p ON p.id=i.id
 WHERE i.instructor_id=auth.uid() AND p.role='intern' AND p.status='Active'
  AND (p_target_intern_id IS NULL OR i.id=p_target_intern_id);
 IF cardinality(recipients)=0 THEN
  RAISE EXCEPTION 'Select an active assigned intern or a nonempty assigned active roster' USING errcode='42501';
 END IF;
 -- M01 derives the immutable recipient array inside this same INSERT. M02
 -- audit failure aborts everything; no separate recipient transaction exists.
 INSERT INTO public.announcements(id,instructor_id,title,body,target,target_intern_id)
 VALUES(p_request_id,auth.uid(),btrim(p_title),btrim(p_body),
  CASE WHEN p_target_intern_id IS NULL THEN 'All Interns' ELSE 'Personal' END,p_target_intern_id)
 RETURNING * INTO saved;
 SELECT array_agg(x ORDER BY x) INTO actual FROM unnest(saved.recipient_ids) x;
 IF actual IS DISTINCT FROM recipients OR saved.instructor_id IS DISTINCT FROM auth.uid()
  OR saved.title IS DISTINCT FROM btrim(p_title) OR saved.body IS DISTINCT FROM btrim(p_body)
  OR saved.target_intern_id IS DISTINCT FROM p_target_intern_id
 THEN RAISE EXCEPTION 'Announcement audience/content changed during creation; transaction rolled back'; END IF;
 RETURN saved;
END $$;

-- Exact M12 expected-instant verification contract, installed independently of
-- unrelated M12 master-data/legacy metadata prerequisites. Hours are never edited.
CREATE OR REPLACE FUNCTION public.verify_attendance(p_id uuid,p_expected_in timestamptz,p_expected_out timestamptz)
RETURNS public.attendance_logs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.attendance_logs;
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 SELECT * INTO r FROM public.attendance_logs WHERE id=p_id;
 IF NOT FOUND OR NOT public.can_review(r.intern_id)
 THEN RAISE EXCEPTION 'Assigned active staff required' USING errcode='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.interns WHERE id=r.intern_id FOR SHARE;
 SELECT * INTO r FROM public.attendance_logs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_review(r.intern_id)
  OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=r.intern_id AND role='intern')
 THEN RAISE EXCEPTION 'Assignment or account changed; refresh' USING errcode='42501'; END IF;
 IF p_expected_in IS NULL OR p_expected_out IS NULL
  OR r.clocked_in_at IS DISTINCT FROM p_expected_in OR r.clocked_out_at IS DISTINCT FROM p_expected_out
 THEN RAISE EXCEPTION 'Attendance changed; refresh before reviewing' USING errcode='40001'; END IF;
 IF r.time_in IS NULL OR r.time_out IS NULL OR r.hours IS NULL
  OR r.log_date IS DISTINCT FROM (r.clocked_in_at AT TIME ZONE 'Asia/Manila')::date
  OR r.time_in IS DISTINCT FROM (r.clocked_in_at AT TIME ZONE 'Asia/Manila')::time
  OR r.time_out IS DISTINCT FROM (r.clocked_out_at AT TIME ZONE 'Asia/Manila')::time
  OR r.clocked_out_at<=r.clocked_in_at OR r.clocked_out_at-r.clocked_in_at>interval '16 hours'
  OR r.clocked_out_at>clock_timestamp()
  OR r.hours IS DISTINCT FROM extract(epoch FROM r.clocked_out_at-r.clocked_in_at)/3600
  OR (r.verified AND r.verified_by IS NULL) OR (NOT r.verified AND r.verified_by IS NOT NULL)
 THEN RAISE EXCEPTION 'Closed trustworthy attendance required; request a correction for legacy or invalid evidence'; END IF;
 IF r.verified THEN RETURN r; END IF;
 UPDATE public.attendance_logs SET verified=true,verified_by=auth.uid() WHERE id=p_id RETURNING * INTO r;
 RETURN r;
END $$;

-- Repair sender/recipient retrieval using frozen recipients under RLS. No
-- browser INSERT/UPDATE/DELETE path; RPC execution remains author/scope checked.
DROP POLICY IF EXISTS m01_announcements_read ON public.announcements;
CREATE POLICY m01_announcements_read ON public.announcements FOR SELECT TO authenticated
 USING(public.is_active() AND (public.is_admin() OR instructor_id=auth.uid()
  OR (public.current_role()='intern' AND auth.uid()=ANY(recipient_ids))));
REVOKE INSERT,UPDATE,DELETE ON public.announcements FROM PUBLIC,anon,authenticated;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT attname FROM pg_attribute WHERE attrelid='public.announcements'::regclass AND attnum>0 AND NOT attisdropped LOOP
  EXECUTE format('REVOKE INSERT(%I),UPDATE(%I) ON public.announcements FROM PUBLIC,anon,authenticated',r.attname,r.attname);
 END LOOP;
END $$;
GRANT SELECT ON public.announcements TO authenticated;
REVOKE ALL ON FUNCTION public.send_announcement(uuid,text,text,uuid),public.verify_attendance(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.send_announcement(uuid,text,text,uuid),public.verify_attendance(uuid,timestamptz,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

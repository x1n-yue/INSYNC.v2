-- M12: explicitly authorized handover workflows; no historical data conversion.
-- Prerequisites: reviewed M01-M04/M06-M08/M10-M11 catalog and trusted postgres.
-- Adds explicit Admin year configuration/custom requirements and staff verification of valid closed
-- attendance. No auto-verification, new rubric, deadline, certificate or role.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $$ BEGIN
 IF current_user<>'postgres'
  OR to_regprocedure('public.admin_archive_master(text,uuid,bigint)') IS NULL
  OR to_regprocedure('public.review_document_version(uuid,text,text,bigint,bigint)') IS NULL
 THEN RAISE EXCEPTION 'M12 requires trusted postgres and reviewed M01-M11 contracts'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('admin_add_requirement','verify_attendance','admin_set_current_year','legacy_document_access','finalize_document_upload','can_read_document_object','can_delete_staged_document')
   AND p.proowner<>'postgres'::regrole)
 THEN RAISE EXCEPTION 'Inspect unexpected M12 function ownership before replacement'; END IF;
 IF (SELECT count(*) FROM public.academic_years WHERE is_current)>1
  OR EXISTS(SELECT 1 FROM public.academic_years WHERE is_current AND archived_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Conflicting current academic years: an authorized operator must review and explicitly choose one active year before M12; no automatic repair'; END IF;
 IF to_regclass('public.m12_current_year') IS NOT NULL AND
  pg_get_indexdef(to_regclass('public.m12_current_year')) IS DISTINCT FROM
   'CREATE UNIQUE INDEX m12_current_year ON public.academic_years USING btree (is_current) WHERE is_current'
 THEN RAISE EXCEPTION 'Incompatible public.m12_current_year index definition; inspect before deployment'; END IF;
END $$;

-- Prospective raw metadata preservation at the FIRST real legacy replacement.
-- Nullable column: no historical backfill, invented version or approval upgrade.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS legacy_evidence jsonb;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.documents'::regclass
  AND attname='legacy_evidence' AND atttypid='jsonb'::regtype AND NOT attnotnull AND NOT atthasdef AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Incompatible documents.legacy_evidence; inspect before M12'; END IF;
 IF EXISTS(SELECT 1 FROM public.documents d WHERE legacy_evidence IS NOT NULL AND (
  legacy_evidence->>'id' IS DISTINCT FROM d.id::text OR legacy_evidence->>'intern_id' IS DISTINCT FROM d.intern_id::text
  OR legacy_evidence->>'upload_version' IS DISTINCT FROM '0' OR legacy_evidence->>'provenance' IS DISTINCT FROM 'stored-legacy-metadata-unverified'))
 THEN RAISE EXCEPTION 'Incompatible legacy metadata snapshot: inspect original evidence; no reconstruction'; END IF;
END $$;
REVOKE INSERT(legacy_evidence),UPDATE(legacy_evidence) ON public.documents FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.finalize_document_upload(p_upload_id uuid) RETURNS public.documents
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.document_versions; d public.documents; snapshot jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 SELECT * INTO v FROM public.document_versions WHERE id=p_upload_id AND intern_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR NOT public.owns_intern(auth.uid()) THEN RAISE EXCEPTION 'Owned reservation required' USING errcode='42501'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=v.document_id FOR UPDATE;
 IF v.committed_at IS NOT NULL THEN RETURN d; END IF;
 IF v.abandoned_at IS NOT NULL OR v.expires_at<=clock_timestamp() OR v.expected_version<>d.upload_version
 THEN RAISE EXCEPTION 'Upload expired or evidence changed; refresh' USING errcode='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='documents' AND name=v.file_path
  AND metadata->>'mimetype'=v.mime_type AND (metadata->>'size')::numeric=v.byte_size)
 THEN RAISE EXCEPTION 'Stored object MIME/size evidence missing or mismatched'; END IF;
 snapshot:=d.legacy_evidence;
 IF d.upload_version=0 AND snapshot IS NULL AND (d.file_path IS NOT NULL OR d.file_name IS NOT NULL OR d.note IS NOT NULL OR d.reviewed_by IS NOT NULL OR d.reviewed_at IS NOT NULL OR d.status<>'Pending')
 THEN snapshot:=(to_jsonb(d)-'legacy_evidence')||jsonb_build_object('captured_at',clock_timestamp(),'provenance','stored-legacy-metadata-unverified'); END IF;
 UPDATE public.document_versions SET version_no=d.upload_version+1,committed_at=clock_timestamp() WHERE id=v.id;
 UPDATE public.documents SET file_path=v.file_path,file_name=v.file_name,upload_version=upload_version+1,review_revision=0,
  status='Pending',note=null,reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp(),legacy_evidence=snapshot
 WHERE id=d.id RETURNING * INTO d;
 RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.legacy_document_access(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d public.documents; old jsonb;
BEGIN
 SELECT * INTO d FROM public.documents WHERE id=p_id;
 IF NOT FOUND OR NOT public.can_read_intern(d.intern_id) THEN RAISE EXCEPTION 'Legacy file access not permitted' USING errcode='42501'; END IF;
 old:=d.legacy_evidence;
 IF old IS NULL OR old->>'id' IS DISTINCT FROM d.id::text OR old->>'intern_id' IS DISTINCT FROM d.intern_id::text
  OR old->>'upload_version' IS DISTINCT FROM '0' OR old->>'provenance' IS DISTINCT FROM 'stored-legacy-metadata-unverified'
  OR split_part(old->>'file_path','/',1) IS DISTINCT FROM d.intern_id::text
  OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='documents' AND name=old->>'file_path')
 THEN RAISE EXCEPTION 'Legacy file unavailable; original metadata retained without reconstructed evidence'; END IF;
 RETURN jsonb_build_object('id',d.id,'file_path',old->>'file_path','file_name',old->>'file_name');
END $$;

-- Extend assigned historical access only through a scoped retained snapshot.
-- Owner/Admin and flexible/current committed access retain M10 semantics.
CREATE OR REPLACE FUNCTION public.can_read_document_object(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.is_active() AND ((public.current_role()='intern' AND split_part(p_path,'/',1)=auth.uid()::text) OR public.is_admin()
  OR EXISTS(SELECT 1 FROM public.documents d WHERE d.file_path=p_path AND split_part(p_path,'/',1)=d.intern_id::text AND public.assigned_intern(d.intern_id))
  OR EXISTS(SELECT 1 FROM public.document_versions v WHERE v.file_path=p_path AND v.committed_at IS NOT NULL AND public.assigned_intern(v.intern_id))
  OR EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id
   WHERE f.file_path=p_path AND v.committed_at IS NOT NULL AND public.assigned_intern(f.intern_id))
  OR EXISTS(SELECT 1 FROM public.documents d WHERE d.legacy_evidence->>'file_path'=p_path
   AND split_part(p_path,'/',1)=d.intern_id::text AND d.legacy_evidence->>'intern_id'=d.intern_id::text
   AND d.legacy_evidence->>'id'=d.id::text AND d.legacy_evidence->>'upload_version'='0'
   AND d.legacy_evidence->>'provenance'='stored-legacy-metadata-unverified' AND public.assigned_intern(d.intern_id)))
$$;
CREATE OR REPLACE FUNCTION public.can_delete_staged_document(p_path text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 RETURN public.owns_intern(auth.uid()) AND (
  EXISTS(SELECT 1 FROM public.document_versions WHERE file_path=p_path AND intern_id=auth.uid() AND committed_at IS NULL AND abandoned_at IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id
   WHERE f.file_path=p_path AND f.intern_id=auth.uid() AND v.committed_at IS NULL AND v.abandoned_at IS NOT NULL))
  AND NOT EXISTS(SELECT 1 FROM public.documents WHERE file_path=p_path)
  AND NOT EXISTS(SELECT 1 FROM public.document_versions WHERE file_path=p_path AND committed_at IS NOT NULL)
  AND NOT EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id WHERE f.file_path=p_path AND v.committed_at IS NOT NULL)
  AND NOT EXISTS(SELECT 1 FROM public.documents WHERE legacy_evidence->>'file_path'=p_path);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS m12_current_year ON public.academic_years(is_current) WHERE is_current;
REVOKE UPDATE(is_current) ON public.academic_years FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_set_current_year(p_id uuid,p_expected_current uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE chosen public.academic_years; previous uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active Admin required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 SELECT * INTO chosen FROM public.academic_years WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR chosen.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Active academic year required; refresh' USING errcode='40001'; END IF;
 SELECT id INTO previous FROM public.academic_years WHERE is_current;
 IF previous=p_id THEN RETURN jsonb_build_object('id',p_id,'year',to_jsonb(chosen),'previous_id',previous); END IF;
 IF previous IS DISTINCT FROM p_expected_current THEN RAISE EXCEPTION 'Current year changed; refresh before confirming' USING errcode='40001'; END IF;
 UPDATE public.academic_years SET is_current=false WHERE is_current;
 UPDATE public.academic_years SET is_current=true WHERE id=p_id RETURNING * INTO chosen;
 RETURN jsonb_build_object('id',p_id,'year',to_jsonb(chosen),'previous_id',previous);
END $$;

CREATE OR REPLACE FUNCTION public.admin_add_requirement(p_intern_id uuid,p_name text,p_request_id uuid)
RETURNS public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.documents;
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active Admin required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 IF p_request_id IS NULL OR nullif(btrim(p_name),'') IS NULL OR length(btrim(p_name))>200
 THEN RAISE EXCEPTION 'Requirement name (1-200 characters) and retry identity required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_intern_id AND role='intern')
  OR NOT EXISTS (SELECT 1 FROM public.interns WHERE id=p_intern_id)
 THEN RAISE EXCEPTION 'Current Intern account and extension required'; END IF;
 SELECT * INTO r FROM public.documents WHERE id=p_request_id;
 IF FOUND THEN
  IF r.intern_id IS DISTINCT FROM p_intern_id OR r.name IS DISTINCT FROM btrim(p_name)
   OR r.doc_type IS DISTINCT FROM 'custom:'||p_request_id::text
  THEN RAISE EXCEPTION 'Requirement retry identity reused with different content' USING errcode='40001'; END IF;
  RETURN r;
 END IF;
 INSERT INTO public.documents(id,intern_id,doc_type,name)
 VALUES(p_request_id,p_intern_id,'custom:'||p_request_id::text,btrim(p_name)) RETURNING * INTO r;
 RETURN r;
END $$;

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
 -- Exactly the M03 interval/evidence contract, plus the moving future bound.
 -- Legacy or invalid evidence must use the existing correction-review flow.
 IF r.time_in IS NULL OR r.time_out IS NULL OR r.hours IS NULL
  OR r.log_date IS DISTINCT FROM (r.clocked_in_at AT TIME ZONE 'Asia/Manila')::date
  OR r.time_in IS DISTINCT FROM (r.clocked_in_at AT TIME ZONE 'Asia/Manila')::time
  OR r.time_out IS DISTINCT FROM (r.clocked_out_at AT TIME ZONE 'Asia/Manila')::time
  OR r.clocked_out_at<=r.clocked_in_at OR r.clocked_out_at-r.clocked_in_at>interval '16 hours'
  OR r.clocked_out_at>clock_timestamp()
  OR r.hours IS DISTINCT FROM extract(epoch FROM r.clocked_out_at-r.clocked_in_at)/3600
  OR (r.verified AND r.verified_by IS NULL) OR (NOT r.verified AND r.verified_by IS NOT NULL)
 THEN RAISE EXCEPTION 'Closed trustworthy attendance required; request a correction for legacy or invalid evidence'; END IF;
 IF r.verified THEN RETURN r; END IF; -- Safe lost-response retry, no duplicate audit.
 UPDATE public.attendance_logs SET verified=true,verified_by=auth.uid()
 WHERE id=p_id RETURNING * INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_add_requirement(uuid,text,uuid),public.verify_attendance(uuid,timestamptz,timestamptz),public.admin_set_current_year(uuid,uuid),public.legacy_document_access(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_requirement(uuid,text,uuid),public.verify_attendance(uuid,timestamptz,timestamptz),public.admin_set_current_year(uuid,uuid),public.legacy_document_access(uuid)
 TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

-- Fresh, empty application catalog; existing Auth/Storage retained. NOT the updater.
-- NEW project: read INSync_New_Project_Setup_README.md. No reset is required.
-- Existing authorized rebuild only: INSync_Reset_Rebuild_README.md.
-- No account privileges inferred from metadata.
-- initial_schema.sql SHA256 ba56755e574df40fd533e5030a71f754013a1e2198facf7ee6f0f9d69838ba50
-- migrations/M01_authority.sql SHA256 0bc4ac9cc24a5f6665590760c6eca481c8d8dfeb45c70c33c1a5d42688274825
-- migrations/M02_trusted_audit.sql SHA256 ce82f52120a262353a9fbd5e847c1f17d82e80bc03bf49b80e0ba28f6a63ebef
-- migrations/M03_attendance_integrity.sql SHA256 03aac1989555c237c976892d1ad40ba9cc78da3499a3819d41459ff4ce47bf16
-- migrations/M04_private_documents_bucket.sql SHA256 7615f9b492deb993bd6a2d3da8ace6fc680e5b891b1a7da18201fbd862447583
-- migrations/M06_rubric_hours.sql SHA256 7bd83bb4167b67dbe756ce34b99c7481eddb961e6bdd155d2011bb1129a45371
-- migrations/M07_account_lifecycle.sql SHA256 140c73cd3beed103b23764da1651f27994bc36ab0347aae03c6224dc81685305
-- migrations/M08_document_versions.sql SHA256 4e98c1bc8feb71575b777fe0eba29557dd1c64ee4e110f664117ce7139804b8f
-- migrations/M10_flexible_submissions.sql SHA256 ca63814a2e4a401bdaeca7d924741522daeae83d29ad9ae711ea9b73ed785cde
-- migrations/M11_admin_history.sql SHA256 8820174af95dfaeaefa09a6339e2c94e8d866034bb33fcd91bdc85f834d54ec4
-- migrations/M12_handover_workflows.sql SHA256 724212e28c6f2643429170b4635bedefa8e19741df841ced84bd02962836e1cd
-- migrations/M13_coordinator_operations.sql SHA256 2df30c24085bcc4eefce3fd62a5603468b714012d07e1a16428f6d9281c6d923
-- migrations/M14_last_admin_protection.sql SHA256 9c7bbeba0c1816d797f565e9b9a95808638cb50f994f8e1011d6b5683b223707
-- M05_validate_attendance.sql SHA256 356376e49c03eb4fd3562b07bada0ab38b13c48186b1a5cfbbbcce33b62d1d79
-- M09_validate_domain.sql SHA256 a0766715d146e8dab69267a1327df47dff4c67f620fc97370d317872daebe5b4
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';
SET LOCAL lock_timeout='10s';
SET LOCAL check_function_bodies=off;
SELECT pg_advisory_xact_lock(404,1);
DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Trusted postgres operator required'; END IF;
 IF to_regclass('auth.users') IS NULL OR to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL OR to_regprocedure('auth.uid()') IS NULL
 THEN RAISE EXCEPTION 'Real Supabase Auth/Storage provider baseline required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='documents' AND NOT public AND file_size_limit=10485760
  AND cardinality(allowed_mime_types)=3
  AND allowed_mime_types @> ARRAY['application/pdf','image/jpeg','image/png']
  AND allowed_mime_types <@ ARRAY['application/pdf','image/jpeg','image/png'])
 THEN RAISE EXCEPTION 'Provision/review the existing private documents bucket (10 MiB PDF/JPEG/PNG) first; no managed bucket changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Provider Storage RLS must remain enabled'; END IF;
END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S'))
 THEN RAISE EXCEPTION 'Fresh installation requires blank application tables, not an existing-database update'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  AND p.oid::regprocedure::text NOT IN ('public.handle_new_user()','public.can_read_document_object(text)','public.can_insert_reserved_document(text)','public.can_delete_staged_document(text)'))
 THEN RAISE EXCEPTION 'Unreviewed public routines remain; do not overwrite a shared application'; END IF;
 IF EXISTS(SELECT 1 FROM pg_type t WHERE t.typnamespace='public'::regnamespace)
 THEN RAISE EXCEPTION 'Unreviewed public types remain: fresh application requires a reviewed empty namespace'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE deleted_at IS NULL AND (email IS NULL OR btrim(email)=''))
 THEN RAISE EXCEPTION 'Retained Auth identity has no supported email: review reconciliation, no invented email'; END IF;
END $$;
CREATE TABLE public."companies" (
 "name" text NOT NULL,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "archived_at" timestamp with time zone
);
CREATE TABLE public."course_sections" (
 "name" text NOT NULL,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "archived_at" timestamp with time zone
);
CREATE TABLE public."academic_years" (
 "is_current" boolean DEFAULT false NOT NULL,
 "label" text NOT NULL,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "archived_at" timestamp with time zone
);
CREATE TABLE public."profiles" (
 "status" text DEFAULT 'Pending'::text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "student_id" text,
 "organization" text,
 "role" text NOT NULL,
 "email" text NOT NULL,
 "full_name" text NOT NULL,
 "id" uuid NOT NULL,
 "requested_role" text
);
CREATE TABLE public."interns" (
 "status" text DEFAULT 'On Track'::text NOT NULL,
 "required_hours" numeric DEFAULT 486 NOT NULL,
 "section_id" uuid,
 "company_id" uuid,
 "instructor_id" uuid,
 "id" uuid NOT NULL
);
CREATE TABLE public."attendance_logs" (
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "verified_by" uuid,
 "verified" boolean DEFAULT false NOT NULL,
 "accomplishment" text,
 "hours" numeric,
 "time_out" time without time zone,
 "time_in" time without time zone,
 "log_date" date DEFAULT CURRENT_DATE NOT NULL,
 "intern_id" uuid NOT NULL,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "clocked_in_at" timestamp with time zone,
 "clocked_out_at" timestamp with time zone
);
CREATE TABLE public."attendance_exceptions" (
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "reviewed_by" uuid,
 "status" text DEFAULT 'Pending'::text NOT NULL,
 "reason" text NOT NULL,
 "claimed_time_out" time without time zone,
 "claimed_time_in" time without time zone,
 "log_date" date NOT NULL,
 "intern_id" uuid NOT NULL,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "claimed_end_date" date,
 "reviewed_at" timestamp with time zone,
 "review_note" text
);
CREATE TABLE public."evaluations" (
 "overall_score" numeric NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "feedback" text,
 "competencies" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "type" text DEFAULT 'Evaluation'::text NOT NULL,
 "evaluator_id" uuid,
 "intern_id" uuid NOT NULL,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "submission_id" uuid
);
CREATE TABLE public."documents" (
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "note" text,
 "file_name" text,
 "file_path" text,
 "status" text DEFAULT 'Pending'::text NOT NULL,
 "name" text NOT NULL,
 "doc_type" text NOT NULL,
 "intern_id" uuid NOT NULL,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "reviewed_by" uuid,
 "reviewed_at" timestamp with time zone,
 "upload_version" bigint DEFAULT 0 NOT NULL,
 "review_revision" bigint DEFAULT 0 NOT NULL,
 "legacy_evidence" jsonb
);
CREATE TABLE public."announcements" (
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "target_intern_id" uuid,
 "target" text DEFAULT 'All Interns'::text NOT NULL,
 "body" text NOT NULL,
 "title" text NOT NULL,
 "instructor_id" uuid,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "recipient_ids" uuid[]
);
CREATE TABLE public."alerts" (
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "dismissed" boolean DEFAULT false NOT NULL,
 "severity" text DEFAULT 'medium'::text NOT NULL,
 "detail" text NOT NULL,
 "type" text NOT NULL,
 "intern_id" uuid,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL
);
CREATE TABLE public."audit_logs" (
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "detail" text,
 "action" text NOT NULL,
 "actor_name" text,
 "actor_id" uuid,
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "source" text,
 "event_data" jsonb
);
CREATE TABLE public."document_versions" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "document_id" uuid NOT NULL,
 "intern_id" uuid NOT NULL,
 "version_no" bigint,
 "expected_version" bigint NOT NULL,
 "file_path" text NOT NULL,
 "file_name" text NOT NULL,
 "mime_type" text NOT NULL,
 "byte_size" bigint NOT NULL,
 "created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
 "expires_at" timestamp with time zone NOT NULL,
 "committed_at" timestamp with time zone,
 "abandoned_at" timestamp with time zone,
 "status" text DEFAULT 'Pending'::text NOT NULL,
 "note" text,
 "reviewed_by" uuid,
 "reviewed_at" timestamp with time zone
);
CREATE TABLE public."document_review_events" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "document_id" uuid NOT NULL,
 "version_id" uuid NOT NULL,
 "intern_id" uuid NOT NULL,
 "review_revision" bigint NOT NULL,
 "status" text NOT NULL,
 "note" text,
 "reviewed_by" uuid NOT NULL,
 "reviewed_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."submissions" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "intern_id" uuid NOT NULL,
 "current_version" bigint DEFAULT 0 NOT NULL,
 "review_revision" bigint DEFAULT 0 NOT NULL,
 "title" text NOT NULL,
 "description" text DEFAULT ''::text NOT NULL,
 "status" text DEFAULT 'Pending'::text NOT NULL,
 "note" text,
 "reviewed_by" uuid,
 "reviewed_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
CREATE TABLE public."submission_versions" (
 "id" uuid NOT NULL,
 "submission_id" uuid NOT NULL,
 "intern_id" uuid NOT NULL,
 "expected_version" bigint NOT NULL,
 "expected_revision" bigint NOT NULL,
 "version_no" bigint,
 "title" text NOT NULL,
 "description" text NOT NULL,
 "manifest" jsonb NOT NULL,
 "created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
 "expires_at" timestamp with time zone NOT NULL,
 "committed_at" timestamp with time zone,
 "abandoned_at" timestamp with time zone,
 "status" text DEFAULT 'Pending'::text NOT NULL,
 "review_revision" bigint DEFAULT 0 NOT NULL,
 "note" text,
 "reviewed_by" uuid,
 "reviewed_at" timestamp with time zone
);
CREATE TABLE public."submission_files" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "version_id" uuid NOT NULL,
 "intern_id" uuid NOT NULL,
 "ordinal" integer NOT NULL,
 "file_path" text NOT NULL,
 "file_name" text NOT NULL,
 "mime_type" text NOT NULL,
 "byte_size" bigint NOT NULL
);
CREATE TABLE public."submission_reviews" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "version_id" uuid NOT NULL,
 "intern_id" uuid NOT NULL,
 "review_revision" bigint NOT NULL,
 "status" text NOT NULL,
 "note" text,
 "reviewed_by" uuid NOT NULL,
 "reviewed_at" timestamp with time zone NOT NULL
);
-- Latest M01-M14 routines; M13 fixes the exact frontend RPC contracts.
-- Latest source: M12_handover_workflows.sql; public.admin_add_requirement(uuid,text,uuid)
CREATE OR REPLACE FUNCTION public.admin_add_requirement(p_intern_id uuid, p_name text, p_request_id uuid)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
END $function$
;
-- Latest source: M11_admin_history.sql; public.admin_archive_master(text,uuid,bigint)
CREATE OR REPLACE FUNCTION public.admin_archive_master(p_table text, p_id uuid, p_expected_references bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare impact jsonb; entry jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 impact:=public.admin_master_impact(p_table,p_id);
 if not (impact->>'can_archive')::boolean then raise exception 'Already archived or current academic year; refresh'; end if;
 if (impact->>'references')::bigint is distinct from p_expected_references then raise exception 'Reference impact changed; inspect again' using errcode='40001'; end if;
 execute format('update public.%I set archived_at=clock_timestamp() where id=$1 and archived_at is null returning to_jsonb(%I)',p_table,p_table)
  into entry using p_id;
 if entry is null then raise exception 'Entry changed; refresh' using errcode='40001'; end if;
 return jsonb_build_object('id',p_id,'entry',entry,'references',impact->'references');
end $function$
;
-- Latest source: M11_admin_history.sql; public.admin_master_impact(text,uuid)
CREATE OR REPLACE FUNCTION public.admin_master_impact(p_table text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r jsonb; refs bigint;
begin
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 if p_table not in ('companies','course_sections','academic_years') or p_table is null then raise exception 'Unsupported master table'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',p_table) into r using p_id;
 if r is null then raise exception 'Entry missing; refresh' using errcode='40001'; end if;
 if p_table='companies' then select count(*) into refs from public.interns where company_id=p_id;
 elsif p_table='course_sections' then select count(*) into refs from public.interns where section_id=p_id;
 else refs:=0; end if;
 return jsonb_build_object('id',p_id,'entry',r,'references',refs,'can_archive',r->>'archived_at' is null and coalesce((r->>'is_current')::boolean,false)=false);
end $function$
;
-- Latest source: M07_account_lifecycle.sql; public.admin_set_assignment(uuid,uuid,uuid,uuid,numeric)
CREATE OR REPLACE FUNCTION public.admin_set_assignment(p_id uuid, p_instructor_id uuid, p_company_id uuid, p_section_id uuid, p_required_hours numeric)
 RETURNS public.interns
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.interns;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for share;
 if not public.valid_required_hours(p_required_hours) then raise exception 'Required hours must be >0, <=10000, at most two decimal places'; end if;
 if not exists(select 1 from public.profiles where id=p_id and role='intern') then raise exception 'Current intern required'; end if;
 if p_instructor_id is not null and not exists(select 1 from public.profiles where id=p_instructor_id and role='instructor' and status='Active')
 then raise exception 'Active instructor required'; end if;
 update public.interns set instructor_id=p_instructor_id,company_id=p_company_id,section_id=p_section_id,required_hours=p_required_hours
 where id=p_id returning * into r;
 if not found then raise exception 'Intern extension not found; refresh' using errcode='40001'; end if;
 return r;
end $function$
;
-- Latest source: M12_handover_workflows.sql; public.admin_set_current_year(uuid,uuid)
CREATE OR REPLACE FUNCTION public.admin_set_current_year(p_id uuid, p_expected_current uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
END $function$
;
-- Latest source: M07_account_lifecycle.sql; public.admin_update_account(uuid,jsonb)
CREATE OR REPLACE FUNCTION public.admin_update_account(p_id uuid, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare p public.profiles; i public.interns; k text; next_role text; next_status text;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for share;
 if jsonb_typeof(p_patch) is distinct from 'object' or p_patch='{}'::jsonb then raise exception 'Account patch required'; end if;
 for k in select jsonb_object_keys(p_patch) loop
  if k not in ('full_name','role','status','company_id') then raise exception 'Unsupported account field'; end if;
 end loop;
 select * into p from public.profiles where id=p_id for update;
 if not found then raise exception 'Account not found; refresh' using errcode='40001'; end if;
 next_role:=case when p_patch?'role' then p_patch->>'role' else p.role end;
 next_status:=case when p_patch?'status' then p_patch->>'status' else p.status end;
 if next_role is null or next_role not in ('intern','instructor','admin') or next_status is null or next_status not in ('Pending','Inactive','Active')
 then raise exception 'Valid role/status required'; end if;
 if p_patch?'full_name' and (jsonb_typeof(p_patch->'full_name') is distinct from 'string' or nullif(btrim(p_patch->>'full_name'),'') is null or length(p_patch->>'full_name')>200)
 then raise exception 'Name required, <=200 characters'; end if;
 if (next_role<>'instructor' or next_status<>'Active') and exists(select 1 from public.interns where instructor_id=p_id)
 then raise exception 'Reassign or explicitly unassign interns first'; end if;
 if next_role<>'intern' and exists(select 1 from public.interns where id=p_id and instructor_id is not null)
 then raise exception 'Explicitly unassign this intern before changing role'; end if;
 if next_role='intern' then
   insert into public.interns(id) values(p_id) on conflict(id) do nothing;
   if p_patch?'company_id' then
    update public.interns set company_id=(p_patch->>'company_id')::uuid where id=p_id;
   end if;
 elsif p_patch?'company_id' then raise exception 'Company applies only to intern accounts'; end if;
 update public.profiles set full_name=case when p_patch?'full_name' then btrim(p_patch->>'full_name') else full_name end,
   role=next_role,status=next_status where id=p_id returning * into p;
 select * into i from public.interns where id=p_id;
 -- Deferred triggers also enforce trusted SQL changes; errors still abort RPC.
 return jsonb_build_object('id',p.id,'profile',to_jsonb(p),'intern',case when i.id is null then null else to_jsonb(i) end);
end $function$
;
-- Latest source: M01_authority.sql; public.assigned_intern(uuid)
CREATE OR REPLACE FUNCTION public.assigned_intern(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select coalesce(public.current_role()='instructor' and exists(
     select 1 from public.interns i join public.profiles p on p.id=i.id
     where i.id=p_id and i.instructor_id=auth.uid() and p.role='intern'),false) $function$
;
-- Latest source: M08_document_versions.sql; public.attach_standard_docs(uuid)
CREATE OR REPLACE FUNCTION public.attach_standard_docs(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_id and role='intern') then raise exception 'Current intern required'; end if;
 insert into public.documents(intern_id,doc_type,name)
 select p_id,t,k from (values('moa','Memorandum of Agreement (MOA)'),('endorsement','Endorsement Letter'),
   ('consent','Parent / Guardian Consent Form'),('medical','Medical Certificate')) x(t,k)
 on conflict(intern_id,doc_type) do nothing;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.doc_type),'[]'::jsonb) into result from public.documents d where intern_id=p_id;
 return jsonb_build_object('id',p_id,'documents',result);
end $function$
;
-- Latest source: M11_admin_history.sql; public.audit_history(text,text,text,date,date,integer,integer)
CREATE OR REPLACE FUNCTION public.audit_history(p_actor text DEFAULT ''::text, p_action text DEFAULT ''::text, p_category text DEFAULT ''::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_page integer DEFAULT 1, p_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 if p_size is null or p_size not in (10,25,50,100) or p_page is null or p_page<1 then raise exception 'Valid page and page size required'; end if;
 if p_from>p_to then raise exception 'Start date must not exceed end date'; end if;
 if length(p_actor)>200 or length(p_action)>200 or length(p_category)>100 then raise exception 'Filter too long'; end if;
 with filtered as materialized (
  select l.* from public.audit_logs l where
   (coalesce(p_actor,'')='' or strpos(lower(coalesce(l.actor_name,'')),lower(p_actor))>0 or l.actor_id::text=p_actor)
   and (coalesce(p_action,'')='' or strpos(lower(coalesce(l.action,'')),lower(p_action))>0)
   and (coalesce(p_category,'')='' or l.event_data->>'table'=p_category)
   and (p_from is null or l.created_at >= p_from::timestamp at time zone 'Asia/Manila')
   and (p_to is null or l.created_at < (p_to+1)::timestamp at time zone 'Asia/Manila')
 ), counted as (select count(*) n from filtered), paging as (
  select n,greatest(1,ceil(n::numeric/p_size)::integer) pages,
   least(p_page,greatest(1,ceil(n::numeric/p_size)::integer)) page from counted
 ), page_rows as (
  select * from filtered order by created_at desc,id desc limit p_size offset (select (page-1)::bigint*p_size from paging)
 ) select jsonb_build_object('id','audit-history','total',n,'pages',pages,'page',page,'size',p_size,
  'rows',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from page_rows x),'[]'::jsonb)) into result from paging;
 return result;
end $function$
;
-- Latest source: M01_authority.sql; public.bind_announcement()
CREATE OR REPLACE FUNCTION public.bind_announcement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if public.current_role() not in ('admin','instructor') or public.current_role() is null
     or new.instructor_id is distinct from auth.uid() then
    raise exception 'Active staff author required' using errcode='42501';
  end if;
  if new.recipient_ids is not null then raise exception 'Audience is server-derived'; end if;
  if new.target_intern_id is null then
    if new.target <> 'All Interns' then raise exception 'Recipient UUID required'; end if;
    select coalesce(array_agg(i.id),array[]::uuid[]) into new.recipient_ids
    from public.interns i join public.profiles p on p.id=i.id
    where i.instructor_id=auth.uid() and p.role='intern' and p.status='Active';
    if cardinality(new.recipient_ids)=0 then raise exception 'No active assigned recipients'; end if;
  else
    if new.target='All Interns' or not exists(select 1 from public.interns i join public.profiles p on p.id=i.id
      where i.id=new.target_intern_id and i.instructor_id=auth.uid() and p.role='intern' and p.status='Active') then
      raise exception 'Recipient must be an active assigned intern' using errcode='42501';
    end if;
    new.target := 'Personal'; -- Display names are not identity or privacy rules.
    new.recipient_ids := array[new.target_intern_id];
  end if;
  return new;
end $function$
;
-- Latest source: M12_handover_workflows.sql; public.can_delete_staged_document(text)
CREATE OR REPLACE FUNCTION public.can_delete_staged_document(p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
END $function$
;
-- Latest source: M10_flexible_submissions.sql; public.can_insert_reserved_document(text)
CREATE OR REPLACE FUNCTION public.can_insert_reserved_document(p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 perform pg_advisory_xact_lock(404,1);
 return public.owns_intern(auth.uid()) and (
  exists(select 1 from public.document_versions v join public.documents d on d.id=v.document_id
   where v.file_path=p_path and v.intern_id=auth.uid() and v.committed_at is null and v.abandoned_at is null
    and v.expires_at>clock_timestamp() and v.expected_version=d.upload_version)
  or exists(select 1 from public.submission_files f join public.submission_versions v on v.id=f.version_id join public.submissions s on s.id=v.submission_id
   where f.file_path=p_path and f.intern_id=auth.uid() and v.committed_at is null and v.abandoned_at is null
    and v.expires_at>clock_timestamp() and v.expected_version=s.current_version and v.expected_revision=s.review_revision));
end $function$
;
-- Latest source: M12_handover_workflows.sql; public.can_read_document_object(text)
CREATE OR REPLACE FUNCTION public.can_read_document_object(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 SELECT public.is_active() AND ((public.current_role()='intern' AND split_part(p_path,'/',1)=auth.uid()::text) OR public.is_admin()
  OR EXISTS(SELECT 1 FROM public.documents d WHERE d.file_path=p_path AND split_part(p_path,'/',1)=d.intern_id::text AND public.assigned_intern(d.intern_id))
  OR EXISTS(SELECT 1 FROM public.document_versions v WHERE v.file_path=p_path AND v.committed_at IS NOT NULL AND public.assigned_intern(v.intern_id))
  OR EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id
   WHERE f.file_path=p_path AND v.committed_at IS NOT NULL AND public.assigned_intern(f.intern_id))
  OR EXISTS(SELECT 1 FROM public.documents d WHERE d.legacy_evidence->>'file_path'=p_path
   AND split_part(p_path,'/',1)=d.intern_id::text AND d.legacy_evidence->>'intern_id'=d.intern_id::text
   AND d.legacy_evidence->>'id'=d.id::text AND d.legacy_evidence->>'upload_version'='0'
   AND d.legacy_evidence->>'provenance'='stored-legacy-metadata-unverified' AND public.assigned_intern(d.intern_id)))
$function$
;
-- Latest source: M01_authority.sql; public.can_read_intern(uuid)
CREATE OR REPLACE FUNCTION public.can_read_intern(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select public.can_review(p_id) or public.owns_intern(p_id) $function$
;
-- Latest source: M01_authority.sql; public.can_review(uuid)
CREATE OR REPLACE FUNCTION public.can_review(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select public.is_admin() or public.assigned_intern(p_id) $function$
;
-- Latest source: M08_document_versions.sql; public.cancel_document_upload(uuid)
CREATE OR REPLACE FUNCTION public.cancel_document_upload(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v public.document_versions; d public.documents;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into v from public.document_versions where id=p_id and intern_id=auth.uid() for update;
 if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned reservation required' using errcode='42501'; end if;
 if v.committed_at is not null then
   select * into d from public.documents where id=v.document_id;
   return jsonb_build_object('id',v.id,'committed',true,'document',to_jsonb(d));
 end if;
 update public.document_versions set abandoned_at=coalesce(abandoned_at,clock_timestamp()) where id=v.id;
 return jsonb_build_object('id',v.id,'committed',false,'path',v.file_path,
   'object_exists',exists(select 1 from storage.objects where bucket_id='documents' and name=v.file_path));
end $function$
;
-- Latest source: M10_flexible_submissions.sql; public.cancel_submission(uuid)
CREATE OR REPLACE FUNCTION public.cancel_submission(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v public.submission_versions; s public.submissions; paths jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into v from public.submission_versions where id=p_version_id and intern_id=auth.uid() for update;
 if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned reservation required' using errcode='42501'; end if;
 if v.committed_at is not null then
  select * into s from public.submissions where id=v.submission_id;
  return jsonb_build_object('id',v.id,'committed',true,'submission',to_jsonb(s),'version',v.version_no);
 end if;
 update public.submission_versions set abandoned_at=coalesce(abandoned_at,clock_timestamp()) where id=v.id;
 select coalesce(jsonb_agg(jsonb_build_object('path',f.file_path,'object_exists',exists(select 1 from storage.objects where bucket_id='documents' and name=f.file_path)) order by f.ordinal),'[]'::jsonb)
 into paths from public.submission_files f where version_id=v.id;
 return jsonb_build_object('id',v.id,'committed',false,'files',paths);
end $function$
;
-- Latest source: M07_account_lifecycle.sql; public.check_account_relationships()
CREATE OR REPLACE FUNCTION public.check_account_relationships()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare target uuid; p public.profiles;
begin
 target:=case when tg_op='DELETE' then old.id else new.id end;
 select * into p from public.profiles where id=target;
 if not found then return new; end if;
 if p.role='intern' and not exists(select 1 from public.interns where id=target) then raise exception 'Intern extension required'; end if;
 if (p.role<>'instructor' or p.status<>'Active') and exists(select 1 from public.interns where instructor_id=target)
 then raise exception 'Reassign or explicitly unassign interns before instructor demotion/deactivation'; end if;
 if exists(select 1 from public.interns i left join public.profiles staff on staff.id=i.instructor_id
   where i.id=target and i.instructor_id is not null
     and (p.role<>'intern' or staff.role is distinct from 'instructor' or staff.status is distinct from 'Active'))
 then raise exception 'Assignment requires an intern and an Active instructor'; end if;
 return new;
end $function$
;
-- Latest source: M03_attendance_integrity.sql; public.clock_in()
CREATE OR REPLACE FUNCTION public.clock_in()
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_logs; ts timestamptz;
begin
  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,101));
  perform 1 from public.profiles where id=auth.uid() for share;
  if not public.owns_intern(auth.uid()) then raise exception 'Account changed; refresh' using errcode='42501'; end if;
  ts:=clock_timestamp(); -- after serialization, including midnight lock waits
  if exists(select 1 from public.attendance_logs where intern_id=auth.uid()
    and (time_out is null or log_date=(ts at time zone 'Asia/Manila')::date)) then
    raise exception 'Attendance already exists or a session is open; refresh' using errcode='40001';
  end if;
  insert into public.attendance_logs(intern_id,log_date,time_in,clocked_in_at,created_at,verified,verified_by)
  values(auth.uid(),(ts at time zone 'Asia/Manila')::date,(ts at time zone 'Asia/Manila')::time,ts,ts,false,null) returning * into r;
  return r;
end $function$
;
-- Latest source: M03_attendance_integrity.sql; public.clock_out(uuid,text)
CREATE OR REPLACE FUNCTION public.clock_out(p_id uuid, p_accomplishment text)
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_logs; ts timestamptz; seconds numeric;
begin
  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
  if p_accomplishment is null or length(p_accomplishment)>500 then raise exception 'Accomplishment must be at most 500 characters'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,101));
  perform 1 from public.profiles where id=auth.uid() for share;
  if not public.owns_intern(auth.uid()) then raise exception 'Account changed; refresh' using errcode='42501'; end if;
  select * into r from public.attendance_logs where id=p_id and intern_id=auth.uid() for update;
  if not found or r.time_out is not null or r.verified or r.clocked_in_at is null then
    raise exception 'Open unverified clock session not found; refresh or request correction' using errcode='40001';
  end if;
  ts:=clock_timestamp(); seconds:=extract(epoch from ts-r.clocked_in_at);
  if seconds<=0 or seconds>57600 then raise exception 'Shift duration must be positive and at most 16 hours; request correction'; end if;
  update public.attendance_logs set time_out=(ts at time zone 'Asia/Manila')::time,clocked_out_at=ts,
    hours=seconds/3600,accomplishment=p_accomplishment where id=r.id and time_out is null returning * into r;
  if not found then raise exception 'Session changed; refresh' using errcode='40001'; end if;
  return r;
end $function$
;
-- Latest source: M01_authority.sql; public.correction_instants(date,time without time zone,time without time zone,date)
CREATE OR REPLACE FUNCTION public.correction_instants(p_date date, p_in time without time zone, p_out time without time zone, p_end date)
 RETURNS TABLE(start_at timestamp with time zone, end_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if p_date is null or p_in is null or p_out is null or p_end is null
     or p_end not in (p_date,p_date+1) then raise exception 'Explicit valid start/end date and times required'; end if;
  start_at := (p_date+p_in) at time zone 'Asia/Manila';
  end_at := (p_end+p_out) at time zone 'Asia/Manila';
  if end_at<=start_at or end_at-start_at>interval '16 hours' or end_at>clock_timestamp() then
    raise exception 'Invalid, future or excessive claimed interval';
  end if;
  return next;
end $function$
;
-- Latest source: M01_authority.sql; public."current_role"()
CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select role from public.profiles where id=auth.uid() and status='Active' $function$
;
-- Latest source: M08_document_versions.sql; public.document_access(uuid,bigint,bigint)
CREATE OR REPLACE FUNCTION public.document_access(p_id uuid, p_expected_version bigint, p_expected_revision bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare d public.documents;
begin
 select * into d from public.documents where id=p_id;
 if not found or not public.can_read_intern(d.intern_id) then raise exception 'Document access not permitted' using errcode='42501'; end if;
 if d.upload_version is distinct from p_expected_version or d.review_revision is distinct from p_expected_revision
 then raise exception 'Evidence changed; refresh' using errcode='40001'; end if;
 if d.file_path is null or split_part(d.file_path,'/',1)<>d.intern_id::text
 or not exists(select 1 from storage.objects where bucket_id='documents' and name=d.file_path) then raise exception 'File missing; request resubmission'; end if;
 return jsonb_build_object('id',d.id,'file_path',d.file_path,'file_name',d.file_name,'upload_version',d.upload_version);
end $function$
;
-- Latest source: M12_handover_workflows.sql; public.finalize_document_upload(uuid)
CREATE OR REPLACE FUNCTION public.finalize_document_upload(p_upload_id uuid)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
END $function$
;
-- Latest source: M10_flexible_submissions.sql; public.finalize_submission(uuid)
CREATE OR REPLACE FUNCTION public.finalize_submission(p_version_id uuid)
 RETURNS public.submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v public.submission_versions; s public.submissions;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into v from public.submission_versions where id=p_version_id and intern_id=auth.uid() for update;
 if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned reservation required' using errcode='42501'; end if;
 select * into s from public.submissions where id=v.submission_id for update;
 if v.committed_at is not null then return s; end if;
 if v.abandoned_at is not null or v.expires_at<=clock_timestamp() or v.expected_version<>s.current_version or v.expected_revision<>s.review_revision
 then raise exception 'Reservation expired or submission/review changed; refresh' using errcode='40001'; end if;
 if (select count(*) from public.submission_files where version_id=v.id)<>jsonb_array_length(v.manifest)
  or exists(select 1 from public.submission_files f where version_id=v.id and not exists(select 1 from storage.objects o
   where o.bucket_id='documents' and o.name=f.file_path and o.metadata->>'mimetype'=f.mime_type and (o.metadata->>'size')::numeric=f.byte_size))
 then raise exception 'Complete file set with exact stored MIME/size required'; end if;
 update public.submission_versions set version_no=s.current_version+1,committed_at=clock_timestamp() where id=v.id;
 update public.submissions set current_version=current_version+1,review_revision=0,title=v.title,description=v.description,
  status='Pending',note=null,reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp() where id=s.id returning * into s;
 return s;
end $function$
;
-- Latest source: M01_authority.sql; public.guard_alert_update()
CREATE OR REPLACE FUNCTION public.guard_alert_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin
  if not public.is_admin() and (to_jsonb(new)-'dismissed') is distinct from (to_jsonb(old)-'dismissed') then
    raise exception 'Only dismissal may be changed' using errcode='42501';
  end if;
  return new;
end $function$
;
-- Latest source: M11_admin_history.sql; public.guard_archived_assignment()
CREATE OR REPLACE FUNCTION public.guard_archived_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 perform pg_advisory_xact_lock(404,1);
 if new.company_id is not null and (tg_op='INSERT' or new.company_id is distinct from old.company_id)
  and exists(select 1 from public.companies where id=new.company_id and archived_at is not null)
 then raise exception 'Archived company cannot receive new assignments'; end if;
 if new.section_id is not null and (tg_op='INSERT' or new.section_id is distinct from old.section_id)
  and exists(select 1 from public.course_sections where id=new.section_id and archived_at is not null)
 then raise exception 'Archived section cannot receive new assignments'; end if;
 return new;
end $function$
;
-- Latest source: M03_attendance_integrity.sql; public.guard_attendance_future()
CREATE OR REPLACE FUNCTION public.guard_attendance_future()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin
  if tg_table_name='attendance_logs' then
    if new.log_date>(clock_timestamp() at time zone 'Asia/Manila')::date
      or new.clocked_in_at>clock_timestamp() or new.clocked_out_at>clock_timestamp() then
      raise exception 'Future attendance is not permitted';
    end if;
  else
    if new.log_date>(clock_timestamp() at time zone 'Asia/Manila')::date
      or ((new.claimed_end_date+new.claimed_time_out) at time zone 'Asia/Manila')>clock_timestamp() then
      raise exception 'Future correction is not permitted';
    end if;
  end if;
  return new;
end $function$
;
-- Latest source: M01_authority.sql; public.guard_domain_identity()
CREATE OR REPLACE FUNCTION public.guard_domain_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if new.id is distinct from old.id or new.intern_id is distinct from old.intern_id then
    raise exception 'Record ownership is immutable' using errcode='42501';
  end if;
  if tg_table_name='evaluations' then
    if new.evaluator_id is distinct from old.evaluator_id then
      raise exception 'Evaluation author is immutable' using errcode='42501';
    end if;
  end if;
  return new;
end $function$
;
-- Latest source: M14_last_admin_protection.sql; public.guard_last_active_admin()
CREATE OR REPLACE FUNCTION public.guard_last_active_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF old.role<>'admin' OR old.status<>'Active' THEN
  IF tg_op='DELETE' THEN RETURN old; END IF;
  RETURN new;
 END IF;
 IF tg_op='UPDATE' AND new.role='admin' AND new.status='Active' THEN RETURN new; END IF;
 PERFORM pg_advisory_xact_lock(404,1);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>old.id AND role='admin' AND status='Active') THEN
  RAISE EXCEPTION 'Keep at least one Active Admin. Activate another administrator before removing this account or changing its role/status.' USING errcode='23514';
 END IF;
 IF tg_op='DELETE' THEN RETURN old; END IF;
 RETURN new;
END $function$
;
-- Latest source: M01_authority.sql; public.guard_profile_update()
CREATE OR REPLACE FUNCTION public.guard_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if new.id is distinct from old.id then raise exception 'Profile identity is immutable' using errcode='42501'; end if;
  -- Trusted SQL operator is the explicitly documented first-Admin bootstrap;
  -- authenticated/anon cannot SET ROLE postgres. Never use caller-set claims.
  if current_user <> 'postgres' and not public.is_admin() and
     (to_jsonb(new)-'full_name') is distinct from (to_jsonb(old)-'full_name') then
    raise exception 'Only Active Admin may change protected profile fields' using errcode='42501';
  end if;
  return new;
end $function$
;
-- Latest source: M01_authority.sql; public.handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  insert into public.profiles(id,full_name,email,role,status,organization,student_id,requested_role)
  values(new.id,coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),'New account'),
    coalesce(new.email,''),'intern','Pending',new.raw_user_meta_data->>'organization',
    new.raw_user_meta_data->>'student_id',
    case when new.raw_user_meta_data->>'requested_role' in ('intern','instructor','admin')
      then new.raw_user_meta_data->>'requested_role' else 'intern' end);
  insert into public.interns(id) values(new.id);
  return new;
end $function$
;
-- Latest source: M01_authority.sql; public.is_active()
CREATE OR REPLACE FUNCTION public.is_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select coalesce(exists(select 1 from public.profiles where id=auth.uid() and status='Active'),false) $function$
;
-- Latest source: M01_authority.sql; public.is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select coalesce(public.current_role()='admin',false) $function$
;
-- Latest source: M12_handover_workflows.sql; public.legacy_document_access(uuid)
CREATE OR REPLACE FUNCTION public.legacy_document_access(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
END $function$
;
-- Latest source: M01_authority.sql; public.my_profile()
CREATE OR REPLACE FUNCTION public.my_profile()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select case when p.status='Active' then to_jsonb(p)
     else jsonb_build_object('id',p.id,'status',p.status) end
     from public.profiles p where p.id=auth.uid() $function$
;
-- Latest source: M01_authority.sql; public.owns_intern(uuid)
CREATE OR REPLACE FUNCTION public.owns_intern(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select coalesce(public.current_role()='intern' and p_id=auth.uid()
     and exists(select 1 from public.interns where id=p_id),false) $function$
;
-- Latest source: M01_authority.sql; public.related_profile_names(uuid[])
CREATE OR REPLACE FUNCTION public.related_profile_names(p_ids uuid[])
 RETURNS TABLE(id uuid, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select p.id,p.full_name from public.profiles p
     where public.is_active() and p.id=any(p_ids) and (
       p.id=auth.uid() or public.is_admin() or public.assigned_intern(p.id)
       or (public.current_role()='intern' and (
         exists(select 1 from public.interns i where i.id=auth.uid() and i.instructor_id=p.id and p.role='instructor')
         or exists(select 1 from public.evaluations e where e.intern_id=auth.uid() and e.evaluator_id=p.id and p.role in ('admin','instructor'))))) $function$
;
-- Latest source: M01_authority.sql; public.review_document(uuid,text,text,text)
CREATE OR REPLACE FUNCTION public.review_document(p_id uuid, p_status text, p_note text, p_expected_path text)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.documents;
begin
  select * into r from public.documents where id=p_id for update;
  if not found or not public.can_review(r.intern_id) then raise exception 'Review not permitted' using errcode='42501'; end if;
  if p_status is null or p_status not in ('Pending','Approved','Needs Revision') then raise exception 'Invalid review status'; end if;
  if r.file_path is distinct from p_expected_path then raise exception 'Evidence changed; refresh' using errcode='40001'; end if;
  if p_status='Approved' and (r.file_path is null or split_part(r.file_path,'/',1)<>r.intern_id::text
     or not exists(select 1 from storage.objects where bucket_id='documents' and name=r.file_path)) then
    raise exception 'Valid uploaded evidence required';
  end if;
  if p_status='Needs Revision' and nullif(btrim(p_note),'') is null then raise exception 'Revision note required'; end if;
  if length(p_note)>500 then raise exception 'Note exceeds 500 characters'; end if;
  update public.documents set status=p_status,note=case when p_status='Needs Revision' then btrim(p_note) else null end,
    reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=r.id returning * into r;
  return r;
end $function$
;
-- Latest source: M08_document_versions.sql; public.review_document_version(uuid,text,text,bigint,bigint)
CREATE OR REPLACE FUNCTION public.review_document_version(p_id uuid, p_status text, p_note text, p_expected_version bigint, p_expected_revision bigint)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare d public.documents; v public.document_versions; ts timestamptz;
begin
 perform pg_advisory_xact_lock(404,1);
 ts:=clock_timestamp();
 select * into d from public.documents where id=p_id for update;
 if not found or not public.can_review(d.intern_id) then raise exception 'Review not permitted' using errcode='42501'; end if;
 if d.upload_version is distinct from p_expected_version or d.review_revision is distinct from p_expected_revision
 then raise exception 'Evidence or review changed; refresh' using errcode='40001'; end if;
 if p_status is null or not ((d.status='Pending' and p_status in ('Approved','Needs Revision')) or (d.status='Approved' and p_status='Pending'))
 then raise exception 'Invalid review transition; refresh'; end if;
 if length(p_note)>500 or (p_status='Needs Revision' and nullif(btrim(p_note),'') is null) then raise exception 'Revision note required; maximum 500 characters'; end if;
 select * into v from public.document_versions where document_id=d.id and version_no=d.upload_version and committed_at is not null;
 if not found or v.file_path<>d.file_path or not exists(select 1 from storage.objects where bucket_id='documents' and name=v.file_path
   and metadata->>'mimetype'=v.mime_type and (metadata->>'size')::numeric=v.byte_size)
 then raise exception 'Current version evidence missing; resubmit before review'; end if;
 update public.documents set status=p_status,note=nullif(btrim(p_note),''),reviewed_by=auth.uid(),reviewed_at=ts,
   review_revision=review_revision+1,updated_at=ts where id=d.id returning * into d;
 update public.document_versions set status=p_status,note=d.note,reviewed_by=auth.uid(),reviewed_at=ts where id=v.id;
 insert into public.document_review_events(document_id,version_id,intern_id,review_revision,status,note,reviewed_by,reviewed_at)
 values(d.id,v.id,d.intern_id,d.review_revision,p_status,d.note,auth.uid(),ts);
 return d;
end $function$
;
-- Latest source: M02_trusted_audit.sql; public.review_exception(uuid,text,text)
CREATE OR REPLACE FUNCTION public.review_exception(p_id uuid, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS public.attendance_exceptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_exceptions; a public.attendance_logs;
        start_ts timestamptz; end_ts timestamptz; n integer;
begin
  select * into r from public.attendance_exceptions where id=p_id;
  if not found or not public.can_review(r.intern_id) then raise exception 'Review not permitted' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('Approved','Rejected') then raise exception 'Invalid decision'; end if;
  if length(p_note)>500 or (p_decision='Rejected' and nullif(btrim(p_note),'') is null) then
    raise exception 'Rejection note required; notes must be at most 500 characters';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));
  -- Freeze caller status and assignment for this review; concurrent lifecycle
  -- writes wait or cause a transactional conflict, never grant stale authority.
  perform 1 from public.profiles where id=auth.uid() for share;
  perform 1 from public.interns where id=r.intern_id for share;
  select * into r from public.attendance_exceptions where id=p_id for update;
  if not found or not public.can_review(r.intern_id) then raise exception 'Assignment changed' using errcode='42501'; end if;
  if r.status<>'Pending' then raise exception 'Correction already reviewed; refresh' using errcode='40001'; end if;
  if p_decision='Approved' then
    -- Legacy NULL end date is same-day only; reversed times are never guessed.
    select start_at,end_at into start_ts,end_ts from public.correction_instants(
      r.log_date,r.claimed_time_in,r.claimed_time_out,coalesce(r.claimed_end_date,r.log_date));
    select count(*) into n from public.attendance_logs where intern_id=r.intern_id and log_date=r.log_date;
    if n>1 then raise exception 'Duplicate legacy attendance requires review' using errcode='40001'; end if;
    select * into a from public.attendance_logs where intern_id=r.intern_id and log_date=r.log_date for update;
    if found then
      update public.attendance_logs set time_in=r.claimed_time_in,time_out=r.claimed_time_out,
        clocked_in_at=start_ts,clocked_out_at=end_ts,hours=extract(epoch from end_ts-start_ts)/3600,
        verified=true,verified_by=auth.uid() where id=a.id;
    else
      insert into public.attendance_logs(intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,verified_by)
      values(r.intern_id,r.log_date,r.claimed_time_in,r.claimed_time_out,start_ts,end_ts,
        extract(epoch from end_ts-start_ts)/3600,true,auth.uid());
    end if;
  end if;
  update public.attendance_exceptions set status=p_decision,review_note=nullif(btrim(p_note),''),
    reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=r.id and status='Pending' returning * into r;
  if not found then raise exception 'Correction changed; refresh' using errcode='40001'; end if;
  return r;
end $function$
;
-- Latest source: M02_trusted_audit.sql; public.review_exceptions(uuid[],text,text)
CREATE OR REPLACE FUNCTION public.review_exceptions(p_ids uuid[], p_decision text, p_note text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, ok boolean, error text, code text, data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare item uuid; r public.attendance_exceptions;
begin
  if public.current_role() is null or public.current_role() not in ('admin','instructor') then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  if p_ids is null or cardinality(p_ids)<1 or cardinality(p_ids)>100 or array_position(p_ids,null) is not null then
    raise exception 'Select between 1 and 100 correction UUIDs';
  end if;
  -- Intern-first ordering also prevents inverse lock order for different
  -- requests belonging to the same two interns.
  for item in select x.item_id from (select distinct unnest(p_ids) as item_id) x
    left join public.attendance_exceptions e on e.id=x.item_id and public.can_review(e.intern_id)
    order by e.intern_id,x.item_id loop
    id:=item; data:=null; error:=null; code:=null;
    begin
      r:=public.review_exception(item,p_decision,p_note);
      ok:=true; data:=to_jsonb(r);
    exception when others then
      ok:=false; error:=sqlerrm; code:=sqlstate;
    end;
    return next;
  end loop;
end $function$
;
-- Latest source: M10_flexible_submissions.sql; public.review_submission(uuid,bigint,bigint,text,text)
CREATE OR REPLACE FUNCTION public.review_submission(p_id uuid, p_version bigint, p_revision bigint, p_status text, p_note text)
 RETURNS public.submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.submissions; v public.submission_versions; ts timestamptz;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into s from public.submissions where id=p_id for update;
 if not found or not public.can_review(s.intern_id) then raise exception 'Assigned staff required' using errcode='42501'; end if;
 if s.current_version is distinct from p_version or s.review_revision is distinct from p_revision
 then raise exception 'File set or review changed; refresh' using errcode='40001'; end if;
 if s.status<>'Pending' or p_status is null or p_status not in ('Approved','Needs Revision') then raise exception 'Pending current version required'; end if;
 if length(p_note)>500 or (p_status='Needs Revision' and nullif(btrim(p_note),'') is null)
 then raise exception 'Revision explanation required; maximum 500 characters'; end if;
 select * into v from public.submission_versions where submission_id=s.id and version_no=s.current_version and committed_at is not null;
 if not found or (select count(*) from public.submission_files where version_id=v.id)<>jsonb_array_length(v.manifest)
  or exists(select 1 from public.submission_files f where version_id=v.id and not exists(select 1 from storage.objects o
    where o.bucket_id='documents' and o.name=f.file_path and o.metadata->>'mimetype'=f.mime_type and (o.metadata->>'size')::numeric=f.byte_size))
 then raise exception 'Complete committed file evidence required'; end if;
 ts:=clock_timestamp();
 update public.submissions set status=p_status,note=nullif(btrim(p_note),''),reviewed_by=auth.uid(),reviewed_at=ts,
  review_revision=review_revision+1,updated_at=ts where id=s.id returning * into s;
 update public.submission_versions set status=s.status,note=s.note,reviewed_by=s.reviewed_by,reviewed_at=ts,review_revision=s.review_revision where id=v.id;
 insert into public.submission_reviews(version_id,intern_id,review_revision,status,note,reviewed_by,reviewed_at)
  values(v.id,s.intern_id,s.review_revision,s.status,s.note,auth.uid(),ts);
 return s;
end $function$
;
-- Latest source: M06_rubric_hours.sql; public.rubric_score(jsonb)
CREATE OR REPLACE FUNCTION public.rubric_score(p_criteria jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare k text; n numeric; total numeric:=0;
begin
 if jsonb_typeof(p_criteria) is distinct from 'object' then return null; end if;
 if (select count(*) from jsonb_object_keys(p_criteria))<>4 then return null; end if;
 foreach k in array array['punctuality','performance','conduct','communication'] loop
   if jsonb_typeof(p_criteria->k) is distinct from 'number' then return null; end if;
   n:=(p_criteria->>k)::numeric;
   if n<1 or n>5 or n<>trunc(n) then return null; end if;
   total:=total+n*case k when 'punctuality' then 25 when 'performance' then 35 else 20 end/5;
 end loop;
 return round(total)::integer;
end $function$
;
-- Latest source: M13_coordinator_operations.sql; public.send_announcement(uuid,text,text,uuid)
CREATE OR REPLACE FUNCTION public.send_announcement(p_request_id uuid, p_title text, p_body text, p_target_intern_id uuid DEFAULT NULL::uuid)
 RETURNS public.announcements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
END $function$
;
-- Latest source: M08_document_versions.sql; public.stage_document_upload(uuid,text,text,bigint,bigint)
CREATE OR REPLACE FUNCTION public.stage_document_upload(p_id uuid, p_name text, p_mime text, p_size bigint, p_expected_version bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare d public.documents; v public.document_versions; receipt uuid:=gen_random_uuid(); ext text;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into d from public.documents where id=p_id and intern_id=auth.uid() for update;
 if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned requirement required' using errcode='42501'; end if;
 if p_expected_version is distinct from d.upload_version then raise exception 'Document changed; refresh' using errcode='40001'; end if;
 ext:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else null end;
 if ext is null or p_size is null or p_size<=0 or p_size>10485760 or nullif(btrim(p_name),'') is null or length(p_name)>255 or p_name~'[[:cntrl:]]'
 then raise exception 'PDF/JPEG/PNG, 1 byte-10 MiB and valid filename required'; end if;
 insert into public.document_versions(id,document_id,intern_id,expected_version,file_path,file_name,mime_type,byte_size,expires_at)
 values(receipt,d.id,auth.uid(),d.upload_version,auth.uid()::text||'/'||receipt::text||'.'||ext,p_name,p_mime,p_size,clock_timestamp()+interval '15 minutes') returning * into v;
 return jsonb_build_object('id',d.id,'upload',to_jsonb(v));
end $function$
;
-- Latest source: M10_flexible_submissions.sql; public.stage_submission(uuid,uuid,text,text,jsonb,bigint,bigint)
CREATE OR REPLACE FUNCTION public.stage_submission(p_attempt_id uuid, p_submission_id uuid, p_title text, p_description text, p_files jsonb, p_expected_version bigint, p_expected_revision bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.submissions; v public.submission_versions; f jsonb; n integer:=0; total bigint:=0; ext text; fid uuid; result jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
 if p_attempt_id is null or p_title is null or length(btrim(p_title)) not between 1 and 200 or p_description is null or length(p_description)>2000
 then raise exception 'Title 1-200 and description <=2000 characters required'; end if;
 if jsonb_typeof(p_files) is distinct from 'array' then raise exception 'File manifest required'; end if;
 if jsonb_array_length(p_files) not between 1 and 10 then raise exception 'Select 1-10 files'; end if;
 for f in select value from jsonb_array_elements(p_files) loop
  if jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'name') is distinct from 'string'
   or jsonb_typeof(f->'mime') is distinct from 'string' or jsonb_typeof(f->'size') is distinct from 'number'
   or nullif(btrim(f->>'name'),'') is null or length(f->>'name')>255 or (f->>'name')~'[[:cntrl:]]'
   or (f->>'mime') not in ('application/pdf','image/jpeg','image/png')
   or (f->>'size')::numeric not between 1 and 10485760 or (f->>'size')::numeric<>trunc((f->>'size')::numeric)
  then raise exception 'Each file needs a valid filename, PDF/JPEG/PNG MIME and 1 byte-10 MiB size'; end if;
  total:=total+(f->>'size')::bigint;
 end loop;
 if total>52428800 then raise exception 'File set exceeds 50 MiB'; end if;
 select * into v from public.submission_versions where id=p_attempt_id;
 if found then
  if v.intern_id<>auth.uid() then raise exception 'Reservation not owned' using errcode='42501'; end if;
  if (p_submission_id is not null and p_submission_id<>v.submission_id) or v.title<>btrim(p_title) or v.description<>p_description
    or v.manifest<>p_files or v.expected_version is distinct from p_expected_version or v.expected_revision is distinct from p_expected_revision
  then raise exception 'Attempt ID reused with different content'; end if;
 else
  if p_submission_id is null then
   if p_expected_version is distinct from 0 or p_expected_revision is distinct from 0 then raise exception 'New submission expects version/revision zero'; end if;
   insert into public.submissions(intern_id,title,description) values(auth.uid(),btrim(p_title),p_description) returning * into s;
  else
   select * into s from public.submissions where id=p_submission_id and intern_id=auth.uid() for update;
   if not found then raise exception 'Owned submission required' using errcode='42501'; end if;
   if s.current_version is distinct from p_expected_version or s.review_revision is distinct from p_expected_revision
   then raise exception 'Submission changed; refresh' using errcode='40001'; end if;
  end if;
  insert into public.submission_versions(id,submission_id,intern_id,expected_version,expected_revision,title,description,manifest,expires_at)
   values(p_attempt_id,s.id,auth.uid(),s.current_version,s.review_revision,btrim(p_title),p_description,p_files,clock_timestamp()+interval '15 minutes') returning * into v;
  for f in select value from jsonb_array_elements(p_files) loop
   n:=n+1; fid:=gen_random_uuid(); ext:=case f->>'mime' when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
   insert into public.submission_files(id,version_id,intern_id,ordinal,file_path,file_name,mime_type,byte_size)
    values(fid,v.id,auth.uid(),n,auth.uid()::text||'/'||s.id::text||'/'||v.id::text||'/'||fid::text||'.'||ext,f->>'name',f->>'mime',(f->>'size')::bigint);
  end loop;
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by ordinal),'[]'::jsonb) into result from public.submission_files x where version_id=v.id;
 return jsonb_build_object('id',v.id,'version',to_jsonb(v),'files',result);
end $function$
;
-- Latest source: M10_flexible_submissions.sql; public.submission_file_access(uuid,uuid)
CREATE OR REPLACE FUNCTION public.submission_file_access(p_id uuid, p_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare f public.submission_files; v public.submission_versions;
begin
 select * into f from public.submission_files where id=p_id and version_id=p_version_id;
 if not found or not public.can_read_intern(f.intern_id) then raise exception 'File access not permitted' using errcode='42501'; end if;
 select * into v from public.submission_versions where id=f.version_id and committed_at is not null;
 if not found or not exists(select 1 from storage.objects where bucket_id='documents' and name=f.file_path)
 then raise exception 'Committed file missing; refresh or request resubmission'; end if;
 return jsonb_build_object('id',f.id,'file_path',f.file_path,'file_name',f.file_name);
end $function$
;
-- Latest source: M10_flexible_submissions.sql; public.submission_recovery_list()
CREATE OR REPLACE FUNCTION public.submission_recovery_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare result jsonb;
begin
 if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'created_at',v.created_at) order by v.created_at),'[]'::jsonb)
 into result from public.submission_versions v where v.intern_id=auth.uid() and v.committed_at is null
  and (v.abandoned_at is null or exists(select 1 from public.submission_files f join storage.objects o on o.bucket_id='documents' and o.name=f.file_path where f.version_id=v.id));
 if jsonb_array_length(result)>50000 then raise exception 'Recovery list too large; operator assistance required'; end if;
 return jsonb_build_object('id',auth.uid(),'versions',result);
end $function$
;
-- Latest source: M01_authority.sql; public.submit_correction(date,time without time zone,time without time zone,date,text)
CREATE OR REPLACE FUNCTION public.submit_correction(p_date date, p_in time without time zone, p_out time without time zone, p_end date, p_reason text)
 RETURNS public.attendance_exceptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_exceptions;
begin
  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
  if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Reason required, at most 500 characters'; end if;
  perform * from public.correction_instants(p_date,p_in,p_out,p_end);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,101));
  if exists(select 1 from public.attendance_exceptions where intern_id=auth.uid() and log_date=p_date and status='Pending') then
    raise exception 'A Pending correction already exists for this date' using errcode='40001';
  end if;
  insert into public.attendance_exceptions(intern_id,log_date,claimed_time_in,claimed_time_out,claimed_end_date,reason,status,reviewed_by,created_at)
  values(auth.uid(),p_date,p_in,p_out,p_end,btrim(p_reason),'Pending',null,clock_timestamp()) returning * into r;
  return r;
end $function$
;
-- Latest source: M01_authority.sql; public.submit_document_upload(uuid,text,text)
CREATE OR REPLACE FUNCTION public.submit_document_upload(p_id uuid, p_path text, p_name text)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.documents;
begin
  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
  select * into r from public.documents where id=p_id and intern_id=auth.uid() for update;
  if not found then raise exception 'Requirement not found' using errcode='40001'; end if;
  if p_path is null or split_part(p_path,'/',1)<>auth.uid()::text
     or cardinality(string_to_array(p_path,'/'))<>2 or split_part(p_path,'/',2) in ('','.','..')
     or nullif(btrim(p_name),'') is null then raise exception 'Own folder and filename required'; end if;
  if not exists(select 1 from storage.objects where bucket_id='documents' and name=p_path) then
    raise exception 'Uploaded object not found';
  end if;
  update public.documents set file_path=p_path,file_name=p_name,status='Pending',note=null,
    reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp() where id=r.id returning * into r;
  return r;
end $function$
;
-- Latest source: M06_rubric_hours.sql; public.submit_evaluation(uuid,jsonb,text,uuid)
CREATE OR REPLACE FUNCTION public.submit_evaluation(p_intern_id uuid, p_criteria jsonb, p_feedback text, p_submission_id uuid)
 RETURNS public.evaluations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.evaluations; score integer;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.can_review(p_intern_id) or not exists(select 1 from public.profiles where id=p_intern_id and role='intern')
 then raise exception 'Evaluation not permitted' using errcode='42501'; end if;
 score:=public.rubric_score(p_criteria);
 if score is null or p_submission_id is null or length(p_feedback)>500 then
   raise exception 'Four integer criteria 1-5, submission UUID and feedback <=500 required'; end if;
 select * into r from public.evaluations where evaluator_id=auth.uid() and submission_id=p_submission_id;
 if found then
   if r.intern_id is distinct from p_intern_id or r.competencies is distinct from p_criteria
     or r.feedback is distinct from nullif(btrim(p_feedback),'') then raise exception 'Submission key reused with different content' using errcode='40001'; end if;
   return r;
 end if;
 insert into public.evaluations(intern_id,evaluator_id,competencies,feedback,overall_score,submission_id)
 values(p_intern_id,auth.uid(),p_criteria,nullif(btrim(p_feedback),''),score,p_submission_id) returning * into r;
 return r;
end $function$
;
-- Latest source: M08_document_versions.sql; public.unfinished_document_uploads()
CREATE OR REPLACE FUNCTION public.unfinished_document_uploads()
 RETURNS SETOF public.document_versions
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select v.* from public.document_versions v where public.owns_intern(auth.uid()) and v.intern_id=auth.uid()
 and committed_at is null and (abandoned_at is not null or expires_at<=clock_timestamp()) order by created_at
$function$
;
-- Latest source: M06_rubric_hours.sql; public.valid_required_hours(numeric)
CREATE OR REPLACE FUNCTION public.valid_required_hours(p_value numeric)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select coalesce(p_value::text not in ('NaN','Infinity','-Infinity') and p_value>0
   and p_value<=10000 and p_value=round(p_value,2),false)
$function$
;
-- Latest source: M13_coordinator_operations.sql; public.verify_attendance(uuid,timestamp with time zone,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.verify_attendance(p_id uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone)
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
END $function$
;
-- Latest source: M02_trusted_audit.sql; public.write_trusted_audit()
CREATE OR REPLACE FUNCTION public.write_trusted_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare before_row jsonb; after_row jsonb; row_data jsonb; changed jsonb;
        actor uuid:=auth.uid(); actor_label text;
begin
  before_row:=case when tg_op<>'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  after_row:=case when tg_op<>'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  if tg_op='UPDATE' and before_row=after_row then return new; end if;
  row_data:=case when tg_op='DELETE' then before_row else after_row end;
  select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into changed
  from (select jsonb_object_keys(before_row || after_row) as k) fields
  where before_row->k is distinct from after_row->k;
  select full_name into actor_label from public.profiles where id=actor;
  -- Minimal metadata: no credentials, file bytes, or whole profile snapshots.
  -- No exception handler: an audit failure aborts the business mutation.
  insert into public.audit_logs(actor_id,actor_name,action,detail,created_at,source,event_data)
  values(actor,coalesce(actor_label,'System / trusted SQL'),tg_table_name || ' ' || lower(tg_op),
    'Record ' || coalesce(row_data->>'id','unknown'),clock_timestamp(),'database-trigger-v2',
    jsonb_build_object('table',tg_table_name,'operation',tg_op,'record_id',row_data->>'id',
      'intern_id',row_data->>'intern_id','changed_fields',changed,
      'previous_status',before_row->>'status','status',after_row->>'status',
      'previous_role',before_row->>'role','role',after_row->>'role',
      'previous_instructor_id',before_row->>'instructor_id','instructor_id',after_row->>'instructor_id',
      'previous_company_id',before_row->>'company_id','company_id',after_row->>'company_id',
      'previous_section_id',before_row->>'section_id','section_id',after_row->>'section_id',
      'previous_required_hours',before_row->'required_hours','required_hours',after_row->'required_hours',
      'entity_label',case when tg_table_name in ('companies','course_sections','academic_years')
        then coalesce(row_data->>'name',row_data->>'label') else null end,
      'previous_entity_label',case when tg_table_name in ('companies','course_sections','academic_years')
        then coalesce(before_row->>'name',before_row->>'label') else null end,
      'reviewed_by',after_row->>'reviewed_by','verified_by',after_row->>'verified_by',
      'context',case when actor is null then 'system-or-sql' else 'authenticated' end));
  if tg_op='DELETE' then return old; end if;
  return new;
end $function$
;
-- Fresh data: M05/M09 checks are VALIDATED and score NOT NULL from creation.
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."interns" ADD CONSTRAINT "interns_pkey" PRIMARY KEY (id);
ALTER TABLE public."evaluations" ADD CONSTRAINT "evaluations_pkey" PRIMARY KEY (id);
ALTER TABLE public."documents" ADD CONSTRAINT "documents_pkey" PRIMARY KEY (id);
ALTER TABLE public."course_sections" ADD CONSTRAINT "course_sections_pkey" PRIMARY KEY (id);
ALTER TABLE public."companies" ADD CONSTRAINT "companies_pkey" PRIMARY KEY (id);
ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."attendance_logs" ADD CONSTRAINT "attendance_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."announcements" ADD CONSTRAINT "announcements_pkey" PRIMARY KEY (id);
ALTER TABLE public."alerts" ADD CONSTRAINT "alerts_pkey" PRIMARY KEY (id);
ALTER TABLE public."academic_years" ADD CONSTRAINT "academic_years_pkey" PRIMARY KEY (id);
ALTER TABLE public."document_review_events" ADD CONSTRAINT "document_review_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_pkey" PRIMARY KEY (id);
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_pkey" PRIMARY KEY (id);
ALTER TABLE public."submission_reviews" ADD CONSTRAINT "submission_reviews_pkey" PRIMARY KEY (id);
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_pkey" PRIMARY KEY (id);
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."course_sections" ADD CONSTRAINT "course_sections_name_key" UNIQUE (name);
ALTER TABLE public."companies" ADD CONSTRAINT "companies_name_key" UNIQUE (name);
ALTER TABLE public."academic_years" ADD CONSTRAINT "academic_years_label_key" UNIQUE (label);
ALTER TABLE public."attendance_logs" ADD CONSTRAINT "m03_daily_identity" UNIQUE (intern_id, log_date);
ALTER TABLE public."document_review_events" ADD CONSTRAINT "document_review_events_version_id_review_revision_key" UNIQUE (version_id, review_revision);
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_document_id_version_no_key" UNIQUE (document_id, version_no);
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_file_path_key" UNIQUE (file_path);
ALTER TABLE public."documents" ADD CONSTRAINT "m08_requirement_identity" UNIQUE (intern_id, doc_type);
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_file_path_key" UNIQUE (file_path);
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_version_id_ordinal_key" UNIQUE (version_id, ordinal);
ALTER TABLE public."submission_reviews" ADD CONSTRAINT "submission_reviews_version_id_review_revision_key" UNIQUE (version_id, review_revision);
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_submission_id_version_no_key" UNIQUE (submission_id, version_no);
ALTER TABLE public."evaluations" ADD CONSTRAINT "evaluations_overall_score_check" CHECK (((overall_score >= (0)::numeric) AND (overall_score <= (100)::numeric)));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_status_check" CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Pending'::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'instructor'::text, 'intern'::text])));
ALTER TABLE public."documents" ADD CONSTRAINT "documents_status_check" CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])));
ALTER TABLE public."attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_status_check" CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])));
ALTER TABLE public."alerts" ADD CONSTRAINT "alerts_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
ALTER TABLE public."attendance_exceptions" ADD CONSTRAINT "m03_correction_interval" CHECK (((claimed_time_in IS NOT NULL) AND (claimed_time_out IS NOT NULL) AND (claimed_end_date IS NOT NULL) AND ((claimed_end_date = log_date) OR (claimed_end_date = (log_date + 1))) AND ((claimed_end_date + claimed_time_out) > (log_date + claimed_time_in)) AND (((claimed_end_date + claimed_time_out) - (log_date + claimed_time_in)) <= '16:00:00'::interval) AND (NULLIF(btrim(reason), ''::text) IS NOT NULL) AND (length(reason) <= 500)));
ALTER TABLE public."attendance_exceptions" ADD CONSTRAINT "m03_correction_review" CHECK ((((status = 'Pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (review_note IS NULL)) OR ((status = ANY (ARRAY['Approved'::text, 'Rejected'::text])) AND (reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL) AND ((review_note IS NULL) OR (length(review_note) <= 500)) AND ((status <> 'Rejected'::text) OR (NULLIF(btrim(review_note), ''::text) IS NOT NULL)))));
ALTER TABLE public."attendance_logs" ADD CONSTRAINT "m03_accomplishment_length" CHECK (((accomplishment IS NULL) OR (length(accomplishment) <= 500)));
ALTER TABLE public."attendance_logs" ADD CONSTRAINT "m03_attendance_interval" CHECK (((clocked_in_at IS NOT NULL) AND (time_in IS NOT NULL) AND (log_date = ((clocked_in_at AT TIME ZONE 'Asia/Manila'::text))::date) AND (time_in = ((clocked_in_at AT TIME ZONE 'Asia/Manila'::text))::time without time zone) AND (((time_out IS NULL) AND (clocked_out_at IS NULL) AND (hours IS NULL) AND (NOT verified) AND (verified_by IS NULL)) OR ((time_out IS NOT NULL) AND (clocked_out_at IS NOT NULL) AND (hours IS NOT NULL) AND (time_out = ((clocked_out_at AT TIME ZONE 'Asia/Manila'::text))::time without time zone) AND (clocked_out_at > clocked_in_at) AND ((clocked_out_at - clocked_in_at) <= '16:00:00'::interval) AND (hours = (EXTRACT(epoch FROM (clocked_out_at - clocked_in_at)) / (3600)::numeric)) AND ((verified AND (verified_by IS NOT NULL)) OR ((NOT verified) AND (verified_by IS NULL)))))));
ALTER TABLE public."document_review_events" ADD CONSTRAINT "document_review_events_status_check" CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])));
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_byte_size_check" CHECK (((byte_size > 0) AND (byte_size <= 10485760)));
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_check" CHECK ((NOT ((committed_at IS NOT NULL) AND (abandoned_at IS NOT NULL))));
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_check1" CHECK ((((committed_at IS NULL) AND (version_no IS NULL)) OR ((committed_at IS NOT NULL) AND (version_no > 0))));
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_check2" CHECK ((split_part(file_path, '/'::text, 1) = (intern_id)::text));
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_expected_version_check" CHECK ((expected_version >= 0));
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_mime_type_check" CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text])));
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_status_check" CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])));
ALTER TABLE public."evaluations" ADD CONSTRAINT "m06_evaluation_rubric" CHECK (((overall_score IS NOT NULL) AND (evaluator_id IS NOT NULL) AND (public.rubric_score(competencies) IS NOT NULL) AND (overall_score = (public.rubric_score(competencies))::numeric)));
ALTER TABLE public."interns" ADD CONSTRAINT "m06_required_hours" CHECK (public.valid_required_hours(required_hours));
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_byte_size_check" CHECK (((byte_size >= 1) AND (byte_size <= 10485760)));
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_check" CHECK ((split_part(file_path, '/'::text, 1) = (intern_id)::text));
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_file_name_check" CHECK (((length(file_name) >= 1) AND (length(file_name) <= 255)));
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_mime_type_check" CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text])));
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_ordinal_check" CHECK (((ordinal >= 1) AND (ordinal <= 10)));
ALTER TABLE public."submission_reviews" ADD CONSTRAINT "submission_reviews_check" CHECK (((status <> 'Needs Revision'::text) OR (NULLIF(btrim(note), ''::text) IS NOT NULL)));
ALTER TABLE public."submission_reviews" ADD CONSTRAINT "submission_reviews_note_check" CHECK ((length(note) <= 500));
ALTER TABLE public."submission_reviews" ADD CONSTRAINT "submission_reviews_status_check" CHECK ((status = ANY (ARRAY['Approved'::text, 'Needs Revision'::text])));
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_check" CHECK ((NOT ((committed_at IS NOT NULL) AND (abandoned_at IS NOT NULL))));
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_check1" CHECK ((((committed_at IS NULL) AND (version_no IS NULL)) OR ((committed_at IS NOT NULL) AND (version_no > 0))));
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_description_check" CHECK ((length(description) <= 2000));
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_expected_revision_check" CHECK ((expected_revision >= 0));
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_expected_version_check" CHECK ((expected_version >= 0));
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_note_check" CHECK ((length(note) <= 500));
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_review_revision_check" CHECK ((review_revision >= 0));
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_status_check" CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])));
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_title_check" CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)));
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_current_version_check" CHECK ((current_version >= 0));
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_description_check" CHECK ((length(description) <= 2000));
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_note_check" CHECK ((length(note) <= 500));
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_review_revision_check" CHECK ((review_revision >= 0));
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_status_check" CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])));
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_title_check" CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."interns" ADD CONSTRAINT "interns_section_id_fkey" FOREIGN KEY (section_id) REFERENCES public.course_sections(id) ON DELETE SET NULL;
ALTER TABLE public."interns" ADD CONSTRAINT "interns_instructor_id_fkey" FOREIGN KEY (instructor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public."interns" ADD CONSTRAINT "interns_id_fkey" FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public."interns" ADD CONSTRAINT "interns_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public."evaluations" ADD CONSTRAINT "evaluations_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public."documents" ADD CONSTRAINT "documents_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public."attendance_logs" ADD CONSTRAINT "attendance_logs_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public."attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public."alerts" ADD CONSTRAINT "alerts_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public."evaluations" ADD CONSTRAINT "evaluations_evaluator_id_fkey" FOREIGN KEY (evaluator_id) REFERENCES public.profiles(id);
ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public.profiles(id);
ALTER TABLE public."attendance_logs" ADD CONSTRAINT "attendance_logs_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES public.profiles(id);
ALTER TABLE public."attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
ALTER TABLE public."announcements" ADD CONSTRAINT "announcements_target_intern_id_fkey" FOREIGN KEY (target_intern_id) REFERENCES public.profiles(id);
ALTER TABLE public."announcements" ADD CONSTRAINT "announcements_instructor_id_fkey" FOREIGN KEY (instructor_id) REFERENCES public.profiles(id);
ALTER TABLE public."document_review_events" ADD CONSTRAINT "document_review_events_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.documents(id);
ALTER TABLE public."document_review_events" ADD CONSTRAINT "document_review_events_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id);
ALTER TABLE public."document_review_events" ADD CONSTRAINT "document_review_events_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
ALTER TABLE public."document_review_events" ADD CONSTRAINT "document_review_events_version_id_fkey" FOREIGN KEY (version_id) REFERENCES public.document_versions(id);
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.documents(id);
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id);
ALTER TABLE public."document_versions" ADD CONSTRAINT "document_versions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
ALTER TABLE public."documents" ADD CONSTRAINT "documents_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id);
ALTER TABLE public."submission_files" ADD CONSTRAINT "submission_files_version_id_fkey" FOREIGN KEY (version_id) REFERENCES public.submission_versions(id);
ALTER TABLE public."submission_reviews" ADD CONSTRAINT "submission_reviews_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id);
ALTER TABLE public."submission_reviews" ADD CONSTRAINT "submission_reviews_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
ALTER TABLE public."submission_reviews" ADD CONSTRAINT "submission_reviews_version_id_fkey" FOREIGN KEY (version_id) REFERENCES public.submission_versions(id);
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id);
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
ALTER TABLE public."submission_versions" ADD CONSTRAINT "submission_versions_submission_id_fkey" FOREIGN KEY (submission_id) REFERENCES public.submissions(id);
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_intern_id_fkey" FOREIGN KEY (intern_id) REFERENCES public.profiles(id);
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
CREATE UNIQUE INDEX m03_one_open_session ON public.attendance_logs USING btree (intern_id) WHERE (time_out IS NULL);
CREATE UNIQUE INDEX m03_one_pending_correction ON public.attendance_exceptions USING btree (intern_id, log_date) WHERE (status = 'Pending'::text);
CREATE UNIQUE INDEX m06_evaluation_retry ON public.evaluations USING btree (evaluator_id, submission_id) WHERE (submission_id IS NOT NULL);
CREATE INDEX m10_files_version ON public.submission_files USING btree (version_id, ordinal);
CREATE INDEX m10_reviews_version ON public.submission_reviews USING btree (version_id, review_revision);
CREATE INDEX m10_submissions_owner ON public.submissions USING btree (intern_id, id);
CREATE INDEX m10_versions_submission ON public.submission_versions USING btree (submission_id, id);
CREATE INDEX m11_audit_actor ON public.audit_logs USING btree (actor_id, created_at DESC, id DESC);
CREATE INDEX m11_audit_order ON public.audit_logs USING btree (created_at DESC, id DESC);
CREATE UNIQUE INDEX m12_current_year ON public.academic_years USING btree (is_current) WHERE is_current;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
ALTER TABLE public."companies" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."companies" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."course_sections" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."course_sections" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."academic_years" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."academic_years" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."profiles" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."interns" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."interns" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."attendance_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."attendance_logs" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."attendance_exceptions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."attendance_exceptions" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."evaluations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."evaluations" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."documents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."documents" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."announcements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."announcements" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."alerts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."alerts" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."audit_logs" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."document_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."document_versions" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."document_review_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."document_review_events" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."submissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."submissions" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."submission_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."submission_versions" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."submission_files" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."submission_files" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."submission_reviews" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."submission_reviews" FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public."academic_years" TO authenticated;
GRANT DELETE ON public."alerts" TO authenticated;
GRANT INSERT ON public."alerts" TO authenticated;
GRANT SELECT ON public."alerts" TO authenticated;
GRANT UPDATE ON public."alerts" TO authenticated;
GRANT SELECT ON public."announcements" TO authenticated;
GRANT SELECT ON public."attendance_exceptions" TO authenticated;
GRANT SELECT ON public."attendance_logs" TO authenticated;
GRANT SELECT ON public."audit_logs" TO authenticated;
GRANT SELECT ON public."companies" TO authenticated;
GRANT SELECT ON public."course_sections" TO authenticated;
GRANT SELECT ON public."document_review_events" TO authenticated;
GRANT SELECT ON public."document_versions" TO authenticated;
GRANT SELECT ON public."documents" TO authenticated;
GRANT SELECT ON public."evaluations" TO authenticated;
GRANT SELECT ON public."interns" TO authenticated;
GRANT SELECT ON public."profiles" TO authenticated;
GRANT SELECT ON public."submission_files" TO authenticated;
GRANT SELECT ON public."submission_reviews" TO authenticated;
GRANT SELECT ON public."submission_versions" TO authenticated;
GRANT SELECT ON public."submissions" TO authenticated;
GRANT INSERT("label") ON public."academic_years" TO authenticated;
GRANT UPDATE("label") ON public."academic_years" TO authenticated;
GRANT UPDATE("dismissed") ON public."alerts" TO authenticated;
GRANT INSERT("name") ON public."companies" TO authenticated;
GRANT UPDATE("name") ON public."companies" TO authenticated;
GRANT INSERT("name") ON public."course_sections" TO authenticated;
GRANT UPDATE("name") ON public."course_sections" TO authenticated;
GRANT INSERT("doc_type") ON public."documents" TO authenticated;
GRANT INSERT("intern_id") ON public."documents" TO authenticated;
GRANT INSERT("name") ON public."documents" TO authenticated;
GRANT UPDATE("full_name") ON public."profiles" TO authenticated;
REVOKE ALL ON FUNCTION public.admin_add_requirement(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_requirement(uuid,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_archive_master(text,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_archive_master(text,uuid,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_master_impact(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_master_impact(text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_assignment(uuid,uuid,uuid,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_assignment(uuid,uuid,uuid,uuid,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_current_year(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_current_year(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_update_account(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_account(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.assigned_intern(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assigned_intern(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.attach_standard_docs(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attach_standard_docs(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.audit_history(text,text,text,date,date,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.audit_history(text,text,text,date,date,integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.bind_announcement() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.can_delete_staged_document(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_staged_document(text) TO authenticated;
REVOKE ALL ON FUNCTION public.can_insert_reserved_document(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_insert_reserved_document(text) TO authenticated;
REVOKE ALL ON FUNCTION public.can_read_document_object(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_document_object(text) TO authenticated;
REVOKE ALL ON FUNCTION public.can_read_intern(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_intern(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.can_review(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_review(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_document_upload(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_document_upload(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_submission(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_submission(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.check_account_relationships() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.clock_in() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clock_in() TO authenticated;
REVOKE ALL ON FUNCTION public.clock_out(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clock_out(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.correction_instants(date,time without time zone,time without time zone,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public."current_role"() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public."current_role"() TO authenticated;
REVOKE ALL ON FUNCTION public.document_access(uuid,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.document_access(uuid,bigint,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.finalize_document_upload(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_document_upload(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finalize_submission(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_submission(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_alert_update() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_archived_assignment() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_attendance_future() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_domain_identity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_last_active_admin() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_profile_update() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.is_active() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_active() TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.legacy_document_access(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_document_access(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.my_profile() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;
REVOKE ALL ON FUNCTION public.owns_intern(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.owns_intern(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.related_profile_names(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.related_profile_names(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.review_document(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_document_version(uuid,text,text,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_document_version(uuid,text,text,bigint,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.review_exception(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_exception(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_exceptions(uuid[],text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_exceptions(uuid[],text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_submission(uuid,bigint,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_submission(uuid,bigint,bigint,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rubric_score(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rubric_score(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.send_announcement(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.send_announcement(uuid,text,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.stage_document_upload(uuid,text,text,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_document_upload(uuid,text,text,bigint,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.stage_submission(uuid,uuid,text,text,jsonb,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_submission(uuid,uuid,text,text,jsonb,bigint,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.submission_file_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submission_file_access(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.submission_recovery_list() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submission_recovery_list() TO authenticated;
REVOKE ALL ON FUNCTION public.submit_correction(date,time without time zone,time without time zone,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_correction(date,time without time zone,time without time zone,date,text) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_document_upload(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_evaluation(uuid,jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(uuid,jsonb,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.unfinished_document_uploads() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unfinished_document_uploads() TO authenticated;
REVOKE ALL ON FUNCTION public.valid_required_hours(numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.valid_required_hours(numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.verify_attendance(uuid,timestamp with time zone,timestamp with time zone) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_attendance(uuid,timestamp with time zone,timestamp with time zone) TO authenticated;
REVOKE ALL ON FUNCTION public.write_trusted_audit() FROM PUBLIC,anon,authenticated;
CREATE POLICY "m01_years_read" ON "public"."academic_years" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.is_active());
CREATE POLICY "m01_years_write" ON "public"."academic_years" AS PERMISSIVE FOR ALL TO "authenticated"
 USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "m01_alerts_admin" ON "public"."alerts" AS PERMISSIVE FOR ALL TO "authenticated"
 USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "m01_alerts_dismiss" ON "public"."alerts" AS PERMISSIVE FOR UPDATE TO "authenticated"
 USING (public.assigned_intern(intern_id)) WITH CHECK (public.assigned_intern(intern_id));
CREATE POLICY "m01_alerts_read" ON "public"."alerts" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.can_review(intern_id));
CREATE POLICY "m01_announcements_insert" ON "public"."announcements" AS PERMISSIVE FOR INSERT TO "authenticated"
 WITH CHECK (((public."current_role"() = ANY (ARRAY['admin'::text, 'instructor'::text])) AND (instructor_id = auth.uid())));
CREATE POLICY "m01_announcements_read" ON "public"."announcements" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING ((public.is_active() AND (public.is_admin() OR (instructor_id = auth.uid()) OR ((public."current_role"() = 'intern'::text) AND (auth.uid() = ANY (recipient_ids))))));
CREATE POLICY "m01_exceptions_read" ON "public"."attendance_exceptions" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.can_read_intern(intern_id));
CREATE POLICY "m01_attendance_read" ON "public"."attendance_logs" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.can_read_intern(intern_id));
CREATE POLICY "m01_audit_read" ON "public"."audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.is_admin());
CREATE POLICY "m01_companies_read" ON "public"."companies" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.is_active());
CREATE POLICY "m01_companies_write" ON "public"."companies" AS PERMISSIVE FOR ALL TO "authenticated"
 USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "m01_sections_read" ON "public"."course_sections" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.is_active());
CREATE POLICY "m01_sections_write" ON "public"."course_sections" AS PERMISSIVE FOR ALL TO "authenticated"
 USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "m08_reviews_read" ON "public"."document_review_events" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.can_read_intern(intern_id));
CREATE POLICY "m08_versions_read" ON "public"."document_versions" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING ((public.owns_intern(intern_id) OR ((committed_at IS NOT NULL) AND public.can_review(intern_id))));
CREATE POLICY "m01_documents_insert" ON "public"."documents" AS PERMISSIVE FOR INSERT TO "authenticated"
 WITH CHECK ((public.is_admin() AND (status = 'Pending'::text) AND (file_path IS NULL) AND (file_name IS NULL) AND (note IS NULL) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL)));
CREATE POLICY "m01_documents_read" ON "public"."documents" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.can_read_intern(intern_id));
CREATE POLICY "m01_evaluations_read" ON "public"."evaluations" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.can_read_intern(intern_id));
CREATE POLICY "m01_interns_admin" ON "public"."interns" AS PERMISSIVE FOR ALL TO "authenticated"
 USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "m01_interns_read" ON "public"."interns" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.can_read_intern(id));
CREATE POLICY "m01_profiles_read" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING ((public.is_active() AND ((id = auth.uid()) OR public.is_admin() OR public.assigned_intern(id))));
CREATE POLICY "m01_profiles_update" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated"
 USING ((public.is_admin() OR (public.is_active() AND (id = auth.uid())))) WITH CHECK ((public.is_admin() OR (public.is_active() AND (id = auth.uid()))));
CREATE POLICY "m10_delete_guard" ON "public"."submission_files" AS RESTRICTIVE FOR DELETE TO "authenticated"
 USING (false);
CREATE POLICY "m10_files_read" ON "public"."submission_files" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING ((public.owns_intern(intern_id) OR (public.can_review(intern_id) AND (EXISTS ( SELECT 1
   FROM public.submission_versions v
  WHERE ((v.id = submission_files.version_id) AND (v.committed_at IS NOT NULL)))))));
CREATE POLICY "m10_files_read_guard" ON "public"."submission_files" AS RESTRICTIVE FOR SELECT TO "authenticated"
 USING ((public.owns_intern(intern_id) OR (public.can_review(intern_id) AND (EXISTS ( SELECT 1
   FROM public.submission_versions v
  WHERE ((v.id = submission_files.version_id) AND (v.committed_at IS NOT NULL)))))));
CREATE POLICY "m10_insert_guard" ON "public"."submission_files" AS RESTRICTIVE FOR INSERT TO "authenticated"
 WITH CHECK (false);
CREATE POLICY "m10_update_guard" ON "public"."submission_files" AS RESTRICTIVE FOR UPDATE TO "authenticated"
 USING (false) WITH CHECK (false);
CREATE POLICY "m10_delete_guard" ON "public"."submission_reviews" AS RESTRICTIVE FOR DELETE TO "authenticated"
 USING (false);
CREATE POLICY "m10_insert_guard" ON "public"."submission_reviews" AS RESTRICTIVE FOR INSERT TO "authenticated"
 WITH CHECK (false);
CREATE POLICY "m10_reviews_read" ON "public"."submission_reviews" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (public.can_read_intern(intern_id));
CREATE POLICY "m10_reviews_read_guard" ON "public"."submission_reviews" AS RESTRICTIVE FOR SELECT TO "authenticated"
 USING (public.can_read_intern(intern_id));
CREATE POLICY "m10_update_guard" ON "public"."submission_reviews" AS RESTRICTIVE FOR UPDATE TO "authenticated"
 USING (false) WITH CHECK (false);
CREATE POLICY "m10_delete_guard" ON "public"."submission_versions" AS RESTRICTIVE FOR DELETE TO "authenticated"
 USING (false);
CREATE POLICY "m10_insert_guard" ON "public"."submission_versions" AS RESTRICTIVE FOR INSERT TO "authenticated"
 WITH CHECK (false);
CREATE POLICY "m10_update_guard" ON "public"."submission_versions" AS RESTRICTIVE FOR UPDATE TO "authenticated"
 USING (false) WITH CHECK (false);
CREATE POLICY "m10_versions_read" ON "public"."submission_versions" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING ((public.owns_intern(intern_id) OR ((committed_at IS NOT NULL) AND public.can_review(intern_id))));
CREATE POLICY "m10_versions_read_guard" ON "public"."submission_versions" AS RESTRICTIVE FOR SELECT TO "authenticated"
 USING ((public.owns_intern(intern_id) OR ((committed_at IS NOT NULL) AND public.can_review(intern_id))));
CREATE POLICY "m10_delete_guard" ON "public"."submissions" AS RESTRICTIVE FOR DELETE TO "authenticated"
 USING (false);
CREATE POLICY "m10_insert_guard" ON "public"."submissions" AS RESTRICTIVE FOR INSERT TO "authenticated"
 WITH CHECK (false);
CREATE POLICY "m10_submissions_read" ON "public"."submissions" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING ((public.owns_intern(intern_id) OR ((current_version > 0) AND public.can_review(intern_id))));
CREATE POLICY "m10_submissions_read_guard" ON "public"."submissions" AS RESTRICTIVE FOR SELECT TO "authenticated"
 USING ((public.owns_intern(intern_id) OR ((current_version > 0) AND public.can_review(intern_id))));
CREATE POLICY "m10_update_guard" ON "public"."submissions" AS RESTRICTIVE FOR UPDATE TO "authenticated"
 USING (false) WITH CHECK (false);
-- Preserve existing application-owned Storage policies EXACTLY when compatible.
-- No Storage tables, buckets, objects, provider schemas or unrelated policies changed.
DO $storage$ DECLARE p jsonb; actual record; BEGIN
 FOR p IN SELECT * FROM jsonb_array_elements('[{"schema":"storage","tab":"objects","name":"m01_document_objects_insert","permissive":"PERMISSIVE","roles":["authenticated"],"cmd":"INSERT","qual":null,"with_check":"((bucket_id = ''documents''::text) AND public.can_insert_reserved_document(name))"},{"schema":"storage","tab":"objects","name":"m01_document_objects_read","permissive":"PERMISSIVE","roles":["authenticated"],"cmd":"SELECT","qual":"((bucket_id = ''documents''::text) AND public.can_read_document_object(name))","with_check":null},{"schema":"storage","tab":"objects","name":"m08_document_anon_guard","permissive":"RESTRICTIVE","roles":["anon"],"cmd":"ALL","qual":"(bucket_id <> ''documents''::text)","with_check":"(bucket_id <> ''documents''::text)"},{"schema":"storage","tab":"objects","name":"m08_document_delete_guard","permissive":"RESTRICTIVE","roles":["authenticated"],"cmd":"DELETE","qual":"((bucket_id <> ''documents''::text) OR public.can_delete_staged_document(name))","with_check":null},{"schema":"storage","tab":"objects","name":"m08_document_insert_guard","permissive":"RESTRICTIVE","roles":["authenticated"],"cmd":"INSERT","qual":null,"with_check":"((bucket_id <> ''documents''::text) OR public.can_insert_reserved_document(name))"},{"schema":"storage","tab":"objects","name":"m08_document_read_guard","permissive":"RESTRICTIVE","roles":["authenticated"],"cmd":"SELECT","qual":"((bucket_id <> ''documents''::text) OR public.can_read_document_object(name))","with_check":null},{"schema":"storage","tab":"objects","name":"m08_document_update_guard","permissive":"RESTRICTIVE","roles":["authenticated"],"cmd":"UPDATE","qual":"(bucket_id <> ''documents''::text)","with_check":"(bucket_id <> ''documents''::text)"},{"schema":"storage","tab":"objects","name":"m08_staged_cleanup","permissive":"PERMISSIVE","roles":["authenticated"],"cmd":"DELETE","qual":"((bucket_id = ''documents''::text) AND public.can_delete_staged_document(name))","with_check":null}]'::jsonb) LOOP
  SELECT * INTO actual FROM pg_policies WHERE schemaname='storage' AND tablename=p->>'tab' AND policyname=p->>'name';
  IF FOUND THEN
   IF actual.permissive<>p->>'permissive' OR actual.cmd<>p->>'cmd' OR to_jsonb(actual.roles::text[])<>p->'roles'
    OR actual.qual IS DISTINCT FROM p->>'qual' OR actual.with_check IS DISTINCT FROM p->>'with_check'
   THEN RAISE EXCEPTION 'Unreviewed Storage policy %: no provider policy overwritten',p->>'name'; END IF;
  ELSE
   EXECUTE (CASE p->>'name' WHEN 'm01_document_objects_insert' THEN 'CREATE POLICY "m01_document_objects_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated"
 WITH CHECK (((bucket_id = ''documents''::text) AND public.can_insert_reserved_document(name)));' WHEN 'm01_document_objects_read' THEN 'CREATE POLICY "m01_document_objects_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated"
 USING (((bucket_id = ''documents''::text) AND public.can_read_document_object(name)));' WHEN 'm08_document_anon_guard' THEN 'CREATE POLICY "m08_document_anon_guard" ON "storage"."objects" AS RESTRICTIVE FOR ALL TO "anon"
 USING ((bucket_id <> ''documents''::text)) WITH CHECK ((bucket_id <> ''documents''::text));' WHEN 'm08_document_delete_guard' THEN 'CREATE POLICY "m08_document_delete_guard" ON "storage"."objects" AS RESTRICTIVE FOR DELETE TO "authenticated"
 USING (((bucket_id <> ''documents''::text) OR public.can_delete_staged_document(name)));' WHEN 'm08_document_insert_guard' THEN 'CREATE POLICY "m08_document_insert_guard" ON "storage"."objects" AS RESTRICTIVE FOR INSERT TO "authenticated"
 WITH CHECK (((bucket_id <> ''documents''::text) OR public.can_insert_reserved_document(name)));' WHEN 'm08_document_read_guard' THEN 'CREATE POLICY "m08_document_read_guard" ON "storage"."objects" AS RESTRICTIVE FOR SELECT TO "authenticated"
 USING (((bucket_id <> ''documents''::text) OR public.can_read_document_object(name)));' WHEN 'm08_document_update_guard' THEN 'CREATE POLICY "m08_document_update_guard" ON "storage"."objects" AS RESTRICTIVE FOR UPDATE TO "authenticated"
 USING ((bucket_id <> ''documents''::text)) WITH CHECK ((bucket_id <> ''documents''::text));' WHEN 'm08_staged_cleanup' THEN 'CREATE POLICY "m08_staged_cleanup" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated"
 USING (((bucket_id = ''documents''::text) AND public.can_delete_staged_document(name)));' END);
  END IF;
 END LOOP;
 IF NOT has_table_privilege('authenticated','storage.objects','SELECT') OR NOT has_table_privilege('authenticated','storage.objects','INSERT') OR NOT has_table_privilege('authenticated','storage.objects','DELETE')
 THEN RAISE EXCEPTION 'Provider Storage privileges require review; no blanket provider grants added'; END IF;
END $storage$;
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.academic_years FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m01_alert_fields BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.guard_alert_update();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m01_announcement_audience BEFORE INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.bind_announcement();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m01_exception_identity BEFORE UPDATE ON public.attendance_exceptions FOR EACH ROW EXECUTE FUNCTION public.guard_domain_identity();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.attendance_exceptions FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m03_future BEFORE INSERT OR UPDATE ON public.attendance_exceptions FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_future();
CREATE TRIGGER m01_attendance_identity BEFORE UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.guard_domain_identity();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m03_future BEFORE INSERT OR UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_future();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.course_sections FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m08_review_audit AFTER INSERT OR DELETE OR UPDATE ON public.document_review_events FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m08_version_audit AFTER INSERT OR DELETE OR UPDATE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m01_document_identity BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.guard_domain_identity();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m01_evaluation_identity BEFORE UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.guard_domain_identity();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.interns FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE CONSTRAINT TRIGGER m07_intern_relationship AFTER INSERT OR DELETE OR UPDATE ON public.interns DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_account_relationships();
CREATE TRIGGER m11_assignment_archive_guard BEFORE INSERT OR UPDATE ON public.interns FOR EACH ROW EXECUTE FUNCTION public.guard_archived_assignment();
CREATE TRIGGER m01_profile_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();
CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE CONSTRAINT TRIGGER m07_profile_relationship AFTER INSERT OR UPDATE ON public.profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_account_relationships();
CREATE TRIGGER m14_last_active_admin BEFORE DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_last_active_admin();
CREATE TRIGGER m10_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.submission_files FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m10_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.submission_reviews FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m10_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.submission_versions FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
CREATE TRIGGER m10_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit();
-- Preserve the existing INSync signup integration, never delete Auth users.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created') THEN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created'
   AND tgenabled='O' AND pg_get_triggerdef(oid)='CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()')
  THEN RAISE EXCEPTION 'Unreviewed Auth signup trigger: no provider trigger replaced'; END IF;
 ELSE
  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
 END IF;
END $$;
SET LOCAL check_function_bodies=on;
-- All remaining Auth identities get only Pending Intern, without metadata roles.
INSERT INTO public.profiles(id,email,full_name,role,status,requested_role)
 SELECT id,email,email,'intern','Pending','intern' FROM auth.users WHERE deleted_at IS NULL;
INSERT INTO public.interns(id) SELECT id FROM public.profiles;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.profiles WHERE role<>'intern' OR status<>'Pending')
 THEN RAISE EXCEPTION 'Unexpected privileged Auth reconciliation'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;

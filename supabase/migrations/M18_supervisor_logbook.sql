-- Supervisor paper evidence -> assigned Coordinator atomic verification.
-- Additive after M17. Run only in an explicitly authorized rollout.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(404,1);
do $$ begin
 if current_user<>'postgres' or to_regprocedure('public.verify_manual_attendance(uuid,integer,uuid,timestamptz,timestamptz,boolean)') is null then
 raise exception 'M18 requires trusted postgres and reviewed M01-M17'; end if;
end $$;
create table public.logbook_submissions (
 id uuid primary key, supervisor_id uuid not null references public.profiles(id), intern_id uuid not null references public.interns(id),
 company_id uuid not null references public.companies(id), assignment_id uuid not null references public.supervisor_assignments(id),
 supervisor_name text not null, intern_name text not null, company_name text not null,
 coordinator_id uuid references public.profiles(id), current_version integer not null default 1,
 created_at timestamptz not null default now()
);
create table public.logbook_versions (
 submission_id uuid not null references public.logbook_submissions(id), version integer not null check(version>0),
 revision integer not null default 1, status text not null default 'Draft' check(status in ('Draft','Pending Review','Returned for Correction','Verified')),
 date_start date not null, date_end date not null, remarks text not null default '' check(length(remarks)<=1000),
 evidence_ids uuid[] not null default '{}', receiving_coordinator_id uuid references public.profiles(id),
 submitted_at timestamptz, return_reason text, returned_by uuid references public.profiles(id), returned_at timestamptz,
 verified_by uuid references public.profiles(id), verified_at timestamptz, request_id uuid unique, recorded_sessions jsonb,
 primary key(submission_id,version), check(date_end>=date_start), check(cardinality(evidence_ids)<=10)
);
create table public.logbook_events (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.logbook_submissions(id),
 actor_id uuid not null references public.profiles(id), event_kind text not null, before_values jsonb, after_values jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.attendance_sheet_evidence add column logbook_submission_id uuid references public.logbook_submissions(id);
alter table public.attendance_logs add column logbook_submission_id uuid references public.logbook_submissions(id);
alter table public.attendance_logs add column logbook_version integer;
alter table public.attendance_logs add constraint m18_logbook_link foreign key(logbook_submission_id,logbook_version) references public.logbook_versions(submission_id,version);
alter table public.attendance_logs add constraint m18_logbook_shape check((logbook_submission_id is null and logbook_version is null) or
 (logbook_submission_id is not null and logbook_version is not null and attendance_source='manual_company_sheet' and verified));

create function public.can_read_logbook(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_admin() or exists(select 1 from public.logbook_submissions s where s.id=p_id and
 ((public.current_role()='supervisor' and s.supervisor_id=auth.uid()) or
 (public.current_role()='instructor' and s.coordinator_id=auth.uid() and public.assigned_intern(s.intern_id)
 and exists(select 1 from public.interns i join public.profiles p on p.id=i.id where i.id=s.intern_id and i.company_id=s.company_id and p.role='intern' and p.status='Active')
 and exists(select 1 from public.logbook_versions v where v.submission_id=s.id and v.status<>'Draft'))))
$$;
create function public.can_review_logbook(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.current_role()='instructor' and exists(select 1 from public.logbook_submissions where id=p_id and coordinator_id=auth.uid()) and public.can_read_logbook(p_id)
$$;
alter table public.logbook_submissions enable row level security;
alter table public.logbook_versions enable row level security;
alter table public.logbook_events enable row level security;
revoke all on public.logbook_submissions,public.logbook_versions,public.logbook_events from public,anon,authenticated;
grant select on public.logbook_submissions,public.logbook_versions,public.logbook_events to authenticated;
create policy m18_submission_read on public.logbook_submissions for select to authenticated using(public.can_read_logbook(id));
create policy m18_version_read on public.logbook_versions for select to authenticated using(public.can_read_logbook(submission_id) and (status<>'Draft' or public.is_admin() or exists(select 1 from public.logbook_submissions s where s.id=submission_id and s.supervisor_id=auth.uid())));
create policy m18_events_read on public.logbook_events for select to authenticated using(public.can_read_logbook(submission_id) and (event_kind<>'draft_saved' or public.is_admin() or exists(select 1 from public.logbook_submissions s where s.id=submission_id and s.supervisor_id=auth.uid())));
create trigger m18_events_immutable before update or delete on public.logbook_events for each row execute function public.guard_manual_history();
create trigger m18_events_audit after insert on public.logbook_events for each row execute function public.write_trusted_audit();

create function public.save_logbook_draft(p_id uuid,p_intern uuid,p_start date,p_end date,p_remarks text,p_evidence uuid[],p_version integer,p_revision integer) returns public.logbook_versions
language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.logbook_submissions; v public.logbook_versions; previous jsonb; a public.supervisor_assignments; eid uuid;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.supervises_intern(p_intern) then raise exception 'Active Supervisor and explicitly assigned Intern required' using errcode='42501'; end if;
 if p_id is null or p_version is null or p_revision is null or p_version<1 or p_revision<0 or p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<p_start or p_end>(clock_timestamp() at time zone 'Asia/Manila')::date or p_remarks is null or length(p_remarks)>1000
 or p_evidence is null or cardinality(p_evidence)>10 or cardinality(p_evidence)<>(select count(distinct x) from unnest(p_evidence) x) then raise exception 'Valid past covered dates, remarks and at most 10 evidence pages required'; end if;
 select * into s from public.logbook_submissions where id=p_id for update;
 select * into a from public.supervisor_assignments where supervisor_id=auth.uid() and intern_id=p_intern and ended_at is null;
 if s.id is null then
  if p_version is distinct from 1 or p_revision is distinct from 0 then raise exception 'Start a new draft' using errcode='40001'; end if;
  insert into public.logbook_submissions(id,supervisor_id,intern_id,company_id,assignment_id,supervisor_name,intern_name,company_name)
  select p_id,auth.uid(),p_intern,a.company_id,a.id,sp.full_name,ip.full_name,c.name from public.profiles sp,public.profiles ip,public.companies c where sp.id=auth.uid() and ip.id=p_intern and c.id=a.company_id returning * into s;
 else
  if s.supervisor_id<>auth.uid() or s.intern_id<>p_intern or s.assignment_id<>a.id or s.company_id<>a.company_id then raise exception 'Submission ownership or assignment changed' using errcode='42501'; end if;
 end if;
 select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version for update;
 previous:=to_jsonb(v);
 if v.submission_id is not null and v.status='Returned for Correction' then
  if v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Submission changed; refresh' using errcode='40001'; end if;
  update public.logbook_submissions set current_version=current_version+1 where id=p_id returning * into s;
 elsif v.submission_id is not null and (v.status<>'Draft' or v.version is distinct from p_version or v.revision is distinct from p_revision) then
  -- Exact retry of a saved draft is safe, including a lost resubmission response.
  if v.status='Draft' and v.version in (p_version,p_version+1) and v.date_start=p_start and v.date_end=p_end and v.remarks=p_remarks and v.evidence_ids=p_evidence then return v; end if;
  raise exception 'Submitted evidence is immutable or draft changed; refresh' using errcode='40001';
 end if;
 foreach eid in array p_evidence loop
  if not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path
   where e.id=eid and e.logbook_submission_id=p_id and e.uploaded_by=auth.uid() and e.ready_at is not null and e.abandoned_at is null and (e.committed_at is not null or e.expires_at>clock_timestamp())
   and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size) then raise exception 'Successfully uploaded private evidence required'; end if;
 end loop;
 if (select coalesce(sum(byte_size),0) from public.attendance_sheet_evidence where id=any(p_evidence))>52428800 then raise exception 'Evidence limit is 50 MiB total'; end if;
 insert into public.logbook_versions(submission_id,version,date_start,date_end,remarks,evidence_ids)
 values(p_id,s.current_version,p_start,p_end,p_remarks,p_evidence)
 on conflict(submission_id,version) do update set date_start=p_start,date_end=p_end,remarks=p_remarks,evidence_ids=p_evidence,revision=logbook_versions.revision+1 returning * into v;
 update public.attendance_sheet_evidence set committed_at=clock_timestamp() where id=any(p_evidence) and committed_at is null;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'draft_saved',previous,to_jsonb(v));
 return v;
end $$;

create function public.stage_logbook_evidence(p_id uuid,p_submission uuid,p_name text,p_mime text,p_size bigint) returns public.attendance_sheet_evidence
language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.logbook_submissions; e public.attendance_sheet_evidence; ext text;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into s from public.logbook_submissions where id=p_submission for update;
 if s.id is null or s.supervisor_id<>auth.uid() or not public.supervises_intern(s.intern_id)
 or not exists(select 1 from public.supervisor_assignments where id=s.assignment_id and ended_at is null)
 or not exists(select 1 from public.logbook_versions where submission_id=s.id and version=s.current_version and status in ('Draft','Returned for Correction')) then raise exception 'Own editable submission and current assignment required' using errcode='42501'; end if;
 ext:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end;
 if p_id is null or p_name is null or length(p_name) not between 1 and 200 or ext is null or p_size is null or p_size not between 1 and 10485760 then raise exception 'PDF, JPEG or PNG up to 10 MiB required'; end if;
 select * into e from public.attendance_sheet_evidence where id=p_id;
 if found then
  if e.logbook_submission_id=p_submission and e.uploaded_by=auth.uid() and e.file_name=p_name and e.mime_type=p_mime and e.byte_size=p_size and e.abandoned_at is null then return e; end if;
  raise exception 'Upload identity already used';
 end if;
 if (select count(*) from public.attendance_sheet_evidence where logbook_submission_id=p_submission and committed_at is null and abandoned_at is null and expires_at>clock_timestamp())>=10 then raise exception 'At most 10 active page uploads; abandon unused uploads first'; end if;
 insert into public.attendance_sheet_evidence(id,company_id,participant_ids,uploaded_by,file_path,file_name,mime_type,byte_size,expires_at,logbook_submission_id)
 values(p_id,s.company_id,array[s.intern_id],auth.uid(),'sheets/'||p_id::text||'.'||ext,p_name,p_mime,p_size,clock_timestamp()+interval '15 minutes',s.id) returning * into e;
 return e;
end $$;

create function public.submit_logbook(p_id uuid,p_version integer,p_revision integer) returns public.logbook_versions
language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.logbook_submissions; v public.logbook_versions; recipient uuid; oldv jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into s from public.logbook_submissions where id=p_id for update;
 if s.id is null or s.supervisor_id<>auth.uid() or not public.supervises_intern(s.intern_id) or not exists(select 1 from public.supervisor_assignments where id=s.assignment_id and ended_at is null) then raise exception 'Current explicit assignment required' using errcode='42501'; end if;
 select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version for update;
 if v.version=p_version and v.status='Pending Review' and v.revision=p_revision+1 then return v; end if;
 if v.status<>'Draft' or v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Draft changed; refresh' using errcode='40001'; end if;
 if cardinality(v.evidence_ids)=0 then raise exception 'Upload and save signed evidence before submission'; end if;
 if exists(select 1 from unnest(v.evidence_ids) eid where not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path where e.id=eid and e.committed_at is not null and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size)) then raise exception 'Preserved signed evidence unavailable'; end if;
 select i.instructor_id into recipient from public.interns i join public.profiles p on p.id=i.instructor_id where i.id=s.intern_id and i.company_id=s.company_id and p.role='instructor' and p.status='Active';
 if recipient is null then raise exception 'No eligible assigned OJT Coordinator. Ask Admin to resolve the assignment; your draft and evidence are saved.'; end if;
 if s.coordinator_id is not null and s.coordinator_id<>recipient then raise exception 'Coordinator changed. Ask Admin to explicitly reroute this submission before resubmitting; draft preserved.'; end if;
 oldv:=to_jsonb(v);
 update public.logbook_submissions set coordinator_id=recipient where id=p_id;
 update public.logbook_versions set status='Pending Review',receiving_coordinator_id=recipient,submitted_at=clock_timestamp(),revision=revision+1 where submission_id=p_id and version=v.version returning * into v;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'submitted',oldv,to_jsonb(v));
 return v;
end $$;

create function public.return_logbook(p_id uuid,p_version integer,p_revision integer,p_reason text) returns public.logbook_versions
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.logbook_versions; oldv jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 if public.can_review_logbook(p_id) is not true then raise exception 'Assigned receiving Coordinator required' using errcode='42501'; end if;
 select v0.* into v from public.logbook_versions v0 join public.logbook_submissions s on s.id=v0.submission_id and s.current_version=v0.version where s.id=p_id for update of v0;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 or btrim(p_reason)!~'[[:alpha:]]' then raise exception 'Explain the missing signatures, unreadable evidence, wrong dates or other correction (10–1000 characters)'; end if;
 if v.version=p_version and v.status='Returned for Correction' and v.returned_by=auth.uid() and v.return_reason=btrim(p_reason) and v.revision=p_revision+1 then return v; end if;
 if v.status<>'Pending Review' or v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Review changed; refresh' using errcode='40001'; end if;
 oldv:=to_jsonb(v);
 update public.logbook_versions set status='Returned for Correction',return_reason=btrim(p_reason),returned_by=auth.uid(),returned_at=clock_timestamp(),revision=revision+1 where submission_id=p_id and version=p_version returning * into v;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'returned',oldv,to_jsonb(v));
 return v;
end $$;

create function public.verify_record_logbook(p_id uuid,p_version integer,p_revision integer,p_request uuid,p_sessions jsonb,p_reviewed boolean) returns public.logbook_versions
language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.logbook_submissions; v public.logbook_versions; oldv jsonb; item jsonb; pin timestamptz; pout timestamptz; n integer:=0; eid uuid; now_at timestamptz;
begin
 perform pg_advisory_xact_lock(404,1);
 if public.can_review_logbook(p_id) is not true then raise exception 'Assigned receiving Active Coordinator required' using errcode='42501'; end if;
 select * into s from public.logbook_submissions where id=p_id for update;
 perform pg_advisory_xact_lock(hashtextextended(s.intern_id::text,101));
 select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version for update;
 if p_request is null or p_reviewed is distinct from true or jsonb_typeof(p_sessions) is distinct from 'array' or jsonb_array_length(p_sessions) not between 1 and 62 then raise exception 'Confirm evidence and enter 1–62 valid sessions'; end if;
 if v.status='Verified' and v.version=p_version and v.request_id=p_request and v.recorded_sessions=p_sessions then return v; end if;
 if v.status<>'Pending Review' or v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Submission already reviewed or version changed; refresh' using errcode='40001'; end if;
 foreach eid in array v.evidence_ids loop
  if not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path where e.id=eid and e.logbook_submission_id=p_id and e.committed_at is not null and e.abandoned_at is null and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size) then raise exception 'Preserved signed evidence unavailable'; end if;
 end loop;
 if cardinality(v.evidence_ids)=0 then raise exception 'Signed evidence required'; end if;
 oldv:=to_jsonb(v); now_at:=clock_timestamp();
 for item in select value from jsonb_array_elements(p_sessions) loop
  n:=n+1;
  begin
   if jsonb_typeof(item) is distinct from 'object' or (select count(*) from jsonb_object_keys(item))<>2 or jsonb_typeof(item->'time_in') is distinct from 'string' or jsonb_typeof(item->'time_out') is distinct from 'string'
   or item->>'time_in'!~'(Z|[+-][0-9]{2}:[0-9]{2})$' or item->>'time_out'!~'(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Both canonical timestamps with explicit offsets required'; end if;
   pin:=(item->>'time_in')::timestamptz; pout:=(item->>'time_out')::timestamptz;
   perform public.check_manual_session(s.intern_id,pin,pout,null);
   if (pin at time zone 'Asia/Manila')::date not between v.date_start and v.date_end or (pout at time zone 'Asia/Manila')::date not between v.date_start and v.date_end then raise exception 'Session dates must fall within submitted covered dates'; end if;
   insert into public.attendance_logs(id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,verified_by,verified_at,attendance_source,manual_evidence_id,manual_details,manual_revision,encoded_by,encoded_at,logbook_submission_id,logbook_version)
   values(gen_random_uuid(),s.intern_id,(pin at time zone 'Asia/Manila')::date,(pin at time zone 'Asia/Manila')::time,(pout at time zone 'Asia/Manila')::time,pin,pout,extract(epoch from pout-pin)/3600,true,auth.uid(),now_at,'manual_company_sheet',v.evidence_ids[1],
   jsonb_build_object('company_id',s.company_id,'company_on_sheet',s.company_name,'registered_company_name',s.company_name,'supervisor_on_sheet',s.supervisor_name,'remarks','','source_label','Manual — Company Logbook','signatures_reviewed',true),1,auth.uid(),now_at,s.id,v.version);
  exception when others then raise exception 'Session %: %',n,sqlerrm; end;
 end loop;
 update public.logbook_versions set status='Verified',verified_by=auth.uid(),verified_at=now_at,request_id=p_request,recorded_sessions=p_sessions,revision=revision+1 where submission_id=p_id and version=p_version returning * into v;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'verified_and_recorded',oldv,to_jsonb(v));
 return v;
end $$;

create function public.admin_reroute_logbook(p_id uuid,p_coordinator uuid,p_version integer,p_revision integer,p_reason text) returns public.logbook_submissions
language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.logbook_submissions; v public.logbook_versions; previous jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 select * into s from public.logbook_submissions where id=p_id for update;
 select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version;
 if s.id is null or v.status='Verified' or v.version is distinct from p_version or v.revision is distinct from p_revision or p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'Current unresolved submission and meaningful rerouting reason required'; end if;
 if not exists(select 1 from public.interns i join public.profiles p on p.id=i.instructor_id join public.profiles student on student.id=i.id where i.id=s.intern_id and i.company_id=s.company_id and i.instructor_id=p_coordinator and p.role='instructor' and p.status='Active' and student.role='intern' and student.status='Active') then raise exception 'Recipient must be current eligible assigned Coordinator in the preserved company'; end if;
 previous:=to_jsonb(s);
 update public.logbook_submissions set coordinator_id=p_coordinator where id=p_id returning * into s;
 -- Invalidate any open review, without rewriting original receiving identity.
 update public.logbook_versions set revision=revision+1 where submission_id=p_id and version=v.version;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'admin_rerouted',previous,to_jsonb(s)||jsonb_build_object('reason',btrim(p_reason)));
 return s;
end $$;

-- Controlled lifecycle only; private events retain every state transition.
create function public.guard_logbook_version() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then raise exception 'Logbook history must be preserved'; end if;
 if old.status='Verified' and new is distinct from old then raise exception 'Verified logbook version is immutable'; end if;
 if old.status<>'Draft' and (to_jsonb(new)-array['status','revision','return_reason','returned_by','returned_at','verified_by','verified_at','request_id','recorded_sessions']) is distinct from
 (to_jsonb(old)-array['status','revision','return_reason','returned_by','returned_at','verified_by','verified_at','request_id','recorded_sessions']) then raise exception 'Submitted evidence and provenance are immutable'; end if;
 return new;
end $$;
create trigger m18_version_guard before update or delete on public.logbook_versions for each row execute function public.guard_logbook_version();

-- M17 historical uploads/revisions stay private. New Coordinator creation is retired.
revoke execute on function public.stage_attendance_sheet(uuid,uuid,uuid[],text,text,bigint),public.record_manual_attendance(uuid,uuid,timestamptz,timestamptz,uuid,jsonb) from authenticated;
create or replace function public.manual_attendance_details(p_intern uuid,p_evidence uuid,p_details jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence; company_name text; key text;
begin
 if public.current_role() is distinct from 'instructor' or not public.assigned_intern(p_intern)
 or not exists(select 1 from public.profiles where id=p_intern and role='intern' and status='Active') then raise exception 'Assigned Active Intern and OJT Coordinator required' using errcode='42501'; end if;
 select * into e from public.attendance_sheet_evidence where id=p_evidence for update;
 if not found or not public.can_read_attendance_sheet(e.id) or not p_intern=any(e.participant_ids) or not public.manual_company_allowed(p_intern,e.company_id) then raise exception 'Authorized evidence for this Intern/company required' using errcode='42501'; end if;
 if e.logbook_submission_id is not null then raise exception 'Supervisor logbooks require Verify & Record Attendance for the whole submitted version'; end if;
 if e.ready_at is null or e.abandoned_at is not null or (e.committed_at is null and e.expires_at<=clock_timestamp())
 or not exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path and metadata->>'mimetype'=e.mime_type and (metadata->>'size')::numeric=e.byte_size) then raise exception 'Successfully uploaded, validated signed evidence required'; end if;
 if jsonb_typeof(p_details) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_details))<>6 or p_details->'signatures_reviewed' is distinct from 'true'::jsonb then raise exception 'Confirm review of Intern and Supervisor signatures'; end if;
 foreach key in array array['company_on_sheet','supervisor_on_sheet','fallback_reason','reason_explanation','remarks'] loop
  if jsonb_typeof(p_details->key) is distinct from 'string' then raise exception 'Complete printed company, Supervisor and fallback information'; end if;
 end loop;
 if length(btrim(p_details->>'company_on_sheet')) not between 1 and 200 or length(btrim(p_details->>'supervisor_on_sheet')) not between 1 and 200
 or p_details->>'fallback_reason' not in ('no_connectivity','system_unavailable','other') or length(p_details->>'remarks')>500
 or length(p_details->>'reason_explanation')>500 or (p_details->>'fallback_reason'='other' and (length(btrim(p_details->>'reason_explanation'))<10 or p_details->>'reason_explanation'!~'[[:alpha:]]'))
 or (p_details->>'fallback_reason'<>'other' and p_details->>'reason_explanation'<>'') then raise exception 'Valid company/Supervisor information required; Other needs a meaningful 10-500 character explanation'; end if;
 select name into company_name from public.companies where id=e.company_id;
 return p_details||jsonb_build_object('company_id',e.company_id,'registered_company_name',company_name);
end $$;
-- Evidence helpers below retain M17 legacy behavior, adding only scoped logbook access.

create function public.can_read_logbook_evidence(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.attendance_sheet_evidence e join public.logbook_submissions s on s.id=e.logbook_submission_id where e.id=p_id and
 (public.is_admin() or (public.current_role()='supervisor' and s.supervisor_id=auth.uid()) or
 (public.can_review_logbook(s.id) and exists(select 1 from public.logbook_versions v where v.submission_id=s.id and v.status<>'Draft' and e.id=any(v.evidence_ids)))))
$$;
create or replace function public.can_read_attendance_sheet(p_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.attendance_sheet_evidence e where e.id=p_id and
 case when e.logbook_submission_id is not null then public.can_read_logbook_evidence(e.id) else
 public.is_admin() or (public.current_role()='instructor' and not exists(select 1 from unnest(e.participant_ids) i where not public.assigned_intern(i))) end)
$$;
create or replace function public.finish_attendance_sheet(p_id uuid) returns public.attendance_sheet_evidence
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into e from public.attendance_sheet_evidence where id=p_id for update;
 if not found or e.uploaded_by<>auth.uid() or (public.current_role() is distinct from 'instructor' and not (public.current_role()='supervisor' and e.logbook_submission_id is not null)) or not public.can_read_attendance_sheet(p_id) then raise exception 'Own authorized sheet upload required' using errcode='42501'; end if;
 if e.logbook_submission_id is not null and e.committed_at is null and not exists(select 1 from public.logbook_submissions s join public.logbook_versions v on v.submission_id=s.id and v.version=s.current_version join public.supervisor_assignments a on a.id=s.assignment_id where s.id=e.logbook_submission_id and a.ended_at is null and public.supervises_intern(s.intern_id) and v.status in ('Draft','Returned for Correction')) then raise exception 'Current editable supervision assignment required' using errcode='42501'; end if;
 if e.abandoned_at is not null or (e.committed_at is null and e.expires_at<=clock_timestamp()) then raise exception 'Sheet reservation expired or abandoned'; end if;
 if not exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path
 and metadata->>'mimetype'=e.mime_type and (metadata->>'size')::numeric=e.byte_size) then raise exception 'Complete validated evidence upload required'; end if;
 if e.ready_at is not null then return e; end if;
 update public.attendance_sheet_evidence set ready_at=clock_timestamp() where id=p_id returning * into e;
 return e;
end $$;
create or replace function public.cancel_attendance_sheet(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into e from public.attendance_sheet_evidence where id=p_id for update;
 if not found or e.uploaded_by<>auth.uid() or (public.current_role() is distinct from 'instructor' and not (public.current_role()='supervisor' and e.logbook_submission_id is not null)) then raise exception 'Own Coordinator upload required' using errcode='42501'; end if;
 if e.committed_at is not null or exists(select 1 from public.attendance_logs where manual_evidence_id=p_id)
 or exists(select 1 from public.manual_attendance_events where before_values->>'manual_evidence_id'=p_id::text or after_values->>'manual_evidence_id'=p_id::text) then raise exception 'Referenced attendance evidence must be preserved'; end if;
 if e.abandoned_at is null then update public.attendance_sheet_evidence set abandoned_at=clock_timestamp() where id=p_id returning * into e; end if;
 return to_jsonb(e)||jsonb_build_object('object_exists',exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path));
end $$;
create or replace function public.attendance_sheet_object_allowed(p_path text,p_operation text) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into e from public.attendance_sheet_evidence where file_path=p_path;
 if not found then return false; end if;
 -- DELETE predicates also require SELECT visibility. Abandoned, unreferenced
 -- uploads remain visible to their still-authorized uploader for byte cleanup.
 if p_operation='read' then return public.can_read_attendance_sheet(e.id) and ((e.abandoned_at is null and e.ready_at is not null) or e.uploaded_by=auth.uid()); end if;
 if (public.current_role() is distinct from 'instructor' and not (public.current_role()='supervisor' and e.logbook_submission_id is not null)) or e.uploaded_by<>auth.uid() then return false; end if;
 if p_operation='insert' and e.logbook_submission_id is not null then
 return public.supervises_intern(e.participant_ids[1]) and exists(select 1 from public.logbook_submissions s join public.logbook_versions v on v.submission_id=s.id and v.version=s.current_version where s.id=e.logbook_submission_id and s.supervisor_id=auth.uid() and exists(select 1 from public.supervisor_assignments a where a.id=s.assignment_id and a.ended_at is null) and v.status in ('Draft','Returned for Correction')) and e.ready_at is null and e.abandoned_at is null and e.expires_at>clock_timestamp(); end if;
 if p_operation='insert' then return public.can_read_attendance_sheet(e.id) and e.ready_at is null and e.abandoned_at is null and e.expires_at>clock_timestamp(); end if;
 if p_operation='delete' then return e.abandoned_at is not null and e.committed_at is null
 and not exists(select 1 from public.attendance_logs where manual_evidence_id=e.id)
 and not exists(select 1 from public.manual_attendance_events where before_values->>'manual_evidence_id'=e.id::text or after_values->>'manual_evidence_id'=e.id::text); end if;
 return false;
end $$;

create function public.logbook_queue(p_after uuid default null,p_size integer default 100) returns setof jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select to_jsonb(s)||jsonb_build_object('current_coordinator_id',case when public.is_admin() then (select instructor_id from public.interns where id=s.intern_id) else null end,'current',to_jsonb(v),'history',
 (select coalesce(jsonb_agg(to_jsonb(h) order by h.version desc),'[]') from public.logbook_versions h where h.submission_id=s.id and (h.status<>'Draft' or public.is_admin() or s.supervisor_id=auth.uid())),
 'files',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'file_name',e.file_name,'mime_type',e.mime_type,'byte_size',e.byte_size,'ready_at',e.ready_at,'committed_at',e.committed_at,'expires_at',e.expires_at,'abandoned_at',e.abandoned_at) order by e.created_at),'[]')
 from public.attendance_sheet_evidence e where e.logbook_submission_id=s.id and public.can_read_logbook_evidence(e.id)))
 from public.logbook_submissions s join public.logbook_versions v on v.submission_id=s.id and v.version=s.current_version
 where public.can_read_logbook(s.id) and (p_after is null or s.id>p_after)
 and (v.status<>'Draft' or public.is_admin() or s.supervisor_id=auth.uid())
 order by s.id limit greatest(1,least(coalesce(p_size,100),500))
$$;
revoke all on function public.can_read_logbook(uuid) from public,anon,authenticated;
grant execute on function public.can_read_logbook(uuid) to authenticated;
revoke all on function public.can_review_logbook(uuid) from public,anon,authenticated;
grant execute on function public.can_review_logbook(uuid) to authenticated;
revoke all on function public.save_logbook_draft(uuid,uuid,date,date,text,uuid[],integer,integer) from public,anon,authenticated;
grant execute on function public.save_logbook_draft(uuid,uuid,date,date,text,uuid[],integer,integer) to authenticated;
revoke all on function public.stage_logbook_evidence(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.stage_logbook_evidence(uuid,uuid,text,text,bigint) to authenticated;
revoke all on function public.submit_logbook(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.submit_logbook(uuid,integer,integer) to authenticated;
revoke all on function public.return_logbook(uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.return_logbook(uuid,integer,integer,text) to authenticated;
revoke all on function public.verify_record_logbook(uuid,integer,integer,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.verify_record_logbook(uuid,integer,integer,uuid,jsonb,boolean) to authenticated;
revoke all on function public.admin_reroute_logbook(uuid,uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.admin_reroute_logbook(uuid,uuid,integer,integer,text) to authenticated;
revoke all on function public.guard_logbook_version() from public,anon,authenticated;
revoke all on function public.can_read_logbook_evidence(uuid) from public,anon,authenticated;
grant execute on function public.can_read_logbook_evidence(uuid) to authenticated;
revoke all on function public.logbook_queue(uuid,integer) from public,anon,authenticated;
grant execute on function public.logbook_queue(uuid,integer) to authenticated;
commit;

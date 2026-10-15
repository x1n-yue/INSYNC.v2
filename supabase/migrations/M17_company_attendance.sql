-- Additive paper fallback after reviewed M16. No reset, backfill or live execution.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(404,1);
do $$ begin
 if current_user<>'postgres' or to_regprocedure('public.save_evaluation_review_v2(uuid,integer,text,jsonb,text,jsonb,jsonb,jsonb,jsonb,boolean)') is null
 or to_regprocedure('public.verify_attendance(uuid,timestamptz,timestamptz)') is null
 or exists(select 1 from pg_class where oid in ('public.attendance_logs'::regclass,'public.interns'::regclass) and relowner<>'postgres'::regrole)
 then raise exception 'M17 requires trusted postgres and reviewed M01-M16 final contracts'; end if;
end $$;

-- M17_BUCKET_BEGIN: shared by offline generators; no unrelated bucket changes.
do $$ begin
 if not exists(select 1 from storage.buckets where id='attendance-evidence') then
  if exists(select 1 from information_schema.columns where table_schema='storage' and table_name='buckets' and column_name='name') then
   execute $bucket$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('attendance-evidence','attendance-evidence',false,10485760,array['application/pdf','image/jpeg','image/png'])$bucket$;
  else
   insert into storage.buckets(id,public,file_size_limit,allowed_mime_types) values('attendance-evidence',false,10485760,array['application/pdf','image/jpeg','image/png']);
  end if;
 end if;
 if not exists(select 1 from storage.buckets where id='attendance-evidence' and not public and file_size_limit=10485760
 and cardinality(allowed_mime_types)=3 and allowed_mime_types @> array['application/pdf','image/jpeg','image/png']) then
  raise exception 'Inspect attendance-evidence bucket drift; no bucket configuration is overwritten';
 end if;
end $$;
-- M17_BUCKET_END

create table public.attendance_sheet_evidence (
 id uuid primary key, company_id uuid not null references public.companies(id),
 participant_ids uuid[] not null check(cardinality(participant_ids) between 1 and 50),
 uploaded_by uuid not null references public.profiles(id), file_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 200),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
 byte_size bigint not null check(byte_size between 1 and 10485760),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 ready_at timestamptz, committed_at timestamptz, abandoned_at timestamptz,
 check(committed_at is null or (ready_at is not null and abandoned_at is null))
);
alter table public.attendance_logs add column attendance_source text not null default 'online' check(attendance_source in ('online','manual_company_sheet'));
alter table public.attendance_logs add column manual_evidence_id uuid references public.attendance_sheet_evidence(id);
alter table public.attendance_logs add column manual_details jsonb;
alter table public.attendance_logs add column manual_revision integer not null default 0;
alter table public.attendance_logs add column encoded_by uuid references public.profiles(id);
alter table public.attendance_logs add column encoded_at timestamptz;
alter table public.attendance_logs add column revised_by uuid references public.profiles(id);
alter table public.attendance_logs add column revised_at timestamptz;
alter table public.attendance_logs add column revision_reason text;
alter table public.attendance_logs add column verified_at timestamptz;
alter table public.attendance_logs add constraint m17_manual_shape check(
 (attendance_source='online' and manual_evidence_id is null and manual_details is null and manual_revision=0 and encoded_by is null and encoded_at is null and revised_by is null and revised_at is null and revision_reason is null)
 or (attendance_source='manual_company_sheet' and manual_evidence_id is not null and manual_details is not null and jsonb_typeof(manual_details)='object'
 and encoded_by is not null and encoded_at is not null and manual_revision>0 and clocked_in_at is not null and clocked_out_at is not null
 and ((verified and verified_at is not null) or (not verified and verified_at is null))
 and ((manual_revision=1 and revised_by is null and revised_at is null and revision_reason is null)
 or (manual_revision>1 and revised_by is not null and revised_at is not null and revision_reason is not null and length(btrim(revision_reason))>=10 and length(btrim(revision_reason))<=500)))) not valid;
create table public.manual_attendance_events (
 id uuid primary key default gen_random_uuid(), attendance_id uuid not null references public.attendance_logs(id),
 intern_id uuid not null references public.interns(id), actor_id uuid not null references public.profiles(id),
 event_kind text not null check(event_kind in ('created','revised','verified')),
 before_values jsonb, after_values jsonb not null, created_at timestamptz not null default now()
);
alter table public.attendance_sheet_evidence enable row level security;
alter table public.manual_attendance_events enable row level security;
revoke all on public.attendance_sheet_evidence,public.manual_attendance_events from public,anon,authenticated;
grant select on public.attendance_sheet_evidence,public.manual_attendance_events to authenticated;

create function public.manual_company_allowed(p_intern uuid,p_company uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.interns where id=p_intern and company_id=p_company)
 or exists(select 1 from public.supervisor_assignments where intern_id=p_intern and company_id=p_company)
 or exists(select 1 from public.audit_logs where source='database-trigger-v2' and event_data->>'table'='interns'
 and event_data->>'record_id'=p_intern::text and (event_data->>'company_id'=p_company::text or event_data->>'previous_company_id'=p_company::text))
$$;
create function public.can_read_attendance_sheet(p_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_admin() or (public.current_role()='instructor' and exists(select 1 from public.attendance_sheet_evidence e where e.id=p_id
 and not exists(select 1 from unnest(e.participant_ids) i where not public.assigned_intern(i))))
$$;
create policy m17_evidence_read on public.attendance_sheet_evidence for select to authenticated using(public.can_read_attendance_sheet(id));
create policy m17_evidence_boundary on public.attendance_sheet_evidence as restrictive for select to authenticated using(public.can_read_attendance_sheet(id));
create policy m17_events_read on public.manual_attendance_events for select to authenticated using(public.can_review(intern_id));
create policy m17_events_boundary on public.manual_attendance_events as restrictive for select to authenticated using(public.can_review(intern_id));

create function public.attendance_sheet_context(p_intern uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not public.can_read_intern(p_intern) then raise exception 'Own or assigned Intern required' using errcode='42501'; end if;
 select jsonb_build_object('intern_id',i.id,'intern_name',p.full_name,'identifier',coalesce(nullif(p.student_id,''),p.id::text),
 'current_company_id',i.company_id,'companies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)
 from public.companies c where public.manual_company_allowed(i.id,c.id)),'[]'::jsonb)) into result
 from public.interns i join public.profiles p on p.id=i.id where i.id=p_intern;
 if result is null then raise exception 'Intern record unavailable'; end if;
 return result;
end $$;
create function public.stage_attendance_sheet(p_id uuid,p_company uuid,p_participants uuid[],p_name text,p_mime text,p_size bigint) returns public.attendance_sheet_evidence
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence; ext text; participant uuid;
begin
 perform pg_advisory_xact_lock(404,1);
 if public.current_role() is distinct from 'instructor' then raise exception 'Active assigned OJT Coordinator required' using errcode='42501'; end if;
 if p_id is null or p_participants is null or cardinality(p_participants) not between 1 and 50
 or cardinality(p_participants)<>(select count(distinct x) from unnest(p_participants) x)
 or p_name is null or length(p_name) not between 1 and 200 or p_size is null or p_size not between 1 and 10485760 then raise exception 'Valid sheet identity, participants and file details required'; end if;
 foreach participant in array p_participants loop
  if not public.assigned_intern(participant) or not public.manual_company_allowed(participant,p_company)
  or not exists(select 1 from public.profiles where id=participant and role='intern' and status='Active')
  then raise exception 'Every sheet participant must be an assigned Active Intern in this company or retained supervision history' using errcode='42501'; end if;
 end loop;
 ext:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else null end;
 if ext is null then raise exception 'PDF, JPEG or PNG evidence required'; end if;
 select * into e from public.attendance_sheet_evidence where id=p_id for update;
 if found then
  if e.uploaded_by=auth.uid() and e.company_id=p_company and e.participant_ids=p_participants and e.file_name=p_name and e.mime_type=p_mime and e.byte_size=p_size and e.abandoned_at is null then return e; end if;
  raise exception 'Upload identity already used; start a new upload';
 end if;
 insert into public.attendance_sheet_evidence(id,company_id,participant_ids,uploaded_by,file_path,file_name,mime_type,byte_size,expires_at)
 values(p_id,p_company,p_participants,auth.uid(),'sheets/'||p_id::text||'.'||ext,p_name,p_mime,p_size,clock_timestamp()+interval '15 minutes') returning * into e;
 return e;
end $$;
create function public.finish_attendance_sheet(p_id uuid) returns public.attendance_sheet_evidence
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into e from public.attendance_sheet_evidence where id=p_id for update;
 if not found or e.uploaded_by<>auth.uid() or public.current_role() is distinct from 'instructor' or not public.can_read_attendance_sheet(p_id) then raise exception 'Own authorized sheet upload required' using errcode='42501'; end if;
 if e.abandoned_at is not null or (e.committed_at is null and e.expires_at<=clock_timestamp()) then raise exception 'Sheet reservation expired or abandoned'; end if;
 if not exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path
 and metadata->>'mimetype'=e.mime_type and (metadata->>'size')::numeric=e.byte_size) then raise exception 'Complete validated evidence upload required'; end if;
 if e.ready_at is not null then return e; end if;
 update public.attendance_sheet_evidence set ready_at=clock_timestamp() where id=p_id returning * into e;
 return e;
end $$;
create function public.cancel_attendance_sheet(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into e from public.attendance_sheet_evidence where id=p_id for update;
 if not found or e.uploaded_by<>auth.uid() or public.current_role() is distinct from 'instructor' then raise exception 'Own Coordinator upload required' using errcode='42501'; end if;
 if e.committed_at is not null or exists(select 1 from public.attendance_logs where manual_evidence_id=p_id)
 or exists(select 1 from public.manual_attendance_events where before_values->>'manual_evidence_id'=p_id::text or after_values->>'manual_evidence_id'=p_id::text) then raise exception 'Referenced attendance evidence must be preserved'; end if;
 if e.abandoned_at is null then update public.attendance_sheet_evidence set abandoned_at=clock_timestamp() where id=p_id returning * into e; end if;
 return to_jsonb(e)||jsonb_build_object('object_exists',exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path));
end $$;
create function public.attendance_sheet_object_allowed(p_path text,p_operation text) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into e from public.attendance_sheet_evidence where file_path=p_path;
 if not found then return false; end if;
 -- DELETE predicates also require SELECT visibility. Abandoned, unreferenced
 -- uploads remain visible to their still-authorized uploader for byte cleanup.
 if p_operation='read' then return public.can_read_attendance_sheet(e.id) and ((e.abandoned_at is null and e.ready_at is not null) or e.uploaded_by=auth.uid()); end if;
 if public.current_role() is distinct from 'instructor' or e.uploaded_by<>auth.uid() then return false; end if;
 if p_operation='insert' then return public.can_read_attendance_sheet(e.id) and e.ready_at is null and e.abandoned_at is null and e.expires_at>clock_timestamp(); end if;
 if p_operation='delete' then return e.abandoned_at is not null and e.committed_at is null
 and not exists(select 1 from public.attendance_logs where manual_evidence_id=e.id)
 and not exists(select 1 from public.manual_attendance_events where before_values->>'manual_evidence_id'=e.id::text or after_values->>'manual_evidence_id'=e.id::text); end if;
 return false;
end $$;
create function public.attendance_sheet_access(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence;
begin
 select * into e from public.attendance_sheet_evidence where id=p_id;
 if not found or e.abandoned_at is not null or not public.attendance_sheet_object_allowed(e.file_path,'read') then raise exception 'Authorized sheet review required' using errcode='42501'; end if;
 return jsonb_build_object('bucket','attendance-evidence','path',e.file_path,'name',e.file_name,'mime',e.mime_type);
end $$;

create policy m17_sheet_select on storage.objects for select to authenticated using(bucket_id='attendance-evidence' and public.attendance_sheet_object_allowed(name,'read'));
create policy m17_sheet_insert on storage.objects for insert to authenticated with check(bucket_id='attendance-evidence' and public.attendance_sheet_object_allowed(name,'insert'));
create policy m17_sheet_delete on storage.objects for delete to authenticated using(bucket_id='attendance-evidence' and public.attendance_sheet_object_allowed(name,'delete'));
create policy m17_sheet_select_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'attendance-evidence' or public.attendance_sheet_object_allowed(name,'read'));
create policy m17_sheet_insert_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'attendance-evidence' or public.attendance_sheet_object_allowed(name,'insert'));
create policy m17_sheet_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'attendance-evidence' or public.attendance_sheet_object_allowed(name,'delete'));
create policy m17_sheet_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>'attendance-evidence') with check(bucket_id<>'attendance-evidence');
create policy m17_sheet_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'attendance-evidence') with check(bucket_id<>'attendance-evidence');

create function public.check_manual_session(p_intern uuid,p_in timestamptz,p_out timestamptz,p_exclude uuid) returns void
language plpgsql set search_path=pg_catalog,public as $$
begin
 if p_in is null or p_out is null or not isfinite(p_in) or not isfinite(p_out) or p_out<=p_in then raise exception 'Both timestamps are required; Time Out must follow Time In with an explicit end date'; end if;
 if p_out-p_in>interval '16 hours' then raise exception 'Existing attendance limit: a session must be at most 16 hours'; end if;
 if p_in>clock_timestamp() or p_out>clock_timestamp() then raise exception 'Future attendance is not permitted'; end if;
 if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and time_out is null) then raise exception 'Open online attendance conflicts; manual entry cannot close or replace it'; end if;
 if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and clocked_in_at=p_in and clocked_out_at=p_out) then raise exception 'Exact duplicate attendance session'; end if;
 if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and clocked_in_at<p_out and clocked_out_at>p_in) then raise exception 'Attendance overlaps an existing online or manual session'; end if;
 if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and log_date=(p_in at time zone 'Asia/Manila')::date) then raise exception 'Existing model allows one session per Intern per Manila start date; this date already has attendance'; end if;
end $$;
create function public.manual_attendance_details(p_intern uuid,p_evidence uuid,p_details jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_sheet_evidence; company_name text; key text;
begin
 if public.current_role() is distinct from 'instructor' or not public.assigned_intern(p_intern)
 or not exists(select 1 from public.profiles where id=p_intern and role='intern' and status='Active') then raise exception 'Assigned Active Intern and OJT Coordinator required' using errcode='42501'; end if;
 select * into e from public.attendance_sheet_evidence where id=p_evidence for update;
 if not found or not public.can_read_attendance_sheet(e.id) or not p_intern=any(e.participant_ids) or not public.manual_company_allowed(p_intern,e.company_id) then raise exception 'Authorized evidence for this Intern/company required' using errcode='42501'; end if;
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
create function public.record_manual_attendance(p_id uuid,p_intern uuid,p_in timestamptz,p_out timestamptz,p_evidence uuid,p_details jsonb) returns public.attendance_logs
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.attendance_logs; details jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 perform pg_advisory_xact_lock(hashtextextended(p_intern::text,101));
 perform 1 from public.interns where id=p_intern for share;
 perform 1 from public.profiles where id in (auth.uid(),p_intern) for share;
 details:=public.manual_attendance_details(p_intern,p_evidence,p_details);
 if p_id is null then raise exception 'Attendance retry identity required'; end if;
 select * into r from public.attendance_logs where id=p_id for update;
 if found then
  if r.attendance_source='manual_company_sheet' and r.encoded_by=auth.uid() and r.intern_id=p_intern and r.clocked_in_at=p_in and r.clocked_out_at=p_out and r.manual_evidence_id=p_evidence and (r.manual_details-'registered_company_name')=(details-'registered_company_name') then return r; end if;
  raise exception 'Attendance identity already used or revised; refresh';
 end if;
 perform public.check_manual_session(p_intern,p_in,p_out,null);
 insert into public.attendance_logs(id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,attendance_source,manual_evidence_id,manual_details,manual_revision,encoded_by,encoded_at)
 values(p_id,p_intern,(p_in at time zone 'Asia/Manila')::date,(p_in at time zone 'Asia/Manila')::time,(p_out at time zone 'Asia/Manila')::time,p_in,p_out,extract(epoch from p_out-p_in)/3600,false,'manual_company_sheet',p_evidence,details,1,auth.uid(),clock_timestamp()) returning * into r;
 update public.attendance_sheet_evidence set committed_at=coalesce(committed_at,clock_timestamp()) where id=p_evidence;
 return r;
end $$;
create function public.revise_manual_attendance(p_id uuid,p_revision integer,p_in timestamptz,p_out timestamptz,p_evidence uuid,p_details jsonb,p_reason text) returns public.attendance_logs
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.attendance_logs; details jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.attendance_logs where id=p_id;
 if not found or not public.assigned_intern(r.intern_id) or public.current_role() is distinct from 'instructor' then raise exception 'Assigned OJT Coordinator required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));
 perform 1 from public.interns where id=r.intern_id for share;
 select * into r from public.attendance_logs where id=p_id for update;
 details:=public.manual_attendance_details(r.intern_id,p_evidence,p_details);
 if details->'company_id'=r.manual_details->'company_id' then
  details:=details||jsonb_build_object('registered_company_name',r.manual_details->>'registered_company_name');
 end if;
 if r.attendance_source<>'manual_company_sheet' or r.verified then raise exception 'Only unverified manual attendance may be revised'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 500 or p_reason!~'[[:alpha:]]' then raise exception 'Meaningful 10-500 character revision reason required'; end if;
 if r.manual_revision=p_revision+1 and r.clocked_in_at=p_in and r.clocked_out_at=p_out and r.manual_evidence_id=p_evidence and r.manual_details=details and r.revision_reason=p_reason and r.revised_by=auth.uid() then return r; end if;
 if r.manual_revision is distinct from p_revision then raise exception 'Attendance revision changed; refresh' using errcode='40001'; end if;
 perform public.check_manual_session(r.intern_id,p_in,p_out,r.id);
 update public.attendance_logs set log_date=(p_in at time zone 'Asia/Manila')::date,time_in=(p_in at time zone 'Asia/Manila')::time,time_out=(p_out at time zone 'Asia/Manila')::time,
 clocked_in_at=p_in,clocked_out_at=p_out,hours=extract(epoch from p_out-p_in)/3600,manual_evidence_id=p_evidence,manual_details=details,
 manual_revision=manual_revision+1,revised_by=auth.uid(),revised_at=clock_timestamp(),revision_reason=p_reason where id=p_id returning * into r;
 update public.attendance_sheet_evidence set committed_at=coalesce(committed_at,clock_timestamp()) where id=p_evidence;
 return r;
end $$;

create function public.guard_manual_attendance() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then if old.attendance_source='manual_company_sheet' then raise exception 'Manual attendance and evidence history must be preserved'; end if; return old; end if;
 if tg_op='UPDATE' and old.attendance_source='manual_company_sheet' then
  if old.verified and new is distinct from old then raise exception 'Verified manual attendance is immutable'; end if;
  if new.id<>old.id or new.intern_id<>old.intern_id or new.attendance_source<>old.attendance_source or new.encoded_by<>old.encoded_by or new.encoded_at<>old.encoded_at then raise exception 'Manual attendance identities and original encoding provenance are immutable'; end if;
  if new.verified and not old.verified then
   if (to_jsonb(new)-array['verified','verified_by','verified_at']) is distinct from (to_jsonb(old)-array['verified','verified_by','verified_at']) then raise exception 'Verification cannot alter encoded attendance'; end if;
   new.verified_at:=clock_timestamp();
  end if;
 end if;
 return new;
end $$;
create trigger m17_manual_guard before update or delete on public.attendance_logs for each row execute function public.guard_manual_attendance();
create function public.write_manual_attendance_event() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.attendance_source='manual_company_sheet' and (tg_op='INSERT' or new is distinct from old) then
  insert into public.manual_attendance_events(attendance_id,intern_id,actor_id,event_kind,before_values,after_values,created_at)
  values(new.id,new.intern_id,auth.uid(),case when tg_op='INSERT' then 'created' when new.verified and not old.verified then 'verified' else 'revised' end,
  case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new),clock_timestamp());
 end if;
 return new;
end $$;
create trigger m17_manual_events after insert or update on public.attendance_logs for each row execute function public.write_manual_attendance_event();
create function public.guard_manual_history() returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin raise exception 'Manual attendance history is immutable'; end $$;
create trigger m17_history_immutable before update or delete on public.manual_attendance_events for each row execute function public.guard_manual_history();
create trigger m17_evidence_audit after insert or update or delete on public.attendance_sheet_evidence for each row execute function public.write_trusted_audit();
create trigger m17_event_audit after insert on public.manual_attendance_events for each row execute function public.write_trusted_audit();
create function public.guard_attendance_sheet_history() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then raise exception 'Retain sheet reservation/history; clean abandoned bytes through Storage API'; end if;
 if old.committed_at is not null and new is distinct from old then raise exception 'Committed attendance evidence is immutable'; end if;
 if (to_jsonb(new)-array['ready_at','committed_at','abandoned_at']) is distinct from (to_jsonb(old)-array['ready_at','committed_at','abandoned_at']) then raise exception 'Sheet upload identity and participants are immutable'; end if;
 return new;
end $$;
create trigger m17_sheet_history before update or delete on public.attendance_sheet_evidence for each row execute function public.guard_attendance_sheet_history();
revoke all on function public.guard_attendance_sheet_history() from public,anon,authenticated;

-- Copy the reviewed verification body to a private core without renaming the
-- existing RPC identity (dependent clients keep their original signature).
-- M17_VERIFY_CORE_BEGIN
create function public.verify_attendance_core(p_id uuid,p_expected_in timestamptz,p_expected_out timestamptz)
returns public.attendance_logs language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.attendance_logs;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.attendance_logs where id=p_id;
 if not found or not public.can_review(r.intern_id) then raise exception 'Assigned active staff required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));
 perform 1 from public.profiles where id=auth.uid() for share;
 perform 1 from public.interns where id=r.intern_id for share;
 select * into r from public.attendance_logs where id=p_id for update;
 if not found or not public.can_review(r.intern_id) or not exists(select 1 from public.profiles where id=r.intern_id and role='intern') then raise exception 'Assignment or account changed; refresh' using errcode='42501'; end if;
 if p_expected_in is null or p_expected_out is null or r.clocked_in_at is distinct from p_expected_in or r.clocked_out_at is distinct from p_expected_out then raise exception 'Attendance changed; refresh before reviewing' using errcode='40001'; end if;
 if r.time_in is null or r.time_out is null or r.hours is null
 or r.log_date is distinct from (r.clocked_in_at at time zone 'Asia/Manila')::date
 or r.time_in is distinct from (r.clocked_in_at at time zone 'Asia/Manila')::time
 or r.time_out is distinct from (r.clocked_out_at at time zone 'Asia/Manila')::time
 or r.clocked_out_at<=r.clocked_in_at or r.clocked_out_at-r.clocked_in_at>interval '16 hours'
 or r.clocked_out_at>clock_timestamp() or r.hours is distinct from extract(epoch from r.clocked_out_at-r.clocked_in_at)/3600
 or (r.verified and r.verified_by is null) or (not r.verified and r.verified_by is not null) then raise exception 'Closed trustworthy attendance required; legacy or invalid evidence requires authorized review'; end if;
 if r.verified then return r; end if;
 update public.attendance_logs set verified=true,verified_by=auth.uid() where id=p_id returning * into r;
 return r;
end $$;
-- M17_VERIFY_CORE_END
create or replace function public.verify_attendance(p_id uuid,p_expected_in timestamptz,p_expected_out timestamptz) returns public.attendance_logs
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.attendance_logs where id=p_id and attendance_source='manual_company_sheet') then raise exception 'Review signed sheet using explicit manual attendance verification'; end if;
 return public.verify_attendance_core(p_id,p_expected_in,p_expected_out);
end $$;
create function public.verify_manual_attendance(p_id uuid,p_revision integer,p_evidence uuid,p_expected_in timestamptz,p_expected_out timestamptz,p_reviewed boolean) returns public.attendance_logs
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.attendance_logs;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.attendance_logs where id=p_id for update;
 if not found or not public.can_review(r.intern_id) or not public.can_read_attendance_sheet(r.manual_evidence_id) then raise exception 'Authorized attendance/evidence review required' using errcode='42501'; end if;
 if p_reviewed is distinct from true or r.attendance_source<>'manual_company_sheet' or r.manual_revision is distinct from p_revision or r.manual_evidence_id is distinct from p_evidence then raise exception 'Review current encoded session, evidence and signatures before explicit verification'; end if;
 if not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path
 where e.id=p_evidence and e.committed_at is not null and e.abandoned_at is null and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size) then raise exception 'Preserved evidence unavailable; verification blocked'; end if;
 return public.verify_attendance_core(p_id,p_expected_in,p_expected_out);
end $$;

revoke all on function public.manual_company_allowed(uuid,uuid),public.can_read_attendance_sheet(uuid),public.attendance_sheet_context(uuid),public.stage_attendance_sheet(uuid,uuid,uuid[],text,text,bigint),public.finish_attendance_sheet(uuid),public.cancel_attendance_sheet(uuid),public.attendance_sheet_object_allowed(text,text),public.attendance_sheet_access(uuid),public.check_manual_session(uuid,timestamptz,timestamptz,uuid),public.manual_attendance_details(uuid,uuid,jsonb),public.record_manual_attendance(uuid,uuid,timestamptz,timestamptz,uuid,jsonb),public.revise_manual_attendance(uuid,integer,timestamptz,timestamptz,uuid,jsonb,text),public.guard_manual_attendance(),public.write_manual_attendance_event(),public.guard_manual_history(),public.verify_attendance_core(uuid,timestamptz,timestamptz),public.verify_manual_attendance(uuid,integer,uuid,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.can_read_attendance_sheet(uuid),public.attendance_sheet_context(uuid),public.stage_attendance_sheet(uuid,uuid,uuid[],text,text,bigint),public.finish_attendance_sheet(uuid),public.cancel_attendance_sheet(uuid),public.attendance_sheet_object_allowed(text,text),public.attendance_sheet_access(uuid),public.record_manual_attendance(uuid,uuid,timestamptz,timestamptz,uuid,jsonb),public.revise_manual_attendance(uuid,integer,timestamptz,timestamptz,uuid,jsonb,text),public.verify_manual_attendance(uuid,integer,uuid,timestamptz,timestamptz,boolean) to authenticated;
notify pgrst,'reload schema';
commit;

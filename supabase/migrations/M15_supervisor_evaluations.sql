-- Additive upgrade after M01-M14. No live execution, reset, or historical rewrite.
-- Review catalog using inspection/07_supervisor_workflow.sql before application.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(404,1);
do $$ begin
 if exists(select 1 from pg_class where oid in ('public.profiles'::regclass,'public.interns'::regclass,'public.evaluations'::regclass,'public.attendance_exceptions'::regclass) and relowner<>'postgres'::regrole)
 or exists(select 1 from pg_proc where oid in (to_regprocedure('public.current_role()'),to_regprocedure('public.can_review(uuid)'),to_regprocedure('public.admin_update_account(uuid,jsonb)'),to_regprocedure('public.write_trusted_audit()')) and proowner<>'postgres'::regrole)
 then raise exception 'Inspect unexpected M15 authority owners before upgrading'; end if;
 if current_user<>'postgres' or to_regprocedure('public.guard_last_active_admin()') is null
 or to_regprocedure('public.verify_attendance(uuid,timestamptz,timestamptz)') is null
 then raise exception 'M15 requires trusted postgres and M01-M14 final contracts'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass
 and tgname='m14_last_active_admin' and tgfoid='public.guard_last_active_admin()'::regprocedure and tgenabled in ('O','A'))
 then raise exception 'M15 requires the enabled last Active Admin guard; inspect drift'; end if;
end $$;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('intern','instructor','admin','supervisor'));
alter table public.profiles add column supervisor_company_id uuid references public.companies(id);

create table public.supervisor_assignments (
 id uuid primary key default gen_random_uuid(), supervisor_id uuid not null references public.profiles(id),
 intern_id uuid not null references public.interns(id), company_id uuid not null references public.companies(id),
 assigned_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 ended_at timestamptz, ended_by uuid references public.profiles(id),
 check((ended_at is null)=(ended_by is null))
);
create unique index m15_current_supervision on public.supervisor_assignments(supervisor_id,intern_id) where ended_at is null;
create table public.supervisor_evaluations (
 id uuid primary key, supervisor_id uuid not null references public.profiles(id), intern_id uuid not null references public.interns(id),
 company_id uuid not null references public.companies(id), assignment_id uuid not null references public.supervisor_assignments(id),
 coordinator_id uuid references public.profiles(id), evaluation_date date not null,
 rubric jsonb not null default '{"punctuality":25,"performance":35,"conduct":20,"communication":20}',
 criteria jsonb not null default '{}', overall_score integer, feedback text not null default '' check(length(feedback)<=2000),
 status text not null default 'Supervisor Draft' check(status in ('Supervisor Draft','Submitted to Coordinator')),
 version integer not null default 1 check(version>0), submitted_at timestamptz, created_at timestamptz not null default now(),
 check(status='Supervisor Draft' or (submitted_at is not null and coordinator_id is not null and public.rubric_score(criteria) is not null and overall_score=public.rubric_score(criteria))),
 unique(id,version)
);
create table public.evaluation_reviews (
 id uuid primary key references public.supervisor_evaluations(id), coordinator_id uuid not null references public.profiles(id),
 source_version integer not null, revision integer not null default 0,
 summary text not null default '' check(length(summary)<=2000), strengths text not null default '' check(length(strengths)<=2000),
 improvements text not null default '' check(length(improvements)<=2000), guidance text not null default '' check(length(guidance)<=2000),
 criteria jsonb not null, adjustment_reason text not null default '' check(length(adjustment_reason)<=2000),
 status text not null default 'Submitted to Coordinator' check(status in ('Submitted to Coordinator','Coordinator Draft','Published to Intern')),
 final_evaluation_id uuid unique references public.evaluations(id), created_at timestamptz not null default now(),
 foreign key(id,source_version) references public.supervisor_evaluations(id,version)
);
create table public.evaluation_routing_events (
 id uuid primary key default gen_random_uuid(), source_id uuid not null references public.supervisor_evaluations(id),
 previous_coordinator_id uuid not null references public.profiles(id), coordinator_id uuid not null references public.profiles(id),
 actor_id uuid not null references public.profiles(id), reason text not null check(length(btrim(reason)) between 1 and 2000),
 created_at timestamptz not null default now()
);
alter table public.evaluations add column source_evaluation_id uuid unique references public.supervisor_evaluations(id);
alter table public.evaluations add column source_version integer;
alter table public.evaluations add column provenance text not null default 'legacy_coordinator' check(provenance in ('legacy_coordinator','supervisor_review'));
alter table public.evaluations add column strengths text;
alter table public.evaluations add column improvements text;
alter table public.evaluations add column guidance text;
alter table public.evaluations add column evaluation_date date;
alter table public.evaluations add constraint m15_source_reference check(
 (provenance='legacy_coordinator' and source_evaluation_id is null and source_version is null) or
 (provenance='supervisor_review' and source_evaluation_id is not null and source_version is not null));
alter table public.evaluations add constraint m15_final_source_version foreign key(source_evaluation_id,source_version) references public.supervisor_evaluations(id,version);

create function public.supervises_intern(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(public.current_role()='supervisor' and exists(
 select 1 from public.supervisor_assignments a join public.interns i on i.id=a.intern_id
 join public.profiles p on p.id=i.id join public.profiles s on s.id=a.supervisor_id
 where a.supervisor_id=auth.uid() and a.intern_id=p_id and a.ended_at is null
 and a.company_id=i.company_id and a.company_id=s.supervisor_company_id and p.role='intern' and p.status='Active'),false)
$$;
-- Minimum directory via RPC; no Supervisor access added to profiles/interns RLS.
create function public.supervisor_roster(p_after uuid default null,p_size integer default 500) returns table(id uuid,full_name text,student_id text,company_id uuid) language sql stable security definer set search_path=pg_catalog,public as $$
 select i.id,p.full_name,p.student_id,i.company_id from public.interns i join public.profiles p on p.id=i.id where public.supervises_intern(i.id) and (p_after is null or i.id>p_after) order by i.id limit greatest(1,least(coalesce(p_size,500),500))
$$;
create function public.can_review_source(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_admin() or exists(select 1 from public.evaluation_reviews r join public.supervisor_evaluations s on s.id=r.id
 join public.interns i on i.id=s.intern_id join public.profiles p on p.id=i.id
 where r.id=p_id and s.status='Submitted to Coordinator' and r.coordinator_id=auth.uid() and public.assigned_intern(s.intern_id)
 and i.company_id=s.company_id and p.role='intern' and p.status='Active')
$$;
create function public.guard_supervision_relationships() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.supervisor_assignments a join public.profiles s on s.id=a.supervisor_id
 join public.interns i on i.id=a.intern_id join public.profiles p on p.id=i.id
 where a.ended_at is null and (s.role<>'supervisor' or s.status<>'Active' or p.role<>'intern' or p.status<>'Active'
 or s.supervisor_company_id is distinct from a.company_id or i.company_id is distinct from a.company_id))
 then raise exception 'End affected Supervisor assignments before changing role, status or company'; end if;
 if exists(select 1 from public.profiles where role='supervisor' and supervisor_company_id is null)
 then raise exception 'Supervisor company required'; end if;
 return new;
end $$;
create constraint trigger m15_profile_relationship after insert or update on public.profiles deferrable initially deferred for each row execute function public.guard_supervision_relationships();
create constraint trigger m15_intern_relationship after insert or update on public.interns deferrable initially deferred for each row execute function public.guard_supervision_relationships();
create constraint trigger m15_assignment_relationship after insert or update on public.supervisor_assignments deferrable initially deferred for each row execute function public.guard_supervision_relationships();

create function public.admin_set_supervision(p_supervisor_id uuid,p_intern_id uuid,p_assigned boolean) returns public.supervisor_assignments language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.supervisor_assignments; company uuid;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 if p_assigned is null then raise exception 'Assignment decision required'; end if;
 select * into r from public.supervisor_assignments where supervisor_id=p_supervisor_id and intern_id=p_intern_id and ended_at is null;
 if not p_assigned then
  if not found then raise exception 'Current assignment not found; refresh'; end if;
  update public.supervisor_assignments set ended_at=clock_timestamp(),ended_by=auth.uid() where id=r.id returning * into r; return r;
 end if;
 select supervisor_company_id into company from public.profiles where id=p_supervisor_id and role='supervisor' and status='Active';
 if company is null or not exists(select 1 from public.interns i join public.profiles p on p.id=i.id
 where i.id=p_intern_id and i.company_id=company and p.role='intern' and p.status='Active')
 or not exists(select 1 from public.companies where id=company and archived_at is null)
 then raise exception 'Active Supervisor and Intern in the same available company required'; end if;
 if r.id is not null then return r; end if;
 insert into public.supervisor_assignments(supervisor_id,intern_id,company_id,assigned_by) values(p_supervisor_id,p_intern_id,company,auth.uid()) returning * into r; return r;
end $$;

create function public.save_supervisor_evaluation(p_id uuid,p_intern_id uuid,p_date date,p_criteria jsonb,p_feedback text,p_expected_version integer,p_submit boolean default false)
returns public.supervisor_evaluations language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.supervisor_evaluations; a public.supervisor_assignments; coordinator uuid; score integer; criterion text; rating numeric;
begin
 perform pg_advisory_xact_lock(404,1);
 if public.current_role() is distinct from 'supervisor' then raise exception 'Active Supervisor required' using errcode='42501'; end if;
 if p_id is null or p_date is null or p_criteria is null or p_feedback is null or length(p_feedback)>2000 or p_submit is null then raise exception 'Evaluation date, ratings and feedback required'; end if;
 if jsonb_typeof(p_criteria) is distinct from 'object' then raise exception 'Draft ratings must be an object'; end if;
 for criterion in select jsonb_object_keys(p_criteria) loop
  if criterion not in ('punctuality','performance','conduct','communication') or jsonb_typeof(p_criteria->criterion) is distinct from 'number'
  then raise exception 'Use only the four rubric criteria with integer ratings 1 to 5'; end if;
  rating:=(p_criteria->>criterion)::numeric;
  if rating<1 or rating>5 or rating<>trunc(rating) then raise exception 'Integer ratings 1 to 5 required'; end if;
 end loop;
 select * into r from public.supervisor_evaluations where id=p_id for update;
 if found and (r.supervisor_id<>auth.uid() or r.intern_id<>p_intern_id) then raise exception 'Evaluation ownership mismatch' using errcode='42501'; end if;
 -- Exact retry returns the frozen submission, even if the assignment later ends.
 if r.status='Submitted to Coordinator' then
  if p_submit and r.evaluation_date=p_date and r.criteria=p_criteria and r.feedback=p_feedback then return r; end if;
  raise exception 'Submitted evaluation is immutable';
 end if;
 if not public.supervises_intern(p_intern_id) then raise exception 'Current assigned Intern required' using errcode='42501'; end if;
 select * into a from public.supervisor_assignments where supervisor_id=auth.uid() and intern_id=p_intern_id and ended_at is null;
 if r.id is not null and (r.version is distinct from p_expected_version or r.company_id<>a.company_id or r.assignment_id<>a.id) then raise exception 'Draft version or assignment changed; refresh' using errcode='40001'; end if;
 if r.id is null and p_expected_version is distinct from 0 then raise exception 'New draft expects version zero'; end if;
 score:=public.rubric_score(p_criteria);
 if p_submit then
  if score is null then raise exception 'Complete four integer ratings from 1 to 5'; end if;
  select i.instructor_id into coordinator from public.interns i join public.profiles p on p.id=i.instructor_id
  where i.id=p_intern_id and p.role='instructor' and p.status='Active';
  if coordinator is null then raise exception 'No eligible assigned OJT Coordinator. Ask Admin to assign an Active Coordinator before submission.'; end if;
 end if;
 if r.id is null then
  insert into public.supervisor_evaluations(id,supervisor_id,intern_id,company_id,assignment_id,evaluation_date)
  values(p_id,auth.uid(),p_intern_id,a.company_id,a.id,p_date) returning * into r;
 end if;
 update public.supervisor_evaluations set criteria=p_criteria,feedback=p_feedback,evaluation_date=p_date,overall_score=score,
 version=version+1,status=case when p_submit then 'Submitted to Coordinator' else 'Supervisor Draft' end,
 submitted_at=case when p_submit then clock_timestamp() else null end,coordinator_id=coordinator where id=p_id returning * into r;
 if p_submit then insert into public.evaluation_reviews(id,coordinator_id,source_version,criteria) values(r.id,coordinator,r.version,r.criteria); end if;
 return r;
end $$;
create function public.save_evaluation_review(p_id uuid,p_expected_revision integer,p_summary text,p_strengths text,p_improvements text,p_guidance text,p_criteria jsonb,p_reason text,p_publish boolean default false)
returns public.evaluation_reviews language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.evaluation_reviews; s public.supervisor_evaluations; final public.evaluations; score integer;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.evaluation_reviews where id=p_id for update;
 if not found or public.current_role() is distinct from 'instructor' or r.coordinator_id<>auth.uid() or not public.can_review_source(p_id)
 then raise exception 'Routed evaluation for current assigned Intern required' using errcode='42501'; end if;
 select * into s from public.supervisor_evaluations where id=p_id;
 if r.status='Published to Intern' then
  if p_publish and r.summary=p_summary and r.strengths=p_strengths and r.improvements=p_improvements and r.guidance=p_guidance and r.criteria=p_criteria and r.adjustment_reason=p_reason then return r; end if;
  raise exception 'Published evaluation is immutable';
 end if;
 if r.revision is distinct from p_expected_revision then raise exception 'Review changed; refresh' using errcode='40001'; end if;
 score:=public.rubric_score(p_criteria);
 if score is null or p_publish is null or p_summary is null or p_strengths is null or p_improvements is null or p_guidance is null or p_reason is null then raise exception 'Complete valid ratings and review fields'; end if;
 if p_criteria<>s.criteria and nullif(btrim(p_reason),'') is null then raise exception 'Explain changes to original ratings'; end if;
 if p_publish and nullif(btrim(p_summary),'') is null then raise exception 'Student-facing summary required to publish'; end if;
 update public.evaluation_reviews set summary=p_summary,strengths=p_strengths,improvements=p_improvements,guidance=p_guidance,
 criteria=p_criteria,adjustment_reason=p_reason,revision=revision+1,status='Coordinator Draft' where id=p_id returning * into r;
 if p_publish then
  insert into public.evaluations(intern_id,evaluator_id,competencies,overall_score,feedback,source_evaluation_id,source_version,provenance,strengths,improvements,guidance,evaluation_date,submission_id)
  values(s.intern_id,auth.uid(),r.criteria,score,r.summary,s.id,s.version,'supervisor_review',r.strengths,r.improvements,r.guidance,s.evaluation_date,s.id) returning * into final;
  update public.evaluation_reviews set status='Published to Intern',final_evaluation_id=final.id where id=p_id returning * into r;
 end if;
 return r;
end $$;
create function public.admin_reroute_evaluation(p_id uuid,p_coordinator_id uuid,p_reason text,p_expected_revision integer) returns public.evaluation_reviews language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.evaluation_reviews; s public.supervisor_evaluations;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 select * into r from public.evaluation_reviews where id=p_id for update;
 select * into s from public.supervisor_evaluations where id=p_id;
 if r.id is null or r.status='Published to Intern' or r.revision is distinct from p_expected_revision then raise exception 'Unpublished current review required'; end if;
 if not exists(select 1 from public.interns i join public.profiles p on p.id=i.instructor_id join public.profiles student on student.id=i.id
 where i.id=s.intern_id and i.company_id=s.company_id and i.instructor_id=p_coordinator_id and p.role='instructor' and p.status='Active' and student.role='intern' and student.status='Active')
 then raise exception 'Current eligible Coordinator and original company required'; end if;
 insert into public.evaluation_routing_events(source_id,previous_coordinator_id,coordinator_id,actor_id,reason) values(p_id,r.coordinator_id,p_coordinator_id,auth.uid(),p_reason);
 update public.evaluation_reviews set coordinator_id=p_coordinator_id,revision=revision+1,summary='',strengths='',improvements='',guidance='',criteria=s.criteria,adjustment_reason='',status='Submitted to Coordinator' where id=p_id returning * into r;
 return r;
end $$;

create function public.guard_frozen_evaluation() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' or tg_table_name='evaluations' then raise exception 'Evaluation history is immutable'; end if;
 if old.status='Submitted to Coordinator' then raise exception 'Evaluation history is immutable'; end if;
 if new.id<>old.id or new.supervisor_id<>old.supervisor_id or new.intern_id<>old.intern_id or new.company_id<>old.company_id or new.assignment_id<>old.assignment_id or new.rubric<>old.rubric then raise exception 'Source identity is immutable'; end if;
 return new;
end $$;
create trigger m15_frozen_source before update or delete on public.supervisor_evaluations for each row execute function public.guard_frozen_evaluation();
create trigger m15_frozen_final before update or delete on public.evaluations for each row execute function public.guard_frozen_evaluation();

do $$ declare t text; begin
 foreach t in array array['supervisor_assignments','supervisor_evaluations','evaluation_reviews','evaluation_routing_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create trigger m15_audit after insert or update or delete on public.%I for each row execute function public.write_trusted_audit()',t);
 end loop;
end $$;
create policy m15_assignment_read on public.supervisor_assignments for select to authenticated using(public.is_admin() or (public.current_role()='supervisor' and supervisor_id=auth.uid()));
create policy m15_source_read on public.supervisor_evaluations for select to authenticated using(public.is_admin() or (public.current_role()='supervisor' and supervisor_id=auth.uid()) or (status='Submitted to Coordinator' and public.can_review_source(id)));
create policy m15_review_read on public.evaluation_reviews for select to authenticated using(public.can_review_source(id));
create policy m15_company_scope on public.companies as restrictive for select to authenticated using(public.current_role()<>'supervisor' or id=(select supervisor_company_id from public.profiles where id=auth.uid()));
create policy m15_section_scope on public.course_sections as restrictive for select to authenticated using(public.current_role()<>'supervisor');
create policy m15_year_scope on public.academic_years as restrictive for select to authenticated using(public.current_role()<>'supervisor');
create policy m15_announcement_scope on public.announcements as restrictive for select to authenticated using(public.current_role() in ('admin','instructor','intern'));
create policy m15_route_read on public.evaluation_routing_events for select to authenticated using(public.is_admin());
-- Restrictive guard survives an extra permissive policy, keeping private tables private.
create policy m15_source_boundary on public.supervisor_evaluations as restrictive for select to authenticated using(public.is_admin() or (public.current_role()='supervisor' and supervisor_id=auth.uid()) or (status='Submitted to Coordinator' and public.can_review_source(id)));
create policy m15_review_boundary on public.evaluation_reviews as restrictive for select to authenticated using(public.can_review_source(id));

create or replace function public.admin_update_account(p_id uuid,p_patch jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
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
 if next_role is null or next_role not in ('intern','instructor','admin','supervisor') or next_status is null or next_status not in ('Pending','Inactive','Active')
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
 elsif next_role='supervisor' then
   if not exists(select 1 from public.companies where id=coalesce((p_patch->>'company_id')::uuid,p.supervisor_company_id) and archived_at is null) then raise exception 'Select an available Supervisor company'; end if;
 elsif p_patch?'company_id' then raise exception 'Company applies to Intern or Supervisor accounts'; end if;
 update public.profiles set full_name=case when p_patch?'full_name' then btrim(p_patch->>'full_name') else full_name end,
   role=next_role,status=next_status,supervisor_company_id=case when next_role='supervisor' then case when p_patch?'company_id' then (p_patch->>'company_id')::uuid else supervisor_company_id end else null end where id=p_id returning * into p;
 select * into i from public.interns where id=p_id;
 -- Deferred triggers also enforce trusted SQL changes; errors still abort RPC.
 return jsonb_build_object('id',p.id,'profile',to_jsonb(p),'intern',case when i.id is null then null else to_jsonb(i) end);
end $$;

-- Retain internal timestamp validators, audit/attendance triggers and historical reads.
revoke all on function public.submit_correction(date,time,time,date,text),public.review_exception(uuid,text,text),public.review_exceptions(uuid[],text,text),public.submit_evaluation(uuid,jsonb,text,uuid) from public,anon,authenticated;
revoke insert,update,delete,truncate on public.attendance_exceptions from public,anon,authenticated;
do $$ declare c record; begin
 for c in select attname from pg_attribute where attrelid='public.attendance_exceptions'::regclass and attnum>0 and not attisdropped loop
 execute format('revoke insert(%I),update(%I),references(%I) on public.attendance_exceptions from public,anon,authenticated',c.attname,c.attname,c.attname); end loop;
end $$;
revoke all on function public.supervises_intern(uuid),public.supervisor_roster(uuid,integer),public.can_review_source(uuid),public.guard_supervision_relationships(),public.admin_set_supervision(uuid,uuid,boolean),public.save_supervisor_evaluation(uuid,uuid,date,jsonb,text,integer,boolean),public.save_evaluation_review(uuid,integer,text,text,text,text,jsonb,text,boolean),public.admin_reroute_evaluation(uuid,uuid,text,integer),public.guard_frozen_evaluation() from public,anon,authenticated;
grant execute on function public.supervises_intern(uuid),public.supervisor_roster(uuid,integer),public.can_review_source(uuid),public.admin_set_supervision(uuid,uuid,boolean),public.save_supervisor_evaluation(uuid,uuid,date,jsonb,text,integer,boolean),public.save_evaluation_review(uuid,integer,text,text,text,text,jsonb,text,boolean),public.admin_reroute_evaluation(uuid,uuid,text,integer) to authenticated;
create or replace function public.admin_master_impact(p_table text,p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb; refs bigint;
begin
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 if p_table not in ('companies','course_sections','academic_years') or p_table is null then raise exception 'Unsupported master table'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',p_table) into r using p_id;
 if r is null then raise exception 'Entry missing; refresh' using errcode='40001'; end if;
 if p_table='companies' then select (select count(*) from public.interns where company_id=p_id)+(select count(*) from public.profiles where supervisor_company_id=p_id)+(select count(*) from public.supervisor_assignments where company_id=p_id)+(select count(*) from public.supervisor_evaluations where company_id=p_id) into refs;
 elsif p_table='course_sections' then select count(*) into refs from public.interns where section_id=p_id;
 else refs:=0; end if;
 return jsonb_build_object('id',p_id,'entry',r,'references',refs,'can_archive',r->>'archived_at' is null and coalesce((r->>'is_current')::boolean,false)=false);
end $$;

notify pgrst,'reload schema';
commit;

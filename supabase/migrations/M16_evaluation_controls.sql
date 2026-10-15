-- Additive follow-up to M15: explicit selectable feedback and per-criterion reasons.
-- No data backfill, reset, historical conversion, or live execution.
begin;
select pg_advisory_xact_lock(404,1);
do $$ begin
 if current_user<>'postgres' or to_regprocedure('public.can_review_source(uuid)') is null
 or to_regprocedure('public.save_evaluation_review(uuid,integer,text,text,text,text,jsonb,text,boolean)') is null
 then raise exception 'M16 requires trusted postgres and reviewed M15'; end if;
 if exists(select 1 from pg_class where oid='public.evaluation_reviews'::regclass and relowner<>'postgres'::regrole)
 then raise exception 'Inspect M16 review ownership drift'; end if;
end $$;
alter table public.evaluation_reviews add column feedback_mode text check(feedback_mode in ('selected','written'));
alter table public.evaluation_reviews add column feedback_catalog_version integer not null default 1 check(feedback_catalog_version=1);
alter table public.evaluation_reviews add column feedback_choices jsonb;
alter table public.evaluation_reviews add column additional_remarks text not null default '' check(length(additional_remarks)<=1000);
alter table public.evaluation_reviews add column written_feedback jsonb;
alter table public.evaluation_reviews add column adjustment_reasons jsonb not null default '{}' check(jsonb_typeof(adjustment_reasons)='object');
alter table public.evaluation_reviews add column legacy_adjustment_reason text;
create table public.evaluation_adjustment_events (
 id uuid primary key default gen_random_uuid(), source_id uuid not null,
 source_version integer not null, review_revision integer not null,
 criterion text not null check(criterion in ('punctuality','performance','conduct','communication')),
 original_rating integer not null check(original_rating between 1 and 5),
 final_rating integer not null check(final_rating>=1 and final_rating<=5 and final_rating<>original_rating),
 reason_code text not null, reason_text text not null check(length(reason_text) between 1 and 500),
 coordinator_id uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 foreign key(source_id,source_version) references public.supervisor_evaluations(id,version),
 unique(source_id,review_revision,criterion)
);
alter table public.evaluation_adjustment_events enable row level security;
revoke all on public.evaluation_adjustment_events from public,anon,authenticated;
grant select on public.evaluation_adjustment_events to authenticated;
create policy m16_adjustments_read on public.evaluation_adjustment_events for select to authenticated
using(public.is_admin() or (coordinator_id=auth.uid() and public.can_review_source(source_id)));
create policy m16_adjustments_boundary on public.evaluation_adjustment_events as restrictive for select to authenticated
using(public.is_admin() or (coordinator_id=auth.uid() and public.can_review_source(source_id)));
create trigger m16_adjustment_audit after insert on public.evaluation_adjustment_events for each row execute function public.write_trusted_audit();
create function public.guard_evaluation_adjustment_event() returns trigger
language plpgsql set search_path=pg_catalog,public as $$ begin raise exception 'Adjustment history is immutable'; end $$;
revoke all on function public.guard_evaluation_adjustment_event() from public,anon,authenticated;
create trigger m16_adjustment_immutable before update or delete on public.evaluation_adjustment_events for each row execute function public.guard_evaluation_adjustment_event();

-- The committed client catalog is mirrored here and checked in native tests.
create function public.evaluation_feedback_catalog() returns jsonb
language sql immutable set search_path=pg_catalog,public as $$
 select $catalog${"version":1,"groups":{"strengths":[{"id":"punctuality","label":"Reliable attendance","text":"Demonstrates reliable attendance and punctuality."},{"id":"quality","label":"Quality work","text":"Produces careful, good-quality work."},{"id":"conduct","label":"Professional conduct","text":"Demonstrates professional conduct in the workplace."},{"id":"communication","label":"Clear communication","text":"Communicates clearly with the team."},{"id":"teamwork","label":"Teamwork","text":"Works cooperatively with colleagues."},{"id":"initiative","label":"Initiative","text":"Shows initiative when carrying out assigned work."}],"improvements":[{"id":"none","label":"No additional concerns","text":"No additional concerns are recorded in this review."},{"id":"punctuality","label":"Attendance and punctuality","text":"Attendance and punctuality need further attention."},{"id":"quality","label":"Work quality","text":"Work quality needs further attention."},{"id":"conduct","label":"Workplace conduct","text":"Workplace conduct needs further attention."},{"id":"communication","label":"Communication","text":"Communication needs further attention."},{"id":"time_management","label":"Time management","text":"Time management needs further attention."}],"guidance":[{"id":"none","label":"No additional actions","text":"No additional actions are recommended at this review."},{"id":"maintain","label":"Maintain good practices","text":"Continue the good practices identified in this review."},{"id":"plan","label":"Plan daily tasks","text":"Plan daily tasks and check priorities with the Supervisor."},{"id":"check_work","label":"Check work before submission","text":"Check completed work before submitting it."},{"id":"ask","label":"Ask for clarification","text":"Ask for clarification when instructions or expectations are unclear."},{"id":"updates","label":"Provide progress updates","text":"Provide regular progress updates to the Supervisor."},{"id":"discuss","label":"Discuss improvements with Supervisor","text":"Discuss the identified areas for improvement with the Supervisor."}],"overall":[{"id":"meeting","label":"Meeting expectations","text":"The intern is meeting the expectations discussed in this review."},{"id":"progress","label":"Making steady progress","text":"The intern is making steady progress in the internship."},{"id":"development","label":"Further development needed","text":"Further development is needed in the areas identified in this review."},{"id":"support","label":"Continued guidance recommended","text":"Continued guidance is recommended to support the intern's development."}]},"conflicts":[["strengths:punctuality","improvements:punctuality"],["strengths:quality","improvements:quality"],["strengths:conduct","improvements:conduct"],["strengths:communication","improvements:communication"],["overall:development","improvements:none"],["overall:support","guidance:none"]],"adjustments":{"punctuality":[{"id":"attendance_records","label":"Reviewed attendance evidence","text":"Adjusted after reviewing attendance evidence for this criterion."},{"id":"supervisor_clarification","label":"Clarified with Supervisor","text":"Adjusted after clarifying the attendance rating with the Supervisor."},{"id":"other","label":"Other","text":null}],"performance":[{"id":"work_evidence","label":"Reviewed work evidence","text":"Adjusted after reviewing work evidence for this criterion."},{"id":"supervisor_clarification","label":"Clarified with Supervisor","text":"Adjusted after clarifying the work performance rating with the Supervisor."},{"id":"other","label":"Other","text":null}],"conduct":[{"id":"conduct_evidence","label":"Reviewed conduct evidence","text":"Adjusted after reviewing workplace conduct evidence for this criterion."},{"id":"supervisor_clarification","label":"Clarified with Supervisor","text":"Adjusted after clarifying the conduct rating with the Supervisor."},{"id":"other","label":"Other","text":null}],"communication":[{"id":"communication_evidence","label":"Reviewed communication evidence","text":"Adjusted after reviewing communication evidence for this criterion."},{"id":"supervisor_clarification","label":"Clarified with Supervisor","text":"Adjusted after clarifying the communication rating with the Supervisor."},{"id":"other","label":"Other","text":null}]}}$catalog$::jsonb
$$;
create function public.normalize_evaluation_choices(p_choices jsonb) returns jsonb
language plpgsql immutable set search_path=pg_catalog,public as $$
declare c jsonb:=public.evaluation_feedback_catalog(); result jsonb:='{}'; g text; ids jsonb; pair jsonb; chosen text[]:='{}';
begin
 if jsonb_typeof(p_choices) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_choices))<>4 then raise exception 'Select valid feedback groups'; end if;
 foreach g in array array['strengths','improvements','guidance','overall'] loop
  ids:=p_choices->g;
  if jsonb_typeof(ids) is distinct from 'array' then raise exception 'Feedback group must be an array'; end if;
  if exists(select 1 from jsonb_array_elements(ids) x where jsonb_typeof(x)<>'string')
   or (select count(distinct x) from jsonb_array_elements_text(ids) x)<>jsonb_array_length(ids)
   or exists(select 1 from jsonb_array_elements_text(ids) x where not exists(select 1 from jsonb_array_elements(c->'groups'->g) o where o->>'id'=x))
  then raise exception 'Unknown or duplicate feedback option'; end if;
  if (g='overall' and jsonb_array_length(ids)>1) or (ids?'none' and jsonb_array_length(ids)>1) then raise exception 'Choose compatible feedback options'; end if;
  result:=result||jsonb_build_object(g,(select coalesce(jsonb_agg(o->'id' order by n),'[]'::jsonb) from jsonb_array_elements(c->'groups'->g) with ordinality items(o,n) where ids?(o->>'id')));
  chosen:=chosen||array(select g||':'||x from jsonb_array_elements_text(ids) x);
 end loop;
 for pair in select * from jsonb_array_elements(c->'conflicts') loop
  if (pair->>0)=any(chosen) and (pair->>1)=any(chosen) then raise exception 'Feedback choices contradict each other'; end if;
 end loop;
 return result;
end $$;
create function public.evaluation_feedback_text(p_choices jsonb,p_remarks text) returns jsonb
language plpgsql immutable set search_path=pg_catalog,public as $$
declare c jsonb:=public.evaluation_feedback_catalog(); selections jsonb:=public.normalize_evaluation_choices(p_choices); result jsonb:='{}'; g text; value text; remarks text;
begin
 if p_remarks is null or length(p_remarks)>1000 then raise exception 'Additional remarks must be at most 1000 characters'; end if;
 remarks:=regexp_replace(p_remarks,'^\s+|\s+$','','g');
 foreach g in array array['strengths','improvements','guidance','overall'] loop
  select coalesce(string_agg(o->>'text',' ' order by n),'') into value from jsonb_array_elements(c->'groups'->g) with ordinality items(o,n) where (selections->g)?(o->>'id');
  if g='overall' then
   value:=case when value<>'' and remarks<>'' then value||E'\n\n'||remarks when remarks<>'' then remarks else value end;
   result:=result||jsonb_build_object('summary',value);
  else result:=result||jsonb_build_object(g,value); end if;
 end loop;
 return result;
end $$;
create function public.evaluation_adjustment_text(p_original jsonb,p_final jsonb,p_reasons jsonb) returns text
language plpgsql immutable set search_path=pg_catalog,public as $$
declare c jsonb:=public.evaluation_feedback_catalog(); criterion text; reason jsonb; option jsonb; text_value text; result text:=''; overview text:='';
begin
 if public.rubric_score(p_original) is null or public.rubric_score(p_final) is null or jsonb_typeof(p_reasons) is distinct from 'object' then raise exception 'Valid ratings and per-criterion adjustment reasons required'; end if;
 for criterion in select jsonb_object_keys(p_reasons) loop
  if criterion not in ('punctuality','performance','conduct','communication') or p_original->criterion=p_final->criterion then raise exception 'Reasons must match changed criteria'; end if;
 end loop;
 foreach criterion in array array['punctuality','performance','conduct','communication'] loop
  if p_original->criterion=p_final->criterion then continue; end if;
  reason:=p_reasons->criterion;
  if jsonb_typeof(reason) is distinct from 'object' or not reason?'code' or not reason?'explanation'
   or (select count(*) from jsonb_object_keys(reason))<>2 or jsonb_typeof(reason->'explanation') is distinct from 'string'
  then raise exception 'Select a valid reason for changed criterion: %',criterion; end if;
  select o into option from jsonb_array_elements(c->'adjustments'->criterion) o where o->>'id'=reason->>'code';
  if not found then raise exception 'Select a valid reason for changed criterion: %',criterion; end if;
  if option->>'id'='other' then
   text_value:=regexp_replace(reason->>'explanation','^\s+|\s+$','','g');
   if length(text_value)<10 or length(reason->>'explanation')>500 or text_value!~'[[:alpha:]]' then raise exception 'Other adjustment explanation must be meaningful, 10-500 characters'; end if;
  else
   if reason->>'explanation'<>'' then raise exception 'Preset reasons do not accept hidden explanations'; end if;
   text_value:=option->>'text';
  end if;
  result:=result||case when result='' then '' else E'\n' end||criterion||': '||text_value;
  overview:=overview||case when overview='' then '' else E'\n' end||criterion||': '||(option->>'label');
 end loop;
 -- Keep M15's 2000-character compatibility field. Full individual explanations
 -- are retained in adjustment_reasons and immutable adjustment events.
 return case when length(result)>2000 then overview||E'\nFull explanations are retained in the per-criterion reasons.' else result end;
end $$;

create or replace function public.save_evaluation_review(p_id uuid,p_expected_revision integer,p_summary text,p_strengths text,p_improvements text,p_guidance text,p_criteria jsonb,p_reason text,p_publish boolean default false)
returns public.evaluation_reviews language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.evaluation_reviews; s public.supervisor_evaluations; final public.evaluations; score integer; reason_text text; fields jsonb; criterion text; option jsonb;
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
 reason_text:=public.evaluation_adjustment_text(s.criteria,p_criteria,r.adjustment_reasons);
 if p_criteria<>s.criteria and p_reason is distinct from reason_text then raise exception 'Use a valid per-criterion adjustment reason; upgrade the evaluation client'; end if;
 fields:=jsonb_build_object('summary',p_summary,'strengths',p_strengths,'improvements',p_improvements,'guidance',p_guidance);
 if r.feedback_mode='selected' then
  if fields is distinct from public.evaluation_feedback_text(r.feedback_choices,r.additional_remarks) then
   update public.evaluation_reviews set feedback_mode='written',written_feedback=fields where id=p_id;
  end if;
 end if;
 if p_publish and p_summary!~'[^[:space:]]' then raise exception 'Student-facing summary required to publish'; end if;
 update public.evaluation_reviews set summary=p_summary,strengths=p_strengths,improvements=p_improvements,guidance=p_guidance,
 criteria=p_criteria,adjustment_reason=p_reason,revision=revision+1,status='Coordinator Draft' where id=p_id returning * into r;
 if p_publish then
  insert into public.evaluations(intern_id,evaluator_id,competencies,overall_score,feedback,source_evaluation_id,source_version,provenance,strengths,improvements,guidance,evaluation_date,submission_id)
  values(s.intern_id,auth.uid(),r.criteria,score,r.summary,s.id,s.version,'supervisor_review',r.strengths,r.improvements,r.guidance,s.evaluation_date,s.id) returning * into final;
  update public.evaluation_reviews set status='Published to Intern',final_evaluation_id=final.id where id=p_id returning * into r;
 end if;
 foreach criterion in array array['punctuality','performance','conduct','communication'] loop
  if s.criteria->criterion=p_criteria->criterion then continue; end if;
  select o into option from jsonb_array_elements(public.evaluation_feedback_catalog()->'adjustments'->criterion) o where o->>'id'=r.adjustment_reasons->criterion->>'code';
  insert into public.evaluation_adjustment_events(source_id,source_version,review_revision,criterion,original_rating,final_rating,reason_code,reason_text,coordinator_id)
  values(s.id,s.version,r.revision,criterion,(s.criteria->>criterion)::integer,(p_criteria->>criterion)::integer,r.adjustment_reasons->criterion->>'code',case when option->>'id'='other' then regexp_replace(r.adjustment_reasons->criterion->>'explanation','^\s+|\s+$','','g') else option->>'text' end,auth.uid());
 end loop;
 return r;
end $$;


create function public.save_evaluation_review_v2(p_id uuid,p_expected_revision integer,p_mode text,p_choices jsonb,p_remarks text,p_written jsonb,p_criteria jsonb,p_adjustments jsonb,p_expected_feedback jsonb,p_publish boolean)
returns public.evaluation_reviews language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.evaluation_reviews; s public.supervisor_evaluations; fields jsonb; choices jsonb; reason text; previous_written jsonb; criterion text; option jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.evaluation_reviews where id=p_id for update;
 if not found or public.current_role() is distinct from 'instructor' or r.coordinator_id<>auth.uid() or not public.can_review_source(p_id)
 then raise exception 'Routed evaluation for current assigned Intern required' using errcode='42501'; end if;
 select * into s from public.supervisor_evaluations where id=p_id;
 if p_mode is null or p_mode not in ('selected','written') or p_publish is null then raise exception 'Select a feedback mode'; end if;
 choices:=public.normalize_evaluation_choices(p_choices);
 reason:=public.evaluation_adjustment_text(s.criteria,p_criteria,p_adjustments);
 if p_remarks is null or length(p_remarks)>1000 then raise exception 'Additional remarks must be at most 1000 characters'; end if;
 if p_mode='selected' then
  if p_publish and jsonb_array_length(choices->'overall')<>1 then raise exception 'Select overall feedback before publication'; end if;
  fields:=public.evaluation_feedback_text(choices,p_remarks);
 else
  if jsonb_typeof(p_written) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_written))<>4 then raise exception 'Written feedback fields required'; end if;
  foreach criterion in array array['summary','strengths','improvements','guidance'] loop
   if jsonb_typeof(p_written->criterion) is distinct from 'string' then raise exception 'Written feedback fields required'; end if;
  end loop;
  fields:=p_written;
 end if;
 if fields is distinct from p_expected_feedback then raise exception 'Feedback preview changed; refresh before publishing' using errcode='40001'; end if;
 if r.status='Published to Intern' then
  if p_publish and r.feedback_mode=p_mode and r.feedback_choices=choices and r.additional_remarks=p_remarks and r.adjustment_reasons=p_adjustments
   and r.criteria=p_criteria and jsonb_build_object('summary',r.summary,'strengths',r.strengths,'improvements',r.improvements,'guidance',r.guidance)=fields then return r; end if;
  raise exception 'Published evaluation is immutable';
 end if;
 if r.revision is distinct from p_expected_revision then raise exception 'Review changed; refresh' using errcode='40001'; end if;
 previous_written:=r.written_feedback;
 if p_mode='written' then previous_written:=fields;
 elsif previous_written is null and coalesce(r.feedback_mode,'written')='written' and (r.summary<>'' or r.strengths<>'' or r.improvements<>'' or r.guidance<>'') then
  previous_written:=jsonb_build_object('summary',r.summary,'strengths',r.strengths,'improvements',r.improvements,'guidance',r.guidance);
 end if;
 update public.evaluation_reviews set feedback_mode=p_mode,feedback_choices=choices,additional_remarks=p_remarks,written_feedback=previous_written,
  legacy_adjustment_reason=coalesce(legacy_adjustment_reason,case when adjustment_reasons='{}'::jsonb and adjustment_reason<>'' then adjustment_reason end),adjustment_reasons=p_adjustments where id=p_id;
 r:=public.save_evaluation_review(p_id,p_expected_revision,fields->>'summary',fields->>'strengths',fields->>'improvements',fields->>'guidance',p_criteria,reason,p_publish);
 return r;
end $$;

create or replace function public.admin_reroute_evaluation(p_id uuid,p_coordinator_id uuid,p_reason text,p_expected_revision integer) returns public.evaluation_reviews language plpgsql security definer set search_path=pg_catalog,public as $$
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
 update public.evaluation_reviews set coordinator_id=p_coordinator_id,revision=revision+1,summary='',strengths='',improvements='',guidance='',criteria=s.criteria,adjustment_reason='',adjustment_reasons='{}',feedback_mode=null,feedback_choices=null,additional_remarks='',written_feedback=null,legacy_adjustment_reason=null,status='Submitted to Coordinator' where id=p_id returning * into r;
 return r;
end $$;



revoke all on function public.evaluation_feedback_catalog(),public.normalize_evaluation_choices(jsonb),public.evaluation_feedback_text(jsonb,text),public.evaluation_adjustment_text(jsonb,jsonb,jsonb),public.save_evaluation_review_v2(uuid,integer,text,jsonb,text,jsonb,jsonb,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.evaluation_feedback_catalog(),public.save_evaluation_review_v2(uuid,integer,text,jsonb,text,jsonb,jsonb,jsonb,jsonb,boolean) to authenticated;
-- Existing M15 read/write ACL, audit and retired correction grants are unchanged.
notify pgrst,'reload schema';
commit;

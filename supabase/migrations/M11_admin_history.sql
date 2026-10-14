-- M11: archival preserves reference/history; full audit filters use server pages.
-- Requires M10 and M07/M02. Apply as postgres, rehearse on synthetic fixtures.
-- No rows removed or legacy events promoted. Forward repair after deployment.
begin;
do $$ begin
 if current_user<>'postgres' or to_regprocedure('public.finalize_submission(uuid)') is null then raise exception 'M11 requires postgres and M10'; end if;
end $$;
alter table public.companies add column archived_at timestamptz;
alter table public.course_sections add column archived_at timestamptz;
alter table public.academic_years add column archived_at timestamptz;
-- Name/label maintenance stays under existing Admin RLS; archive is RPC-only.
revoke insert,update,delete on public.companies,public.course_sections,public.academic_years from public,anon,authenticated;
grant insert(name),update(name) on public.companies,public.course_sections to authenticated;
grant insert(label),update(label,is_current) on public.academic_years to authenticated;
create function public.guard_archived_assignment() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(404,1);
 if new.company_id is not null and (tg_op='INSERT' or new.company_id is distinct from old.company_id)
  and exists(select 1 from public.companies where id=new.company_id and archived_at is not null)
 then raise exception 'Archived company cannot receive new assignments'; end if;
 if new.section_id is not null and (tg_op='INSERT' or new.section_id is distinct from old.section_id)
  and exists(select 1 from public.course_sections where id=new.section_id and archived_at is not null)
 then raise exception 'Archived section cannot receive new assignments'; end if;
 return new;
end $$;
create trigger m11_assignment_archive_guard before insert or update on public.interns for each row execute function public.guard_archived_assignment();
create function public.admin_master_impact(p_table text,p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;
create function public.admin_archive_master(p_table text,p_id uuid,p_expected_references bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;
create index m11_audit_order on public.audit_logs(created_at desc,id desc);
create index m11_audit_actor on public.audit_logs(actor_id,created_at desc,id desc);
create function public.audit_history(p_actor text default '',p_action text default '',p_category text default '',p_from date default null,p_to date default null,
 p_page integer default 1,p_size integer default 25) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
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
end $$;
revoke all on function public.guard_archived_assignment(),public.admin_master_impact(text,uuid),public.admin_archive_master(text,uuid,bigint),
 public.audit_history(text,text,text,date,date,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_master_impact(text,uuid),public.admin_archive_master(text,uuid,bigint),
 public.audit_history(text,text,text,date,date,integer,integer) to authenticated;
commit;

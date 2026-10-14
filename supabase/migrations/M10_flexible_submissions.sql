-- M10: independent flexible file sets; never satisfies clearance requirements.
-- Prerequisites: M01-M08 installed, private documents bucket, inspected provider
-- metadata size/mimetype. M05/M09 remain separate historical validation gates.
-- Apply as postgres after rehearsal. No legacy conversion or evidence deletion.
-- Failure rolls back; after commit retain evidence and use reviewed forward repair.
begin;
do $$ begin
 if current_user<>'postgres' or to_regprocedure('public.review_document_version(uuid,text,text,bigint,bigint)') is null
 then raise exception 'M10 requires trusted postgres and M08'; end if;
 if not exists(select 1 from storage.buckets where id='documents' and not public and file_size_limit=10485760
   and allowed_mime_types @> array['application/pdf','image/jpeg','image/png']::text[])
 then raise exception 'Private MIME/size-limited documents bucket required'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='storage' and table_name='objects' and column_name='metadata' and data_type='jsonb')
 then raise exception 'Inspect Storage metadata contract before M10'; end if;
end $$;

create table public.submissions(
 id uuid primary key default gen_random_uuid(), intern_id uuid not null references public.profiles(id),
 current_version bigint not null default 0 check(current_version>=0), review_revision bigint not null default 0 check(review_revision>=0),
 title text not null check(length(btrim(title)) between 1 and 200), description text not null default '' check(length(description)<=2000),
 status text not null default 'Pending' check(status in ('Pending','Approved','Needs Revision')),
 note text check(length(note)<=500), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp());
create table public.submission_versions(
 id uuid primary key, submission_id uuid not null references public.submissions(id), intern_id uuid not null references public.profiles(id),
 expected_version bigint not null check(expected_version>=0), expected_revision bigint not null check(expected_revision>=0), version_no bigint,
 title text not null check(length(btrim(title)) between 1 and 200), description text not null check(length(description)<=2000), manifest jsonb not null,
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 committed_at timestamptz, abandoned_at timestamptz,
 status text not null default 'Pending' check(status in ('Pending','Approved','Needs Revision')),
 review_revision bigint not null default 0 check(review_revision>=0), note text check(length(note)<=500), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 unique(submission_id,version_no), check(not(committed_at is not null and abandoned_at is not null)),
 check((committed_at is null and version_no is null) or (committed_at is not null and version_no>0)));
create table public.submission_files(
 id uuid primary key default gen_random_uuid(), version_id uuid not null references public.submission_versions(id),
 intern_id uuid not null references public.profiles(id), ordinal integer not null check(ordinal between 1 and 10),
 file_path text not null unique, file_name text not null check(length(file_name) between 1 and 255),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
 byte_size bigint not null check(byte_size between 1 and 10485760), unique(version_id,ordinal),
 check(split_part(file_path,'/',1)=intern_id::text));
create table public.submission_reviews(
 id uuid primary key default gen_random_uuid(), version_id uuid not null references public.submission_versions(id),
 intern_id uuid not null references public.profiles(id), review_revision bigint not null,
 status text not null check(status in ('Approved','Needs Revision')), note text check(length(note)<=500),
 reviewed_by uuid not null references public.profiles(id), reviewed_at timestamptz not null,
 unique(version_id,review_revision), check(status<>'Needs Revision' or nullif(btrim(note),'') is not null));
create index m10_submissions_owner on public.submissions(intern_id,id);
create index m10_versions_submission on public.submission_versions(submission_id,id);
create index m10_files_version on public.submission_files(version_id,ordinal);
create index m10_reviews_version on public.submission_reviews(version_id,review_revision);
do $$ declare t text; begin
 foreach t in array array['submissions','submission_versions','submission_files','submission_reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy m10_insert_guard on public.%I as restrictive for insert to authenticated with check(false)',t);
  execute format('create policy m10_update_guard on public.%I as restrictive for update to authenticated using(false) with check(false)',t);
  execute format('create policy m10_delete_guard on public.%I as restrictive for delete to authenticated using(false)',t);
  execute format('create trigger m10_trusted_audit after insert or update or delete on public.%I for each row execute function public.write_trusted_audit()',t);
 end loop;
end $$;
create policy m10_submissions_read on public.submissions for select to authenticated
 using(public.owns_intern(intern_id) or (current_version>0 and public.can_review(intern_id)));
create policy m10_versions_read on public.submission_versions for select to authenticated
 using(public.owns_intern(intern_id) or (committed_at is not null and public.can_review(intern_id)));
create policy m10_files_read on public.submission_files for select to authenticated
 using(public.owns_intern(intern_id) or (public.can_review(intern_id) and exists(select 1 from public.submission_versions v where v.id=version_id and v.committed_at is not null)));
create policy m10_reviews_read on public.submission_reviews for select to authenticated using(public.can_read_intern(intern_id));
create policy m10_submissions_read_guard on public.submissions as restrictive for select to authenticated
 using(public.owns_intern(intern_id) or (current_version>0 and public.can_review(intern_id)));
create policy m10_versions_read_guard on public.submission_versions as restrictive for select to authenticated
 using(public.owns_intern(intern_id) or (committed_at is not null and public.can_review(intern_id)));
create policy m10_files_read_guard on public.submission_files as restrictive for select to authenticated
 using(public.owns_intern(intern_id) or (public.can_review(intern_id) and exists(select 1 from public.submission_versions v where v.id=version_id and v.committed_at is not null)));
create policy m10_reviews_read_guard on public.submission_reviews as restrictive for select to authenticated using(public.can_read_intern(intern_id));

create function public.stage_submission(p_attempt_id uuid,p_submission_id uuid,p_title text,p_description text,
 p_files jsonb,p_expected_version bigint,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;

create function public.finalize_submission(p_version_id uuid) returns public.submissions
language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;
create function public.cancel_submission(p_version_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;
create function public.review_submission(p_id uuid,p_version bigint,p_revision bigint,p_status text,p_note text) returns public.submissions
language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;
create function public.submission_file_access(p_id uuid,p_version_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.submission_files; v public.submission_versions;
begin
 select * into f from public.submission_files where id=p_id and version_id=p_version_id;
 if not found or not public.can_read_intern(f.intern_id) then raise exception 'File access not permitted' using errcode='42501'; end if;
 select * into v from public.submission_versions where id=f.version_id and committed_at is not null;
 if not found or not exists(select 1 from storage.objects where bucket_id='documents' and name=f.file_path)
 then raise exception 'Committed file missing; refresh or request resubmission'; end if;
 return jsonb_build_object('id',f.id,'file_path',f.file_path,'file_name',f.file_name);
end $$;
create function public.submission_recovery_list() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'created_at',v.created_at) order by v.created_at),'[]'::jsonb)
 into result from public.submission_versions v where v.intern_id=auth.uid() and v.committed_at is null
  and (v.abandoned_at is null or exists(select 1 from public.submission_files f join storage.objects o on o.bucket_id='documents' and o.name=f.file_path where f.version_id=v.id));
 if jsonb_array_length(result)>50000 then raise exception 'Recovery list too large; operator assistance required'; end if;
 return jsonb_build_object('id',auth.uid(),'versions',result);
end $$;

-- Extend the existing protocols in place so restrictive policies retain the same
-- function identities and old clients can continue using legacy reservations.
create or replace function public.can_insert_reserved_document(p_path text) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(404,1);
 return public.owns_intern(auth.uid()) and (
  exists(select 1 from public.document_versions v join public.documents d on d.id=v.document_id
   where v.file_path=p_path and v.intern_id=auth.uid() and v.committed_at is null and v.abandoned_at is null
    and v.expires_at>clock_timestamp() and v.expected_version=d.upload_version)
  or exists(select 1 from public.submission_files f join public.submission_versions v on v.id=f.version_id join public.submissions s on s.id=v.submission_id
   where f.file_path=p_path and f.intern_id=auth.uid() and v.committed_at is null and v.abandoned_at is null
    and v.expires_at>clock_timestamp() and v.expected_version=s.current_version and v.expected_revision=s.review_revision));
end $$;
create or replace function public.can_delete_staged_document(p_path text) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(404,1);
 return public.owns_intern(auth.uid()) and (
  exists(select 1 from public.document_versions where file_path=p_path and intern_id=auth.uid() and committed_at is null and abandoned_at is not null)
  or exists(select 1 from public.submission_files f join public.submission_versions v on v.id=f.version_id
   where f.file_path=p_path and f.intern_id=auth.uid() and v.committed_at is null and v.abandoned_at is not null))
  and not exists(select 1 from public.documents where file_path=p_path)
  and not exists(select 1 from public.document_versions where file_path=p_path and committed_at is not null)
  and not exists(select 1 from public.submission_files f join public.submission_versions v on v.id=f.version_id where f.file_path=p_path and v.committed_at is not null);
end $$;
create or replace function public.can_read_document_object(p_path text) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_active() and ((public.current_role()='intern' and split_part(p_path,'/',1)=auth.uid()::text) or public.is_admin()
  or exists(select 1 from public.documents d where d.file_path=p_path and split_part(p_path,'/',1)=d.intern_id::text and public.assigned_intern(d.intern_id))
  or exists(select 1 from public.document_versions v where v.file_path=p_path and v.committed_at is not null and public.assigned_intern(v.intern_id))
  or exists(select 1 from public.submission_files f join public.submission_versions v on v.id=f.version_id
   where f.file_path=p_path and v.committed_at is not null and public.assigned_intern(f.intern_id)))
$$;
revoke all on function public.stage_submission(uuid,uuid,text,text,jsonb,bigint,bigint),public.finalize_submission(uuid),public.cancel_submission(uuid),
 public.review_submission(uuid,bigint,bigint,text,text),public.submission_file_access(uuid,uuid),public.submission_recovery_list() from public,anon,authenticated;
grant execute on function public.stage_submission(uuid,uuid,text,text,jsonb,bigint,bigint),public.finalize_submission(uuid),public.cancel_submission(uuid),
 public.review_submission(uuid,bigint,bigint,text,text),public.submission_file_access(uuid,uuid),public.submission_recovery_list() to authenticated;
commit;

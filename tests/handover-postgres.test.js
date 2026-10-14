// Isolated real PostgreSQL authorization and handover transitions. No live URL.
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,beforeEach,afterEach,describe,it,expect} from 'vitest';
import {disposablePostgres} from './disposable-postgres';
import {internMetrics} from '../src/lib/metrics';
const sql=f=>readFileSync(new URL(`../supabase/${f}`,import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),IA=id(2),IB=id(3),SA=id(4),SB=id(5),P=id(6);
let cluster,db;
async function act(actor,query,args=[]) {
  await db.query('savepoint operation');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
    const result=await db.query(query,args);await db.query('set constraints all immediate');
    await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub','',true)");
    await db.query('set constraints all deferred');await db.query('release savepoint operation');
    return JSON.parse(JSON.stringify(result.rows));
  } catch(e) {await db.query('rollback to savepoint operation');await db.query('reset role');await db.query('release savepoint operation');throw e;}
}
async function shift() {
  return (await db.query(`insert into public.attendance_logs(id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,accomplishment)
    values($1,$2,'2026-10-01','08:00','16:00','2026-10-01T00:00:00Z','2026-10-01T08:00:00Z',8,false,'Synthetic historical shift') returning *,log_date::text as log_date`,[id(90),SA])).rows[0];
}
const verify=(actor,row,overrides={})=>act(actor,'select * from public.verify_attendance($1,$2,$3)',[row.id,overrides.in||row.clocked_in_at,overrides.out||row.clocked_out_at]);
beforeAll(async()=>{
  cluster=await disposablePostgres();db=await cluster.connect();await db.query(sql('tests/baseline.sql'));
  for(const f of ['M01_authority.sql','M02_trusted_audit.sql','M03_attendance_integrity.sql','M04_private_documents_bucket.sql','M06_rubric_hours.sql','M07_account_lifecycle.sql','M08_document_versions.sql','M10_flexible_submissions.sql','M11_admin_history.sql','M12_handover_workflows.sql','M12_handover_workflows.sql'])await db.query(sql(`migrations/${f}`));
  for(const actor of [A,IA,IB,SA,SB,P])await db.query('insert into auth.users(id,email) values($1,$2)',[actor,`${actor}@example.invalid`]);
  await db.query("update public.profiles set role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end,status=case when id=$4 then 'Pending' else 'Active' end",[A,IA,IB,P]);
},60000);
afterAll(async()=>{if(cluster)await cluster.stop();},30000);
beforeEach(async()=>{await db.query('begin');await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SA,IA]);await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SB,IB]);});
afterEach(async()=>{await db.query('rollback');});
describe('M12 requirement and attendance contracts',()=>{
  it('has protected definitions/grants and is safely repeatable',async()=>{
    const {rows}=await db.query(`select proname,prosecdef,proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') auth
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('admin_add_requirement','verify_attendance','admin_set_current_year','legacy_document_access')`);
    expect(rows).toHaveLength(4);for(const r of rows){expect(r.prosecdef).toBe(true);expect(r.proconfig[0]).toMatch(/pg_catalog.*public/);expect(r.anon).toBe(false);expect(r.auth).toBe(true);}
  });
  it('creates distinct duplicate names, retries without duplicate creation/audit and rejects reuse',async()=>{
    const args=[SA,'  Portfolio  ',id(100)],r=(await act(A,'select * from public.admin_add_requirement($1,$2,$3)',args))[0];
    expect(r).toMatchObject({id:id(100),intern_id:SA,name:'Portfolio',doc_type:`custom:${id(100)}`,status:'Pending',upload_version:'0'});
    const before=(await db.query('select count(*)::int n from public.audit_logs')).rows[0].n;
    expect((await act(A,'select * from public.admin_add_requirement($1,$2,$3)',args))[0].id).toBe(r.id);
    expect((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n).toBe(before);
    await act(A,'select * from public.admin_add_requirement($1,$2,$3)',[SA,'Portfolio',id(101)]);
    expect(await act(IA,"select id from public.documents where name='Portfolio'")).toHaveLength(2);
    await expect(act(A,'select * from public.admin_add_requirement($1,$2,$3)',[SA,'Other',id(100)])).rejects.toThrow(/different content/);
  });
  it.each([IA,IB,SA,P])('rejects non-Admin requirement creation for %s',async actor=>{
    await expect(act(actor,'select * from public.admin_add_requirement($1,$2,$3)',[SA,'Portfolio',id(100)])).rejects.toThrow(/Admin required/);
    expect((await db.query('select count(*)::int n from public.documents')).rows[0].n).toBe(0);
  });
  it('rejects missing/invalid target or label without altering history',async()=>{
    for(const args of [[IA,'Portfolio',id(100)],[SA,' ',id(100)],[SA,'x'.repeat(201),id(100)],[SA,'Portfolio',null]])
      await expect(act(A,'select * from public.admin_add_requirement($1,$2,$3)',args)).rejects.toThrow();
    expect((await db.query('select count(*)::int n from public.documents')).rows[0].n).toBe(0);
  });
  it('verifies a valid closed interval only through assigned staff, preserving hours and accomplishments',async()=>{
    const row=await shift();expect(row.verified).toBe(false);
    const result=(await verify(IA,row))[0];expect(result).toMatchObject({id:row.id,verified:true,verified_by:IA,hours:'8',accomplishment:row.accomplishment});
    const count=(await db.query('select count(*)::int n from public.audit_logs')).rows[0].n;
    expect((await verify(IA,row))[0].verified).toBe(true);
    expect((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n).toBe(count);
  });
  it.each([IB,SA,SB,P])('rejects unassigned/Intern/Pending reviewer %s',async actor=>{
    const row=await shift();await expect(verify(actor,row)).rejects.toThrow(/staff required/);
    expect((await db.query('select verified from public.attendance_logs where id=$1',[row.id])).rows[0].verified).toBe(false);
  });
  it('rejects stale expected instants and reassignment, allowing the new authorized instructor',async()=>{
    const row=await shift();await expect(verify(IA,row,{out:'2026-10-01T09:00:00Z'})).rejects.toThrow(/changed/);
    await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SA,IB]);
    await expect(verify(IA,row)).rejects.toThrow(/staff required/);expect((await verify(IB,row))[0].verified_by).toBe(IB);
  });
  it('does not accept legacy/unknown evidence or an open session',async()=>{
    const row=await shift();
    // Simulate a historical interval preserved by M03 NOT VALID, not an allowed new write.
    await db.query('alter table public.attendance_logs drop constraint m03_attendance_interval');
    await db.query('update public.attendance_logs set clocked_in_at=null,clocked_out_at=null where id=$1',[row.id]);
    await expect(verify(IA,row)).rejects.toThrow(/changed/);
    await db.query('delete from public.attendance_logs where id=$1',[row.id]);
    const open=(await act(SA,'select * from public.clock_in()'))[0];
    await expect(act(IA,'select * from public.verify_attendance($1,$2,$3)',[open.id,open.clocked_in_at,null])).rejects.toThrow(/changed/);
  });
  it('rolls back verification when mandatory audit fails',async()=>{
    const row=await shift();await db.query(`create function public.synthetic_handover_audit_failure() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit unavailable';end$$;
      create trigger synthetic_handover_audit_failure before insert on public.audit_logs for each row execute function public.synthetic_handover_audit_failure()`);
    await expect(verify(IA,row)).rejects.toThrow(/audit unavailable/);
    expect((await db.query('select verified from public.attendance_logs where id=$1',[row.id])).rows[0].verified).toBe(false);
  });
  it('updates clearance after actual hours and all standard/custom current evidence are approved',async()=>{
    const row=await shift();await verify(IA,row);
    await act(A,'select public.attach_standard_docs($1)',[SA]);await act(A,'select * from public.admin_add_requirement($1,$2,$3)',[SA,'Portfolio',id(100)]);
    let docs=await act(SA,'select * from public.documents');
    const attendance=await act(SA,'select *,log_date::text as log_date from public.attendance_logs');
    expect(internMetrics({internId:SA,required:8,attendance,documents:docs}).cleared).toBe(false);
    for(const d of docs){
      const upload=(await act(SA,"select public.stage_document_upload($1,'Evidence.pdf','application/pdf',20,$2) result",[d.id,d.upload_version]))[0].result.upload;
      await act(SA,"insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)",[upload.file_path,{mimetype:'application/pdf',size:20}]);
      const current=(await act(SA,'select * from public.finalize_document_upload($1)',[upload.id]))[0];
      await act(IA,"select * from public.review_document_version($1,'Approved',null,$2,$3)",[d.id,current.upload_version,current.review_revision]);
    }
    docs=await act(SA,'select * from public.documents');expect(docs).toHaveLength(5);
    expect(internMetrics({internId:SA,required:8,attendance,documents:docs}).cleared).toBe(true);
    expect(await act(IB,'select id from public.documents where intern_id=$1',[SA])).toEqual([]);
    await act(A,'select public.admin_set_assignment($1,$2,null,null,9)',[SA,IA]);
    expect(internMetrics({internId:SA,required:9,attendance,documents:docs}).cleared).toBe(false);
  });
  it('sets current year atomically, preserves links/history, rejects stale choice and prevents raw changes',async()=>{
    await act(A,"insert into public.academic_years(label) values('2026–2027'),('2027–2028')");
    const years=await act(A,'select * from public.academic_years order by label');const before=await act(A,'select * from public.interns order by id');
    const r=(await act(A,'select public.admin_set_current_year($1,null) result',[years[0].id]))[0].result;expect(r.year.is_current).toBe(true);
    await expect(act(IA,'select public.admin_set_current_year($1,$2)',[years[1].id,years[0].id])).rejects.toThrow(/Admin required/);
    await expect(act(A,'select public.admin_set_current_year($1,null)',[years[1].id])).rejects.toThrow(/changed/);
    await expect(act(A,'update public.academic_years set is_current=true where id=$1',[years[1].id])).rejects.toThrow(/permission denied/);
    await act(A,'select public.admin_set_current_year($1,$2)',[years[1].id,years[0].id]);
    expect(await act(A,'select id from public.academic_years where is_current')).toEqual([{id:years[1].id}]);
    expect(await act(A,'select * from public.interns order by id')).toEqual(before);expect(await act(A,'select id from public.academic_years')).toHaveLength(2);
    await expect(act(A,"select public.admin_archive_master('academic_years',$1,0)",[years[1].id])).rejects.toThrow(/current academic year/);
  });
  it('rejects archived year selection and rolls back the whole switch if audit fails',async()=>{
    await act(A,"insert into public.academic_years(label) values('Old'),('New')");const years=await act(A,'select * from public.academic_years order by label');
    await act(A,'select public.admin_set_current_year($1,null)',[years[0].id]);
    await act(A,"select public.admin_archive_master('academic_years',$1,0)",[years[1].id]);
    await expect(act(A,'select public.admin_set_current_year($1,$2)',[years[1].id,years[0].id])).rejects.toThrow(/Active academic year/);
    await db.query('update public.academic_years set archived_at=null where id=$1',[years[1].id]);
    await db.query(`create function public.synthetic_year_audit_failure() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit unavailable';end$$;
      create trigger synthetic_year_audit_failure before insert on public.audit_logs for each row execute function public.synthetic_year_audit_failure()`);
    await expect(act(A,'select public.admin_set_current_year($1,$2)',[years[1].id,years[0].id])).rejects.toThrow(/audit unavailable/);
    expect(await act(A,'select id from public.academic_years where is_current')).toEqual([{id:years[0].id}]);
  });
  it('retains exact legacy metadata on the first replacement without inventing approval/version history, and authorizes its old file',async()=>{
    const path=`${SA}/legacy-evidence.pdf`,reviewed='2020-01-01T00:00:00Z';
    await db.query("insert into public.documents(id,intern_id,doc_type,name,status,file_path,file_name,note,reviewed_by,reviewed_at) values($1,$2,'moa','Legacy MOA','Approved',$3,'Original.pdf','Original saved explanation',$4,$5)",[id(300),SA,path,IA,reviewed]);
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)",[path,{mimetype:'application/pdf',size:20}]);
    const staged=(await act(SA,"select public.stage_document_upload($1,'Replacement.pdf','application/pdf',30,0) result",[id(300)]))[0].result.upload;
    await act(SA,"insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)",[staged.file_path,{mimetype:'application/pdf',size:30}]);
    const current=(await act(SA,'select * from public.finalize_document_upload($1)',[staged.id]))[0];
    expect(current.status).toBe('Pending');expect(current.legacy_evidence).toMatchObject({id:id(300),intern_id:SA,status:'Approved',file_path:path,file_name:'Original.pdf',note:'Original saved explanation',reviewed_by:IA,upload_version:0,provenance:'stored-legacy-metadata-unverified'});
    expect(Date.parse(current.legacy_evidence.reviewed_at)).toBe(Date.parse(reviewed));expect(current.legacy_evidence.captured_at).toBeTruthy();
    expect(await act(SA,'select version_no from public.document_versions where document_id=$1 and committed_at is not null',[id(300)])).toEqual([{version_no:'1'}]);
    const retry=(await act(SA,'select * from public.finalize_document_upload($1)',[staged.id]))[0];expect(retry.legacy_evidence).toEqual(current.legacy_evidence);
    expect((await act(IA,'select public.legacy_document_access($1) result',[id(300)]))[0].result.file_path).toBe(path);
    expect(await act(IA,"select name from storage.objects where bucket_id='documents' and name=$1",[path])).toEqual([{name:path}]);
    await expect(act(IB,'select public.legacy_document_access($1)',[id(300)])).rejects.toThrow(/not permitted/);
    expect(await act(IB,"select name from storage.objects where bucket_id='documents' and name=$1",[path])).toEqual([]);
    expect(await act(SA,"delete from storage.objects where bucket_id='documents' and name=$1 returning name",[path])).toEqual([]);
    await expect(act(SA,"update public.documents set legacy_evidence='{}' where id=$1",[id(300)])).rejects.toThrow(/permission denied/);
    await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SA,IB]);
    await expect(act(IA,'select public.legacy_document_access($1)',[id(300)])).rejects.toThrow(/not permitted/);
    expect((await act(IB,'select public.legacy_document_access($1) result',[id(300)]))[0].result.file_path).toBe(path);
  });
});

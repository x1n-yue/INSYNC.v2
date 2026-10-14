import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { disposablePostgres } from "./disposable-postgres";
const sql = file => readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const ADMIN=id(1), IA=id(2), IB=id(3), SA=id(4), SB=id(5);
const manifest=[{name:"Evidence.pdf",mime:"application/pdf",size:20},{name:"Photo.png",mime:"image/png",size:30}];
let cluster,db;
const rows=async(query,args=[]) => (await db.query(query,args)).rows;
async function act(actor,query,args=[]) {
 await db.query("savepoint operation");
 try {
  await db.query(actor===null?"set local role anon":"set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor||""]);
  const result=await rows(query,args); await db.query("set constraints all immediate");
  await db.query("reset role"); await db.query("select set_config('request.jwt.claim.sub','',true)");
  await db.query("set constraints all deferred"); await db.query("release savepoint operation"); return result;
 }catch(error){ await db.query("rollback to savepoint operation"); await db.query("reset role"); await db.query("release savepoint operation"); throw error; }
}
async function stage(s=null,attempt=id(100),files=manifest,actor=SA) {
 return (await act(actor,"select public.stage_submission($1,$2,'Weekly evidence','Description',$3,$4,$5) result",
 [attempt,s?.id||null,JSON.stringify(files),Number(s?.current_version||0),Number(s?.review_revision||0)]))[0].result;
}
async function put(reservation,actor=SA) {
 for(const f of reservation.files) await act(actor,"insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)",[f.file_path,{mimetype:f.mime_type,size:Number(f.byte_size)}]);
}
async function finalize(r,actor=SA){return (await act(actor,"select * from public.finalize_submission($1)",[r.id]))[0];}
async function uploaded(){const r=await stage();await put(r);return {r,s:await finalize(r)};}
async function review(s,status="Approved",note=null,actor=IA){return (await act(actor,"select * from public.review_submission($1,$2,$3,$4,$5)",[s.id,s.current_version,s.review_revision,status,note]))[0];}
beforeAll(async()=>{
 cluster=await disposablePostgres();db=await cluster.connect();await db.query(sql("tests/baseline.sql"));
 for(const file of ["M01_authority.sql","M02_trusted_audit.sql","M03_attendance_integrity.sql","M04_private_documents_bucket.sql","M05_validate_attendance.sql",
 "M06_rubric_hours.sql","M07_account_lifecycle.sql","M08_document_versions.sql","M09_validate_domain.sql","M10_flexible_submissions.sql","M11_admin_history.sql"])await db.query(sql(`migrations/${file}`));
 for(const uid of [ADMIN,IA,IB,SA,SB])await db.query("insert into auth.users(id,email) values($1,$2)",[uid,`${uid}@example.invalid`]);
 await db.query("update public.profiles set status='Active',role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end",[ADMIN,IA,IB]);
 await db.query("update public.interns set instructor_id=case when id=$1 then $2::uuid else $3::uuid end where id in ($1,$4)",[SA,IA,IB,SB]);
},60000);
afterAll(async()=>{if(cluster)await cluster.stop();},30000);
beforeEach(async()=>{await db.query("begin");});afterEach(async()=>{await db.query("rollback");});
describe("M10 atomic flexible submissions",()=>{
 it("accepts the exact ten-file/50 MiB boundary with PDF, JPEG and PNG manifests",async()=>{
  const mime=["application/pdf","image/jpeg","image/png"];
  const r=await stage(null,id(100),Array.from({length:10},(_,i)=>({name:`File ${i}`,mime:mime[i%3],size:5*1048576})));
  expect(r.files).toHaveLength(10);expect(r.files.reduce((n,f)=>n+Number(f.byte_size),0)).toBe(50*1048576);
  expect(r.files.find(f=>f.mime_type==="image/jpeg").file_path).toMatch(/\.jpg$/);
 });
 it("reserves complete sets idempotently, independent of the legacy checklist",async()=>{
  await act(ADMIN,"select public.attach_standard_docs($1)",[SA]);
  const r=await stage();expect((await stage()).id).toBe(r.id);expect(r.files).toHaveLength(2);
  expect(await rows("select * from public.submissions")).toHaveLength(1);
  await put(r);const s=await finalize(r);expect(s.current_version).toBe("1");expect(s.status).toBe("Pending");
  expect((await finalize(r)).current_version).toBe("1");await review(s);
  expect((await rows("select * from public.documents")).every(d=>d.status==="Pending"&&d.upload_version==="0")).toBe(true);
  expect(await rows("select * from public.document_versions")).toHaveLength(0);
 });
 it.each([[],Array(11).fill(manifest[0]),[{...manifest[0],mime:"text/html"}],[{...manifest[0],size:0}],[{...manifest[0],size:10485761}],[{...manifest[0],size:1.5}],[{...manifest[0],name:"\nunsafe"}],Array(6).fill({...manifest[0],size:10485760})].map(files=>[files]))("rejects invalid set %j without allocating evidence",async(files)=>{
  await expect(stage(null,id(100),files)).rejects.toThrow();expect(await rows("select * from public.submissions")).toHaveLength(0);
 });
 it("prevents finalizing partial files or mismatched metadata and cleans only abandoned evidence",async()=>{
  const r=await stage();const f=r.files[0];await act(SA,"insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)",[f.file_path,{mimetype:f.mime_type,size:20}]);
  await expect(finalize(r)).rejects.toThrow(/Complete file set/);
  expect((await rows("select current_version from public.submissions"))[0].current_version).toBe("0");
  expect(await act(SA,"delete from storage.objects where name=$1 returning id",[f.file_path])).toHaveLength(0);
  const [{result}]=await act(SA,"select public.cancel_submission($1) result",[r.id]);expect(result.committed).toBe(false);
  expect(await act(SB,"delete from storage.objects where name=$1 returning id",[f.file_path])).toHaveLength(0);
  expect(await act(SA,"delete from storage.objects where name=$1 returning id",[f.file_path])).toHaveLength(1);
  await expect(finalize(r)).rejects.toThrow(/expired|changed/);
  expect((await act(SA,"select public.submission_recovery_list() result"))[0].result.versions).toHaveLength(0);
 });
 it("requires exact MIME/size and preserves old committed files, explanations and identities",async()=>{
  const {r,s}=await uploaded();await expect(review(s,"Needs Revision"," ")).rejects.toThrow(/explanation/);
  const revised=await review(s,"Needs Revision","Please include a signature.");
  const next=await stage(revised,id(101));await put(next);const current=await finalize(next);
  expect(current).toMatchObject({status:"Pending",note:null,reviewed_by:null,current_version:"2",review_revision:"0"});
  const old=(await rows("select * from public.submission_versions where id=$1",[r.id]))[0];
  expect(old.note).toBe("Please include a signature.");expect(old.reviewed_by).toBe(IA);expect(old.reviewed_at).toBeTruthy();
  expect(await act(IA,"select * from storage.objects")).toHaveLength(4);
  expect(await act(SA,"delete from storage.objects returning id")).toHaveLength(0);
  const [{result}]=await act(SA,"select public.cancel_submission($1) result",[r.id]);expect(result.committed).toBe(true);expect(result.version).toBe(1);
  expect(await rows("select * from public.submission_reviews")).toHaveLength(1);
 });
 it("rejects stale reviews, concurrent replacement reservations and changed review finalization",async()=>{
  const {s}=await uploaded();const staged=await stage(s,id(101));await put(staged);const approved=await review(s);
  await expect(review(s,"Needs Revision","Stale note")).rejects.toThrow(/changed/);
  await expect(finalize(staged)).rejects.toThrow(/changed/);
  const a=await stage(approved,id(102)),b=await stage(approved,id(103));await put(a);await put(b);await finalize(a);
  await expect(finalize(b)).rejects.toThrow(/changed/);
 });
 it.each([null,IB,SB])("isolates files and reviews from actor %s",async(actor)=>{
  const {r,s}=await uploaded();
  for(const t of ["submissions","submission_versions","submission_files"]){
   if(actor===null)await expect(act(actor,`select * from public.${t}`)).rejects.toThrow(/permission denied/);
   else expect(await act(actor,`select * from public.${t}`)).toHaveLength(0);
  }
  expect(await act(actor,"select * from storage.objects")).toHaveLength(0);
  await expect(review(s,"Approved",null,actor)).rejects.toThrow();
  await expect(act(actor,"select public.submission_file_access($1,$2)",[r.files[0].id,r.id])).rejects.toThrow();
  await expect(act(actor,"select public.cancel_submission($1)",[r.id])).rejects.toThrow();
 });
 it.each(["Pending","Inactive"])("denies inactive owner and assigned staff: %s",async(status)=>{
  const {r,s}=await uploaded();await db.query("update public.profiles set status=$1 where id=$2",[status,SA]);
  expect(await act(SA,"select * from public.submission_files")).toHaveLength(0);await expect(finalize(r)).rejects.toThrow();
  // Staff deactivation requires explicit unassignment first, preserving M07.
  await act(ADMIN,"select public.admin_set_assignment($1,null,null,null,486)",[SA]);
  await db.query("update public.profiles set status=$1 where id=$2",[status,IA]);
  await expect(review(s)).rejects.toThrow();
 });
 it("assigned staff cannot see uncommitted files and lose access after reassignment",async()=>{
  const r=await stage();await put(r);expect(await act(IA,"select * from public.submission_files")).toHaveLength(0);
  const s=await finalize(r);expect(await act(IA,"select * from public.submission_files")).toHaveLength(2);
  await act(ADMIN,"select public.admin_set_assignment($1,$2,null,null,486)",[SA,IB]);
  expect(await act(IA,"select * from public.submission_files")).toHaveLength(0);
  expect(await act(IB,"select * from public.submission_files")).toHaveLength(2);await expect(review(s)).rejects.toThrow();
 });
 it("denies raw writes even if an extra permissive policy/grant is added",async()=>{
  const {s}=await uploaded();
  for(const t of ["submissions","submission_versions","submission_files","submission_reviews"]){
   await db.query(`grant insert,update,delete on public.${t} to authenticated`);
   await db.query(`create policy synthetic_bypass on public.${t} for all to authenticated using(true) with check(true)`);
   expect(await act(SA,`delete from public.${t} returning id`)).toHaveLength(0);
   expect(await act(SB,`select * from public.${t}`)).toHaveLength(0);
  }
  expect(await act(SA,"update public.submissions set status='Approved' where id=$1 returning id",[s.id])).toHaveLength(0);
 });
 it("audit faults roll back finalization and review as complete transactions",async()=>{
  const r=await stage();await put(r);
  await db.query("create function public.synthetic_audit_fail() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit fault'; end $$; create trigger synthetic_audit_fail before insert on public.audit_logs for each row execute function public.synthetic_audit_fail()");
  await expect(finalize(r)).rejects.toThrow(/Synthetic audit fault/);
  expect((await rows("select committed_at from public.submission_versions"))[0].committed_at).toBeNull();
  expect((await rows("select current_version from public.submissions"))[0].current_version).toBe("0");
  await db.query("drop trigger synthetic_audit_fail on public.audit_logs");const s=await finalize(r);
  await db.query("create trigger synthetic_audit_fail before insert on public.audit_logs for each row execute function public.synthetic_audit_fail()");
  await expect(review(s)).rejects.toThrow(/Synthetic audit fault/);
  expect(await rows("select * from public.submission_reviews")).toHaveLength(0);
  expect((await rows("select status from public.submissions"))[0].status).toBe("Pending");
 });
 it("M08 single-file legacy uploads still finalize and review without flexible approvals",async()=>{
  await act(ADMIN,"select public.attach_standard_docs($1)",[SA]);
  const [d]=await act(SA,"select * from public.documents where doc_type='moa'");
  const [{result}]=await act(SA,"select public.stage_document_upload($1,'Legacy checklist.pdf','application/pdf',20,0) result",[d.id]);
  await act(SA,"insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)",[result.upload.file_path,{mimetype:"application/pdf",size:20}]);
  const [current]=await act(SA,"select * from public.finalize_document_upload($1)",[result.upload.id]);
  const [approved]=await act(IA,"select * from public.review_document_version($1,'Approved',null,1,0)",[current.id]);
  expect(approved.status).toBe("Approved");expect(await rows("select * from public.submissions")).toHaveLength(0);
 });
 it("expired reservations and missing file metadata cannot become reviewed evidence",async()=>{
  const r=await stage();await put(r);
  await db.query("update public.submission_versions set expires_at=clock_timestamp()-interval '1 second' where id=$1",[r.id]);
  await expect(finalize(r)).rejects.toThrow(/expired/);
  const newer=await stage(null,id(102));await put(newer);const s=await finalize(newer);
  await db.query("update storage.objects set metadata=$1 where name=$2",[{mimetype:"image/png",size:999},newer.files[0].file_path]);
  await expect(review(s)).rejects.toThrow(/Complete committed/);expect(await rows("select * from public.submission_reviews")).toHaveLength(0);
 });
});
describe("M11 Admin impact and full audit history",()=>{
 it("assigns real sections with the existing RPC and preserves links while archiving",async()=>{
  const [{id:section}]=await act(ADMIN,"insert into public.course_sections(name) values('Synthetic section') returning id");
  await act(ADMIN,"select public.admin_set_assignment($1,$2,null,$3,486)",[SA,IA,section]);
  expect((await act(IA,"select section_id from public.interns where id=$1",[SA]))[0].section_id).toBe(section);
  expect(await act(IB,"select * from public.interns where id=$1",[SA])).toHaveLength(0);
  const [{result}]=await act(ADMIN,"select public.admin_master_impact('course_sections',$1) result",[section]);expect(result.references).toBe(1);
  await expect(act(ADMIN,"select public.admin_archive_master('course_sections',$1,0)",[section])).rejects.toThrow(/impact changed/);
  await act(ADMIN,"select public.admin_archive_master('course_sections',$1,1)",[section]);
  expect((await rows("select section_id from public.interns where id=$1",[SA]))[0].section_id).toBe(section);
  await expect(act(ADMIN,"select public.admin_set_assignment($1,$2,null,$3,486)",[SB,IB,section])).rejects.toThrow(/Archived section/);
  await expect(act(ADMIN,"delete from public.course_sections where id=$1",[section])).rejects.toThrow(/permission denied/);
 });
 it("protects current years and archival authorization",async()=>{
  const [{id:year}]=await act(ADMIN,"insert into public.academic_years(label) values('Synthetic year') returning id");
  await act(ADMIN,"update public.academic_years set is_current=true where id=$1",[year]);
  await expect(act(ADMIN,"select public.admin_archive_master('academic_years',$1,0)",[year])).rejects.toThrow(/current/);
  await expect(act(IA,"select public.admin_master_impact('academic_years',$1)",[year])).rejects.toThrow(/Admin/);
 });
 it("filters beyond the newest 50, includes both Manila boundaries, and clamps deterministic pages",async()=>{
  await db.query("insert into public.audit_logs(id,actor_name,action,detail,created_at) select gen_random_uuid(),'Newer actor','other','Synthetic','2026-10-09T00:00:00Z' from generate_series(1,80)");
  await db.query("insert into public.audit_logs(id,actor_name,action,detail,created_at) values($1,'Historical actor','important','Synthetic','2026-09-30T16:00:00Z'),($2,'Historical actor','important','Synthetic','2026-10-01T15:59:59.999Z'),($3,'Historical actor','important','Synthetic','2026-10-01T16:00:00Z')",[id(501),id(502),id(503)]);
  const [{result}]=await act(ADMIN,"select public.audit_history('Historical actor','important','','2026-10-01','2026-10-01',99,10) result");
  expect(result.total).toBe(2);expect(result.page).toBe(1);expect(result.rows.map(r=>r.id)).toEqual([id(502),id(501)]);
  expect(result.rows.every(r=>r.source===null)).toBe(true);
  const all=(await act(ADMIN,"select public.audit_history('Newer actor','','',null,null,2,25) result"))[0].result;
  expect(all.total).toBe(80);expect(all.rows).toHaveLength(25);
  await expect(act(IA,"select public.audit_history()")).rejects.toThrow(/Admin/);
  await expect(act(ADMIN,"select public.audit_history('','','','2026-10-02','2026-10-01')")).rejects.toThrow(/Start date/);
 });
 it("archive audit failures preserve the entry and references",async()=>{
  const [{id:company}]=await act(ADMIN,"insert into public.companies(name) values('Preserve company') returning id");
  await act(ADMIN,"select public.admin_set_assignment($1,$2,$3,null,486)",[SA,IA,company]);
  await db.query("create function public.synthetic_audit_fail() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit fault'; end $$; create trigger synthetic_audit_fail before insert on public.audit_logs for each row execute function public.synthetic_audit_fail()");
  await expect(act(ADMIN,"select public.admin_archive_master('companies',$1,1)",[company])).rejects.toThrow(/Synthetic audit fault/);
  expect((await rows("select archived_at from public.companies where id=$1",[company]))[0].archived_at).toBeNull();
  expect((await rows("select company_id from public.interns where id=$1",[SA]))[0].company_id).toBe(company);
 });
});

// Actual separate connections; observe both lock waits before releasing them.
async function race(first,second) {
 const blocker=await cluster.connect(),clients=await Promise.all([cluster.connect(),cluster.connect()]);
 let pending=[];
 try {
  await blocker.query("begin; select pg_advisory_xact_lock(404,1)");
  const pids=[];
  for(const [i,c] of clients.entries()) {
   await c.query("begin; set local role authenticated");
   await c.query("select set_config('request.jwt.claim.sub',$1,true)",[(i===0?first:second).actor]);
   pids.push((await c.query("select pg_backend_pid() id")).rows[0].id);
  }
  pending=clients.map(async(c,i)=>{
   const op=i===0?first:second;
   try {const result=await c.query(op.query,op.args);await c.query("commit");return {ok:true,rows:result.rows};}
   catch(error){await c.query("rollback");return {ok:false,error};}
  });
  let observed=false;
  for(let i=0;i<60;i++) {
   const [{n}]=await rows("select count(*)::integer n from pg_stat_activity where pid=any($1::integer[]) and wait_event='advisory'",[pids]);
   if(n===2){observed=true;break;} await new Promise(resolve=>setTimeout(resolve,25));
  }
  expect(observed).toBe(true);await blocker.query("commit");return await Promise.all(pending);
 }finally{await blocker.query("rollback");await Promise.allSettled(pending);await Promise.all(clients.map(c=>c.end()));await blocker.end();}
}
async function cleanRace() {
 await db.query("truncate public.submissions,public.submission_versions,public.submission_files,public.submission_reviews,storage.objects cascade");
 await db.query("begin");
}
describe("M10 observed native races",()=>{
 it("two reviewers of the same version produce one committed decision and event",async()=>{
  const {s}=await uploaded();await db.query("commit");
  try {
   const op={actor:IA,query:"select * from public.review_submission($1,1,0,$2,$3)",args:[s.id,"Approved",null]};
   const outcomes=await race(op,{...op,args:[s.id,"Needs Revision","Please sign"]});
   expect(outcomes.filter(r=>r.ok)).toHaveLength(1);expect(outcomes.find(r=>!r.ok).error.code).toBe("40001");
   expect(await rows("select * from public.submission_reviews")).toHaveLength(1);
  }finally{await cleanRace();}
 });
 it("competing complete replacements commit exactly one new version",async()=>{
  const {s}=await uploaded();const a=await stage(s,id(101)),b=await stage(s,id(102));await put(a);await put(b);await db.query("commit");
  try {
   const query="select * from public.finalize_submission($1)";
   const outcomes=await race({actor:SA,query,args:[a.id]},{actor:SA,query,args:[b.id]});
   expect(outcomes.filter(r=>r.ok)).toHaveLength(1);
   expect((await rows("select current_version from public.submissions"))[0].current_version).toBe("2");
   expect(await rows("select * from public.submission_versions where committed_at is not null")).toHaveLength(2);
  }finally{await cleanRace();}
 });
 it("cancel/finalize serialization never authorizes deletion of committed evidence",async()=>{
  const r=await stage();await put(r);await db.query("commit");
  try {
   const outcomes=await race({actor:SA,query:"select public.cancel_submission($1) result",args:[r.id]},
    {actor:SA,query:"select * from public.finalize_submission($1)",args:[r.id]});
   const v=(await rows("select * from public.submission_versions where id=$1",[r.id]))[0];
   if(v.committed_at){expect(outcomes[0].rows[0].result.committed).toBe(true);expect(v.abandoned_at).toBeNull();}
   else {expect(v.abandoned_at).toBeTruthy();expect(outcomes[1].ok).toBe(false);}
   await db.query("begin");
   const deletable=(await act(SA,"select public.can_delete_staged_document($1) allowed",[r.files[0].file_path]))[0].allowed;
   expect(deletable).toBe(!v.committed_at);await db.query("commit");
  }finally{await cleanRace();}
 });
});

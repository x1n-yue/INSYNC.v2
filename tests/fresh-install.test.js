// Exact fresh-install artifact against our OWN isolated PostgreSQL provider doubles.
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,beforeEach,afterEach,describe,it,expect} from 'vitest';
import {disposablePostgres} from './disposable-postgres';
import {internMetrics} from '../src/lib/metrics';
const sql=f=>readFileSync(new URL(`../supabase/${f}`,import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),IA=id(2),IB=id(3),SA=id(4),SB=id(5),P=id(6);let cluster,db;
async function act(actor,query,args=[]){
 await db.query('savepoint operation');
 try{
  await db.query(actor?'set local role authenticated':'set local role anon');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor||'']);
  const rows=(await db.query(query,args)).rows;await db.query('set constraints all immediate');
  await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub','',true)");await db.query('set constraints all deferred');await db.query('release savepoint operation');return rows;
 }catch(e){await db.query('rollback to savepoint operation');await db.query('reset role');await db.query('release savepoint operation');throw e;}
}
beforeAll(async()=>{
 cluster=await disposablePostgres();db=await cluster.connect();await db.query(sql('tests/baseline.sql').split('create table public.companies')[0]);
 await db.query(`alter table auth.users add column deleted_at timestamptz,add column email_confirmed_at timestamptz;
 update storage.buckets set file_size_limit=10485760,allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'] where id='documents';
 grant all on storage.objects to authenticated,anon;`);
 for(const actor of [A,IA,IB,SA,SB,P])await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{\"role\":\"admin\"}')",[actor,`${actor}@example.invalid`]);
 await db.query(sql('INSync_Fresh_Install.sql'));
 expect((await db.query("select count(*)::int n from public.profiles where role='intern' and status='Pending'")).rows[0].n).toBe(6);
 await db.query("update public.profiles set role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end,status=case when id=$4 then 'Pending' else 'Active' end",[A,IA,IB,P]);
},60000);
afterAll(async()=>{if(cluster)await cluster.stop();},30000);
beforeEach(async()=>{await db.query('begin');await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SA,IA]);await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SB,IB]);});
afterEach(async()=>{await db.query('rollback');});
describe('fresh artifact real PostgreSQL workflows',()=>{
 it('installs validated constraints, complete RLS and exact protected RPC signatures',async()=>{
  const rows=(await db.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'")).rows;expect(rows).toHaveLength(18);expect(rows.every(r=>r.relrowsecurity)).toBe(true);
  expect((await db.query("select count(*)::int n from pg_constraint x join pg_class c on c.oid=x.conrelid where c.relnamespace='public'::regnamespace and not convalidated")).rows[0].n).toBe(0);
  for(const signature of ['public.send_announcement(uuid,text,text,uuid)','public.verify_attendance(uuid,timestamptz,timestamptz)']){
   const [r]=(await db.query('select has_function_privilege($1,$2,$3) auth,has_function_privilege($4,$2,$3) anon',['authenticated',signature,'EXECUTE','anon'])).rows;expect(r).toEqual({auth:true,anon:false});
  }
 });
 it('supports scoped profile access while Pending identities cannot access internship records',async()=>{
  expect((await act(IA,'select public.my_profile() p'))[0].p.id).toBe(IA);
  expect(await act(P,'select * from public.interns')).toEqual([]);
  expect(await act(SA,'select id from public.interns')).toEqual([{id:SA}]);
  expect(await act(IA,'select id from public.interns')).toEqual([{id:SA}]);
  await expect(act(null,'select * from public.profiles')).rejects.toThrow(/permission denied/);
 });
 it('freezes individual/active-roster recipients atomically and denies cross-instructor targets',async()=>{
  await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[P,IA]);
  const [row]=await act(IA,"select * from public.send_announcement($1,'Fixture','No real delivery',null)",[id(100)]);expect(row.recipient_ids).toEqual([SA]);
  await expect(act(IA,"select public.send_announcement($1,'Denied','No', $2)",[id(101),SB])).rejects.toMatchObject({code:'42501'});
  await act(A,'select public.admin_set_assignment($1,$2,null,null,8)',[SA,IB]);
  expect((await act(SA,'select recipient_ids from public.announcements'))[0].recipient_ids).toEqual([SA]);
  expect((await act(IA,"select * from public.send_announcement($1,'Fixture','No real delivery',null)",[id(100)]))[0].id).toBe(row.id);
 });
 it('verifies eligible closed attendance once, preserves hours and rejects stale/foreign reviews',async()=>{
  const [row]=(await db.query(`insert into public.attendance_logs(intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified)
   values($1,'2026-10-01','08:00','16:00','2026-10-01T00:00:00Z','2026-10-01T08:00:00Z',8,false) returning *`,[SA])).rows;
  const query='select * from public.verify_attendance($1,$2,$3)',args=[row.id,row.clocked_in_at,row.clocked_out_at];
  await expect(act(IB,query,args)).rejects.toMatchObject({code:'42501'});
  await expect(act(IA,query,[row.id,row.clocked_in_at,'2026-10-01T09:00:00Z'])).rejects.toMatchObject({code:'40001'});
  expect((await act(IA,query,args))[0]).toMatchObject({hours:'8',verified:true,verified_by:IA});
  const count=(await db.query('select count(*)::int n from public.audit_logs')).rows[0].n;
  await act(IA,query,args);expect((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n).toBe(count);
 });
 it('supports versioned standard/flexible submissions and clearance remains separate',async()=>{
  await act(A,'select public.attach_standard_docs($1)',[SA]);
  const [r]=await act(SA,"select public.stage_submission($1,null,'MOA','Flexible only',$2,0,0) r",[id(200),JSON.stringify([{name:'Evidence.pdf',mime:'application/pdf',size:20}])]);
  const staged=r.r;
  for(const f of staged.files)await act(SA,"insert into storage.objects(bucket_id,name,metadata) values('documents',$1,'{\"size\":20,\"mimetype\":\"application/pdf\"}')",[f.file_path]);
  const [s]=await act(SA,'select * from public.finalize_submission($1)',[staged.id]);
  await act(IA,"select public.review_submission($1,1,0,'Approved',null)",[s.id]);
  const readDocs=()=>act(SA,'select * from public.documents');
  const pending=await readDocs();expect(pending).toHaveLength(4);expect(pending.every(d=>d.status==='Pending')).toBe(true);
  for(const d of pending){
   const [v]=await act(SA,"select public.stage_document_upload($1,'Evidence.pdf','application/pdf',20,0) r",[d.id]);
   await act(SA,"insert into storage.objects(bucket_id,name,metadata) values('documents',$1,'{\"size\":20,\"mimetype\":\"application/pdf\"}')",[v.r.upload.file_path]);
   await act(SA,'select public.finalize_document_upload($1)',[v.r.upload.id]);
   await expect(act(IB,"select public.review_document_version($1,'Approved',null,1,0)",[d.id])).rejects.toThrow();
   await act(IA,"select public.review_document_version($1,'Approved',null,1,0)",[d.id]);
  }
  const docs=await readDocs();const metric=internMetrics({internId:SA,required:8,attendance:[],documents:docs});expect(metric.cleared).toBe(false);expect(metric.approved).toBe(4);
  expect(await act(SB,'select * from public.documents')).toEqual([]);
 });
 it('uses server-scored rubric and own/assigned evaluation visibility',async()=>{
  const [r]=await act(IA,'select * from public.submit_evaluation($1,$2,$3,$4)',[SA,{punctuality:5,performance:4,conduct:3,communication:2},'Synthetic feedback',id(300)]);
  expect(Number(r.overall_score)).toBe(73);expect((await act(SA,'select overall_score from public.evaluations'))[0].overall_score).toBe('73');
  expect(await act(SB,'select * from public.evaluations')).toEqual([]);
 });
 it('preserves the existing last-Active-Admin safeguard',async()=>{
  await expect(act(A,"select public.admin_update_account($1,'{\"status\":\"Inactive\"}')",[A])).rejects.toMatchObject({code:'23514'});
  expect((await db.query('select status from public.profiles where id=$1',[A])).rows[0].status).toBe('Active');
 });
});

// Native, disposable PostgreSQL only. Exercise real M17 records before M18.
import { readFileSync } from 'node:fs';
import { it,expect } from 'vitest';
import { disposablePostgres } from './disposable-postgres';
const sql=f=>readFileSync(new URL(`../supabase/${f}`,import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
it('upgrades genuine M17 evidence/attendance without changing it, retains populated M18 drafts on updater reruns, and verifies old attendance',async()=>{
 const cluster=await disposablePostgres();
 try {
  const db=await cluster.connect();await db.query(sql('tests/baseline.sql'));
  for(const migration of ['M01_authority','M02_trusted_audit','M03_attendance_integrity','M04_private_documents_bucket','M06_rubric_hours','M07_account_lifecycle','M08_document_versions','M10_flexible_submissions','M11_admin_history','M12_handover_workflows','M13_coordinator_operations','M14_last_admin_protection','M15_supervisor_evaluations','M16_evaluation_controls','M17_company_attendance'])await db.query(sql(`migrations/${migration}.sql`));
  const act=async(actor,query,args=[])=>{
   await db.query('begin');try{await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const result=(await db.query(query,args)).rows;await db.query('commit');return result;}catch(e){await db.query('rollback');throw e;}
  };
  for(const n of [1,2,3,4])await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`upgrade-${n}@example.invalid`]);
  await db.query("update public.profiles set status='Active',role=case when id=$1 then 'admin' when id=$2 then 'instructor' else 'intern' end",[id(1),id(2)]);
  await db.query("insert into public.companies(id,name) values($1,'Historical company')",[id(10)]);
  await act(id(1),'select public.admin_set_assignment($1,$2,$3,null,100)',[id(3),id(2),id(10)]);
  await act(id(1),'select public.admin_update_account($1,$2)',[id(4),{role:'supervisor',company_id:id(10)}]);await act(id(1),'select public.admin_set_supervision($1,$2,true)',[id(4),id(3)]);
  const [e]=await act(id(2),'select * from public.stage_attendance_sheet($1,$2,$3,$4,$5,$6)',[id(100),id(10),[id(3)],'historical.pdf','application/pdf',512]);
  await act(id(2),"insert into storage.objects(bucket_id,name,metadata) values('attendance-evidence',$1,$2)",[e.file_path,{mimetype:'application/pdf',size:512}]);await act(id(2),'select public.finish_attendance_sheet($1)',[e.id]);
  const [old]=await act(id(2),'select * from public.record_manual_attendance($1,$2,$3,$4,$5,$6)',[id(101),id(3),'2026-01-02T00:00:00Z','2026-01-02T08:00:00Z',e.id,{company_on_sheet:'Paper company',supervisor_on_sheet:'Paper signatory',fallback_reason:'system_unavailable',reason_explanation:'',remarks:'Original remarks retained',signatures_reviewed:true}]);
  const snapshot=async()=>{
   const result={};for(const table of ['attendance_logs','attendance_sheet_evidence','manual_attendance_events','attendance_exceptions','audit_logs','supervisor_assignments','logbook_submissions','logbook_versions','logbook_events'])
    if((await db.query('select to_regclass($1) present',[`public.${table}`])).rows[0].present)result[table]=(await db.query(`select to_jsonb(t) value from public.${table} t order by coalesce(to_jsonb(t)->>'id',to_jsonb(t)->>'submission_id'),to_jsonb(t)->>'version'`)).rows;
   result.objects=(await db.query('select to_jsonb(o) value from storage.objects o order by id')).rows;return result;
  };
  const before=await snapshot();await db.query(sql('migrations/M18_supervisor_logbook.sql'));const after=await snapshot();
  for(const [table,rows] of Object.entries(before)){expect(after[table]).toHaveLength(rows.length);rows.forEach((row,n)=>expect(after[table][n].value).toMatchObject(row.value));}
  await act(id(4),'select public.save_logbook_draft($1,$2,$3,$4,$5,$6,1,0)',[id(102),id(3),'2026-01-03','2026-01-03','Keep private draft',[]]);const populated=await snapshot();
  await db.query(sql('INSync_Consolidated_Update.sql'));await db.query(sql('INSync_Consolidated_Update.sql'));expect(await snapshot()).toEqual(populated);
  await expect(act(id(2),'select public.stage_attendance_sheet($1,$2,$3,$4,$5,$6)',[id(103),id(10),[id(3)],'new.pdf','application/pdf',512])).rejects.toThrow(/permission denied/);
  const [verified]=await act(id(2),'select * from public.verify_manual_attendance($1,$2,$3,$4,$5,true)',[old.id,old.manual_revision,e.id,old.clocked_in_at,old.clocked_out_at]);
  expect(verified.verified).toBe(true);expect(verified.logbook_submission_id).toBe(null);expect(verified.manual_details.remarks).toBe('Original remarks retained');
 }finally{await cluster.stop();}
},60000);

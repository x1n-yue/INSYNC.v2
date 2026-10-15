import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,beforeEach,afterEach,it,expect } from 'vitest';
import { disposablePostgres } from './disposable-postgres';
import { FEEDBACK_CATALOG, emptyChoices, feedbackText } from '../src/lib/evaluationFeedback';
const sql=f=>readFileSync(new URL(`../supabase/${f}`,import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),C=id(2),D=id(3),S=id(4),I=id(5),J=id(6),COMPANY=id(10),OTHER=id(11),E=id(100),LEGACY=id(101);
const ratings={punctuality:4,performance:5,conduct:3,communication:2};
const selected={strengths:['quality'],improvements:['communication'],guidance:['ask'],overall:['progress']};
let cluster,db;
async function act(actor,query,args=[]) {
  await db.query('savepoint operation');
  try {
    await db.query(actor?'set local role authenticated':'set local role anon');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor||'']);
    const result=(await db.query(query,args)).rows;await db.query('set constraints all immediate');await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub','',true)");await db.query('set constraints all deferred');await db.query('release savepoint operation');return result;
  }catch(e){await db.query('rollback to savepoint operation');await db.query('reset role');await db.query('release savepoint operation');throw e;}
}
const submit=(key=E)=>act(S,'select * from public.save_supervisor_evaluation($1,$2,$3,$4,$5,0,true)',[key,I,'2026-10-14',ratings,'PRIVATE SUPERVISOR']);
function save({actor=C,key=E,revision=0,criteria=ratings,adjustments={},choices=selected,remarks='',publish=false,mode='selected',written={summary:'Written summary',strengths:'Written strength',improvements:'Written improvement',guidance:'Written guidance'},expected}={}) {
  return act(actor,'select * from public.save_evaluation_review_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[key,revision,mode,JSON.stringify(choices),remarks,written,criteria,adjustments,expected||(mode==='selected'?feedbackText(choices,remarks):written),publish]);
}
beforeAll(async()=>{
  cluster=await disposablePostgres();db=await cluster.connect();await db.query(sql('tests/baseline.sql'));
  for(const name of ['M01_authority','M02_trusted_audit','M03_attendance_integrity','M04_private_documents_bucket','M06_rubric_hours','M07_account_lifecycle','M08_document_versions','M10_flexible_submissions','M11_admin_history','M12_handover_workflows','M13_coordinator_operations','M14_last_admin_protection','M15_supervisor_evaluations'])await db.query(sql(`migrations/${name}.sql`));
  for(const actor of [A,C,D,S,I,J])await db.query('insert into auth.users(id,email) values($1,$2)',[actor,`${actor}@example.invalid`]);
  await db.query("update public.profiles set role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end,status='Active'",[A,C,D]);
  await db.query('insert into public.companies(id,name) values($1,$2),($3,$4)',[COMPANY,'Company A',OTHER,'Company B']);
  await db.query('begin');await act(A,'select public.admin_update_account($1,$2)',[S,{role:'supervisor',company_id:COMPANY}]);
  await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,C,COMPANY]);await act(A,'select public.admin_set_supervision($1,$2,true)',[S,I]);
  await submit(LEGACY);await act(C,'select public.save_evaluation_review($1,0,$2,$3,$4,$5,$6,$7,false)',[LEGACY,'Saved written summary','Saved written strength','Saved improvement','Saved guidance',{...ratings,punctuality:5},'Saved legacy explanation']);
  await db.query('commit');
  const before=(await db.query('select summary,strengths,improvements,guidance,criteria,adjustment_reason,revision,status from public.evaluation_reviews where id=$1',[LEGACY])).rows[0];
  await db.query(sql('migrations/M16_evaluation_controls.sql'));
  expect((await db.query('select summary,strengths,improvements,guidance,criteria,adjustment_reason,revision,status from public.evaluation_reviews where id=$1',[LEGACY])).rows[0]).toEqual(before);
},60000);
afterAll(async()=>{if(cluster)await cluster.stop();},30000);
beforeEach(async()=>{await db.query('begin');await submit();});
afterEach(async()=>{await db.query('rollback');});

it('mirrors the exact client catalog and deterministic templates without numeric observations',async()=>{
  expect((await db.query('select public.evaluation_feedback_catalog() c')).rows[0].c).toEqual(FEEDBACK_CATALOG);
  const text=(await db.query('select public.evaluation_feedback_text($1,$2) feedback',[selected,'  José reviewed the current work.\n'])).rows[0].feedback;
  expect(text).toEqual(feedbackText(selected,'  José reviewed the current work.\n'));
  expect((await db.query('select public.evaluation_feedback_text($1,$2) feedback',[emptyChoices(),''])).rows[0].feedback).toEqual({summary:'',strengths:'',improvements:'',guidance:''});
});
it('saves/restores selections and remarks; standard publication needs no written input',async()=>{
  const [draft]=await save();expect(draft).toMatchObject({feedback_mode:'selected',feedback_catalog_version:1,criteria:ratings,additional_remarks:'',summary:feedbackText(selected).summary,status:'Coordinator Draft'});
  const [restored]=await act(C,'select * from public.evaluation_reviews where id=$1',[E]);expect(restored.feedback_choices).toEqual(selected);
  const [published]=await save({revision:draft.revision,publish:true});expect(published.status).toBe('Published to Intern');
  const [final]=await act(I,'select * from public.evaluations where source_evaluation_id=$1',[E]);expect(final).toMatchObject({feedback:feedbackText(selected).summary,strengths:feedbackText(selected).strengths,overall_score:'75'});
  expect(JSON.stringify(final)).not.toMatch(/feedback_choices|adjustment_reasons|PRIVATE SUPERVISOR/);
  expect((await save({revision:draft.revision,publish:true}))[0].final_evaluation_id).toBe(final.id);
});
it('draft remarks survive and preview mismatch prevents publication or partial persistence',async()=>{
  const [draft]=await save({remarks:'Additional selected remarks.'});expect(draft.additional_remarks).toBe('Additional selected remarks.');
  await expect(save({revision:draft.revision,publish:true,remarks:'Additional selected remarks.',expected:{...feedbackText(selected),summary:'Forged expected text'}})).rejects.toThrow(/preview changed/);
  expect((await db.query('select status from public.evaluation_reviews where id=$1',[E])).rows[0].status).toBe('Coordinator Draft');
  expect((await db.query('select count(*)::int n from public.evaluations')).rows[0].n).toBe(0);
});
it('server rejects unknown, duplicate, contradictory or malformed feedback choices',async()=>{
  for(const choices of [{...selected,strengths:['unknown']},{...selected,overall:['progress','meeting']},{...selected,improvements:['none','communication']},{...selected,strengths:['quality','quality']},{...selected,strengths:['communication']},{...selected,overall:['development'],improvements:['none']},{...selected,strengths:[4]}]) {
    await expect(save({choices,expected:{summary:'Bypass',strengths:'',improvements:'',guidance:''}})).rejects.toThrow(/Unknown|duplicate|compatible|contradict|Feedback/);
  }
  await expect(save({choices:emptyChoices(),publish:true})).rejects.toThrow(/overall feedback/);
});
it('requires a reason for EVERY changed criterion, accepts explicit presets, records original/final/actor',async()=>{
  const criteria={...ratings,punctuality:5,communication:3};
  const adjustments={punctuality:{code:'attendance_records',explanation:''},communication:{code:'supervisor_clarification',explanation:''}};
  await expect(save({criteria})).rejects.toThrow(/changed criterion/);
  await expect(save({criteria,adjustments:{punctuality:adjustments.punctuality}})).rejects.toThrow(/communication/);
  const [draft]=await save({criteria,adjustments});expect(draft.adjustment_reasons).toEqual(adjustments);
  const events=await act(C,'select criterion,original_rating,final_rating,coordinator_id,reason_code from public.evaluation_adjustment_events order by criterion');
  expect(events).toEqual([{criterion:'communication',original_rating:2,final_rating:3,coordinator_id:C,reason_code:'supervisor_clarification'},{criterion:'punctuality',original_rating:4,final_rating:5,coordinator_id:C,reason_code:'attendance_records'}]);
  await expect(act(C,'delete from public.evaluation_adjustment_events')).rejects.toThrow(/permission denied/);
  for(const query of ["update public.evaluation_adjustment_events set reason_text='Replaced' where source_id=$1",'delete from public.evaluation_adjustment_events where source_id=$1']) {
    await db.query('savepoint immutable_check');
    await expect(db.query(query,[E])).rejects.toThrow(/immutable/);
    await db.query('rollback to savepoint immutable_check');await db.query('release savepoint immutable_check');
  }
  await save({revision:draft.revision,criteria,adjustments,publish:true});
  expect((await act(I,'select overall_score from public.evaluations'))[0].overall_score).toBe('84');
  expect((await act(C,'select overall_score from public.supervisor_evaluations where id=$1',[E]))[0].overall_score).toBe(75);
});
it('Other requires a meaningful written explanation and reason codes cannot be forged',async()=>{
  const criteria={...ratings,conduct:4};
  for(const reason of [{code:'other',explanation:''},{code:'other',explanation:'.............'},{code:'other',explanation:'  short '},{code:'attendance_records',explanation:''},{code:'generic',explanation:''},{code:'conduct_evidence',explanation:'hidden text'}])await expect(save({criteria,adjustments:{conduct:reason}})).rejects.toThrow(/meaningful|valid reason|hidden explanations/);
  const [r]=await save({criteria,adjustments:{conduct:{code:'other',explanation:'Reviewed the documented workplace conduct discussion.'}}});expect(r.adjustment_reason).toContain('documented workplace');
  await expect(save({revision:r.revision,criteria:ratings,adjustments:r.adjustment_reasons})).rejects.toThrow(/match changed/);
  const explanation=('Reviewed documented criterion evidence: '+'a'.repeat(500)).slice(0,500);
  const allReasons=Object.fromEntries(Object.keys(ratings).map(key=>[key,{code:'other',explanation}]));
  const [longDraft]=await save({revision:r.revision,criteria:{punctuality:5,performance:4,conduct:4,communication:3},adjustments:allReasons});
  expect(longDraft.adjustment_reasons).toEqual(allReasons);expect(longDraft.adjustment_reason.length).toBeLessThanOrEqual(2000);
  const fullReasons=await act(C,'select reason_text from public.evaluation_adjustment_events where source_id=$1 and review_revision=$2',[E,longDraft.revision]);
  expect(fullReasons).toHaveLength(4);expect(fullReasons.every(event=>event.reason_text===explanation)).toBe(true);
});
it('the old M15 RPC cannot bypass per-criterion reasons; unchanged written evaluations remain compatible',async()=>{
  await expect(act(C,'select public.save_evaluation_review($1,0,$2,$3,$4,$5,$6,$7,true)',[E,'Old client summary','','','',{...ratings,conduct:4},'Generic reason'])).rejects.toThrow(/valid reason/);
  const [result]=await act(C,'select * from public.save_evaluation_review($1,0,$2,$3,$4,$5,$6,$7,true)',[E,'Old written summary','','','',ratings,'']);expect(result.status).toBe('Published to Intern');
});
it('preserves written drafts and legacy explanations; explicit selected conversion retains the written version',async()=>{
  const [legacy]=await act(C,'select * from public.evaluation_reviews where id=$1',[LEGACY]);expect(legacy).toMatchObject({feedback_mode:null,summary:'Saved written summary',adjustment_reason:'Saved legacy explanation'});
  await expect(save({key:LEGACY,revision:legacy.revision,criteria:legacy.criteria})).rejects.toThrow(/valid reason/);
  const [converted]=await save({key:LEGACY,revision:legacy.revision,criteria:legacy.criteria,adjustments:{punctuality:{code:'attendance_records',explanation:''}}});
  expect(converted.legacy_adjustment_reason).toBe('Saved legacy explanation');expect(converted.written_feedback.summary).toBe('Saved written summary');
  const [written]=await save({key:LEGACY,revision:converted.revision,mode:'written',criteria:legacy.criteria,adjustments:converted.adjustment_reasons,written:converted.written_feedback});expect(written.summary).toBe('Saved written summary');expect(written.feedback_choices).toEqual(selected);
});
it('does not widen role, assignment, company, raw-write or Intern visibility permissions',async()=>{
  for(const actor of [null,A,D,S,I,J])await expect(save({actor})).rejects.toThrow(/permission denied|Routed evaluation/);
  const [saved]=await save({criteria:{...ratings,conduct:4},adjustments:{conduct:{code:'conduct_evidence',explanation:''}}});
  for(const actor of [S,I,J,D])expect(await act(actor,'select * from public.evaluation_adjustment_events')).toEqual([]);
  expect(await act(I,'select * from public.evaluation_reviews')).toEqual([]);
  await expect(act(C,'update public.evaluation_reviews set adjustment_reasons=$1 where id=$2',[{},E])).rejects.toThrow(/permission denied/);
  await act(A,'select public.admin_set_supervision($1,$2,false)',[S,I]);await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,C,OTHER]);
  await expect(save({revision:saved.revision})).rejects.toThrow(/Routed evaluation/);
});
it('rerouting resets selectable/private draft metadata and preserves restricted adjustment history',async()=>{
  const [draft]=await save({criteria:{...ratings,conduct:4},adjustments:{conduct:{code:'conduct_evidence',explanation:''}},remarks:'PRIVATE REMARK'});
  await act(A,'select public.admin_set_assignment($1,$2,$3,null,8)',[I,D,COMPANY]);
  const [r]=await act(A,'select * from public.admin_reroute_evaluation($1,$2,$3,$4)',[E,D,'Explicit handover',draft.revision]);
  expect(r).toMatchObject({feedback_mode:null,feedback_choices:null,additional_remarks:'',written_feedback:null,adjustment_reasons:{},criteria:ratings,summary:''});
  expect(await act(D,'select * from public.evaluation_adjustment_events')).toEqual([]);expect(await act(C,'select * from public.evaluation_adjustment_events')).toEqual([]);
  expect((await act(A,'select * from public.evaluation_adjustment_events')).length).toBe(1);
});
it('audit failure rolls back selections, reasons, events and publication together',async()=>{
  await db.query("create function public.synthetic_m16_failure() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit failure'; end $$; create trigger fixture_failure before insert on public.audit_logs for each row execute function public.synthetic_m16_failure()");
  await expect(save({publish:true,criteria:{...ratings,conduct:4},adjustments:{conduct:{code:'conduct_evidence',explanation:''}}})).rejects.toThrow(/Synthetic audit failure/);
  expect((await db.query('select feedback_mode,revision,status from public.evaluation_reviews where id=$1',[E])).rows[0]).toEqual({feedback_mode:null,revision:0,status:'Submitted to Coordinator'});
  expect((await db.query('select count(*)::int n from public.evaluation_adjustment_events')).rows[0].n).toBe(0);expect((await db.query('select count(*)::int n from public.evaluations')).rows[0].n).toBe(0);
});

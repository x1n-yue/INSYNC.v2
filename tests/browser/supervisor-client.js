// Synthetic browser transport only. Native PostgreSQL tests enforce authority.
import {supabase as base,setupError} from './handover-client';
import {fixture} from './synthetic-client';
import {rubricScore} from '../../src/lib/business';
import {adjustmentError,feedbackText,normalizeChoices} from '../../src/lib/evaluationFeedback';
export {setupError};
const {state,me,uid,persist,owner,INSTRUCTOR}=fixture,control=window.__audit;
if(new URLSearchParams(location.search).get('role')==='supervisor')Object.assign(me,{id:uid(9),role:'supervisor',full_name:'Synthetic Supervisor',status:'Active',supervisor_company_id:uid(10)});
for(const p of [{id:uid(9),role:'supervisor',status:'Active',full_name:'Synthetic Supervisor',email:'supervisor@example.invalid',supervisor_company_id:uid(10)}, {id:INSTRUCTOR,role:'instructor',status:'Active',full_name:'Synthetic Coordinator',email:'coordinator@example.invalid'}])if(!state.profiles.some(u=>u.id===p.id))state.profiles.push(p);
for(const table of ['supervisor_assignments','supervisor_evaluations','evaluation_reviews','evaluation_routing_events'])state[table]||=[];
if(!state.supervisor_assignments.length)state.supervisor_assignments.push({id:uid(700),supervisor_id:uid(9),intern_id:owner,company_id:uid(10),ended_at:null});
state.profiles=[me,...new Map(state.profiles.filter(p=>p.id!==me.id).map(p=>[p.id,p])).values()];
persist();
const ok=data=>({data:structuredClone(data),error:null}),fail=message=>({data:null,error:{message}});
const allowed=(table,row)=>me.role==='admin'||(table==='supervisor_evaluations'?(me.role==='supervisor'&&row.supervisor_id===me.id)||(me.role==='instructor'&&row.status==='Submitted to Coordinator') :table==='evaluation_reviews'?me.role==='instructor':table==='supervisor_assignments'?me.role==='supervisor'&&row.supervisor_id===me.id:false);
export const supabase={...base,from(table){
  const q=base.from(table);
  if(['supervisor_assignments','supervisor_evaluations','evaluation_reviews','evaluation_routing_events'].includes(table))q.execute=async()=>{
    if(control.holdRead===table)await new Promise(resolve=>{(control.releaseReads||=[]).push(resolve);});
    if(control.failRead===table)throw new Error('Synthetic evaluation read failed');
    let rows=state[table].filter(r=>allowed(table,r)&&q.filters.every(f=>f(r)));rows.sort((a,b)=>{for(const [key,asc] of q.orders){const cmp=String(a[key]).localeCompare(String(b[key]));if(cmp)return asc?cmp:-cmp;}return 0;});const count=rows.length;rows=rows.slice(0,q.cap);return {data:q.head?null:structuredClone(rows),count,error:null};
  };
  return q;
},async rpc(name,p={}) {
  control.calls.push(name);
  if(name==='my_profile')return ok(control.profileOverride||me);
  if(control.failMutation===name)return fail('Synthetic evaluation mutation failed');
  if(name==='supervisor_roster') {
    if(control.failRoster)return fail('Synthetic roster retrieval failed');
    if(control.noInterns)return ok([]);
    return ok(state.interns.filter(i=>state.supervisor_assignments.some(a=>!a.ended_at&&a.supervisor_id===me.id&&a.intern_id===i.id)&&(!p.p_after||i.id>p.p_after)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,p.p_size||500).map(i=>({...i,full_name:state.profiles.find(u=>u.id===i.id)?.full_name,student_id:state.profiles.find(u=>u.id===i.id)?.student_id})));
  }
  if(name==='save_supervisor_evaluation') {
    if(p.p_submit&&control.missingCoordinator)return fail('No eligible assigned OJT Coordinator. Ask Admin to assign an Active Coordinator before submission.');
    let r=state.supervisor_evaluations.find(s=>s.id===p.p_id);
    if(r?.status==='Submitted to Coordinator')return ok(r);
    if(!r){r={id:p.p_id,supervisor_id:me.id,intern_id:p.p_intern_id,company_id:uid(10),assignment_id:uid(700),created_at:new Date().toISOString(),version:0};state.supervisor_evaluations.push(r);}
    Object.assign(r,{evaluation_date:p.p_date,criteria:p.p_criteria,feedback:p.p_feedback,overall_score:rubricScore(p.p_criteria),version:r.version+1,status:p.p_submit?'Submitted to Coordinator':'Supervisor Draft',coordinator_id:p.p_submit?INSTRUCTOR:null});
    if(p.p_submit){r.submitted_at=new Date().toISOString();state.evaluation_reviews.push({id:r.id,coordinator_id:INSTRUCTOR,source_version:r.version,revision:0,criteria:r.criteria,summary:'',strengths:'',improvements:'',guidance:'',adjustment_reason:'',status:'Submitted to Coordinator'});}
    persist();return ok(r);
  }
  if(name==='save_evaluation_review_v2') {
    const r=state.evaluation_reviews.find(r=>r.id===p.p_id),s=state.supervisor_evaluations.find(s=>s.id===p.p_id);
    const error=adjustmentError(s.criteria,p.p_criteria,p.p_adjustments);if(error)return fail(error);
    let fields,choices;
    try {choices=normalizeChoices(p.p_choices);fields=p.p_mode==='selected'?feedbackText(choices,p.p_remarks):p.p_written;}catch(e){return fail(e.message);}
    if(JSON.stringify(fields)!==JSON.stringify(p.p_expected_feedback))return fail('Feedback preview changed');
    if(r.status==='Published to Intern')return ok(r);
    if(!r.written_feedback&&!r.feedback_mode&&r.summary)r.written_feedback={summary:r.summary,strengths:r.strengths,improvements:r.improvements,guidance:r.guidance};
    if(p.p_mode==='written')r.written_feedback=fields;
    Object.assign(r,{...fields,feedback_mode:p.p_mode,feedback_choices:choices,additional_remarks:p.p_remarks,adjustment_reasons:p.p_adjustments,criteria:p.p_criteria,status:p.p_publish?'Published to Intern':'Coordinator Draft',revision:r.revision+1});
    if(p.p_publish&&!r.final_evaluation_id){r.final_evaluation_id=crypto.randomUUID();state.evaluations.push({id:r.final_evaluation_id,intern_id:s.intern_id,evaluator_id:me.id,competencies:r.criteria,overall_score:rubricScore(r.criteria),feedback:r.summary,strengths:r.strengths,improvements:r.improvements,guidance:r.guidance,provenance:'supervisor_review',source_evaluation_id:s.id,source_version:s.version,evaluation_date:s.evaluation_date,created_at:new Date().toISOString()});}
    persist();return ok(r);
  }
  if(name==='save_evaluation_review') {
    const r=state.evaluation_reviews.find(r=>r.id===p.p_id),s=state.supervisor_evaluations.find(s=>s.id===p.p_id);
    if(JSON.stringify(p.p_criteria)!==JSON.stringify(s.criteria)&&!p.p_reason.trim())return fail('Explain changes to original ratings');
    Object.assign(r,{summary:p.p_summary,strengths:p.p_strengths,improvements:p.p_improvements,guidance:p.p_guidance,criteria:p.p_criteria,adjustment_reason:p.p_reason,status:p.p_publish?'Published to Intern':'Coordinator Draft',revision:r.revision+1});
    if(p.p_publish&&!r.final_evaluation_id){r.final_evaluation_id=crypto.randomUUID();state.evaluations.push({id:r.final_evaluation_id,intern_id:s.intern_id,evaluator_id:me.id,competencies:r.criteria,overall_score:rubricScore(r.criteria),feedback:r.summary,strengths:r.strengths,improvements:r.improvements,guidance:r.guidance,provenance:'supervisor_review',source_evaluation_id:s.id,source_version:s.version,evaluation_date:s.evaluation_date,created_at:new Date().toISOString()});}
    persist();return ok(r);
  }
  if(name==='admin_set_supervision') {
    let r=state.supervisor_assignments.find(a=>a.supervisor_id===p.p_supervisor_id&&a.intern_id===p.p_intern_id&&!a.ended_at);
    if(!r){r={id:crypto.randomUUID(),supervisor_id:p.p_supervisor_id,intern_id:p.p_intern_id,company_id:uid(10),ended_at:null};state.supervisor_assignments.push(r);}
    if(!p.p_assigned)Object.assign(r,{ended_at:new Date().toISOString(),ended_by:me.id});persist();return ok(r);
  }
  return base.rpc(name,p);
}};

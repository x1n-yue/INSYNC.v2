import { completeRows } from './workflows';
import { recordRpc, manilaDate } from './authority';
import { attendanceEvidence } from './hours';
import { evaluationResult, RUBRIC, requiredHours } from './business';
import { internMetrics } from './metrics';
import { calendarDate } from './lists';
import { EXPORT_LIMIT } from './exports';
import { renderReport } from './reportFormats';
import { attendanceSource } from './companyAttendance';

export const REPORTS = {
  intern: [
    {key:'dtr',title:'Daily Time Record (DTR)',description:'Attendance and accomplishments; logged, verified and Unknown evidence.'},
    {key:'performance',title:'Performance Summary',description:'Saved server scores, rubric criteria and feedback.'},
    {key:'weekly',title:'Weekly Hours Summary',description:'Monday–Sunday totals with Unknown evidence counts.'},
    {key:'documents',title:'Document Register',description:'Current requirements and retained uploaded versions. Original files are available through My Documents.'},
  ],
  instructor: [
    {key:'class',title:'Master Class Progress Report',description:'Complete matching assigned roster, saved targets and separate period/lifetime hours.'},
    {key:'evaluations',title:'Evaluation Summary',description:'Individual server-scored evaluations for the matching assigned roster.'},
    {key:'clearance',title:'Clearance Eligibility List',description:'Current clearance eligibility, including every standard/custom requirement; no certificate issuance.'},
    {key:'risk',title:'At-Risk Intern Report',description:'Existing D13 risk calculation and reasons; Unknown classifications remain explicit.'},
  ],
};
const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',hour12:false}) : 'Unavailable';
const text = value => value == null || value === '' ? 'Not recorded' : String(value);
const hours = value => value == null || value === '' ? 'Unknown' : Number(Number(value).toFixed(4));

export function reportRange(filters) {
  if(!filters?.mode || filters.mode==='all') return {start:'',end:'',label:'All records'};
  if(filters.mode==='audit') {
    if((filters.start&&calendarDate(filters.start)===null)||(filters.end&&calendarDate(filters.end)===null)||(filters.start&&filters.end&&filters.start>filters.end))
      throw new Error('Select valid audit dates, with start on or before end.');
    return {start:filters.start||'',end:filters.end||'',label:filters.start||filters.end?`${filters.start||'Beginning'} through ${filters.end||'All later records'} (inclusive, Asia/Manila)`:'All records'};
  }
  if(filters.mode!=='custom' || calendarDate(filters.start)===null || calendarDate(filters.end)===null || filters.start>filters.end)
    throw new Error('Select valid start and end dates, with start on or before end.');
  return {start:filters.start,end:filters.end,label:`${filters.start} through ${filters.end} (inclusive, Asia/Manila)`};
}
function matching(rows,range,field,warnings) {
  if(!range.start && !range.end) return rows;
  let unknown=0;
  const result=rows.filter(r=>{
    const value=['log_date','evaluation_date'].includes(field) ? (calendarDate(r[field])===null ? '' : r[field]) :
      (r[field] && Number.isFinite(Date.parse(r[field])) ? manilaDate(new Date(r[field])) : '');
    if(!value){unknown++;return false;}
    return (!range.start||value>=range.start) && (!range.end||value<=range.end);
  });
  if(unknown) warnings.push(`${unknown} records have an unavailable ${field} and cannot be matched to this date range.`);
  return result;
}
export function attendanceTable(rows,now) {
  let logged=0,verified=0,unknown=0,open=0;
  const body=rows.map(r=>{
    const e=attendanceEvidence(r,now);
    if(e.state==='closed'){logged+=Number(e.logged);verified+=Number(e.verified);} else if(e.state==='open')open++;else unknown++;
    return [r.id,r.log_date,stamp(r.clocked_in_at),stamp(r.clocked_out_at),text(r.hours),hours(e.logged),hours(e.verified),e.verification,text(r.accomplishment),attendanceSource(r)];
  });
  return {title:'Attendance records',headers:['Record ID','Manila start date','Time in (Manila)','Time out (Manila)','Raw stored hours','Logged hours','Verified hours','Evidence','Accomplishments','Source'],rows:body,
    totals:[['Matching records',rows.length],['Confirmed logged hours',hours(logged)],['Confirmed verified hours',hours(verified)],['Unknown records (totals incomplete if nonzero)',unknown],['Open sessions (not counted as completed hours)',open]]};
}
function evaluationTable(rows,people) {
  return {title:'Saved evaluations',headers:['Intern','Student ID (text)','Evaluator','Manila date',...RUBRIC.map(c=>`${c.label} (${c.weight}%)`),'Final published score /100','Student-facing summary','Provenance','Strengths','Areas for improvement','Guidance'],
    rows:rows.map(r=>[text(people.find(p=>p.id===r.intern_id)?.full_name),text(people.find(p=>p.id===r.intern_id)?.student_id),
      text(people.find(p=>p.id===r.evaluator_id)?.full_name || r.evaluator_id),stamp(r.created_at),...RUBRIC.map(c=>Number.isInteger(r.competencies?.[c.id]) && r.competencies[c.id]>=1 && r.competencies[c.id]<=5 ? r.competencies[c.id] : 'Unavailable'),
      evaluationResult(r) ?? 'Unavailable',text(r.feedback),r.provenance==='supervisor_review'?'Reviewed Supervisor evaluation':'Legacy Coordinator evaluation',text(r.strengths),text(r.improvements),text(r.guidance)]),
    totals:[['Evaluations',rows.length],['Unavailable overall scores',rows.filter(r=>evaluationResult(r)===null).length]]};
}
async function profile(client,role,id) {
  const result=await recordRpc(client,'my_profile');
  if(!result.ok || result.data.role!==role || result.data.status!=='Active' || (id && result.data.id!==id))
    throw new Error('Report not permitted; refresh your account session.');
  return result.data;
}
function rosterFilter(rows,people,companies,filters) {
  const query=(filters.search||'').trim().toLocaleLowerCase();
  return rows.filter(r=>(!filters.section || (filters.section==='unassigned' ? !r.section_id : filters.section===r.section_id)) &&
    (!query || [people.find(p=>p.id===r.id)?.full_name,people.find(p=>p.id===r.id)?.student_id,companies.find(c=>c.id===r.company_id)?.name]
      .some(v=>String(v||'').toLocaleLowerCase().includes(query))));
}
async function auditRows(client,filters,range) {
  const args={p_actor:filters.actor||'',p_action:filters.action||'',p_category:filters.category||'',p_from:range.start||null,p_to:range.end||null,p_size:100};
  const rows=[],seen=new Set();let total,pages,first;
  for(let page=1;;page++) {
    const response=await recordRpc(client,'audit_history',{...args,p_page:page});
    const d=response.data;
    if(!response.ok) throw new Error(response.error);
    if(d.id!=='audit-history'||!Number.isSafeInteger(d.total)||d.total<0||d.total>EXPORT_LIMIT||d.page!==page||d.size!==100||d.pages!==Math.max(1,Math.ceil(d.total/100))||!Array.isArray(d.rows)
      ||d.rows.length!==Math.min(100,Math.max(0,d.total-(page-1)*100))||(total!==undefined&&d.total!==total))
      throw new Error('Audit export is incomplete, changed or exceeds 50,000 matching records. Retry with narrower filters.');
    total=d.total;pages=d.pages;if(page===1) first=d.rows.map(r=>r.id);
    for(const r of d.rows){if(!r.id||seen.has(r.id))throw new Error('Audit pages changed during export. Retry.');seen.add(r.id);rows.push(r);}
    if(page===pages)break;
  }
  const final=await recordRpc(client,'audit_history',{...args,p_page:1});
  if(!final.ok||final.data.total!==total||JSON.stringify(final.data.rows?.map(r=>r.id))!==JSON.stringify(first)) throw new Error('Audit history changed during export. Retry.');
  return rows;
}
export async function buildReport(client,role,key,filters={mode:'all'},now=new Date()) {
  if(!Number.isFinite(now.getTime()))throw new Error('Generation timestamp unavailable.');
  const definition=role==='admin'&&key==='audit' ? {key,title:'Audit History Report'} : REPORTS[role]?.find(r=>r.key===key);
  if(!definition)throw new Error('Report unavailable for this role.');
  const range=reportRange(filters),me=await profile(client,role),warnings=['Count-checked retrieval; not a transactional snapshot.'];
  const metadata=[['Institution',text(me.organization)],['Prepared for',text(me.full_name)],['Account',text(me.email)],['Role',role==='instructor'?'Instructor / OJT Coordinator':role],
    ...(role==='intern'?[['Student ID (text)',text(me.student_id)]]:[]),['Date range',range.label],['Generated (Asia/Manila)',stamp(now.toISOString())]];
  let tables;
  if(role==='admin') {
    metadata.push(['Actor filter',filters.actor||'All'],['Action filter',filters.action||'All'],['Category',filters.category||'All']);
    const rows=await auditRows(client,filters,range);
    tables=[{title:'Authorized audit events',headers:['Event ID','Manila timestamp','Actor','Actor UUID','Action','Detail','Provenance','Event metadata'],
      rows:rows.map(r=>[r.id,stamp(r.created_at),text(r.actor_name),text(r.actor_id),text(r.action),text(r.detail),r.source==='database-trigger-v2'?'Trusted database event':'Legacy / unverified',r.event_data ? JSON.stringify(r.event_data):'Not recorded']),totals:[['Matching events',rows.length]]}];
  } else {
    const [interns,people,companies,sections]=await Promise.all(['interns','profiles','companies','course_sections'].map(t=>completeRows(client,t)));
    const assigned=role==='intern'?interns.filter(r=>r.id===me.id):interns;
    if((role==='intern'&&assigned.length!==1)||(role==='instructor'&&assigned.some(r=>r.instructor_id!==me.id))||assigned.some(r=>!people.some(p=>p.id===r.id&&p.role==='intern')))
      throw new Error('Authorized internship details changed or are unavailable. Refresh before exporting.');
    const roster=role==='intern'?assigned:rosterFilter(assigned,people,companies,filters),ids=new Set(roster.map(r=>r.id));
    if(role==='intern') {
      const i=assigned[0];
      metadata.push(['Saved target hours',requiredHours(i.required_hours)??'Unknown'],['Company',i.company_id?text(companies.find(c=>c.id===i.company_id)?.name):'Unassigned'],['Section',i.section_id?text(sections.find(s=>s.id===i.section_id)?.name):'Unassigned']);
    } else metadata.push(['Roster search',filters.search||'None'],['Section filter',filters.section?filters.section==='unassigned'?'Unassigned':text(sections.find(s=>s.id===filters.section)?.name):'All assigned sections'],['Matching assigned interns',roster.length]);
    const needAttendance=['dtr','weekly','class','risk','clearance'].includes(key),needDocuments=['documents','class','risk','clearance'].includes(key);
    const needEvaluations=['performance','evaluations','class'].includes(key);
    const get=async table=>{
      const rows=await completeRows(client,table,role==='intern'?me.id:undefined);
      if(rows.some(r=>!assigned.some(i=>i.id===r.intern_id))) throw new Error('Unexpected report evidence scope. Refresh before exporting.');
      return rows.filter(r=>ids.has(r.intern_id));
    };
    const [attendance,documents,evaluations]=await Promise.all([needAttendance?get('attendance_logs'):[],needDocuments?get('documents'):[],needEvaluations?get('evaluations'):[]]);
    const datedAttendance=matching(attendance,range,'log_date',warnings),datedEvaluations=matching(evaluations,range,'created_at',warnings);
    if(key==='dtr')tables=[attendanceTable(datedAttendance,now)];
    else if(['performance','evaluations'].includes(key)) {
      tables=[evaluationTable(datedEvaluations,people)];
      if(role==='instructor') {
        const sources=await get('supervisor_evaluations');
        tables.push({title:'Original Supervisor scores (authorized submitted sources)',headers:['Source ID','Source version','Intern','Original Supervisor UUID','Company UUID','Original Coordinator UUID','Evaluation date','Source score /100','Published final score /100'],rows:matching(sources.filter(s=>s.status==='Submitted to Coordinator'),range,'evaluation_date',warnings).map(s=>[s.id,s.version,text(people.find(p=>p.id===s.intern_id)?.full_name),s.supervisor_id,s.company_id,s.coordinator_id,s.evaluation_date,s.overall_score,datedEvaluations.find(e=>e.source_evaluation_id===s.id)?.overall_score??'Unpublished / outside selected range'])});
      }
    }
    else if(key==='weekly') {
      const weeks=new Map();
      for(const r of datedAttendance) {
        const date=calendarDate(r.log_date),week=date===null?'Unknown date':new Date(date-((new Date(date).getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
        const w=weeks.get(week)||{logged:0,verified:0,unknown:0,open:0,count:0},e=attendanceEvidence(r,now);w.count++;
        if(e.state==='closed'){w.logged+=Number(e.logged);w.verified+=Number(e.verified);}else if(e.state==='open')w.open++;else w.unknown++;
        weeks.set(week,w);
      }
      tables=[{title:'Weeks beginning Monday (Manila)',headers:['Week start','Matching records','Confirmed logged hours','Confirmed verified hours','Unknown records','Open sessions'],
        rows:[...weeks].sort(([a],[b])=>a.localeCompare(b)).map(([k,w])=>[k,w.count,hours(w.logged),hours(w.verified),w.unknown,w.open]),totals:attendanceTable(datedAttendance,now).totals}];
    } else if(key==='documents') {
      const versions=await get('document_versions'),flex=await get('submission_versions'),files=await get('submission_files');
      const current=matching(documents,range,'created_at',warnings);
      const committed=matching(versions.filter(v=>v.committed_at),range,'committed_at',warnings);
      const flexible=matching(flex.filter(v=>v.committed_at),range,'committed_at',warnings);
      const legacy=matching(documents.filter(d=>d.legacy_evidence).map(d=>({...d,legacy_captured_at:d.legacy_evidence.captured_at})),range,'legacy_captured_at',warnings);
      if(flexible.some(v=>!Array.isArray(v.manifest)||files.filter(f=>f.version_id===v.id).length!==v.manifest.length))
        throw new Error('Flexible file evidence is incomplete. Refresh before exporting.');
      if(documents.some(d=>Number(d.upload_version)>0&&!versions.some(v=>v.document_id===d.id&&Number(v.version_no)===Number(d.upload_version)&&v.committed_at)))
        throw new Error('Current document version evidence is incomplete. Refresh before exporting.');
      tables=[{title:'Current clearance requirements (range applies to creation date)',headers:['Requirement ID','Type','Name','Stored status','Current version','File name','Reviewed (Manila)','Review note'],
        rows:current.map(d=>[d.id,d.doc_type,d.name,d.status,Number(d.upload_version),text(d.file_name),stamp(d.reviewed_at),text(d.note)]),totals:[['Matching requirements',current.length]]},
      {title:'Retained committed clearance versions',headers:['Requirement ID','Version ID','Version','File name','Uploaded (Manila)','Historical status','Reviewer UUID','Review note'],
        rows:committed.map(v=>[v.document_id,v.id,Number(v.version_no),v.file_name,stamp(v.committed_at),v.status,text(v.reviewed_by),text(v.note)]),totals:[['Matching committed versions',committed.length]]},
      {title:'Retained legacy metadata — unverified (range applies to capture date)',headers:['Requirement ID','File name','Stored status','Original saved reviewer','Original saved review date (Manila)','Original saved note','Captured before replacement (Manila)'],
        rows:legacy.map(d=>[d.id,text(d.legacy_evidence.file_name),text(d.legacy_evidence.status),text(d.legacy_evidence.reviewed_by),stamp(d.legacy_evidence.reviewed_at),text(d.legacy_evidence.note),stamp(d.legacy_evidence.captured_at)]),totals:[['Matching retained legacy snapshots',legacy.length]]},
      {title:'Flexible file sets — excluded from clearance',headers:['Submission ID','Version ID','Title','Version','Uploaded (Manila)','Status','File names','Review note'],
        rows:flexible.map(v=>[v.submission_id,v.id,v.title,Number(v.version_no),stamp(v.committed_at),v.status,files.filter(f=>f.version_id===v.id).map(f=>f.file_name).join('; '),text(v.note)]),totals:[['Matching flexible versions',flexible.length]]}];
      warnings.push('For original uploaded files, use My Documents. Legacy files without committed versions remain listed in current requirements.');
    } else {
      warnings.push('Clearance and D13 risk use lifetime verified hours and current requirements, regardless of the selected attendance/evaluation range. Flexible approvals do not satisfy clearance.');
      const rows=roster.map(i=>{
        const m=internMetrics({internId:i.id,required:i.required_hours,attendance:attendance.filter(r=>r.intern_id===i.id),documents:documents.filter(r=>r.intern_id===i.id),now});
        const p=people.find(p=>p.id===i.id),period=attendanceTable(datedAttendance.filter(r=>r.intern_id===i.id),now);
        const latest=datedEvaluations.filter(r=>r.intern_id===i.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||b.id.localeCompare(a.id))[0];
        return {m,values:[text(p.full_name),text(p.student_id),text(companies.find(c=>c.id===i.company_id)?.name),text(p.status),requiredHours(i.required_hours)??'Unknown',hours(m.logged),hours(m.verified),
          period.totals[1][1],period.totals[2][1],period.totals[3][1],m.cleared===null?'Unknown':m.cleared?'Eligible':'Incomplete',m.risk,
          (m.riskReasons||[]).map(r=>r.message).join('; '),latest?evaluationResult(latest)??'Unavailable':'Not recorded']};
      });
      const selected=key==='clearance'?rows.filter(r=>r.m.cleared===true):key==='risk'?rows.filter(r=>r.m.risk==='At Risk'):rows;
      const unknown=key==='clearance'?rows.filter(r=>r.m.cleared===null):key==='risk'?rows.filter(r=>r.m.risk==='Unknown'):[];
      const headers=['Intern','Student ID (text)','Company','Account status','Saved target','Lifetime logged','Lifetime verified','Period confirmed logged','Period confirmed verified','Period Unknown count','Clearance','D13 risk','Risk reason','Latest period score /100'];
      const sum=index=>hours(selected.reduce((n,r)=>n+(typeof r.values[index]==='number'?r.values[index]:0),0));
      const totals=[['Qualifying / reported interns',selected.length],
        ['Unknown clearance classifications in matching roster',rows.filter(r=>r.m.cleared===null).length],
        ['Unknown risk classifications in matching roster',rows.filter(r=>r.m.risk==='Unknown').length],
        ['Confirmed lifetime logged hours (reported interns)',sum(5)],['Confirmed lifetime verified hours (reported interns)',sum(6)],
        ['Reported interns with Unknown lifetime hours (totals incomplete)',selected.filter(r=>r.m.logged===null||r.m.verified===null).length],
        ['Confirmed period logged hours (reported interns)',sum(7)],['Confirmed period verified hours (reported interns)',sum(8)],
        ['Period Unknown attendance records (reported interns)',sum(9)]];
      tables=[{title:definition.title,headers,rows:selected.map(r=>r.values),totals}];
      if(unknown.length)tables.push({title:'Unknown classification — incomplete evidence',headers,rows:unknown.map(r=>r.values)});
    }
    const finalInterns=await completeRows(client,'interns');
    const signature=rows=>JSON.stringify(rows.filter(r=>role==='instructor'||r.id===me.id).map(r=>[r.id,r.instructor_id,r.company_id,r.section_id,r.required_hours]).sort((a,b)=>a[0].localeCompare(b[0])));
    if(signature(finalInterns)!==signature(assigned))throw new Error('Assignments or saved targets changed during export. Retry.');
  }
  await profile(client,role,me.id);
  return {key,ownerId:me.id,title:definition.title,metadata,warnings:[...new Set(warnings)],tables,generatedDate:manilaDate(now),count:tables.reduce((n,t)=>n+t.rows.length,0)};
}
export async function reportArtifact(client,role,key,filters,format,now=new Date(),assets) {
  const model=await buildReport(client,role,key,filters,now);
  const artifact=await renderReport(model,format,assets);
  // Formatting can be slow. Revalidate authority before handing bytes to browser.
  await profile(client,role,model.ownerId);
  return artifact;
}

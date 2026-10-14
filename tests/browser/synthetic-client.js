// Browser-only synthetic transport. Vite's validation runner substitutes this
// module; application builds never import it. No real Supabase endpoint or keys.
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const ADMIN=uid(1),INSTRUCTOR=uid(2),owner=uid(101);
const role=new URLSearchParams(location.search).get("role") || "instructor";
const me={id:role==="intern"?owner:role==="admin"?ADMIN:INSTRUCTOR,full_name:`Synthetic ${role}`,role,status:"Active",email:`${role}@example.invalid`,organization:"Synthetic institution"};
const profiles=[me,...Array.from({length:65},(_,i)=>({id:uid(101+i),full_name:`Intern ${String(i+1).padStart(3,"0")}`,student_id:`SID-${i+1}`,role:"intern",status:"Active",email:`intern-${i+1}@example.invalid`}))];
const fresh={profiles,companies:[{id:uid(10),name:"Synthetic Company A"},{id:uid(11),name:"Synthetic Company B"}],
 course_sections:[{id:uid(20),name:"Section A"},{id:uid(21),name:"Section B"}],academic_years:[{id:uid(30),label:"2026–2027",is_current:true}],
 interns:Array.from({length:65},(_,i)=>({id:uid(101+i),instructor_id:INSTRUCTOR,company_id:uid(10+i%2),section_id:uid(20+i%2),required_hours:486})),
 attendance_logs:[],attendance_exceptions:[],alerts:[],announcements:[],
 documents:["moa","endorsement","consent","medical"].map((doc_type,i)=>({id:uid(300+i),intern_id:owner,doc_type,name:`Legacy ${doc_type}`,status:"Pending",upload_version:0,review_revision:0})),
 evaluations:[{id:uid(400),intern_id:owner,evaluator_id:INSTRUCTOR,competencies:{punctuality:4,performance:4,conduct:4,communication:4},overall_score:80,feedback:"Synthetic feedback",created_at:new Date().toISOString()},
 {id:uid(401),intern_id:owner,evaluator_id:INSTRUCTOR,competencies:null,overall_score:null,feedback:"Preserved legacy evaluation",created_at:"2025-01-01T00:00:00Z"}],
 audit_logs:Array.from({length:80},(_,i)=>({id:uid(500+i),actor_name:i===0?"Historical actor":"Recent actor",action:"profiles update",detail:"Synthetic audit event",source:i===0?null:"database-trigger-v2",event_data:{table:"profiles"},created_at:i===0?"2025-01-01T00:00:00Z":new Date().toISOString()})),
 submissions:[],submission_versions:[],submission_files:[],submission_reviews:[],objects:{}};
const key="insync-synthetic-browser-data";
let state=JSON.parse(localStorage.getItem(key)||"null") || fresh;
state.profiles=[me,...state.profiles.filter(p=>p.id!==me.id)];
const persist=()=>localStorage.setItem(key,JSON.stringify(state));
// Test runners can extend this transport; this module is never in app builds.
export const fixture = { state, me, persist, uid, owner, INSTRUCTOR, ADMIN };
const clone=v=>JSON.parse(JSON.stringify(v));
const next=()=>crypto.randomUUID();
function authorized(table,row){
 if(role==="admin")return true;
 if(["companies","course_sections","academic_years"].includes(table))return true;
 if(table==="audit_logs")return false;
 if(table==="profiles")return row.id===me.id || (role==="instructor" && row.role==="intern");
 if(table==="interns")return role==="intern"?row.id===owner:row.instructor_id===me.id;
 if(table==="announcements")return role==="instructor"?row.instructor_id===me.id:row.target_intern_id===owner;
 const allowed=role==="intern"?row.intern_id===owner:state.interns.some(i=>i.id===row.intern_id&&i.instructor_id===me.id);
 if(!allowed)return false;
 if(role==="instructor" && table==="submissions")return row.current_version>0;
 if(role==="instructor" && table==="submission_versions")return !!row.committed_at;
 if(role==="instructor" && table==="submission_files")return state.submission_versions.some(v=>v.id===row.version_id&&v.committed_at);
 return true;
}
class Query {
 constructor(table){this.table=table;this.filters=[];this.orders=[];this.cap=Infinity;this.singleMode=false;this.head=false;}
 select(_columns,options={}){this.head=!!options.head;return this;}
 eq(k,v){this.filters.push(r=>r[k]===v);return this;}
 in(k,values){this.filters.push(r=>values.includes(r[k]));return this;}
 is(k,v){this.filters.push(r=>(r[k]??null)===v);return this;}
 lte(k,v){this.filters.push(r=>r[k]<=v);return this;}
 gt(k,v){this.filters.push(r=>r[k]>v);return this;}
 order(k,{ascending=true}={}){this.orders.push([k,ascending]);return this;}
 limit(n){this.cap=n;return this;}
 maybeSingle(){this.singleMode=true;return this;}
 single(){this.singleMode=true;return this;}
 update(patch){this.patch=patch;return this;}
 insert(row){this.insertRow=row;return this;}
 then(resolve,reject){return this.execute().then(resolve,reject);}
 async execute(){
  if(sessionStorage.getItem("synthetic-read-failure")===this.table)return {data:null,error:{message:`Synthetic ${this.table} unavailable`}};
  if(this.insertRow){const r={id:next(),...this.insertRow,created_at:new Date().toISOString()};state[this.table].push(r);persist();return {data:this.singleMode?r:[r],error:null};}
  let rows=(state[this.table]||[]).filter(r=>authorized(this.table,r)&&this.filters.every(f=>f(r)));
  if(this.patch){rows.forEach(r=>Object.assign(r,this.patch));persist();}
  rows.sort((a,b)=>{for(const [k,asc] of this.orders){const cmp=String(a[k]??"").localeCompare(String(b[k]??""));if(cmp)return asc?cmp:-cmp;}return 0;});
  const count=rows.length;rows=rows.slice(0,this.cap);
  if(this.table==="interns")rows=rows.map(r=>({...r,companies:state.companies.find(c=>c.id===r.company_id),course_sections:state.course_sections.find(s=>s.id===r.section_id)}));
  return {data:this.head?null:this.singleMode?(rows[0]||null):clone(rows),count,error:null};
 }
}
const ok=data=>({data:clone(data),error:null}), fail=message=>({data:null,error:{message,code:"P0001"}});
async function rpc(name,p={}){
 if(name==="my_profile"&&sessionStorage.getItem("synthetic-read-failure")==="my_profile")return fail("Synthetic account profile unavailable");
 if(name==="my_profile")return ok(me);
 if(name==="related_profile_names")return ok(p.p_ids.map(id=>({id,full_name:id===INSTRUCTOR?"Synthetic Instructor":id})));
 if(name==="unfinished_document_uploads")return ok([]);
 if(name==="submission_recovery_list")return ok({id:owner,versions:state.submission_versions.filter(v=>!v.committed_at&&(!v.abandoned_at||state.submission_files.some(f=>f.version_id===v.id&&state.objects[f.file_path])))});
 if(name==="stage_submission"){
  let v=state.submission_versions.find(v=>v.id===p.p_attempt_id);
  if(!v){
   let s=state.submissions.find(s=>s.id===p.p_submission_id);
   if(!s){s={id:next(),intern_id:owner,current_version:0,review_revision:0,title:p.p_title,description:p.p_description,status:"Pending",created_at:new Date().toISOString(),updated_at:new Date().toISOString()};state.submissions.push(s);}
   v={id:p.p_attempt_id,submission_id:s.id,intern_id:owner,expected_version:p.p_expected_version,expected_revision:p.p_expected_revision,title:p.p_title,description:p.p_description,manifest:p.p_files,status:"Pending",review_revision:0,created_at:new Date().toISOString(),version_no:null,committed_at:null};state.submission_versions.push(v);
   p.p_files.forEach((f,i)=>{const id=next();state.submission_files.push({id,version_id:v.id,intern_id:owner,ordinal:i+1,file_name:f.name,mime_type:f.mime,byte_size:f.size,file_path:`${owner}/${s.id}/${v.id}/${id}.pdf`});});persist();
  }
  return ok({id:v.id,version:v,files:state.submission_files.filter(f=>f.version_id===v.id)});
 }
 if(name==="finalize_submission"){
  const v=state.submission_versions.find(v=>v.id===p.p_version_id),s=state.submissions.find(s=>s.id===v?.submission_id);
  if(!v||!s||v.abandoned_at)return fail("Reservation unavailable");
  if(!state.submission_files.filter(f=>f.version_id===v.id).every(f=>state.objects[f.file_path]))return fail("Complete file set required");
  if(!v.committed_at){v.version_no=++s.current_version;v.committed_at=new Date().toISOString();Object.assign(s,{title:v.title,description:v.description,status:"Pending",review_revision:0,note:null,reviewed_by:null,reviewed_at:null,updated_at:v.committed_at});persist();}
  return ok(s);
 }
 if(name==="cancel_submission"){
  const v=state.submission_versions.find(v=>v.id===p.p_version_id);if(!v)return fail("Reservation missing");
  if(v.committed_at)return ok({id:v.id,committed:true,submission:state.submissions.find(s=>s.id===v.submission_id),version:v.version_no});
  v.abandoned_at=new Date().toISOString();persist();return ok({id:v.id,committed:false,files:state.submission_files.filter(f=>f.version_id===v.id).map(f=>({path:f.file_path,object_exists:!!state.objects[f.file_path]}))});
 }
 if(name==="review_submission"){
  const s=state.submissions.find(s=>s.id===p.p_id);if(!s||s.current_version!==p.p_version||s.review_revision!==p.p_revision)return fail("File set or review changed");
  if(p.p_status==="Needs Revision"&&!p.p_note?.trim())return fail("Revision explanation required");
  Object.assign(s,{status:p.p_status,note:p.p_note,reviewed_by:INSTRUCTOR,reviewed_at:new Date().toISOString(),review_revision:s.review_revision+1});
  const v=state.submission_versions.find(v=>v.submission_id===s.id&&v.version_no===s.current_version);Object.assign(v,{status:s.status,review_revision:s.review_revision,note:s.note,reviewed_by:s.reviewed_by,reviewed_at:s.reviewed_at});
  state.submission_reviews.push({id:next(),version_id:v.id,intern_id:owner,review_revision:s.review_revision,status:s.status,note:s.note,reviewed_by:INSTRUCTOR,reviewed_at:s.reviewed_at});persist();return ok(s);
 }
 if(name==="submission_file_access")return ok(state.submission_files.find(f=>f.id===p.p_id));
 if(name==="audit_history"){
  const rows=state.audit_logs.filter(r=>(!p.p_actor||r.actor_name.toLowerCase().includes(p.p_actor.toLowerCase()))&&(!p.p_action||r.action.includes(p.p_action))&&(!p.p_category||r.event_data?.table===p.p_category)).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
  const pages=Math.max(1,Math.ceil(rows.length/p.p_size)),page=Math.min(p.p_page,pages);
  return ok({id:"audit-history",total:rows.length,pages,page,size:p.p_size,rows:rows.slice((page-1)*p.p_size,page*p.p_size)});
 }
 if(name==="admin_master_impact"){
  const entry=state[p.p_table].find(r=>r.id===p.p_id),field=p.p_table==="companies"?"company_id":"section_id";
  return ok({id:entry.id,entry,references:state.interns.filter(i=>i[field]===entry.id).length,can_archive:!entry.is_current&&!entry.archived_at});
 }
 if(name==="admin_archive_master"){const entry=state[p.p_table].find(r=>r.id===p.p_id);entry.archived_at=new Date().toISOString();persist();return ok({id:entry.id,entry});}
 if(name==="admin_set_assignment"){const r=state.interns.find(i=>i.id===p.p_id);Object.assign(r,{instructor_id:p.p_instructor_id,company_id:p.p_company_id,section_id:p.p_section_id,required_hours:p.p_required_hours});persist();return ok(r);}
 return fail(`Synthetic RPC not implemented: ${name}`);
}
let uploadCount=0;
export const setupError=null;
export const supabase={
 auth:{getSession:async()=>({data:{session:{user:{id:me.id}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
 from:table=>new Query(table),rpc,
 storage:{from:()=>({upload:async(path,file)=>{uploadCount++;if(sessionStorage.getItem("synthetic-partial-upload")==="true"&&uploadCount%2===0)return {error:{message:"Synthetic second file failure"}};state.objects[path]={size:file.size,mime:file.type};persist();return {data:{path},error:null};},
 remove:async(paths)=>{const data=paths.filter(p=>state.objects[p]).map(name=>({name}));paths.forEach(p=>delete state.objects[p]);persist();return {data,error:null};},
 createSignedUrl:async()=>({data:{signedUrl:"http://127.0.0.1:1/synthetic-signed-file"},error:null})})},
};

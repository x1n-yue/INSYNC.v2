import { describe, expect, it, vi } from "vitest";
import { calendarDate, dateRange, filterEvaluations, filterRoster, paginate } from "../src/lib/lists";
import { internMetrics } from "../src/lib/metrics";
import { recoverSubmission, reviewSubmission, uploadSubmission, validateSubmission } from "../src/lib/submissions";
const owner="00000000-0000-4000-8000-000000000004",sid="00000000-0000-4000-8000-000000000100",vid="00000000-0000-4000-8000-000000000101";
const files=[{name:"Evidence.pdf",type:"application/pdf",size:20},{name:"Photo.png",type:"image/png",size:30}];
const submission={id:sid,intern_id:owner,current_version:1,review_revision:0};
function transport(options={}) {
 const reserved=files.map((f,i)=>({id:`file-${i}`,version_id:vid,ordinal:i+1,file_name:f.name,mime_type:f.type,byte_size:f.size,file_path:`${owner}/${sid}/${vid}/file-${i}.pdf`}));
 const storage={upload:vi.fn(async()=>({error:options.partial && storage.upload.mock.calls.length===2?{message:"Second file failed"}:null})),
  remove:vi.fn(async()=>options.cleanupFailure?{error:{message:"Storage offline"}}:{data:options.emptyCleanup?[]:[{name:"removed"}]}),
  createSignedUrl:vi.fn(async()=>({data:{signedUrl:"https://synthetic.invalid/signed"}}))};
 const rpc=vi.fn(async(name)=>{
  if(name==="stage_submission") {
   if(options.stageRejected)return {error:{code:"40001",message:"Submission changed"}};
   if(options.stageFailure || (options.stageLost && rpc.mock.calls.length===1))throw new Error("Reservation response lost");
   return {data:{id:vid,version:{id:vid,submission_id:sid,intern_id:owner,expected_version:1},files:options.invalidReceipt?reserved.slice(0,1):reserved}};
  }
  if(name==="finalize_submission")return options.finalizeLost?{error:{message:"Finalization response lost"}}:{data:{...submission,current_version:2}};
  if(name==="cancel_submission")return options.recoveryFailure?{error:{message:"Recovery offline"}}:{data:{id:vid,committed:!!options.committed,submission:options.committed?{...submission,current_version:2}:null,version:2,
   files:reserved.map(f=>({path:f.file_path,object_exists:!options.alreadyAbsent}))}};
  return {data:null};
 });
 return {rpc,storage:{from:vi.fn(()=>storage)},methods:storage};
}
const upload=(client,onProgress)=>uploadSubmission(client,{ownerId:owner,submission,title:"Weekly evidence",description:"",files,attemptId:vid},onProgress);
describe("roster filtering and pagination",()=>{
 const rows=Array.from({length:65},(_,i)=>({id:String(i),name:`Intern ${i}`,studentId:`ID-${i}`,company:i%2?"Company B":"Company A",sectionId:i%2?"section-b":"section-a"}));
 it("searches each supported field, combines section before pagination",()=>{
  expect(filterRoster(rows," ID-64 ","section-a")).toEqual([rows[64]]);
  expect(filterRoster(rows,"Company B","section-a")).toEqual([]);
  expect(filterRoster(rows,"intern 64")).toEqual([rows[64]]);
  const result=paginate(filterRoster(rows,"Company A"),4,10);
  expect(result).toMatchObject({page:4,total:33,from:31,to:33});expect(result.rows).toHaveLength(3);
 });
 it.each([[0,1],[NaN,1],[999,7],[-2,1]])("clamps page %s to %s",(input,page)=>expect(paginate(rows,input,10).page).toBe(page));
 it("clamps after data shrink, handles empty and safe size",()=>{
  expect(paginate(rows.slice(0,3),7,10)).toMatchObject({page:1,total:3});
  expect(paginate([],7,25)).toMatchObject({page:1,pages:1,from:0,to:0});
  expect(paginate(rows,1,999).size).toBe(10);
 });
 it("visible-page operations leave complete-roster totals intact",()=>{
  const complete=rows.map(r=>({...r,metric:internMetrics({internId:r.id,required:486,attendance:[],documents:[]})}));
  const before=complete.length;paginate(filterRoster(complete,"company a"),2,10);
  expect(complete).toHaveLength(before);expect(before).toBe(65);
  expect(complete.reduce((n,r)=>n+r.metric.logged,0)).toBe(0);
 });
});
describe("Manila evaluation calendar filters",()=>{
 it("changes day and Monday week across Manila midnight, independent of device zone",()=>{
  expect(dateRange("week","","",new Date("2026-10-04T15:59:59Z"))).toMatchObject({start:"2026-09-28",end:"2026-10-04"});
  expect(dateRange("week","","",new Date("2026-10-04T16:00:00Z"))).toMatchObject({start:"2026-10-05",end:"2026-10-11"});
 });
 it("includes Sunday and both custom boundary dates with chronological input retained",()=>{
  const rows=[{id:"before",created_at:"2026-09-30T15:59:59Z"},{id:"start",created_at:"2026-09-30T16:00:00Z"},
   {id:"end",created_at:"2026-10-02T15:59:59.999Z"},{id:"after",created_at:"2026-10-02T16:00:00Z"}];
  expect(filterEvaluations(rows,dateRange("custom","2026-10-01","2026-10-02")).map(r=>r.id)).toEqual(["start","end"]);
  expect(filterEvaluations([{created_at:"2026-10-11T15:59:59Z"}],dateRange("week","","",new Date("2026-10-05T00:00:00Z")))).toHaveLength(1);
 });
 it("handles leap month, reversed/impossible/missing ranges and legacy unknown dates",()=>{
  expect(dateRange("month","","",new Date("2028-02-15T00:00:00Z"))).toMatchObject({start:"2028-02-01",end:"2028-02-29"});
  for(const [a,b] of [["2026-10-02","2026-10-01"],["2026-02-30","2026-03-01"],["","2026-10-01"]])expect(dateRange("custom",a,b).error).toBeTruthy();
  expect(calendarDate("2026-02-30")).toBeNull();
  const legacy=[{created_at:null},{created_at:"invalid"}];expect(filterEvaluations(legacy,dateRange("all"))).toEqual(legacy);
  expect(filterEvaluations(legacy,dateRange("custom","2026-10-01","2026-10-02"))).toEqual([]);
 });
});
describe("file set validation and failure recovery",()=>{
 it("accepts exactly ten files and 50 MiB, and validates title/description independently",()=>{
  expect(validateSubmission("Title","",Array(10).fill({...files[0],size:5*1048576}))).toEqual([]);
  expect(validateSubmission(" ","",files)).toContain("Title must contain 1–200 characters.");
  expect(validateSubmission("Title","x".repeat(2001),files)).toContain("Description must be at most 2,000 characters.");
 });
 it.each([[],Array(11).fill(files[0]),[{...files[0],size:10485761}],[{...files[0],type:"text/html"}],Array(6).fill({...files[0],size:10485760})].map(f=>[f]))("rejects invalid file set %j before RPC",async f=>{
  const c=transport();expect(validateSubmission("Title","",f).length).toBeGreaterThan(0);
  expect((await uploadSubmission(c,{ownerId:owner,title:"Title",description:"",files:f,attemptId:vid})).ok).toBe(false);expect(c.rpc).not.toHaveBeenCalled();
 });
 it("uploads each server-reserved file, reports completed files, then finalizes once",async()=>{
  const c=transport(),progress=vi.fn();expect((await upload(c,progress)).ok).toBe(true);
  expect(c.methods.upload).toHaveBeenCalledTimes(2);expect(progress).toHaveBeenLastCalledWith({completed:2,total:2,state:"finalizing"});
  expect(c.rpc.mock.calls.map(c=>c[0])).toEqual(["stage_submission","finalize_submission"]);expect(c.methods.remove).not.toHaveBeenCalled();
 });
 it("partial failures never finalize and clean only after authoritative cancellation",async()=>{
  const c=transport({partial:true});expect(await upload(c)).toMatchObject({ok:false,cleanupPending:false});
  expect(c.rpc.mock.calls.map(c=>c[0])).toEqual(["stage_submission","cancel_submission"]);expect(c.methods.remove).toHaveBeenCalledTimes(2);
 });
 it("recovers committed response loss without removing any evidence",async()=>{
  const c=transport({finalizeLost:true,committed:true});expect(await upload(c)).toMatchObject({ok:true,reconciled:true,committedVersion:2});expect(c.methods.remove).not.toHaveBeenCalled();
 });
 it("preserves files on unknown recovery; retains cleanup pending on Storage failure",async()=>{
  const c=transport({partial:true,recoveryFailure:true});expect(await upload(c)).toMatchObject({ok:false,cleanupPending:true});expect(c.methods.remove).not.toHaveBeenCalled();
  expect(await upload(transport({partial:true,cleanupFailure:true}))).toMatchObject({ok:false,cleanupPending:true});
 });
 it("empty removal is confirmed only when the server observes missing staged objects",async()=>{
  expect(await recoverSubmission(transport({emptyCleanup:true}),vid,owner)).toMatchObject({cleanupPending:true});
  expect(await recoverSubmission(transport({emptyCleanup:true,alreadyAbsent:true}),vid,owner)).toMatchObject({cleanupPending:false});
 });
 it("lost reservation retries the same identity; malformed receipts cause no uploads",async()=>{
  const c=transport({stageLost:true});expect((await upload(c)).ok).toBe(true);
  expect(c.rpc.mock.calls[0]).toEqual(c.rpc.mock.calls[1]);
  const bad=transport({invalidReceipt:true});expect(await upload(bad)).toMatchObject({ok:false,cleanupPending:true});expect(bad.methods.upload).not.toHaveBeenCalled();
 });
 it("a confirmed SQL rejection preserves an editable draft, while unknown stage outcomes remain recoverable",async()=>{
  expect(await upload(transport({stageRejected:true}))).toMatchObject({ok:false,cleanupPending:false});
  expect(await upload(transport({stageFailure:true}))).toMatchObject({ok:false,cleanupPending:true,versionId:vid});
 });
 it("revision requires a trimmed explanation and sends explicit version/revision",async()=>{
  const c={rpc:vi.fn(async()=>({data:submission}))};expect((await reviewSubmission(c,submission,"Needs Revision"," ")).ok).toBe(false);expect(c.rpc).not.toHaveBeenCalled();
  await reviewSubmission(c,submission,"Needs Revision"," Add signature ");expect(c.rpc).toHaveBeenCalledWith("review_submission",{p_id:sid,p_version:1,p_revision:0,p_status:"Needs Revision",p_note:"Add signature"});
 });
});

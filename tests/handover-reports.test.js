import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {unzipSync,strFromU8} from 'fflate';
import {encode} from 'fast-png'; // jsPDF's locked PNG codec, used only to create valid isolated test bytes.
import {buildReport,reportRange,reportArtifact,attendanceTable} from '../src/lib/reports';
import {renderReport,REPORT_NOTE} from '../src/lib/reportFormats';
import {addRequirement,verifyAttendance} from '../src/lib/handoverWorkflows';
import {uploadDocument} from '../src/lib/documents';
import {changeRecoveredPassword,requestPasswordReset,recoveryRoute,recoveryRedirect,clearRecoveryRoute} from '../src/lib/authRecovery';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const SA=id(1),IA=id(2),SB=id(3),IB=id(4),now=new Date('2026-10-13T04:00:00Z');
const person=(owner,role='intern')=>({id:owner,role,status:'Active',full_name:'José Dela Peña',student_id:'0000123',organization:'Saved Fixture Institution',email:'fixture@example.invalid'});
const shift=(n=10,owner=SA,verified=true)=>({id:id(n),intern_id:owner,log_date:'2026-10-01',time_in:'08:00:00',time_out:'16:00:00',clocked_in_at:'2026-10-01T00:00:00.000Z',clocked_out_at:'2026-10-01T08:00:00.000Z',hours:'8',verified,verified_by:verified?IA:null,accomplishment:'=HYPERLINK("unsafe")'});
const standard=owner=>['moa','endorsement','consent','medical'].map((type,n)=>({id:id(100+n+(owner===SA?0:10)),intern_id:owner,doc_type:type,name:type,status:'Approved',upload_version:1,review_revision:1,file_path:`${owner}/current.pdf`,file_name:'Evidence.pdf',reviewed_by:IA,reviewed_at:'2026-10-01T09:00:00Z',created_at:'2026-09-30T16:00:00Z'}));
// Mock PostgREST pages; deliberately cap to seven rows, independent of UI pages.
function transport(role='intern',changes={}) {
  const me=person(role==='instructor'?IA:SA,role);
  const data={interns:[{id:SA,instructor_id:IA,required_hours:'8',company_id:null,section_id:null}],profiles:[me,...[person(SA),person(IA,'instructor')].filter(p=>p.id!==me.id)],companies:[],course_sections:[],attendance_logs:[shift()],documents:standard(SA),evaluations:[],document_versions:[],submission_versions:[],submission_files:[],...changes};
  class Query {
    constructor(table){this.table=table;this.filters=[];this.cap=Infinity;this.asc=true;}
    select(_columns,options={}){this.head=options.head;return this;}
    eq(k,v){this.filters.push(r=>r[k]===v);return this;}
    gt(k,v){this.filters.push(r=>r[k]>v);return this;}
    lte(k,v){this.filters.push(r=>r[k]<=v);return this;}
    order(k,{ascending=true}={}){this.key=k;this.asc=ascending;return this;}
    limit(n){this.cap=Math.min(n,7);return this;}
    then(resolve,reject){
      if(client.fail===this.table)return Promise.reject(new Error('Synthetic failed retrieval')).then(resolve,reject);
      const rows=(data[this.table]||[]).filter(r=>this.filters.every(f=>f(r))).sort((a,b)=>String(a[this.key]).localeCompare(String(b[this.key]))*(this.asc?1:-1));
      return Promise.resolve({data:this.head?null:structuredClone(rows.slice(0,this.cap)),count:rows.length,error:null}).then(resolve,reject);
    }
  }
  const client={data,me,fail:'',from:table=>new Query(table),rpc:vi.fn(async name=>name==='my_profile'?{data:{...me},error:null}:{data:null,error:{message:'Unsupported mock RPC'}})};
  return client;
}
const assets={fontBase64:readFileSync(new URL('../src/assets/fonts/Roboto-Regular.ttf',import.meta.url)).toString('base64'),logoBytes:encode({width:1,height:1,channels:4,data:new Uint8Array([0,120,120,255])})};
describe('complete authorized report datasets (mocked transport)',()=>{
  it('exports every record across a smaller API cap, with saved institution, text ID and Manila range',async()=>{
    const c=transport('intern',{attendance_logs:Array.from({length:501},(_,n)=>shift(n+1000))});
    const r=await buildReport(c,'intern','dtr',{mode:'all'},now);expect(r.tables[0].rows).toHaveLength(501);
    expect(r.tables[0].totals).toContainEqual(['Confirmed verified hours',4008]);
    expect(r.metadata).toContainEqual(['Institution','Saved Fixture Institution']);expect(r.metadata).toContainEqual(['Student ID (text)','0000123']);
    expect(r.generatedDate).toBe('2026-10-13');expect(r.metadata.find(m=>m[0]==='Generated (Asia/Manila)')[1]).toContain('12:00:00');
  });
  it('uses inclusive Manila dates, retains Unknown for All, and explicitly counts unmatchable dates',async()=>{
    const c=transport('intern',{attendance_logs:[shift(10),{...shift(11),log_date:'2026-09-30'},{...shift(12),log_date:null}]});
    expect((await buildReport(c,'intern','dtr',{mode:'all'},now)).tables[0].rows).toHaveLength(3);
    const r=await buildReport(c,'intern','dtr',{mode:'custom',start:'2026-10-01',end:'2026-10-01'},now);
    expect(r.tables[0].rows).toHaveLength(1);expect(r.warnings.join(' ')).toMatch(/1 records.*unavailable log_date/);
    const scores=['2026-09-30T15:59:59Z','2026-09-30T16:00:00Z','2026-10-01T15:59:59Z','2026-10-01T16:00:00Z'].map((created_at,n)=>({id:id(200+n),intern_id:SA,evaluator_id:IA,created_at,competencies:{punctuality:5,performance:4,conduct:3,communication:2},overall_score:73,feedback:'Saved feedback'}));
    const p=await buildReport(transport('intern',{evaluations:scores}),'intern','performance',{mode:'custom',start:'2026-10-01',end:'2026-10-01'},now);
    expect(p.tables[0].rows).toHaveLength(2);expect(p.tables[0].rows[0].at(-2)).toBe(73);
  });
  it.each([{mode:'custom',start:'',end:'2026-10-01'},{mode:'custom',start:'2026-02-30',end:'2026-03-01'},{mode:'custom',start:'2026-10-02',end:'2026-10-01'}])('rejects invalid dates %j',range=>expect(()=>reportRange(range)).toThrow(/valid start/));
  it('preserves unverified, Unknown and open evidence rather than fabricating zero totals',()=>{
    const r=attendanceTable([shift(10,SA,false),{...shift(11),clocked_in_at:null}, {...shift(12),time_out:null,clocked_out_at:null,hours:null,verified:false,verified_by:null}],now);
    expect(r.totals).toContainEqual(['Confirmed logged hours',8]);expect(r.totals).toContainEqual(['Confirmed verified hours',0]);
    expect(r.totals).toContainEqual(['Unknown records (totals incomplete if nonzero)',1]);
    expect(r.rows[1][5]).toBe('Unknown');expect(r.rows[2][5]).toBe('Unknown');
  });
  it('applies complete assigned roster filters and lifetime clearance independently of selected date range',async()=>{
    const interns=Array.from({length:65},(_,n)=>({id:id(500+n),instructor_id:IA,required_hours:8,section_id:n%2?'section-b':'section-a'}));
    const people=interns.map((i,n)=>({...person(i.id),full_name:`Intern ${n}`,student_id:`000${n}`}));
    const attendance=interns.map((i,n)=>shift(1000+n,i.id));const documents=interns.flatMap((i,n)=>standard(i.id).map((d,j)=>({...d,id:id(2000+n*4+j)})));
    const c=transport('instructor',{interns,profiles:[person(IA,'instructor'),...people],attendance_logs:attendance,documents});
    const all=await buildReport(c,'instructor','clearance',{mode:'custom',start:'2026-10-10',end:'2026-10-12'},now);
    expect(all.tables[0].rows).toHaveLength(65);expect(all.tables[0].rows[0][8]).toBe(0);expect(all.tables[0].rows[0][6]).toBe(8);
    expect((await buildReport(c,'instructor','class',{mode:'all',section:'section-a',search:'Intern 64'},now)).tables[0].rows).toHaveLength(1);
  });
  it('counts actual revision reasons and keeps unknown classifications out of confirmed counts',async()=>{
    const docs=standard(SA).map((d,n)=>n===0?{...d,status:'Needs Revision'}:d);
    const c=transport('instructor',{attendance_logs:[shift(10,SA,false)],documents:docs});
    const risk=await buildReport(c,'instructor','risk',{mode:'all'},now);expect(risk.tables[0].rows).toHaveLength(1);
    expect(risk.tables[0].rows[0][12]).toMatch(/Needs Revision: moa/);expect(risk.tables[0].rows[0][12]).not.toContain('undefined');
    c.data.attendance_logs[0].clocked_in_at=null;
    const unknown=await buildReport(c,'instructor','risk',{mode:'all'},now);expect(unknown.tables[0].rows).toHaveLength(0);expect(unknown.tables[1].rows).toHaveLength(1);
    expect(unknown.tables[0].totals).toContainEqual(['Unknown risk classifications in matching roster',1]);
  });
  it('does not export unavailable, foreign or changed assignment evidence',async()=>{
    const c=transport();c.fail='attendance_logs';await expect(buildReport(c,'intern','dtr',{},now)).rejects.toThrow(/retrieval/);
    await expect(buildReport(transport('instructor',{interns:[{id:SB,instructor_id:IB}]}),'instructor','class',{},now)).rejects.toThrow(/Authorized internship/);
    await expect(buildReport(transport('instructor',{attendance_logs:[shift(10,SB)]}),'instructor','class',{},now)).rejects.toThrow(/Unexpected report evidence scope/);
    const changed=transport();let reads=0,base=changed.from;changed.from=t=>{if(t==='interns'&&++reads===4)changed.data.interns[0].required_hours=9;return base(t);};
    await expect(buildReport(changed,'intern','dtr',{},now)).rejects.toThrow(/changed during export/);
  });
  it('refuses incomplete committed document history/file sets rather than hiding missing evidence',async()=>{
    await expect(buildReport(transport(),'intern','documents',{},now)).rejects.toThrow(/version evidence is incomplete/);
    const c=transport('intern',{documents:[],submission_versions:[{id:id(60),intern_id:SA,committed_at:'2026-10-01T00:00:00Z',manifest:[{name:'Missing.pdf'}]}]});
    await expect(buildReport(c,'intern','documents',{},now)).rejects.toThrow(/file evidence is incomplete/);
  });
  it('exports retained legacy metadata as unverified with a capture-date range, never an invented committed version',async()=>{
    const legacy={file_name:'Original.pdf',status:'Approved',reviewed_by:null,reviewed_at:null,note:'Original note',captured_at:'2026-09-30T16:00:00Z'};
    const c=transport('intern',{documents:[{...standard(SA)[0],upload_version:0,legacy_evidence:legacy}]});
    const r=await buildReport(c,'intern','documents',{mode:'custom',start:'2026-10-01',end:'2026-10-01'},now);
    const table=r.tables.find(t=>t.title.startsWith('Retained legacy metadata'));expect(table.rows).toHaveLength(1);expect(table.rows[0]).toContain('Original.pdf');expect(table.rows[0]).toContain('Unavailable');
    expect(r.tables.find(t=>t.title==='Retained committed clearance versions').rows).toHaveLength(0);
  });
  it('rejects account restriction/identity changes and unsupported roles/categories',async()=>{
    const c=transport();c.me.status='Pending';await expect(buildReport(c,'intern','dtr',{},now)).rejects.toThrow(/not permitted/);
    await expect(buildReport(transport(),'instructor','class',{},now)).rejects.toThrow(/not permitted/);
    await expect(buildReport(transport(),'intern','certificate',{},now)).rejects.toThrow(/unavailable/);
    const revoke=transport();const rpc=revoke.rpc;revoke.rpc=async(...args)=>{const result=await rpc(...args);if(rpc.mock.calls.length>=15)result.data={...result.data,id:SB};return result;};
    await expect(reportArtifact(revoke,'intern','dtr',{},'csv',now)).rejects.toThrow(/not permitted/);
  });
});
describe('real report file generation',()=>{
  const model={key:'test',title:'Informational DTR',generatedDate:'2026-10-13',count:120,metadata:[['Institution','Fixture School'],['Student ID (text)','0000123'],['Generated (Asia/Manila)','13/10/2026, 12:00:00'],['Date range','All records']],warnings:['Unknown evidence remains Unknown'],tables:[{title:'Complete records',headers:['Student ID','Name','Verified','Evidence'],rows:Array.from({length:120},()=>['0000123','José Dela Peña',8,'Unknown']),totals:[['Confirmed verified hours',960]]}]};
  it('produces genuine XLSX with text IDs, numeric hours, embedded logo, totals and page footer',async()=>{
    const artifact=await renderReport(model,'xlsx',assets);expect(artifact.blob.type).toContain('spreadsheetml');
    const files=unzipSync(new Uint8Array(await artifact.blob.arrayBuffer()));const sheet=strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('pageSetup');expect(sheet).toContain('Page &amp;P of &amp;N');expect(sheet).toContain('<v>8</v>');
    expect(Object.keys(files).some(k=>k.startsWith('xl/media/'))).toBe(true);
    const strings=strFromU8(files['xl/sharedStrings.xml']);expect(strings).toContain('0000123');expect(strings).toContain('José Dela Peña');expect(strings).toContain(REPORT_NOTE);
    expect(sheet).toMatch(/t="s"/);expect(sheet).not.toContain('<f>');expect(sheet).toContain('<v>960</v>');
  });
  it('creates a valid multipage Unicode PDF with embedded font, logo and page numbering',async()=>{
    const artifact=await renderReport(model,'pdf',assets);const bytes=new Uint8Array(await artifact.blob.arrayBuffer()),pdf=Buffer.from(bytes).toString('latin1');
    expect(pdf.startsWith('%PDF-')).toBe(true);expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect((pdf.match(/\/Type \/Page\b/g)||[]).length).toBeGreaterThan(1);expect(pdf).toContain('/FontFile2');expect(pdf).toContain('/Subtype /Image');expect(pdf).toContain('/ToUnicode');
    expect(artifact.filename).toBe('insync-test-2026-10-13.pdf');
  });
  it('fails unsupported PDF glyphs or oversized PDF instead of dropping rows/text',async()=>{
    await expect(renderReport({...model,title:'Unsupported 🦄'},'pdf',assets)).rejects.toThrow(/characters/);
    await expect(renderReport({...model,tables:[{headers:['ID'],rows:Array.from({length:5001},()=>['ID'])}]},'pdf',assets)).rejects.toThrow(/5,000 rows/);
  });
  it('CSV includes branding, metadata and note and escapes spreadsheet formulas',async()=>{
    const r=await renderReport({...model,tables:[{title:'Rows',headers:['ID','Text'],rows:[['0000123','=HYPERLINK("unsafe")']]}]},'csv');
    const csv=await r.blob.text();expect(csv).toContain('INSync');expect(csv).toContain(REPORT_NOTE);expect(csv).toContain('"0000123"');expect(csv).toContain('"\'=HYPERLINK');
  });
});
describe('recovery and controlled handler regression (mocked Auth/transport)',()=>{
  it('recognizes recovery links and clears consumed/error parameters without exposing tokens',()=>{
    const location={href:'https://fixture.invalid/app?keep=1#type=recovery&access_token=synthetic'};expect(recoveryRoute(location)).toBe(true);
    expect(recoveryRedirect(location)).toBe('https://fixture.invalid/app?auth=recovery');
    const browser={location:{href:'https://fixture.invalid/app?auth=recovery&code=synthetic&keep=1#error=synthetic'},history:{replaceState:vi.fn()}};
    clearRecoveryRoute(browser);expect(browser.history.replaceState).toHaveBeenCalledWith(null,'','/app?keep=1');
  });
  it('requests real SDK recovery only after email validation and preserves failure',async()=>{
    const c={auth:{resetPasswordForEmail:vi.fn(async()=>({error:null}))}},loc={href:'https://fixture.invalid/'};
    expect((await requestPasswordReset(c,'invalid',loc)).ok).toBe(false);expect(c.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect((await requestPasswordReset(c,' fixture@example.invalid ',loc)).ok).toBe(true);
    expect(c.auth.resetPasswordForEmail).toHaveBeenCalledWith('fixture@example.invalid',{redirectTo:'https://fixture.invalid/?auth=recovery'});
    c.auth.resetPasswordForEmail.mockResolvedValue({error:{message:'Delivery unavailable'}});expect((await requestPasswordReset(c,'fixture@example.invalid',loc)).error).toBe('Delivery unavailable');
  });
  it('changes passwords only for the matching verified recovery user and confirmed update',async()=>{
    const c={auth:{getUser:vi.fn(async()=>({data:{user:{id:SA}}})),updateUser:vi.fn(async()=>({data:{user:{id:SA}}}))}};
    expect((await changeRecoveredPassword(c,SA,'synthetic-password','different')).ok).toBe(false);expect(c.auth.getUser).not.toHaveBeenCalled();
    expect((await changeRecoveredPassword(c,SB,'synthetic-password','synthetic-password')).ok).toBe(false);expect(c.auth.updateUser).not.toHaveBeenCalled();
    expect((await changeRecoveredPassword(c,SA,'synthetic-password','synthetic-password')).ok).toBe(true);
    c.auth.updateUser.mockResolvedValue({data:{user:{id:SB}}});expect((await changeRecoveredPassword(c,SA,'synthetic-password','synthetic-password')).ok).toBe(false);
  });
  it('keeps unknown or invalid mutation results from becoming success',async()=>{
    const c={rpc:vi.fn(async()=>({data:shift(10,SA,false)}))};expect((await verifyAttendance(c,shift(10,SA,false),now)).ok).toBe(false);
    expect((await verifyAttendance(c,{...shift(),clocked_in_at:null},now)).ok).toBe(false);
    expect((await addRequirement(c,SA,' ',id(100))).ok).toBe(false);expect((await addRequirement(c,SA,'Portfolio',id(100))).ok).toBe(false);
  });
  it('blocks first legacy replacement before mutations when the deployed metadata-preservation column is absent',async()=>{
    const c={rpc:vi.fn()};expect(await uploadDocument(c,{...standard(SA)[0],upload_version:0},{name:'Replacement.pdf',type:'application/pdf',size:20})).toMatchObject({ok:false,error:expect.stringContaining('M12 database update')});expect(c.rpc).not.toHaveBeenCalled();
  });
});

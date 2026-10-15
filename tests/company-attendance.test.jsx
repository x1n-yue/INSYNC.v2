import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompanyAttendancePrint,ManualAttendanceDetails } from '../src/components/CompanyAttendance';
import { ToastProvider } from '../src/components/Toast';
import { manualSessionPreview,localAttendanceInstant,manualFormError,uploadAttendanceSheet,abandonAttendanceSheet,attendanceSheetLink,verifyManualAttendance } from '../src/lib/companyAttendance';
import { companySheetModel,companySheetPdf } from '../src/lib/companyAttendanceSheet';
import { attendanceTable } from '../src/lib/reports';
import { internMetrics } from '../src/lib/metrics';
const id='00000000-0000-4000-8000-000000000005',company='00000000-0000-4000-8000-000000000010',receipt='00000000-0000-4000-8000-000000000100';
const form={internId:id,date:'2026-01-02',endDate:'2026-01-02',timeIn:'08:00',timeOut:'16:15:30',companyId:company,companyName:'Company',supervisor:'Signed Supervisor',reason:'no_connectivity',explanation:'',remarks:'',signatures:true};
const row={id,intern_id:id,log_date:'2026-01-02',clocked_in_at:'2026-01-02T00:00:00Z',clocked_out_at:'2026-01-02T08:15:30Z',time_in:'08:00:00',time_out:'16:15:30',hours:8.258333333333333,verified:false,verified_by:null,attendance_source:'manual_company_sheet',manual_revision:1,manual_evidence_id:receipt};
it('converts explicit Manila dates and seconds to canonical instants and preserves existing duration rules',()=>{
 expect(localAttendanceInstant('2026-02-30','08:00')).toBe(null);expect(localAttendanceInstant('2026-01-02','24:00')).toBe(null);
 expect(localAttendanceInstant('2026-01-02','08:00:30')).toBe('2026-01-02T00:00:30.000Z');
 expect(manualSessionPreview(form).hours).toBeCloseTo(8.2583333333);
 expect(manualSessionPreview({...form,timeIn:'23:00',endDate:'2026-01-03',timeOut:'01:00'}).hours).toBe(2);
 for(const patch of [{timeIn:''},{timeOut:'07:00'},{date:'2099-01-01',endDate:'2099-01-01'},{timeIn:'00:00',timeOut:'17:00'}])expect(manualSessionPreview({...form,...patch}).error).toBeTruthy();
});
it('previews duplicate, overlap, open and existing one-day identity conflicts without making mutations',()=>{
 expect(manualSessionPreview(form,[row]).error).toMatch(/exact/);
 expect(manualSessionPreview({...form,timeOut:'17:00'},[row]).error).toMatch(/overlaps/);
 expect(manualSessionPreview({...form,timeIn:'17:00',timeOut:'18:00'},[row]).error).toMatch(/One record/);
 expect(manualSessionPreview(form,[{...row,time_out:null}]).error).toMatch(/open/);
 expect(manualSessionPreview(form,[row],new Date(),id).error).toBe(null);
});
it('requires printed company/Supervisor details, signatures and meaningful Other explanations',()=>{
 expect(manualFormError(form)).toBe(null);expect(manualFormError({...form,signatures:false})).toMatch(/signatures/);
 expect(manualFormError({...form,reason:'other',explanation:'..........'})).toMatch(/Other/);
 expect(manualFormError({...form,reason:'other',explanation:'Lost connection at the company.'})).toBe(null);
});
it('unverified manual rows count only as logged; verified totals and DTR have one record and accurate source',()=>{
 const metrics=internMetrics({internId:id,required:8,attendance:[row],documents:[]});expect(metrics.logged).toBeCloseTo(row.hours);expect(metrics.verified).toBe(0);
 const verified={...row,verified:true,verified_by:company};expect(internMetrics({internId:id,required:8,attendance:[verified],documents:[]}).verified).toBeCloseTo(row.hours);
 const table=attendanceTable([row],new Date());expect(table.rows).toHaveLength(1);expect(table.rows[0].at(-1)).toBe('Manual — Company Attendance Sheet');expect(table.totals[2][1]).toBe(0);
});
it('Intern details show source/status but do not render private sheet access or shared participant identifiers',()=>{
 const html=renderToStaticMarkup(<ToastProvider><ManualAttendanceDetails row={row}/><CompanyAttendancePrint internId={id}/></ToastProvider>);
 expect(html).toContain('View manual attendance');expect(html).toContain('Download blank company sheet');expect(html).not.toContain('Preview signed evidence');expect(html).not.toContain('Record Manual Attendance');
});
it('print model supports 31 dated blank rows and generated landscape A4 pages with all required columns',async()=>{
 const model=companySheetModel({intern_name:'José Test Intern',identifier:'SID-001',companies:[{id:company,name:'Test Company'}]},company,'2026-01-01','2026-01-31');
 expect(model.rows).toHaveLength(31);expect(model.rows[0].slice(1)).toEqual(['','','','','','']);expect(model.headers).toContain('Supervisor printed name');expect(model.instructions).toContain('Print in advance');
 expect(()=>companySheetModel({companies:[]},company,'2026-01-01','2026-01-02')).toThrow(/company/);
 const artifact=await companySheetPdf(model,{fontBase64:readFileSync('src/assets/fonts/Roboto-Regular.ttf').toString('base64')});expect(artifact.pages).toBeGreaterThan(1);
 const bytes=new Uint8Array(await artifact.blob.arrayBuffer());expect(Buffer.from(bytes).subarray(0,5).toString()).toBe('%PDF-');
 mkdirSync('.client-review/company-attendance',{recursive:true});writeFileSync('.client-review/company-attendance/blank-sheet.pdf',bytes);
});
function client({ready=false,uploadError=null,finishError=false,throwUpload=false}={}) {
 let uploaded=ready;const e={id:receipt,company_id:company,file_path:`sheets/${receipt}.pdf`,ready_at:ready?'2026-01-01':null};
 const storage={upload:vi.fn(async()=>{if(throwUpload)throw new Error('Response lost');if(!uploadError)uploaded=true;return {error:uploadError&&{message:uploadError}};}),remove:vi.fn(async paths=>({data:paths.map(name=>({name})),error:null})),createSignedUrl:vi.fn(async()=>({data:{signedUrl:'https://example.invalid/private-evidence'},error:null}))};
 const rpc=vi.fn(async(name)=>name==='stage_attendance_sheet'?{data:e,error:null}:name==='cancel_attendance_sheet'?{data:{...e,object_exists:uploaded},error:null}:name==='finish_attendance_sheet'?uploaded&&!finishError?{data:{...e,ready_at:'2026-01-01'},error:null}:{error:{message:'Complete validated evidence upload required',code:'P0001'}}:name==='attendance_sheet_access'?{data:{bucket:'attendance-evidence',path:e.file_path,name:'signed.pdf',mime:'application/pdf'},error:null}:{data:{...row,verified:true},error:null});
 return {rpc,storage:{from:vi.fn(()=>storage)},bucket:storage};
}
const file={name:'signed.pdf',type:'application/pdf',size:512},attempt={id:receipt,companyId:company,participants:[id]};
it('validates files before reserving; lost upload responses retain retry identity and never delete evidence automatically',async()=>{
 const c=client({throwUpload:true});expect((await uploadAttendanceSheet(c,attempt,{...file,size:10485761})).ok).toBe(false);expect(c.rpc).not.toHaveBeenCalled();
 const failure=await uploadAttendanceSheet(c,attempt,file);expect(failure.ok).toBe(false);expect(failure.uploadId).toBe(receipt);expect(c.bucket.remove).not.toHaveBeenCalled();
 const restored=client({ready:true});expect((await uploadAttendanceSheet(restored,attempt,file)).ok).toBe(true);expect(restored.bucket.upload).not.toHaveBeenCalled();
});
it('successful upload finalizes before record use; explicit cancellation must be authorized before byte cleanup',async()=>{
 const c=client();expect((await uploadAttendanceSheet(c,attempt,file)).ok).toBe(true);expect(c.bucket.upload).toHaveBeenCalledWith(`sheets/${receipt}.pdf`,file,{upsert:false,contentType:'application/pdf'});
 const forbidden=client();forbidden.rpc.mockResolvedValue({error:{message:'Referenced evidence must be preserved'}});expect((await abandonAttendanceSheet(forbidden,receipt)).ok).toBe(false);expect(forbidden.bucket.remove).not.toHaveBeenCalled();
 expect((await abandonAttendanceSheet(c,receipt)).ok).toBe(true);expect(c.bucket.remove).toHaveBeenCalledWith([`sheets/${receipt}.pdf`]);
 const uncertain=client({ready:true});uncertain.bucket.remove.mockResolvedValue({data:[],error:null});expect((await abandonAttendanceSheet(uncertain,receipt)).error).toMatch(/not confirmed/);
 const absent=client();expect((await abandonAttendanceSheet(absent,receipt)).ok).toBe(true);expect(absent.bucket.remove).not.toHaveBeenCalled();
});
it('uses 60-second private links and explicit verification arguments; never exposes public URLs',async()=>{
 const c=client();expect((await attendanceSheetLink(c,receipt)).ok).toBe(true);expect(c.bucket.createSignedUrl).toHaveBeenCalledWith(`sheets/${receipt}.pdf`,60);
 expect((await verifyManualAttendance(c,row,false)).ok).toBe(false);expect((await verifyManualAttendance(c,row,true)).ok).toBe(true);
 expect(c.rpc).toHaveBeenCalledWith('verify_manual_attendance',expect.objectContaining({p_evidence:receipt,p_revision:1,p_reviewed:true}));
});

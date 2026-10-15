import { it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { logbookRpc,logbookQueue,logbookSessions,uploadLogbookPage } from '../src/lib/logbook';
import { attendanceSource } from '../src/lib/companyAttendance';
import { attendanceTable } from '../src/lib/reports';
import { internMetrics } from '../src/lib/metrics';
import { ToastProvider } from '../src/components/Toast';
import LogbookAttendance from '../src/components/LogbookAttendance';
const id='00000000-0000-4000-8000-000000000001',evidence='00000000-0000-4000-8000-000000000002';
const row={date:'2026-01-02',endDate:'2026-01-02',timeIn:'08:00:30',timeOut:'16:00:30'};
const rpcRow=data=>({data,error:null});
it('normalizes version composites without accepting an unexpected submission or ambiguous success',async()=>{
 const client={rpc:vi.fn().mockResolvedValue(rpcRow({submission_id:id,version:2,status:'Verified'}))};
 expect((await logbookRpc(client,'verify_record_logbook',{p_id:id})).data.id).toBe(id);
 expect((await logbookRpc(client,'verify_record_logbook',{p_id:evidence})).ok).toBe(false);
 client.rpc.mockResolvedValue(rpcRow([]));expect((await logbookRpc(client,'save_logbook_draft',{p_id:id})).ok).toBe(false);
 client.rpc.mockResolvedValue({data:null,error:{message:'Assignment changed',code:'42501'}});expect(await logbookRpc(client,'submit_logbook',{p_id:id})).toMatchObject({ok:false,errorCode:'42501'});
});
it('reads all cursor pages and rejects repeated/out-of-order identities and RPC errors',async()=>{
 const client={rpc:vi.fn().mockResolvedValueOnce(rpcRow([{id}])).mockResolvedValueOnce(rpcRow([{id:evidence}])).mockResolvedValueOnce(rpcRow([]))};
 expect(await logbookQueue(client)).toEqual([{id},{id:evidence}]);expect(client.rpc.mock.calls[1][1].p_after).toBe(id);
 client.rpc.mockReset().mockResolvedValue(rpcRow([{id}]));await expect(logbookQueue(client)).rejects.toThrow(/changed/);
 client.rpc.mockResolvedValue({data:null,error:{message:'Session expired'}});await expect(logbookQueue(client)).rejects.toThrow(/expired/);
});
it('previews Manila dates, seconds and overnight sessions without mutating the ledger',()=>{
 const records=[],p=logbookSessions([row,{date:'2026-01-03',endDate:'2026-01-04',timeIn:'23:00',timeOut:'01:00'}],id,records,'2026-01-02','2026-01-04');
 expect(p.hours).toBe(10);expect(p.sessions[0].time_in).toBe('2026-01-02T00:00:30.000Z');expect(records).toEqual([]);
});
it('identifies the exact invalid row for missing/future/duplicate/overlap/daily/covered/open-session conflicts',()=>{
 for(const [rows,pattern] of [
  [[row,{...row,timeIn:''}],/Session 2: Enter valid/],
  [[row,row],/Session 2: This exact/],
  [[row,{...row,timeIn:'09:00'}],/Session 2: This session overlaps/],
  [[{...row,timeOut:'09:00'},{...row,timeIn:'10:00'}],/Session 2: One record/],
  [[{...row,date:'2099-01-01',endDate:'2099-01-01'}],/Future/],
  [[{...row,date:'2026-01-01',endDate:'2026-01-01'}],/covered period/]
 ])expect(logbookSessions(rows,id,[],'2026-01-02','2026-01-04').error).toMatch(pattern);
 expect(logbookSessions([row],id,[{intern_id:id,time_out:null}],'2026-01-02','2026-01-04').error).toMatch(/open/);
 expect(logbookSessions([],id,[],'2026-01-02','2026-01-04').error).toMatch(/1–62/);
});
it('reconciles lost upload responses using the same reservation and never overwrites evidence',async()=>{
 const receipt={id:evidence,file_path:`sheets/${evidence}.pdf`,byte_size:10},file={name:'signed.pdf',size:10,type:'application/pdf'};
 const rpc=vi.fn().mockResolvedValueOnce(rpcRow(receipt)).mockResolvedValueOnce({data:null,error:{code:'P0001',message:'Complete upload'}}).mockResolvedValueOnce(rpcRow({...receipt,ready_at:'2026-01-01'}));
 const upload=vi.fn().mockResolvedValue({error:{message:'Network response lost'}}),client={rpc,storage:{from:()=>({upload})}};
 expect((await uploadLogbookPage(client,id,evidence,file)).ok).toBe(true);expect(upload.mock.calls[0][2]).toEqual({upsert:false,contentType:'application/pdf'});
 rpc.mockReset().mockResolvedValue(rpcRow({...receipt,ready_at:'2026-01-01'}));upload.mockClear();expect((await uploadLogbookPage(client,id,evidence,file)).ok).toBe(true);expect(upload).not.toHaveBeenCalled();
});
it('rejects invalid files and preserves actionable expiry/authorization errors before uploading',async()=>{
 const client={rpc:vi.fn().mockResolvedValue({data:null,error:{code:'42501',message:'Assignment expired'}})};
 expect((await uploadLogbookPage(client,id,evidence,{name:'x.exe',type:'application/octet-stream',size:10})).ok).toBe(false);expect(client.rpc).not.toHaveBeenCalled();
 expect((await uploadLogbookPage(client,id,evidence,{name:'x.pdf',type:'application/pdf',size:10485761})).ok).toBe(false);
 expect((await uploadLogbookPage(client,id,evidence,{name:'x.pdf',type:'application/pdf',size:10})).error).toBe('Assignment expired');
});
it('keeps new logbook and legacy provenance distinct and uses the same verified ledger totals',()=>{
 const ledger={id:evidence,intern_id:id,log_date:row.date,clocked_in_at:'2026-01-02T00:00:30Z',clocked_out_at:'2026-01-02T08:00:30Z',time_in:'08:00:30',time_out:'16:00:30',hours:8,verified:true,verified_by:evidence,attendance_source:'manual_company_sheet',logbook_submission_id:id};
 expect(attendanceSource(ledger)).toBe('Manual — Company Logbook');expect(attendanceSource({...ledger,logbook_submission_id:null})).toBe('Manual — Company Attendance Sheet');
 const documents=['moa','endorsement','consent','medical'].map(doc_type=>({intern_id:id,doc_type,status:'Approved',upload_version:1,file_path:`${id}/signed.pdf`,file_name:'Signed.pdf',reviewed_by:evidence,reviewed_at:'2026-01-01T00:00:00Z'}));
 expect(internMetrics({internId:id,required:8,attendance:[ledger],documents})).toMatchObject({logged:8,verified:8,cleared:true});
 expect(internMetrics({internId:id,required:8,attendance:[{...ledger,verified:false,verified_by:null}],documents})).toMatchObject({logged:8,verified:0,cleared:false});
 const report=attendanceTable([ledger]);expect(report.rows).toHaveLength(1);expect(report.rows[0].at(-1)).toBe('Manual — Company Logbook');expect(JSON.stringify(report)).not.toContain('evidence');
});
it('offers the Supervisor submission action only with assigned interns and renders no old Coordinator upload action',()=>{
 const markup=props=>renderToStaticMarkup(<ToastProvider><LogbookAttendance {...props}/></ToastProvider>);
 expect(markup({supervisor:true})).toContain('disabled=""');
 expect(markup({supervisor:true,roster:[{id,full_name:'Assigned Intern'}]})).toContain('New Submission');
 expect(markup({})).toContain('Manual Attendance Review');expect(markup({})).not.toContain('Record Manual Attendance');expect(markup({})).not.toContain('Save unverified attendance');
});

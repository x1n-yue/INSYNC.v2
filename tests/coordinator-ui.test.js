import {describe,it,expect,vi} from 'vitest';
import {sendAnnouncement} from '../src/lib/announcements';
import {verifyAttendance} from '../src/lib/handoverWorkflows';
import {submissionTypeOptions,submissionDraftTitle,validateSubmission} from '../src/lib/submissions';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const author=id(2),owner=id(4),now=new Date('2026-10-13T00:00:00Z');
const row={id:id(50),intern_id:owner,log_date:'2026-10-01',time_in:'08:00:00.123456',time_out:'08:00:01.123456',
  clocked_in_at:'2026-10-01T00:00:00.123456Z',clocked_out_at:'2026-10-01T00:00:01.123456Z',hours:1/3600,verified:false,verified_by:null};
describe('Coordinator RPC integration (mocked transport)',()=>{
  it('uses controlled announcement parameters and confirms real frozen recipients',async()=>{
    const c={rpc:vi.fn(async()=>({data:{id:id(100),instructor_id:author,title:'Subject',body:'Message',target_intern_id:owner,recipient_ids:[owner]}}))};
    expect((await sendAnnouncement(c,{requestId:id(100),authorId:author,title:' Subject ',body:' Message ',targetInternId:owner})).ok).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith('send_announcement',{p_request_id:id(100),p_title:'Subject',p_body:'Message',p_target_intern_id:owner});
    c.rpc.mockResolvedValue({error:{message:'permission denied for table announcements',code:'42501'}});
    expect(await sendAnnouncement(c,{requestId:id(100),authorId:author,title:'Subject',body:'Message'})).toMatchObject({ok:false,errorCode:'42501'});
  });
  it('does not report fabricated/partial announcement responses as success',async()=>{
    for(const recipients of [[],[owner,owner],[id(5)]]) {
      const c={rpc:vi.fn(async()=>({data:{id:id(100),instructor_id:author,title:'Subject',body:'Message',target_intern_id:owner,recipient_ids:recipients}}))};
      expect((await sendAnnouncement(c,{requestId:id(100),authorId:author,title:'Subject',body:'Message',targetInternId:owner})).ok).toBe(false);
    }
  });
  it('accepts equivalent timestamp encodings without losing microsecond stale-response protection',async()=>{
    const response={...row,clocked_in_at:'2026-10-01T08:00:00.123456+08:00',clocked_out_at:'2026-10-01T00:00:01.123456+00:00',verified:true,verified_by:author};
    const c={rpc:vi.fn(async()=>({data:response}))};
    expect((await verifyAttendance(c,row,now)).ok).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith('verify_attendance',{p_id:row.id,p_expected_in:row.clocked_in_at,p_expected_out:row.clocked_out_at});
    c.rpc.mockResolvedValue({data:{...response,clocked_out_at:'2026-10-01T00:00:01.123457+00:00'}});
    expect((await verifyAttendance(c,row,now)).ok).toBe(false);
  });
  it('keeps missing-function/closed-evidence failures truthful and does not fabricate short-session hours',async()=>{
    const c={rpc:vi.fn(async()=>({error:{code:'PGRST202',message:'Missing verify_attendance in schema cache'}}))};
    expect(await verifyAttendance(c,row,now)).toMatchObject({ok:false,errorCode:'PGRST202'});
    expect(row.hours.toFixed(2)).toBe('0.00');expect(row.hours).toBeGreaterThan(0);
    c.rpc.mockClear();expect((await verifyAttendance(c,{...row,clocked_out_at:null,time_out:null,hours:null},now)).ok).toBe(false);expect(c.rpc).not.toHaveBeenCalled();
  });
});
describe('Flexible submission document types',()=>{
  const records=[{id:id(10),intern_id:owner,name:'MOA',doc_type:'moa'},
    {id:id(11),intern_id:owner,name:'Portfolio',doc_type:`custom:${id(11)}`},
    {id:id(12),intern_id:owner,name:'Portfolio',doc_type:`custom:${id(12)}`}];
  it('uses only actual records, stable IDs and distinct duplicate-name context',()=>{
    const options=submissionTypeOptions(records,owner);expect(options).toHaveLength(3);
    expect(options.find(o=>o.id===id(10)).name).toBe('MOA');
    expect(options[1].label).not.toBe(options[2].label);expect(options[1].label).toContain('Custom requirement');
    expect(submissionDraftTitle(id(12),'ignored',options)).toEqual({ok:true,title:'Portfolio'});
    expect(options.some(o=>o.name==='Medical Certificate')).toBe(false);
  });
  it('requires an Other title; keeps genuinely empty separate from failed retrieval',()=>{
    expect(submissionTypeOptions([],owner)).toEqual([]);
    expect(submissionDraftTitle('other',' ',[]).ok).toBe(false);
    expect(submissionDraftTitle('other','  Other evidence  ',null,'Failure')).toEqual({ok:true,title:'Other evidence'});
    expect(submissionDraftTitle(id(10),'',submissionTypeOptions(records,owner),'Failure').ok).toBe(false);
    expect(submissionDraftTitle('','',[]).ok).toBe(false);
    expect(()=>submissionTypeOptions([{...records[0],intern_id:id(5)}],owner)).toThrow(/incomplete/);
  });
  it('preserves file-validation limits for dropdown titles',()=>{
    const files=[{name:'Evidence.pdf',type:'application/pdf',size:20}];
    const {title}=submissionDraftTitle(id(10),'',submissionTypeOptions(records,owner));
    expect(validateSubmission(title,'',files)).toEqual([]);
    expect(validateSubmission(title,'',Array(11).fill(files[0]))).toContain('Select 1–10 files.');
    expect(validateSubmission(title,'',[{...files[0],size:10*1048576+1}]).length).toBeGreaterThan(0);
    expect(validateSubmission(title,'',[{...files[0],type:'application/exe'}]).length).toBeGreaterThan(0);
    expect(validateSubmission(title,'',Array(6).fill({...files[0],size:10*1048576}))).toContain('Total file size must not exceed 50 MiB.');
  });
});

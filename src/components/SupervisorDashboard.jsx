import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Shell from './Shell';
import { PageHeader, ErrorNotice, LoadingState, EmptyState } from './UI';
import { IconUsers, IconFileText } from './Icons';
import LogbookAttendance from './LogbookAttendance';
import EvaluationWorkflow from './EvaluationWorkflow';
import { paginate } from '../lib/lists';
import { Pagination } from './ListControls';
const navItems=[{id:'manual',label:'Manual Attendance',icon:<IconFileText size={15}/>},{id:'interns',label:'Assigned Interns',icon:<IconUsers size={15}/>},{id:'evaluations',label:'Evaluations',icon:<IconFileText size={15}/>}];
export default function SupervisorDashboard({ profile,onLogout }) {
  const [tab,setTab]=useState('interns'),[roster,setRoster]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [search,setSearch]=useState(''),[page,setPage]=useState(1),[initialIntern,setInitialIntern]=useState('');
  const generation=useRef(0);
  const load=useCallback(async()=>{
    const request=++generation.current;setLoading(true);setError('');
    try {
      const rows=[];let after=null;
      for (;;) {
        const {data,error}=await supabase.rpc('supervisor_roster',{p_after:after,p_size:500});
        if(error)throw error;
        if(!Array.isArray(data)||data.some((r,i)=>!r.id||(i?r.id<=data[i-1].id:after&&r.id<=after)))throw new Error('Assigned roster changed or is unavailable; refresh.');
        if(!data.length)break;rows.push(...data);after=data.at(-1).id;
        if(rows.length>50000)throw new Error('Assigned roster exceeds the supported read limit.');
      }
      const {data:account,error:accountError}=await supabase.rpc('my_profile');
      if(accountError||account?.id!==profile.id||account.role!=='supervisor'||account.status!=='Active')throw new Error('Account changed; refresh your session.');
      if(request===generation.current)setRoster(rows);
    }catch(e){if(request===generation.current){setRoster([]);setError(e.message);}}
    finally{if(request===generation.current)setLoading(false);}
  },[profile.id]);
  useEffect(()=>{load();const timer=setInterval(load,60000);window.addEventListener('focus',load);const guard=generation;return()=>{guard.current++;clearInterval(timer);window.removeEventListener('focus',load);};},[load]);
  const result=paginate(roster.filter(i=>`${i.full_name} ${i.student_id||''} ${i.id}`.toLowerCase().includes(search.trim().toLowerCase())),page,10);
  return <Shell userName={profile.full_name} userEmail={profile.email} userRole="Company Supervisor" navItems={navItems} activeTab={tab} onTabChange={id=>{setInitialIntern('');setTab(id);}} onLogout={onLogout}>
    <div className="dashboard-page supervisor-page">
      {tab==='interns'?<>
        <PageHeader eyebrow="Supervisor workspace" title="Assigned Interns" description="Evaluate only the Active interns explicitly assigned to you by Admin."/>
        <section className="surface-card evaluation-results" aria-label="Assigned intern results">
          <div className="evaluation-toolbar"><label className="evaluation-search">Search assigned interns<input type="search" className="form-control" placeholder="Intern name or student ID" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label><div className="evaluation-actions"><span className="text-xs muted-copy">{roster.length} assigned interns</span><button className="action-secondary" disabled={loading} onClick={load}>Refresh assigned interns</button></div></div>
          {error?<ErrorNotice title="Assigned interns unavailable" onRetry={load}>{error}</ErrorNotice>:loading?<LoadingState>Loading assigned interns…</LoadingState>:result.total?result.rows.map(i=><article key={i.id} className="evaluation-result"><div className="evaluation-result-header"><div><h2 className="font-semibold">{i.full_name}</h2><p className="text-sm muted-copy">Student ID: {i.student_id||'Not recorded'}</p></div><button className="action-primary" onClick={()=>{setInitialIntern(i.id);setTab('evaluations');}}>Evaluate Intern</button></div></article>):<EmptyState title={search.trim()?'No search results':'No assigned interns'} icon={<IconUsers size={24}/>} actions={search.trim()?<button className="action-secondary" onClick={()=>setSearch('')}>Clear search</button>:null}>{search.trim()?'Try another name or student ID.':'Ask Admin to assign Active interns in your company before creating evaluations.'}</EmptyState>}
          {!loading&&!error&&result.total>0&&<Pagination result={result} onPage={setPage} label="assigned interns"/>}
        </section>
      </>:tab==='manual'?<LogbookAttendance supervisor roster={roster} rosterLoading={loading} rosterError={error} onRefreshRoster={load}/>:<EvaluationWorkflow supervisor roster={roster} rosterLoading={loading} rosterError={error} onRefreshRoster={load} initialInternId={initialIntern}/>}
    </div>
  </Shell>;
}

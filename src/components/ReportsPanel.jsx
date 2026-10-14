import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { REPORTS, reportArtifact } from '../lib/reports';
import { downloadArtifact } from '../lib/exports';
import { useToast } from './Toast';
import { REPORT_NOTE } from '../lib/reportFormats';

export function ReportDownloads({ role, reportKey, filters }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const flight = useRef(false), alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const download = async format => {
    if(flight.current)return;
    flight.current=true;setBusy(format);setError('');
    try {
      const artifact=await reportArtifact(supabase,role,reportKey,{...filters},format);
      if(!alive.current)return;
      downloadArtifact(artifact);toast(`Download requested: ${artifact.filename} (${artifact.count} report rows)`, 'info');
    }catch(failure){if(alive.current)setError(failure.message||'Report failed. Retry the selected format.');}
    finally{flight.current=false;if(alive.current)setBusy('');}
  };
  return <div className="space-y-2"><div className="flex gap-2 flex-wrap">
    {['pdf','xlsx','csv'].map(format=><button type="button" key={format} disabled={Boolean(busy)} onClick={()=>download(format)} className="action-secondary"
      aria-label={`Export ${reportKey} ${format==='xlsx'?'Excel':format.toUpperCase()}`}>{busy===format?'Preparing…':format==='xlsx'?'Excel (.xlsx)':format.toUpperCase()}</button>)}
  </div>{error&&<p role="alert" className="text-sm">{error}</p>}{busy&&<p role="status" className="text-xs">Reading complete authorized data and preparing the file…</p>}</div>;
}
export default function ReportsPanel({ role, search='', section='', profile, onSearch, onSection, sections=[] }) {
  const [mode,setMode]=useState('all'),[start,setStart]=useState(''),[end,setEnd]=useState('');
  const filters={mode,start,end,search,section};
  return <section className="space-y-4" aria-label={`${role} report exports`}>
    <p className="text-sm muted-copy">{REPORT_NOTE} Dates are inclusive Manila dates. Full matching data is exported across pages; the visible page does not limit the report.</p>
    {role==='instructor'&&<div className="surface-card p-4 grid sm:grid-cols-2 gap-3">
      <label htmlFor="report-roster-search" className="text-sm">Search assigned name, student ID or company<input id="report-roster-search" type="search" value={search} onChange={e=>onSearch?.(e.target.value)} className="form-control" /></label>
      <label htmlFor="report-roster-section" className="text-sm">Assigned section<select id="report-roster-section" value={section} onChange={e=>onSection?.(e.target.value)} className="form-control">
        <option value="">All assigned sections</option><option value="unassigned">Unassigned</option>{sections.map(s=><option key={s.id} value={s.id}>{s.name}{s.archived_at?' (Archived)':''}</option>)}
      </select></label>
    </div>}
    <div className="surface-card p-4 grid sm:grid-cols-3 gap-3">
      <label htmlFor={`${role}-report-range`} className="text-sm">Date range<select id={`${role}-report-range`} value={mode} onChange={e=>setMode(e.target.value)} className="form-control"><option value="all">All records</option><option value="custom">Custom range</option></select></label>
      {mode==='custom'&&<><label htmlFor={`${role}-report-start`} className="text-sm">From (Manila)<input id={`${role}-report-start`} type="date" value={start} onChange={e=>setStart(e.target.value)} className="form-control" /></label>
        <label htmlFor={`${role}-report-end`} className="text-sm">Through (inclusive)<input id={`${role}-report-end`} type="date" value={end} onChange={e=>setEnd(e.target.value)} className="form-control" /></label></>}
    </div>
    <p className="text-xs muted-copy">Institution: {profile?.organization || 'Not recorded in account data'}. PDF supports up to 5,000 rows; Excel/CSV preserve larger complete datasets within the 50,000-record retrieval limit.</p>
    {role==='instructor'&&<p className="text-sm">The current roster search and section filter apply. Clearance/risk use lifetime evidence; the date range applies to dated attendance and evaluations.</p>}
    <div className="grid lg:grid-cols-2 gap-4">{REPORTS[role].map(report=><article className="surface-card p-4 space-y-3" key={report.key}>
      <h2 className="font-semibold">{report.title}</h2><p className="text-sm muted-copy">{report.description}</p>
      <ReportDownloads role={role} reportKey={report.key} filters={filters} />
    </article>)}</div>
  </section>;
}

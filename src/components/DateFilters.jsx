import { useId } from "react";
export default function DateFilters({ period, onPeriod, start, onStart, end, onEnd, error }) {
  const id=useId();
  return <div className="surface-card space-y-2">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Evaluation date period">
      {[["all","All"],["week","This Week"],["month","This Month"],["custom","Custom date range"]].map(([value,label]) =>
        <button key={value} aria-pressed={period===value} onClick={()=>onPeriod(value)} className={period===value ? "action-primary" : "action-secondary"}>{label}</button>)}
    </div>
    {period==="custom" && <div className="grid sm:grid-cols-2 gap-3">
      <label htmlFor={`${id}-start`} className="text-sm">Start date<input id={`${id}-start`} type="date" value={start} onChange={e=>onStart(e.target.value)} className="form-control" /></label>
      <label htmlFor={`${id}-end`} className="text-sm">End date<input id={`${id}-end`} type="date" value={end} onChange={e=>onEnd(e.target.value)} className="form-control" /></label>
    </div>}
    <p className="text-xs muted-copy">Asia/Manila dates. Weeks run Monday–Sunday; both range boundary dates are included.</p>
    {error && <p role="alert" className="text-sm">{error}</p>}
  </div>;
}

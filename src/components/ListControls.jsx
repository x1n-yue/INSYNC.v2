import { useId } from "react";

export function ListFilters({ search, onSearch, section, onSection, sections = [], size, onSize }) {
  const id = useId();
  return <div className="filter-toolbar grid sm:grid-cols-3 gap-3 my-3">
    <div className="text-sm"><label htmlFor={`${id}-search`}>Search name, student ID or company</label>
      <input id={`${id}-search`} type="search" value={search} onChange={e => onSearch(e.target.value)} className="form-control" />
    </div>
    <div className="text-sm"><label htmlFor={`${id}-section`}>Section</label>
      <select id={`${id}-section`} value={section} onChange={e => onSection(e.target.value)} className="form-control">
        <option value="">All sections</option><option value="unassigned">Unassigned section</option>
        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
    {onSize && <div className="text-sm"><label htmlFor={`${id}-size`}>Rows per page</label>
      <select id={`${id}-size`} value={size} onChange={e => onSize(Number(e.target.value))} className="form-control">
        {[10, 25, 50, 100].map(n => <option key={n}>{n}</option>)}
      </select>
    </div>}
  </div>;
}
export function Pagination({ result, onPage, label = "records", disabled = false }) {
  return <nav aria-label={`${label} pages`} className="pagination-bar flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
    <span role="status">{result.from}–{result.to} of {result.total} filtered {label}</span>
    <div className="flex items-center gap-3">
      <button disabled={disabled || result.page <= 1} onClick={() => onPage(result.page - 1)} className="action-secondary">Previous</button>
      <span>Page {result.page} of {result.pages}</span>
      <button disabled={disabled || result.page >= result.pages} onClick={() => onPage(result.page + 1)} className="action-secondary">Next</button>
    </div>
  </nav>;
}

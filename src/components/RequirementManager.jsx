import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { completeRows } from '../lib/workflows';
import { addRequirement } from '../lib/handoverWorkflows';
import { useToast } from './Toast';
import { StatusBadge } from './UI';

export default function RequirementManager({ internId, onChanged, onBusyChange }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(null), [name, setName] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const attempt = useRef(null), flight = useRef(false), sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current; setLoading(true); setError('');
    try {
      const data = await completeRows(supabase, 'documents', internId);
      if (request !== sequence.current) return;
      setRows(data.sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));
      if (attempt.current) {
        if (data.some(r => r.id === attempt.current.id)) setName('');
        attempt.current = null;
      }
    } catch { if (request === sequence.current) { setRows(null); setError('Requirements unavailable. Refresh and retry.'); } }
    finally { if (request === sequence.current) setLoading(false); }
  }, [internId]);
  useEffect(() => { const guard=sequence; load(); return () => { guard.current++; }; }, [load]);
  const save = async event => {
    event.preventDefault(); if (flight.current) return;
    const label = name.trim();
    if (!label || label.length > 200) { setError('Enter a requirement name containing 1–200 characters.'); return; }
    if (attempt.current && attempt.current.label !== label) { setError('Refresh requirements to reconcile the previous attempt before changing its name.'); return; }
    attempt.current ||= { id: crypto.randomUUID(), label };
    flight.current=true; setBusy(true); onBusyChange?.(true); setError('');
    try {
      const result = await addRequirement(supabase, internId, label, attempt.current.id);
      if (!result.ok) { setError(result.error); return; }
      attempt.current=null; setName(''); toast('Custom clearance requirement added', 'success');
      await load(); await onChanged?.();
    } catch { setError('Requirement outcome unknown. Refresh before retrying.'); }
    finally { flight.current=false; setBusy(false); onBusyChange?.(false); }
  };
  return <section className="space-y-4" aria-label="Clearance requirement management">
    <p className="text-sm muted-copy">Every requirement needs current approved evidence for clearance. Repeated names remain distinct requirements. Existing requirements and their history are retained.</p>
    {error && <p role="alert" className="text-sm">{error}</p>}
    <button type="button" disabled={busy || loading} onClick={load} className="action-secondary">Refresh requirements</button>
    {loading ? <p role="status">Loading requirements…</p> : rows && <ul className="space-y-2">{rows.map(r => <li key={r.id} className="surface-card p-3">
      <p className="font-medium">{r.name}</p><p className="text-xs muted-copy">{r.doc_type} · Requirement {r.id.slice(-8)}</p><StatusBadge status={r.status} />
    </li>)}</ul>}
    <form onSubmit={save} className="space-y-3">
      <label htmlFor="custom-requirement-name" className="block text-sm">Custom requirement name<input id="custom-requirement-name" maxLength={200} disabled={busy || rows === null} value={name} onChange={e=>setName(e.target.value)} className="form-control" required /></label>
      <button type="submit" disabled={busy || rows === null} className="action-primary">{busy ? 'Adding…' : 'Add custom requirement'}</button>
    </form>
  </section>;
}

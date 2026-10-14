import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { announcementFeed } from "../lib/workflows";
import { EmptyState, ErrorNotice, LoadingState } from "./UI";
import { IconBell } from "./Icons";

export default function AnnouncementsFeed() {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const sequence = useRef(0);
  const load = async () => {
    const request = ++sequence.current;
    setState({ loading: true, data: null, error: null });
    const result = await announcementFeed(supabase);
    if (request !== sequence.current) return;
    setState({ loading: false, data: result.data?.sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)) ?? null, error: result.error });
  };
  useEffect(() => { const guard = sequence; load(); return () => { guard.current++; }; }, []);
  return <section className="ui-card rounded-xl p-5 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
    <div className="flex flex-wrap gap-2 justify-between"><h2 className="text-sm font-semibold flex items-center gap-2"><IconBell size={17} />Announcements</h2><button disabled={state.loading} onClick={load} className="text-xs underline">{state.error ? "Retry" : "Refresh"}</button></div>
    {state.loading && <LoadingState>Loading announcements…</LoadingState>}
    {state.error && <ErrorNotice title="Announcements unavailable">{state.error}</ErrorNotice>}
    {!state.loading && !state.error && state.data?.length === 0 && <EmptyState title="No announcements for you yet." icon={<IconBell size={24} />} />}
    {state.data?.map(a => <article key={a.id} className="space-y-1 border-t pt-2">
      <h3 className="text-sm font-semibold">{a.title}</h3>
      <p className="text-xs whitespace-pre-wrap break-words">{a.body}</p>
      <p className="text-xs">{new Date(a.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} · {a.target_intern_id ? "Personal" : "Roster announcement"}</p>
    </article>)}
  </section>;
}

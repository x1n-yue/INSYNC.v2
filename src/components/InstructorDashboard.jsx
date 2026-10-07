import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { recordRpc, reviewCorrections } from "../lib/authority";
import Shell from "./Shell";
import { useToast } from "./Toast";
import {
  IconGrid, IconBarChart, IconFileText, IconClipboard, IconBell,
  IconGradCap, IconCheck, IconAlertTriangle, IconTrendingUp, IconClock,
  IconMessageSquare, IconUser, IconFolder, IconUpload,
} from "./Icons";

const navItems = [
  { id: "overview", label: "Class Dashboard", icon: <IconGrid size={15} /> },
  { id: "progress", label: "Progress Tracker", icon: <IconBarChart size={15} /> },
  { id: "evaluations", label: "Evaluations", icon: <IconFileText size={15} /> },
  { id: "dtr-review", label: "DTR Review", icon: <IconClock size={15} /> },
  { id: "documents", label: "Intern Documents", icon: <IconFolder size={15} /> },
  { id: "reports", label: "Reports", icon: <IconClipboard size={15} /> },
  { id: "announcements", label: "Announcements", icon: <IconBell size={15} /> },
];

const rubricCriteria = [
  { id: "punctuality", label: "Punctuality & Attendance", weight: 0.25 },
  { id: "performance", label: "Task Performance & Quality", weight: 0.35 },
  { id: "conduct", label: "Professional Conduct", weight: 0.2 },
  { id: "communication", label: "Communication Skills", weight: 0.2 },
];
const scaleLabels = { 1: "Poor", 2: "Fair", 3: "Satisfactory", 4: "Good", 5: "Excellent" };

const todayStr = () => new Date().toISOString().slice(0, 10);
const inputStyle = { borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" };
const inputCls = "w-full text-sm py-2 px-3 rounded-lg border outline-none";

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = pct >= 100 ? "var(--success)" : pct > 60 ? "var(--primary)" : "var(--warning)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--secondary)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="font-mono text-xs w-8 text-right" style={{ color: "var(--muted-foreground)" }}>{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    "On Track": { bg: "var(--success-bg)", color: "var(--success)" },
    "At Risk": { bg: "var(--danger-bg)", color: "var(--danger)" },
    "Near Complete": { bg: "var(--info-bg)", color: "var(--info)" },
    Completed: { bg: "var(--success-bg)", color: "var(--success)" },
  };
  return <span className="text-xs px-2 py-0.5 rounded-full" style={map[status] ?? map["On Track"]}>{status}</span>;
}

function DocStatusPill({ status }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={status === "Approved" ? { background: "var(--success-bg)", color: "var(--success)" }
        : status === "Needs Revision" ? { background: "var(--danger-bg)", color: "var(--danger)" }
        : { background: "var(--warning-bg)", color: "var(--warning)" }}>
      {status}
    </span>
  );
}

export default function InstructorDashboard({ profile, onLogout }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reportStates, setReportStates] = useState({});

  const [roster, setRoster] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [evalRecords, setEvalRecords] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [docs, setDocs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Evaluation form
  const [selectedInternId, setSelectedInternId] = useState("");
  const [rubricScores, setRubricScores] = useState({});
  const [qualFeedback, setQualFeedback] = useState("");
  const [showEvalSuccess, setShowEvalSuccess] = useState(false);

  // DTR review
  const [selectedEx, setSelectedEx] = useState([]);

  // Documents
  const [selectedDocInternId, setSelectedDocInternId] = useState("");
  const [revisionNoteForm, setRevisionNoteForm] = useState({});
  const [showRevisionInput, setShowRevisionInput] = useState(null);

  // Announcements
  const [annForm, setAnnForm] = useState({ title: "", body: "", target: "All Interns" });

  const loadAll = async () => {
    setLoading(true);
    const { data: internRows } = await supabase
      .from("interns")
      .select("id, required_hours, status, profiles!interns_id_fkey(full_name), companies(name)")
      .eq("instructor_id", profile.id);

    const internIds = (internRows ?? []).map((r) => r.id);
    const today = todayStr();

    const [
      { data: attendanceRows },
      { data: todayRows },
      { data: evalRows },
      { data: exceptionRows },
      { data: docRows },
      { data: alertRows },
      { data: annRows },
    ] = await Promise.all([
      internIds.length ? supabase.from("attendance_logs").select("intern_id, hours").in("intern_id", internIds) : Promise.resolve({ data: [] }),
      internIds.length ? supabase.from("attendance_logs").select("intern_id, time_in, time_out").in("intern_id", internIds).eq("log_date", today) : Promise.resolve({ data: [] }),
      internIds.length ? supabase.from("evaluations").select("*").in("intern_id", internIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      internIds.length ? supabase.from("attendance_exceptions").select("*").in("intern_id", internIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      internIds.length ? supabase.from("documents").select("*").in("intern_id", internIds).order("name") : Promise.resolve({ data: [] }),
      internIds.length ? supabase.from("alerts").select("*").in("intern_id", internIds).eq("dismissed", false).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      supabase.from("announcements").select("*").eq("instructor_id", profile.id).order("created_at", { ascending: false }),
    ]);

    const hoursByIntern = {};
    (attendanceRows ?? []).forEach((a) => {
      if (a.hours) hoursByIntern[a.intern_id] = (hoursByIntern[a.intern_id] ?? 0) + Number(a.hours);
    });
    const clockedInSet = new Set((todayRows ?? []).filter((t) => t.time_in && !t.time_out).map((t) => t.intern_id));
    const latestScoreByIntern = {};
    (evalRows ?? []).forEach((e) => {
      if (!(e.intern_id in latestScoreByIntern)) latestScoreByIntern[e.intern_id] = e.overall_score;
    });

    const internNameById = {};
    const mergedRoster = (internRows ?? []).map((r) => {
      internNameById[r.id] = r.profiles?.full_name ?? "Unknown";
      const hours = Math.round((hoursByIntern[r.id] ?? 0) * 10) / 10;
      return {
        id: r.id,
        name: r.profiles?.full_name ?? "Unknown",
        company: r.companies?.name ?? "—",
        hours,
        required: r.required_hours,
        midterm: latestScoreByIntern[r.id] ?? null,
        status: r.status,
        clockedIn: clockedInSet.has(r.id),
        cleared: hours >= r.required_hours,
      };
    });

    setRoster(mergedRoster);
    setEvalRecords((evalRows ?? []).map((e) => ({ ...e, internName: internNameById[e.intern_id] ?? "—" })));
    setExceptions((exceptionRows ?? []).map((e) => ({ ...e, internName: internNameById[e.intern_id] ?? "—" })));
    setDocs(docRows ?? []);
    setAlerts((alertRows ?? []).map((a) => ({ ...a, internName: internNameById[a.intern_id] ?? "—" })));
    setAnnouncements(annRows ?? []);
    if (mergedRoster.length && !selectedDocInternId) setSelectedDocInternId(mergedRoster[0].id);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const internName = (id) => roster.find((r) => r.id === id)?.name ?? "—";

  const computedScore = rubricCriteria.reduce((sum, c) => {
    const s = rubricScores[c.id] ?? 0;
    return sum + (s / 5) * 100 * c.weight;
  }, 0);
  const rubricComplete = rubricCriteria.every((c) => rubricScores[c.id] > 0);

  const activeNow = roster.filter((r) => r.clockedIn).length;
  const atRisk = roster.filter((r) => r.status === "At Risk").length;
  const cleared = roster.filter((r) => r.cleared).length;
  const pendingEx = exceptions.filter((e) => e.status === "Pending").length;

  const statCards = [
    { label: "Total Interns", value: `${roster.length}`, icon: <IconGradCap size={18} />, iconBg: "#eff6ff", iconColor: "#2563eb" },
    { label: "Active Now", value: `${activeNow}`, icon: <IconClock size={18} />, iconBg: "#f0fdf4", iconColor: "#16a34a" },
    { label: "At Risk", value: `${atRisk}`, icon: <IconAlertTriangle size={18} />, iconBg: "#fff1f2", iconColor: "#dc2626", warn: true },
    { label: "Cleared", value: `${cleared}`, icon: <IconCheck size={18} />, iconBg: "#fefce8", iconColor: "#d97706" },
  ];

  const reports = [
    { title: "Master Class Progress Report", desc: "Full roster — hours, ratings, completion status", icon: <IconBarChart size={22} /> },
    { title: "Evaluation Summary", desc: "Aggregated rubric grades for academic encoding", icon: <IconFileText size={22} /> },
    { title: "Completion Certificate List", desc: "Interns who have met their hour requirement", icon: <IconCheck size={22} /> },
    { title: "At-Risk Intern Report", desc: "Interns with attendance below 60% — intervention doc", icon: <IconAlertTriangle size={22} /> },
  ];

  const exportReport = (title, format) => {
    setReportStates((s) => ({ ...s, [`${title}-${format}`]: "generating" }));
    toast(`Generating ${title} (${format})…`, "info");
    setTimeout(() => {
      setReportStates((s) => ({ ...s, [`${title}-${format}`]: "done" }));
      toast(`${title} ready — ${format} downloaded`);
      setTimeout(() => setReportStates((s) => ({ ...s, [`${title}-${format}`]: "idle" })), 3000);
    }, 1800);
  };

  const dismissAlert = async (id) => {
    const { error } = await supabase.from("alerts").update({ dismissed: true }).eq("id", id);
    if (error) return toast(error.message, "error");
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast("Alert dismissed");
  };

  // ── Evaluation submit ──
  const submitEval = async () => {
    if (!selectedInternId || !rubricComplete) return;
    const score = Math.round(computedScore);
    const { data, error } = await supabase
      .from("evaluations")
      .insert({
        intern_id: selectedInternId,
        evaluator_id: profile.id,
        competencies: rubricScores,
        feedback: qualFeedback,
        overall_score: score,
      })
      .select()
      .single();
    if (error) return toast(error.message, "error");
    setEvalRecords((prev) => [{ ...data, internName: internName(selectedInternId) }, ...prev]);
    setRoster((prev) => prev.map((r) => (r.id === selectedInternId ? { ...r, midterm: score } : r)));
    const name = internName(selectedInternId);
    setSelectedInternId("");
    setRubricScores({});
    setQualFeedback("");
    setShowEvalSuccess(true);
    toast(`Evaluation for ${name} submitted`, "success");
    setTimeout(() => setShowEvalSuccess(false), 3000);
  };

  // ── DTR exception review ──
  // Approving a request doesn't just flip its status — it has to actually
  // create or correct the attendance_logs row it's claiming, or the fix
  // would never show up in the intern's DTR or Weekly Hours Log graph.
  const runReview = async (ids, decision) => {
    if (reviewBusy || !ids.length) return;
    setReviewBusy(true);
    try {
      const outcomes = await reviewCorrections(supabase, ids, decision);
      const committed = outcomes.filter((r) => r.ok);
      const failed = outcomes.filter((r) => !r.ok);
      const rows = Object.fromEntries(committed.map((r) => [r.id, r.data]));
      setExceptions((prev) => prev.map((e) => rows[e.id] ? { ...e, ...rows[e.id] } : e));
      setSelectedEx((prev) => prev.filter((id) => !rows[id]));
      if (committed.length) toast(committed.length + ' correction(s) ' + decision.toLowerCase(), 'success');
      if (failed.length) toast(failed.length + ' failed: ' + failed[0].error, 'error');
      if (committed.length) await loadAll();
    } finally { setReviewBusy(false); }
  };
  const approveEx = (id) => runReview([id], 'Approved');
  const rejectEx = (id) => runReview([id], 'Rejected');
  const bulkApprove = () => runReview(selectedEx.filter((id) => exceptions.find((e) => e.id === id)?.status === 'Pending'), 'Approved');
  const bulkReject = () => runReview(selectedEx.filter((id) => exceptions.find((e) => e.id === id)?.status === 'Pending'), 'Rejected');
  const toggleSelectEx = (id) => setSelectedEx((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAllPending = () => setSelectedEx(exceptions.filter((e) => e.status === "Pending").map((e) => e.id));

  // ── Documents review ──
  const updateDocStatus = async (doc, status, note) => {
    if (reviewBusy) return { ok: false };
    setReviewBusy(true);
    const result = await recordRpc(supabase, "review_document", {
      p_id: doc.id, p_status: status, p_note: note ?? null, p_expected_path: doc.file_path,
    });
    setReviewBusy(false);
    if (!result.ok) { toast(result.error, "error"); return result; }
    setDocs((prev) => prev.map((d) => d.id === doc.id ? result.data : d));
    const name = internName(doc.intern_id);
    if (status === "Approved") toast(`${name} — document approved`, "success");
    else if (status === "Needs Revision") toast(`Revision requested for ${name}`, "info");
    return result;
  };

  // ── Announcements ──
  const sendAnnouncement = async () => {
    if (!annForm.title.trim() || !annForm.body.trim()) {
      toast("Please fill in title and message", "error");
      return;
    }
    const target = annForm.target;
    const targetIntern = target === "All Interns" ? null : roster.find((r) => r.id === target);
    if (target !== "All Interns" && !targetIntern) return toast("Select a current recipient", "error");
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        instructor_id: profile.id,
        title: annForm.title.trim(),
        body: annForm.body.trim(),
        target: target === "All Interns" ? "All Interns" : "Personal",
        target_intern_id: targetIntern?.id ?? null,
      })
      .select()
      .single();
    if (error) return toast(error.message, "error");
    setAnnouncements((prev) => [data, ...prev]);
    setAnnForm({ title: "", body: "", target: "All Interns" });
    toast("Announcement saved for " + (targetIntern?.name ?? "your active roster"), "success");
  };

  const selectedIntern = roster.find((r) => r.id === selectedDocInternId);
  const selectedInternDocs = docs.filter((d) => d.intern_id === selectedDocInternId);
  const selectedApprovedCount = selectedInternDocs.filter((d) => d.status === "Approved").length;
  const selectedAllApproved = selectedInternDocs.length > 0 && selectedApprovedCount === selectedInternDocs.length;

  return (
    <Shell userName={profile.full_name} userEmail={profile.email} userRole="OJT Coordinator"
      navItems={navItems} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{tab === "overview" ? `Hi, ${profile.full_name.split(" ")[0]}!` : navItems.find((n) => n.id === tab)?.label}</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {profile.organization ?? "Your section"} · {roster.length} Interns
              {alerts.length > 0 && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{alerts.length} alerts</span>
              )}
              {pendingEx > 0 && (
                <span className="ml-1.5 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>{pendingEx} DTR pending</span>
              )}
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
            {new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>

        {loading && <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading…</div>}

        {/* ── OVERVIEW ── */}
        {!loading && tab === "overview" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((s) => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: s.iconBg, color: s.iconColor }}>{s.icon}</div>
                  <div className="text-2xl font-bold mb-0.5" style={{ color: s.warn ? "var(--danger)" : "var(--foreground)" }}>{s.value}</div>
                  <div className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm font-semibold">Class Roster</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {activeNow} active now · {roster.filter((r) => r.status === "Completed").length} completed
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--muted)" }}>
                      {["Intern", "Company", "Hours Progress", "Latest Rating", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s) => (
                      <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">{s.name}</div>
                            {s.clockedIn && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} title="Active now" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{s.company}</td>
                        <td className="px-4 py-3 w-44">
                          <ProgressBar value={s.hours} max={s.required} />
                          <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{s.hours}/{s.required} hrs</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">
                          {s.midterm !== null
                            ? <span style={{ color: s.midterm >= 85 ? "var(--success)" : s.midterm >= 70 ? "var(--primary)" : "var(--warning)" }}>{Number(s.midterm).toFixed(0)}/100</span>
                            : <span style={{ color: "var(--muted-foreground)" }}>Pending</span>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {alerts.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm font-semibold">Active Alerts</span>
                  <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => setTab("announcements")}>View all</button>
                </div>
                {alerts.slice(0, 3).map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <IconAlertTriangle size={14} style={{ color: a.severity === "high" ? "var(--danger)" : "var(--warning)", flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold">{a.internName} · </span>
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{a.detail}</span>
                    </div>
                    <button onClick={() => dismissAlert(a.id)} className="text-xs px-2 py-1 rounded shrink-0" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PROGRESS ── */}
        {!loading && tab === "progress" && (
          <div className="space-y-3">
            {roster.map((s) => {
              const avgVelocity = 8.0;
              const daysLeft = Math.ceil(Math.max(0, s.required - s.hours) / avgVelocity);
              const pct = s.required > 0 ? Math.round((s.hours / s.required) * 100) : 0;
              return (
                <div key={s.id} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold">{s.name}</span>
                      <span className="text-xs ml-2" style={{ color: "var(--muted-foreground)" }}>{s.company}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.status} />
                      <span className="font-mono text-sm">{s.hours} <span style={{ color: "var(--muted-foreground)" }}>/ {s.required} hrs</span></span>
                    </div>
                  </div>
                  <ProgressBar value={s.hours} max={s.required} />
                  <div className="flex gap-4 mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    <span>Remaining: {Math.max(0, s.required - s.hours)} hrs</span>
                    <span>Velocity: ~{avgVelocity} hrs/day</span>
                    <span style={{ color: s.status === "At Risk" ? "var(--danger)" : "var(--muted-foreground)" }}>Est. finish: ~{daysLeft} working days</span>
                    {pct >= 100 && <span style={{ color: "var(--success)" }}>Clearance eligible</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── EVALUATIONS ── */}
        {!loading && tab === "evaluations" && (
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h2 className="text-sm font-semibold mb-3">New Evaluation</h2>
                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>Select Intern</label>
                  <select value={selectedInternId} onChange={(e) => { setSelectedInternId(e.target.value); setRubricScores({}); setQualFeedback(""); }}
                    className={inputCls} style={inputStyle}>
                    <option value="">— Choose intern —</option>
                    {roster.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div className="space-y-4">
                  {rubricCriteria.map((c) => (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{c.label}</span>
                        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          Weight: {c.weight * 100}%{" "}
                          {rubricScores[c.id] ? <span style={{ color: "var(--primary)", fontWeight: 600 }}>{scaleLabels[rubricScores[c.id]]}</span> : ""}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => selectedInternId && setRubricScores((s) => ({ ...s, [c.id]: n }))}
                            disabled={!selectedInternId}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
                            style={{ background: rubricScores[c.id] === n ? "var(--primary)" : "var(--secondary)", color: rubricScores[c.id] === n ? "#fff" : "var(--muted-foreground)" }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {rubricComplete && (
                  <div className="mt-4 rounded-lg p-3 flex items-center justify-between" style={{ background: "var(--primary-light)" }}>
                    <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>Computed Score</span>
                    <span className="text-lg font-bold" style={{ color: "var(--primary)" }}>{Math.round(computedScore)}<span className="text-xs font-normal">/100</span></span>
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>Feedback & Guidance</label>
                  <textarea rows={3} value={qualFeedback} onChange={(e) => setQualFeedback(e.target.value)}
                    placeholder="Specific feedback, constructive guidance, areas for improvement..."
                    className="w-full text-sm py-2 px-3 rounded-lg border outline-none resize-none"
                    style={inputStyle} disabled={!selectedInternId} />
                </div>

                <div className="flex justify-end mt-3 gap-2">
                  {showEvalSuccess && (
                    <span className="text-xs flex items-center gap-1" style={{ color: "var(--success)" }}><IconCheck size={12} /> Saved</span>
                  )}
                  <button onClick={() => { setSelectedInternId(""); setRubricScores({}); setQualFeedback(""); }}
                    className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--secondary)", color: "var(--foreground)" }}>
                    Clear
                  </button>
                  <button onClick={submitEval} disabled={!selectedInternId || !rubricComplete}
                    className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "var(--primary)", color: "#fff" }}>
                    Submit Evaluation
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm font-semibold">Evaluation Records ({evalRecords.length})</span>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "560px" }}>
                  {evalRecords.length === 0 ? (
                    <div className="p-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>No evaluations submitted yet.</div>
                  ) : evalRecords.map((ev) => (
                    <div key={ev.id} className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-sm font-semibold">{ev.internName}</div>
                          <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            Submitted: {new Date(ev.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold" style={{ color: "var(--primary)" }}>{Number(ev.overall_score).toFixed(0)}<span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>/100</span></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                        {rubricCriteria.map((c) => (
                          <div key={c.id} className="flex items-center justify-between text-xs">
                            <span style={{ color: "var(--muted-foreground)" }}>{c.label.split(" ")[0]}</span>
                            <span className="font-semibold" style={{ color: "var(--foreground)" }}>{ev.competencies?.[c.id] ?? "—"}/5</span>
                          </div>
                        ))}
                      </div>
                      {ev.feedback && <p className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>"{ev.feedback}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DTR REVIEW ── */}
        {!loading && tab === "dtr-review" && (
          <>
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <span className="text-sm font-semibold">DTR Exception Queue</span>
                  <span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>{pendingEx} Pending</span>
                </div>
                {selectedEx.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{selectedEx.length} selected</span>
                    <button disabled={reviewBusy} onClick={bulkApprove} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "var(--success-bg)", color: "var(--success)" }}>Approve All</button>
                    <button disabled={reviewBusy} onClick={bulkReject} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>Reject All</button>
                  </div>
                )}
                {selectedEx.length === 0 && pendingEx > 0 && (
                  <button onClick={selectAllPending} className="text-xs" style={{ color: "var(--primary)" }}>Select all pending</button>
                )}
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--muted)" }}>
                    <th className="px-4 py-2.5 w-8"><span className="sr-only">Select</span></th>
                    {["Intern", "Date", "Claimed Time In", "Claimed Time Out", "Reason", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((ex) => (
                    <tr key={ex.id} style={{ borderTop: "1px solid var(--border)", background: selectedEx.includes(ex.id) ? "var(--primary-light)" : undefined }}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedEx.includes(ex.id)} disabled={reviewBusy || ex.status !== "Pending"}
                          onChange={() => toggleSelectEx(ex.id)} className="w-3.5 h-3.5 rounded" />
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">{ex.internName}</td>
                      <td className="px-4 py-3 text-xs">{new Date(ex.log_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td className="px-4 py-3 text-xs font-mono">{ex.claimed_time_in}</td>
                      <td className="px-4 py-3 text-xs font-mono">{ex.claimed_time_out}</td>
                      <td className="px-4 py-3 text-xs max-w-xs" style={{ color: "var(--muted-foreground)" }}>{ex.reason}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={ex.status === "Approved" ? { background: "var(--success-bg)", color: "var(--success)" }
                            : ex.status === "Rejected" ? { background: "var(--danger-bg)", color: "var(--danger)" }
                            : { background: "var(--warning-bg)", color: "var(--warning)" }}>
                          {ex.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {ex.status === "Pending" && (
                          <div className="flex gap-1.5">
                            <button disabled={reviewBusy} onClick={() => approveEx(ex.id)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "var(--success-bg)", color: "var(--success)" }}>Approve</button>
                            <button disabled={reviewBusy} onClick={() => rejectEx(ex.id)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {exceptions.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>No exception requests submitted.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold mb-3">Recent Actions Log</h3>
              <div className="space-y-2">
                {exceptions.filter((e) => e.status !== "Pending").map((ex) => (
                  <div key={ex.id} className="flex items-center gap-3 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ex.status === "Approved" ? "var(--success)" : "var(--danger)" }} />
                    <span style={{ color: "var(--muted-foreground)" }}>
                      <strong style={{ color: "var(--foreground)" }}>{ex.internName}</strong> — {new Date(ex.log_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} exception {ex.status.toLowerCase()}
                    </span>
                  </div>
                ))}
                {exceptions.every((e) => e.status === "Pending") && (
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No actions taken yet.</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── DOCUMENTS ── */}
        {!loading && tab === "documents" && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              {roster.map((r) => {
                const rDocs = docs.filter((d) => d.intern_id === r.id);
                const rApproved = rDocs.filter((d) => d.status === "Approved").length;
                const rPending = rDocs.filter((d) => d.status === "Pending").length;
                const rRevision = rDocs.filter((d) => d.status === "Needs Revision").length;
                return (
                  <button key={r.id} onClick={() => { setSelectedDocInternId(r.id); setShowRevisionInput(null); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
                    style={{
                      background: selectedDocInternId === r.id ? "var(--primary)" : "var(--card)",
                      color: selectedDocInternId === r.id ? "#fff" : "var(--foreground)",
                      border: `1px solid ${selectedDocInternId === r.id ? "var(--primary)" : "var(--border)"}`,
                    }}>
                    <span className="font-medium">{r.name.split(" ")[0]}</span>
                    <span className="text-xs opacity-70">{rApproved}/{rDocs.length}</span>
                    {rRevision > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedDocInternId === r.id ? "#fff" : "var(--danger)" }} />}
                    {rPending > 0 && rRevision === 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedDocInternId === r.id ? "#fff" : "var(--warning)" }} />}
                  </button>
                );
              })}
            </div>

            {selectedIntern && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">{selectedIntern.name}</h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {selectedIntern.company} · {selectedApprovedCount}/{selectedInternDocs.length} documents approved
                      {selectedAllApproved && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "var(--success-bg)", color: "var(--success)" }}>Clearance Eligible</span>}
                    </p>
                  </div>
                  {selectedInternDocs.length > 0 && (
                    <div className="h-1.5 w-32 rounded-full overflow-hidden" style={{ background: "var(--secondary)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(selectedApprovedCount / selectedInternDocs.length) * 100}%`, background: selectedAllApproved ? "var(--success)" : "var(--primary)" }} />
                    </div>
                  )}
                </div>

                {selectedInternDocs.length === 0 ? (
                  <div className="rounded-xl p-6 text-center text-sm" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                    No document requirements set up for this intern yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedInternDocs.map((doc) => {
                      const isShowingRevInput = showRevisionInput === doc.id;
                      return (
                        <div key={doc.id} className="rounded-xl p-4"
                          style={{ background: "var(--card)", border: `1px solid ${doc.status === "Needs Revision" ? "#fca5a5" : doc.status === "Approved" ? "#86efac" : "var(--border)"}` }}>
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: doc.status === "Approved" ? "var(--success-bg)" : doc.status === "Needs Revision" ? "var(--danger-bg)" : "var(--warning-bg)" }}>
                              {doc.status === "Approved" ? <IconCheck size={16} style={{ color: "var(--success)" }} />
                                : doc.status === "Needs Revision" ? <IconAlertTriangle size={16} style={{ color: "var(--danger)" }} />
                                : <IconFileText size={16} style={{ color: "var(--warning)" }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold">{doc.name}</span>
                                <DocStatusPill status={doc.status} />
                              </div>
                              {doc.file_name
                                ? <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><IconFileText size={11} /> {doc.file_name}</div>
                                : <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>No file uploaded yet</div>}
                              {doc.note && (
                                <div className="text-xs mt-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                                  <strong>Revision note:</strong> {doc.note}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {doc.status !== "Approved" && doc.file_name && (
                                <button onClick={() => updateDocStatus(doc, "Approved")} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                                  Approve
                                </button>
                              )}
                              {doc.status === "Approved" && (
                                <button onClick={() => updateDocStatus(doc, "Pending")} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                                  Revoke
                                </button>
                              )}
                              {doc.status !== "Needs Revision" && (
                                <button onClick={() => setShowRevisionInput(isShowingRevInput ? null : doc.id)}
                                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                                  style={{ background: isShowingRevInput ? "var(--danger)" : "var(--danger-bg)", color: isShowingRevInput ? "#fff" : "var(--danger)" }}>
                                  Request Revision
                                </button>
                              )}
                            </div>
                          </div>

                          {isShowingRevInput && (
                            <div className="mt-3 flex gap-2">
                              <input type="text" value={revisionNoteForm[doc.id] ?? ""} onChange={(e) => setRevisionNoteForm((f) => ({ ...f, [doc.id]: e.target.value }))}
                                placeholder="Describe what needs to be corrected..."
                                className="flex-1 text-sm py-1.5 px-3 rounded-lg border outline-none"
                                style={{ borderColor: "var(--danger)", background: "var(--card)", color: "var(--foreground)" }} />
                              <button
                                disabled={reviewBusy || !(revisionNoteForm[doc.id] ?? "").trim()}
                                onClick={async () => {
                                  const result = await updateDocStatus(doc, "Needs Revision", revisionNoteForm[doc.id] ?? "");
                                  if (result?.ok) {
                                    setRevisionNoteForm((f) => ({ ...f, [doc.id]: "" }));
                                    setShowRevisionInput(null);
                                  }
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg font-semibold shrink-0" style={{ background: "var(--danger)", color: "#fff" }}>
                                Send
                              </button>
                              <button onClick={() => setShowRevisionInput(null)} className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── REPORTS ── */}
        {!loading && tab === "reports" && (
          <div className="grid lg:grid-cols-2 gap-4">
            {reports.map((r) => (
              <div key={r.title} className="rounded-xl p-4 flex items-start gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <span className="shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }}>{r.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{r.title}</div>
                  <div className="text-xs mt-0.5 mb-3" style={{ color: "var(--muted-foreground)" }}>{r.desc}</div>
                  <div className="flex gap-2">
                    {["PDF", "Excel"].map((fmt) => {
                      const key = `${r.title}-${fmt}`;
                      const state = reportStates[key] ?? "idle";
                      return (
                        <button key={fmt} disabled={state === "generating"} onClick={() => exportReport(r.title, fmt)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-60 transition-all"
                          style={fmt === "PDF" ? { background: "var(--primary)", color: "#fff" } : { background: "var(--secondary)", color: "var(--foreground)" }}>
                          {state === "generating" ? "Generating…" : state === "done" ? "✓ Done" : fmt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ANNOUNCEMENTS ── */}
        {!loading && tab === "announcements" && (
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold">Send Announcement</h2>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Subject</label>
                <input type="text" value={annForm.title} onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Evaluation Deadline Reminder" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Recipients</label>
                <select value={annForm.target} onChange={(e) => setAnnForm((f) => ({ ...f, target: e.target.value }))} className={inputCls} style={inputStyle}>
                  <option value="All Interns">My active roster</option>
                  {roster.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.company} · {r.id.slice(-6)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Message</label>
                <textarea rows={5} value={annForm.body} onChange={(e) => setAnnForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Type your announcement here..."
                  className="w-full text-sm py-2 px-3 rounded-lg border outline-none resize-none" style={inputStyle} />
              </div>
              <div className="flex justify-end">
                <button onClick={sendAnnouncement} className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>
                  <IconMessageSquare size={14} /> Send Announcement
                </button>
              </div>
            </div>

            <div>
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm font-semibold">Sent Announcements ({announcements.length})</span>
                </div>
                {announcements.length === 0 ? (
                  <div className="p-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>No announcements sent yet.</div>
                ) : announcements.map((a) => (
                  <div key={a.id} className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{a.title}</div>
                        <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                          <span className="flex items-center gap-1"><IconUser size={10} /> {a.target}</span>
                          <span>· {new Date(a.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>{a.body}</p>
                  </div>
                ))}
              </div>

              {alerts.length > 0 && (
                <div className="mt-4 rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="text-sm font-semibold">Active Alerts ({alerts.length})</span>
                  </div>
                  {alerts.map((a) => (
                    <div key={a.id} className="px-4 py-3 flex gap-3 items-start" style={{ borderBottom: "1px solid var(--border)" }}>
                      <IconAlertTriangle size={14} style={{ color: a.severity === "high" ? "var(--danger)" : a.severity === "medium" ? "var(--warning)" : "var(--muted-foreground)", flexShrink: 0, marginTop: 2 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold">{a.type} · {a.internName}</div>
                        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{a.detail}</div>
                      </div>
                      <button onClick={() => dismissAlert(a.id)} className="text-xs px-2 py-1 rounded shrink-0" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "../lib/supabaseClient";
import { requestResult } from "../lib/requests";
import DocumentHistory from "./DocumentHistory";
import { manilaDate, recordRpc } from "../lib/authority";
import { elapsedSession, formatBusinessDate, formatClockTime, isOpenSession } from "../lib/attendance";
import { downloadArtifact, dtrArtifact } from "../lib/exports";
import { evaluationResult } from "../lib/business";
import { attendanceEvidence } from "../lib/hours";
import { chartHours, displayHours, filterAttendance, internMetrics } from "../lib/metrics";
import { completeRows } from "../lib/workflows";
import { dateRange, filterEvaluations } from "../lib/lists";
import DateFilters from "./DateFilters";
import Submissions from "./Submissions";
import { recoverUpload, uploadDocument } from "../lib/documents";
import DocumentActions from "./DocumentActions";
import EvaluationCriteria from "./EvaluationCriteria";
import AnnouncementsFeed from "./AnnouncementsFeed";
import ReportsPanel from "./ReportsPanel";
import Shell from "./Shell";
import { PageHeader, MetricCard, StatusBadge, LoadingState, ErrorNotice, EmptyState } from "./UI";
import Modal from "./Modal";
import { useToast } from "./Toast";
import {
  IconGrid,
  IconClock,
  IconFileText,
  IconFileDown,
  IconFolder,
  IconCheck,
  IconAward,
  IconAlertTriangle,
  IconUpload,
} from "./Icons";

const navItems = [
  { id: "dashboard", label: "My Dashboard", icon: <IconGrid size={15} /> },
  { id: "attendance", label: "My Attendance", icon: <IconClock size={15} /> },
  { id: "documents", label: "My Documents", icon: <IconFolder size={15} /> },
  { id: "evaluations", label: "My Evaluations", icon: <IconFileText size={15} /> },
  { id: "reports", label: "Reports", icon: <IconFileDown size={15} /> },
];

const weekViews = ["Weekly", "Monthly", "Yearly", "All Time"];
const dtrFilters = ["all", "week", "month", "year"];

function formatTime(d) {
  return formatClockTime(d);
}

const todayStr = () => manilaDate();
const inputCls = "w-full text-sm py-2 px-3 rounded-lg border outline-none";
const inputStyle = { borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" };

export default function InternDashboard({ profile, onLogout }) {
  const [evalPeriod, setEvalPeriod] = useState("all");
  const [evalStart, setEvalStart] = useState("");
  const [evalEnd, setEvalEnd] = useState("");
  const [evalError, setEvalError] = useState("");
  const { toast } = useToast();
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const loadSequence = useRef(0), refreshing = useRef(false), writing = useRef(false);
  const [exportBusy, setExportBusy] = useState(false);
  const exportDtr = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const artifact = await dtrArtifact(supabase, profile.id);
      downloadArtifact(artifact);
      toast(`Download requested: ${artifact.filename} (${artifact.count} records)`);
    } catch (error) {
      toast(error.message || "DTR export failed", "error");
    } finally { setExportBusy(false); }
  };
  const [clockBusy, setClockBusy] = useState(false);
  const [clockLoadError, setClockLoadError] = useState(null);
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(null);
  const [recoveryRows, setRecoveryRows] = useState([]);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [metricsError, setMetricsError] = useState(null);
  const [attendanceKnown, setAttendanceKnown] = useState(false);
  const [documentsKnown, setDocumentsKnown] = useState(false);
  const [internInfo, setInternInfo] = useState(null); // { required_hours, companies:{name}, profiles:{full_name} }
  const [dtr, setDtr] = useState([]); // attendance_logs, newest first
  const [evaluationList, setEvaluationList] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [correctionsError, setCorrectionsError] = useState("");
  const [docs, setDocs] = useState([]);
  const [requirementFilter, setRequirementFilter] = useState('');
  const [weekView, setWeekView] = useState("Weekly");
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [dtrFilter, setDtrFilter] = useState("all");

  // Live elapsed timer while clocked in
  const [elapsed, setElapsed] = useState("00:00:00");

  // Accomplishment modal (shown before clock-out)
  const [showAccomplModal, setShowAccomplModal] = useState(false);
  const [accomplishment, setAccomplishment] = useState("");

  // Exception form
  const [exForm, setExForm] = useState({ date: "", endDate: "", claimedIn: "", claimedOut: "", reason: "" });

  // Document upload
  const fileInputRefs = useRef({});

  writing.current = clockBusy || correctionBusy || uploadBusy !== null || recoveryBusy;
  const loadAll = useCallback(async ({ background = false } = {}) => {
    if (background && (refreshing.current || writing.current)) return;
    const request=++loadSequence.current; refreshing.current=true;
    if(!background) setLoading(true);
    const capture = table => completeRows(supabase, table, profile.id).then(data => ({ data })).catch(error => ({ data: null, error }));
    const [{ data: internRow, error: internError }, { data: attendanceRows, error: attendanceError }, { data: evalRows, error: evaluationsError }, { data: exceptionRows, error: exceptionError }, { data: docRows, error: docError }, { data: openRow, error: openError }] =
      await Promise.all([
        requestResult(supabase
          .from("interns")
          .select("instructor_id, section_id, required_hours, companies(name), course_sections(name)")
          .eq("id", profile.id)
          .maybeSingle(), "Intern assignment retrieval failed"),
        capture("attendance_logs"),
        capture("evaluations"),
        requestResult(supabase.from("attendance_exceptions").select("*").eq("intern_id", profile.id).order("created_at", { ascending: false }), "Correction history retrieval failed"),
        capture("documents"),
        requestResult(supabase.from("attendance_logs").select("*").eq("intern_id", profile.id).is("time_out", null).maybeSingle(), "Open session retrieval failed"),
      ]);
    const nameIds = [...new Set([internRow?.instructor_id, ...(evalRows ?? []).map((e) => e.evaluator_id)].filter(Boolean))];
    const { data: nameRows, error: nameError } = await requestResult(supabase.rpc("related_profile_names", { p_ids: nameIds }), "Related names retrieval failed");
    if(request!==loadSequence.current) return;
    if (nameError) {
      toast(`Unable to load related names: ${nameError.message}`, "error");
    }
    const names = Object.fromEntries((nameRows ?? []).map((p) => [p.id, { full_name: p.full_name }]));
    setInternInfo(internRow ? { ...internRow, profiles: names[internRow.instructor_id] } : null);
    setClockLoadError(openError?.message || attendanceError?.message || null);
    setMetricsError(internError?.message || attendanceError?.message || docError?.message || null);
    setAttendanceKnown(Array.isArray(attendanceRows)); setDocumentsKnown(Array.isArray(docRows));
    const history = [...(attendanceRows ?? [])].sort((a,b) => b.log_date.localeCompare(a.log_date) || b.id.localeCompare(a.id));
    setDtr(openRow && !history.some((row) => row.id === openRow.id) ? [openRow, ...history] : history);
    setEvalError(evaluationsError?.message || "");
    setEvaluationList([...(evalRows ?? [])].sort((a,b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || b.id.localeCompare(a.id)).map((e) => ({ ...e, profiles: names[e.evaluator_id] })));
    setCorrectionsError(exceptionError?.message || "");
    setExceptions(exceptionRows ?? []);
    setDocs(docRows ?? []);
    refreshing.current=false;
    setLoading(false);
  }, [profile.id, toast]);

  useEffect(() => {
    const sequence=loadSequence; loadAll();
    const refresh=()=>{if(document.visibilityState==='visible') loadAll({background:true});};
    const timer=setInterval(refresh,60000);
    window.addEventListener('focus',refresh); document.addEventListener('visibilitychange',refresh);
    return()=>{sequence.current++;refreshing.current=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  }, [loadAll]);

  const todayRow = dtr.find((d) => d.time_in && !d.time_out) ?? dtr.find((d) => d.log_date === todayStr());
  const clockInDate = isOpenSession(todayRow) ? new Date(todayRow.clocked_in_at) : null;
  const isClockedIn = Boolean(todayRow && todayRow.time_in && !todayRow.time_out);

  // Live elapsed timer
  useEffect(() => {
    if (!isClockedIn || !isOpenSession(todayRow)) {
      setElapsed(isClockedIn ? "Legacy session · correction required" : "00:00:00");
      return;
    }
    const id = setInterval(() => {
      setElapsed(elapsedSession(todayRow));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClockedIn, todayRow?.clocked_in_at]);

  const handleClockIn = async () => {
    if (clockBusy || clockLoadError) return;
    setClockBusy(true);
    try {
      const result = await recordRpc(supabase, "clock_in");
      if (!result.ok) return toast(result.error, "error");
      loadSequence.current++; refreshing.current=false; setLoading(false);
      setDtr((prev) => [result.data, ...prev]);
      toast("Clocked in at " + result.data.time_in, "success");
    } finally { setClockBusy(false); }
  };

  const handleClockOut = async (accomp) => {
    if (!todayRow || clockBusy || clockLoadError) return { ok: false };
    setClockBusy(true);
    try {
      const result = await recordRpc(supabase, "clock_out", { p_id: todayRow.id, p_accomplishment: accomp });
      if (!result.ok) { toast(result.error, "error"); return result; }
      loadSequence.current++; refreshing.current=false; setLoading(false);
      setDtr((prev) => prev.map((d) => d.id === result.data.id ? result.data : d));
      toast(`Clocked out — ${Number(result.data.hours).toFixed(2)} hrs logged`, "success");
      return result;
    } finally { setClockBusy(false); }
  };

  const submitException = async () => {
    if (!exForm.date || !exForm.claimedIn || !exForm.claimedOut || !exForm.reason.trim()) {
      toast("Please complete all fields", "error");
      return;
    }
    if (correctionBusy) return;
    setCorrectionBusy(true);
    const result = await recordRpc(supabase, "submit_correction", {
      p_date: exForm.date, p_in: exForm.claimedIn, p_out: exForm.claimedOut,
      p_end: exForm.endDate || exForm.date, p_reason: exForm.reason.trim(),
    });
    setCorrectionBusy(false);
    if (!result.ok) return toast(result.error, "error");
    loadSequence.current++; refreshing.current=false; setLoading(false);
    setExceptions((prev) => [result.data, ...prev]);
    setExForm({ date: "", endDate: "", claimedIn: "", claimedOut: "", reason: "" });
    toast("Exception request submitted — awaiting instructor review", "info");
  };

  const refreshRecovery = async () => {
    const { data, error } = await requestResult(supabase.rpc("unfinished_document_uploads"), "Upload recovery retrieval failed");
    if (error) toast("Upload recovery unavailable: " + error.message, "error");
    else setRecoveryRows(data ?? []);
  };
  useEffect(() => { refreshRecovery(); /* own expired/abandoned receipts only */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);
  const handleDocUpload = async (doc, file) => {
    if (uploadBusy) return;
    setUploadBusy(doc.id);
    try {
      const result = await uploadDocument(supabase, doc, file);
      if (!result.ok) { toast(result.error, "error"); await refreshRecovery(); return result; }
      loadSequence.current++; refreshing.current=false; setLoading(false);
      setDocs(prev => prev.map(d => d.id === result.data.id ? result.data : d));
      toast("Upload finalized; pending review", "info"); return result;
    } finally { setUploadBusy(null); }
  };
  const cleanupUpload = async (uploadId) => {
    if (recoveryBusy || uploadBusy) return;
    setRecoveryBusy(true);
    try {
      const result = await recoverUpload(supabase, uploadId);
      if (result.ok) setDocs(prev => prev.map(d => d.id === result.data.id ? result.data : d));
      toast(result.ok ? "Finalized upload recovered" : result.cleanupPending ? result.error : "Unfinished upload cleanup confirmed", result.cleanupPending ? "error" : "info");
      await refreshRecovery();
    } finally { setRecoveryBusy(false); }
  };
  const metric = useMemo(() => internMetrics({ internId: profile.id, required: internInfo?.required_hours,
    attendance: attendanceKnown ? dtr : null, documents: documentsKnown ? docs : null }), [profile.id, internInfo, attendanceKnown, documentsKnown, dtr, docs]);
  const hoursRendered = metric.logged;
  const hoursRequired = metric.target;
  const progress = metric.progress;
  const remainingHours = metric.remaining;
  const filteredDtr = filterAttendance(dtr, dtrFilter);
  const latestEval = evaluationList[0];
  const evaluationRange = dateRange(evalPeriod, evalStart, evalEnd);
  const filteredEvaluations = filterEvaluations(evaluationList, evaluationRange);
  const docApprovedCount = metric.approved;
  const clearanceReady = metric.cleared;
  const weeklyDataSets = useMemo(() => ({ Weekly: chartHours(dtr, "week"), Monthly: chartHours(dtr, "month"), Yearly: chartHours(dtr, "year"), "All Time": chartHours(dtr, "all") }), [dtr]);

  const stats = [
    { icon: <IconClock size={18} />, label: "Logged Hours", value: displayHours(hoursRendered), sub: `Verified: ${displayHours(metric.verified)} / ${hoursRequired ?? "Unavailable"} required` },
    { icon: <IconCheck size={18} />, label: "Completion", value: progress === null ? "Unavailable" : `${progress}%`, sub: `Verified progress | ${metric.risk}` },
    { icon: <IconAward size={18} />, label: "Latest Score", value: evalError ? "Unavailable" : evaluationResult(latestEval) !== null ? `${evaluationResult(latestEval)}/100` : "—", sub: "Most recent evaluation" },
  ];

  return (
    <Shell
      userName={profile.full_name}
      userEmail={profile.email}
      userRole="Student/Intern"
      navItems={navItems}
      activeTab={tab}
      onTabChange={setTab}
      onLogout={onLogout}
    >
      <div className="dashboard-page space-y-6">
        {metricsError && <ErrorNotice title="Progress unavailable" onRetry={loadAll}>{metricsError}</ErrorNotice>}
        {loading && <LoadingState />}

        {!loading && correctionsError && tab === "attendance" && <ErrorNotice title="Correction requests unavailable" onRetry={loadAll}>{correctionsError}</ErrorNotice>}

        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        {!loading && tab === "dashboard" && (
          <>
            <PageHeader eyebrow="Intern workspace" title={`Hi, ${profile.full_name.split(" ")[0]}!`}
              description={`${profile.organization ?? "Your internship workspace"}${internInfo?.companies?.name ? ` - ${internInfo.companies.name}` : ""}`} date />

            <AnnouncementsFeed />
            <div className="surface-card grid sm:grid-cols-3 gap-3 text-sm">
              <div><span className="muted-copy">Assigned instructor</span><p>{internInfo?.profiles?.full_name || "Unassigned / unavailable"}</p></div>
              <div><span className="muted-copy">Company</span><p>{internInfo?.companies?.name || "Unassigned / unavailable"}</p></div>
              <div><span className="muted-copy">Section</span><p>{internInfo?.course_sections?.name || "Unassigned / unavailable"}</p></div>
            </div>
            <div className="surface-card flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold">Today’s Attendance</h2><p className="text-sm muted-copy">{clockLoadError ? "Attendance state unavailable" : isClockedIn ? `Session open · ${elapsed}` : todayRow?.time_out ? "Today’s session completed" : "Ready to clock in"}</p></div>
              <button onClick={()=>isClockedIn ? setShowAccomplModal(true) : handleClockIn()} disabled={clockBusy || Boolean(clockLoadError) || Boolean(todayRow?.time_out)} className="action-primary">{clockBusy ? "Saving…" : isClockedIn ? "Clock Out" : todayRow?.time_out ? "Day Completed" : "Clock In"}</button>
              <button onClick={()=>setTab("attendance")} className="action-secondary">View attendance</button>
            </div>
            <p className="text-xs">Clearance: {clearanceReady === null ? "Unknown" : clearanceReady ? "Eligible" : "Incomplete"} | Standard requirements: {metric.checklist.present}/4</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((s) => <MetricCard key={s.label} {...s} />)}
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 space-y-4">
                <div className="ui-card rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold">{weekView} Logged Hours (sum)</h2>
                    <div className="relative">
                      <button className="text-xs" style={{ color: "var(--primary)" }}
                        onClick={() => setShowWeekPicker((v) => !v)}>
                        {weekView} ▾
                      </button>
                      {showWeekPicker && (
                        <div className="absolute right-0 top-6 z-10 rounded-lg shadow-lg overflow-hidden"
                          style={{ background: "var(--card)", border: "1px solid var(--border)", minWidth: "110px" }}>
                          {weekViews.map((v) => (
                            <button key={v} onClick={() => { setWeekView(v); setShowWeekPicker(false); }}
                              className="w-full text-left px-3 py-2 text-xs transition-colors"
                              style={{
                                background: weekView === v ? "var(--primary-light)" : "transparent",
                                color: weekView === v ? "var(--primary)" : "var(--foreground)",
                              }}>
                              {v}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {attendanceKnown ? <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={weeklyDataSets[weekView]} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(v) => [`${v} hrs`, "Logged hours (sum)"]}
                      />
                      <Area type="monotone" dataKey="hours" stroke="var(--primary)" strokeWidth={2} fill="url(#hoursGrad)"
                        dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer> : <ErrorNotice title="Attendance chart unavailable" onRetry={loadAll} />}
                </div>

                <div className="ui-card rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold">Overall Progress</span>
                    <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{progress === null ? "Unavailable" : `${progress}%`}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--secondary)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress ?? 0}%`, background: "var(--primary)" }} />
                  </div>
                  <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    <span>{displayHours(metric.verified)} verified hrs</span>
                    <span>{displayHours(remainingHours)} verified hrs remaining</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm font-semibold">Recent Evaluations</span>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
                  {evalError ? <ErrorNotice title="Evaluations unavailable" onRetry={loadAll}>{evalError}</ErrorNotice> : evaluationList.length === 0 && <EmptyState title="No evaluations yet" />}
                  {evaluationList.map((ev) => (
                    <div key={ev.id} className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">Evaluation</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                            OJT Coordinator: {ev.profiles?.full_name ?? "—"}
                          </div>
                          <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            {new Date(ev.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" , timeZone: "Asia/Manila" })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold" style={{ color: "var(--primary)" }}>{evaluationResult(ev) ?? "Unavailable"}/100</div>
                          <div className="mt-1 h-1 w-14 rounded-full overflow-hidden ml-auto" style={{ background: "var(--secondary)" }}>
                            <div className="h-full rounded-full" style={{ width: `${evaluationResult(ev) ?? 0}%`, background: "var(--primary)" }} />
                          </div>
                        </div>
                      </div>
                      <EvaluationCriteria criteria={ev.competencies} />
                      {ev.feedback && (
                        <p className="text-xs mt-2 italic" style={{ color: "var(--muted-foreground)" }}>"{ev.feedback}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── ATTENDANCE ────────────────────────────────────────────────── */}
        {!loading && tab === "attendance" && (
          <>
            <PageHeader eyebrow="Intern workspace" title="My Attendance"
              description={`${internInfo?.companies?.name ?? "Company unassigned / unavailable"} - Instructor: ${internInfo?.profiles?.full_name ?? "Unassigned / unavailable"}`}
              actions={<>              <button
                onClick={() => (isClockedIn ? setShowAccomplModal(true) : handleClockIn())}
                disabled={clockBusy || Boolean(clockLoadError) || Boolean(todayRow?.time_out)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0"
                style={{ background: isClockedIn ? "var(--danger-bg)" : "var(--primary)", color: isClockedIn ? "var(--danger)" : "#fff" }}
              >
                <IconClock size={14} />
                {clockBusy ? "Saving…" : isClockedIn ? "Clock Out" : todayRow?.time_out ? "Day Completed" : "Clock In"}
              </button></>} />

            {/* Live session card */}
            {clockLoadError && <p role="alert" className="text-xs" style={{ color: "var(--danger)" }}>
              Clock state unavailable: {clockLoadError}. <button onClick={loadAll} className="underline">Retry</button>
            </p>}
            {isClockedIn && (
              <div className="ui-card rounded-xl p-4 flex items-center gap-4" style={{ background: "var(--info-bg)", border: "1px solid var(--info)" }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ background: "var(--info)" }} />
                <div className="flex-1">
                  <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--info)" }}>Session Active</div>
                  <div className="text-xs" style={{ color: "var(--info)" }}>
                    Clocked in at {clockInDate ? formatTime(clockInDate) : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold font-mono" style={{ color: "var(--info)" }}>{elapsed}</div>
                  <div className="text-xs" style={{ color: "var(--info)" }}>elapsed</div>
                </div>
              </div>
            )}

            {/* DTR table */}
            <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm font-semibold">Daily Time Record (DTR)</span>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {dtrFilters.map((f) => (
                      <button key={f} onClick={() => setDtrFilter(f)}
                        className="text-xs px-2.5 py-1.5 capitalize"
                        style={{ background: dtrFilter === f ? "var(--primary)" : "transparent", color: dtrFilter === f ? "#fff" : "var(--muted-foreground)" }}>
                        {f === "all" ? "All" : f === "week" ? "This Week" : f === "month" ? "This Month" : "This Year"}
                      </button>
                    ))}
                  </div>
                  <button className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--secondary)", color: "var(--foreground)" }}
                    disabled={exportBusy} onClick={exportDtr}>{exportBusy ? "Preparing CSV..." : "Export all CSV"}</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--muted)" }}>
                      {["Date", "Time In", "Time Out", "Hours", "Accomplishments", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceKnown && filteredDtr.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>No records for this period.</td></tr>
                    )}
                    {!attendanceKnown && <tr><td colSpan={6} className="px-4 py-6 text-center text-xs">Attendance records unavailable. Retry the failed section above.</td></tr>}
                    {filteredDtr.map((d) => {
                      const isToday = d.log_date === todayStr();
                      const evidence = attendanceEvidence(d);
                      const clockOutDate = evidence.state === "closed" ? manilaDate(new Date(d.clocked_out_at)) : null;
                      const recordStatus = evidence.state === "legacy-or-invalid" ? "Unknown" : evidence.state === "open" ? "In Progress" : evidence.verification === "verified" ? "Verified" : "Unverified";
                      return (
                        <tr key={d.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">
                            {formatBusinessDate(d.log_date, { month: "short", day: "numeric", weekday: "short" })}
                            {isToday && (
                              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded text-white" style={{ background: "var(--primary)", fontSize: "9px" }}>TODAY</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">{evidence.state === "legacy-or-invalid" ? d.time_in ?? "Unavailable" : formatClockTime(d.clocked_in_at)}</td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: !d.time_out ? "var(--muted-foreground)" : undefined }}>
                            {!d.time_out && isToday && isClockedIn ? (
                              <span className="font-mono" style={{ color: "var(--info)" }}>{elapsed}</span>
                            ) : (evidence.state === "closed" ? formatClockTime(d.clocked_out_at) : d.time_out ?? "—")}
                            {clockOutDate && clockOutDate !== d.log_date && <div className="text-xs muted-copy">Ends {formatBusinessDate(clockOutDate)}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">
                            {evidence.state === "closed" ? <><div>{displayHours(evidence.logged)} logged</div><div className="muted-copy">{displayHours(evidence.verified)} verified</div></> : evidence.state === "open" ? "In progress" : <><div>Unknown</div><div className="muted-copy">Stored: {d.hours ?? "Unavailable"}</div></>}
                          </td>
                          <td className="px-4 py-3 text-xs max-w-xs" style={{ color: "var(--muted-foreground)" }}>
                            {d.accomplishment ? <span style={{ color: "var(--foreground)" }}>{d.accomplishment}</span> : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={recordStatus} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Exception Request */}
            <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <IconAlertTriangle size={14} style={{ color: "var(--warning)" }} />
                  <span className="text-sm font-semibold">Time Log Exception Request</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Submit a correction request for missed or incorrect clock entries.</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="correction-date" className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Date</label>
                    <input id="correction-date" disabled={correctionBusy} type="date" value={exForm.date} onChange={(e) => setExForm((f) => ({ ...f, date: e.target.value }))}
                      className={inputCls} style={inputStyle} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="correction-clock-in" className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Clock In</label>
                      <input id="correction-clock-in" disabled={correctionBusy} type="time" value={exForm.claimedIn} onChange={(e) => setExForm((f) => ({ ...f, claimedIn: e.target.value }))}
                        className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label htmlFor="correction-clock-out" className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Clock Out</label>
                      <input id="correction-clock-out" disabled={correctionBusy} type="time" value={exForm.claimedOut} onChange={(e) => setExForm((f) => ({ ...f, claimedOut: e.target.value }))}
                        className={inputCls} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="correction-end-date" className="block text-xs font-medium mb-1">Clock-out date (overnight only)</label>
                    <input id="correction-end-date" disabled={correctionBusy} type="date" value={exForm.endDate} onChange={(e) => setExForm((f) => ({ ...f, endDate: e.target.value }))}
                      className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label htmlFor="correction-reason" className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Reason / Explanation</label>
                  <textarea id="correction-reason" disabled={correctionBusy} rows={2} value={exForm.reason} onChange={(e) => setExForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="Explain why a correction is needed..."
                    className="w-full text-sm py-2 px-3 rounded-lg border outline-none resize-none"
                    style={inputStyle} />
                </div>
                <div className="flex justify-end">
                  <button onClick={submitException} disabled={correctionBusy} className="text-sm px-4 py-2 rounded-lg font-semibold"
                    style={{ background: "var(--primary)", color: "#fff" }}>
                    Submit Request
                  </button>
                </div>
              </div>

              {exceptions.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="px-4 py-2.5">
                    <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>My Submitted Requests</span>
                  </div>
                  {exceptions.map((ex) => (
                    <div key={ex.id} className="px-4 py-3 flex items-start justify-between gap-3"
                      style={{ borderTop: "1px solid var(--border)" }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">
                          {formatBusinessDate(ex.log_date, { month: "short", day: "numeric" })} · {ex.claimed_time_in} – {ex.claimed_time_out}
                          {ex.claimed_end_date && ex.claimed_end_date !== ex.log_date && <> (ends {formatBusinessDate(ex.claimed_end_date)})</>}
                        </div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{ex.reason}</div>
                        {ex.review_note && <div className="text-xs mt-1 break-words">Review note: {ex.review_note}</div>}
                        <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                          Submitted: {new Date(ex.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" , timeZone: "Asia/Manila" })}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={ex.status === "Approved" ? { background: "var(--success-bg)", color: "var(--success)" }
                          : ex.status === "Rejected" ? { background: "var(--danger-bg)", color: "var(--danger)" }
                          : { background: "var(--warning-bg)", color: "var(--warning)" }}>
                        {ex.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── DOCUMENTS ─────────────────────────────────────────────────── */}
        {!loading && tab === "documents" && (
          <>
            <PageHeader eyebrow="Intern workspace" title="My Documents"
              description={documentsKnown ? `Pre-internship clearance & required submissions - ${docApprovedCount}/${docs.length} Approved` : "Document requirements unavailable"}
              actions={<StatusBadge status={clearanceReady === null ? "Unknown" : clearanceReady ? "Eligible" : "Incomplete"} />} />

            <Submissions internId={profile.id} owner />
            <h2 id="intern-clearance-requirements" tabIndex={-1} className="text-lg font-semibold scroll-mt-4">Clearance requirements</h2>
            <p className="text-sm muted-copy">These existing requirements remain separate. Clearance still requires verified target hours, all four standard types, and approval of every current requirement. Flexible submissions do not count toward this checklist.</p>
            <p className="text-xs">PDF, JPEG or PNG, up to 10 MiB. Replacement resets current review and retains previous evidence.</p>
            {recoveryRows.map(v => <div key={v.id} className="text-xs">Unfinished upload: {v.file_name} <button disabled={recoveryBusy || uploadBusy !== null} onClick={() => cleanupUpload(v.id)} className="underline">Retry cleanup</button></div>)}
            <button onClick={refreshRecovery} disabled={recoveryBusy || uploadBusy !== null} className="text-xs underline">Refresh unfinished uploads</button>
            <p className="text-xs">Standard requirements: {documentsKnown ? `${metric.checklist.present}/4 present` : "Unavailable"}</p>
            {!documentsKnown ? <p role="alert">Document requirements unavailable. <button onClick={loadAll} className="underline">Retry</button></p> : docs.length === 0 ? (
              <div className="ui-card rounded-xl p-8 text-center text-sm" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                No clearance requirements have been set up for you yet — check with your administrator. Flexible submissions are available above.
              </div>
            ) : (
              <>
                {/* Clearance progress */}
                <div className="ui-card rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Clearance Status</span>
                    <span className="text-sm font-bold" style={{ color: docApprovedCount === docs.length ? "var(--success)" : "var(--primary)" }}>
                      {docApprovedCount}/{docs.length} Approved
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--secondary)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(docApprovedCount / docs.length) * 100}%`, background: docApprovedCount === docs.length ? "var(--success)" : "var(--primary)" }} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label htmlFor="clearance-requirement" className="block text-sm font-medium">Choose clearance requirement
                    <select id="clearance-requirement" className="form-control mt-1" value={requirementFilter} onChange={e=>setRequirementFilter(e.target.value)}>
                      <option value="">All requirements</option>
                      {docs.map(d=><option key={d.id} value={d.id}>{d.name} · {d.doc_type} · {d.id.slice(-8)}</option>)}
                    </select>
                  </label>
                  {docs.filter(d=>!requirementFilter||d.id===requirementFilter).map((doc) => (
                    <div key={doc.id} className="ui-card rounded-xl p-4" style={{ background: "var(--card)", border: `1px solid ${doc.status === "Needs Revision" ? "#fca5a5" : "var(--border)"}` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: doc.status === "Approved" ? "var(--success-bg)" : doc.status === "Needs Revision" ? "var(--danger-bg)" : "var(--warning-bg)" }}>
                          {doc.status === "Approved"
                            ? <IconCheck size={16} style={{ color: "var(--success)" }} />
                            : doc.status === "Needs Revision"
                            ? <IconAlertTriangle size={16} style={{ color: "var(--danger)" }} />
                            : <IconFileText size={16} style={{ color: "var(--warning)" }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{doc.name}</span>
                            <StatusBadge status={doc.status} />
                          </div>
                          {doc.file_name && (
                            <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                              <IconFileText size={11} /> {doc.file_name}
                            </div>
                          )}
                          {doc.note && (
                            <div className="text-xs mt-1.5 px-2 py-1.5 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                              <strong>Note:</strong> {doc.note}
                            </div>
                          )}
                        </div>
                        <DocumentActions doc={doc} />
                        <div className="shrink-0">
                          <input type="file" accept="application/pdf,image/jpeg,image/png"
                            ref={(el) => { fileInputRefs.current[doc.id] = el; }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(doc, f); e.target.value = ""; }}
                            className="hidden" />
                          <button disabled={uploadBusy !== null || recoveryBusy} onClick={() => fileInputRefs.current[doc.id]?.click()}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                            style={{ background: doc.status === "Approved" ? "var(--secondary)" : "var(--primary)", color: doc.status === "Approved" ? "var(--muted-foreground)" : "#fff" }}>
                            <IconUpload size={12} />
                            {uploadBusy === doc.id ? "Uploading..." : doc.status === "Approved" ? "Replace" : doc.file_name ? "Resubmit" : "Upload"}
                          </button>
                        </div>
                      </div>
                      <DocumentHistory doc={doc} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── EVALUATIONS ───────────────────────────────────────────────── */}
        {!loading && tab === "evaluations" && (
          <>
            <PageHeader eyebrow="Intern workspace" title="My Evaluations" description="Performance ratings and feedback from your OJT Coordinator. Evaluations are read-only." />
            <DateFilters period={evalPeriod} onPeriod={setEvalPeriod} start={evalStart} onStart={setEvalStart} end={evalEnd} onEnd={setEvalEnd} error={evaluationRange.error} />
            {evalError ? <p role="alert">Evaluations unavailable: {evalError} <button onClick={loadAll} className="underline">Retry</button></p> : <p role="status" className="text-sm">{filteredEvaluations.length} of {evaluationList.length} evaluations</p>}
            <div className="space-y-3">
              {!evalError && !evaluationRange.error && filteredEvaluations.length === 0 && (
                <div className="ui-card rounded-xl p-8 text-center text-sm" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                  No evaluations match this date range.
                </div>
              )}
              {!evalError && filteredEvaluations.map((ev) => (
                <div key={ev.id} className="ui-card rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Evaluation</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        OJT Coordinator: {ev.profiles?.full_name || ev.evaluator_id || "Unavailable"} · {ev.created_at && Number.isFinite(Date.parse(ev.created_at)) ? new Date(ev.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" }) : "Date unavailable"}
                      </div>
                      <EvaluationCriteria criteria={ev.competencies} />
                      {ev.feedback && (
                        <p className="text-sm mt-2 italic" style={{ color: "var(--muted-foreground)" }}>"{ev.feedback}"</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
                        {evaluationResult(ev) ?? "Unavailable"}<span className="text-sm font-normal" style={{ color: "var(--muted-foreground)" }}>/100</span>
                      </div>
                      <div className="mt-1 h-1.5 w-24 rounded-full overflow-hidden ml-auto" style={{ background: "var(--secondary)" }}>
                        <div className="h-full rounded-full" style={{ width: `${evaluationResult(ev) ?? 0}%`, background: "var(--primary)" }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── REPORTS ───────────────────────────────────────────────────── */}
        {!loading && tab === "reports" && (
          <>
            <PageHeader eyebrow="Intern workspace" title="Reports" description="Export complete authorized informational reports. Institutional certificates remain unavailable." />

            <div className="ui-card rounded-xl p-4" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
              <div className="text-sm font-semibold">Certificate of Completion unavailable</div>
              <p className="text-xs mt-1">Certificate generation and institutional approval are not implemented.</p>
              <button disabled className="text-xs mt-3 px-3 py-1.5 rounded-lg opacity-50">Certificate unavailable</button>
            </div>

            <ReportsPanel role="intern" profile={profile} />
          </>
        )}
      </div>

      {/* ── Accomplishment Modal ─────────────────────────────────────────── */}
      {showAccomplModal && (
        <Modal title="Log Today's Accomplishments" busy={clockBusy} onClose={() => setShowAccomplModal(false)} width="480px">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Before clocking out, please briefly describe the tasks you completed during your shift.
            </p>
            <div>
              <label htmlFor="clock-out-accomplishment" className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                Accomplishments / Tasks Completed <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <textarea
                id="clock-out-accomplishment" disabled={clockBusy}
                rows={5}
                value={accomplishment}
                onChange={(e) => setAccomplishment(e.target.value)}
                placeholder="e.g., Completed API integration for the user auth module, attended team standup, reviewed pull request #45, wrote unit tests for the login flow..."
                className="w-full text-sm rounded-lg border outline-none resize-none p-3"
                style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
              <div className="text-xs mt-1 text-right" style={{ color: "var(--muted-foreground)" }}>
                {accomplishment.trim().length} / 500 characters
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowAccomplModal(false)} className="text-sm px-4 py-2 rounded-lg"
                style={{ background: "var(--secondary)", color: "var(--foreground)" }}>Cancel</button>
              <button
                disabled={clockBusy || !accomplishment.trim() || accomplishment.length > 500}
                onClick={async () => { const result = await handleClockOut(accomplishment.trim()); if (result?.ok) { setAccomplishment(""); setShowAccomplModal(false); } }}
                className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--danger)", color: "#fff" }}>
                Clock Out &amp; Save Log
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Shell>
  );
}

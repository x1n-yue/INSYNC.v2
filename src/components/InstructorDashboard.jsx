import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { recordRpc, reviewCorrections } from "../lib/authority";
import { formatBusinessDate, isOpenSession } from "../lib/attendance";
import { RUBRIC, evaluationResult, requiredHours, rubricScore } from "../lib/business";
import { displayHours, internMetrics } from "../lib/metrics";
import { filterRosterMetric, INSTRUCTOR_METRIC_RULES, rosterMetrics, rosterSummary } from "../lib/rosterMetrics";
import { completeRows, saveEvaluation } from "../lib/workflows";
import { verifyAttendance } from "../lib/handoverWorkflows";
import { sendAnnouncement as sendAnnouncementRecord } from "../lib/announcements";
import { attendanceEvidence } from "../lib/hours";
import { formatClockTime } from "../lib/attendance";
import { filterRoster, paginate } from "../lib/lists";
import { ListFilters, Pagination } from "./ListControls";
import Submissions from "./Submissions";
import DocumentActions from "./DocumentActions";
import DocumentHistory from "./DocumentHistory";
import ReportsPanel from "./ReportsPanel";
import EvaluationCriteria from "./EvaluationCriteria";
import Shell from "./Shell";
import { PageHeader, MetricCard, StatusBadge, LoadingState, ErrorNotice } from "./UI";
import { useToast } from "./Toast";
import {
  IconGrid, IconBarChart, IconFileText, IconClipboard, IconBell,
  IconGradCap, IconCheck, IconAlertTriangle, IconClock,
  IconMessageSquare, IconUser, IconFolder,
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

const pageDescriptions = {
  overview: "Monitor your assigned roster, verified progress, and records needing attention.",
  progress: "Track verified hours against each intern's saved target. Logged hours remain separate.",
  evaluations: "Assess assigned interns using the four weighted criteria and review saved evaluations.",
  "dtr-review": "Verify closed attendance or review corrections. Logged hours become verified only after authorized review.",
  documents: "Review current submissions, revision requests, and the separate clearance checklist.",
  reports: "Export informational INSync reports for your complete matching assigned roster.",
  announcements: "Send updates to an individual intern or your assigned active roster.",
};

const rubricCriteria = RUBRIC;
const scaleLabels = { 1: "Poor", 2: "Fair", 3: "Satisfactory", 4: "Good", 5: "Excellent" };

const inputStyle = { borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" };
const inputCls = "w-full text-sm py-2 px-3 rounded-lg border outline-none";

function ProgressBar({ value, max }) {
  if (value == null || requiredHours(max) === null) return <span className="text-xs">Unavailable</span>;
  const pct = Math.min(100, Math.floor(value / Number(max) * 100));
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

export default function InstructorDashboard({ profile, onLogout }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rosterKnown, setRosterKnown] = useState(false);
  const [rosterView, setRosterView] = useState("all");
  const [evidenceNow, setEvidenceNow] = useState(() => new Date());
  const loadSequence = useRef(0), loadInFlight = useRef(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null), [attendancePage, setAttendancePage] = useState(1);
  const verifyInFlight = useRef(false);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [sections, setSections] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewErrors, setViewErrors] = useState({});
  const [flexibleRows, setFlexibleRows] = useState([]);
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const announcementInFlight = useRef(false);
  const announcementAttempt = useRef(null);

  const [rosterBase, setRoster] = useState([]);
  const [metricAttendance, setMetricAttendance] = useState(null);
  const [metricsError, setMetricsError] = useState(null);
  const [evalBusy, setEvalBusy] = useState(false);
  const evalAttempt = useRef(null);
  const evalInFlight = useRef(false);
  const [alerts, setAlerts] = useState([]);
  const alertInFlight = useRef(new Set());
  const [dismissingAlerts, setDismissingAlerts] = useState([]);
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
  const [reviewNote, setReviewNote] = useState("");

  // Documents
  const [selectedDocInternId, setSelectedDocInternId] = useState("");
  const [revisionNoteForm, setRevisionNoteForm] = useState({});
  const [showRevisionInput, setShowRevisionInput] = useState(null);

  // Announcements
  const [annForm, setAnnForm] = useState({ title: "", body: "", target: "All Interns" });

  const roster = useMemo(() => rosterMetrics(rosterBase, metricAttendance, docs, evidenceNow), [rosterBase, metricAttendance, docs, evidenceNow]);
  const loadAll = async ({ background = false, force = false } = {}) => {
    if (background && loadInFlight.current && !force) return;
    const request = ++loadSequence.current;
    loadInFlight.current = true; setRefreshing(true);
    if (!background) setLoading(true);
    try {
    // Metadata only; file bytes and signed URLs are requested only by file actions.
    const columns = { documents: "id,intern_id,doc_type,name,status,upload_version,review_revision,file_path,file_name,reviewed_by,reviewed_at,note",
      attendance_logs: "id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,verified_by,accomplishment" };
    const capture = table => completeRows(supabase, table, undefined, columns[table]).then(data => ({ data })).catch(error => {
      console.error(`Instructor ${table} retrieval failed:`, error.message);
      return { data: null, error };
    });
    const [internResult, peopleResult, companyResult, sectionResult] = await Promise.all([capture("interns"), capture("profiles"), capture("companies"), capture("course_sections")]);
    const assignedRows = internResult.data?.filter(r => r.instructor_id === profile.id);
    const missingProfiles = assignedRows?.some(r => !peopleResult.data?.some(p => p.id === r.id));
    const rosterError = internResult.error?.message || peopleResult.error?.message ||
      (missingProfiles ? "Assigned roster changed while loading. Refresh and retry." : null);
    const internRows = assignedRows?.map(r => ({ ...r,
      profiles: peopleResult.data?.find(p => p.id === r.id), companies: companyResult.data?.find(c => c.id === r.company_id) })).filter(r => r.profiles?.role === "intern");

    const [
      { data: attendanceRows, error: attendanceError },
      { data: evalRows, error: evalError },
      { data: exceptionRows, error: exceptionError },
      { data: docRows, error: docError },
      { data: alertRows, error: alertError },
      { data: annRows, error: annError },
      { data: submissions, error: submissionError },
    ] = await Promise.all([
      capture("attendance_logs"),
      capture("evaluations"),
      capture("attendance_exceptions"),
      capture("documents"),
      capture("alerts"),
      capture("announcements"),
      capture("submissions"),
    ]);

    if (request !== loadSequence.current) return;
    const openRows = attendanceRows?.filter(r => r.time_in && !r.time_out), openError = attendanceError;
    setSections(sectionResult.data ?? []);
    setRosterKnown(!rosterError);
    setMetricAttendance(attendanceRows);
    setEvidenceNow(new Date());
    setMetricsError(attendanceError?.message || docError?.message || null);
    setViewErrors({ roster: rosterError, companies: companyResult.error?.message, sections: sectionResult.error?.message,
      attendance: attendanceError?.message,
      evaluations: evalError?.message, corrections: exceptionError?.message, alerts: alertError?.message, announcements: annError?.message, submissions: submissionError?.message });
    setFlexibleRows(submissions ?? []);
    if (openError) toast(`Unable to load open sessions: ${openError.message}`, "error");
    const clockedInSet = new Set((openRows ?? []).filter(isOpenSession).map((t) => t.intern_id));
    const unknownSessionSet = new Set((openRows ?? []).filter((row) => !isOpenSession(row)).map((t) => t.intern_id));
    const latestScoreByIntern = {};
    [...(evalRows ?? [])].sort((a,b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || b.id.localeCompare(a.id)).forEach((e) => {
      if (!(e.intern_id in latestScoreByIntern)) latestScoreByIntern[e.intern_id] = evaluationResult(e);
    });

    const internNameById = {};
    const mergedRoster = (internRows ?? []).map((r) => {
      internNameById[r.id] = r.profiles?.full_name ?? "Unknown";
      return {
        id: r.id,
        name: r.profiles?.full_name ?? "Unknown",
        company: r.companies?.name ?? "—",
        required: r.required_hours,
        midterm: latestScoreByIntern[r.id] ?? null,
        accountStatus: r.profiles.status,
        studentId: r.profiles.student_id,
        sectionId: r.section_id,
        clockedIn: openError || unknownSessionSet.has(r.id) ? null : clockedInSet.has(r.id),
      };
    });

    setRoster(mergedRoster);
    setEvalRecords((evalRows ?? []).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)) || b.id.localeCompare(a.id)).map((e) => ({ ...e, internName: internNameById[e.intern_id] ?? "—" })));
    setExceptions((exceptionRows ?? []).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)) || b.id.localeCompare(a.id)).map((e) => ({ ...e, internName: internNameById[e.intern_id] ?? "—" })));
    if (exceptionRows) setSelectedEx(prev=>prev.filter(id=>exceptionRows.some(e=>e.id===id && e.status==="Pending")));
    setDocs(docRows);
    setAlerts((alertRows ?? []).filter(a=>!a.dismissed).map((a) => ({ ...a, internName: internNameById[a.intern_id] ?? "—" })));
    setAnnouncements((annRows ?? []).filter(a=>a.instructor_id===profile.id).sort((a,b)=>String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || b.id.localeCompare(a.id)));
    setSelectedDocInternId(current => current || mergedRoster[0]?.id || "");
    } catch (error) {
      if (request !== loadSequence.current) return;
      console.error("Instructor workspace refresh failed:", error.message);
      setRosterKnown(false); setViewErrors(prev => ({ ...prev, roster: "Assigned roster unavailable. Refresh and retry." }));
    } finally {
      if (request === loadSequence.current) { loadInFlight.current = false; setLoading(false); setRefreshing(false); }
    }
  };

  useEffect(() => {
    loadAll();
    const refresh = () => { if (document.visibilityState === "visible") loadAll({ background: true }); };
    const interval = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const guard = loadSequence;
    return () => { guard.current++; loadInFlight.current = false; clearInterval(interval);
      window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const internName = (id) => roster.find((r) => r.id === id)?.name ?? "—";
  const filteredRoster = filterRoster(roster, search, section);
  const classRoster = rosterKnown ? filterRosterMetric(filteredRoster, tab === "overview" ? rosterView : "all") : [];
  const rosterPage = paginate(classRoster, page, pageSize);
  const summary = rosterSummary(roster, rosterKnown);
  const filteredIds = new Set(filteredRoster.map(r=>r.id));
  const exceptionPage = paginate(exceptions.filter(e=>filteredIds.has(e.intern_id)), page, pageSize);
  const evaluationPage = paginate(evalRecords.filter(e=>filteredIds.has(e.intern_id)), page, pageSize);
  const changeSearch = value => { setSearch(value); setPage(1); };
  const changeSection = value => { setSection(value); setPage(1); };
  const attention = roster.map(r=>({ ...r, pending: exceptions.filter(e=>e.intern_id===r.id && e.status==="Pending").length,
    documentAttention: (docs ?? []).filter(d=>d.intern_id===r.id && d.status!=="Approved").length + flexibleRows.filter(s=>s.intern_id===r.id && Number(s.current_version)>0 && s.status!=="Approved").length }))
    .filter(r=>r.status==="At Risk" || r.pending || r.documentAttention);

  const computedScore = rubricScore(rubricScores);
  const rubricComplete = computedScore !== null;

  const activeNow = !rosterKnown || roster.some((r) => r.clockedIn === null) ? "Unavailable" : roster.filter((r) => r.clockedIn).length;
  const metricValue = metric => metric.count === null ? "Unavailable" : metric.unknown ? `${metric.count} confirmed` : `${metric.count}`;
  const metricNote = metric => metric.count === null ? "Roster unavailable. Retry." : metric.unknown ? `Unknown: ${metric.unknown} · total incomplete` : "Complete assigned roster";
  const chooseMetric = view => { setRosterView(prev => prev === view ? "all" : view); setPage(1); };
  const attendanceRows = paginate((metricAttendance ?? []).filter(r => r.time_out && filteredRoster.some(i => i.id === r.intern_id))
    .sort((a,b) => b.log_date.localeCompare(a.log_date) || b.id.localeCompare(a.id)), attendancePage, 25);
  const verifyClosedRecord = async row => {
    if (verifyInFlight.current) return;
    verifyInFlight.current=true; setVerifyingId(row.id);
    try {
      const result = await verifyAttendance(supabase, row);
      if (!result.ok) { toast(result.error, 'error'); return; }
      toast('Closed attendance verified', 'success');
      await loadAll({ background: true, force: true });
    } finally { verifyInFlight.current=false; setVerifyingId(null); }
  };
  const pendingEx = viewErrors.corrections ? "Unavailable" : exceptions.filter((e) => e.status === "Pending").length;

  const statCards = [
    { label: "Total Interns", value: summary.total === null ? "Unavailable" : `${summary.total}`, icon: <IconGradCap size={18} /> },
    { label: "Active Now", value: `${activeNow}`, icon: <IconClock size={18} /> },
    { label: "At Risk", value: metricValue(summary.atRisk), sub: metricNote(summary.atRisk), icon: <IconAlertTriangle size={18} />, warn: true,
      onClick: () => chooseMetric("at-risk"), selected: rosterView === "at-risk", help: INSTRUCTOR_METRIC_RULES.atRisk, describedBy: "at-risk-rule", controls: "class-roster" },
    { label: "Cleared", value: metricValue(summary.cleared), sub: metricNote(summary.cleared), icon: <IconCheck size={18} />,
      onClick: () => chooseMetric("cleared"), selected: rosterView === "cleared", help: INSTRUCTOR_METRIC_RULES.cleared, describedBy: "cleared-rule", controls: "class-roster" },
  ];


  const dismissAlert = async (id) => {
    if (alertInFlight.current.has(id)) return;
    alertInFlight.current.add(id); setDismissingAlerts([...alertInFlight.current]);
    try {
      const { data, error } = await supabase.from("alerts").update({ dismissed: true }).eq("id", id).select().single();
      if (error) throw error;
      if (data?.id !== id || data.dismissed !== true) throw new Error("Alert outcome unknown; refresh before retrying");
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast("Alert dismissed");
    } catch (error) {
      console.error("Alert dismissal failed:", error.message);
      toast("Unable to dismiss the alert. Refresh to check its status before retrying.", "error");
    } finally { alertInFlight.current.delete(id); setDismissingAlerts([...alertInFlight.current]); }
  };

  // ── Evaluation submit ──
  const submitEval = async () => {
    if (!selectedInternId || !rubricComplete || evalInFlight.current) return;
    evalInFlight.current = true; setEvalBusy(true);
    const fingerprint = JSON.stringify([selectedInternId, rubricScores, qualFeedback]);
    if (evalAttempt.current?.fingerprint !== fingerprint) evalAttempt.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const result = await saveEvaluation(supabase, selectedInternId, rubricScores, qualFeedback, evalAttempt.current.id);
      if (!result.ok) { toast(result.error, "error"); return result; }
      const data = result.data;
      setEvalRecords(prev => [{ ...data, internName: internName(selectedInternId) }, ...prev.filter(e => e.id !== data.id)]);
      setRoster(prev => prev.map(r => r.id === selectedInternId ? { ...r, midterm: evaluationResult(data) } : r));
      setSelectedInternId(""); setRubricScores({}); setQualFeedback(""); evalAttempt.current = null;
      setShowEvalSuccess(true); toast("Evaluation submitted", "success");
      setTimeout(() => setShowEvalSuccess(false), 3000); return result;
    } finally { evalInFlight.current = false; setEvalBusy(false); }
  };

  // ── DTR exception review ──
  // Approving a request doesn't just flip its status — it has to actually
  // create or correct the attendance_logs row it's claiming, or the fix
  // would never show up in the intern's DTR or Weekly Hours Log graph.
  const runReview = async (ids, decision) => {
    if (reviewBusy || !ids.length) return;
    if (reviewNote.length > 500 || (decision === "Rejected" && !reviewNote.trim())) {
      toast("Enter a rejection note (at most 500 characters)", "error");
      return;
    }
    if (ids.length > 100) { toast("Select at most 100 corrections per review", "error"); return; }
    setReviewBusy(true);
    try {
      const outcomes = await reviewCorrections(supabase, ids, decision, reviewNote.trim() || null);
      const committed = outcomes.filter((r) => r.ok);
      const failed = outcomes.filter((r) => !r.ok);
      const rows = Object.fromEntries(committed.map((r) => [r.id, r.data]));
      setExceptions((prev) => prev.map((e) => rows[e.id] ? { ...e, ...rows[e.id] } : e));
      setSelectedEx((prev) => prev.filter((id) => !rows[id]));
      if (committed.length) toast(committed.length + ' correction(s) ' + decision.toLowerCase(), 'success');
      if (failed.length) toast(failed.length + ' failed: ' + failed[0].error, 'error');
      if (!failed.length) setReviewNote("");
      if (committed.length) await loadAll();
    } finally { setReviewBusy(false); }
  };
  const approveEx = (id) => runReview([id], 'Approved');
  const rejectEx = (id) => runReview([id], 'Rejected');
  const bulkApprove = () => runReview(selectedEx.filter((id) => exceptions.find((e) => e.id === id)?.status === 'Pending'), 'Approved');
  const bulkReject = () => runReview(selectedEx.filter((id) => exceptions.find((e) => e.id === id)?.status === 'Pending'), 'Rejected');
  const toggleSelectEx = (id) => setSelectedEx((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAllPending = () => setSelectedEx(prev => [...new Set([...prev, ...exceptionPage.rows.filter(e=>e.status==="Pending").map(e=>e.id)])].slice(0,100));

  // ── Documents review ──
  const updateDocStatus = async (doc, status, note) => {
    if (reviewBusy) return { ok: false };
    setReviewBusy(true);
    try {
    const result = await recordRpc(supabase, "review_document_version", {
      p_id: doc.id, p_status: status, p_note: note ?? null, p_expected_version: doc.upload_version, p_expected_revision: doc.review_revision,
    });
    if (!result.ok) { toast(result.error, "error"); return result; }
    setDocs((prev) => prev?.map((d) => d.id === doc.id ? result.data : d));
    const name = internName(doc.intern_id);
    if (status === "Approved") toast(`${name} — document approved`, "success");
    else if (status === "Needs Revision") toast(`Revision requested for ${name}`, "info");
    await loadAll({ background: true, force: true });
    return result;
    } finally { setReviewBusy(false); }
  };

  // ── Announcements ──
  const sendAnnouncement = async () => {
    if (announcementInFlight.current) return;
    if (!annForm.title.trim() || !annForm.body.trim()) {
      toast("Please fill in title and message", "error");
      return;
    }
    const target = annForm.target;
    const targetIntern = target === "All Interns" ? null : roster.find((r) => r.id === target && r.accountStatus==='Active');
    if (target !== "All Interns" && !targetIntern && !announcementAttempt.current) return toast("Select a current recipient", "error");
    const fingerprint=JSON.stringify([annForm.title.trim(),annForm.body.trim(),target]);
    if(announcementAttempt.current && announcementAttempt.current.fingerprint!==fingerprint)
      return toast("Confirm the previous announcement by retrying its original draft before changing it.","error");
    announcementAttempt.current ||= {id:crypto.randomUUID(),fingerprint};
    announcementInFlight.current=true; setAnnouncementBusy(true);
    try {
    const result=await sendAnnouncementRecord(supabase,{requestId:announcementAttempt.current.id,authorId:profile.id,
      title:annForm.title,body:annForm.body,targetInternId:target==='All Interns'?null:target});
    if(!result.ok){
      if(['P0001','42501','40001','23514','23503','22P02','PGRST202','42883'].includes(result.errorCode)) announcementAttempt.current=null;
      return toast(result.error,"error");
    }
    setAnnouncements((prev) => [result.data, ...prev.filter(a=>a.id!==result.data.id)]);
    announcementAttempt.current=null;
    setAnnForm({ title: "", body: "", target: "All Interns" });
    toast("Announcement saved for " + (target==='All Interns'?"your active roster":targetIntern?.name??"the intended recipient"), "success");
    } catch (error) { toast(error.message || "Announcement outcome unknown; refresh before retrying", "error"); }
    finally { announcementInFlight.current=false; setAnnouncementBusy(false); }
  };

  const selectedIntern = filteredRoster.find((r) => r.id === selectedDocInternId);
  const selectedInternDocs = (docs ?? []).filter((d) => d.intern_id === selectedDocInternId);
  const selectedApprovedCount = internMetrics({internId:selectedDocInternId,required:null,attendance:null,documents:docs===null?null:selectedInternDocs}).approved;
  const selectedAllApproved = selectedInternDocs.length > 0 && selectedApprovedCount === selectedInternDocs.length;

  return (
    <Shell userName={profile.full_name} userEmail={profile.email} userRole="OJT Coordinator"
      navItems={navItems} activeTab={tab} onTabChange={value=>{setTab(value);setPage(1);if(value==="overview")loadAll({background:true});}} onLogout={onLogout}>
      <div className="dashboard-page space-y-6">
        <PageHeader eyebrow="Instructor workspace" title={tab === "overview" ? `Hi, ${profile.full_name.split(" ")[0]}!` : navItems.find(n => n.id === tab)?.label}
          description={<>{pageDescriptions[tab]}<span className="block mt-1">{profile.organization ?? "Your section"} - {viewErrors.roster ? "Roster unavailable" : `${roster.length} assigned interns`}</span></>} date
          actions={<button disabled={refreshing || reviewBusy || evalBusy || announcementBusy} onClick={()=>loadAll({background:true})} className="action-secondary">{refreshing ? "Refreshing workspace…" : "Refresh workspace"}</button>} />

        {metricsError && <ErrorNotice title="Progress evidence unavailable" onRetry={()=>loadAll({background:true})}>Attendance or clearance evidence could not be retrieved. Counts remain incomplete until Retry succeeds.</ErrorNotice>}
        {loading && <LoadingState />}
        {!loading && Object.entries(viewErrors).filter(([,value])=>value).map(([key,value])=><ErrorNotice key={key} title={`${key} unavailable`} onRetry={()=>loadAll({background:true})}>{value}</ErrorNotice>)}
        {!loading && ["overview","progress","evaluations","dtr-review","documents"].includes(tab) && <>
          <ListFilters search={search} onSearch={changeSearch} section={section} onSection={changeSection} sections={sections}
            size={pageSize} onSize={value=>{setPageSize(value);setPage(1);}} />
          <p className="text-sm muted-copy">{viewErrors.roster ? "Roster unavailable" : `${filteredRoster.length} of ${roster.length} assigned interns match. Dashboard totals include the complete assigned roster.`}</p>
          {!viewErrors.roster && filteredRoster.length===0 && <p className="surface-card">{roster.length ? "No interns match these filters." : "No interns are assigned to you yet."}</p>}
        </>}

        {/* ── OVERVIEW ── */}
        {!loading && tab === "overview" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((s) => (
                <MetricCard key={s.label} {...s} />
              ))}
            </div>

            <div className="surface-card space-y-2 text-xs muted-copy">
              <p id="at-risk-rule"><strong>At Risk:</strong> {INSTRUCTOR_METRIC_RULES.atRisk}</p>
              <p id="cleared-rule"><strong>Cleared:</strong> {INSTRUCTOR_METRIC_RULES.cleared}</p>
              <p>Counts include each assigned intern once across the complete roster. Unknown evidence is excluded from confirmed counts. Counts refresh every minute while this workspace is visible, on focus, and after reviews. Use Refresh workspace to check recent assignment, target or file changes.</p>
            </div>

            <div id="class-roster" className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex flex-wrap gap-3 items-center"><h2 className="text-sm font-semibold">{rosterView === "cleared" ? "Cleared assigned interns" : rosterView === "at-risk" ? "At Risk assigned interns" : "Class Roster"}</h2>
                  {rosterView !== "all" && <button onClick={()=>{setRosterView("all");setPage(1);}} className="action-secondary">Show all interns</button>}</div>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {activeNow} active now · {metricValue(summary.cleared)} cleared
                </span>
              </div>
              {rosterView !== "all" && <p className="px-4 py-3 text-sm" role="status">
                {rosterKnown ? <>Showing {classRoster.length} confirmed qualifying interns matching the current search and section filters.
                  {(rosterView === "cleared" ? summary.cleared : summary.atRisk).unknown > 0 ? ` Unknown: ${(rosterView === "cleared" ? summary.cleared : summary.atRisk).unknown}. This is an incomplete confirmed list.` : ""}</>
                  : "Qualifying list unavailable. Retry the roster retrieval above."}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--muted)" }}>
                      {["Intern", "Company", "Hours Progress", "Latest Rating", "Status", ...(rosterView !== "all" ? ["Reason / Clearance"] : [])].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rosterPage.rows.map((s) => (
                      <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">{s.name}</div>
                            {s.clockedIn && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} title="Active now" />}
                          </div>
                          <p className="text-xs muted-copy">{s.studentId || "Student ID unavailable"} · {sections.find(x=>x.id===s.sectionId)?.name || "Section unassigned"}</p>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{s.company}</td>
                        <td className="px-4 py-3 w-44">
                          <ProgressBar value={s.hours} max={s.required} />
                          <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{displayHours(s.hours)}/{s.required ?? "Unavailable"} verified hrs</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">
                          {s.midterm !== null
                            ? <span style={{ color: s.midterm >= 85 ? "var(--success)" : s.midterm >= 70 ? "var(--primary)" : "var(--warning)" }}>{Number(s.midterm).toFixed(0)}/100</span>
                            : <span style={{ color: "var(--muted-foreground)" }}>Unavailable</span>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                        {rosterView !== "all" && <td className="px-4 py-3 text-xs min-w-52">
                          {rosterView === "at-risk" ? <><p>Verified hours below saved target.</p>{s.riskReasons.map((reason, index)=><p key={reason.documentId || index} className="mt-1">{reason.message}</p>)}</>
                            : <p>Verified target met and every current standard/custom clearance requirement validly approved.</p>}
                          <button className="action-secondary mt-2" onClick={()=>{setSelectedDocInternId(s.id);setTab("documents");setPage(1);}}>View requirements</button>
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rosterKnown && classRoster.length===0 && <p className="px-4 py-3 text-sm">{rosterView === "all" ? "No interns match these filters." : "No confirmed qualifying interns match these filters. Unknown evidence is not classified."}</p>}
              {!viewErrors.roster && <div className="px-4"><Pagination result={rosterPage} onPage={setPage} label="interns" /></div>}
            </div>

            {attention.length > 0 && (
              <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm font-semibold">Needs attention ({attention.length} interns)</span>
                  <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => setTab("progress")}>View progress</button>
                </div>
                {attention.slice(0, 5).map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <IconAlertTriangle size={14} style={{ color: "var(--danger)", flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold">{a.name} · </span>
                      <span className="text-sm muted-copy">{a.status==="At Risk" ? "At Risk · " : ""}{viewErrors.corrections ? "Corrections unavailable" : `${a.pending} pending corrections`} · {viewErrors.submissions || docs===null ? "Documents unavailable" : `${a.documentAttention} documents needing attention`}</span>
                    </div>
                    <button onClick={() => {setSelectedDocInternId(a.id);setSearch("");setSection("");setTab("documents");}} className="text-xs px-2 py-1 rounded shrink-0" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                      View documents
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
            {!viewErrors.roster && <Pagination result={rosterPage} onPage={setPage} label="interns" />}
            {rosterPage.rows.map((s) => {

              return (
                <div key={s.id} className="ui-card rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold">{s.name}</span>
                      <span className="text-xs ml-2" style={{ color: "var(--muted-foreground)" }}>{s.company}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.status} />
                      <span className="font-mono text-sm">{displayHours(s.hours)} <span style={{ color: "var(--muted-foreground)" }}>/ {s.required} hrs</span></span>
                    </div>
                  </div>
                  <ProgressBar value={s.hours} max={s.required} />
                  <div className="flex gap-4 mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    <span>Remaining: {displayHours(s.remaining)} verified hrs</span>
                    <span>Logged: {displayHours(s.logged)} hrs</span>
                    {s.cleared && <span style={{ color: "var(--success)" }}>Clearance eligible</span>}

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
              <div className="ui-card rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h2 className="text-sm font-semibold mb-3">New Evaluation</h2>
                <div className="mb-4">
                  <label htmlFor="evaluation-intern" className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>Select Intern</label>
                  <select id="evaluation-intern" disabled={evalBusy} value={selectedInternId} onChange={(e) => { setSelectedInternId(e.target.value); setRubricScores({}); setQualFeedback(""); }}
                    className={inputCls} style={inputStyle}>
                    <option value="">— Choose intern —</option>
                    {filteredRoster.filter(r => r.accountStatus === "Active").map((r) => <option key={r.id} value={r.id}>{r.name} · {r.studentId || r.id.slice(-6)}</option>)}
                  </select>
                </div>

                <div className="space-y-4">
                  {rubricCriteria.map((c) => (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{c.label}</span>
                        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          Weight: {c.weight}%{" "}
                          {rubricScores[c.id] ? <span style={{ color: "var(--primary)", fontWeight: 600 }}>{scaleLabels[rubricScores[c.id]]}</span> : ""}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} aria-label={`${c.label}: ${n} — ${scaleLabels[n]}`} aria-pressed={rubricScores[c.id]===n} onClick={() => selectedInternId && setRubricScores((s) => ({ ...s, [c.id]: n }))}
                            disabled={evalBusy || !selectedInternId}
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
                  <label htmlFor="evaluation-feedback" className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>Feedback & Guidance</label>
                  <textarea id="evaluation-feedback" rows={3} maxLength={500} disabled={evalBusy} value={qualFeedback} onChange={(e) => setQualFeedback(e.target.value)}
                    placeholder="Specific feedback, constructive guidance, areas for improvement..."
                    className="w-full text-sm py-2 px-3 rounded-lg border outline-none resize-none"
                    style={inputStyle} />
                </div>

                <div className="flex justify-end mt-3 gap-2">
                  {showEvalSuccess && (
                    <span className="text-xs flex items-center gap-1" style={{ color: "var(--success)" }}><IconCheck size={12} /> Saved</span>
                  )}
                  <button disabled={evalBusy} onClick={() => { setSelectedInternId(""); setRubricScores({}); setQualFeedback(""); }}
                    className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--secondary)", color: "var(--foreground)" }}>
                    Clear
                  </button>
                  <button onClick={submitEval} disabled={evalBusy || !selectedInternId || !rubricComplete}
                    className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "var(--primary)", color: "#fff" }}>
                    Submit Evaluation
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm font-semibold">Evaluation Records</span>
                  {!viewErrors.evaluations && !viewErrors.roster && <Pagination result={evaluationPage} onPage={setPage} label="evaluations" />}
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "560px" }}>
                  {evaluationPage.total === 0 ? (
                    <div className="p-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>{viewErrors.evaluations ? "Evaluation records unavailable. Retry above." : "No evaluations match the selected roster filters."}</div>
                  ) : evaluationPage.rows.map((ev) => (
                    <div key={ev.id} className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-sm font-semibold">{ev.internName}</div>
                          <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            Submitted: {new Date(ev.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" , timeZone: "Asia/Manila" })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold" style={{ color: "var(--primary)" }}>{evaluationResult(ev) ?? "Unavailable"}<span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>/100</span></div>
                        </div>
                      </div>
                      <EvaluationCriteria criteria={ev.competencies} />
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
            <section className="surface-card p-4 space-y-3" aria-label="Closed attendance verification">
              <h2 className="text-base font-semibold">Closed attendance verification</h2>
              <p className="text-sm muted-copy">Review actual attendance and accomplishments before verifying. Hours stay logged and unverified until staff review. Unknown evidence needs a correction.</p>
              {viewErrors.attendance || viewErrors.roster ? <ErrorNotice onRetry={() => loadAll({ background:true, force:true })}>Attendance unavailable. Retry before reviewing.</ErrorNotice> : <>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Intern','Date','Time in / out','Hours','Accomplishments','Review'].map(t=><th key={t} className="text-left p-2">{t}</th>)}</tr></thead><tbody>
                  {attendanceRows.rows.map(row => { const evidence=attendanceEvidence(row); return <tr key={row.id} className="border-t">
                    <td className="p-2">{roster.find(r=>r.id===row.intern_id)?.name || 'Unavailable'}</td>
                    <td className="p-2">{formatBusinessDate(row.log_date,{month:'short',day:'numeric',year:'numeric'})}</td>
                    <td className="p-2">{formatClockTime(row.clocked_in_at)} / {formatClockTime(row.clocked_out_at)}</td>
                    <td className="p-2">{evidence.state === 'closed' ? `${displayHours(evidence.logged)} logged / ${displayHours(evidence.verified)} verified` : 'Unknown'}</td>
                    <td className="p-2 whitespace-pre-wrap break-words max-w-sm">{row.accomplishment || 'No accomplishment recorded'}</td>
                    <td className="p-2">{row.verified && evidence.state==='closed' ? 'Verified' : <button disabled={Boolean(verifyingId) || evidence.state!=='closed'} onClick={()=>verifyClosedRecord(row)} className="action-primary">{verifyingId===row.id ? 'Verifying…' : evidence.state==='closed' ? 'Verify hours' : 'Correction required'}</button>}</td>
                  </tr>; })}
                </tbody></table></div>
                {!attendanceRows.total && <p className="text-sm">No closed attendance in the filtered roster.</p>}
                <Pagination result={attendanceRows} onPage={setAttendancePage} label="closed attendance" disabled={Boolean(verifyingId)} />
              </>}
            </section>
            <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <span className="text-sm font-semibold">DTR Exception Queue</span>
                  <span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>{pendingEx} Pending</span>
                </div>
                {selectedEx.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{selectedEx.length}/100 selected across pages and filters</span>
                    <button disabled={reviewBusy} onClick={bulkApprove} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "var(--success-bg)", color: "var(--success)" }}>Approve selected</button>
                    <button disabled={reviewBusy} onClick={bulkReject} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>Reject selected</button>
                    <button disabled={reviewBusy} onClick={()=>setSelectedEx([])} className="underline text-xs">Clear selection</button>
                  </div>
                )}
                {selectedEx.length === 0 && pendingEx > 0 && (
                  <button disabled={reviewBusy} onClick={selectAllPending} className="text-xs" style={{ color: "var(--primary)" }}>Select pending on this page (maximum 100)</button>
                )}
              </div>
              <div className="px-4 py-3">
                <label htmlFor="correction-review-note" className="block text-xs mb-1">Review note (required to reject; applies to selected requests)</label>
                <textarea id="correction-review-note" value={reviewNote} maxLength={500} disabled={reviewBusy}
                  onChange={(e) => setReviewNote(e.target.value)} className={inputCls} style={inputStyle} rows={2} />
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{reviewNote.length}/500 characters. Failed reviews keep this draft.</p>
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
                  {exceptionPage.rows.map((ex) => (
                    <tr key={ex.id} style={{ borderTop: "1px solid var(--border)", background: selectedEx.includes(ex.id) ? "var(--primary-light)" : undefined }}>
                      <td className="px-4 py-3">
                        <input aria-label={`Select correction for ${ex.internName} on ${ex.log_date}`} type="checkbox" checked={selectedEx.includes(ex.id)} disabled={reviewBusy || ex.status !== "Pending" || (!selectedEx.includes(ex.id) && selectedEx.length>=100)}
                          onChange={() => toggleSelectEx(ex.id)} className="w-3.5 h-3.5 rounded" />
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">{ex.internName}</td>
                      <td className="px-4 py-3 text-xs">{formatBusinessDate(ex.log_date, { month: "short", day: "numeric" })}</td>
                      <td className="px-4 py-3 text-xs font-mono">{ex.claimed_time_in}</td>
                      <td className="px-4 py-3 text-xs font-mono">{ex.claimed_time_out}
                        {ex.claimed_end_date && ex.claimed_end_date !== ex.log_date && <div>Ends {formatBusinessDate(ex.claimed_end_date)}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs" style={{ color: "var(--muted-foreground)" }}>{ex.reason}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={ex.status === "Approved" ? { background: "var(--success-bg)", color: "var(--success)" }
                            : ex.status === "Rejected" ? { background: "var(--danger-bg)", color: "var(--danger)" }
                            : { background: "var(--warning-bg)", color: "var(--warning)" }}>
                          {ex.status}
                        </span>
                        {ex.review_note && <div className="text-xs mt-1 break-words">{ex.review_note}</div>}
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
                  {!viewErrors.corrections && exceptionPage.total === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>No exception requests submitted.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
              {!viewErrors.roster && !viewErrors.corrections && <div className="px-4"><Pagination result={exceptionPage} onPage={setPage} label="corrections" disabled={reviewBusy} /></div>}
            </div>

            <div className="ui-card rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold mb-3">Recent Actions Log</h3>
              <div className="space-y-2">
                {exceptionPage.rows.filter((e) => e.status !== "Pending").map((ex) => (
                  <div key={ex.id} className="flex items-center gap-3 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ex.status === "Approved" ? "var(--success)" : "var(--danger)" }} />
                    <span style={{ color: "var(--muted-foreground)" }}>
                      <strong style={{ color: "var(--foreground)" }}>{ex.internName}</strong> — {formatBusinessDate(ex.log_date, { month: "short", day: "numeric" })} exception {ex.status.toLowerCase()}
                    </span>
                  </div>
                ))}
                {!viewErrors.corrections && exceptions.every((e) => e.status === "Pending") && (
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No actions taken yet.</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── DOCUMENTS ── */}
        {!loading && tab === "documents" && (
          <>
            <label htmlFor="document-intern" className="block text-sm">Choose an intern from the filtered assigned roster
              <select id="document-intern" value={selectedIntern ? selectedDocInternId : ""} onChange={e=>{setSelectedDocInternId(e.target.value);setShowRevisionInput(null);}} className="form-control">
                <option value="">Choose intern</option>{filteredRoster.map(r=><option key={r.id} value={r.id}>{r.name} · {r.studentId || r.id.slice(-6)} · {r.company}</option>)}
              </select>
            </label>

            {selectedIntern && (
              <>
                <Submissions key={selectedIntern.id} internId={selectedIntern.id} />
                <h2 className="text-lg font-semibold">Legacy clearance requirements</h2>
                <p className="text-sm muted-copy">Flexible approvals above do not satisfy this checklist. Clearance retains verified target hours and all four standard document types, plus every other existing requirement.</p>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">{selectedIntern.name}</h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {selectedIntern.company} · {docs===null ? 'Document evidence unavailable' : `${selectedApprovedCount}/${selectedInternDocs.length} confirmed current approvals`}
                      {selectedIntern.cleared && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "var(--success-bg)", color: "var(--success)" }}>Clearance Eligible</span>}
                    </p>
                  </div>
                  {selectedInternDocs.length > 0 && (
                    <div className="h-1.5 w-32 rounded-full overflow-hidden" style={{ background: "var(--secondary)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(selectedApprovedCount / selectedInternDocs.length) * 100}%`, background: selectedAllApproved ? "var(--success)" : "var(--primary)" }} />
                    </div>
                  )}
                </div>

                {docs === null ? <p role="alert">Document requirements unavailable. <button onClick={loadAll} className="underline">Retry</button></p> : selectedInternDocs.length === 0 ? (
                  <div className="ui-card rounded-xl p-6 text-center text-sm" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                    No document requirements set up for this intern yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedInternDocs.map((doc) => {
                      const isShowingRevInput = showRevisionInput === doc.id;
                      return (
                        <div key={doc.id} className="ui-card rounded-xl p-4"
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
                                <StatusBadge status={doc.status} />
                                {Number(doc.upload_version)===0&&<span className="text-xs muted-copy">Stored legacy status; evidence unverified. Resubmission required before review or clearance.</span>}
                              </div>
                              {doc.file_name
                                ? <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><IconFileText size={11} /> {doc.file_name}</div>
                                : <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>No file uploaded yet</div>}
                              {doc.note && (
                                <div className="text-xs mt-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                                  <strong>Review note:</strong> {doc.note}
                                </div>
                              )}
                            </div>
                            <DocumentActions doc={doc} />
                            <div className="flex items-center gap-2 shrink-0">
                              {doc.status === "Pending" && doc.upload_version > 0 && doc.file_name && (
                                <button disabled={reviewBusy} onClick={() => updateDocStatus(doc, "Approved")} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                                  Approve
                                </button>
                              )}
                              {doc.status === "Approved" && doc.upload_version > 0 && (
                                <button disabled={reviewBusy} onClick={() => updateDocStatus(doc, "Pending")} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                                  Revoke
                                </button>
                              )}
                              {doc.status === "Pending" && doc.upload_version > 0 && (
                                <button onClick={() => setShowRevisionInput(isShowingRevInput ? null : doc.id)}
                                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                                  style={{ background: isShowingRevInput ? "var(--danger)" : "var(--danger-bg)", color: isShowingRevInput ? "#fff" : "var(--danger)" }}>
                                  Request Revision
                                </button>
                              )}
                            </div>
                          </div>

                          {isShowingRevInput && (
                            <div className="mt-3 flex flex-wrap items-end gap-2">
                              <label className="min-w-0 flex-1 text-xs">Revision explanation for {doc.name}
                              <input disabled={reviewBusy} type="text" maxLength={500} value={revisionNoteForm[doc.id] ?? ""} onChange={(e) => setRevisionNoteForm((f) => ({ ...f, [doc.id]: e.target.value }))}
                                placeholder="Describe what needs to be corrected..."
                                className="form-control"
                                style={{ borderColor: "var(--danger)", background: "var(--card)", color: "var(--foreground)" }} /></label>
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
                          <DocumentHistory doc={doc} />
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
          <ReportsPanel role="instructor" profile={profile} search={search} section={section} onSearch={changeSearch} onSection={changeSection} sections={sections} />
        )}

        {/* ── ANNOUNCEMENTS ── */}
        {!loading && tab === "announcements" && (
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="ui-card rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold">Send Announcement</h2>
              <div>
                <label htmlFor="announcement-subject" className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Subject</label>
                <input id="announcement-subject" disabled={announcementBusy||Boolean(announcementAttempt.current)} type="text" value={annForm.title} onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Evaluation Deadline Reminder" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label htmlFor="announcement-recipients" className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Recipients</label>
                <select id="announcement-recipients" disabled={announcementBusy||Boolean(announcementAttempt.current)} value={annForm.target} onChange={(e) => setAnnForm((f) => ({ ...f, target: e.target.value }))} className={inputCls} style={inputStyle}>
                  <option value="All Interns">My active roster</option>
                  {annForm.target!=='All Interns'&&!roster.some(r=>r.id===annForm.target&&r.accountStatus==='Active')&&<option value={annForm.target} disabled={!announcementAttempt.current}>{announcementAttempt.current?'Original':'Unavailable'} recipient · {annForm.target.slice(-6)}</option>}
                  {roster.filter(r=>r.accountStatus==='Active').map((r) => <option key={r.id} value={r.id}>{r.name} · {r.company} · {r.id.slice(-6)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="announcement-message" className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Message</label>
                <textarea id="announcement-message" disabled={announcementBusy||Boolean(announcementAttempt.current)} rows={5} value={annForm.body} onChange={(e) => setAnnForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Type your announcement here..."
                  className="w-full text-sm py-2 px-3 rounded-lg border outline-none resize-none" style={inputStyle} />
              </div>
              <div className="flex justify-end">
                <button disabled={announcementBusy} onClick={sendAnnouncement} className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>
                  <IconMessageSquare size={14} /> Send Announcement
                </button>
              </div>
              {!announcementBusy&&announcementAttempt.current&&<p role="status" className="text-sm muted-copy">The outcome is unconfirmed. Retry Send Announcement with this unchanged draft to confirm the original request without sending a duplicate.</p>}
            </div>

            <div>
              <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm font-semibold">Sent Announcements ({viewErrors.announcements ? "Unavailable" : announcements.length})</span>
                </div>
                {announcements.length === 0 ? (
                  <div className="p-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>{viewErrors.announcements ? "Sent announcements unavailable. Retry above." : "No announcements sent yet."}</div>
                ) : announcements.map((a) => (
                  <div key={a.id} className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{a.title}</div>
                        <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                          <span className="flex items-center gap-1"><IconUser size={10} /> {a.target}</span>
                          <span>· {new Date(a.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" , timeZone: "Asia/Manila" })}</span>
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
                      <button disabled={dismissingAlerts.includes(a.id)} onClick={() => dismissAlert(a.id)} className="text-xs px-2 py-1 rounded shrink-0" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                        {dismissingAlerts.includes(a.id) ? "Dismissing…" : "Dismiss"}
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

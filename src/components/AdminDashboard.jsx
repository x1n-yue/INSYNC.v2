import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { requestResult } from "../lib/requests";
import { auditArtifact, downloadArtifact, templateArtifact } from "../lib/exports";
import { recordRpc } from "../lib/authority";
import { checklistState } from "../lib/business";
import { displayHours, internMetrics } from "../lib/metrics";
import { completeRows, saveAssignment } from "../lib/workflows";
import { paginate } from "../lib/lists";
import { Pagination } from "./ListControls";
import SupervisorAssignments from "./SupervisorAssignments";
import LogbookAttendance from './LogbookAttendance';
import { ManualAttendanceHistory } from './CompanyAttendance';
import AuditHistory from "./AuditHistory";
import RequirementManager from "./RequirementManager";
import { setCurrentYear } from '../lib/handoverWorkflows';
import Shell from "./Shell";
import { PageHeader, MetricCard, StatusBadge, LoadingState, ErrorNotice, EmptyState } from "./UI";
import Modal from "./Modal";
import { useToast } from "./Toast";
import {
  IconGrid, IconUsers, IconFolder, IconUpload, IconClipboard, IconShield,
  IconGradCap, IconBuilding, IconCheck,
} from "./Icons";

const navItems = [
  { id: "overview", label: "Overview", icon: <IconGrid size={15} /> },
  { id: "accounts", label: "Account Management", icon: <IconUsers size={15} /> },
  { id: "interns", label: "Interns", icon: <IconGradCap size={15} /> },
  { id: "masterdata", label: "Master Data", icon: <IconFolder size={15} /> },
  { id: "import", label: "Bulk Import", icon: <IconUpload size={15} /> },
  { id: "auditlogs", label: "Audit Logs", icon: <IconClipboard size={15} /> },
  { id: "backup", label: "Backup & Security", icon: <IconShield size={15} /> },
];

const pageDescriptions = {
  overview: "Your internship program at a glance. Manage access, assignments, and reference data.",
  accounts: "Review registered accounts, activate access, and manage roles within assignment restrictions.",
  interns: "Manage instructors, companies, sections, and saved internship hour targets.",
  masterdata: "Maintain reference data and inspect archive impact while retaining historical links.",
  import: "Download blank planning templates. Bulk account imports are unavailable.",
  auditlogs: "Search the complete authorized activity history and export an audit CSV.",
  backup: "Review role permissions. Backup status and uptime monitoring are not connected.",
};

const roleLabel = { admin: "Admin", instructor: "Instructor", intern: "Intern", supervisor: "Supervisor" };
const roleColors = { Intern: "#096d68", Instructor: "#315a76", Admin: "#0b1f33", Supervisor: "#096d68" };
const roles = ["Intern", "Instructor", "Supervisor", "Admin"];

function Field({ label, children }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>{label}</label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
    </div>
  );
}

const inputCls = "w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-all";
const inputStyle = { borderColor: "var(--border)", background: "var(--muted)", color: "var(--foreground)" };

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }) : "—";

export default function AdminDashboard({ profile, onLogout }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [sections, setSections] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState({});
  const [accountPage, setAccountPage] = useState(1);
  const [accountSize, setAccountSize] = useState(25);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [masterSearch, setMasterSearch] = useState("");
  const [archiveModal, setArchiveModal] = useState(null);
  const [archiveConfirmation, setArchiveConfirmation] = useState("");
  const [masterBusy, setMasterBusy] = useState(false);
  const [auditRefresh, setAuditRefresh] = useState(0);
  const [requirementIntern, setRequirementIntern] = useState(null);
  const [requirementBusy, setRequirementBusy] = useState(false);
  const [yearChoice, setYearChoice] = useState(null);
  const loadSequence = useRef(0), dirtyAssignments = useRef(new Set());

  // User modal
  const [userModal, setUserModal] = useState({ open: false, editing: null });
  const [userForm, setUserForm] = useState({ name: "", role: "Intern", status: "Active", companyId: "" });

  // Interns tab — intern rows from the `interns` table, keyed edit buffer, and
  // per-intern document-checklist counts (for the "attach standard docs" button)
  const [internRows, setInternRows] = useState([]);
  const [internForms, setInternForms] = useState({});
  const [docCounts, setDocCounts] = useState({});
  const [metricAttendance, setMetricAttendance] = useState(null);
  const [metricDocuments, setMetricDocuments] = useState(null);
  const [metricsError, setMetricsError] = useState(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [savingInternId, setSavingInternId] = useState(null);
  const [attachingDocsId, setAttachingDocsId] = useState(null);

  // Master data modals — { table, editId, value }
  const [masterModal, setMasterModal] = useState(null);

  const [exportBusy, setExportBusy] = useState(false);
  const requestExport = async (createArtifact) => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const artifact = await createArtifact();
      downloadArtifact(artifact);
      toast(`Download requested: ${artifact.filename}`, "info");
    } catch (error) { toast(error.message || "Export failed; retry", "error"); }
    finally { setExportBusy(false); }
  };

  const loadAll = async () => {
    const request = ++loadSequence.current;
    setLoading(true);
    const [
      { data: profiles, error: profilesError },
      { data: auditRows, error: auditError },
      { data: companyRows, error: companyError },
      { data: sectionRows, error: sectionError },
      { data: yearRows, error: yearError },
      { data: internTableRows, error: internsError },
      { data: docRows, error: docError },
      { data: attendanceRows, error: attendanceError },
    ] = await Promise.all([
      completeRows(supabase, "profiles").then(data => ({ data })).catch(error => ({ data: null, error })),
      requestResult(supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(10), "Audit preview retrieval failed"),
      completeRows(supabase, "companies").then(data => ({ data })).catch(error => ({ data: null, error })),
      completeRows(supabase, "course_sections").then(data => ({ data })).catch(error => ({ data: null, error })),
      completeRows(supabase, "academic_years").then(data => ({ data })).catch(error => ({ data: null, error })),
      completeRows(supabase, "interns").then(data => ({ data })).catch(error => ({ data: null, error })),
      completeRows(supabase, "documents").then(data => ({ data })).catch(error => ({ data: null, error })),
      completeRows(supabase, "attendance_logs").then(data => ({ data })).catch(error => ({ data: null, error })),
    ]);
    if (request !== loadSequence.current) return;
    setUsers(profiles ?? []);
    if (auditError) toast(`Unable to load audit history: ${auditError.message}`, "error");
    setLogs(auditRows ?? []);
    setLoadErrors({ accounts: profilesError?.message, assignments: internsError?.message, companies: companyError?.message,
      sections: sectionError?.message, years: yearError?.message, auditPreview: auditError?.message });
    setCompanies((companyRows ?? []).sort((a,b)=>a.name.localeCompare(b.name)));
    setSections((sectionRows ?? []).sort((a,b)=>a.name.localeCompare(b.name)));
    setYears((yearRows ?? []).sort((a,b)=>b.label.localeCompare(a.label)));
    setInternRows(internTableRows ?? []);
    setInternForms(
      prev => ({ ...Object.fromEntries(
        (internTableRows ?? []).map((r) => [
          r.id,
          { instructor_id: r.instructor_id ?? "", company_id: r.company_id ?? "", section_id: r.section_id ?? "", required_hours: r.required_hours ?? "" },
        ])
      ), ...Object.fromEntries(Object.entries(prev).filter(([id]) => dirtyAssignments.current.has(id))) })
    );
    setMetricAttendance(attendanceRows); setMetricDocuments(docRows);
    setMetricsError(profilesError?.message || internsError?.message || docError?.message || attendanceError?.message || null);
    const counts = {};
    (internTableRows ?? []).forEach(r => { counts[r.id] = checklistState(docRows?.filter(d => d.intern_id === r.id)); });
    setDocCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const guard=loadSequence;
    return () => { guard.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.student_id?.toLowerCase().includes(search.toLowerCase())
  );
  const accountsPage = paginate(filtered, accountPage, accountSize);

  // ── Interns tab: merge `interns` rows with their profile (name/email) ──
  // Only people whose CURRENT role is "intern" belong here — a leftover
  // `interns` row from before a role change should not make someone with
  // the Instructor or Admin role show up in this list.
  const instructorOptions = users.filter((u) => u.role === "instructor" && u.status === "Active");
  const internsForTab = internRows
    .map((r) => {
      const p = users.find((u) => u.id === r.id);
      return p && p.role === "intern" ? { ...r, full_name: p.full_name, email: p.email, status: p.status } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  const assignmentsPage = paginate(internsForTab.filter(r => [r.full_name,r.email,companies.find(c=>c.id===r.company_id)?.name,sections.find(s=>s.id===r.section_id)?.name]
    .some(value=>String(value || "").toLowerCase().includes(assignmentSearch.trim().toLowerCase()))), assignmentPage, 10);

  const updateInternForm = (internId, field, value) => {
    dirtyAssignments.current.add(internId);
    setInternForms((prev) => ({ ...prev, [internId]: { ...prev[internId], [field]: value } }));
  };

  const applyIntern = (row) => {
    if (!row) return;
    dirtyAssignments.current.delete(row.id);
    setInternRows(prev => prev.some(r => r.id === row.id) ? prev.map(r => r.id === row.id ? row : r) : [...prev, row]);
    setInternForms(prev => ({ ...prev, [row.id]: { instructor_id: row.instructor_id ?? "", company_id: row.company_id ?? "", section_id: row.section_id ?? "", required_hours: row.required_hours ?? "" } }));
  };
  const saveInternAssignment = async (internId) => {
    if (savingInternId || !internForms[internId]) return;
    setSavingInternId(internId);
    try {
      const result = await saveAssignment(supabase, internId, internForms[internId]);
      if (!result.ok) { toast(result.error, "error"); return result; }
      applyIntern(result.data);
      await refreshAudit(); toast("Assignment saved", "success");
      return result;
    } finally { setSavingInternId(null); }
  };
  const attachStandardDocs = async (internId) => {
    if (attachingDocsId) return;
    setAttachingDocsId(internId);
    try {
      const result = await recordRpc(supabase, "attach_standard_docs", { p_id: internId });
      if (!result.ok) return toast(result.error, "error");
      setDocCounts(prev => ({ ...prev, [internId]: checklistState(result.data.documents) }));
      setMetricDocuments(prev => prev ? [...prev.filter(d => d.intern_id !== internId), ...result.data.documents] : null);
      await refreshAudit(); toast("Missing standard requirements attached", "success");
    } finally { setAttachingDocsId(null); }
  };

  const refreshAudit = async () => {
    setAuditRefresh(n=>n+1);
    try {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(10);
      if (error) throw error;
      setLogs(data ?? []);
    } catch (error) {
      toast(`Change committed, but audit history could not refresh: ${error.message}`, "error");
    }
  };

  // ── User modal handlers ──
  const openEdit = (u) => {
    const existingInternRow = internRows.find((r) => r.id === u.id);
    setUserForm({
      name: u.full_name,
      role: roleLabel[u.role] ?? u.role,
      status: u.status,
      companyId: u.role === "supervisor" ? u.supervisor_company_id ?? "" : existingInternRow?.company_id ?? "",
    });
    setUserModal({ open: true, editing: u });
  };
  const applyAccount = (data) => {
    setUsers(prev => prev.map(u => u.id === data.id ? data.profile : u));
    applyIntern(data.intern);
  };
  const saveUser = async () => {
    if (!userModal.editing || accountBusy) return;
    setAccountBusy(true);
    try {
      const patch = { full_name: userForm.name, role: userForm.role.toLowerCase(), status: userForm.status };
      if (["intern", "supervisor"].includes(patch.role)) patch.company_id = userForm.companyId || null;
      const result = await recordRpc(supabase, "admin_update_account", { p_id: userModal.editing.id, p_patch: patch });
      if (!result.ok) { toast(result.error, "error"); return result; }
      applyAccount(result.data);
      await refreshAudit(); toast("Account updated", "success");
      setUserModal({ open: false, editing: null }); return result;
    } finally { setAccountBusy(false); }
  };
  const deactivate = async (u) => {
    if (accountBusy) return;
    setAccountBusy(true);
    try {
      const next = u.status === "Active" ? "Inactive" : "Active";
      const result = await recordRpc(supabase, "admin_update_account", { p_id: u.id, p_patch: { status: next } });
      if (!result.ok) return toast(result.error, "error");
      applyAccount(result.data); await refreshAudit(); toast("Account status updated", "success");
    } finally { setAccountBusy(false); }
  };

  // ── Master data handlers ──
  const masterSections = [
    { key: "academic_years", title: "Academic Years", table: "academic_years", rows: years, field: "label" },
    { key: "course_sections", title: "Course Sections", table: "course_sections", rows: sections, field: "name" },
    { key: "companies", title: "Company Directory", table: "companies", rows: companies, field: "name" },
  ];
  const setRowsFor = (table, updater) => {
    if (table === "academic_years") setYears(updater);
    if (table === "course_sections") setSections(updater);
    if (table === "companies") setCompanies(updater);
  };

  const openMasterAdd = (table) => setMasterModal({ table, editId: null, value: "" });
  const openMasterEdit = (table, row, field) => setMasterModal({ table, editId: row.id, value: row[field] });
  const saveMaster = async () => {
    if (masterBusy) return;
    if (!masterModal || !masterModal.value.trim()) {
      toast("Value cannot be empty", "error");
      return;
    }
    const { table, editId, value } = masterModal;
    setMasterBusy(true);
    try {
    const field = table === "academic_years" ? "label" : "name";
    if (editId) {
      const { data, error } = await supabase.from(table).update({ [field]: value.trim() }).eq("id", editId).select().single();
      if (error || data?.id!==editId) return toast(error?.message || "Entry changed; refresh before retrying", "error");
      setRowsFor(table, (prev) => prev.map((r) => (r.id === editId ? data : r)));
      toast("Entry updated");
    } else {
      const { data, error } = await supabase.from(table).insert({ [field]: value.trim() }).select().single();
      if (error || !data?.id) return toast(error?.message || "Entry creation could not be confirmed; refresh before retrying", "error");
      setRowsFor(table, (prev) => [...prev, data]);
      toast("Entry added");
    }
    setMasterModal(null);
    await refreshAudit();
    } catch (error) { toast(error.message || "Save outcome unknown; refresh before retrying", "error"); }
    finally { setMasterBusy(false); }
  };
  const removeMaster = async (table, row) => {
    if(masterBusy)return;
    setMasterBusy(true);
    try {
      const result=await recordRpc(supabase,"admin_master_impact",{p_table:table,p_id:row.id});
      if(!result.ok)return toast(result.error,"error");
      setArchiveConfirmation("");setArchiveModal({table,row,...result.data});
    }finally{setMasterBusy(false);}
  };
  const confirmArchive = async () => {
    if(masterBusy || archiveConfirmation!=="ARCHIVE" || !archiveModal?.can_archive)return;
    setMasterBusy(true);
    try {
      const result=await recordRpc(supabase,"admin_archive_master",{p_table:archiveModal.table,p_id:archiveModal.row.id,p_expected_references:archiveModal.references});
      if(!result.ok)return toast(`${result.error} Inspect the impact again before retrying.`,"error");
      setRowsFor(archiveModal.table,prev=>prev.map(r=>r.id===result.data.id?result.data.entry:r));
      const field=archiveModal.table==="companies"?"company_id":archiveModal.table==="course_sections"?"section_id":null;
      if(field)setInternForms(prev=>Object.fromEntries(Object.entries(prev).map(([key,form])=>[key,form[field]===result.data.id && internRows.find(r=>r.id===key)?.[field]!==result.data.id ? {...form,[field]:internRows.find(r=>r.id===key)?.[field] || ""} : form])));
      setArchiveModal(null);toast("Entry archived; existing assignment links and history retained","success");
      await loadAll();await refreshAudit();
    }finally{setMasterBusy(false);}
  };


  const confirmCurrentYear=async()=>{
    if(masterBusy||!yearChoice)return;
    setMasterBusy(true);
    try {
      const result=await setCurrentYear(supabase,yearChoice.id,yearChoice.previous);
      if(!result.ok)return toast(result.error,'error');
      setYearChoice(null);toast('Current academic year saved; assignments and history retained','success');await loadAll();
    }finally{setMasterBusy(false);}
  };

  const stats = [
    { label: "Total Users", value: `${users.length}`, sub: `${users.filter((u) => u.status === "Active").length} active`, icon: <IconUsers size={18} /> },
    { label: "Active Interns", value: `${users.filter((u) => u.role === "intern" && u.status === "Active").length}`, sub: "Live count", icon: <IconGradCap size={18} /> },
    { label: "Companies", value: `${companies.length}`, sub: "In directory", icon: <IconBuilding size={18} /> },
    { label: "System Uptime", value: "Unavailable", sub: "Monitoring not connected", icon: <IconCheck size={18} /> },
  ];
  const currentYears = years.filter(y=>y.is_current && !y.archived_at);
  const yearLabel = loadErrors.years ? "Academic year unavailable" : currentYears.length===1 ? currentYears[0].label : currentYears.length ? "Current academic year ambiguous — operator review required" : "Academic year setup required";

  return (
    <>
      <Shell userName={profile.full_name} userEmail={profile.email} userRole="Administrator"
        navItems={navItems} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
        <div className="dashboard-page space-y-6">
          <PageHeader eyebrow="Admin workspace" title={tab === "overview" ? `Hi, ${profile.full_name.split(" ")[0]}!` : navItems.find(n => n.id === tab)?.label}
            description={<>{pageDescriptions[tab]}<span className="block mt-1">{yearLabel}</span></>} date
            actions={<button className="action-secondary" disabled={loading||masterBusy||accountBusy||requirementBusy||Boolean(savingInternId)||Boolean(attachingDocsId)} onClick={loadAll}>Refresh data</button>} />

          {loading && <LoadingState />}
          {!loading && Object.entries(loadErrors).filter(([,error])=>error).map(([key,error])=><ErrorNotice key={key} title={`${key} unavailable`} onRetry={loadAll}>{error}</ErrorNotice>)}

          {/* ── OVERVIEW ── */}
          {!loading && tab === "overview" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s) => (
                  <MetricCard key={s.label} {...s} value={(loadErrors.accounts && ["Total Users","Active Interns"].includes(s.label)) || (loadErrors.companies && s.label==="Companies") ? "Unavailable" : s.value}
                    sub={(loadErrors.accounts && ["Total Users","Active Interns"].includes(s.label)) || (loadErrors.companies && s.label==="Companies") ? "Retry the unavailable section above" : s.sub} />
                ))}
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="text-sm font-semibold">Recent Accounts</span>
                    <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => setTab("accounts")}>View all →</button>
                  </div>
                  {!loadErrors.accounts && users.length === 0 && <EmptyState title="No accounts yet" />}
                  {users.slice(0, 5).map((u) => (
                    <div key={u.id} className="px-4 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 text-white"
                        style={{ background: roleColors[roleLabel[u.role]] ?? "var(--primary)" }}>
                        {u.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.full_name}</div>
                        <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{u.email}</div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${roleColors[roleLabel[u.role]]}20`, color: roleColors[roleLabel[u.role]] }}>{roleLabel[u.role] ?? u.role}</span>
                    </div>
                  ))}
                </div>
                <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="text-sm font-semibold">Audit Log — Recent</span>
                    <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => setTab("auditlogs")}>View all →</button>
                  </div>
                  {!loadErrors.auditPreview && logs.length === 0 && <EmptyState title="No audit events yet" />}
                  {logs.slice(0, 5).map((l) => (
                    <div key={l.id} className="px-4 py-3 flex gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="font-mono text-xs shrink-0 mt-0.5 w-20" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(l.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}
                      </span>
                      <div>
                        <div className="text-xs font-medium">{l.source === "database-trigger-v2" ? "DB recorded" : "Legacy (provenance unverified)"} | {l.action}</div>
                        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{l.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── ACCOUNTS ── */}
          {!loading && tab === "accounts" && (
            <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <label className="min-w-0 flex-1 text-xs font-medium">Search accounts by name, role, email or student ID
                  <input type="search" placeholder="Search accounts…" value={search} onChange={(e) => {setSearch(e.target.value);setAccountPage(1);}} className="form-control" />
                </label>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  New accounts are created via Register — edit role/status below
                </span>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--muted)" }}>
                    {["Name", "Role", "Email", "Status", "Joined", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accountsPage.rows.map((u) => (
                    <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 font-medium">{u.full_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${roleColors[roleLabel[u.role]] ?? "#888"}20`, color: roleColors[roleLabel[u.role]] ?? "#888" }}>{roleLabel[u.role] ?? u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{u.email}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => openEdit(u)}>Edit</button>
                          <button className="text-xs" style={{ color: u.status === "Active" ? "var(--danger)" : "var(--success)" }}
                            disabled={accountBusy} onClick={() => deactivate(u)}>
                            {u.status === "Active" ? "Deactivate" : u.status === "Pending" ? "Activate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="px-4">
                {!loadErrors.accounts && !filtered.length && <p className="py-3 text-sm">No accounts match this search.</p>}
                <label htmlFor="account-size" className="text-sm">Accounts per page<select id="account-size" value={accountSize} onChange={e=>{setAccountSize(Number(e.target.value));setAccountPage(1);}} className="form-control">{[10,25,50,100].map(n=><option key={n}>{n}</option>)}</select></label>
                {!loadErrors.accounts && <Pagination result={accountsPage} onPage={setAccountPage} label="accounts" />}
              </div>
            </div>
          )}

          {/* ── INTERNS ── */}
          {!loading && tab === "interns" && <SupervisorAssignments users={users} interns={internRows} companies={companies} onChanged={refreshAudit} />}
          {!loading && tab === "interns" && <section className="surface-card company-attendance"><LogbookAttendance admin/><ManualAttendanceHistory rows={metricAttendance} interns={users}/></section>}
          {!loading && tab === "interns" && (
            <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm font-semibold">Intern Assignments</span>
                <label htmlFor="assignment-search" className="block text-sm mt-3">Search name, email, company or section<input id="assignment-search" type="search" value={assignmentSearch} onChange={e=>{setAssignmentSearch(e.target.value);setAssignmentPage(1);}} className="form-control" /></label>
                {!loadErrors.accounts && !loadErrors.assignments && <Pagination result={assignmentsPage} onPage={setAssignmentPage} label="intern assignments" />}
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  Assign each intern to an instructor and company, set their required hours, and attach the standard document checklist.
                </p>
              </div>
              {metricsError && <p role="alert" className="px-4 py-2 text-xs">Progress unavailable: {metricsError}</p>}
              {!loadErrors.accounts && !loadErrors.assignments && internsForTab.length === 0 && (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                  No intern accounts yet — they'll appear here once someone registers with the Intern role.
                </div>
              )}
              {!loadErrors.accounts && !loadErrors.assignments && internsForTab.length>0 && assignmentsPage.total===0 && <p className="p-4 text-sm">No intern assignments match this search.</p>}
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {assignmentsPage.rows.map((intern) => {
                  const form = internForms[intern.id] ?? { instructor_id: "", company_id: "", section_id: "", required_hours: intern.required_hours ?? "" };
                  const checklist = docCounts[intern.id] ?? checklistState(null);
                  const metric = internMetrics({ internId: intern.id, required: intern.required_hours,
                    attendance: metricAttendance?.filter(a => a.intern_id === intern.id), documents: metricDocuments?.filter(d => d.intern_id === intern.id) });
                  return (
                    <div key={intern.id} className="px-4 py-4" style={{ borderTop: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <div>
                          <div className="text-sm font-medium">{intern.full_name}</div>
                          <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{intern.email}</div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: intern.status === "Active" ? "var(--success-bg)" : "var(--warning-bg)", color: intern.status === "Active" ? "var(--success)" : "var(--warning)" }}>
                          {intern.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Field label="Instructor">
                          <select disabled={savingInternId===intern.id} value={form.instructor_id} onChange={(e) => updateInternForm(intern.id, "instructor_id", e.target.value)}
                            className={inputCls} style={inputStyle}>
                            <option value="">— Unassigned —</option>
                            {instructorOptions.map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
                          </select>
                        </Field>
                        <Field label="Company">
                          <select disabled={savingInternId===intern.id} value={form.company_id} onChange={(e) => updateInternForm(intern.id, "company_id", e.target.value)}
                            className={inputCls} style={inputStyle}>
                            <option value="">— None —</option>
                            {companies.filter(c=>!c.archived_at || c.id===intern.company_id).map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived_at ? " (Archived; existing assignment)" : ""}</option>)}
                          </select>
                        </Field>
                        <Field label="Required Hours">
                          <input disabled={savingInternId===intern.id} type="number" min="0.01" max="10000" step="0.01" value={form.required_hours}
                            onChange={(e) => updateInternForm(intern.id, "required_hours", e.target.value)}
                            className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Section">
                          <select value={form.section_id} disabled={savingInternId===intern.id} onChange={e=>updateInternForm(intern.id,"section_id",e.target.value)} className={inputCls} style={inputStyle}>
                            <option value="">— Unassigned section —</option>{sections.filter(s=>!s.archived_at || s.id===intern.section_id).map(s=><option key={s.id} value={s.id}>{s.name}{s.archived_at ? " (Archived; existing assignment)" : ""}</option>)}
                          </select>
                        </Field>
                      </div>
                      <p className="text-xs mt-2">Logged: {displayHours(metric.logged)} hrs | Verified: {displayHours(metric.verified)} hrs | {metric.risk} | Clearance: {metric.cleared === null ? "Unknown" : metric.cleared ? "Eligible" : "Incomplete"}</p>
                      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                        <button type="button" onClick={() => setRequirementIntern(intern)} className="action-secondary">Manage requirements</button>
                        <button onClick={() => attachStandardDocs(intern.id)} disabled={checklist.complete || !checklist.known || attachingDocsId === intern.id}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{ background: checklist.complete ? "var(--success-bg)" : "var(--secondary)", color: checklist.complete ? "var(--success)" : "var(--primary)" }}>
                          {attachingDocsId === intern.id ? "Attaching..." : checklist.complete ? "Standard checklist complete (4/4)" : checklist.known ? `Attach missing standard requirements (${checklist.present}/4 present)` : "Checklist unavailable"}
                        </button>
                        <button onClick={() => saveInternAssignment(intern.id)} disabled={savingInternId === intern.id}
                          className="text-xs px-4 py-1.5 rounded-lg font-semibold disabled:opacity-60"
                          style={{ background: "var(--primary)", color: "#fff" }}>
                          {savingInternId === intern.id ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── MASTER DATA ── */}
          {!loading && tab === "masterdata" && (
            <div className="space-y-4">
              <label htmlFor="master-search" className="block text-sm">Search master data<input id="master-search" type="search" value={masterSearch} onChange={e=>setMasterSearch(e.target.value)} className="form-control" /></label>
              <p className="text-sm muted-copy">Archive removes entries from new assignment choices and keeps existing links and history. Academic years are master data; no historical year-to-intern relationship exists. Current-year switching remains an operator-managed policy.</p>
            <div className="grid lg:grid-cols-2 gap-4">
              {masterSections.map((section) => (
                <div key={section.key} className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="text-sm font-semibold">{section.title}</span>
                    <button onClick={() => openMasterAdd(section.table)} className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: "var(--secondary)", color: "var(--primary)" }}>+ Add</button>
                  </div>
                  {section.rows.filter(row=>String(row[section.field]).toLowerCase().includes(masterSearch.trim().toLowerCase())).map((row) => (
                    <div key={row.id} className="px-4 py-2.5 flex flex-wrap gap-2 items-center justify-between text-sm" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="break-words">{row[section.field]}{section.table === "academic_years" && row.is_current ? " (Current)" : ""}{row.archived_at ? " (Archived)" : ""}</span>
                      <div className="flex flex-wrap gap-3">
                        {section.table==='academic_years'&&!row.is_current&&<button disabled={masterBusy||Boolean(row.archived_at)||Boolean(loadErrors.years)||years.filter(y=>y.is_current).length>1}
                          className="text-xs" aria-label={`Set ${row.label} as current year`} onClick={()=>setYearChoice({...row,previous:years.find(y=>y.is_current)?.id||null})}>Set current year</button>}
                        <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => openMasterEdit(section.table, row, section.field)}>Edit</button>
                        <button disabled={masterBusy || Boolean(row.archived_at)} className="text-xs" style={{ color: "var(--danger)" }} onClick={() => removeMaster(section.table, row)}>Inspect archive impact</button>
                      </div>
                    </div>
                  ))}
                  {!loadErrors[({companies:"companies",course_sections:"sections",academic_years:"years"})[section.table]] && section.rows.filter(row=>String(row[section.field]).toLowerCase().includes(masterSearch.trim().toLowerCase())).length === 0 && (
                    <div className="px-4 py-4 text-xs text-center" style={{ color: "var(--muted-foreground)" }}>No matching entries</div>
                  )}
                </div>
              ))}
            </div>
            </div>
          )}

          {/* ── IMPORT ── */}
          {!loading && tab === "import" && (
            <div className="space-y-4">
              <div className="ui-card rounded-xl p-8 text-center" style={{ background: "var(--card)", border: "2px dashed var(--border)" }}>
                <div className="flex justify-center mb-3" style={{ color: "var(--muted-foreground)" }}>
                  <IconUpload size={36} strokeWidth={1.2} />
                </div>
                <h3 className="text-sm font-semibold mb-1">Bulk import unavailable</h3>
                <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>File upload, drag and drop, validation and account creation are not implemented. Register accounts individually, then approve them through an administrator.</p>
                <button disabled className="text-sm px-4 py-2 rounded-lg" style={{ background: "var(--secondary)" }}>Import unavailable</button>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                {[{ kind: "student", title: "Student planning template" }, { kind: "instructor", title: "Instructor planning template" }].map((t) => (
                  <div key={t.kind} className="ui-card rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div>
                      <div className="text-sm font-medium">{t.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Blank headers only. Import is unavailable.</div>
                    </div>
                    <div className="flex gap-2">{["csv", "xlsx"].map((format) => <button key={format} disabled={exportBusy}
                      className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: "var(--secondary)", color: "var(--primary)" }}
                      onClick={() => requestExport(() => templateArtifact(t.kind, format))}>Download {format.toUpperCase()}</button>)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AUDIT LOGS ── */}
          {!loading && tab === "auditlogs" && (
            <div className="ui-card rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm font-semibold">System Activity Log</span>
                <button disabled={exportBusy} className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: "var(--secondary)", color: "var(--primary)" }}
                  onClick={() => requestExport(() => auditArtifact(supabase))}>{exportBusy ? "Preparing CSV…" : "Export all audit CSV"}</button>
              </div>
              <AuditHistory refreshKey={auditRefresh} />
            </div>
          )}

          {/* ── BACKUP ── */}
          {!loading && tab === "backup" && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="ui-card rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-4">Database Backup</h3>
                <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
                  Backup status is not connected. An authorized operator must verify
                  backup availability, retention and restore capability in the
                  Supabase dashboard. This application does not create snapshots.
                </p>
                <button disabled
                  className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-opacity"
                  style={{ background: "var(--primary)", color: "#fff" }}>
                  Manual backup unavailable
                </button>
              </div>
              <div className="ui-card rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-4">Role Permissions</h3>
                <div className="space-y-2">
                  {[
                    { role: "System Admin", perms: ["Full access", "User management", "Audit logs"] },
                    { role: "Instructor", perms: ["Assigned evaluations", "Assigned report exports", "Assigned attendance", "Manage assigned alerts"] },
                    { role: "Supervisor", perms: ["Explicit assigned Interns", "Own evaluation drafts", "Submit to Coordinator"] },
                    { role: "Intern", perms: ["Log attendance", "View evaluations", "View progress"] },
                  ].map((r) => (
                    <div key={r.role} className="p-3 rounded-lg" style={{ background: "var(--muted)" }}>
                      <div className="text-xs font-semibold mb-2">{r.role}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.perms.map((p) => (
                          <span key={p} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{p}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Shell>

      {/* ── EDIT USER MODAL ── */}
      {yearChoice&&<Modal title="Set current academic year" busy={masterBusy} onClose={()=>setYearChoice(null)}>
        <p className="text-sm mb-4">Set {yearChoice.label} as the current year? This changes the displayed year marker. Existing assignments and historical records remain linked as saved.</p>
        <button disabled={masterBusy} className="action-primary" onClick={confirmCurrentYear}>{masterBusy?'Saving…':'Confirm current year'}</button>
        <button disabled={masterBusy} className="action-secondary ml-2" onClick={()=>{setYearChoice(null);loadAll();}}>Refresh year list</button>
      </Modal>}
      {userModal.open && (
        <Modal title="Edit User" busy={accountBusy} onClose={() => setUserModal({ open: false, editing: null })}>
          <div className="space-y-4">
            <Field label="Full Name">
              <input disabled={accountBusy} value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Maria Santos" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Role">
              <select disabled={accountBusy} value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                className={inputCls} style={inputStyle}>
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            {["Intern", "Supervisor"].includes(userForm.role) && (
              <Field label="Company">
                <select disabled={accountBusy} value={userForm.companyId} onChange={(e) => setUserForm((f) => ({ ...f, companyId: e.target.value }))}
                  className={inputCls} style={inputStyle}>
                  <option value="">— None —</option>
                  {companies.filter(c=>!c.archived_at || c.id===internRows.find(r=>r.id===userModal.editing?.id)?.company_id).map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived_at ? " (Archived)" : ""}</option>)}
                </select>
              </Field>
            )}
            <Field label="Status">
              <select disabled={accountBusy} value={userForm.status} onChange={(e) => setUserForm((f) => ({ ...f, status: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option>Active</option>
                <option>Inactive</option>
                <option>Pending</option>
              </select>
            </Field>
            <div className="flex gap-2 pt-1">
              <button onClick={saveUser} disabled={accountBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "var(--primary)", color: "#fff" }}>
                Save Changes
              </button>
              <button disabled={accountBusy} onClick={() => setUserModal({ open: false, editing: null })}
                className="px-4 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--secondary)", color: "var(--foreground)" }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {requirementIntern && <Modal title={`Requirements — ${requirementIntern.full_name}`} busy={requirementBusy} onClose={() => setRequirementIntern(null)}>
        <RequirementManager internId={requirementIntern.id} onChanged={loadAll} onBusyChange={setRequirementBusy} />
      </Modal>}
      {/* ── MASTER DATA MODAL ── */}
      {archiveModal && <Modal title="Archive master entry" busy={masterBusy} onClose={()=>setArchiveModal(null)}>
        <div className="space-y-3">
          <p className="text-sm">Entry: <strong>{archiveModal.row.name || archiveModal.row.label}</strong></p>
          <p className="text-sm">{archiveModal.references} intern assignment references (including retained historical extensions). These links, records and audit history will be preserved. The entry will be excluded from new assignment choices.</p>
          {!archiveModal.can_archive ? <p role="alert">This entry is already archived or is the current academic year. Configure a replacement current year through the existing operator policy before archiving.</p> : <>
            <label htmlFor="archive-confirmation" className="block text-sm">Type ARCHIVE to confirm<input id="archive-confirmation" value={archiveConfirmation} disabled={masterBusy} onChange={e=>setArchiveConfirmation(e.target.value)} className="form-control" /></label>
            <button disabled={masterBusy || archiveConfirmation!=="ARCHIVE"} onClick={confirmArchive} className="action-primary">Confirm archive</button>
          </>}
        </div>
      </Modal>}
      {masterModal && (
        <Modal
          title={masterModal.editId ? "Edit Entry" : "Add Entry"}
          onClose={() => setMasterModal(null)}
          width="380px"
          busy={masterBusy}
        >
          <div className="space-y-4">
            <Field label="Value">
              <input disabled={masterBusy} value={masterModal.value} onChange={(e) => setMasterModal((m) => ({ ...m, value: e.target.value }))}
                placeholder="Enter value…" className={inputCls} style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && saveMaster()} autoFocus />
            </Field>
            <div className="flex gap-2">
              <button disabled={masterBusy} onClick={saveMaster} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "var(--primary)", color: "#fff" }}>
                {masterModal.editId ? "Save" : "Add"}
              </button>
              <button disabled={masterBusy} onClick={() => setMasterModal(null)}
                className="px-4 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--secondary)", color: "var(--foreground)" }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { auditArtifact, downloadArtifact, templateArtifact } from "../lib/exports";
import { recordRpc } from "../lib/authority";
import { checklistState } from "../lib/business";
import { displayHours, internMetrics } from "../lib/metrics";
import { completeRows, saveAssignment } from "../lib/workflows";
import Shell from "./Shell";
import Modal from "./Modal";
import { useToast } from "./Toast";
import {
  IconGrid, IconUsers, IconFolder, IconUpload, IconClipboard, IconShield,
  IconGradCap, IconBuilding, IconCheck, IconAlertTriangle, IconTrendingUp, IconBarChart,
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

const roleLabel = { admin: "Admin", instructor: "Instructor", intern: "Intern" };
const roleColors = { Intern: "#d97706", Instructor: "#7c3aed", Admin: "#1a2f5e" };
const roles = ["Intern", "Instructor", "Admin"];

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>{label}</label>
      {children}
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
    setLoading(true);
    const [
      { data: profiles, error: profilesError },
      { data: auditRows, error: auditError },
      { data: companyRows },
      { data: sectionRows },
      { data: yearRows },
      { data: internTableRows, error: internsError },
      { data: docRows, error: docError },
      { data: attendanceRows, error: attendanceError },
    ] = await Promise.all([
      completeRows(supabase, "profiles").then(data => ({ data })).catch(error => ({ data: null, error })),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("companies").select("*").order("name"),
      supabase.from("course_sections").select("*").order("name"),
      supabase.from("academic_years").select("*").order("label", { ascending: false }),
      completeRows(supabase, "interns").then(data => ({ data })).catch(error => ({ data: null, error })),
      completeRows(supabase, "documents").then(data => ({ data })).catch(error => ({ data: null, error })),
      completeRows(supabase, "attendance_logs").then(data => ({ data })).catch(error => ({ data: null, error })),
    ]);
    setUsers(profiles ?? []);
    if (auditError) toast(`Unable to load audit history: ${auditError.message}`, "error");
    setLogs(auditRows ?? []);
    setCompanies(companyRows ?? []);
    setSections(sectionRows ?? []);
    setYears(yearRows ?? []);
    setInternRows(internTableRows ?? []);
    setInternForms(
      Object.fromEntries(
        (internTableRows ?? []).map((r) => [
          r.id,
          { instructor_id: r.instructor_id ?? "", company_id: r.company_id ?? "", section_id: r.section_id ?? "", required_hours: r.required_hours ?? "" },
        ])
      )
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

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
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const updateInternForm = (internId, field, value) =>
    setInternForms((prev) => ({ ...prev, [internId]: { ...prev[internId], [field]: value } }));

  const applyIntern = (row) => {
    if (!row) return;
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
    try {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
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
      companyId: existingInternRow?.company_id ?? "",
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
      if (patch.role === "intern") patch.company_id = userForm.companyId || null;
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
    if (!masterModal || !masterModal.value.trim()) {
      toast("Value cannot be empty", "error");
      return;
    }
    const { table, editId, value } = masterModal;
    const field = table === "academic_years" ? "label" : "name";
    if (editId) {
      const { error } = await supabase.from(table).update({ [field]: value.trim() }).eq("id", editId);
      if (error) return toast(error.message, "error");
      setRowsFor(table, (prev) => prev.map((r) => (r.id === editId ? { ...r, [field]: value.trim() } : r)));
      toast("Entry updated");
    } else {
      const { data, error } = await supabase.from(table).insert({ [field]: value.trim() }).select().single();
      if (error) return toast(error.message, "error");
      setRowsFor(table, (prev) => [...prev, data]);
      toast("Entry added");
    }
    setMasterModal(null);
    await refreshAudit();
  };
  const removeMaster = async (table, row) => {
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) return toast(error.message, "error");
    setRowsFor(table, (prev) => prev.filter((r) => r.id !== row.id));
    toast("Entry removed");
    await refreshAudit();
  };


  const stats = [
    { label: "Total Users", value: `${users.length}`, sub: `${users.filter((u) => u.status === "Active").length} active`, icon: <IconUsers size={18} />, iconBg: "#eff6ff", iconColor: "#2563eb" },
    { label: "Active Interns", value: `${users.filter((u) => u.role === "intern" && u.status === "Active").length}`, sub: "Live count", icon: <IconGradCap size={18} />, iconBg: "#f0fdf4", iconColor: "#16a34a" },
    { label: "Companies", value: `${companies.length}`, sub: "In directory", icon: <IconBuilding size={18} />, iconBg: "#fefce8", iconColor: "#d97706" },
    { label: "System Uptime", value: "Unavailable", sub: "Monitoring not connected", icon: <IconCheck size={18} />, iconBg: "#f0fdf4", iconColor: "#16a34a" },
  ];

  return (
    <>
      <Shell userName={profile.full_name} userEmail={profile.email} userRole="Administrator"
        navItems={navItems} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
        <div className="p-6 max-w-6xl mx-auto space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">{tab === "overview" ? `Hi, ${profile.full_name.split(" ")[0]}!` : navItems.find((n) => n.id === tab)?.label}</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {years.find((y) => y.is_current)?.label ?? "Academic Year"}
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
              {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}
            </span>
          </div>

          {loading && <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading…</div>}

          {/* ── OVERVIEW ── */}
          {!loading && tab === "overview" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: s.iconBg, color: s.iconColor }}>{s.icon}</div>
                    <div className="text-2xl font-bold mb-0.5">{s.value}</div>
                    <div className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--primary)" }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="text-sm font-semibold">Recent Accounts</span>
                    <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => setTab("accounts")}>View all →</button>
                  </div>
                  {users.slice(0, 5).map((u) => (
                    <div key={u.id} className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
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
                <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="text-sm font-semibold">Audit Log — Recent</span>
                    <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => setTab("auditlogs")}>View all →</button>
                  </div>
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
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 text-sm px-3 py-1.5 rounded-lg border outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--muted)", color: "var(--foreground)" }} />
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
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
                  {filtered.map((u) => (
                    <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 font-medium">{u.full_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${roleColors[roleLabel[u.role]] ?? "#888"}20`, color: roleColors[roleLabel[u.role]] ?? "#888" }}>{roleLabel[u.role] ?? u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: u.status === "Active" ? "var(--success-bg)" : "var(--danger-bg)", color: u.status === "Active" ? "var(--success)" : "var(--danger)" }}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => openEdit(u)}>Edit</button>
                          <button className="text-xs" style={{ color: u.status === "Active" ? "var(--danger)" : "var(--success)" }}
                            disabled={accountBusy} onClick={() => deactivate(u)}>
                            {u.status === "Active" ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* ── INTERNS ── */}
          {!loading && tab === "interns" && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm font-semibold">Intern Assignments</span>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  Assign each intern to an instructor and company, set their required hours, and attach the standard document checklist.
                </p>
              </div>
              {metricsError && <p role="alert" className="px-4 py-2 text-xs">Progress unavailable: {metricsError}</p>}
              {internsForTab.length === 0 && (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                  No intern accounts yet — they'll appear here once someone registers with the Intern role.
                </div>
              )}
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {internsForTab.map((intern) => {
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
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label="Instructor">
                          <select value={form.instructor_id} onChange={(e) => updateInternForm(intern.id, "instructor_id", e.target.value)}
                            className={inputCls} style={inputStyle}>
                            <option value="">— Unassigned —</option>
                            {instructorOptions.map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
                          </select>
                        </Field>
                        <Field label="Company">
                          <select value={form.company_id} onChange={(e) => updateInternForm(intern.id, "company_id", e.target.value)}
                            className={inputCls} style={inputStyle}>
                            <option value="">— None —</option>
                            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </Field>
                        <Field label="Required Hours">
                          <input type="number" min="0.01" max="10000" step="0.01" value={form.required_hours}
                            onChange={(e) => updateInternForm(intern.id, "required_hours", e.target.value)}
                            className={inputCls} style={inputStyle} />
                        </Field>
                      </div>
                      <p className="text-xs mt-2">Logged: {displayHours(metric.logged)} hrs | Verified: {displayHours(metric.verified)} hrs | {metric.risk} | Clearance: {metric.cleared === null ? "Unknown" : metric.cleared ? "Eligible" : "Incomplete"}</p>
                      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
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
            <div className="grid lg:grid-cols-2 gap-4">
              {masterSections.map((section) => (
                <div key={section.key} className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="text-sm font-semibold">{section.title}</span>
                    <button onClick={() => openMasterAdd(section.table)} className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: "var(--secondary)", color: "var(--primary)" }}>+ Add</button>
                  </div>
                  {section.rows.map((row) => (
                    <div key={row.id} className="px-4 py-2.5 flex items-center justify-between text-sm" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span>{row[section.field]}{section.table === "academic_years" && row.is_current ? " (Current)" : ""}</span>
                      <div className="flex gap-3">
                        <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => openMasterEdit(section.table, row, section.field)}>Edit</button>
                        <button className="text-xs" style={{ color: "var(--danger)" }} onClick={() => removeMaster(section.table, row)}>Remove</button>
                      </div>
                    </div>
                  ))}
                  {section.rows.length === 0 && (
                    <div className="px-4 py-4 text-xs text-center" style={{ color: "var(--muted-foreground)" }}>No entries yet</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── IMPORT ── */}
          {!loading && tab === "import" && (
            <div className="space-y-4">
              <div className="rounded-xl p-8 text-center" style={{ background: "var(--card)", border: "2px dashed var(--border)" }}>
                <div className="flex justify-center mb-3" style={{ color: "var(--muted-foreground)" }}>
                  <IconUpload size={36} strokeWidth={1.2} />
                </div>
                <h3 className="text-sm font-semibold mb-1">Bulk import unavailable</h3>
                <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>File upload, drag and drop, validation and account creation are not implemented. Register accounts individually, then approve them through an administrator.</p>
                <button disabled className="text-sm px-4 py-2 rounded-lg" style={{ background: "var(--secondary)" }}>Import unavailable</button>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                {[{ kind: "student", title: "Student planning template" }, { kind: "instructor", title: "Instructor planning template" }].map((t) => (
                  <div key={t.kind} className="rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
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
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm font-semibold">System Activity Log</span>
                <button disabled={exportBusy} className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: "var(--secondary)", color: "var(--primary)" }}
                  onClick={() => requestExport(() => auditArtifact(supabase))}>{exportBusy ? "Preparing CSV…" : "Export audit CSV"}</button>
              </div>
              <p className="px-4 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>Export fetches all authorized records, up to 50,000; the displayed list shows only the latest 50. Concurrent changes may require retry.</p>
              {logs.map((l) => (
                <div key={l.id} className="px-4 py-3 flex gap-4 items-start" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="font-mono text-xs shrink-0 mt-0.5 w-20" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(l.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}
                  </span>
                  <div className="w-36 shrink-0 text-xs font-medium truncate">{l.actor_name}</div>
                  <div className="flex-1">
                    <div className="text-sm">{l.source === "database-trigger-v2" ? "DB recorded" : "Legacy (provenance unverified)"} | {l.action}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{l.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── BACKUP ── */}
          {!loading && tab === "backup" && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
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
              <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-4">Role Permissions</h3>
                <div className="space-y-2">
                  {[
                    { role: "System Admin", perms: ["Full access", "User management", "Audit logs"] },
                    { role: "Instructor", perms: ["Assigned evaluations", "Reports unavailable", "Assigned attendance", "Manage assigned alerts"] },
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
      {userModal.open && (
        <Modal title="Edit User" onClose={() => setUserModal({ open: false, editing: null })}>
          <div className="space-y-4">
            <Field label="Full Name">
              <input value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Maria Santos" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Role">
              <select value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                className={inputCls} style={inputStyle}>
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            {userForm.role === "Intern" && (
              <Field label="Company">
                <select value={userForm.companyId} onChange={(e) => setUserForm((f) => ({ ...f, companyId: e.target.value }))}
                  className={inputCls} style={inputStyle}>
                  <option value="">— None —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Status">
              <select value={userForm.status} onChange={(e) => setUserForm((f) => ({ ...f, status: e.target.value }))}
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
              <button onClick={() => setUserModal({ open: false, editing: null })}
                className="px-4 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--secondary)", color: "var(--foreground)" }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MASTER DATA MODAL ── */}
      {masterModal && (
        <Modal
          title={masterModal.editId ? "Edit Entry" : "Add Entry"}
          onClose={() => setMasterModal(null)}
          width="380px"
        >
          <div className="space-y-4">
            <Field label="Value">
              <input value={masterModal.value} onChange={(e) => setMasterModal((m) => ({ ...m, value: e.target.value }))}
                placeholder="Enter value…" className={inputCls} style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && saveMaster()} autoFocus />
            </Field>
            <div className="flex gap-2">
              <button onClick={saveMaster} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "var(--primary)", color: "#fff" }}>
                {masterModal.editId ? "Save" : "Add"}
              </button>
              <button onClick={() => setMasterModal(null)}
                className="px-4 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--secondary)", color: "var(--foreground)" }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

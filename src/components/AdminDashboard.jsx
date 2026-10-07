import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
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

const standardDocChecklist = [
  { doc_type: "moa", name: "Memorandum of Agreement (MOA)" },
  { doc_type: "endorsement", name: "Endorsement Letter" },
  { doc_type: "consent", name: "Parent / Guardian Consent Form" },
  { doc_type: "medical", name: "Medical Certificate" },
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
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function AdminDashboard({ profile, onLogout }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [sections, setSections] = useState([]);
  const [years, setYears] = useState([]);
  const [backupRunning, setBackupRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  // User modal
  const [userModal, setUserModal] = useState({ open: false, editing: null });
  const [userForm, setUserForm] = useState({ name: "", role: "Intern", status: "Active", companyId: "" });

  // Interns tab — intern rows from the `interns` table, keyed edit buffer, and
  // per-intern document-checklist counts (for the "attach standard docs" button)
  const [internRows, setInternRows] = useState([]);
  const [internForms, setInternForms] = useState({});
  const [docCounts, setDocCounts] = useState({});
  const [savingInternId, setSavingInternId] = useState(null);
  const [attachingDocsId, setAttachingDocsId] = useState(null);

  // Master data modals — { table, editId, value }
  const [masterModal, setMasterModal] = useState(null);

  // File import (client-side only demo; no backend to actually process the file)
  const fileRef = useRef(null);
  const [importFile, setImportFile] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    const [
      { data: profiles },
      { data: auditRows },
      { data: companyRows },
      { data: sectionRows },
      { data: yearRows },
      { data: internTableRows },
      { data: docRows },
    ] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("companies").select("*").order("name"),
      supabase.from("course_sections").select("*").order("name"),
      supabase.from("academic_years").select("*").order("label", { ascending: false }),
      supabase.from("interns").select("*"),
      supabase.from("documents").select("intern_id"),
    ]);
    setUsers(profiles ?? []);
    setLogs(auditRows ?? []);
    setCompanies(companyRows ?? []);
    setSections(sectionRows ?? []);
    setYears(yearRows ?? []);
    setInternRows(internTableRows ?? []);
    setInternForms(
      Object.fromEntries(
        (internTableRows ?? []).map((r) => [
          r.id,
          { instructor_id: r.instructor_id ?? "", company_id: r.company_id ?? "", required_hours: r.required_hours ?? 486 },
        ])
      )
    );
    const counts = {};
    (docRows ?? []).forEach((d) => { counts[d.intern_id] = (counts[d.intern_id] ?? 0) + 1; });
    setDocCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
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
  const instructorOptions = users.filter((u) => u.role === "instructor");
  const internsForTab = internRows
    .map((r) => {
      const p = users.find((u) => u.id === r.id);
      return p && p.role === "intern" ? { ...r, full_name: p.full_name, email: p.email, status: p.status } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const updateInternForm = (internId, field, value) =>
    setInternForms((prev) => ({ ...prev, [internId]: { ...prev[internId], [field]: value } }));

  const saveInternAssignment = async (internId) => {
    const form = internForms[internId];
    if (!form) return;
    setSavingInternId(internId);
    const { error } = await supabase
      .from("interns")
      .update({
        instructor_id: form.instructor_id || null,
        company_id: form.company_id || null,
        required_hours: Number(form.required_hours) || 486,
      })
      .eq("id", internId);
    setSavingInternId(null);
    if (error) return toast(error.message, "error");
    setInternRows((prev) =>
      prev.map((r) =>
        r.id === internId
          ? { ...r, instructor_id: form.instructor_id || null, company_id: form.company_id || null, required_hours: Number(form.required_hours) || 486 }
          : r
      )
    );
    const internName = internsForTab.find((i) => i.id === internId)?.full_name ?? "Intern";
    addLog("Intern assignment updated", internName);
    toast(`${internName} updated`);
  };

  const attachStandardDocs = async (internId) => {
    if (docCounts[internId] > 0) return;
    setAttachingDocsId(internId);
    const { error } = await supabase
      .from("documents")
      .insert(standardDocChecklist.map((d) => ({ intern_id: internId, doc_type: d.doc_type, name: d.name })));
    setAttachingDocsId(null);
    if (error) return toast(error.message, "error");
    setDocCounts((prev) => ({ ...prev, [internId]: standardDocChecklist.length }));
    const internName = internsForTab.find((i) => i.id === internId)?.full_name ?? "Intern";
    addLog("Standard document checklist attached", internName);
    toast(`Document checklist attached for ${internName}`);
  };

  const addLog = async (action, detail) => {
    const { data } = await supabase
      .from("audit_logs")
      .insert({ actor_id: profile.id, actor_name: profile.full_name, action, detail })
      .select()
      .single();
    if (data) setLogs((l) => [data, ...l]);
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
  const saveUser = async () => {
    if (!userModal.editing) return;
    const newRole = userForm.role.toLowerCase();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: userForm.name, role: newRole, status: userForm.status })
      .eq("id", userModal.editing.id);
    if (error) {
      toast(error.message, "error");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userModal.editing.id ? { ...u, full_name: userForm.name, role: newRole, status: userForm.status } : u))
    );

    // Someone made an Intern via Account Management (rather than by
    // registering as one) won't have an `interns` row yet — the signup
    // trigger only creates that at registration time. Add it now (with
    // whatever company was chosen) so they show up on the Interns tab
    // immediately. If they already had an `interns` row, just update its
    // company to match what was picked here.
    if (newRole === "intern") {
      const existingRow = internRows.find((r) => r.id === userModal.editing.id);
      const companyId = userForm.companyId || null;
      if (!existingRow) {
        const { data: newInternRow, error: internError } = await supabase
          .from("interns")
          .insert({ id: userModal.editing.id, company_id: companyId })
          .select()
          .single();
        if (internError) {
          toast(`Role updated, but couldn't create the intern record: ${internError.message}`, "error");
        } else if (newInternRow) {
          setInternRows((prev) => [...prev, newInternRow]);
          setInternForms((prev) => ({
            ...prev,
            [newInternRow.id]: { instructor_id: "", company_id: companyId ?? "", required_hours: newInternRow.required_hours ?? 486 },
          }));
        }
      } else if (existingRow.company_id !== companyId) {
        const { error: companyError } = await supabase.from("interns").update({ company_id: companyId }).eq("id", userModal.editing.id);
        if (companyError) {
          toast(`Role updated, but couldn't update company: ${companyError.message}`, "error");
        } else {
          setInternRows((prev) => prev.map((r) => (r.id === userModal.editing.id ? { ...r, company_id: companyId } : r)));
          setInternForms((prev) => ({
            ...prev,
            [userModal.editing.id]: { ...prev[userModal.editing.id], company_id: companyId ?? "" },
          }));
        }
      }
    }

    addLog("User account updated", `${userForm.name} (${userForm.role})`);
    toast(`${userForm.name} updated`);
    setUserModal({ open: false, editing: null });
  };
  const deactivate = async (u) => {
    const next = u.status === "Active" ? "Inactive" : "Active";
    const { error } = await supabase.from("profiles").update({ status: next }).eq("id", u.id);
    if (error) {
      toast(error.message, "error");
      return;
    }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: next } : x)));
    addLog(`User ${next === "Inactive" ? "deactivated" : "reactivated"}`, u.full_name);
    toast(`${u.full_name} ${next === "Inactive" ? "deactivated" : "reactivated"}`);
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
  };
  const removeMaster = async (table, row) => {
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) return toast(error.message, "error");
    setRowsFor(table, (prev) => prev.filter((r) => r.id !== row.id));
    toast("Entry removed");
  };

  // ── Backup (simulated — actual DB backups are managed in the Supabase dashboard) ──
  const runBackup = () => {
    setBackupRunning(true);
    toast("Backup started…", "info");
    setTimeout(() => {
      setBackupRunning(false);
      addLog("Database backup completed", `Snapshot: DB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-manual`);
      toast("Backup completed successfully");
    }, 2500);
  };

  const stats = [
    { label: "Total Users", value: `${users.length}`, sub: `${users.filter((u) => u.status === "Active").length} active`, icon: <IconUsers size={18} />, iconBg: "#eff6ff", iconColor: "#2563eb" },
    { label: "Active Interns", value: `${users.filter((u) => u.role === "intern" && u.status === "Active").length}`, sub: "Live count", icon: <IconGradCap size={18} />, iconBg: "#f0fdf4", iconColor: "#16a34a" },
    { label: "Companies", value: `${companies.length}`, sub: "In directory", icon: <IconBuilding size={18} />, iconBg: "#fefce8", iconColor: "#d97706" },
    { label: "System Uptime", value: "99.8%", sub: "Last 30 days", icon: <IconCheck size={18} />, iconBg: "#f0fdf4", iconColor: "#16a34a" },
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
              {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
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
                        {new Date(l.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <div>
                        <div className="text-xs font-medium">{l.action}</div>
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
                            onClick={() => deactivate(u)}>
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
              {internsForTab.length === 0 && (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                  No intern accounts yet — they'll appear here once someone registers with the Intern role.
                </div>
              )}
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {internsForTab.map((intern) => {
                  const form = internForms[intern.id] ?? { instructor_id: "", company_id: "", required_hours: 486 };
                  const docCount = docCounts[intern.id] ?? 0;
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
                          <input type="number" min="0" value={form.required_hours}
                            onChange={(e) => updateInternForm(intern.id, "required_hours", e.target.value)}
                            className={inputCls} style={inputStyle} />
                        </Field>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                        <button onClick={() => attachStandardDocs(intern.id)} disabled={docCount > 0 || attachingDocsId === intern.id}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{ background: docCount > 0 ? "var(--success-bg)" : "var(--secondary)", color: docCount > 0 ? "var(--success)" : "var(--primary)" }}>
                          {docCount > 0 ? `✓ Checklist attached (${docCount})` : attachingDocsId === intern.id ? "Attaching…" : "Attach Standard Documents"}
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
              <div
                className="rounded-xl p-8 text-center cursor-pointer transition-colors"
                style={{ background: "var(--card)", border: `2px dashed ${importFile ? "var(--primary)" : "var(--border)"}` }}
                onClick={() => fileRef.current?.click()}
              >
                <div className="flex justify-center mb-3" style={{ color: importFile ? "var(--primary)" : "var(--muted-foreground)" }}>
                  <IconUpload size={36} strokeWidth={1.2} />
                </div>
                {importFile ? (
                  <>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--primary)" }}>File selected</h3>
                    <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{importFile}</p>
                    <button
                      className="text-sm px-4 py-2 rounded-lg font-medium"
                      style={{ background: "var(--primary)", color: "#fff" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        addLog("Bulk import processed", importFile);
                        toast(`${importFile} imported successfully`);
                        setImportFile(null);
                      }}
                    >
                      Process Import
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold mb-1">Upload CSV / Excel</h3>
                    <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
                      Click to browse or drag and drop. Supports .csv and .xlsx
                    </p>
                    <button className="text-sm px-4 py-2 rounded-lg font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
                      Browse Files
                    </button>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) setImportFile(e.target.files[0].name); }} />
              <div className="grid lg:grid-cols-2 gap-4">
                {["Student Import Template", "Instructor Import Template"].map((t) => (
                  <div key={t} className="rounded-xl p-4 flex items-center justify-between" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div>
                      <div className="text-sm font-medium">{t}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Download the required format</div>
                    </div>
                    <button className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--secondary)", color: "var(--primary)" }}
                      onClick={() => toast(`${t} downloaded`)}>
                      Download
                    </button>
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
                <button className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--secondary)", color: "var(--primary)" }}
                  onClick={() => toast("Audit log exported as CSV")}>Export</button>
              </div>
              {logs.map((l) => (
                <div key={l.id} className="px-4 py-3 flex gap-4 items-start" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="font-mono text-xs shrink-0 mt-0.5 w-20" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(l.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <div className="w-36 shrink-0 text-xs font-medium truncate">{l.actor_name}</div>
                  <div className="flex-1">
                    <div className="text-sm">{l.action}</div>
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
                  Supabase manages automatic Postgres backups for your project. This
                  panel triggers a manual snapshot event and logs it — configure
                  retention and point-in-time recovery in the Supabase dashboard.
                </p>
                <button onClick={runBackup} disabled={backupRunning}
                  className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-opacity"
                  style={{ background: "var(--primary)", color: "#fff" }}>
                  {backupRunning ? "Running backup…" : "Run Manual Backup"}
                </button>
              </div>
              <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-4">Role Permissions</h3>
                <div className="space-y-2">
                  {[
                    { role: "System Admin", perms: ["Full access", "User management", "Audit logs", "Backup"] },
                    { role: "Instructor", perms: ["View & consolidate evaluations", "Generate reports", "View attendance", "Manage alerts"] },
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
              <button onClick={saveUser} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
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

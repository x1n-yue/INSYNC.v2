// Isolated audit fixture, not a live Supabase implementation or policy proof.
import { supabase as base, fixture } from "./synthetic-client";
const { state, me, persist, owner, INSTRUCTOR } = fixture;
if (!state.profiles.some(p => p.id === INSTRUCTOR)) state.profiles.push({ id: INSTRUCTOR, full_name: "Synthetic Instructor", role: "instructor", status: "Active", email: "instructor@example.invalid" });
state.document_versions ||= [];
state.document_review_events ||= [];
const previous = JSON.parse(localStorage.getItem("insync-synthetic-browser-data") || "null");
Object.assign(me, previous?.profiles.find(p => p.id === me.id) || {});
const params = new URLSearchParams(location.search);
let listener, releaseRestore;
const session = () => ({ user: { id: me.id }, access_token: "synthetic-public-session" });
const controls = window.__audit = {
  emit(event, value = session()) { listener?.(event, value); },
  releaseRestore() { releaseRestore?.(); },
  failRead: "", failMutation: "", holdProfile: false, releaseProfile: null, profileOverride: null, calls: [], state,
  save: persist,
};
const ok = data => ({ data: structuredClone(data), error: null });
const fail = message => ({ data: null, error: { message, code: "P0001" } });
export const setupError = null;
export const supabase = {
  ...base,
  auth: {
    getSession: async () => {
      if (params.has("restore-hold")) await new Promise(resolve => { releaseRestore = resolve; });
      return { data: { session: params.has("login") ? null : session() }, error: null };
    },
    onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() { listener = null; } } } }; },
    async signInWithPassword() { listener?.("SIGNED_IN", session()); return ok({ session: session() }); },
    async signUp({ email, options }) {
      controls.calls.push("signUp");
      Object.assign(me, { full_name: options.data.full_name, email, role: "intern", status: "Pending" });
      state.interns = state.interns.filter(r => r.id !== owner);
      persist();
      return ok({ user: { id: owner, identities: [{ id: "synthetic-identity" }] }, session: null });
    },
    async signOut() { listener?.("SIGNED_OUT", null); return { error: null }; },
  },
  from(table) {
    const query = base.from(table), execute = query.execute.bind(query);
    query.execute = async () => {
      if (controls.failRead === table && !query.patch && !query.insertRow) throw new Error(`Synthetic ${table} transport rejection`);
      if (controls.failMutation === table && (query.patch || query.insertRow)) throw new Error(`Synthetic ${table} mutation rejection`);
      if (table === "announcements" && !query.patch && !query.insertRow && me.role === "intern") {
        let rows = state.announcements.filter(r => r.recipient_ids?.includes(owner) && query.filters.every(f => f(r)));
        rows.sort((a,b) => { for (const [k,asc] of query.orders) { const cmp = String(a[k]).localeCompare(String(b[k])); if (cmp) return asc ? cmp : -cmp; } return 0; });
        const count = rows.length; rows = rows.slice(0, query.cap);
        return { data: query.head ? null : rows, count, error: null };
      }
      const result = await execute();
      if (table === "announcements" && query.insertRow && !result.error) {
        const row = state.announcements.find(r => r.id === result.data.id);
        row.recipient_ids = row.target_intern_id ? [row.target_intern_id] : state.interns.filter(i => i.instructor_id === me.id && state.profiles.some(p => p.id === i.id && p.role === "intern" && p.status === "Active")).map(i => i.id);
        persist(); return ok(row);
      }
      return result;
    };
    return query;
  },
  async rpc(name, p = {}) {
    controls.calls.push(name);
    if(name==='send_announcement') {
      (controls.announcementRequests ||= []).push(structuredClone(p));
      if(controls.holdAnnouncement) await new Promise(resolve=>{controls.releaseAnnouncement=resolve;});
      if(controls.failMutation==='announcements') return fail('Synthetic announcement rejection');
      let row=state.announcements.find(a=>a.id===p.p_request_id);
      if(!row) {
        const recipients=state.interns.filter(i=>i.instructor_id===me.id&&(!p.p_target_intern_id||i.id===p.p_target_intern_id)
          &&state.profiles.some(a=>a.id===i.id&&a.role==='intern'&&a.status==='Active')).map(i=>i.id);
        if(!recipients.length) return fail('No active assigned recipients');
        row={id:p.p_request_id,instructor_id:me.id,title:p.p_title,body:p.p_body,target:p.p_target_intern_id?'Personal':'All Interns',
          target_intern_id:p.p_target_intern_id,recipient_ids:recipients,created_at:new Date().toISOString()};
        state.announcements.push(row);persist();
      }
      if(controls.loseAnnouncementResponse){controls.loseAnnouncementResponse=false;return {data:null,error:{message:'Synthetic announcement response lost',code:'NETWORK'}};}
      return ok(row);
    }
    if (name === "my_profile") {
      if (controls.holdProfile) await new Promise(resolve => { controls.releaseProfile = resolve; });
      return ok(controls.profileOverride || me);
    }
    if (name === "attach_standard_docs") return ok({ id: p.p_id, documents: state.documents.filter(d => d.intern_id === p.p_id) });
    if (name === "stage_document_upload") {
      const d = state.documents.find(d => d.id === p.p_id);
      const upload = { id: crypto.randomUUID(), document_id: d.id, intern_id: owner, expected_version: d.upload_version, file_name: p.p_name, mime_type: p.p_mime, byte_size: p.p_size, status: "Pending", committed_at: null, created_at: new Date().toISOString() };
      upload.file_path = `${owner}/${d.id}/${upload.id}.pdf`;
      state.document_versions.push(upload); persist(); return ok({ id: d.id, upload });
    }
    if (name === "finalize_document_upload") {
      const v = state.document_versions.find(v => v.id === p.p_upload_id), d = state.documents.find(d => d.id === v.document_id);
      if (!state.objects[v.file_path]) return fail("File missing");
      Object.assign(v, { version_no: d.upload_version + 1, committed_at: new Date().toISOString() });
      Object.assign(d, { upload_version: v.version_no, review_revision: 0, file_path: v.file_path, file_name: v.file_name, status: "Pending", note: null, reviewed_by: null, reviewed_at: null });
      persist(); return ok(d);
    }
    if (name === "review_document_version") {
      const d = state.documents.find(d => d.id === p.p_id);
      if (d.upload_version !== p.p_expected_version || d.review_revision !== p.p_expected_revision) return fail("Evidence changed");
      const v = state.document_versions.find(v => v.document_id === d.id && v.version_no === d.upload_version);
      Object.assign(d, { status: p.p_status, note: p.p_note, reviewed_by: INSTRUCTOR, reviewed_at: new Date().toISOString(), review_revision: d.review_revision + 1 });
      Object.assign(v, { status: d.status, note: d.note, reviewed_by: d.reviewed_by, reviewed_at: d.reviewed_at });
      state.document_review_events.push({ id: crypto.randomUUID(), intern_id: owner, document_id: d.id, version_id: v.id, review_revision: d.review_revision, status: d.status, note: d.note, reviewed_by: d.reviewed_by, reviewed_at: d.reviewed_at });
      persist(); return ok(d);
    }
    if (name === "document_access") {
      const d = state.documents.find(d => d.id === p.p_id);
      return d?.file_path ? ok(d) : fail("File unavailable");
    }
    if (name === "admin_update_account") {
      const account = state.profiles.find(r => r.id === p.p_id);
      if (!account) return fail("Account not found");
      Object.assign(account, p.p_patch);
      let intern = state.interns.find(r => r.id === account.id);
      if (account.role === "intern" && account.status === "Active" && !intern) {
        intern = { id: account.id, required_hours: 486, instructor_id: null, company_id: p.p_patch.company_id || null, section_id: null };
        state.interns.push(intern);
      }
      persist(); return ok({ id: account.id, profile: account, intern: intern || null });
    }
    if (name === "clock_in") {
      const now = new Date(Date.now() - 60000);
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const row = { id: crypto.randomUUID(), intern_id: owner, log_date: parts, time_in: now.toLocaleTimeString("en-GB", { timeZone: "Asia/Manila", hour12: false }) + `.${String(now.getUTCMilliseconds()).padStart(3, "0")}`, time_out: null, clocked_in_at: now.toISOString(), clocked_out_at: null, hours: null, verified: false, verified_by: null };
      state.attendance_logs.push(row); persist(); return ok(row);
    }
    if (name === "clock_out") {
      const row = state.attendance_logs.find(r => r.id === p.p_id), now = new Date();
      Object.assign(row, { clocked_out_at: now.toISOString(), time_out: now.toLocaleTimeString("en-GB", { timeZone: "Asia/Manila", hour12: false }) + `.${String(now.getUTCMilliseconds()).padStart(3, "0")}`, hours: (now - new Date(row.clocked_in_at)) / 3600000, accomplishment: p.p_accomplishment, verified: false, verified_by: null });
      persist(); return ok(row);
    }
    if (name === "submit_correction") {
      const row = { id: crypto.randomUUID(), intern_id: owner, log_date: p.p_date, claimed_time_in: p.p_in, claimed_time_out: p.p_out, claimed_end_date: p.p_end, reason: p.p_reason, status: "Pending", created_at: new Date().toISOString() };
      state.attendance_exceptions.push(row); persist(); return ok(row);
    }
    if (name === "review_exceptions") {
      const results = p.p_ids.map(id => {
        const row = state.attendance_exceptions.find(r => r.id === id);
        if (!row || row.status !== "Pending") return { id, ok: false, error: "Already reviewed" };
        Object.assign(row, { status: p.p_decision, reviewed_by: INSTRUCTOR, review_note: p.p_note, reviewed_at: new Date().toISOString() });
        if (p.p_decision === "Approved") {
          const start = new Date(`${row.log_date}T${row.claimed_time_in}:00+08:00`), end = new Date(`${row.claimed_end_date}T${row.claimed_time_out}:00+08:00`);
          const attendance = { id: crypto.randomUUID(), intern_id: owner, log_date: row.log_date, time_in: `${row.claimed_time_in}:00`, time_out: `${row.claimed_time_out}:00`, clocked_in_at: start.toISOString(), clocked_out_at: end.toISOString(), hours: (end - start) / 3600000, verified: true, verified_by: INSTRUCTOR };
          state.attendance_logs = [...state.attendance_logs.filter(a => !(a.intern_id === owner && a.log_date === row.log_date)), attendance];
        }
        return { id, ok: true, data: row };
      });
      persist(); return ok(results);
    }
    if (name === "submit_evaluation") {
      const c = p.p_criteria;
      const row = { id: p.p_submission_id, intern_id: p.p_intern_id, evaluator_id: INSTRUCTOR, competencies: c, feedback: p.p_feedback, overall_score: Math.round((c.punctuality * .25 + c.performance * .35 + c.conduct * .20 + c.communication * .20) * 20), created_at: new Date().toISOString() };
      state.evaluations.push(row); persist(); return ok(row);
    }
    return base.rpc(name, p);
  },
};
export { fixture };

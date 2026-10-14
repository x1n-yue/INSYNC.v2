// Actual RLS/controlled operations on disposable PostgreSQL, never live Supabase.
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { disposablePostgres } from "./disposable-postgres";
import { rosterMetrics, rosterSummary } from "../src/lib/rosterMetrics";
const sql = file => readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1), IA = id(2), IB = id(3), SA = id(4), SB = id(5);
let cluster, db;
async function act(actor, query, args = []) {
  await db.query("savepoint operation");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    const result = await db.query(query, args); await db.query("set constraints all immediate");
    await db.query("reset role"); await db.query("select set_config('request.jwt.claim.sub','',true)");
    await db.query("set constraints all deferred"); await db.query("release savepoint operation");
    return JSON.parse(JSON.stringify(result.rows)); // Match JSON HTTP timestamp shape.
  } catch (error) { await db.query("rollback to savepoint operation"); await db.query("reset role"); await db.query("release savepoint operation"); throw error; }
}
async function approveRosterIntern(owner, instructor) {
  await act(ADMIN, "select public.admin_set_assignment($1,$2,null,null,8)", [owner, instructor]);
  const correction = (await act(owner, "select * from public.submit_correction('2026-10-01','08:00','16:00','2026-10-01','Fixture verified shift')"))[0];
  await act(instructor, "select public.review_exception($1,'Approved',null)", [correction.id]);
  const documents = (await act(ADMIN, "select public.attach_standard_docs($1) result", [owner]))[0].result.documents;
  for (const doc of documents) {
    const upload = (await act(owner, "select public.stage_document_upload($1,'Fixture.pdf','application/pdf',20,$2) result", [doc.id, doc.upload_version]))[0].result.upload;
    await act(owner, "insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)", [upload.file_path, { mimetype: "application/pdf", size: 20 }]);
    const current = (await act(owner, "select * from public.finalize_document_upload($1)", [upload.id]))[0];
    await act(instructor, "select * from public.review_document_version($1,'Approved',null,$2,$3)", [doc.id, current.upload_version, current.review_revision]);
  }
}
async function metrics(actor) {
  const roster = await act(actor, "select id,required_hours as required from public.interns");
  // pg parses DATE as a JS Date; PostgREST sends the original YYYY-MM-DD.
  const attendance = await act(actor, "select *,log_date::text as log_date from public.attendance_logs");
  const documents = await act(actor, "select * from public.documents");
  return { roster, documents, summary: rosterSummary(rosterMetrics(roster, attendance, documents)) };
}
beforeAll(async () => {
  cluster = await disposablePostgres(); db = await cluster.connect(); await db.query(sql("tests/baseline.sql"));
  for (const file of ["M01_authority.sql", "M02_trusted_audit.sql", "M03_attendance_integrity.sql", "M04_private_documents_bucket.sql", "M05_validate_attendance.sql", "M06_rubric_hours.sql", "M07_account_lifecycle.sql", "M08_document_versions.sql", "M09_validate_domain.sql", "M10_flexible_submissions.sql", "M11_admin_history.sql"]) await db.query(sql(`migrations/${file}`));
  for (const actor of [ADMIN, IA, IB, SA, SB]) await db.query("insert into auth.users(id,email) values($1,$2)", [actor, `${actor}@example.invalid`]);
  await db.query("update public.profiles set status='Active',role=case when id=$1 then 'admin' when id in ($2,$3) then 'instructor' else 'intern' end", [ADMIN, IA, IB]);
}, 60000);
afterAll(async () => { if (cluster) await cluster.stop(); }, 30000);
beforeEach(async () => { await db.query("begin"); }); afterEach(async () => { await db.query("rollback"); });
describe("Instructor card authorized metadata", () => {
  it("counts an actually cleared assigned Intern and excludes another instructor's equally cleared Intern", async () => {
    await approveRosterIntern(SA, IA); await approveRosterIntern(SB, IB);
    const result = await metrics(IA);
    expect(result.roster.map(r => r.id)).toEqual([SA]); expect(result.documents).toHaveLength(4);
    expect(result.summary).toMatchObject({ total: 1, cleared: { count: 1, unknown: 0 }, atRisk: { count: 0, unknown: 0 } });
    expect(await act(IA, "select id from public.documents where intern_id=$1", [SB])).toEqual([]);
    expect(await act(IA, "select id from public.attendance_logs where intern_id=$1", [SB])).toEqual([]);
  });
  it("cannot count a previous approval after an actual replacement; history and permissions remain intact", async () => {
    await approveRosterIntern(SA, IA);
    const previous = (await metrics(IA)).documents[0];
    const upload = (await act(SA, "select public.stage_document_upload($1,'Replacement.pdf','application/pdf',30,$2) result", [previous.id, previous.upload_version]))[0].result.upload;
    await act(SA, "insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2)", [upload.file_path, { mimetype: "application/pdf", size: 30 }]);
    const current = (await act(SA, "select * from public.finalize_document_upload($1)", [upload.id]))[0];
    expect(current.status).toBe("Pending"); expect(current.reviewed_by).toBeNull();
    expect((await metrics(IA)).summary.cleared).toEqual({ count: 0, unknown: 0, complete: true });
    expect(await act(IA, "select id from public.document_versions where document_id=$1 and status='Approved'", [previous.id])).toHaveLength(1);
    await expect(act(IA, "select * from public.review_document_version($1,'Approved',null,$2,$3)", [previous.id, previous.upload_version, previous.review_revision])).rejects.toThrow(/changed/i);
    expect((await metrics(IB)).summary.total).toBe(0);
  });
  it("confirms requirement deadlines are absent, so reservation expiry cannot become a risk deadline", async () => {
    const { rows } = await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='documents' and column_name in ('due_date','deadline','deadline_at','due_at')");
    expect(rows).toEqual([]);
  });
});

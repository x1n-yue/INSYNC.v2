# Supervisor company logbook attendance

Implemented locally on 2026-10-15. This supersedes new Coordinator uploads in M17. Nothing has been applied or deployed to Supabase. Confirmed rollout target: `tcntyrwwqzyyqlzdtuer`; the existing local CLI link refers to an older project and must not be used with `--linked`.

## User guide

1. **Intern:** Print **My Attendance → Download blank company sheet** in advance and keep copies at the company, or use a company logbook containing the same dates, Time In/Out, signatures, Supervisor printed name and remarks. Record actual times on paper during an outage; INSync access is unnecessary.
2. **Company Supervisor:** Sign the paper. Once online, open **Manual Attendance → New Submission**. Select an assigned Intern, covered dates, signed evidence and optional remarks. Company and account identity are derived automatically. Save Draft or upload and **Submit to Coordinator**. Do not encode times or hours. Upload cropped/redacted copies showing only the selected Intern’s attendance while retaining signatures. The system authorizes file metadata and recipients; it does not inspect/redact image contents.
3. **Assigned OJT Coordinator:** Open **DTR Review → Manual Attendance Review → View / Review**. Open all evidence pages, manually enter actual dates and Time In/Out, and add rows for additional attendance dates. Desktop places the viewer beside entry; mobile stacks them. Check the hours preview and confirm that all rows match the signed evidence.
4. Click **Verify & Record Attendance**. This single explicit action records and verifies the entire submission atomically. If any row fails, no attendance or hours are created; the form stays open with its values and specific error.
5. **Intern:** My Attendance shows **Manual — Company Logbook**, verified status and the actual attendance times/durations. Existing hours, clearance and DTR exports use those same ledger rows exactly once. Evidence and Supervisor submissions remain inaccessible to Interns.

For missing signatures, unreadable images, incorrect covered dates or another problem, the Coordinator uses **Return for Correction** with a meaningful reason. No hours are created. The Supervisor opens **Revise & Resubmit**, saves a new draft version, adds/replaces evidence as needed and resubmits. Prior submitted/returned versions and files remain available in version history. Removing a page from a new draft never deletes a previously saved file.

## Assignments, scope and status

Admin must provision an Active Supervisor with one company and explicit Active Intern assignments. Company membership alone grants no Intern access. Each Intern needs an Active assigned Instructor/OJT Coordinator in the same preserved company before submission succeeds. Missing/changed assignments return an explanation and preserve drafts and uploaded evidence. Supervisors see only their own submissions/history; editing and new uploads require the original current supervision assignment. Submitted evidence is immutable.

States: **Draft → Pending Review → Verified**, or **Pending Review → Returned for Correction → new Draft version → Pending Review**. Draft saves use expected versions/revisions. Submission freezes receiving Coordinator, submission timestamp, company/Intern/Supervisor snapshots and supervision assignment UUID. No silent rerouting after reassignment. Current assigned-Intern scope, current company and stored receiving route are all required for review. Former Coordinators immediately lose access after assignment changes; the newly assigned Coordinator gains no source access until Admin explicitly reroutes.

Admin oversight is under **Interns → Manual Attendance Review**. For unresolved submissions, enter a meaningful reason and use **Reroute to current assigned Coordinator**. The RPC accepts only the current eligible Coordinator in the preserved company, records the prior/new route and reason, invalidates any open review revision, and leaves the original receiving identity untouched. Verified records cannot be rerouted or changed. Company changes that break historical scope require operator reconciliation; no invented past assignment or automatic cross-company routing is performed.

| Role | Permissions |
| --- | --- |
| Supervisor | Own assigned-Intern drafts/uploads/submission, own history and returned revisions; no encoding or verification. |
| OJT Coordinator (`instructor`) | Submitted sources routed to them and currently assigned in the preserved company; private evidence, return, atomic encoding/verification; historical M17 review/revision/verification. |
| Intern | Own printable sheet and attendance ledger/status/hours/DTR; no submission/evidence access or verified-row mutations. |
| Admin | Assignment management, submission/evidence/audit oversight and explicit audited rerouting; no new attendance-creation UI/permission. Existing historical verification authority remains. |

## Sessions and evidence

The existing ledger permits **one session per Intern per Manila start date**, up to **16 elapsed hours**. A submission accepts 1–62 rows for different supported start dates. These are existing rules and a bounded batch size, not a new work schedule or daily-hours policy. Extra same-day sessions are rejected rather than silently skipped or merged. Overnight sessions need an explicit Time Out date, and both dates must fall within the submitted covered period. No automatic breaks, lunch deductions or rounding changes. The server stores canonical timestamps and calculates exact elapsed seconds/3600; displayed hours use the existing two-decimal preview.

Required checks run on the server: eligible current recipient/assignment/company, exact version and explicit confirmation, valid finite timestamps with offsets, end after start, not future, covered dates, existing duration/daily rules, duplicate/overlap conflicts within the batch and against existing online/manual attendance, and any open online session. Failure rolls back all inserted rows, events and status changes. Online punches are never overwritten/closed by this operation. Stable request UUID plus identical session payload gives exact retry safety; lifecycle and existing per-Intern advisory locks serialize double clicks, competing reviews and online punches. Editing rows starts a fresh attempt.

Use **PDF, JPEG or PNG**, at most **10 files**, **10 MiB per file**, **50 MiB total per version**. A PDF may contain multiple pages. The existing `attendance-evidence` bucket stays private. New Supervisor reservations derive the company and participant from the submission and expire after 15 minutes unless saved/committed. Upload retries reconcile the same reservation and never use upsert. Each completed page is saved into the draft before continuing. An expired/failed unfinished upload can be explicitly discarded and selected again; referenced evidence is never deleted. Saved/old versions retain bytes and metadata. Metadata/content-type/size checks reuse the existing private-upload convention; no OCR/AI or automatic file-content redaction is added.

Previews use authorized 60-second URLs, accessible image/PDF viewers and a new-tab link. Only the submitting Active Supervisor, eligible routed Coordinator and Admin oversight may obtain the relevant private files. Interns never receive source rows, file URLs, evidence contents or shared participant lists. Coordinator review notes and Supervisor remarks are not copied into the Intern ledger. No file copies or public URLs are created for routing.

## Existing records and compatibility

M15, M16 and M17 are unchanged. Historical Coordinator-created records remain labeled **Manual — Company Attendance Sheet** with their actual original provenance. Existing unverified M17 rows retain their evidence, controlled revision using existing legacy evidence and explicit later **Verify manual attendance** action. They are not converted into Supervisor submissions. New Coordinator staging/creation RPC grants are revoked; old clients cannot create new manual entries by calling them directly. Existing staged-but-unsaved Coordinator uploads must be reconciled before rollout; preserved bytes/metadata are not removed automatically. Supervisor evidence cannot be attached through the historical revision path to bypass whole-submission review.

New verified rows keep the existing `manual_company_sheet` storage discriminator, with additional submission/version FKs and a **Manual — Company Logbook** display/export label. This reuses existing manual immutability, audits, attendance formulas, report totals and RLS. Ordinary online clocking/accomplishments/closed verification, DTR filters, printable sheets and logged-versus-verified totals remain. Retired Time Log Exception Request forms, queues, grants and counts remain retired. No service worker, PWA, IndexedDB queue, offline browser writes, background sync, OCR, AI service, email or push system was introduced.

## Rollout and recovery

Only execute after separate rollout authorization:

1. Independently verify project `tcntyrwwqzyyqlzdtuer`; obtain a provider backup and record current schema/attendance/exception/audit counts and referenced private files. Rehearse on a disposable restored database. Do not use the stale linked project or any reset script.
2. Inspect actual migration history/catalog. Apply only reviewed missing prerequisites in sequence through M15 → M16 → M17. Do not replay applied migrations. Reconcile pending old-client Coordinator manual uploads and arrange a brief client maintenance window.
3. Apply additive **`supabase/migrations/M18_supervisor_logbook.sql`** as trusted postgres after M17. Run `supabase/inspection/10_supervisor_logbook.sql` and compare grants/RLS/history counts. The migration only adds application tables/columns/functions/policies and changes this workflow’s RPC permissions; it creates no Auth users, modifies no unrelated bucket, and deletes no history or bytes.
4. Release the matching client. M18 must precede this client because it explicitly selects the new source links. Old clients retain online attendance and historical reads/verification, but their retired new-entry manual RPCs deliberately fail. New Supervisor submissions require the updated client.
5. Validate actual Supervisor/Coordinator/Intern sessions, provider Storage signed access and one isolated test Intern’s verified ledger/DTR. Do not publish real-student attendance as a test. Live confirmation remains outstanding.

Alternative existing-database path: use the reviewed regenerated consolidated final-contract updater after its preflight passes; do not apply it and then replay migrations. Fresh-install SQL includes M18 for an empty application catalog only. The default artifact generator writes SQL locally and executes no SQL; never use `--prepare-reset` for this task.

Transaction failure rolls back M18. After a successful rollout, prefer a reviewed forward fix and temporarily disable new submission/review UI if needed. Preserve the new tables, verified attendance and private objects; do not reverse by dropping history or regranting retired creation RPCs. A lost Verify response must retry the same request and unchanged sessions before attempting a new batch; already recorded rows cannot be silently changed. Operator reconciliation, rather than automatic deletion/credits, handles unavailable historical assignments/evidence.

M18 SHA256: `228aed215fe5898b4712db4bb9d5b28764dd54fbdc727c91b809ed41b1e713e9`. M15–M17 source hashes remain unchanged. Generated final inventory: 28 RLS-protected application tables, 100 public routines, 62 public + 16 Storage policies, 50 public + 1 Auth triggers, 11 standalone indexes.

## Changed files and local verification

Production: `src/components/LogbookAttendance.jsx`, `src/lib/logbook.js`, Supervisor/Instructor/Admin dashboards, `CompanyAttendance.jsx`, scoped `companyAttendance.css`, `companyAttendance.js` source metadata/label, `companyAttendanceSheet.js` print instructions, AuditHistory categories. Existing report/export helpers consume the source label and unchanged ledger; they export no new private evidence fields.

Database/artifacts: additive M18, inspection 10, consolidated/fresh generators and generated SQL, current-install diagnostics. Context, decisions, migration/runbook/handover and this guide document the new flow.

Validation results are recorded in FIX_PROGRESS.md and the final task delivery. Native tests use isolated loopback PostgreSQL with synthetic provider Auth/Storage tables; browser tests render actual React in Chromium with mocked transport and all external requests blocked. These do not establish deployed Supabase/JWT/Storage delivery. Actual printing and assistive-technology sessions remain unavailable; PDF generation/layout checks and browser downloads are local only.

Local completion evidence (2026-10-15): full suite **2,501/2,501 in36files**; lint clean; production build passed (existing chunk-size advisory). Final mocked-transport browser run **7groups,18screenshots,0page errors**. The actual downloaded **3-page A4 landscape** PDF has no clipped text and contains the current instructions. Native PostgreSQL includes actual M17-before-M18 data-preservation and populated-updater-rerun checks. Files added for this follow-up: `tests/logbook.test.jsx` and `tests/logbook-upgrade.test.js`; workflow fixture/native/browser tests and install/updater checks updated. See FIX_PROGRESS.md for commands and coverage. No live migration/deployment or actual printer/screen-reader test was performed. No remaining local blocker; provider/live acceptance and separately authorized rollout are outstanding.

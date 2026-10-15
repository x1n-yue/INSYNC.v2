# Continuation checkpoint: Supervisor manual attendance

## Resumed and completed locally — 2026-10-15

The user explicitly resumed this task. The paused checkpoint below is retained as historical context; its unresolved failures and pending checks are superseded by this section and the final M18 entry in FIX_PROGRESS.md.

Reconciled actual files/git diff and confirmed no applicable root/parent AGENTS.md. Fixed documented install/updater assertion/snapshot/diagnostic failures and Supervisor select accessibility. Finished native/client/upgrade/browser tests, retry accounting and expected-version/assignment checks, printable/user-guide rollout documentation. Historical records and unrelated edits remain. No commit, live migration/reset/deployment or real-student writes were performed.

Final local evidence: `npm test -- --maxWorkers=2` **2,501passed/36files**,157.34s; clean lint; production build1048modules/main1111.25kB/gzip320.88kB (existing chunk advisory); `git diff --check` passed. Final browser **7groups/18screenshots/0page errors**, actual React with mocked transport and blocked remote access.3-page landscapeA4 print bounds/headings/dates/current instructions passed. Native fixtures include27M18workflow cases, genuine M17beforeM18preservation+two populated updater reruns and8client helper cases. New files beyond the paused inventory: `tests/logbook.test.jsx`, `tests/logbook-upgrade.test.js`. No running task-owned test, database or browser process remains after successful checks; pre-existing dev servers were left alone.

Required rollout: only reviewed missing prerequisites → M18 before matching client, after independently verifying tcntyrwwqzyyqlzdtuer and backups/rehearsal. M15–M17 unchanged. M18 hash `228aed215fe5898b4712db4bb9d5b28764dd54fbdc727c91b809ed41b1e713e9`; both generated artifacts match. M18 applied only in disposable local fixture databases, never live. No local implementation blocker remains. Actual provider Auth/JWT/private Storage/role sessions, physical printer/screen-reader and deployed acceptance remain unverified; require separate rollout authorization. Continue from LOGBOOK_ATTENDANCE.md/FIX_PROGRESS.md, not the obsolete pause instructions below.

---

**PAUSED at the user's request because the laptop battery is low.** Do not resume work until the user asks. Checkpoint saved 2026-10-15, approximately 10:52 Asia/Manila, in `D:\Development\Projects\INSYNC.v2` (PowerShell). All current edits are written to disk, uncommitted. No commit was authorized or created. Preserve the complete working tree, including earlier tasks and unrelated edits.

## Approved objective and constraints

Implement the actual simplified flow:

**Intern records Time In/Out on paper → Company Supervisor signs and uploads evidence for an explicitly assigned Intern → server routes submission to the assigned Active OJT Coordinator → Coordinator reads evidence and encodes actual times → one explicit atomic Verify & Record Attendance → Intern sees verified attendance, updated hours and DTR.**

New Supervisor submissions replace new Coordinator-upload/manual-create entries. Preserve historical M17 Coordinator manual records, their evidence/provenance, audit, unverified revisions and explicit verification. Preserve online clocking/accomplishments, printable blank sheets, logged-versus-verified calculations, current redesign and existing assignments/roles/privacy. Do not restore Time Log Exception Requests, add OCR/AI, implement PWA/offline browser storage or background synchronization.

**Local implementation/testing only. No live migration, reset, deployment, Auth changes or unrelated Storage changes.** Never execute old reset scripts or `--prepare-reset`. No earlier reset authorization applies. User-confirmed deployed project is `tcntyrwwqzyyqlzdtuer`; existing local CLI link is stale (`upnkotnmoeaykummcnlx`). Do not use bare `--linked`. No live inspection or change was performed in this task. No real-student test attendance was created.

No applicable root/parent AGENTS.md was found. Only figma-redesign/AGENTS.md exists outside this app scope. No skills applied; no agents spawned. Do not delegate unless user/applicable instructions explicitly authorize it.

## Changes implemented, still awaiting complete validation

1. Additive **M18_supervisor_logbook.sql** after unchanged M17:
   - New private `logbook_submissions`, `logbook_versions`, `logbook_events` tables.
   - Stable company/Intern/Supervisor/supervision-assignment identifiers plus readable snapshots; original receiving Coordinator preserved per submitted version.
   - Draft optimistic revisions, server-resolved submission, return with mandatory reason, new version on resubmission, retained files/history.
   - Active Supervisor + explicit current assignment checks for creation/edit/upload/submit. Supervisor historical own reads survive assignment termination; edits do not.
   - Coordinator access requires frozen route AND current assigned Intern/company/eligibility. No implicit rerouting. Explicit audited Admin reroute to current same-company eligible Coordinator invalidates old review revisions, without rewriting original receiver.
   - Private existing attendance-evidence receipts extended with submission FK; at most10 PDF/JPEG/PNG files,10MiB each,50MiB per version.15minute uncommitted reservation; saved draft evidence commits/preserves bytes. Authorized60second previews. No public/Intern access.
   - Atomic `verify_record_logbook`: lifecycle404,1 and existing hash(Intern,101) locks; exact expected source version/revision, stable request UUID + payload retries; validates all rows/evidence, creates already-verified rows in the EXISTING ledger, server hours/encoder/verifier/time/FKs/events and marks version Verified in one transaction. Any row/audit error rolls back whole batch.
   - Existing one-record-per-Manila-start-date and16hour interval rules preserved.1–62rows per batch for supported different start dates. Explicit overnight end date; both dates within submitted period; duplicate/overlap/future/open-online checks. No deductions/schedules invented.
   - Reuses existing `manual_company_sheet` discriminator and guards/audits; new `logbook_submission_id`,`logbook_version` links and display/export label **Manual — Company Logbook**. Historical records keep **Manual — Company Attendance Sheet**.
   - Revoke authenticated EXECUTE on old new-entry `stage_attendance_sheet` and `record_manual_attendance`; existing legacy finish/cancel/revise/verify retained. Legacy details validator rejects attaching Supervisor logbook evidence through historical revision to bypass whole-submission review.
   - New version-content immutability trigger and immutable event history; raw API table writes denied. Supervisor remarks are NOT copied into the Intern ledger.
2. Actual React `LogbookAttendance.jsx` workspace/queue:
   - Supervisor sidebar **Manual Attendance**, New Submission, covered dates, optional remarks, multiple file selection, draft/save, upload/retry/progress, missing-Coordinator handling, history/status/return reasons/new version.
   - Coordinator DTR Review embeds queue, desktop side-by-side private viewer and multi-row attendance form, stacked mobile, explicit confirmation and single Verify & Record, required return reason.
   - Form stays open on errors; each uploaded page persists to draft; exact retry IDs held in refs only, no offline persistent state. Verify retry preserves original attempted payload even if refreshed ledger contains an already-created batch after a lost response.
   - Admin oversight and explicit reasoned reroute in Interns tab.
   - Version/evidence history and scoped CSS; responsive surfaces and existing Shell design preserved.
   - Historical CompanyAttendance workspace now offers print/history/review and unverified revision using retained evidence, no new-entry button or active new-create handler. Removed redundant old upload/evidence-ID selection there.
   - Intern source badge/detail and existing reports/CSV label use new source FK; no private evidence controls for Interns.
3. SQL generators include M18 and new tables; regenerated consolidated/fresh SQL locally. Default fresh generator confirmed `resetPrepared:false`. No SQL applied outside synthetic fixtures.
4. Current user guide **LOGBOOK_ATTENDANCE.md**, top-of-document superseding notices and rollout/prerequisites/recovery/role matrix. M17 guide remains as historical documentation beneath the notice.

## Exact files changed in THIS task

New:
- `src/components/LogbookAttendance.jsx`
- `src/lib/logbook.js`
- `supabase/migrations/M18_supervisor_logbook.sql`
- `supabase/inspection/10_supervisor_logbook.sql`
- `tests/logbook-postgres.test.js`
- `tests/browser/logbook-client.js`
- `tests/browser/logbook-workflows.mjs`
- `LOGBOOK_ATTENDANCE.md`
- `CONTINUE_MANUAL_ATTENDANCE.md` (this checkpoint)

Existing files additionally changed during THIS task (some were already dirty/untracked):
- `src/components/SupervisorDashboard.jsx`
- `src/components/InstructorDashboard.jsx`
- `src/components/AdminDashboard.jsx`
- `src/components/CompanyAttendance.jsx`
- `src/components/companyAttendance.css`
- `src/components/AuditHistory.jsx`
- `src/lib/companyAttendance.js`
- `scripts/build-consolidated-update.mjs`
- `scripts/build-reset-install.mjs`
- `supabase/INSync_Consolidated_Update.sql`
- `supabase/INSync_Fresh_Install.sql`
- `supabase/INSync_New_Project_Verify.sql`
- `tests/fresh-install.test.js`
- `tests/new-project-install.test.js`
- `tests/consolidated-update.test.js`
- `tests/browser/company-attendance-workflows.mjs` (now imports current logbook runner, which includes historical M17 coverage)
- `README.md`
- `AI_CONTEXT_PROMPT.md`
- `DECISIONS.md`
- `CLIENT_IMPROVEMENTS.md`
- `FIX_PROGRESS.md`
- `OWNER_HANDOVER.md`
- `WEB_SETUP.md`
- `SUPERVISOR_WORKFLOW.md`
- `COMPANY_ATTENDANCE.md`
- `supabase/migrations/README.md`
- `supabase/RUNBOOK.md`
- `supabase/INSync_New_Project_Setup_README.md`
- `supabase/INSync_Consolidated_Update_README.md`

All other dirty/untracked files in the snapshot below belong to earlier tasks or pre-existing work and were retained. `.env` was not read/changed; do not print credentials. Package/lockfile/global Shell CSS unchanged. No generated image assets or external service introduced.

## Migrations and application evidence

- M15_supervisor_evaluations.sql: unchanged in this task. Prior local implementation. No live application in this task.
- M16_evaluation_controls.sql: unchanged in this task. Prior local implementation. No live application in this task.
- M17_company_attendance.sql: unchanged in this task. Prior local implementation. No live application in this task.
- **M18_supervisor_logbook.sql: NEW, applied ONLY to isolated disposable local PostgreSQL fixtures** by tests and offline artifact generator. NEVER applied to Supabase, deployed database or a persistent development DB. Generated fresh/consolidated SQL only rehearsed in fixtures/tests, not live.

Previously confirmed unchanged hashes (rechecked during this task):
- M15 SHA256 `d7739e22e31ad6cd535e708b7e4a9dea66d3d4849530cde9a5f8fa834837a03b`
- M16 SHA256 `5f520d4aca5b5cfdf8abbcd2043fc9d98475f2149775d52ea51da88a3717bab6`
- M17 SHA256 `82e78408ea0bf4e93dfed172a63e92574eec9c546c30a268fb296cfa0b21692b`

Current generated target inventory:28 application tables,100public routines,78policies (62public+16Storage),51triggers (50public+1Auth),11explicit indexes. No final M18 hash recorded yet; regenerate/hash after further fixes.

Rollout (only after separate authorization): independently verify target/backup; apply only missing reviewed prerequisites through M17; reconcile old staged Coordinator uploads; maintenance window; M18 BEFORE matching client; inspect scope/grants/retained counts; separately release and verify actual roles/private Storage on isolated test Intern. Old new-entry manual RPCs intentionally fail after M18; online and historical reading/verification remain. No dropping new history as rollback; use forward repair. Never apply consolidated updater then replay migrations.

## Tests and current failures — DO NOT CLAIM COMPLETE

Executed:
1. `npm test -- tests/logbook-postgres.test.js`
   - First run18/20passed; two TEST fixture mistakes fixed: ending supervision before deactivating Supervisor, and numeric conversion when summing pg numeric strings.
   - Second run **20/20passed**,13.64seconds. Native disposable loopback PostgreSQL, real SQL/RLS/grants/storage metadata policy checks; provider Auth/Storage are synthetic tables, NOT real Supabase JWT/file delivery.
   - Covers no hours on draft/submission, recipient resolution/missing Coordinator, private source/evidence, role and raw API denials, retired new-create APIs, multi-date authoritative totals/immutability/idempotency,9parameterized invalid-batch cases with no partial writes, open online conflict, return/revision/history, explicit reroute, company reassignment, audit rollback, staged cleanup and real concurrent same-request verification.
   - This green run preceded the later small change filtering Coordinator draft-save events, rejecting logbook evidence in legacy details validator and omitting Supervisor remarks from Intern ledger. Latest migration needs rerun.
2. `node scripts/build-consolidated-update.mjs` succeeded locally, generated100functions/78policies/51triggers/11indexes. It applies migrations only inside its own loopback disposable database, never a Supabase endpoint.
3. `node scripts/build-reset-install.mjs` default succeeded: generated fresh SQL,28tables/100functions,`resetPrepared:false`. Executes no SQL. DO NOT use `--prepare-reset`.
4. `npm run lint` previously passed with one unused setProgress warning after historical UI removal; that warning was then removed. No final lint after the last edits yet.
5. `npm run build` succeeded at intermediate snapshot:1048modules,main1114.63kB/gzip321.63kB,existing >500kB chunk advisory. Subsequent UI cleanup/text changes need final build.
6. **Full suite** `npm test -- --maxWorkers=2` STARTED, NOT COMPLETED; canceled at pause. Partial results:
   - `tests/new-project-install.test.js`:15tests,1failure (`installs on an empty provider baseline, accepts reordered exact MIME types and creates no accounts`).
   - `tests/consolidated-update.test.js`:34tests,9failures:
     * preserves baseline accounts/assignments/legacy evidence/invalid old rubric-attendance;
     * upgrades prefix1,3,6,7,8,9,10 and preserves modern records on two runs (7failures);
     * independently applied M04 + legacy defaults + documented verification queries.
   - No full failure stacks/final suite totals were emitted before cancellation. **Investigate by rerunning focused tests with verbose output**. Counts were updated in three tests but other legacy expectations/SQL contracts may still need adjustment; do not assume a cause before reading errors.
7. **Browser** `node tests/browser/logbook-workflows.mjs` STARTED, NOT PASSED:
   - First attempt failed on test harness startup waiting for `/Hi,/` for Supervisor; actual Supervisor heading is Assigned Interns. Fixed startup selector and visible-button navigation.
   - Second attempt still in progress with no PASS output when paused; canceled. No completed M18 screenshots or browser-results.json confirmed. Do not claim visual success.
   - Runner uses actual React in local Chromium/Edge + mocked transports, external requests blocked. Fake browser transport is test-only. Test plan includes desktop1920/tablet768/mobile375, upload error/progress/retry, missing Coordinator, draft restore, return/resubmit, two-row verify, failed verify + lost-response retry, own Intern history/CSV, blank PDF, historical M17 verification, filter/error/collapse/focus/200%zoom. These remain **unconfirmed** until it completes.
   - Runner currently serves the previously generated local `.client-review/company-attendance/blank-sheet.pdf`. Ensure it exists before browser execution. Playwright loaded from `.client-review/node_modules/playwright`; use installed Chrome/Edge binary. No env file loaded.

Not completed: final lint/build/diff check; all-suite green; final browser/visual inspection; new pure client helper unit tests; additional native tests for file totals/multiple pages/expired upload/second Supervisor/changed request concurrency and latest historical compatibility; actual provider Storage/JWT/session expiry; actual printing/screen reader; live role sessions, reports/clearance/DTR. Previous M17's2465tests/6browser groups do NOT validate the new M18 flow. Read current results separately.

## Known implementation concerns / review targets

- Full install/updater regressions need exact error output before further changes; current checkpoint is intentionally incomplete and must not be deployed.
- `recordRpc` expects an `id`; version composites contain `submission_id`. Added `logbookRpc` wrapper normalizes DTOs only, preserving exact p_id check. Use wrapper for version operations; normal `recordRpc` for evidence receipts.
- Recheck lost-response handling/browser selectors and modal focus/scroll; no successful rendered M18 run yet.
- Upload retry tracks per-file UUID in refs; persists each completed page. Count prevalidation excludes completed retry files, but `edit.fileBytes` can be stale after in-dialog uploads; server50MiB guard is authoritative. Review aggregate client preview completeness on resume.
- `EvidenceViewer` expiry resets opened/reviewed state; Verify requires opened+reviewed. Opening at least one page is detected; Coordinator explicitly attests reading ALL pages. No OCR/content inspection is available. UI tells Supervisor to crop/redact unrelated Intern attendance; backend checks recipients/metadata, not pixels.
- Historical workspace was simplified late: existing unverified records can revise times/details against original retained evidence; no new upload/reuse-ID controls. Confirm legacy browser flow and handling of missing retained company context.
- Source remains `manual_company_sheet`; use additional FK for display/report label. Existing filters/totals stay the same; old client labels may remain legacy until matching client release.
- Current source contents and returned reasons are retained; draft-save events filtered from Coordinator reads, drafts filtered out of queue/version reads. Review policies for fresh-install parity.
- Original receiving Coordinator per version never changes; Admin reroute only changes current route plus revision/audit. Current company mismatch blocks review and reroute. Supervisor owns historical submission even after ending assignment; cannot revise/resubmit it without the original current assignment.
- No direct raw grants, service credentials or real test accounts introduced. New helpers have explicit revoke/grant and safe search paths; inspect migration grants and old clients after latest changes.
- Docs current notices supersede historical M17 text, but old inventory/ordered SQL instructions in some secondary docs may still need cleanup after successful tests. `tests/README.md` has NOT yet been updated for M18. FIX_PROGRESS.md currently only has new notice; final verification section not yet written.
- New read-only inspection10 written but NOT YET executed against latest fixture. New dedicated source/submission-identity immutability trigger was considered but NOT implemented; raw table grants are closed and current controlled operations preserve identities. Decide based on review, do not mistake it for implemented behavior.

## Running processes and safe pause

At pause there were two task-owned operations:
- Full Vitest session52851; root node PID12000, child workers(esbuild/native fixture descendants).
- Browser session16851; root node PID12596, headless Edge PID16416 plus descendants/esbuild. Older failed browser session63809 was completed.

Ctrl-C through write_stdin returned exit1 for both tool sessions but **did not initially terminate their OS child trees**. A subsequent native PowerShell descendant enumeration + Stop-Process was issued for validated roots12000(Vitest exact command) and12596(logbook runner exact command), leaving unrelated processes alone. Vitest disappeared. The immediate process snapshot still showed12596/16416/17360, possibly during termination; final recheck is recorded below. No SQL reset/delete/cleanup was performed. Native test roots may leave ignored `.test-postgres/synthetic-*` directories after forced stop; they contain only disposable synthetic fixture data. Do not recover/delete real databases. No test needs to remain running to preserve source edits.

Two pre-existing INSync Vite processes were observed:PID17764 and10984, serving occupied5173/5174; another unrelated draft-project Vite PID3640. They were **left untouched**. Browser fixture tried the next free port. Their state is not needed for continuation; shutdown merely stops dev servers. No live operation/file upload/deployment is in flight. Do not kill unrelated browser/dev-server processes indiscriminately.

## Exact resume steps (after user asks to resume)

1. Read this checkpoint, current `LOGBOOK_ATTENDANCE.md`, applicable docs and `git status --short`. Preserve earlier dirty work; do not reset/checkout/commit it. Check current process IDs/commands if any fixture survived; PIDs can be reused, validate before stopping. Existing Vite servers are not test-owned.
2. Reproduce first regression with a focused local command:
   `npm test -- tests/new-project-install.test.js --reporter=verbose`
   Then:
   `npm test -- tests/consolidated-update.test.js --reporter=verbose`
   Read actual stacks; fix introduced source/generator/test regressions without weakening authorization or historical constraints.
3. Recheck current M18 backend and new client helper; run:
   `npm test -- tests/logbook-postgres.test.js tests/company-attendance-postgres.test.js tests/company-attendance.test.jsx --maxWorkers=2`
   Note existing M17 native tests deliberately apply only through M17; add explicit M18 historical-compatibility checks rather than interpreting M17-only green as M18 proof. Add focused client unit tests for `logbookRpc`, upload retries, row validation/preview and source/export aggregation. Add missing critical native cases as appropriate.
4. If M18 source changes, regenerate only safe local artifacts:
   `node scripts/build-consolidated-update.mjs`
   `node scripts/build-reset-install.mjs`
   Verify no reset preparation. Update exact fixture inventory/diagnostics only based on actual target.
5. Run browser flow in isolation (avoid parallel full-suite resource pressure):
   `node tests/browser/logbook-workflows.mjs`
   If fixture PDF missing: `npm test -- tests/company-attendance.test.jsx` locally generates it. Debug harness startup/network/selectors before claiming product regressions. Fix actual UI failures. Inspect real rendered screenshots under `.client-review/logbook/`, not just assertions. Existing alias `node tests/browser/company-attendance-workflows.mjs` now invokes same current runner with legacy coverage.
6. Complete relevant tests, `npm run lint`, `npm run build`, and `git diff --check`; broaden once after fixes: `npm test -- --maxWorkers=2`. Capture exact final counts/failures. Review scoped CSS on desktop/tablet/mobile/collapsed sidebar/200%zoom, loading/error/empty/populated/new/edit/detail.
7. Update tests/README, context/progress/handover/setup current inventory/compatibility; ensure docs explain only reviewed M18 BEFORE matching client and old creation grant retirement. Execute inspection10 only in isolated fixture if possible. Hash M18 and verify generated source hashes. No live changes or deployment without fresh explicit authorization.
8. Deliver actual changed files/migration/prereqs/tests passed vs blocked/visual evidence/remaining setup and explicit LOCAL versus LIVE distinction. Do not mark complete before remaining regressions and browser validation are resolved.

## Complete working-tree snapshot at pause

This is a preservation inventory, NOT a list entirely authored by this task. Untracked earlier M15–M17 and other redesign files must remain. The checkpoint itself is created after this snapshot.

```text
 M .gitignore
 M AI_CONTEXT_PROMPT.md
 M CLIENT_IMPROVEMENTS.md
 M DECISIONS.md
 M DEMO_GUIDE.md
 M FIX_PROGRESS.md
 M OWNER_HANDOVER.md
 M README.md
 M WEB_SETUP.md
 M scripts/build-consolidated-update.mjs
 M scripts/build-reset-install.mjs
 M src/App.jsx
 M src/components/AdminDashboard.jsx
 M src/components/AuditHistory.jsx
 M src/components/InstructorDashboard.jsx
 M src/components/InternDashboard.jsx
 M src/components/Modal.jsx
 M src/components/UI.jsx
 M src/lib/authority.js
 M src/lib/exports.js
 M src/lib/handoverWorkflows.js
 M src/lib/reports.js
 M src/lib/workflows.js
 M supabase/INSync_Clear_Operational_Data.sql
 M supabase/INSync_Clear_Operational_Data_README.md
 M supabase/INSync_Consolidated_Update.sql
 M supabase/INSync_Consolidated_Update_README.md
 M supabase/INSync_Fresh_Install.sql
 M supabase/INSync_New_Project_Setup_README.md
 M supabase/INSync_New_Project_Verify.sql
 M supabase/RUNBOOK.md
 M supabase/demo/README_DEMO_DATA.md
 M supabase/demo/demo_data_cleanup.sql
 M supabase/demo/demo_data_seed.sql
 M supabase/initial_schema.sql
 M supabase/migrations/README.md
 M tests/README.md
 M tests/authority-client.test.js
 M tests/consolidated-update.test.js
 M tests/demo-data-sql.test.js
 M tests/fresh-install.test.js
 M tests/handover-reports.test.js
 M tests/new-project-install.test.js
 M tests/operational-cleanup.test.js
 M tests/phase4-client.test.js
?? .env
?? COMPANY_ATTENDANCE.md
?? EVALUATION_CONTROLS.md
?? LOGBOOK_ATTENDANCE.md
?? SUPERVISOR_WORKFLOW.md
?? src/components/CompanyAttendance.jsx
?? src/components/CoordinatorFeedback.jsx
?? src/components/EvaluationRatings.jsx
?? src/components/EvaluationWorkflow.jsx
?? src/components/LogbookAttendance.jsx
?? src/components/SupervisorAssignments.jsx
?? src/components/SupervisorDashboard.jsx
?? src/components/companyAttendance.css
?? src/components/evaluation.css
?? src/lib/companyAttendance.js
?? src/lib/companyAttendanceSheet.js
?? src/lib/evaluationFeedback.js
?? src/lib/evaluationFeedbackCatalog.json
?? src/lib/logbook.js
?? supabase/inspection/07_supervisor_workflow.sql
?? supabase/inspection/08_evaluation_controls.sql
?? supabase/inspection/09_company_attendance.sql
?? supabase/inspection/10_supervisor_logbook.sql
?? supabase/migrations/M15_supervisor_evaluations.sql
?? supabase/migrations/M16_evaluation_controls.sql
?? supabase/migrations/M17_company_attendance.sql
?? supabase/migrations/M18_supervisor_logbook.sql
?? tests/browser/company-attendance-client.js
?? tests/browser/company-attendance-workflows.mjs
?? tests/browser/evaluation-controls-workflows.mjs
?? tests/browser/logbook-client.js
?? tests/browser/logbook-workflows.mjs
?? tests/browser/supervisor-client.js
?? tests/browser/supervisor-workflows.mjs
?? tests/company-attendance-postgres.test.js
?? tests/company-attendance.test.jsx
?? tests/evaluation-controls-postgres.test.js
?? tests/evaluation-controls.test.jsx
?? tests/legacy-correction-client.js
?? tests/legacy-install.js
?? tests/logbook-postgres.test.js
?? tests/supervisor-postgres.test.js
```

## Final shutdown check

After saving this checkpoint, a fresh process check returned **no remaining task-owned Vitest/browser roots, recorded headless Edge processes, or INSync/synthetic PostgreSQL processes**. The task-owned process trees have stopped. Pre-existing development servers were not stopped. All source/document edits and this checkpoint are on disk. There is no live database operation, deployment or task-owned process that must finish before shutdown. Safe to shut down from this task’s perspective; fixture test results remain incomplete as documented above.

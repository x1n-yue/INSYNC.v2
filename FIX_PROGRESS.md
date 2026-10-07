# INSync remediation progress

Updated 2026-10-07, Phases 0-2. Owner: repository remediation agent. Both audit
and checklist read in full before edits. Starting HEAD `75998c0` (the audit refers
to an earlier source revision); working tree was clean. No applicable AGENTS.md
found in workspace/ancestor locations. Phase 0 left application behavior unchanged;
Phases 1-2 change affected UI and author M01-M05. Bootstrap, legacy patch and Vite config
remain unchanged. No remote Supabase/real-project SQL execution.

**Phases 0-2 complete; local verification recorded below.**
INS-001..012, INS-015/016 are **Fixed-pending-live-verification** (14 findings);
25 findings remain Not-fixed with the reasons/phases below.
Tests that reproduce defects must not be interpreted as fixes or deployed security
evidence. Defaults are recorded in `DECISIONS.md` and can be revised before their
phase. Stop after the Phase 2 commit; Phase 3 starts only on the user's “continue.”

## Phase 0 artifacts and checks

- `package.json`, `package-lock.json`, `vitest.config.js`, `eslint.config.js`:
  Vitest, lint and test/watch scripts, isolated Node tests. Application build/dev
  configuration left intact. Vitest 4.1.11, ESLint/@eslint/js 9.39.5, React lint
  plugin 7.37.5, hooks plugin 7.1.1, globals 17.13.0 pinned as dev dependencies.
- `.env.example`: two public browser placeholders only; startup guard is Phase 3.
- `tests/setup.js`, `tests/audit-baseline.test.js`, `tests/README.md`: seven audit
  probes in 11 characterization cases with no live transport or app-client import.
- `supabase/inspection/01_metadata.sql`, `02_anomalies.sql`, `README.md`,
  `REPAIR_PROPOSAL.md`: unexecuted read-only catalog/anomaly inventory and per-group
  review proposal, covering duplicates, partial checklists, hour targets, role/
  assignment, rubric, time/review, paths/orphans and current-year flags.
- `supabase/tests/FIXTURES.md`: disposable role/status/scope fixture specification,
  full 12-table/Storage contract and RT-01 to RT-22 acceptance plan; not an executed
  policy suite. `supabase/RUNBOOK.md`: preparation gates only; migrations pending.
- `DECISIONS.md`: conservative defaults and implementation/change points.

Validation environment: Windows PowerShell, Node **24.18.0**, npm **11.16.0**.

| Check | Actual result / limit |
|---|---|
| Pre-edit `npm run build` | Passed, Vite 5.4.21, 673 modules. JS 931.35 kB / gzip 260.18 kB; CSS 22.80 kB / gzip 5.35 kB. >500 kB warning. |
| Post-edit `npm test` | Passed on Vitest 4.1.11: 1 file, 11 cases; known defects reproduced, synthetic SDK transport only. |
| Post-edit `npm run lint` | Passed: zero errors, six existing unused imports (3 Admin, 3 Instructor). Generated Vite timestamp config files excluded after one concurrent build/lint run raced a deleted temporary file. |
| Post-edit `npm run build` | Passed, 673 modules; same JS/CSS bytes, hashes and sizes as pre-edit baseline. >500 kB warning persists. Compilation only. |
| `npm ls --depth=0` | Passed with final pinned tooling; no invalid top-level dependency. |
| `npm audit --ignore-scripts` | Exit 1: 3 remaining packages, Vite (high), source-map-js (high), esbuild (moderate); existing Phase 3 debt. Initial 3.x Vitest trial added advisories and was replaced; none of those remain. No forced audit fix. |
| Lockfile/application diff | Existing production dependency versions unchanged; application source/bootstrap/legacy patch/Vite config unchanged. `git diff --check` passed. |
| Inspection/policy SQL | Authored and statically reviewed only; no Postgres parser/server/live result. Requires operator rehearsal on disposable data. |
| Browser / accessibility / real Auth / Storage | Not executed. |

ESLint 9 is marked unsupported by npm; latest 9.x retained for React lint plugin
peer compatibility. Reassess in Phase 3. Runtime floor mismatch and exposed dev
host remain open. Vitest has an independent nested Vite; root application Vite is
unchanged. No fresh Node 22 install/CI/browser validation is claimed.

## Phase 1 implementation and verification

Starting revision `368012c`. User authorized Phase 1 by “continue.” Deliverables:

- `supabase/migrations/M01_authority.sql`: single transaction with preflight drift/
  ownership/trigger checks, literal intern/Pending signup, requested_role metadata,
  status/assignment helpers, profile field guard, restricted profile/name access,
  immutable domain ownership, author-bound snapshot announcements, Active-scoped
  document Storage policies and explicit table/column/function/schema privileges.
- Raw clock/correction/document review writes revoked for every API role. Controlled
  clock, correction submission, atomic correction review, owner upload/reset and
  staff document-review RPCs preserve legitimate flows. Server instants/duration,
  explicit overnight end date and path-pinned review were prerequisite work pulled
  forward; unique/CHECK validation, trusted audit and full version lifecycle remain
  later phases. No legacy rows backfilled, merged or normalized.
- `src/lib/authority.js`, App, LoginPage, Intern/Instructor dashboards: status-only
  own-profile RPC, public effective role removed, staff FK name embeds replaced
  with restricted name RPC, controlled mutations, per-item bulk outcomes, UUID
  recipients, pending clock/review controls and outcome-dependent draft closing.
- `supabase/tests/baseline.sql`, `tests/m01-authority.test.js`: fresh synthetic
  Auth/Storage/domain schema and actual migration applied only in in-memory PGlite
  0.5.8. 1,716 raw CRUD matrix cases plus protected-field/RPC/catalog tests; all
  role/status variants have real owned fixture rows. Bootstrap never read/executed.
- Client transport suite verifies single-record/target assertions, thrown/returned
  errors and mixed bulk outcomes. Manila/overnight probes now assert corrected
  behavior through shared date/actual SQL; other baseline defects stay recorded.
- `supabase/tests/M01.md`, migrations README, RUNBOOK and DECISIONS updated with
  operator bootstrap, migration prerequisites, fail-closed rollback, live matrix,
  unknown legacy audience handling and conservative operation scope.

| Check | Phase 1 result |
|---|---|
| `npm test` | Final run: 3 files, 1,948 cases passed, including SQL-owner/name-scope hardening and one-second/future/required-note boundaries. Actual Postgres SQL tests and synthetic transport checks, not live Supabase. |
| `npm run build` | Passed: 674 modules, JS 930.86 kB / gzip 260.45 kB; CSS 22.80 kB / gzip 5.35 kB. Large-chunk warning persists. |
| `npm run lint` | Passed: zero errors, six existing unused imports. |
| `npm audit --ignore-scripts` | Exit 1: same 3 vulnerable packages (2 high, 1 moderate); Phase 3, no forced fix. No new runner advisory. |
| Source/data safety | Bootstrap/legacy patch unchanged; no .env contents, real credentials or remote DB/Auth/Storage contacted. No production migration applied. |
| Live/browser checks | Not run: actual JWT/confirmation, PostgREST composites/FK embedding, bucket public delivery/signed URLs, two-client concurrency, keyboard/mobile/screen-reader. Detailed steps in supabase/tests/M01.md. |

Known residual risks: bucket configuration may still be public (INS-015); trusted
audit is absent and Admin client logging remains forgeable (INS-009); legacy
uniqueness/CHECKs not enforced yet; document immutable version/staging cleanup and
rubric authority remain Phase 4; auth/read error handling and some zero-row writes
remain Phase 5. Extra live catalog drift causes M01 preflight to stop for review.
Local SQL success does not establish deployed authorization or production readiness.

## Phase 2 artifacts and checks

- `M02_trusted_audit.sql`: mandatory row-trigger audit across 11 business tables,
  trusted UID/time/source, protected INSERT and non-public trigger helper. Captures
  changed fields, role/status/assignment values and master labels without whole
  profile/file snapshots. Legacy audit remains explicitly unverified. Failed audit
  aborts the mutation; no-op/zero-row writes generate no event.
- M02 single review locks caller status/assignment/request and Pending transition,
  reconciles existing/missing attendance, stores required rejection/optional
  approval note, returns actual row. Server bulk uses per-item subtransactions
  and consistent intern/request lock order; no success for failed attendance/audit.
- `M03_attendance_integrity.sql`: daily/open/Pending unique identities after a
  duplicate preflight; NOT VALID interval/verification/reason/review CHECKs; future
  write trigger; server clock time captured after serialization; guarded row-ID
  closure. `M05_validate_attendance.sql` is a separately deferred historical gate,
  never a repair or timestamp guess. Any legacy anomaly remains an operator task.
- `M04_private_documents_bucket.sql`: separate explicit existing-bucket UPDATE,
  private/10 MiB/PDF-JPEG-PNG; no object cleanup. Independent of M03 legacy gate.
- `authority.js`, `attendance.js`, dashboards: strict server bulk outcomes,
  rejection-note draft/busy handling and persisted note/overnight end-date display;
  Manila clock/date/elapsed helpers; independent
  open-session query; Instructor Active Now across dates with unknown/error state.
  Removed client audit INSERT and fake import/backup events; disabled those two
  simulated actions and labeled backup unavailable/legacy audit provenance.
- `inspection/03_phase2_attendance.sql`, repair proposal, RUNBOOK, migration/test
  guides and D24-D27 cover anomaly review, staged validation and live limitations.
- Dev-only pinned embedded-postgres 17.10.0-beta.17 + pg 8.23.1; native disposable
  cluster accepts no remote URL/env credentials, runs hidden on random loopback
  port, creates no OS user/service, verifies cleanup paths. No bootstrap read.

| Check | Phase 2 result |
|---|---|
| `npm test` | 6 files / 2,012 tests passed: M01 SQL matrix 1,929; native Phase 2 SQL 45; migration gates 7; client transport 16; date/elapsed helpers 5; remaining baseline characterizations 10. Includes persisted deleted-master labels and final bulk scope/order checks. |
| Native races/faults | Overlap observed through pg_stat_activity waits; approve/approve, reject/reject, approve/reject, clock-in/out, Pending-submission races have one transition. Reassignment/deactivation while waiting denies stale review. Insert/update/review/audit failure rollback and mixed bulk tested. |
| `npm run build` | Passed: 675 modules; JS 933.62 kB / gzip 261.38 kB; CSS 22.88 kB / gzip 5.38 kB. Large-chunk warning remains Phase 6. |
| `npm run lint` | Passed: zero errors, six existing unused-import warnings. |
| `npm ls --depth=0` | Passed; test dependencies and existing React/Vite/plugins resolve without invalid top-level peers on Node 24.18.0. Runtime floor/tooling alignment remains Phase 3. |
| `npm audit --ignore-scripts` | Exit 1: same 3 vulnerable packages (2 high, 1 moderate), deferred Phase 3. No forced audit fix; test dependencies introduce no advisory in this report. |
| Safety / live limits | No .env read/output, real credentials, remote DB/Auth/Storage call or bootstrap execution. Local synthetic Auth/Storage metadata is not a deployed service. No browser/mobile/screen-reader run. |

Pending: operator catalog/anomaly review, all real migration application and
historical validation, genuine JWT/retained-session/API result shapes, Storage
public delivery denial/actual size-MIME enforcement, authorized signed URLs,
Supabase API races and browser/a11y. Private View/Download/version cleanup remains
Phase 4. Read failures/pagination/lifecycle/other zero-row handlers remain later
phases. New audit cannot certify previously authorized staff or historical claims.
No production-readiness or deployed-security claim.

## Finding register

M01 refers to `supabase/migrations/M01_authority.sql`; SQL suite refers to
`tests/m01-authority.test.js`, client suite to `tests/authority-client.test.js`.
“Pending RT” means live verification, never a passing live test. Baseline probes
remain in `tests/audit-baseline.test.js`; local SQL checks are separate evidence.

| ID | Status | Files / evidence | Tests / next phase and remaining risk |
|---|---|---|---|
| INS-001 | Fixed-pending-live-verification | M01; SQL suite; D08/D23 | Local protected-field/status/role tests pass; self-name only, trusted operator bootstrap documented. Pending live RT-01/02/03 and owner/membership inspection. |
| INS-002 | Fixed-pending-live-verification | M01; LoginPage.jsx; SQL suite | Signup always intern/Pending + extension; requested_role non-authoritative. Local metadata cases pass; pending real Auth confirmation-on/off/metadata RT-01. |
| INS-003 | Fixed-pending-live-verification | M01; App.jsx; SQL suite | Local role/status matrix + retained-identity deactivation pass. Status-only non-Active profile RPC. Live JWT/Storage checks pending; public bucket delivery still INS-015. |
| INS-004 | Fixed-pending-live-verification | M01; SQL suite; D09/D20 | Assigned scope, ownership immutability/RPC-only review and foreign-folder checks pass locally. Pending live RT-03/04, actual extra policy/RPC inventory. |
| INS-005 | Fixed-pending-live-verification | M01; InternDashboard.jsx; SQL suite | Own/assigned profile reads; related staff id/name RPC; equivalent roster SQL join passes. Pending actual PostgREST embeds/RPC shapes RT-03. |
| INS-006 | Fixed-pending-live-verification | M01; InstructorDashboard.jsx; SQL suite; D07/D22 | Bound author, UUID active assigned recipient, frozen broadcast audience, author/recipient/Admin reads pass locally. Intern feed still INS-024; live RT-16 pending. |
| INS-007 | Fixed-pending-live-verification | M01/M02/M03; authority.js; dashboards; SQL suites | Raw writes denied; trusted server clock/correction/review, audit and independent native races pass. Legacy validation/data review and live RT-03/08/10 pending. |
| INS-008 | Fixed-pending-live-verification | M01; authority.js; dashboards; SQL suite | Admin-only empty Pending requirements, owner upload/reset RPC, own prefix/object check, staff review RPC. Local tampering tests pass; live RT-04/07/15 and full version lifecycle pending. |
| INS-009 | Fixed-pending-live-verification | M02; AdminDashboard; phase2-postgres.test.js; D15/D25 | API audit writes denied including Admin; actor/time/changed fields and 11-table mandatory audit; zero-row/no-op absent; audit failure rolls back. Legacy provenance unverified. Live RT-12/20 and catalog pending. |
| INS-010 | Fixed-pending-live-verification | M02; authority.js; InstructorDashboard; native/transport suites; D26 | Existing/missing-day reconciliation, note, failed insert/update/exception/audit rollback, mixed bulk and observed concurrent approve/reject races pass. Live SDK shapes/JWT/API races RT-11/12/13 pending. |
| INS-011 | Fixed-pending-live-verification | M03/M05; migration gates/native SQL; D01/D24 | Daily/open/Pending unique identities, guarded ID-only clock closure and busy states; real concurrent transitions commit once. Legacy duplicates stop migration unchanged; real preflight/deployment/live RT-08/12/13 pending. |
| INS-012 | Fixed-pending-live-verification | M01/M03; attendance.js; dashboards; helper/native SQL; D02/D03/D27 | Trusted instants/server Manila date, independent open query, overnight/seconds elapsed, Instructor Active Now across dates, explicit unknown legacy state. Device timezone display tested locally; legacy evidence/browser/live RT-09/17 pending. |
| INS-013 | Not-fixed | RUNBOOK.md; inspection/README.md | Pending RT-22; Phase 3; old bootstrap/README unsafe wording unchanged, runbook forbids existing-data use. |
| INS-014 | Not-fixed | package tooling; audit baseline recorded above | Pending RT-22; Phase 3; 3 existing vulnerable packages/dev host remain. |
| INS-015 | Fixed-pending-live-verification | M04; native SQL/migration gates; D11 | Existing public bucket explicitly private with MIME/10 MiB settings; unrelated bucket retained; missing bucket aborts. Actual object delivery/upload enforcement/live RT-04/15 unverified. |
| INS-016 | Fixed-pending-live-verification | M03/M05; inspection/03; native SQL/migration gates; D03/D17/D24 | Independent new-row interval/hours/review/reason CHECKs, future-write guards, Pending uniqueness. Equal/negative/ambiguous/excessive/future invalid; explicit overnight/max16h/one-second valid. Historical validation and live RT-09/10/12 pending. |
| INS-017 | Not-fixed | inspection/02_anomalies.sql; FIXTURES.md; D12 | Pending RT-14; Phase 4; malformed/null/inconsistent scores still accepted. |
| INS-018 | Not-fixed | 5 baseline numeric cases; inspection/02_anomalies.sql; D06 | Coercion reproduced; pending RT-05/17; Phase 4; no validator/CHECK yet. |
| INS-019 | Not-fixed | inspection/02_anomalies.sql; D09 | Pending RT-05; Phase 4; lifecycle/assignment partial commits unchanged. |
| INS-020 | Not-fixed | inspection/02_anomalies.sql; D10 | Pending RT-07; Phase 4; duplicates/partial provisioning unchanged. |
| INS-021 | Not-fixed | FIXTURES.md; D11 | Pending RT-04/15; Phase 4; no private View/Download UI yet. |
| INS-022 | Not-fixed | inspection/02_anomalies.sql; D10/D11 | Pending RT-15; Phase 4; upload/version/cleanup races unchanged. |
| INS-023 | Not-fixed | Admin fake backup/import disabled; fake client events removed; D05/D15 | Partial Phase 2 improvement. Phase 3 must disable remaining fake templates/exports/reports/drag-drop/uptime and implement commissioned real artifacts. RT-20 pending. |
| INS-024 | Not-fixed | Instructor UUID targeting implemented with M01; D07 | Pending RT-16; Phase 4; Intern loading/empty/error message feed still absent. |
| INS-025 | Not-fixed | baseline chart probe; D02/D04/D05/D13 | Cross-year averaging reproduced; pending RT-17/18; Phase 4; shared metrics not extracted yet. |
| INS-026 | Not-fixed | FIXTURES.md | Pending RT-18/19; Phase 5; failed reads still resemble empty data. |
| INS-027 | Not-fixed | inspection/01_metadata.sql; FIXTURES.md | Pending RT-18; Phase 5; capped totals, pagination/staleness unresolved. |
| INS-028 | Not-fixed | FIXTURES.md | Pending RT-19; Phase 5; auth race/missing-profile handling unchanged. |
| INS-029 | Not-fixed | REPAIR_PROPOSAL.md; D16 | Pending RT-06/21; Phase 6; deletion impact/stale dependent forms unchanged. |
| INS-030 | Not-fixed | inspection/02_anomalies.sql; D14 | Pending RT-06; Phase 6; section/current-year flows absent. |
| INS-031 | Not-fixed | .env.example | Template added; pending RT-19/22; Phase 3; startup still crashes without valid config. |
| INS-032 | Not-fixed | M01 structured RPC outcomes; two dependent form handlers awaited; D17 | Partial prerequisite improvement; Phase 5 all-form failure/busy/length/draft handling and RT-08/15/19 pending. |
| INS-033 | Not-fixed | FIXTURES.md | Pending RT-21 browser/screen-reader; Phase 6; dialog/input/toast issues unchanged. |
| INS-034 | Not-fixed | baseline contrast probe | Low contrast reproduced; pending RT-21; Phase 6; token changes not made. |
| INS-035 | Not-fixed | FIXTURES.md | Pending RT-06/21; Phase 6; action terms/colors unchanged. |
| INS-036 | Not-fixed | before-build sizes above | Pending RT-18/22; Phase 6; eager dashboard/chart chunk remains. |
| INS-037 | Not-fixed | test tooling runtime documented; DECISIONS.md | Pending RT-22; Phase 3; engines >=18 remains inconsistent with dependency tree. |
| INS-038 | Not-fixed | FIXTURES.md; D08 | Pending RT-01/20; Phase 3; demo shortcut still exposed, no real-account inventory/rotation performed. |
| INS-039 | Not-fixed | M01 record RPC cardinality/target checks; baseline zero-row assignment probe | RPC calls reject empty/mismatched outcomes; Admin/alert/master mutations still need assertions. Pending RT-19; Phase 5. |

Paths inspection/*, REPAIR_PROPOSAL.md and FIXTURES.md refer to their respective
subdirectories under supabase/. Dxx refers to DECISIONS.md. No finding is marked
Fixed-pending-live-verification until its implementation and local checks exist.

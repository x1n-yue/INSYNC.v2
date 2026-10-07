# INSync remediation progress

Updated 2026-10-07, Phases 0-1. Owner: repository remediation agent. Both audit
and checklist read in full before edits. Starting HEAD `75998c0` (the audit refers
to an earlier source revision); working tree was clean. No applicable AGENTS.md
found in workspace/ancestor locations. Phase 0 left application behavior unchanged;
Phase 1 changes affected UI and authors M01. Bootstrap, legacy patch and Vite config
remain unchanged. No remote Supabase/real-project SQL execution.

**Phases 0-1 complete; Phase 1 local verification recorded below.**
INS-001..008 are **Fixed-pending-live-verification**; remaining findings stay open.
Tests that reproduce defects must not be interpreted as fixes or deployed security
evidence. Defaults are recorded in `DECISIONS.md` and can be revised before their
phase. Continue only on the user's “continue” after the Phase 1 commit; Phase 2 has not started.

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

## Finding register

M01 refers to `supabase/migrations/M01_authority.sql`; SQL suite refers to
`tests/m01-authority.test.js`, client suite to `tests/authority-client.test.js`.
“Pending RT” means live verification, never a passing live test. Baseline probes
remain in `tests/audit-baseline.test.js`; local SQL checks are separate evidence.

| ID | Status | Phase 0 files / evidence | Tests / next phase and remaining risk |
|---|---|---|---|
| INS-001 | Fixed-pending-live-verification | M01; SQL suite; D08/D23 | Local protected-field/status/role tests pass; self-name only, trusted operator bootstrap documented. Pending live RT-01/02/03 and owner/membership inspection. |
| INS-002 | Fixed-pending-live-verification | M01; LoginPage.jsx; SQL suite | Signup always intern/Pending + extension; requested_role non-authoritative. Local metadata cases pass; pending real Auth confirmation-on/off/metadata RT-01. |
| INS-003 | Fixed-pending-live-verification | M01; App.jsx; SQL suite | Local role/status matrix + retained-identity deactivation pass. Status-only non-Active profile RPC. Live JWT/Storage checks pending; public bucket delivery still INS-015. |
| INS-004 | Fixed-pending-live-verification | M01; SQL suite; D09/D20 | Assigned scope, ownership immutability/RPC-only review and foreign-folder checks pass locally. Pending live RT-03/04, actual extra policy/RPC inventory. |
| INS-005 | Fixed-pending-live-verification | M01; InternDashboard.jsx; SQL suite | Own/assigned profile reads; related staff id/name RPC; equivalent roster SQL join passes. Pending actual PostgREST embeds/RPC shapes RT-03. |
| INS-006 | Fixed-pending-live-verification | M01; InstructorDashboard.jsx; SQL suite; D07/D22 | Bound author, UUID active assigned recipient, frozen broadcast audience, author/recipient/Admin reads pass locally. Intern feed still INS-024; live RT-16 pending. |
| INS-007 | Fixed-pending-live-verification | M01; authority.js; Intern/Instructor dashboards; SQL suite | Raw writes denied across roles; server clock/correction/review identity/time/field tests pass. Legacy constraints/audit/multi-client races remain Phase 2. Live RT-03/08/10 pending. |
| INS-008 | Fixed-pending-live-verification | M01; authority.js; dashboards; SQL suite | Admin-only empty Pending requirements, owner upload/reset RPC, own prefix/object check, staff review RPC. Local tampering tests pass; live RT-04/07/15 and full version lifecycle pending. |
| INS-009 | Not-fixed | M01 narrows raw audit INSERT to Active Admin/own actor; D15 | Pending RT-12/20; Phase 2; client event/time forgery and missing trusted audit remain. |
| INS-010 | Not-fixed | M01 atomic review prerequisite; Instructor RPC adapter; SQL suite | Local review/transition/interval checks pass; Phase 2 trusted audit, injected failures, multi-client races and server bulk still pending RT-11/12/13. |
| INS-011 | Not-fixed | M01 guarded clock RPC; baseline SDK probe; D01 | Local repeated transition guards pass; Phase 2 legacy duplicate disposition, unique constraints and independent concurrency RT-08/12/13 pending. |
| INS-012 | Not-fixed | M01 server instants; authority.js; Intern display test; D02/D03 | Owner date/elapsed logic corrected locally; Instructor Active Now/UTC date still Phase 2. Legacy ambiguous times unchanged; live RT-09/17 pending. |
| INS-013 | Not-fixed | RUNBOOK.md; inspection/README.md | Pending RT-22; Phase 3; old bootstrap/README unsafe wording unchanged, runbook forbids existing-data use. |
| INS-014 | Not-fixed | package tooling; audit baseline recorded above | Pending RT-22; Phase 3; 3 existing vulnerable packages/dev host remain. |
| INS-015 | Not-fixed | inspection/01_metadata.sql; D11 | Pending RT-04/15; Phase 2; deployed bucket privacy unknown, existing-public repair absent. |
| INS-016 | Not-fixed | M01 DB interval/correction RPC; SQL suite; D03/D17 | Client clamp removed; overnight/date/duration/reason validation tested locally. Phase 2 NOT VALID/CHECK/uniqueness and live RT-09/10/12 pending. |
| INS-017 | Not-fixed | inspection/02_anomalies.sql; FIXTURES.md; D12 | Pending RT-14; Phase 4; malformed/null/inconsistent scores still accepted. |
| INS-018 | Not-fixed | 5 baseline numeric cases; inspection/02_anomalies.sql; D06 | Coercion reproduced; pending RT-05/17; Phase 4; no validator/CHECK yet. |
| INS-019 | Not-fixed | inspection/02_anomalies.sql; D09 | Pending RT-05; Phase 4; lifecycle/assignment partial commits unchanged. |
| INS-020 | Not-fixed | inspection/02_anomalies.sql; D10 | Pending RT-07; Phase 4; duplicates/partial provisioning unchanged. |
| INS-021 | Not-fixed | FIXTURES.md; D11 | Pending RT-04/15; Phase 4; no private View/Download UI yet. |
| INS-022 | Not-fixed | inspection/02_anomalies.sql; D10/D11 | Pending RT-15; Phase 4; upload/version/cleanup races unchanged. |
| INS-023 | Not-fixed | FIXTURES.md; D05/D15 | Pending RT-20; Phase 3; simulated operations still claim success. |
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

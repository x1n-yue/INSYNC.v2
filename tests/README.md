# Local remediation tests

M18 local completion, 2026-10-15: **2,501 tests / 36 files passed**, lint/build passed; **7 browser groups / 18 screenshots / 0 page errors** with mocked transports, native isolated PostgreSQL authorization/upgrade tests and unclipped3-page A4 PDF checks. Live Auth/Storage/rollout remain unverified and unauthorized for automatic execution. See [guide](../LOGBOOK_ATTENDANCE.md) and FIX_PROGRESS.md.

Current M18 workflow: [Supervisor logbook guide and rollout](../LOGBOOK_ATTENDANCE.md). Native `logbook-postgres.test.js` checks scoped source versions, routing, private evidence, returns, atomic verified ledger batches, constraints, audits and multi-connection races. `logbook-upgrade.test.js` creates genuine M17 records before M18 and checks retained data plus populated M18 updater reruns. `logbook.test.jsx` checks client response guards, bounded reads, upload reconciliation, canonical previews, source labels, reports and clearance totals.

`node tests/browser/logbook-workflows.mjs` renders actual React in Chromium/Edge with synthetic transports and external requests blocked. Seven workflow groups cover Supervisor PDFs/images, two-page uploads, drafts/retries, missing Coordinator, return/resubmission/history, Coordinator encoding/atomic errors/confirmation/retries, Intern history/CSV/privacy, retained A4 printing, historical verification, loading/error/filtered/no-assignment states, desktop/tablet/mobile/collapsed sidebar/focus/200% zoom. Artifacts: `.client-review/logbook/`. `company-attendance-workflows.mjs` now invokes this current runner and includes historical M17 review coverage. Browser transport assertions are not database authorization evidence; native SQL tests provide that proof locally with provider schema doubles. No remote Auth/Storage delivery or deployed acceptance is claimed.


Current M17 paper fallback: [user guide, source/evidence rules and rollout](../COMPANY_ATTENDANCE.md). Reviewed M17 must precede the matching client. No live rollout or reset.

M17: `company-attendance-postgres.test.js` covers real RPCs/RLS/Storage policies,
hours, separate verification, manual-only revisions, immutable private audit,
company history, failed/expired uploads and multi-connection conflicts/retries.
`company-attendance.test.jsx` covers local validation, upload/recovery and actual
PDF generation. `node tests/browser/company-attendance-workflows.mjs` now runs the M18 flow and preserved historical verification with synthetic transport and blocked remote requests.
Results/PDF/CSV/screenshots are ignored under `.client-review/company-attendance`.
Final full suite: 2,465 cases in 33 files; lint and build pass. See FIX_PROGRESS.md.

Current M16 follow-up: [evaluation controls and rollout](../EVALUATION_CONTROLS.md). Apply reviewed M15, then M16, before the matching client. Local preparation only; no reset or live rollout.

M16: `evaluation-controls.test.jsx` checks shared native radio semantics and deterministic choices/reasons. `evaluation-controls-postgres.test.js` installs M15, seeds a genuine written draft before M16, then checks real RPC/RLS/grants, server/client catalog parity, exact previews, privacy, legacy retention, immutable adjustment events and audit rollback. `node tests/browser/evaluation-controls-workflows.mjs` checks 8 rendered workflow/layout groups and saves 27 screenshots. Browser runners require the optional local Playwright installation under `.client-review/node_modules` and Chrome/Edge or Playwright Chromium. They disable environment loading and block remote requests. Local full suite: `npm test -- --maxWorkers=2`, 2,443 cases in 31 files passed; lint and production build passed. See FIX_PROGRESS.md for visual limitations and evidence.

M15: `supervisor-postgres.test.js` uses native isolated PostgreSQL for the four-role evaluation/assignment/retirement contracts and atomic retries/audit faults. `node tests/browser/supervisor-workflows.mjs` uses actual React with a synthetic transport and blocked remote requests; 10 groups pass with the current controls. `legacy-install.js` and `legacy-correction-client.js` preserve historical M14 regression coverage only; they are never production imports. Previous M15-only run: 2,425 cases in 29 files.

Current additive M15 upgrade: [Supervisor workflow and rollout](../SUPERVISOR_WORKFLOW.md). Supervisor is authorized; correction mutations and direct Coordinator evaluation creation are retired. Target: `tcntyrwwqzyyqlzdtuer`; no live rollout occurred. Historical cleanup/demo/reset procedures below do not authorize removing current evaluation/correction history.


Coordinator follow-up adds `coordinator-postgres.test.js` (native M13 reapplication,
controlled frozen-audience sends, denied foreign/anonymous/raw writes, sender and
recipient history after reassignment, audit/audience fault rollback, valid/stale/
open/invalid attendance) and `coordinator-ui.test.js` (RPC argument/response guards,
six-digit equivalent timestamps, real requirement IDs/duplicates/Other and file limits).
`node tests/browser/coordinator-workflows.mjs` checks the actual UI with mocked
transport, no environment file/remote network, preserving drafts and replay IDs,
dropdown persistence/error/empty states, clearance separation and attendance refresh.
The updated audit/handover browser runners also use the real controlled send handler.

Owner handover adds `handover-reports.test.js` (complete authorized count-checked
datasets through mocked capped pages, Manila filters/Unknown evidence, actual
PDF/XLSX/CSV generation, text IDs/formula safety, SDK recovery and response guards)
and `handover-postgres.test.js` (real isolated M12 custom requirements, closed
attendance verification, current-year setup, cross-role denial, stale inputs,
mandatory audit rollback and clearance after actual standard/custom approvals).
M12 tests also verify first-replacement legacy metadata/file preservation,
private Storage RLS/reassignment/cleanup denial and no invented version-zero
approval; missing metadata support blocks unsafe replacement before mutations.
`initial-schema.test.js` now applies M12 after M11. Consolidated tests run the
regenerated final catalog twice and stop conflicting-current-year upgrades.

`node tests/browser/handover-workflows.mjs --production` builds a separate ignored
fixture bundle and serves it locally. It checks actual React controls and 31
generated artifact receipts, with PyMuPDF independently parsing real PDF output
and fflate validating XLSX/embedded images/footer; all Supabase transport is
mocked, env loading disabled and remote requests blocked. Requires the optional
Playwright installation and local Python/PyMuPDF used by validation. Never serve
or deploy this fixture bundle as the normal app. Results/limits are recorded in
`../HANDOVER_AUDIT_2026-10-13.md`; owner setup/acceptance is `../OWNER_HANDOVER.md`.

Instructor summary extension: `instructor-cards.test.js` checks shared
classification/partial Unknown counts, IDs, Manila boundaries and filtering/pages;
`instructor-cards-postgres.test.js` exercises actual controlled verified attendance,
standard approvals/replacement and cross-instructor RLS on disposable PostgreSQL.
`node tests/browser/instructor-cards.mjs` checks actual React cards and refresh
through a mocked transport with remote requests/env-file loading disabled. See
`../INSTRUCTOR_CARD_IMPLEMENTATION.md`; no deadline schema or live provider proof.

2026-10-13 audit adds `demo-audit.test.js` (private-link response latency/expiry,
RLS-protected historical evidence identity and explicit rejected-read handling)
and `node tests/browser/audit-workflows.mjs` (actual React with a mocked transport:
token refresh/draft retention, late restoration/signout, failure isolation,
alert errors, profile/status gates, approval/assignment, clock/correction review,
standard history, flexible approval, evaluations and frozen-recipient messages).
Remote browser requests and env-file loading are disabled. Full local suite:
17 files / 2,238 tests passed. See `../AUDIT_DEMO_2026-10-13.md` and
`../DEMO_GUIDE.md` for current evidence and live-service prerequisites.

`node tests/browser/redesign-workflows.mjs` uses the existing optional Playwright
installation and synthetic client, with environment-file loading disabled and
remote requests blocked. It covers all 19 role destinations at five desktop,
narrow, mobile and short-screen sizes, collapsed navigation/mobile drawer,
assignment and announcement handlers, supported CSV downloads, unavailable
actions, failed RPC drafts/notices and validated overnight/legacy DTR display.
Screenshots/results are saved under ignored `.client-review/redesign`.
The auth browser runner also checks edge-to-edge geometry, the 45/55 split,
stationary branding, right-panel registration scrolling, desktop login with
validation/server errors, all controls at 13 viewport sizes, a synthetic keyboard
visual-viewport shrink/recovery, and restored dashboard scrolling for all roles.
These are local UI checks, not live Supabase or real mobile-device proof.

`node tests/browser/auth-workflows.mjs` uses the same optional Playwright install
as the client workflow runner. It checks actual login/registration at desktop,
tablet, mobile and short viewport sizes, validation/focus/visibility/loading,
duplicate submissions, error recovery, signup metadata and confirmation branches,
Pending/Inactive restrictions, all three Active role routes and restored sessions.
The separate `auth-client.js` fixture substitutes only the local transport, never
the application build. Environment loading is disabled and remote browser requests
are blocked. Screenshots/results are saved to ignored `.client-review/auth`.

Client improvements add `client-improvements.test.js` (search/filter/pages, Manila
evaluation boundaries, bounded file sets and synthetic upload/recovery failures)
and `client-postgres.test.js` (actual M01–M11 on disposable native Postgres, flexible
and legacy coexistence, permission isolation, required revision notes, audit rollback,
archives/full audit filters and three observed separate-connection races).
`initial-schema.test.js` now rehearses M01–M11 and accepts LF/CRLF operator docs.
Existing migration-gate tests also verify M10/M11 preserve invalid legacy rows
while M09 remains deferred. Status contrast probes now assert readable tokens.

Optional `tests/browser/client-workflows.mjs` runs actual React screens in local
Chrome/Edge through Playwright with a synthetic transport and env loading disabled.
See CLIENT_IMPROVEMENTS.md for installation/results/limitations. It never calls
real Supabase, reads credentials or applies SQL. Generated mobile screenshots and
results/tooling stay in ignored `.client-review`. Browser delivery is not policy proof.

Run `npm test` (one run), `npm run test:watch` (local watcher) and `npm run lint`.
Node >=22.12.0 is required; .nvmrc/CI check 22 and 24 (Phase 3 alignment).
Vitest uses its own config and Node environment. Tests replace global fetch with
a throwing stub; the SDK probe supplies its own in-memory response, never a remote
endpoint. Tests do not read .env files. Phase 3 imports the guarded app client
with empty synthetic environment to assert setup-screen rendering without SDK
construction or network (unrelated dashboards mocked). Production demo checks
build in a separate process with env-file loading disabled. See
supabase/tests/PHASE3.md.

`audit-baseline.test.js` retains Manila date and SDK maybeSingle cardinality probes;
its status-token contrast case now asserts readable contrast after this delivery.
Historical characterization probes are not proof of correctness. Required-hours,
zero-row handler and chart probes now
assert desired shared-module/transport behavior in Phase 4 suites; overnight/seconds
calculation moved to actual Postgres RPC tests. Source extraction binds probes to
actual handlers/calculations while Phase 0 forbids application behavior changes.
When a finding is fixed, replace that probe with shared-module or transport tests
asserting the desired result; do not preserve buggy behavior just to keep it green.

| Probe | Finding | Replacement acceptance |
|---|---|---|
| UTC/local reconstruction | INS-012 | Manila date boundaries, actual elapsed instants, overnight lookup |
| computeHours overnight/seconds | INS-016 | Positive valid overnight duration; invalid claims rejected |
| required-hours coercion | INS-018 | Explicit finite range/precision validation, persisted value |
| Zero-row assignment handler | INS-039 | Conflict/error, draft retained, no local success/audit |
| SDK maybeSingle cardinality | INS-011 | Keep SDK limitation check; add DB uniqueness/concurrency suite |
| Month/year chart aggregation | INS-025 | Calendar periods and year-aware sums from shared derivation |
| Token contrast | INS-034 | All supported status/action foreground-background pairs >=4.5 |

`m01-authority.test.js` applies the actual M01 migration to in-memory PGlite using
`../supabase/tests/baseline.sql`, never bootstrap. It tests real PostgreSQL RLS,
grants, triggers and controlled operations against synthetic Auth/Storage tables.
The matrix alone has 1,716 cases; protected-field, RPC and catalog cases supplement
it. `authority-client.test.js` checks returned-record cardinality, target identity,
transport failures and committed bulk outcomes. Remote application HTTP is denied.

Fixture and live test contracts: `../supabase/tests/FIXTURES.md` and `M01.md`.
Local Postgres policy tests are implemented/executed. Supabase services/HTTP, signed
URL delivery, JWT validation and Supabase two-client races remain unverified.
Synthetic browser/keyboard checks are recorded above; other browsers and screen
readers remain unchecked. Build is compilation evidence only; local policy tests do not establish
that deployed grants, functions or bucket privacy match this repository.

Phase 2 adds `attendance.test.js` (Manila dates/clock formatting/elapsed helpers),
`phase2-migration-gates.test.js` (fresh PGlite legacy-preservation/validation gates)
and `phase2-postgres.test.js` (actual native Postgres 17.10, synthetic fixture,
M01-M05, audit/interval/clock/bulk/fault/race cases). Native races deliberately
observe both separate connections waiting before releasing an advisory lock.
Concurrent status/assignment changes are rechecked after lock acquisition.

`disposable-postgres.js` accepts no external connection URL or environment
credentials. It starts its own loopback-only process at a random port, under an
ordinary OS user, never creates an OS account/service, uses an ephemeral synthetic
password and removes only the checked `.test-postgres/synthetic-*` directory after
closing clients/stopping the server. Platform optional binaries/scripts must be
installed; do not disable a failing native suite or count it as passed. No existing
database/bootstrap is used. Local loopback TCP is the only DB network transport.
See `../supabase/tests/PHASE2.md` for exact coverage and pending live checks.

Phase 4 adds `phase4-business.test.js`, `phase4-client.test.js`,
`phase4-migration-gates.test.js` and `phase4-postgres.test.js`: shared target/rubric/
calendar/verified-clearance logic, actual failed assignment handler, upload/link/
feed transports, legacy-preserving M06-M09 gates and native final-stage grants,
RLS, atomic lifecycle, immutable versions, audit faults and seven observed races.
Read `../supabase/tests/PHASE4.md` for scope, pending real API/browser cases and
Storage metadata/physical-byte limitations. No test executes a real project.

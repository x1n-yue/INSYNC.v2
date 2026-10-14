# INSync handover audit and verification

Scope: current working application, owner prompts, meeting notes, client PDF
checklist and decision records. Unrelated working-tree changes, environment,
accounts, assets and reference exports were retained. The latest `figma-redesign`
remains the visual reference; older `figma-auth-ui` was not substituted. Reinspection
confirms reference root `D:\Development\Projects\INSYNC.v2\figma-redesign`, with
entry `src/main.tsx` → `src/App.tsx`. The ZIP's root `src/App.tsx` matches the
folder SHA256; App's `Screen` union is only `login | register`, importing six auth
components. No Admin/Instructor/Intern screens are present in that reference.
Existing redesigned role pages were preserved; the export was not overwritten.
Read [OWNER_HANDOVER.md](OWNER_HANDOVER.md) for operating and acceptance procedures.

## Feature inventory

Working below means **locally implemented and tested**, not deployed acceptance.
Evidence: **U** unit/mocked transport checks; **DB** real isolated native
PostgreSQL/PGlite RLS/transactions (synthetic provider schemas); **B** actual React
browser with mocked transport; **PB** locally served production fixture bundle;
**I** inspected handler/configuration. All rows remain unverified on live Supabase.

| Area / feature | Initial classification | Final classification | Evidence / actual path |
|---|---|---|---|
| Auth login, password visibility, validation, duplicate prevention | Working | Working | B; SDK signInWithPassword |
| Public registration / confirmation / Pending gate | Working | Working | DB+B; signup metadata / handle_new_user / my_profile |
| Role routing / restrictions / persistence / session restoration | Working | Working | DB+B; SDK listener, verified identity, status gate |
| Logout / failed logout / session expiry | Working | Working locally; real expiry unverified | U+B; SDK signOut / Active RPC/RLS checks |
| Password recovery | Missing | Working; email/redirect setup pending | U+B+PB; SDK resetPasswordForEmail/getUser/updateUser |
| Live status/activation notice without JWT refresh | Incomplete | Working | B+I; visible-minute/focus profile refresh, failed authority closes workspace |
| Full-screen auth, stationary branding/right-only registration scroll | Working | Working | B; 13 viewport sizes including desktop errors/short/mobile |
| Admin Overview | Working | Working | B+DB; real counts/error isolation, uptime Unavailable |
| Admin Account Management / activation / role changes | Working | Working | DB+B; admin_update_account and status/assignment restrictions |
| Admin Interns / Instructor/company/section/target | Working | Working | DB+B; admin_set_assignment, no fabricated target |
| Standard checklist attachment | Working | Working | DB+B; attach_standard_docs, missing types only |
| Custom requirement creation | Missing | Working | DB+B+PB; admin_add_requirement, UUID retry, distinct duplicate names |
| Assignment edit buffers after a refresh | Broken: stale untouched fields retained | Working | B+I; only dirty drafts retained; authoritative rows repopulate untouched inputs |
| Master Data create/edit/search | Working | Working | DB+B; RLS/column grants, returned-row confirmation |
| Explicit current-year setup/switch | Incomplete | Working | DB+B+PB; admin_set_current_year, unique marker, no automatic rollover |
| Master archival / impact / historical links | Working | Working | DB+B; expected-reference admin_archive_master |
| Bulk Import page / blank planning templates | Working for templates | Working | U+B; CSV/genuine XLSX, no account mutations |
| Bulk account creation/import | Intentionally excluded | Incomplete: infrastructure/decisions missing; disabled | I; proposal in owner guide |
| Admin Audit Logs / full-history filters/pages/retry | Working | Working | DB+B; audit_history server RPC, trusted/legacy provenance |
| Audit all-history CSV | Working | Working | U+B; existing auditArtifact, explicitly unfiltered |
| Filtered audit PDF/XLSX/CSV | Missing | Working | U+PB; complete matching RPC pages, branding/filter metadata |
| Backup & Security information | Working | Working | B+I; actual role capabilities, no invented backup/uptime |
| Manual snapshots / connected uptime | Intentionally excluded | Incomplete: external infrastructure/decisions missing; disabled | I; proposal and restore responsibility in owner guide |
| Intern My Dashboard / assignment / charts / announcements | Working | Working | U+DB+B; shared metrics, frozen intended recipients |
| Intern My Attendance clock/accomplishments | Working | Working | DB+B; server captured instants, clock_out unverified |
| Attendance filters / correction submit/history | Working | Working | U+DB+B; Manila boundaries, explicit overnight end, failed drafts |
| Informational all-record DTR CSV | Working | Working | U+B; existing owner-scoped complete export |
| Intern My Documents standard/custom upload/replacement/history | Working | Working | DB+B; reserve/finalize/versioned review/private access/recovery |
| Intern clearance requirement dropdown | Missing in client meeting notes | Working | B+PB; ID-based selector, full checklist still authoritative |
| Flexible multi-file submission/revision/history | Working | Working | U+DB+B; separate file sets/versions/events, atomic finalization |
| Intern My Evaluations / read-only criteria/date filters | Working | Working | U+DB+B; persisted server score, Unknown rubric remains unavailable |
| Intern Reports DTR/performance/weekly/document register | Incomplete: disabled cards | Working | U+PB; PDF/genuine XLSX/CSV, complete authorized reads |
| Original document downloads | Working | Working locally; real byte delivery unverified | U+DB+B; authorized 60-second links, not a fabricated archive |
| First version-zero legacy replacement/history | Broken: previous metadata lost from history | Working prospectively | DB+PB; raw unverified snapshot, original review fields/file, scoped access/cleanup protection; no reconstructed past records |
| Instructor Class Dashboard roster/search/section/pages | Working | Working | U+DB+B; complete assigned roster, pagination independent of totals |
| Cleared / At Risk cards and qualifying list/reasons | Working | Working | U+DB+B; shared clearance/D13 rule, Unknown counts |
| Instructor Progress Tracker | Working | Working | U+B; verified target, lifetime vs periods |
| Instructor Evaluations / history | Working | Working | DB+B; authoritative server rubric, UUID retries, failed drafts |
| Instructor DTR Review correction approval/rejection/bulk | Working | Working | DB+B; transactional per-item outcomes, required rejection note |
| Ordinary closed attendance verification | Incomplete: no user-facing review | Working | DB+B+PB; verify_attendance, assigned scope/expected instants |
| Instructor Intern Documents standard/flexible review | Working | Working | DB+B; current version/revision, history retained |
| Instructor Reports | Incomplete: disabled cards | Working | U+PB; class/evaluation/clearance/risk PDF/XLSX/CSV |
| Instructor Announcements individual/active-roster/history | Working | Working | DB+B; frozen recipient IDs, assignments do not broaden old messages |
| Certificate issuance | Intentionally excluded | Incomplete: institutional authority/template missing; disabled | I; informational clearance is not official issuance |
| Responsive shared navigation/forms/dialogs/status/errors | Working | Working | B; 19 destinations × five sizes, collapse/drawer/contained tables |

## Confirmed defects and completed implementation

| Observed failure / expected behavior | Root cause / fix | Regression evidence |
|---|---|---|
| Existing intended reports were disabled | No real builders/formatters; new complete authorized datasets and lazy PDF/XLSX/CSV generation, persisted institution/account details, ranges and Unknown evidence | U: capped-page 501 records / 65 interns, dates, scope failures; PB: all nine categories, real files independently parsed |
| No recovery request or valid-link password form | Missing UI/SDK integration; added conditional request and dedicated recovery route before private role pages, verified current user before update, status unchanged | U+B+PB: validation, duplicate lock, expired link, failure drafts, success/logout |
| Custom documents could not be created from Admin UI | Existing upload/review supports custom identity but provisioning missing; new audited Admin-only idempotent RPC/dialog | DB+B+PB: distinct repeated names, stable retries, unauthorized denials, history retained |
| Closed ordinary attendance could never become verified in UI | Clock-out deliberately unverified; only correction approval supported; new explicit assigned-staff verification of valid closed evidence | DB+B+PB: unassigned/Intern/Pending/stale denial, audit rollback, logged distinct, refresh |
| Year marker only configurable outside the app | Incomplete D14 setup; new explicit serialized/expected-current Admin switch, protected column and one-current index | DB+B+PB: stale/archived/cross-role denial, audit rollback, assignment/history preserved; consolidated stops on conflicting years |
| Refresh preserved stale untouched assignment buffers | Blind merge of prior form values; now preserve only actual dirty drafts and ignore stale retrieval sequence | B+I; existing assignment save/refresh checked, buffers stay editable |
| Late Intern reads could overwrite a successful clock/upload mutation or stale views persisted after staff review | No retrieval generation guard or background refresh; ignore stale reads, invalidate after successful mutation, poll/focus without unmounting drafts | B+PB; reviewed hours update on focus; original cross-role flows retested |
| Report revision reasons rendered undefined | New report consumed wrong risk-reason property; use shared metric's authoritative message | U risk/revision fixture |
| Document register could omit missing committed history/set files | New integration lacked completeness checks; stop with explicit error instead of fabricating complete evidence | U missing-version/manifest failure |
| Class report Unknown total could be misleading | Classification counts were specific to filtered report type; now distinct clearance/risk Unknown counts for full matching roster, confirmed hours and incomplete-total counts | U + parsed PB reports |
| Master create response could append null and claim success | Only error field checked; require returned identity | I+B, no success after invalid response |
| Account status change needed token refresh/reload | Added visible-minute/focus profile check, identity-safe drafts and Pending activation discovery; backend RLS still enforces immediately on requests | B status/identity/draft checks |
| Recovery fields could survive a changed account identity | Key the recovery form by session user ID; discard password/confirmation/error state on identity change, preserving same-account retries | PB: switch recovery session ID, confirm both password fields clear, restore intended user and complete verified update |
| Two audit CSV buttons shared an ambiguous name | Keep existing all-history CSV explicitly labelled separately from filtered report exports | B+PB scope/download checks |
| Lint could scan disappearing native test directories | Ignore disposable `.test-postgres` cache, preserving source checks | Lint; regression suites leave no cluster data |
| First legacy replacement preserved bytes but lost prior file/review metadata from user history | Capture exact known metadata only during the authorized replacement, keep it unverified and outside clearance; add scoped private access and retain immutable snapshot on retries | DB+PB; old file/review preserved, cross-instructor/storage denial, reassignment, no invented committed version/approval; schema missing blocks replacement before mutations |
| Instructor document detail tallied stored legacy Approved as current approval and offered unsupported legacy revocation | Reuse shared valid-current approval calculation, distinguish stored legacy status, and hide revocation without a current version | PB: version-zero Approved contributes zero confirmed current approvals and exposes no Revoke action |
| Multi-table PDF pages drew metadata repeatedly | Paint the branded header once per page; retain repeated table column headers | Independent PyMuPDF parser asserts exactly one generation header per physical page, including document registers |

New dependencies are jsPDF/AutoTable; original React/Vite/Tailwind/Supabase/
Recharts stack and user-added Supabase CLI remain. PDF embeds an Apache-licensed
Roboto font from the official googlefonts/roboto-2 repository; license is
`src/assets/fonts/Roboto-LICENSE.txt`. The report logo adapts the existing INSync
vector mark, with no institutional seal/signature. Entry/configuration files were
edited selectively; reference exports and environment were not overwritten.

## Verification evidence

Current commands, results and browser output paths are recorded below; mocks
are explicitly marked. The final sequential test suite and targeted retests
cover current SQL, initial/historical baselines and retained records. No executable
database test used a live connection string.

- `npm test -- --no-file-parallelism`: **2,336 tests / 23 files passed**, 173.68s,
  after the final legacy-preservation extension, missing-schema upload guard,
  malformed-snapshot rollback and reporting/format refinements.
  Final UI-only recovery identity reset, year-labelled attendance review, current
  document approval tally and PDF header refinement were then verified in the
  production browser runner (report formatter/recovery suite: **21 passed**),
  with current lint/build passes.
- M12 native handover suite: **19 passed**, including current-year, legacy snapshots and original
  standard/custom clearance transition, authorization, stale evidence and audit rollback.
- Consolidated updater: **26 native tests passed**; initial-schema suite **4 passed**.
  Current source is regenerated from M01–M12 final
  catalogs (54 protected-search-path functions, 51 policies, 30 triggers, 10
  standalone indexes, 18 managed tables). Tests install twice on empty supported,
  intermediate and historical catalogs and verify retained records/drift rollback.
- `node tests/browser/auth-workflows.mjs`: **8 grouped checks passed**, no page
  errors; 13 viewport sizes and account/session/registration/error behavior.
- `node tests/browser/redesign-workflows.mjs`: **23 grouped checks passed**, no
  page errors; all 19 destinations at five sizes, navigation/forms/exports/errors.
- `node tests/browser/audit-workflows.mjs`: **14 grouped cross-role checks passed**,
  no page errors; activation, assignments, attendance/corrections, versioned/flexible
  documents, evaluations, frozen recipients and session/draft/error gates.
- `node tests/browser/handover-workflows.mjs --production`: **13 grouped checks
  passed**, no page errors; generated and validated all Intern/Instructor
  categories and Admin audit in all three formats, plus actual new controls.
  **31 download receipts** include the additional date/search/section-filter
  checks. Repeated exports intentionally reuse descriptive filenames; all
  receipts are listed in the ignored results manifest.
  PDFs independently parsed using locally installed PyMuPDF; XLSX ZIP/OOXML
  structure, embedded logo, text ID and numeric fields/print footer checked.
  The class PDF includes the 65th matching Intern, across PDF/UI pages. Reports
  were also exercised with report-page search/section/date filters and failures.
- `npm audit --omit=dev`: **0 vulnerabilities** at validation time.
- `npm run lint`: passed with **0 errors / 0 warnings**, including current source
  and tests; generated fixture bundle/disposable cluster caches are excluded.
- `npm run build`: passed, **1,033 modules**, existing >500 kB main-chunk warning.
- `git diff --check`: passed; existing LF/CRLF conversion notices only.

Reviewed consolidated SQL SHA256 at the handover checks (before the subsequent
trigger-diagnostics update):
`9A5C1683CEFB2E82F271ADC943107582B49D61CD0FBE304C335A2C09B810E74C`.
The later trigger-diagnostics-only SQL regeneration has SHA256
`B17A7B241F35C1BC7D8372E1343601F2FB6406673022E5066D035D531D00A45C`.
It adds actionable error detail/hints without accepting unfamiliar triggers.
After the operator supplied its definition, the narrowly reviewed retention
trigger is recognized and preserved in the regenerated SQL, SHA256
`F6D06F8D32F26DA40E6C0614E6D27661D2F662B6083CBBE129402B868301F354`.
The related five `academic_year_id` columns/relationships and cohort-aware routine
definitions remain prerequisites: this database variant is not yet fully supported.
No live schema change or successful live update is claimed.
No original migrations are marked applied; manual ledger/adoption guidance is
in the consolidated README. Report OOXML uses the existing fflate version as
a runtime dependency; no broad dependency upgrades.

Browser outputs are ignored local `.client-review/auth/results.json`,
`.client-review/redesign/results.json`, `.client-review/audit/results.json`, and
`.client-review/handover-production/results.json` plus fixture files/screenshots.
Optional Playwright resides in `.client-review/node_modules`; it is not a normal
application dependency. Remote requests/env-file loading are disabled in runners.
Some initial browser runs hit short cold-Vite navigation timeouts or mismatched
new test selectors. Navigation startup tolerance was separated from bounded UI
assertions and selectors corrected. No application failure was hidden as success.
The first legacy Storage test also caught a replacement helper with the wrong
function name. The final implementation replaces the actual M10 policy helpers
in place, preserving their identities, existing grants/STABLE semantics and
current/flexible access/cleanup guards; native cross-role reads/deletions passed.

## Remaining prerequisites and acceptance assessment

**Ready for owner acceptance testing**, with local evidence. **Not ready for
completed owner handover** until the owner's live/deployed checklist is accepted:

- No live catalog/ledger, migrations or provider endpoints were changed/verified.
  Apply/rehearse the regenerated consolidated update or reviewed M12 on the
  intended baseline, following its exact operator gates. Multiple current years,
  archived-current years, legacy relationship/identity drift or incompatible
  definitions require explicit reviewed operator resolution—no guessed repairs.
- Auth confirmation/recovery email, redirect allowlist, SMTP, JWT expiry,
  PostgREST embedding/cache, actual private file bytes/signed expiry and
  Storage cleanup must be verified on authorized disposable provider fixtures.
- Deployment and deployed URL smoke tests require separate authorization;
  all local production browser checks used a mocked transport.
- Bulk provisioning, official certificates, app backups and connected uptime
  remain disabled with exact prerequisites/proposals in OWNER_HANDOVER.md.
- Backup/restore proof, named support owner, acceptance sign-off and target-browser/
  screen-reader/real keyboard/device checks remain owner acceptance work.
- Reads remain bounded/count-checked rather than atomic snapshots; PDF 5,000-row
  and font-glyph limits are explicit. No snapshot/scalability/SLA guarantee.
- Existing large main-chunk warning remains; no broad dependency upgrades or
  unrelated refactoring were performed. Historical unknown evidence remains
  untouched; supported correction/resubmission is required for new verification.
  Legacy file metadata already lost before capture was installed cannot be
  reconstructed without actual historical evidence/backups; capture is prospective.

Coordinator follow-up: [M13 implementation, exact operator steps and evidence](supabase/M13_Coordinator_Repair_README.md).
Latest consolidated SQL SHA256 is
`61EAC298FD2AE88D5EA80DB7BC596EC07C9AF058909545F7829EEE97CB08F8AF`,
covering 55 final routines (including controlled retry-safe announcement sending),
with the same 18 tables / 51 policies / 30 managed triggers / 10 indexes.
The earlier hashes/results above remain historical. Current full suite passes
2,365 tests / 25 files; lint/build/whitespace pass. Coordinator/audit/production
fixture browser groups pass 8/14/13 respectively with mocked transport.
Announcements now use the controlled RPC and selection includes only active
assigned recipients. Intern New Submission uses real requirement IDs plus Other;
flexible submissions remain separate from clearance. Live privilege/cache
diagnosis and M13 execution/retesting are still operator tasks. Unreviewed cohort
columns remain a separate consolidated-updater prerequisite; no live claims.

Key handover changes: App/Login/PasswordRecovery, Admin/Instructor/Intern dashboards,
RequirementManager/ReportsPanel, authRecovery/handoverWorkflows/reports/reportFormats,
report logo/font/license, M12 and regenerated consolidated SQL/generator/README,
focused native/report/browser tests, setup/decision/context documentation and this
audit/owner guide. Prior audit documents remain historical and do not override
the current feature/evidence inventory.

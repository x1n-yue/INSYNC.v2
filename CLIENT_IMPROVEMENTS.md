# Client improvements delivery — 2026-10-09

The complete nine-page `INSYNC.UI.Mock(1).pdf` was read, rendered and visually
reviewed before editing. The supplied screenshot and PDF were preserved.
Starting checkout is `3c057ee9335ef7cecb3be750e061d3caf9999c1c`, matching the
previously reviewed revision. No applicable AGENTS.md was found. Existing source,
setup/decision/progress documents, schemas, migrations and disposable test fixtures
were inspected; the old AI context was not treated as authoritative.

## Requests versus implementation choices

Explicit PDF requests: organize large instructor student lists; add evaluation
date filters; accept arbitrary multiple documents without mandatory named types;
require an instructor explanation before requesting revision; simplify redundant
academic-year controls; polish/review Admin master data and audit screens.
Attendance and announcements were generally approved, with useful suggestions
permitted. The PDF screenshots were captured at 80% zoom.

Implementation choices: retain a compact attendance shortcut; search/filter then
paginate; offer 10/25/50/100 rows; use 10 files/50 MiB per flexible set; retain
15-minute reservations and 60-second signed links; archive master entries rather
than erase referenced/history-bearing records; use native accessible dialogs.
These are documented engineering defaults, not additional institutional policy.
Instructor-created requirement templates are not required or introduced.

## Implemented behavior

- Intern dashboard retains assignment, logged/verified hours, target/progress,
  charts, evaluations, announcements and corrections. Today's Attendance uses
  the existing server clock RPCs and opens the existing accomplishment modal.
  Ordinary clock-out still does not verify hours.
- Instructor roster/progress searches name, student ID and company, filters real
  `interns.section_id`, and paginates after filtering. Pages reset on search,
  section, size and navigation changes and clamp when data shrinks. Totals use
  the full authorized roster. Shared count-checked reads detect truncation; the
  existing 50,000-row bound fails explicitly instead of fabricating aggregates.
- Evaluations and DTR use the filtered roster, with paginated records. Bulk DTR
  selection says that it spans pages/filters; page selection adds only displayed
  Pending items up to the server's 100-item limit. Individual outcomes and failed
  note drafts remain preserved. Dashboard attention is derived from existing
  risk, pending corrections and unfinished/revision documents, showing at most
  five interns. It creates no stored alerts and adds no risk threshold.
- Intern evaluations offer All, This Week, This Month and inclusive Custom range.
  Dates are Asia/Manila, weeks Monday–Sunday. Invalid/reversed ranges show an
  error, counts and empty states are explicit, ordering/criteria/feedback/evaluator
  identity remain intact. Invalid legacy scores still display Unavailable.
- Admin adds a section selector using `admin_set_assignment`; account search and
  assignment lists paginate. Activation, deactivation and archival have distinct
  labels. Reference-impact inspection plus typing `ARCHIVE` confirms archival;
  a changed reference count aborts the server operation. Current academic years
  cannot be archived. Existing company/section links are retained, dependent data
  refreshes, and archived entries cannot receive new assignments. Existing links
  remain visible in their assignment selector until explicitly changed.
- Audit history uses `audit_history`, filtering the entire authorized history by
  actor name/UUID, action, category and inclusive Manila dates. Each server page
  includes an exact count and orders by `(created_at DESC, id DESC)`. It is not
  limited to the latest 50. The overview intentionally shows a recent preview;
  audit CSV still uses its existing complete count-checked export protocol.
  Legacy provenance is never promoted to trusted provenance.
- UUID-addressed personal/roster announcements and frozen audiences remain in
  the existing schema/RLS. Sending disables duplicate actions and keeps failed
  drafts. No notification delivery integration was added.
- Changed forms have labels, visible focus and readable status colors. Native
  dialogs provide focus containment, background inertness, Escape, scroll bounds
  and focus restoration. Mobile overflow navigation uses the same dialog. Tables
  scroll inside their containers; forms/cards wrap at normal zoom. Toasts have
  live-region roles and sit above mobile navigation.

## Flexible submissions and legacy compatibility

Flexible submissions are independent `submissions`, `submission_versions`,
`submission_files` and `submission_reviews` tables. An Active Intern supplies a
1–200-character title, optional description up to 2,000 characters and a complete
set of 1–10 files. Each file must be PDF/JPEG/PNG, nonempty and at most 10 MiB;
the complete set is at most 50 MiB. File counts and total sizes are bounded on
both client and server. Original filenames are metadata, never supplied paths.

`stage_submission` takes an attempt UUID for idempotent reservation/reconciliation
and generates every object path. The browser uploads sequentially with per-file
completion progress (not byte-level progress). Finalization checks every reserved
file and exact Storage MIME/size metadata, expected submission version and review
revision, then commits the set atomically. No partial set can become reviewable.
Storage remains private; overwrites and committed-file deletion remain denied.

Assigned Active instructors (and existing authorized Admin review scope) review
the explicitly identified current committed file set. Request Revision requires a
trimmed nonempty explanation up to 500 characters. Reviewer UUID, server timestamp
and explanation are visible to the intern. A replacement is a new version,
resets current review to Pending, and retains previous files/title/description,
reviewer identities, times and append-only events. A concurrent review or upload
causes stale operations to fail instead of silently overriding evidence.

Ambiguous reservation responses retry the same attempt UUID. Known SQL reservation
rejections leave the draft editable; uncertain outcomes keep the attempt for
reconciliation. Finalize failures/lost responses call `cancel_submission` before
any Storage cleanup: committed outcomes are recovered without removal. Only an
Active owner may cancel/remove abandoned uncommitted objects through Storage API.
Uncertain or failed cleanup stays recoverable; owner recovery lists omit confirmed
absent abandoned objects. Committed history is never cleaned up. Browser reads
also reject incomplete/mismatched version/file/review relationships.

The original `documents`, `document_versions` and `document_review_events` are
untouched. They remain accessible under **Legacy clearance requirements** with
the existing M08 upload/review/access protocol. No requirements, categories,
files, approvals or historical records were converted, renamed or discarded.

**Flexible approvals do not satisfy clearance.** Clearance still requires a valid
persisted hour target met by verified hours, all four standard types (`moa`,
`endorsement`, `consent`, `medical`), and approved current evidence for every
standard/custom requirement. Unknown/legacy evidence remains unknown. Changing
this institutional clearance policy requires a separate explicit decision.

## Exact migration application order

No SQL was applied to a real Supabase project. No push, merge or publication was
performed. These are reviewable deliverables for an authorized operator.

For a genuinely new empty project, review and apply once, as postgres:

1. `supabase/initial_schema.sql`
2. `supabase/migrations/M01_authority.sql`
3. `supabase/migrations/M02_trusted_audit.sql`
4. `supabase/migrations/M03_attendance_integrity.sql`
5. `supabase/migrations/M04_private_documents_bucket.sql`
6. `supabase/migrations/M05_validate_attendance.sql`
7. `supabase/migrations/M06_rubric_hours.sql`
8. `supabase/migrations/M07_account_lifecycle.sql`
9. `supabase/migrations/M08_document_versions.sql`
10. `supabase/migrations/M09_validate_domain.sql`
11. `supabase/migrations/M10_flexible_submissions.sql`
12. `supabase/migrations/M11_admin_history.sql`

For an existing project, inspect catalog/ownership, policies, migration ledger,
row/object counts and anomalies using the existing runbook. Do not replay initial
schema or committed migrations. M10 needs the installed M01–M04/M06–M08 contracts,
the exact private bucket MIME/10 MiB settings and `storage.objects.metadata` JSONB
size/mimetype contract. M11 requires M10 and the existing trusted audit/assignment
helpers. Apply missing prerequisites in their documented dependency order, then
**M10 followed by M11**, before deploying this client. Existing M05/M09 historical
validation gates may remain deferred; these new migrations neither repair nor
validate that history. All prior migration files are unchanged.

Review all Storage policies, other-bucket DELETE grants and helper ownership
before rehearsal. Run disposable Auth/PostgREST/Storage checks with real provider
metadata before authorized rollout. Record reviewed migration hashes. If a file
fails, stop and roll back its transaction. After commit retain evidence/audit,
disable affected flows if necessary and forward-repair; never restore public
Storage, raw protected writes or discard committed history. Human Mxx labels
are not automatically discovered Supabase CLI timestamp migrations.

## Validation

Final results are recorded in FIX_PROGRESS.md and the request checklist. The local
suite executes actual migrations in synthetic PGlite and loopback-only native
Postgres. New coverage includes filters/pages/Manila boundaries, section scope,
multi-file/legacy coexistence, inactive/foreign access, partial failure/recovery,
required explanations, audit rollback and three observed separate-connection
review/replacement/cancel races. Fresh initial-schema rehearsal now includes M10
and M11. The operator-bootstrap test accepts both LF and CRLF documentation.

Optional browser harness:

```powershell
npm install --prefix .client-review --no-save playwright
node tests/browser/client-workflows.mjs
```

It uses local Chrome/Edge when installed, otherwise Playwright's installed
Chromium. Vite runs with `envFile: false`; the real Supabase client is replaced
only inside this harness. It blocks remote browser requests and uses synthetic
accounts/documents. Outputs are ignored `.client-review/browser-results.json`
and mobile screenshots. This is real browser/UI evidence with a fake transport,
not live authorization or file-delivery proof.

## Limitations and recommendations

- Real Supabase Auth/JWT, deployed RLS/HTTP RPC shapes, MIME enforcement, signed
  file bytes and Storage API byte removal remain unexecuted. Native tests model
  provider metadata. MIME/size checks do not scan contents for malware.
- Count-checked roster/history reads are not a transaction snapshot; equal-count
  changes can evade count checks. Audit ordering is deterministic per page, but
  concurrent insertions can shift offset pages. Loaded metrics require refresh;
  no automatic stored-alert generation or new deadline model exists.
- Academic years have no assignment/cohort FK. Current-year selection/uniqueness
  is not implemented by M01–M11; the old D14 claim was aspirational. The UI now
  labels zero/multiple current flags as setup required/ambiguous. An atomic year
  configuration/cohort-history feature is a separate recommendation.
- Native dialogs were verified in Chrome; other target browsers and screen
  readers need separate checks. The existing large application bundle warning
  remains; no broad refactor was undertaken.
- Imports, unsupported reports/certificates, manual backups and uptime monitoring
  stay explicitly unavailable. No Express backend, new role, email/SMS/push or
  real-time messaging was added.

## Changed-file inventory

UI: `src/components/{AdminDashboard,InstructorDashboard,InternDashboard,Modal,
Shell,Toast,DocumentActions,Submissions,ListControls,DateFilters,AuditHistory}.jsx`,
`src/index.css`.

Shared helpers: `src/lib/{authority,documents,submissions,lists}.js`.

Database: `supabase/migrations/M10_flexible_submissions.sql`,
`supabase/migrations/M11_admin_history.sql`; prior committed SQL remains unchanged.

Tests: `tests/client-improvements.test.js`, `tests/client-postgres.test.js`,
`tests/initial-schema.test.js`, `tests/phase4-migration-gates.test.js`,
`tests/audit-baseline.test.js`, `tests/browser/{synthetic-client.js,
client-workflows.mjs}`; `eslint.config.js` includes the browser runner's `.mjs`.

Documentation: this file, `CLIENT_REQUEST_CHECKLIST.md`, `DECISIONS.md`,
`FIX_PROGRESS.md`, `README.md`, `WEB_SETUP.md`, `AI_CONTEXT_PROMPT.md`,
`supabase/RUNBOOK.md`, `supabase/migrations/README.md`, `tests/README.md`.
`.gitignore` excludes temporary PDF renders/browser tooling and artifacts.

# Instructor At Risk / Cleared cards — 2026-10-13

## Implemented rules

Both cards consume **`internMetrics`**, the existing shared calculation used by
all three roles. No new clearance formula or database policy was introduced.

- **Cleared:** valid verified hours meet the saved target; MOA, Endorsement,
  Consent and Medical exist; every current standard/custom requirement has valid
  current-version approval. Ordinary logged hours and flexible approvals do not
  qualify. Duplicate requirement types, version-zero approval, missing/invalid
  reviewer/time/path/attendance or failed retrieval remain Unknown.
- **At Risk:** reuse the existing **DECISIONS.md D13** rule: known verified-hours
  shortfall plus either a current Needs Revision clearance requirement or at
  least seven Asia/Manila calendar days since the last valid closed attendance.
  The shared helper now returns the actual supporting reason(s), without changing
  its classification. Ordinary incomplete/Pending requirements, low progress,
  missing evaluations and open sessions do not independently create risk. Missing
  prerequisites and absence of both a valid attendance history and revision
  evidence remain Unknown under D35.

No saved clearance-requirement deadline exists in the current initial schema or
M01–M11. Upload-reservation `expires_at` is a 15-minute technical receipt lifetime,
not an academic deadline. The proposed overdue-requirement rule was therefore
**not substituted for D13**, and no deadlines, pace targets or policies were
invented. The concrete future proposal below is unimplemented.

## Why the cards were unavailable

They already called shared calculations, but the summary converted the entire
card to Unavailable if **any** intern was Unknown. A global error also included
unrelated company/section lookup failures. New summaries retain each confirmed
classification and show **“Unknown: N · total incomplete.”** A zero with unknown
records is labelled **“0 confirmed,”** rather than a completed zero. Failed roster
membership retrieval is Unavailable, since its total cannot be known. A successful
empty roster is confirmed zero.

## Data, interaction and refresh

- Count distinct intern UUIDs in the **complete authorized assigned roster**;
  search, sections, visible pages and repeated display names do not redefine totals.
- Reuse `completeRows`/count-checked keyset reads and existing RLS/Active account
  checks. Counts use selected metadata from current `documents` and attendance;
  they fetch no private file contents or signed URLs. Historical approval rows
  and flexible submissions are not inputs to clearance. The M08 review/finalize
  operations enforce current version/revision and reset a replacement to Pending.
- Keyboard-accessible cards filter Class Roster to qualifying interns. At Risk
  rows identify revision requirements or last-attendance reason, and both lists
  link to the selected intern's requirements. Card selection combines with existing
  search/section filters, resets pagination and can be cleared with Show all interns.
  Unknown interns are excluded from confirmed lists with an incomplete-list note.
- Visible help text/tooltips explain both rules. Existing navy/teal cards, tables,
  icons and responsive navigation are preserved; tables scroll within their panel.
- Successful document review updates metadata immediately, then reconciles via
  a forced background read; correction review rereads attendance through its existing
  handler. Returning to Class Dashboard, window focus/visibility, explicit Refresh
  workspace, and a 60-second visible-window poll retrieve external verification,
  replacement, assignment and target changes. Hidden windows do not poll. Background
  requests retain forms/selected intern and stale responses cannot replace newer
  reads. Polling is retrieval freshness, not a simulated operation or live subscription.
- Company/section/evaluation/flexible-submission errors remain separately visible
  and do not erase valid clearance/risk counts. Evidence errors offer Retry and
  preserve Unknown classification and useful console diagnostics.

Reads retain the existing 50,000-row bound and count checks. They are not a
transactional cross-table snapshot; concurrent equal-count edits can escape the
existing detection. Refresh/review version guards and RLS remain authoritative.
No Supabase publication or service setup is required for the polling mechanism.

## Concrete configurable-deadline proposal — not implemented

This proposal would require a separate policy decision approving replacement or
coexistence with D13 before authoring/applying a migration:

1. Add nullable **`due_date date`** and **`deadline_revision bigint`** to each
   standard/custom `documents` requirement, keyed by its requirement UUID (not
   name). Do not attach deadlines to flexible submissions. Leave every historical
   row NULL; no inferred dates, automatic rollout or backfill.
2. Proposed semantics: a date is inclusive through the end of that **Asia/Manila**
   business day. An unapproved requirement becomes overdue only when
   `due_date < Manila_current_date`. Today/future dates are not overdue. Missing
   or invalid deadlines on unapproved requirements remain Unknown. Valid current
   approval satisfies the requirement even if its original due date has passed.
3. Proposed configuration authority: Active Admin only through a controlled,
   expected-revision-checked RPC, such as `admin_set_requirement_deadline`.
   Instructors read only assigned requirements; interns read only their own.
   No new broad writes, service-role frontend key or client authority claims.
4. Retain previous/new date, requirement UUID, reason, actor and server time in
   append-only deadline history with trusted mandatory audit. A deadline change
   cannot alter file versions, approvals, hours, assignments or historical records.
5. Policy decisions still required: who sets dates, whether different interns
   may have different dates, how extensions are approved, and whether D13 remains
   visible separately. No default deadline, grace period or term/cohort inference
   is proposed as implemented institutional policy.
6. Once approved, add a reviewed migration at the next unused version, rehearse
   RLS/revision/audit/history behavior in an isolated database, and test Manila
   midnight, past/today/future/null dates, replacement, incomplete evidence,
   repeated names, cross-instructor access and partial Unknown counts. Apply to
   a live project only through separately authorized operator setup.

No migration is required for the implemented cards. Existing M01–M11 contracts
must be deployed as documented; this work applied no live SQL and did not change
schema, RLS, RPC grants, Storage policies or historical records.

## Validation and files

New focused checks:

- `tests/instructor-cards.test.js`: 24 cases covering shared clearance/risk,
  exact target, logged/verified distinction, missing types, Pending/replaced and
  custom requirements, flexible-only absence, Unknown evidence/duplicate types,
  seven-day Manila boundary, revision reasons, unsupported hypothetical deadline
  fields, distinct IDs, filtering/pages and zero versus unavailable.
- `tests/instructor-cards-postgres.test.js`: three actual isolated PostgreSQL
  cases. Controlled correction verification and four private metadata-backed
  approvals qualify an assigned intern, RLS excludes an equally cleared foreign
  intern, actual replacement makes current approval Pending while keeping history,
  stale review fails, and requirement deadlines are confirmed absent. The harness
  normalizes pg DATE output to the YYYY-MM-DD shape sent by PostgREST.
- `tests/browser/instructor-cards.mjs`: seven actual-React browser groups with
  an explicitly **mocked** Supabase transport, env files disabled and remote
  requests blocked. Includes 65-row counts, Unknown: 3, multiple pages, keyboard
  cards, search/section combination, mobile width, partial/all failures and Retry,
  selected-intern retention, review and external-change refreshes, and empty roster.

Validation results:

| Check | Result |
|---|---|
| `npm test` | **2,265 passed across 19 files**, including actual isolated PostgreSQL policy/migration/fault/race checks |
| Final focused card/shared-business tests | **61 passed across three files** |
| `npm run lint` | Passed, zero errors/warnings |
| `npm run build` | Passed, 779 modules; existing >500 kB chunk warning remains (~1,003.75 kB largest JS, gzip ~287.98 kB) |
| `node tests/browser/instructor-cards.mjs` | Seven mocked-transport groups passed, no browser exceptions |
| Existing client/browser regression | 12 client groups, 23 redesign groups (all 19 destinations at five sizes), and 14 audit workflow groups passed, no browser exceptions |
| `git diff --check` | Passed; existing LF/CRLF conversion notices only |

Saved-deadline overdue/future workflows cannot be
tested as live application features because no such model exists; tests verify
that hypothetical/missing fields do not silently create that unsupported rule.

Changed implementation: `InstructorDashboard.jsx`, `UI.jsx`, `index.css`,
`lib/metrics.js` (supporting risk reasons), new `lib/rosterMetrics.js`, and
`lib/workflows.js` (optional metadata column selection). The three focused test
files and this document were added; README, DECISIONS, FIX_PROGRESS and tests README
link the extension. Existing authentication, unrelated working-tree changes,
current design reference, package files and database definitions are retained.

**Live Supabase verification was not performed.** Local SQL validates repository
definitions; browser mocks validate UI/handler integration. Neither proves live
JWT/Auth/PostgREST, deployed policies, file delivery or production readiness.

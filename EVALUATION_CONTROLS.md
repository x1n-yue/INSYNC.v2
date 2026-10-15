# Evaluation controls and Supervisor layout — M16

Current paper fallback: [Company Attendance Sheet guide and M17 rollout](COMPANY_ATTENDANCE.md). This replaces the offline/PWA attendance proposal. Local preparation only; no live migration, reset or deployment.

Prepared locally on 2026-10-14. This follow-up preserves the [M15 workflow,
four-role permission matrix and assignment rules](SUPERVISOR_WORKFLOW.md).
No database reset, live migration, deployment or real-student evaluation occurred.
The user-confirmed deployment target remains `tcntyrwwqzyyqlzdtuer`; the stale
local CLI link is unchanged. Live catalog and acceptance checks remain pending.

## Changes and user guide

Supervisor Assigned Interns and Evaluations now use the existing dashboard page
container: 32px desktop padding, 24px tablet and 16px mobile horizontal padding,
with a 1400px maximum width. Headings, descriptions, tabs, editors and results
align. New Evaluation is a primary heading action; refresh/search/page controls
belong to the relevant results card. Empty and filtered-empty states are distinct,
with contained pagination only for nonempty results. No-assignment/error/loading
states give accurate guidance and disable creation. Submitted history remains
readable when an assignment ends. Source detail dialogs wrap stable identifiers.
The navy/teal sidebar, top navigation and unrelated role pages keep their styles.

Both evaluators use shared native 1–5 radio buttons. Tab enters a criterion;
arrow keys change its single selection, and focus has a visible outline. The
existing scale is Poor, Fair, Satisfactory, Good, Excellent. The criterion weights
remain 25/35/20/20. The intern selector remains a dropdown. Partial Supervisor
drafts can be saved; submission needs all four ratings, an explicit current
assignment and an eligible assigned Coordinator. Submitted sources remain locked.

Coordinator: open Review and simplify. The original source ratings, score and
private feedback appear as a read-only reference. Final controls start from the
actual submitted ratings. Select supported observations under Strengths, Areas
for improvement, Recommended actions or guidance, and one Overall feedback.
Selections produce fixed, readable sentences; they never infer observations from
ratings. No additional concerns/actions are exclusive choices; conflicting
observations are disabled. Clear a conflicting choice before selecting another.
Additional Remarks is optional. A standard review needs no typing.

Changing any rating requires a separate reason for that criterion: reviewed
criterion-specific evidence, clarification with the Supervisor, or Other.
Other requires a meaningful 10–500-character explanation containing letters.
Nothing selects a reason automatically. Original/final values, reason and
responsible Coordinator are retained privately in immutable adjustment events.
If combined explanations exceed M15's 2000-character compatibility field, that
field contains a short criterion/reason overview; the structured reasons and
immutable events retain each complete explanation without truncation.

Save Draft restores ratings, choices, remarks and reasons. Existing written drafts
open in written mode without automatic conversion; Use selectable feedback is
explicit. Saved written fields are retained separately when converting, and
Use written feedback restores that saved version. Previous generic explanations
remain available privately, but changed ratings need current per-criterion reasons
before another save/publication. Published legacy evaluations are untouched.

Preview uses the same final component as Intern My Evaluations. Any edit clears
the preview. Publish checks the exact preview fields against server-generated
text before creating the unique published final. Intern queries/exports continue
to read only own published finals/legacy rows; private choices, source feedback,
drafts and adjustment reasons are never copied into final rows.

Scores remain `round(sum(rating × weight) / 5)` on the server (0–100), with an
identical client preview. State/version/revision checks, company/assignment scope,
inactive-account rejection, duplicate prevention, reports and audit rules remain.
Time Log Exception Request controls and mutation grants remain retired. Clocking,
accomplishments, closed-attendance verification, hours, filters and DTR exports
remain available under the existing permissions.

## Changed files

- UI: `SupervisorDashboard.jsx`, `EvaluationWorkflow.jsx`, shared
  `EvaluationRatings.jsx`, `CoordinatorFeedback.jsx`, and scoped `evaluation.css`.
  `UI.jsx` adds optional empty-state actions; `Modal.jsx` adds an optional scoped
  class. Audit history recognizes private adjustment events.
- Templates: `src/lib/evaluationFeedbackCatalog.json` and `evaluationFeedback.js`.
  The committed catalog is mirrored in M16 and checked for exact parity by tests.
- Database: `supabase/migrations/M16_evaluation_controls.sql`; offline generators
  and regenerated consolidated/fresh SQL; read-only inspection 08.
- Validation: `tests/evaluation-controls.test.jsx`,
  `tests/evaluation-controls-postgres.test.js`, browser workflows/fixture,
  and updated fresh/consolidated catalog assertions.
- Context/handover/setup documentation links this guide. Unrelated existing
  working-tree changes remain uncommitted and preserved.

## Database and rollout

M15 is unchanged, SHA256
`d7739e22e31ad6cd535e708b7e4a9dea66d3d4849530cde9a5f8fa834837a03b`.
Prepared M16 SHA256:
`5f520d4aca5b5cfdf8abbcd2043fc9d98475f2149775d52ea51da88a3717bab6`.
M16 adds private review metadata and adjustment-event history, feedback validation
helpers, a controlled `save_evaluation_review_v2` RPC, and a hardened existing
writer. It does not backfill historical feedback or remove records/tables.
Existing RLS/assignment checks, trusted audit, grants and safe search paths are
retained. Events permit scoped SELECT only and reject updates/deletes.

1. Obtain explicit rollout authorization, verify the target banner/connection and
   reviewed M15 catalog/ledger, and take a provider backup. Run inspection 07 and
   [08 evaluation controls](supabase/inspection/08_evaluation_controls.sql) read-only.
   Never use the stale CLI link or an old reset script.
2. Rehearse on an isolated copy. If M15 is absent, apply its reviewed prerequisites
   and M15 first. On a reviewed M15 installation, apply **M16 before the new client**.
   Use the trusted `postgres` operator and record the reviewed migration/hash.
3. The existing M15 client can still save/publish written reviews with unchanged
   source ratings. Its generic rating-change reason cannot bypass M16: changed
   ratings require structured reasons/new client. Previously published records
   remain readable. Coordinate the short client upgrade window accordingly.
4. After separately authorized client publication, test synthetic accounts and
   assignments on the verified target. Do not publish to real students for tests.
   Verify Auth, RLS, RPC grants, privacy, exact preview and ordinary attendance.

The supported consolidated updater already includes final M01–M16 definitions;
do not apply it and then replay M15/M16. Fresh SQL is only for a verified empty
project. Offline default fresh generation executes no SQL and does not prepare
reset files. Current generated catalog: 23 application tables, 71 public routines,
55 public + 8 Storage policies, 41 public + one Auth trigger. Unknown catalog
drift still aborts the consolidated updater for operator review.

## Verification evidence

All validation here uses synthetic local fixtures. Native PostgreSQL tests execute
real RPCs, RLS, grants, trigger/audit failure rollback and assignment changes;
browser tests render the actual React app with a synthetic transport and block
remote requests. Browser fixtures do not establish live Supabase authorization.

Focused coverage includes native radio semantics, missing ratings, restoration,
actual source defaults, typing-free publication, deterministic catalog parity,
conflict rejection, preview mismatch rejection, per-criterion reasons, original
and final score separation, immutable history, legacy written-draft retention,
private access denial, rerouting and unchanged correction retirement.

Rendered evidence is saved locally under `.client-review/evaluation-improvements/`.
Checks cover 1920px desktop, 768px tablet, 375px phone, collapsed/expanded sidebar,
empty/populated/filtered/loading/error states, source forms, read-only details,
feedback/preview, keyboard focus and overflow. The 200% check uses 960×540 CSS
pixels at 2× device scale on a 1920×1080 viewport: equivalent reflow, not automated
browser-toolbar zoom. Screenshot review supplements geometry assertions.

Remaining setup: authorized target-catalog review and rollout, followed by live
credentialed acceptance. No new service, key, frequency policy or feedback catalog
configuration is required. Test/build results are recorded in FIX_PROGRESS.md.

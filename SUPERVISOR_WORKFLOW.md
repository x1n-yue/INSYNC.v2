# Supervisor evaluations and correction retirement — M15

Current workflow: [Supervisor logbook submission and M18 rollout](LOGBOOK_ATTENDANCE.md). Supervisor uploads signed paper evidence; the assigned Coordinator encodes and uses **Verify & Record Attendance** once. This supersedes new Coordinator uploads under M17. Historical records remain unchanged. Local only: no live migration, reset or deployment.


Previous M17 fallback (new-entry workflow superseded by M18): [Company Attendance Sheet guide and M17 rollout](COMPANY_ATTENDANCE.md). This replaces the offline/PWA attendance proposal. Local preparation only; no live migration, reset or deployment.

Current follow-up: [shared ratings, selectable feedback and Supervisor layout](EVALUATION_CONTROLS.md). Additive M16 and the matching client are prepared locally; M15 remains unchanged. No live migration, reset or deployment was performed.

Current instruction, 2026-10-14: upgrade the existing deployed app locally, with
additive migrations. The user explicitly authorizes Supervisor, superseding the
old three-role limit. No reset, remote migration, deployment or real-student
evaluation is authorized or performed. The user confirms the deployment target
as `tcntyrwwqzyyqlzdtuer`. Read-only Supabase CLI 2.120.0 project listing confirms
that reference is available and ACTIVE_HEALTHY. The local CLI link still points
to `upnkotnmoeaykummcnlx`; it was left untouched. Do not use bare `--linked`
commands. Remote catalog, migration ledger and credentialed acceptance remain
unverified. Historical reset/new-project instructions do not authorize this rollout.

## Role permissions

| Capability | Admin | OJT Coordinator (effective `instructor`) | Supervisor | Intern |
|---|---|---|---|---|
| Public registration | Pending Intern only | Pending Intern only | Pending Intern only | Pending Intern only |
| Role/status and company management | Controlled lifecycle RPC, last Active Admin retained | No | No | No |
| Assign Coordinators / Supervisors / interns | Yes, stable UUIDs | No | No | No |
| Intern records | Existing Admin scope | Existing assigned roster | Explicit assigned Active interns; UUID/name/student ID/company only | Own records |
| Source evaluation | Audit oversight | Routed submitted source, also current assigned intern/company scope | Own drafts and immutable submissions | No |
| Review draft and rating explanation | Oversight / explicit rerouting | Routed authorized sources | No | No |
| Publish final | No ordinary creation/publication | Authorized manual review, server score | No | No |
| Published evaluations | Existing oversight | Current assigned roster | No final report permission | Own only |
| Documents / valid closed attendance review | Existing permissions | Existing assigned permissions | No | Own documents; own clocking/accomplishments |
| Announcements | Existing controlled assigned audience | Existing controlled assigned audience | No | Existing own recipient feed |
| Exports | Existing audit/templates | Existing assigned informational PDF/XLSX/CSV | None | Existing own informational reports and DTR |
| Correction mutations | Retired | Retired | None | Retired |
| Historical corrections | Existing authorized read/audit | Existing assigned read | None | Own historical read through RLS; no active request UI |

Pending/Inactive accounts retain the existing status-only gate. Public metadata
never grants effective staff roles. No service-role key or external AI is used.

## User guide

Admin: provision an account through existing Register/activation, or promote an
existing eligible account in Account Management. Select Supervisor and its
company, then save. In Interns, configure each intern's company and Active OJT
Coordinator using the existing assignment control. Under Supervisor assignments,
choose a Supervisor and an Active intern in that same company and assign explicitly.
Several Supervisors may share a company; membership itself grants no intern access.
The same intern may have multiple explicit Supervisors. No exclusive assignment
policy or evaluation frequency/deadline is introduced.

End affected supervision links explicitly before changing company, role or
Active status. Ended links retain assigning/ending actors, dates and company.
Existing Coordinator lifecycle restrictions and last-Admin protection remain.
Archive-impact inspection counts Supervisor memberships, supervision history,
and source-company references as well as existing intern links.

Supervisor: Assigned Interns shows the authorized minimal roster. Evaluations →
New Evaluation selects one intern and a Manila evaluation date. Rate the existing
four criteria (1–5): Punctuality & Attendance 25%, Task Performance & Quality 35%,
Professional Conduct 20%, Communication Skills 20%. Enter personal feedback.
Save Draft allows partial ratings; Submit requires valid complete ratings and an
Active assigned Coordinator. A missing Coordinator gives an actionable error and
preserves the draft. Server-derived source score, assignment, company, identities,
rubric, version and submission timestamp are retained. Submitted History is locked.

Coordinator: Evaluations replaces the ordinary new-evaluation form. Awaiting
Review shows routed sources; Coordinator Drafts and Published History are separate.
Existing roster search/section filters apply before pagination; evaluation search
and pages apply within the chosen state. Open Review and simplify to read the
original ratings, score and private feedback. M16 adds selectable observations and
deterministic student-facing feedback, with optional remarks; saved written drafts
remain readable/editable in written mode. Ratings initially copy the source; any
change requires a separate explicit reason for each criterion. Save Draft preserves the
private review. Preview Intern Evaluation shows only final ratings/score and the
student-facing fields. Publish is enabled after preview; editing clears preview.
Publication atomically creates one final per source/version with an authoritative
server score. Repeating the exact submission/publication request returns the
same record; conflicting content and stale versions/revisions fail.

Intern: My Evaluations, latest score, dashboards and reports read only
`evaluations`, which now contains published finals and retained legacy rows.
New finals are labeled Reviewed Supervisor evaluation; existing rows are labeled
Legacy Coordinator evaluation. No historical Supervisor is invented. The four
student-facing text fields are visible; original feedback, Coordinator drafts and
internal rating explanations are stored elsewhere under RLS and never fetched
for Intern exports. Existing score/Unknown evidence handling and date filters remain.

Staff evaluation exports retain PDF/XLSX/CSV and show final-score provenance and
an additional authorized submitted-source score table. Unpublished sources are
clearly distinguished and never used for latest scores or Intern aggregates.
Server RLS determines which historical sources remain accessible.

## Provenance and assignment changes

Submitted sources cannot be edited/deleted, including by ordinary privileged SQL
updates. Final rows are immutable. Coordinator/company identities in a source
never change automatically. Coordinator access requires both its routed review
and its current assigned Active intern in the original company. Reassignment
immediately removes the old Coordinator's private-source/review access; the new
Coordinator receives no private source automatically. Published finals continue
the existing own/current assigned staff visibility.

Admin oversight allows explicit rerouting of an unpublished source to the
intern's current Active Coordinator, only while the original company still matches.
The Admin supplies a reason and expected revision. Rerouting clears the previous
draft/adjustment reason, restores original ratings, increments revision and appends
an immutable-by-client routing event. Source identities/version remain unchanged.
If the intern changes company, private historical sources remain available to
their original Active Supervisor and Admin; publication/rerouting is blocked while
company differs. No company conversion or silent ownership transfer is implemented.
An old draft tied to an ended assignment cannot submit under a new assignment;
start a new evaluation after Admin resolves the assignment.

## Retired attendance feature

Removed from active React UI: Intern Time Log Exception Request form/history,
submission handlers, Coordinator DTR Exception Queue, selections/bulk review,
review-note field and correction-only activity panel; computed pending-correction
attention/counts and correction instructions. No replacement attendance editing
policy is introduced. There was no separate active correction export option or
email/push notification service in the inspected current client.

M15 revokes PUBLIC/anon/authenticated execution of `submit_correction`,
`review_exception`, `review_exceptions`, and the old direct `submit_evaluation`.
It also clears correction table/column mutation grants. Old clients/direct API
calls cannot create/review corrections. Historical tables, requests, review notes,
audit events, timestamp validators and shared integrity/audit triggers survive.
Existing authorized historical reads are retained. Trusted internal routine
dependencies are not dropped.

Clock In/Out, accomplishments, DTR filters/records/exports, logged versus verified
hours and authorized verification of valid closed attendance remain. Unknown
legacy evidence stays Unknown and cannot be verified; no manual repair policy is added.

## Database and rollout

1. Do not deploy automatically. Before operator-authorized rollout, verify the
   Dashboard project banner/URL and migration ledger for `tcntyrwwqzyyqlzdtuer`.
   Reconcile the stale local CLI link separately; never run a bare linked push.
   Review a provider backup/restore point and capture read-only catalog/counts
   with [inspection SQL](supabase/inspection/07_supervisor_workflow.sql).
2. A deployed database already at reviewed M01–M14 final contracts uses only
   [M15](supabase/migrations/M15_supervisor_evaluations.sql). M05/M09 may remain
   deferred under their existing historical gates. Review function owners,
   grants, role CHECK name/definition, RLS and extra exposed RPCs/views first.
   Drift is a stop for review, never authorization for a reset or guessed repair.
3. Older supported catalogs may instead use the regenerated
   [consolidated updater](supabase/INSync_Consolidated_Update.sql), which installs
   final M01–M15 contracts, retains historical validation, and was rehearsed as
   repeatable locally. Do not run M15 again after that updater. New empty projects
   can use the regenerated [fresh installer](supabase/INSync_Fresh_Install.sql),
   or initial_schema followed by M01–M15 in order. Never run a fresh installer
   against the deployed database. Historic source migration files remain unchanged.
4. Coordinate a short maintenance window and require client refresh. Schema first
   closes correction/direct-evaluation mutation access: an older loaded client
   can still clock, view finals and verify eligible attendance, but its obsolete
   correction/evaluation controls will receive permission errors. Apply reviewed
   SQL transaction as trusted postgres, record SHA256/migration ledger, reload
   PostgREST cache, verify unchanged historical counts and denied old RPC grants.
5. Publish the new client only after separate explicit deployment authorization.
   Configure the same-project public URL/key in the approved build environment,
   preserving `.env` and existing UI assets. Force old browser clients to refresh.
6. Admin sets real Supervisor memberships/explicit intern links and resolves
   missing Coordinator assignments. Rehearse real Auth/JWT/PostgREST RLS and
   browser acceptance with isolated consenting fixture accounts; never publish
   test results to real students. No email/push delivery is promised.

All migrations are human-labeled operator deliverables, not CLI timestamped files
automatically discovered by `db push`. Do not replay committed migrations.
Failure before commit rolls back. After commit retain history and use forward
repair; do not restore retired grants or roll back to the old evaluation writer.
Old cleanup/demo SQL now explicitly rejects M15 before mutation; checkpoint-bound reset SQL rejects the extra tables. These procedures target their historical schemas; do not use
them to remove M15 history or as a rollback. No cleanup/reset was executed against the deployed project.

## Changed files and validation

Database: M15, read-only inspection 07, guarded legacy cleanup/demo tools, both offline generators and regenerated
fresh/consolidated artifacts. Client: App, AdminDashboard, SupervisorAssignments,
SupervisorDashboard, EvaluationWorkflow, InstructorDashboard, InternDashboard,
AuditHistory, authority/workflow/attendance/report helpers. Docs: this guide,
README, context, decisions, improvements, progress, owner/demo/setup guides and
database installation/runbook/test documentation.

Native tests use fresh loopback-only PostgreSQL with synthetic provider tables.
They cover role/assignment denial, score calculation, missing Coordinator, draft
privacy, immutability, rating explanations, final-only reads, explicit routing,
company mismatch, retained legacy/correction records, old-RPC denial, audit
rollback, separate-connection overlap, and clocking/closed verification.
Fresh/consolidated suites validate actual generated SQL and rerun behavior.
Browser runner uses actual App/JSX with mocked transport, no `.env`, blocked
remote network, and screenshots in ignored `.client-review/supervisor`.
Report artifacts keep their existing format tests. Historical correction/client
adapters and destructive-tool tests are isolated to M14 fixture contracts.

Final local results: 2,425 tests across 29 files passed; 10 browser groups passed at Supervisor phone/tablet/desktop sizes; lint has zero warnings/errors; build and git diff checks pass. The existing large-chunk advisory remains. See FIX_PROGRESS.md for exact commands/evidence. Local SQL impersonation
is not real JWT/PostgREST proof. Live schema inspection, provider migration,
deployment, login/email and four-role acceptance are outstanding operator steps.

# Read-only inspection pack

`06_coordinator_operations.sql` provides pre/post-M13 announcement and attendance
RPC signatures, full routine definitions, owner/grants, policies, triggers and
independent announcement column grants. It reads catalog definitions only, not
account/attendance records, and rolls back its read-only transaction. Follow
`../M13_Coordinator_Repair_README.md` for operator steps; no live execution occurred.

`05_consolidated_trigger_compatibility.sql` inventories current INSync/Auth
triggers and master-data trigger function definitions without reading account
records or changing anything. Use it for consolidated-update compatibility
errors such as `academic_years.m11_retain_year`. Its operator-supplied definition
is now recognized and preserved, but its related academic-year columns/relationships
remain unreviewed. The inspection includes those column, constraint, index and
cohort-routine definitions. Review output for embedded function-body secrets
before sharing it; never drop an unfamiliar protection based on its name.

These files contain read-only inventory, not migrations or repairs. They have
**not been executed against a real project**. Run `01_metadata.sql` then `02_anomalies.sql` only through
a trusted operator after confirming the project and snapshot. Both wrap SELECTs
in a read-only transaction and roll back. No app or build runs inspections.
Do not execute `supabase/schema.sql` on existing data.

Inspect metadata first: the queries assume the audit's baseline columns. Stop on
schema drift, missing relations or insufficient privileges and adapt a reviewed
inspection copy. Use an operator allowed to inspect all rows and storage metadata;
an ordinary RLS-filtered account can produce misleadingly empty anomaly reports.
SQL Editor/API result limits may truncate listings; reconcile group counts and
retrieve complete results privately. Do not paste real project output into Git,
test fixtures, chat or reports. Keep row IDs and invalid values operator-only.

Catalog inspection covers policies (including permissive policy overlap),
table/column/routine/schema ACLs, PUBLIC/default privileges, function owners and
definitions/search paths, RLS flags, triggers, constraints, views, indexes and
document bucket privacy/limits. Also record these dashboard/operator settings
without exporting credentials:

- Project identity and explicit disposable rehearsal ownership.
- API row cap, exposed schemas and any extra endpoints/functions/jobs.
- Auth public signup, confirmation, redirects, rate limits and session settings.
- Provider backup availability, retention and disposable restore rehearsal.
- Existing migration history and differences from all 12 baseline tables.

Each anomaly result is a review queue. Non-intern historical rows and historical
reviewers with changed roles are not automatically invalid evidence. Time-only
legacy rows do not reveal the intended end date/timezone. An unreferenced Storage
object may be staged, retained, or used elsewhere. Never infer a deletion from an
empty join. Findings requiring uniqueness must block migration until the affected
rows have a separately reviewed disposition.

Record a proposal in `REPAIR_PROPOSAL.md` before any DML or constraint validation.
No real data repair is authorized by this inspection pack. The final ordered
migration runbook is `../RUNBOOK.md`.

`03_phase2_attendance.sql` requires the new M01/M02 columns. Run it after M02,
before M03 and before separately gated M05. It reports duplicate daily/open/
Pending identities, invalid/missing timestamp and review evidence, future claims,
unreconciled legacy approvals, audit provenance and bucket settings. This file is
rehearsed only on disposable synthetic fixtures by the migration-gate tests;
those tests never contact a real project. It contains SELECTs only. All real
inspection and any proposed historical repair remain an operator task.

# Clear operational records while retaining accounts

The legacy SQL deliberately refuses M15 schemas. Keep Supervisor evaluations, reviews, correction history and audit records; a new cleanup policy would need separate authorization. Tests below rehearse historical M14 fixtures only.

Current additive M15 upgrade: [Supervisor workflow and rollout](../SUPERVISOR_WORKFLOW.md). Supervisor is authorized; correction mutations and direct Coordinator evaluation creation are retired. Target: `tcntyrwwqzyyqlzdtuer`; no live rollout occurred. Historical cleanup/demo/reset procedures below do not authorize removing current evaluation/correction history.


**Destructive manual cleanup, not a migration. Nothing was executed against live
Supabase.** Back up the database and Storage files and pause the app, signups and
uploads before running. Rehearse on an isolated restored copy first.

Use [INSync_Clear_Operational_Data.sql](INSync_Clear_Operational_Data.sql).
Paste the **entire file** into Supabase SQL Editor and execute as **postgres**.
The file is one atomic `DO` statement; it creates no temporary tables and requires
no setup statements or retained session state. With `dry_run boolean := false`,
successful execution commits deletions in the editor's ordinary autocommit mode.
For a preview, change that declaration to `dry_run boolean := true`. The block
then verifies the attempted cleanup and rolls back **all deletions and their audit
events** before returning success. Counts in that mode describe rolled-back work.
Never execute selected fragments. On error, the statement is unapplied;
run `ROLLBACK;` if the session is still in an aborted transaction, inspect the
failure, and retry only after its prerequisite is resolved.

Counts are emitted as an `INSync cleanup result:` JSON notice. Some editor
interfaces show only “Success. No rows returned” for a `DO` statement; this is
expected. The block verifies empty operational tables and unchanged protected
records before success. Keep the app paused while checking results. When run
inside your own explicit transaction, a later COMMIT is still required.

The earlier file relied on `ON COMMIT DROP` temporary tables created in preceding
statements. Error `42P01` means the preservation table was unavailable to the
cleanup block. This is reproducible if those setup statements are autocommitted
separately; selecting only part of the old file or changing sessions can also
omit setup. The revised single statement removes that dependency. Local
reproduction does not establish how the live editor executed the earlier file.

Preserved unchanged: all `auth.users` and `public.profiles` records, including
Pending/Inactive accounts, roles and approval status; all `public.interns`
records, saved hours and instructor/company/section assignments; companies,
sections and academic years. Full-row digests verify preserved records before
COMMIT without returning sensitive account values. No account is activated,
promoted, recreated or given a new password. No RLS, grants, triggers, functions
or schema definitions are changed.

Deleted: clearance requirement rows, document versions/reviews, flexible
submissions/files/versions/reviews, attendance, corrections, evaluations,
announcements, alerts and **all audit history**, including audit events generated
by these deletions. Optional tables absent in an earlier schema are explicitly
reported as not installed. Children precede parents; no TRUNCATE/CASCADE, trigger
disabling or RLS weakening is used. Unexpected FK/trigger failures roll back.

This SQL **does not delete Storage metadata or file bytes**. Inventory/back up
files first, then use the Supabase Storage dashboard or a trusted server-side
Storage API to delete the intended documents bucket contents during maintenance.
Never use SQL `DELETE FROM storage.objects` to remove physical files. Existing
application policies intentionally prohibit browser deletion of committed
evidence; do not weaken them or expose service-role secrets to work around this.

After cleanup, reattach standard requirements via existing Admin controls before
demonstrating document submission/clearance. Custom requirements were also
deleted. Pending accounts still need Administrator activation. Existing targets
and assignments remain; no requirement/deadline/progress evidence is invented.

Cleanup does not repair a deployment, missing RPCs, incompatible relationships or
invalid saved targets. Use the separately reviewed consolidated update and its
prerequisites afterward if needed; no original migration is marked applied here.

Validation: `npm test -- tests/operational-cleanup.test.js` passed **5 native
PostgreSQL fixture tests**: all 13 operational tables emptied, protected accounts/
targets/assignments/master data and Storage rows preserved on two runs, complete
dry-run rollback, rollback when a synthetic trigger alters a protected account,
and reproduction of the missing temporary table across autocommitted statements
followed by successful cleanup without temporary tables, and proof that dry-run
mode does not disguise an actual trigger failure as success. Auth/Storage are
synthetic provider doubles, not live Supabase services.

# Small, one-time INSync demo dataset

The legacy SQL deliberately refuses M15 schemas. Keep Supervisor evaluations, reviews, correction history and audit records; a new cleanup policy would need separate authorization. Tests below rehearse historical M14 fixtures only.

Current additive M15 upgrade: [Supervisor workflow and rollout](../../SUPERVISOR_WORKFLOW.md). Supervisor is authorized; correction mutations and direct Coordinator evaluation creation are retired. Target: `tcntyrwwqzyyqlzdtuer`; no live rollout occurred. Historical cleanup/demo/reset procedures below do not authorize removing current evaluation/correction history.


**Write-only delivery; no remote SQL execution is authorized or performed.**
Target only the NEW project **`tcntyrwwqzyyqlzdtuer`**. Preserve the old project
`upnkotnmoeaykummcnlx`. These are optional demo scripts, not migrations and not
part of fresh installation/consolidated updates. Never add them to an automatic
migration run or mark M01–M14 applied because this demo succeeds.

Reviewed: `INSync_New_Project_Setup_README.md`, `DECISIONS.md`, the migration
ordering/ledger guidance in `supabase/migrations/README.md`, `initial_schema.sql`,
M01–M14 and the final catalog/constraints in `INSync_Fresh_Install.sql` and the
consolidated contract. No NEW-project applied-migration ledger was supplied or
retrieved. Operator verification of that installation remains necessary.

## Existing-account prerequisites

| Existing email | Required effective role/status |
|---|---|
| fangonbernstain566@gmail.com | Admin / Active |
| mangokamen1@gmail.com | Instructor / Active |
| hhimii.mu@gmail.com | Intern / Active |

Each identity must exist exactly once, have a matching profile email and a
confirmed, non-deleted Auth identity. The seed resolves UUIDs by email and changes
no account, role, status, assignment, saved target, company, section or year.
It creates no Auth users and reads no credentials or untrusted metadata.

Use the **Admin UI** to assign the Intern to this Coordinator and a saved company
and section before seeding. All required schema/security/audit triggers and
validated constraints must already be installed. Existing attendance must contain
no open/unknown evidence, and existing verified hours **plus 30** must be strictly
below the saved target. Otherwise the script aborts with guidance and preserves
everything. Do not inflate the target or rewrite history to force a demo through.

The Coordinator's assigned active roster must contain **only the specified
Intern**. Otherwise the requested roster announcement would deliver demo content
to another account; the entire seed aborts. Use an intentionally designated demo
roster or create appropriately scoped messages in the app, without changing other
users just to pass this script.

## Exact manual operator steps

1. Check the Supabase Dashboard/SQL Editor project banner and reference are
   **`tcntyrwwqzyyqlzdtuer`**. Do not use the old project or a linked CLI command.
   SQL cannot reliably infer a hosted project reference from the normal `postgres`
   database name, so the script uses an explicit operator attestation.
2. Confirm the current installation with `../INSync_New_Project_Verify.sql` and
   review your actual migration ledger. Take an appropriate provider recovery
   checkpoint before manual data changes. Neither verification nor this seed
   installs missing migrations or changes provider configuration.
3. Sign in to the app as Admin to check account approval/assignment/target. Confirm
   all three accounts' email confirmation in Auth Users. Resolve prerequisites
   through their supported flows; the seed never repairs/promotes accounts.
4. Open `demo_data_seed.sql`. Replace its **one**
   `CHECK_NEW_PROJECT_BANNER_FIRST` value with `tcntyrwwqzyyqlzdtuer`, after checking
   the banner. Run the **whole file**, including BEGIN/COMMIT, as trusted `postgres`
   in SQL Editor. Do not select/run individual statements or change the row IDs.
5. If any guard/trigger/constraint fails, no demo rows commit. Review the message,
   issue `ROLLBACK;` if your editor connection is still in an aborted transaction,
   resolve the specific prerequisite and rerun the full file. Do not disable a
   trigger, weaken RLS, bypass an error or manually create partial rows.
6. Run **all of `demo_data_verify.sql`** in the same NEW project. It is read-only
   and returns one JSON summary with account checks, assignment, counts, row
   details, hours, current requirements and retained trusted-audit event count.
7. Refresh the role pages and exercise the workflows described below. No file
   exists until you actually upload it through the app.

Reapplying the seed aborts safely on its fixed IDs/retry identity or retained
trusted audit events, including **after cleanup**. This is a one-time dataset;
it does not silently change dates or create a second batch.

## What it creates

| Data | Intended initial result |
|---|---|
| Attendance | 6 closed 08:30–16:00 elapsed sessions: 45 logged hours, 30 verified hours; four verified by Coordinator, two unverified |
| Correction | 1 Pending, seven-hour 08:30–15:30 claim on a separate past weekday; no attendance/Pending-correction date collision |
| Requirements | Missing MOA, Endorsement, Consent and Medical, plus missing **Demo - Weekly Learning Summary** custom requirement; Pending, no files/current versions/reviews |
| Evaluation | 1 Coordinator evaluation; ratings 4/4/5/4; exact `rubric_score` result **84**; fixed submission retry UUID |
| Announcements | 1 assigned-active-roster and 1 personal message; actual secure RPC derives/fixes recipients atomically |
| Alerts/files/submissions | None |

Attendance uses the seven most recent **unused Monday–Friday dates** within the
previous 60 days in Asia/Manila. Six are logs; the seventh is the correction.
Today and future dates are excluded. Weekdays are a demo scheduling convention,
not an institutional holiday calendar. Hours are exact elapsed seconds/3600;
there is no invented lunch deduction, date repair or overnight inference.
The UI may round displayed hours; stored timestamps/calculations are unchanged.
The 30 hours are added to existing valid verified hours for the target guard.

Existing matching requirements are retained byte-for-byte and are **not tagged**.
An existing standard or matching custom requirement with current evidence/review
state stops the seed rather than resetting it. A matching custom is identified by
its `custom:` type and exact readable demo name; other custom requirements remain
separate. Newly created custom identity follows M12's `custom:<requirement UUID>`
convention. Empty requirements do not certify approval or clearance. Flexible
submissions and their approvals remain separate from clearance.

Announcements call the existing `send_announcement` RPC while the **SQL operator
remains postgres**. Only for these two calls the script sets
`request.jwt.claim.sub` to the already verified Coordinator using
`set_config(..., true)` (transaction-local). It verifies `auth.uid()`, lets the
existing binding trigger derive the immutable recipient array, then clears and
checks the identity before COMMIT. It never sets roles/grants, disables RLS,
supplies its own recipient array or persists an author identity beyond the
transaction. A provider-incompatible identity setting causes full rollback.

Mandatory `database-trigger-v2` audit is active for every insert. Most seed events
show **System / trusted SQL** with null actor and `system-or-sql` context. The two
announcement events show the **Coordinator actor/authenticated context** because
the unchanged trigger reads the temporary subject. These are still operator-
seeded demo actions, not proof that the Coordinator used the browser. The script
does not rewrite or invent audit entries. Failed auditing rolls back the seed.

## Tagging and cleanup

Each inserted application row has a dedicated deterministic UUID namespace:
`de600001-2026-4000-8000-000000000NNN`. These are **data IDs**, never account IDs.

| Exact suffix slots | Meaning |
|---|---|
| 101–106 | Six attendance rows |
| 201 | Correction |
| 301–304 | Missing standard requirements only |
| 305 | Missing custom requirement only |
| 401 | Evaluation; 402 is its submission retry ID, not a separate row |
| 501–502 | Announcements |

Human-readable tag: **`[INSync demo:tcntyrwwqzyyqlzdtuer:v1]`** at the start of
attendance accomplishments, correction reason, newly created requirement notes,
evaluation feedback and announcement titles. No schema column/table is added.
Cleanup uses **exact table/UUID lists + resolved owners + the tag + original
trusted INSERT audit evidence**, never a broad prefix/date/intern delete.

For optional cleanup:

1. Run verification and preserve any needed demonstration evidence first.
2. In the NEW SQL Editor, replace the single banner-attestation placeholder in
   `demo_data_cleanup.sql` with the verified NEW reference.
3. Run the **entire** cleanup file as postgres. All checks run before deletions.
4. Rerun verification. Untouched seeded rows disappear; pre-existing checklist
   rows, accounts/assignments/targets and all audit history remain. Repeating
   successful cleanup is a safe no-op with no new deletion audits.

Cleanup **refuses the entire transaction** if any seed requirement has acquired
files, upload reservations, versions, review history, current review evidence or
legacy evidence, or if a row's tag/owner/provenance was changed. It never cascades
or deletes these histories/Storage bytes. Keep that evidence and obtain a separate
reviewed cleanup procedure rather than modifying guards. Deleting empty seeded
requirements removes only the demo-added requirements; pre-existing ones stay.

If the Pending correction is approved live, the existing review RPC creates a
**new attendance UUID** on its date. That new row is not an original tagged seed
row and is deliberately **retained** by cleanup. Likewise new evaluations,
announcements, flexible submissions and files created through the app remain.
Do not guess their ownership from a shared date or delete them automatically.

**All seed/review/cleanup audit rows remain.** Cleanup itself generates trusted
delete audit events. It never deletes or alters `audit_logs`, Auth, profiles,
intern assignments or Storage objects. Its owner resolution does not require
accounts to remain Active; if their emails change, cleanup stops for review.

## Demo walkthrough and limitations

- **Admin:** see unchanged approved accounts/assignment/target; inspect trusted
  demo audit entries and informational summaries. Nothing invents institution
  details, deadlines, certificate wording, alerts or missing master data.
- **Intern:** see partial verified progress and distinct logged/verified hours;
  view the Pending correction, score-84 evaluation and the two messages. Upload
  actual test files to empty clearance requirements. Exercise Flexible New
  Submission with real file selection, not fictitious stored evidence.
- **Coordinator:** see the assigned roster/progress, evaluate/read history,
  approve or reject the Pending correction with a real explanation, verify an
  eligible unverified closed log, and review actual uploaded documents. Use the
  app for additional messages/evaluations.

The seed is synthetic data for these three existing authorized identities, not
certification or an account-provisioning mechanism. It leaves clearance incomplete
and does not manufacture risk deadlines. Informational reports can show these
real inserted rows, but file delivery, email/session flow, live JWT/RLS/PostgREST,
and UI behavior must still be exercised against the NEW project after the operator
runs the SQL. No remote verification, Storage upload or announcement was performed
while preparing these files.

## Local validation

Focused command: `npm test -- tests/demo-data-sql.test.js`.
The fixture starts only the repository's disposable loopback PostgreSQL, applies
the actual final fresh schema and synthetic provider tables, and sets up isolated
stand-in identities/assignments. Those fixture accounts are not real Supabase
accounts. Actual 2026-10-14 results:

- **24 demo-script tests passed** in native PostgreSQL, including exact full-file
  BEGIN/COMMIT execution on a second independent fixture and read-only verification.
- Combined affected checks: **49 tests / 4 files passed** using
  `npm test -- tests/demo-data-sql.test.js tests/fresh-install.test.js tests/coordinator-postgres.test.js tests/initial-schema.test.js`.
  These also exercise the initial schema + actual M01–M14 migration chain.
- Guards cover operator/project attestation, unconfirmed/missing/wrong-role/
  restricted accounts, missing assignments, insufficient target, existing open
  sessions, other roster recipients, UUID collisions and second application.
- Checks confirm exact interval/hour math, unchanged Auth/profiles/assignments,
  unchanged existing checklist, separate evidence, score 84 and frozen recipients.
  A synthetic late announcement failure leaves no partial rows/audits.
- Authenticated local RLS contexts for Admin, Instructor and Intern can read the
  authorized demo evidence. After unassignment, Coordinator attendance/document/
  evaluation access is denied while intended announcement recipients stay frozen.
- Cleanup preserves unrelated attendance/pre-existing requirements/accounts/
  audits, refuses upload reservations/changed tags, retains attendance generated
  by correction approval, and is repeat-safe. Seed history blocks reseeding even
  after cleanup.
- `npm run lint` and `git diff --check` passed.

No remote calls, environment/secret inspection, account changes on Supabase,
push/merge, reset or deployment occurred. Live Supabase JWT/RLS/PostgREST, actual
Storage bytes/signed delivery, SMTP and browser acceptance remain **not tested**.
Local tests do not establish that the NEW project's migrations/settings are installed.

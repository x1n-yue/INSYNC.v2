# Controlled INSync test database reset/rebuild

**Superseded for future setup by the new-project plan.** Preserve the old project;
do not run this reset again. The operation documented below already committed.
For a new Supabase project use [INSync_New_Project_Setup_README.md](INSync_New_Project_Setup_README.md)
and only the standalone fresh installer, without any reset or old reconciliation.

Prepared 2026-10-14 for verified project **upnkotnmoeaykummcnlx (INSync.V2)**.
The configured public URL, linked CLI reference and Supabase project listing agree.
This reset was explicitly authorized because the existing application records are
test data. Never reuse it on another project or real records.

## Files and execution order

1. `INSync_Test_Data_Reset.sql`: checkpoint-bound destructive application reset.
   Removes only the inventoried INSync tables/routines/owned objects, using
   RESTRICT. It aborts on changed data/definitions, unexpected objects or external
   dependencies. A transaction failure restores the original application.
2. `INSync_Fresh_Install.sql`: complete final catalog derived from the reviewed
   initial schema and M01–M14, including M05/M09 validation on empty data. It is
   **not** `INSync_Consolidated_Update.sql` and contains no update-only baseline
   guards or migration replay. It refuses existing application tables.
3. Verified Auth profile reconciliation: the generic fresh file creates only
   Pending Intern profiles for retained supported Auth identities. Restore approved
   roles only from an independently verified pre-reset profile/identity checkpoint.
   Never use user metadata, email domains or mass Admin/Instructor promotion.

For this project the private, locally validated
`.insync-recovery/execute-reset-rebuild.sql` combines reset, fresh installation and
verified reconciliation in **one transaction**. Prefer this complete file over
separate commits. It preserves the three confirmed identities' established Admin,
Instructor and Intern roles/statuses. The sole existing Active Admin identity was
verified by its trusted profile plus confirmed Auth identity; no new owner identity
was guessed or privileged. Other retained identities default to Pending Intern.

The `.insync-recovery/` folder is ignored by Git and contains sensitive records.
Do not publish or commit it. Private files:

- `pre-reset-exact.json`: authoritative read-only catalog and exact JSON-text
  record checkpoint, including fingerprints; decimal hours retain full precision.
- `application-recovery.sql`: original application schema/ACL/functions/policies/
  triggers and test records; restores only into a reviewed empty application catalog.
- `verified-profile-reconciliation.sql`: verified identity-specific roles/fields.
- `execute-reset-rebuild.sql`: atomic prepared operation.
- `local-validation.json`: isolated recovery/reset verification evidence.

`pre-reset.json` is the initial diagnostic capture; use **pre-reset-exact.json**
and the derived recovery SQL for recovery, not JavaScript-decoded numeric records.
The checkpoint is application schema/data, not a full provider backup. Auth
credentials and Storage file bytes are not exported or modified. Keep separate
provider backup/physical-file recovery arrangements if needed.

## Exact affected scope

| Table | Pre-reset test rows |
|---|---:|
| academic_years | 4 |
| companies | 10 |
| course_sections | 2 |
| profiles | 3 |
| interns | 3 |
| attendance_logs | 1 |
| evaluations | 1 |
| audit_logs | 3 |
| attendance_exceptions | 0 |
| documents | 0 |
| document_versions | 0 |
| document_review_events | 0 |
| announcements | 0 |
| alerts | 0 |
| submissions | 0 |
| submission_versions | 0 |
| submission_files | 0 |
| submission_reviews | 0 |

Total **27 old application rows**, including the profiles/extensions that are
reconciled anew. Original application catalog: 62 public routines, 36 public
triggers plus one Auth integration, 43 public policies plus eight Storage policies,
114 constraints, 44 total indexes and 36 generated table row/array types. The reset
SQL embeds exact names/definitions/signatures or fingerprints for this scope.
The complete original catalog is in the private checkpoint, not a guessed list.

All 18 tables, their owned constraints/indexes/policies/triggers and generated
types are rebuilt. 58 of the 62 original routines are dropped explicitly. Four
integration helpers keep their identities and are temporarily replaced in place
with fail-closed bodies, then restored to the latest contracts:
`handle_new_user()`, `can_read_document_object(text)`,
`can_insert_reserved_document(text)`, `can_delete_staged_document(text)`.

The existing `auth.users.on_auth_user_created` trigger and eight INSync Storage
policies remain intact. No provider table/schema, Auth user, Storage object, bucket,
extension, realtime publication or unrelated object is dropped or altered. No
indiscriminate CASCADE is used. No external FKs/publication memberships were found;
only the expected Auth trigger/Storage-policy dependencies and internal table
types/TOAST dependencies reference application objects.

The fresh catalog has **18 tables, 56 routines, 31 application-related triggers
(30 public + retained Auth), 51 policies (43 public + 8 retained Storage), 10
standalone indexes** and validated empty-database constraints. M14 carries forward
the verified existing last-Active-Admin protection. Current UI risk/clearance and
report calculations use authorized metadata/shared calculations; unused older
cohort/dashboard RPC variants and destructive `admin_delete_master` are excluded.
No automatic academic rollover, deadlines, seeds, imports or official certificates
are invented. Four-standard/custom clearance and flexible submissions stay separate.

## Manual fallback

1. Verify the same project reference in Dashboard and configured client URL.
   Pause application writes/signups during maintenance. Preserve the checkpoint
   and recovery evidence outside Git before proceeding.
2. Re-run `scripts/insync-reset-inventory.sql` read-only and compare scope/record
   fingerprints with the prepared checkpoint. Stop on unexpected real data or
   shared objects. Do not regenerate/approve changed scope blindly.
3. Paste the complete private `execute-reset-rebuild.sql` in SQL Editor as trusted
   postgres. It already includes one BEGIN/COMMIT and verified role reconciliation.
   Do not paste the consolidated existing-database updater on blank tables.
4. On any error, run `ROLLBACK;` if the session remains aborted. No part of this
   combined transaction commits on failure. Inspect the stated incompatible object.
   Do not bypass guards, use CASCADE or delete Auth/Storage objects to make it pass.
5. If executing separate reset/fresh files is unavoidable, review a maintenance
   and recovery plan first; an intermediate empty application will reject signups
   and fail closed. Reconcile verified roles explicitly after the fresh file.
6. Run the read-only queries below. Successful rebuild notifies PostgREST at COMMIT.
   Refresh the client. Keep API schema exposure/public URL/Auth redirects/email/
   hosting configuration under the existing operator setup; no settings changed.
7. Admin must configure master data/current year and assign the Intern's instructor,
   company, section, saved target and standard/custom requirements. The rebuild
   intentionally creates no fictional operational/master records.

If the designated owner differs from the verified existing Admin, obtain that
specific verified Auth UUID before assigning a new Admin role. Email confirmation
and operator identity checks remain mandatory. Existing passwords/sessions belong
to Supabase Auth and are preserved; do not read or publish credentials.

## Verification

```sql
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
SELECT c.relname,c.relrowsecurity FROM pg_class c
 WHERE c.relnamespace='public'::regnamespace AND c.relkind='r';
SELECT p.oid::regprocedure,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute
 FROM pg_proc p WHERE p.oid IN ('public.send_announcement(uuid,text,text,uuid)'::regprocedure,
 'public.verify_attendance(uuid,timestamptz,timestamptz)'::regprocedure);
SELECT c.relname,x.conname,x.convalidated FROM pg_constraint x
 JOIN pg_class c ON c.oid=x.conrelid WHERE c.relnamespace='public'::regnamespace;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
 FROM pg_policies WHERE schemaname IN ('public','storage');
SELECT (SELECT count(*) FROM auth.users) auth_users,
 (SELECT count(*) FROM storage.objects) storage_objects,
 (SELECT count(*) FROM public.profiles) reconciled_profiles;
-- Private operator check; don't publish identities.
SELECT p.id,p.role,p.status,a.email_confirmed_at IS NOT NULL confirmed
 FROM public.profiles p JOIN auth.users a ON a.id=p.id;
-- Orphan inventory ONLY. No deletion implied or performed.
SELECT o.id,o.name FROM storage.objects o WHERE o.bucket_id='documents'
 AND NOT EXISTS(SELECT 1 FROM public.documents d WHERE d.file_path=o.name)
 AND NOT EXISTS(SELECT 1 FROM public.document_versions v WHERE v.file_path=o.name)
 AND NOT EXISTS(SELECT 1 FROM public.submission_files f WHERE f.file_path=o.name);
```

Expect exact current RPC signatures, postgres-owned SECURITY DEFINER/fixed paths,
authenticated execution only, announcements SELECT under RLS with denied direct
browser INSERT/UPDATE/DELETE, validated constraints, enabled audience/audit/review
triggers and active assigned-only scope. The **two pre-existing documents objects
are already orphaned and remain preserved**; their private inventory is a review
queue, not permission to remove physical files.

`node scripts/validate-reset-install.mjs` rehearses original recovery then the
exact combined script on an owned loopback PostgreSQL database; it reads no live
connection URL. `tests/fresh-install.test.js` exercises the actual fresh artifact,
including pending signup, scope/RLS, announcements, verification, document versions,
flexible approval separation, server evaluation scores and last-admin protection.
The established Coordinator/handover/client native tests cover further failure,
stale/revision/replacement/audit cases. Browser tests use mocked transport and do
not establish live Auth/Storage delivery.

Neither fresh/reset file marks original CLI migrations applied. Record the executed
artifact hashes/results and M01–M14 final effects in the private operator ledger.
Reconcile future migration tooling before `db push`; never blindly replay older
migrations or bootstrap/reset scripts. The old consolidated updater remains the
existing-data path, not the fresh-install path.

## Execution and final results

**Executed successfully on 2026-10-14** against
`upnkotnmoeaykummcnlx (INSync.V2)` through the existing authorized CLI connection.
The complete private atomic file committed. Do not rerun this checkpoint-bound
reset: its old scope/data fingerprints no longer match the rebuilt application.

- Deleted 27 old application rows in the 18 old tables and replaced their owned
  catalog. Rebuilt 18 tables, 56 current routines, 31 application-related triggers,
  51 policies, 10 standalone indexes and validated constraints. Full routine
  definitions/owners/execution grants match the reviewed artifact, not only names.
- Restored three verified profiles/roles plus their default unassigned extensions.
  Master data, attendance, evaluations, announcements and documents/submissions
  are empty. Nine new trusted audit records record initialization/reconciliation.
- Before/after fingerprints prove all three Auth user rows, both Storage object
  rows, bucket settings, Auth trigger and Storage policies are unchanged. No Auth
  users or Storage objects were deleted, no passwords or secrets exposed.
- Eight isolated recovery/reset checks passed, including exact decimal restoration,
  stale-checkpoint and unrelated-view rollback guards, Pending signup with malicious
  metadata, preserved provider integration and fresh-install replay refusal.
- Native fresh-artifact workflows passed; the broader full run passed 2,371/2,372
  tests. Its sole stale documentation query omitted the new M14 trigger; fixed it,
  then all 34 affected consolidated tests passed. No local failure remains.
- Live rollback-only SQL: 13 groups passed for role-context profile access,
  assigned-person/active-roster announcement sending/history, rejected recipient/
  raw writes, frozen audience after reassignment, server clock-in/out, open/stale/
  unauthorized verification rejection, safe repeat verification, server rubric 73,
  own evaluation visibility, document/flexible reservations and refusal to finalize
  absent physical evidence, last-Admin protection and audit retrieval. The final
  application snapshot equals the post-rebuild snapshot: fixture writes did not persist.
- Actual REST gateway: anonymous profile access and both Coordinator RPC calls
  return 401/42501. This verifies current RPC names/arguments resolve in the real
  PostgREST cache and anonymous execution stays denied; it is not a successful
  authenticated browser session test.
- Lint/build/whitespace passed. Existing >500 kB bundle warning remains. The
  unchanged UI's previous fixture browser checks are historical mocked evidence.

Live failures/limits: concurrent CLI queries briefly rotated the shared temporary
login password and caused one read-only verification connection failure; serialized
retry succeeded. No approval bypass, credential change or schema workaround was used.
Authenticated browser login/session, live public registration/confirmation email,
physical uploads/version review and signed-file delivery remain unverified because
no credentialed browser test arrangement was supplied. Full document/review/scoring
and cross-instructor behavior were tested on isolated native PostgreSQL fixtures;
the live document smoke intentionally staged no Storage objects or physical files.

Required next steps: refresh the client, sign in with the unchanged existing test
credentials, configure master data/current year, assign internship details/target
and requirements, then perform credentialed cross-role/file acceptance checks.
The two orphaned private objects remain a separate operator review; deletion is
not authorized by this reset. This is a verified database rebuild, not a guarantee
of completed live handover or production readiness.

# Consolidated existing-database update

Current workflow: [Supervisor logbook submission and M18 rollout](../LOGBOOK_ATTENDANCE.md). Supervisor uploads signed paper evidence; the assigned Coordinator encodes and uses **Verify & Record Attendance** once. This supersedes new Coordinator uploads under M17. Historical records remain unchanged. Local only: no live migration, reset or deployment.


Historical M17 paper fallback: [user guide, source/evidence rules and rollout](../COMPANY_ATTENDANCE.md). M17 is a prerequisite to M18; M18 must precede the current matching client. No live rollout or reset.

Current M16 follow-up: [evaluation controls and rollout](../EVALUATION_CONTROLS.md). Apply reviewed M15, then M16, before the matching client. Local preparation only; no reset or live rollout.

Current additive M15 upgrade: [Supervisor workflow and rollout](../SUPERVISOR_WORKFLOW.md). Supervisor is authorized; correction mutations and direct Coordinator evaluation creation are retired. Target: `tcntyrwwqzyyqlzdtuer`; no live rollout occurred. Historical cleanup/demo/reset procedures below do not authorize removing current evaluation/correction history.


`INSync_Consolidated_Update.sql` is a standalone, manually executed **existing
database** updater. It installs the latest contracts used by this checkout; it
does not replay the original files or assert that any live project is updated.
No live Supabase connection or migration execution was performed in producing it.

## Coverage and exclusions

| Source | Represented final effects |
|---|---|
| M01 authority | Active-account and assigned-roster helpers/RLS, Pending Intern signup, protected identities, frozen announcement recipients, controlled attendance/review APIs, private-object scope. |
| M02 trusted audit | Mandatory row audit, provenance columns, correction review explanations, locked per-item bulk review. |
| M03 attendance integrity | Daily/open/Pending uniqueness, new-write interval/review checks, future-date triggers, server clock capture. |
| M04 bucket | Existing `documents` bucket becomes private, 10 MiB, PDF/JPEG/PNG. Objects remain intact. |
| M06 rubric/hours | Saved-target checks, four weighted server-scored criteria, evaluation retry identity and RPC. |
| M07 account lifecycle | Atomic Admin account/assignment RPCs, restricted raw writes, deferred relationship guards. |
| M08 document versions | Unique requirement identity, immutable upload receipts/versions and review history, current-version review/access, controlled abandoned-stage cleanup. |
| M10 flexible submissions | Four independent file-set tables, whole-set reservations/finalization/reviews/recovery and private access. Flexible approval never satisfies clearance. |
| M11 Admin history | Reference-preserving master archival, new-assignment archive guard, audit filtering/pagination and indexes. |
| M12 handover workflows | Idempotent Admin custom requirements, assigned-staff verification of valid closed attendance with expected instants, explicit atomic current-year configuration with a single-current index/protected marker. Nullable legacy metadata column and prospective first-replacement snapshots, scoped private access and cleanup protection; no backfill, inferred approval/version or automatic rollover. |
| M13 Coordinator operations | Controlled idempotent announcement RPC with atomic frozen recipients/audit, sender/recipient SELECT repair and denied direct browser writes; repeats the expected-timestamp M12 attendance verification contract independently of cohort changes. |
| M14 last Admin | Preserves the reviewed existing last-Active-Admin guard in the current migration set; no account backfill or new role. |

| M15 Supervisor workflow | Four effective roles, explicit company/intern assignments, private immutable source/review routing and published finals, retained history, revoked correction/direct Coordinator evaluation mutation grants. |
| M16 evaluation controls | Private selectable feedback/remarks and written-draft retention, deterministic preview equality, explicit per-criterion adjustment reasons and immutable adjustment history; hardened old writer and controlled v2 RPC. |
| M17 paper fallback | Existing-ledger manual attendance, signed private evidence and participant scope, explicit verification, versioned unverified revisions and immutable provenance/audit. Existing daily/interval rules and retired corrections preserved. |

The latest definition wins where M02/M03 replace M01 review/clock functions and
M10 extends M08 private-object helpers. Superseded broad evaluation/audit writes
are omitted. Old path-only upload/review routines remain defined for dependency
compatibility, **without browser execution grants**. Every final function has a
source comment; reviewed source-file SHA256 values are in the SQL header.

**Intentionally excluded:**

- `M05_validate_attendance.sql` and `M09_validate_domain.sql`: separate historical
  certification gates. New-write checks remain `NOT VALID`; existing validated
  checks and an existing `evaluations.overall_score NOT NULL` are preserved.
  Historical timestamps, reviewers, rubrics and scores are never invented.
- `schema.sql`: destructive table resets, legacy permissions and example seeds.
- `initial_schema.sql`: empty-project-only bootstrap, never appropriate for an
  existing project. Its catalog is a supported baseline, not executed by this updater.
- `patch_attendance_exception_insert.sql`: superseded permissive legacy patch.
- `inspection/*.sql`: read-only operator diagnostics, not schema updates.
- `tests/baseline.sql`, all test fixtures and browser mocks: synthetic provider
  doubles/records, not deployment SQL. No seed, reset, `TRUNCATE`, table deletion,
  account mutation, attendance repair, document conversion or object deletion is included.
- Proposed configurable requirement deadlines: **not implemented or approved**.
  The Instructor At Risk/Cleared feature needs **no SQL migration**. It reuses
  existing D13 risk and shared current-evidence clearance rules under existing RLS.

## Required baseline and prerequisites

### Existing `m11_retain_year` trigger compatibility

The operator supplied the actual trigger/function definition after reporting
`Unexpected trigger public.academic_years.m11_retain_year`. The generator now
recognizes that specific BEFORE DELETE / FOR EACH ROW trigger calling
`public.guard_academic_year_delete()`. The supplied body rejects deletion with
SQLSTATE 23503 when assignments, attendance, exceptions, evaluations or documents
reference the year. Its PostgreSQL owner, security-invoker mode, fixed search path,
enabled state, timing and complete body must match. Whitespace formatting is ignored;
different behavior with the same name still stops. The updater preserves this
existing trigger/function/grants unchanged and verifies preservation before commit;
it does not create this variant on the repository baseline.

**Related schema prerequisite remains unresolved:** the supplied body references
`academic_year_id` on five tables; the repository baseline has no such columns.
Their actual types, nullability, defaults, foreign keys/indexes and related routines
have not been supplied. The updater intentionally still stops on these unreviewed
columns rather than inventing a cohort schema or replacing its write behavior.
Do not treat recognition of the trigger as support for the entire database variant.

Run [the expanded read-only inspection](inspection/05_consolidated_trigger_compatibility.sql)
separately in SQL Editor and review its academic-year column, constraint, index and
cohort-routine results together with the trigger inventory. Review embedded secrets
before sharing definitions. These are catalog-only queries, with no record changes.
Do not remove/disable the retention trigger or bypass the preflight. If a failed
update left the SQL session in an aborted transaction, run `ROLLBACK;` first.


M12 enforces at most one explicitly configured current academic year and protects
the marker behind `admin_set_current_year`. Multiple current years or an
archived-current year stop the transaction unchanged. Inventory with
`SELECT y.id,y.label,y.is_current,to_jsonb(y)->>'archived_at' AS archived_at FROM public.academic_years y ORDER BY label;`
(works before/after the archived column exists). An authorized operator must
review and explicitly choose an active year in a separately reviewed transition;
this script never infers a year or performs automatic rollover. Zero current
years is a setup-required state that Admin can resolve after migration.

Use the intended Supabase project and SQL Editor's trusted **postgres** role.
The provider must already supply `auth.users`, `auth.uid()`, `anon`,
`authenticated`, `storage.buckets`, RLS-enabled `storage.objects`, and JSONB
object metadata containing actual `size`/`mimetype` evidence. Review those
provider contracts; SQL cannot verify physical file bytes or delivery.

The 12 original INSync tables must exist with the repository's supported baseline
columns, keys, foreign keys and types. Supported baseline default variants include
legacy Active/default On Track and the seed-free Pending baseline; the final
signup trigger always explicitly writes Intern/Pending. Core missing tables,
columns, keys and foreign keys require restore/reconciliation, not speculative
recreation over existing accounts. The additional evidence/workflow tables and all
additive migration columns are installed when absent. Missing baseline CHECKs
are restored only by validating existing values; failures roll everything back.

Baseline, intermediate M01–M18 states, and the final catalog can be updated.
Independent M04 and deferred M05/M09 states are supported. A partially installed
new evidence table is acceptable only when existing definitions match and it is
empty. A populated partial table stops rather than inventing identities, version
numbers, review statuses or timestamps. Missing document version/revision columns
also stop if version/review history already exists. An absent required column
without a default on a populated table will fail with PostgreSQL's NOT NULL
error; prepare a separately reviewed transition.

Owned tables/functions must belong to trusted postgres. Partitioned tables,
forced RLS, generated/identity/extra columns, unexpected domain/Auth triggers,
unreviewed constraints, exposed definer routines/views, unexpected overloads,
incompatible RPC argument/return contracts, or restrictive Storage-policy drift
cause a clear stop. Existing column defaults/nullability and constraint/index
**definitions**, not just names, are inspected. Known compatible RPC bodies,
named triggers, domain policies and API grants are replaced with final definitions.
Incompatible columns/constraints/indexes are never dropped to make the script pass.

Before running, review:

1. [RUNBOOK.md](RUNBOOK.md) and [migrations/README.md](migrations/README.md).
2. [inspection/01_metadata.sql](inspection/01_metadata.sql),
   [inspection/02_anomalies.sql](inspection/02_anomalies.sql),
   [inspection/03_phase2_attendance.sql](inspection/03_phase2_attendance.sql) and
   [inspection/04_phase4_domain.sql](inspection/04_phase4_domain.sql). Later-phase
   inspection statements need their earlier columns/functions; run those sections
   applicable to your current catalog and repeat after the update.
3. Duplicate attendance daily/open/Pending identities, duplicate
   `(intern_id, doc_type)` requirements, missing Intern extensions, and
   incompatible instructor assignments. These abort unchanged. Use the repair
   proposal templates; preserve every record/evidence and obtain explicit review.
4. All Storage policies, including unrelated buckets. Other-bucket predicates
   are preserved and excluded from `documents`. M08 requires an authenticated
   Storage DELETE table grant for **abandoned, uncommitted receipt cleanup**;
   an existing unrelated-bucket DELETE policy may become effective. Review this
   effect before running. Document restrictive guards prohibit overwrites,
   unauthorized reads/inserts, anonymous access and committed-evidence deletion.

Rehearsal used native PostgreSQL **17.10**. Catalog deparsing can vary between
major versions; rehearse against your provider version. A conservative definition
comparison may stop on a semantically equivalent unfamiliar catalog. Inspect it
and prepare a reviewed adjustment rather than weakening checks blindly.

## Backup and execution

1. Confirm the project identifier and environment out of band. Schedule a
   maintenance window: signups and application/Storage mutations should be paused.
   Stop old clients; they cannot use the tightened raw-write contracts afterward.
2. Take a provider-supported database backup/snapshot and verify its restore
   procedure on a disposable environment. Keep a separate secure backup/inventory
   of **Storage file bytes**; a PostgreSQL dump is not a file-byte backup. Export
   the schema, object definitions, row counts and relevant Auth/Storage settings.
   Protect backups as sensitive data; do not commit them, JWTs or account lists.
3. Rehearse this exact file on an isolated restored copy with equivalent provider
   schemas. Compare before/after row counts and original record values, including
   document versions, reviews, assignments, frozen recipients and audit events.
4. In the Supabase dashboard's **SQL Editor**, create a new query, choose
   **postgres**, and paste the **entire** `INSync_Consolidated_Update.sql`.
   Run the complete query once. Do not select fragments or run parallel updates.
5. Require success through the final `COMMIT`, not an intermediate result row.
   The final notice reports installed contracts and deferred historical gates.
   Run the verification queries below and reconcile original data/Storage counts.
6. A second complete run is supported; verify it too on the rehearsal copy.
   Compatible functions/policies/triggers are reinstalled; columns/constraints/
   indexes are inspected and reused; no history rows are rewritten or synthesized.
7. Refresh the current client only after successful database verification.
   Test Auth, PostgREST and signed Storage delivery with explicitly authorized
   fixture accounts/documents in a disposable Supabase project before live use.

Everything is inside one transaction: ordinary indexes, table/DDL locks, security
definitions and the one bucket-settings update. There are **no operations requiring
execution outside a transaction**. Lock timeout is 10 seconds; statement timeout
is 120 seconds. A timeout rolls back; schedule a suitable maintenance window and
rehearse any reviewed timeout adjustment for a large database. `NOTIFY pgrst,
'reload schema'` is delivered only if the transaction commits.

## Errors and unapplied sections

Any error means **the complete update is unapplied**. PostgreSQL aborts the
transaction; run `ROLLBACK;` in an editor session still showing an aborted
transaction. No earlier section is a successful partial upgrade. Record the
error privately, inspect the named object and rerun the entire file after the
prerequisite is safely resolved. Do not delete history or remove guards.

| Error category | Resolution |
|---|---|
| Missing baseline table/key/column | Restore the correct catalog or prepare an explicit dependency/data reconciliation. Do not execute the bootstrap/reset over existing records. |
| Duplicate identities or invalid relationships | Run the appropriate read-only inspection and produce a separately reviewed per-record proposal. This file chooses no canonical record. |
| Column/constraint/index drift | Compare catalog definitions with the embedded contract and source migration. Plan a safe conversion/repair separately; no automatic DROP/CASCADE is attempted. |
| Incompatible function signature/overload | Inventory callers and dependencies, then prepare a versioned transition preserving grants and authorization. No function is dropped by this updater. |
| Unexpected trigger/view/definer/Storage policy | Review its purpose and security. Preserve unrelated behavior in a reviewed migration before retrying; never simply bypass the guard. |
| Missing bucket/metadata contract | Inspect provider Storage configuration; provision only the reviewed private bucket and confirm upload metadata shape on disposable files. |
| NOT NULL / CHECK / FK validation | Preserve offending history, inspect it, and author a reviewed transition. No guessed backfill is supplied. |
| Timeout/lock conflict | Pause concurrent writers; retry the whole transaction during maintenance. |

Once history has been independently inspected and any approved corrections
rehearsed, run **M05** and **M09** separately using their documented gates. They
are independent; one may remain pending. Their success must be recorded and
verified separately; this consolidated file does not certify legacy evidence.
If M03 is blocked by duplicates, this all-or-nothing updater cannot partially
harden Storage: a separately reviewed **M04** after installed M01 is still the
runbook's independent option. Do not extract fragments from the updater.

## Verification queries

Run these as postgres after COMMIT; review definitions, not merely nonempty output.
Store before/after inventories privately. Include all existing baseline and six
new table counts in reconciliation; counts alone do not prove value preservation.

```sql
-- All 28 managed tables: trusted ownership, RLS enabled; no forced RLS.
SELECT n.nspname, c.relname, pg_catalog.pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('companies','course_sections','academic_years','profiles','interns',
  'attendance_logs','attendance_exceptions','evaluations','documents',
  'announcements','alerts','audit_logs','document_versions','document_review_events',
  'submissions','submission_versions','submission_files','submission_reviews','supervisor_assignments','supervisor_evaluations','evaluation_reviews','evaluation_routing_events','evaluation_adjustment_events','attendance_sheet_evidence','manual_attendance_events','logbook_submissions','logbook_versions','logbook_events')
ORDER BY c.relname;

-- Important signatures: retired routines still resolve for internal/history dependencies,
-- but correction/direct Coordinator evaluation EXECUTE must be false for API roles.
SELECT signature, pg_catalog.to_regprocedure(signature) AS installed
FROM unnest(ARRAY[
 'public.my_profile()', 'public.related_profile_names(uuid[])',
 'public.admin_update_account(uuid,jsonb)',
 'public.admin_set_assignment(uuid,uuid,uuid,uuid,numeric)',
 'public.clock_in()', 'public.clock_out(uuid,text)',
 'public.submit_correction(date,time without time zone,time without time zone,date,text)',
 'public.review_exceptions(uuid[],text,text)',
 'public.submit_evaluation(uuid,jsonb,text,uuid)',
 'public.supervisor_roster(uuid,integer)',
 'public.admin_set_supervision(uuid,uuid,boolean)',
 'public.save_supervisor_evaluation(uuid,uuid,date,jsonb,text,integer,boolean)',
 'public.save_evaluation_review(uuid,integer,text,text,text,text,jsonb,text,boolean)',
 'public.admin_reroute_evaluation(uuid,uuid,text,integer)',
 'public.logbook_queue(uuid,integer)',
 'public.save_logbook_draft(uuid,uuid,date,date,text,uuid[],integer,integer)',
 'public.stage_logbook_evidence(uuid,uuid,text,text,bigint)',
 'public.submit_logbook(uuid,integer,integer)',
 'public.return_logbook(uuid,integer,integer,text)',
 'public.verify_record_logbook(uuid,integer,integer,uuid,jsonb,boolean)',
 'public.admin_reroute_logbook(uuid,uuid,integer,integer,text)',
 'public.attendance_sheet_context(uuid)',
 'public.stage_attendance_sheet(uuid,uuid,uuid[],text,text,bigint)',
 'public.finish_attendance_sheet(uuid)', 'public.cancel_attendance_sheet(uuid)',
 'public.record_manual_attendance(uuid,uuid,timestamptz,timestamptz,uuid,jsonb)',
 'public.revise_manual_attendance(uuid,integer,timestamptz,timestamptz,uuid,jsonb,text)',
 'public.verify_manual_attendance(uuid,integer,uuid,timestamptz,timestamptz,boolean)',
 'public.attach_standard_docs(uuid)',
 'public.stage_document_upload(uuid,text,text,bigint,bigint)',
 'public.finalize_document_upload(uuid)', 'public.cancel_document_upload(uuid)',
 'public.unfinished_document_uploads()',
 'public.document_access(uuid,bigint,bigint)',
 'public.review_document_version(uuid,text,text,bigint,bigint)',
 'public.stage_submission(uuid,uuid,text,text,jsonb,bigint,bigint)',
 'public.finalize_submission(uuid)', 'public.cancel_submission(uuid)',
 'public.review_submission(uuid,bigint,bigint,text,text)',
 'public.submission_file_access(uuid,uuid)', 'public.submission_recovery_list()',
 'public.admin_master_impact(text,uuid)',
 'public.admin_archive_master(text,uuid,bigint)',
 'public.audit_history(text,text,text,date,date,integer,integer)'
]) AS t(signature);

-- Review every helper/RPC definition, fixed search_path and EXECUTE ACL.
-- Expect 100 managed routines; unrelated extension routines may also be present.
SELECT p.oid::regprocedure, pg_catalog.pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef, p.proconfig, p.proacl,
       pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS api_execute,
       pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname;

-- Both obsolete path-only routines must have api_execute=false.
SELECT signature, pg_catalog.has_function_privilege('authenticated',signature,'EXECUTE') AS api_execute
FROM unnest(ARRAY['public.submit_document_upload(uuid,text,text)',
                 'public.review_document(uuid,text,text,text)']) AS t(signature);

-- New handover RPCs: present, trusted owner, security definer, protected
-- search_path, authenticated execution only; inspect full definitions above.
SELECT signature, pg_catalog.to_regprocedure(signature) AS present,
  pg_catalog.has_function_privilege('authenticated',signature,'EXECUTE') AS api_execute,
  pg_catalog.has_function_privilege('anon',signature,'EXECUTE') AS anon_execute
FROM unnest(ARRAY['public.admin_add_requirement(uuid,text,uuid)',
  'public.verify_attendance(uuid,timestamp with time zone,timestamp with time zone)',
  'public.send_announcement(uuid,text,text,uuid)',
  'public.admin_set_current_year(uuid,uuid)',
  'public.legacy_document_access(uuid)']) AS t(signature);

-- Baseline FKs/PKs, uniqueness and CHECK definitions; review deferred flags.
SELECT c.relname, x.conname, x.contype, x.convalidated,
       pg_catalog.pg_get_constraintdef(x.oid) AS definition
FROM pg_catalog.pg_constraint x JOIN pg_catalog.pg_class c ON c.oid=x.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' ORDER BY c.relname,x.conname;

-- Eleven standalone migration indexes must be present, ready, valid and correct.
SELECT t.relname AS table_name,i.relname AS index_name,x.indisready,x.indisvalid,
       pg_catalog.pg_get_indexdef(i.oid) AS definition
FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
JOIN pg_catalog.pg_class t ON t.oid=x.indrelid
WHERE i.relname ~ '^m(03|06|10|11|12|15)_'
 AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint z WHERE z.conindid=i.oid)
ORDER BY i.relname;

-- 51 managed noninternal triggers, enabled O, including signup and deferred guards.
SELECT n.nspname,c.relname,t.tgname,t.tgenabled,t.tgdeferrable,t.tginitdeferred,
       pg_catalog.pg_get_triggerdef(t.oid) AS definition
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND
 ((n.nspname='public' AND t.tgname ~ '^m[0-9]{2}_')
  OR (n.nspname='auth' AND t.tgname='on_auth_user_created'))
ORDER BY n.nspname,c.relname,t.tgname;

-- 78 managed policies + reviewed other-bucket policies.
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_catalog.pg_policies
WHERE schemaname='public' OR (schemaname='storage' AND tablename='objects')
ORDER BY schemaname,tablename,policyname;

SELECT table_name,grantee,privilege_type FROM information_schema.table_privileges
WHERE table_schema='public' AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_name,grantee,privilege_type;
SELECT table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_name,column_name,grantee,privilege_type;
-- information_schema can include inherited table privileges on columns;
-- inspect pg_attribute.attacl for independent column grants as needed.

SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id IN ('documents','attendance-evidence');
-- Expect false, 10485760, precisely PDF/JPEG/PNG. Reconcile object inventory.
SELECT bucket_id,count(*) FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;
```

The script also verifies final RPC bodies/signatures/owners/API access, policy
definitions, enabled trigger definitions, RLS/ACL and bucket settings **before
COMMIT**. Constraint/index gates inspect their actual definitions and validity.

## Migration history and future tooling

The project uses human M01–M17 labels and a reviewed operator ledger; these are
not automatic Supabase CLI timestamp migrations. This file **does not write
`supabase_migrations.schema_migrations` or mark originals applied**. Record its
SHA256, checkout revision, operator, before/after inventories, verification results
and the separate pending/completed M05/M09 gates in your private ledger.

Do not subsequently replay M01–M17 or blindly use `db push` against this project.
Before CLI adoption, reconcile any existing CLI history with verified catalog
effects and the manual ledger. Prepare a reviewed timestamped baseline/adoption
plan; use migration-history repair only after each represented effect is actually
verified. Deferred M05/M09 must remain distinct pending work. A new deployment
still needs the initial catalog followed by its reviewed upgrades. Future
migrations must target the resulting verified final catalog and use unused IDs.

## Non-SQL setup and limits

- Auth email confirmation, SMTP/delivery, site URL, redirect allowlist, password
  recovery configuration and existing authorized Admin approval are operator setup.
  No account is promoted or created here; first-Admin instructions are in RUNBOOK.md.
- Frontend public Supabase URL/key, environment settings, SPA/HTTPS hosting and
  client deployment/refresh are separate. Never expose service-role secrets.
- Provider physical file access, upload metadata, signed URLs, Auth/JWT behavior,
  PostgREST embedding/API limits, backup retention and live permissions require
  disposable Supabase verification. PostgreSQL fixtures do not model these services.
- Bulk imports, official certificates, manual application backups and connected
  uptime monitoring remain unavailable. Informational Instructor/Intern reports
  support PDF/XLSX/CSV in the current handover client; these are not certification.
- Legacy version-zero document approvals are preserved but do not become valid
  current-version clearance evidence. Resubmission/review uses existing real flows.
- No deadlines, institutional risk thresholds, historical recipient reconstruction,
  automatic academic-year rollover or permanent deletion are introduced.

## Local validation

After receiving the retention definition: **34 consolidated native PostgreSQL
tests passed** (57.28 seconds), including exact-body recognition, formatting-only
variation, rejection of six security/behavior changes, preserved historical links,
and executable expanded inspection. Lint and whitespace checks passed. The updater
still deliberately refuses the representative unreviewed cohort-column variant;
its fixture definitions are not assumed to describe the actual live database.

Trigger-diagnostics follow-up, 2026-10-13: all **27 consolidated native PostgreSQL
tests passed** (43.53 seconds), including the reported trigger-name reproduction,
executable read-only inspection and unchanged fixture records/protection after
the preflight stop. Lint passed. The live trigger definition remains unknown;
these tests do not establish compatibility with the operator's actual trigger.

The generator `node scripts/build-consolidated-update.mjs` builds final catalog
contracts using the source migrations on disposable native PostgreSQL. It accepts
no external connection URL and does not read environment secrets. The generated
SQL is standalone; operators do not run the generator against Supabase.

`npm test -- tests/consolidated-update.test.js` exercises the initial supported
catalog, historical and intermediate installs, two runs, preserved file/review/
evaluation/announcement/audit records, scope denials, compatible definition repairs,
and rollback for incompatible prerequisites. Provider schemas/data are synthetic.
Historical validation before M12, 2026-10-13 (current handover results are in
[../HANDOVER_AUDIT_2026-10-13.md](../HANDOVER_AUDIT_2026-10-13.md)):

- `npm test -- --no-file-parallelism`: **2,288 passed, 20 files** (165.31 seconds).
- Consolidated updater: **23 native PostgreSQL tests** passed, including both
  initial and existing historical baselines, multiple intermediate installs,
  independent M04, retained M05/M09 validation, repeated runs, preserved modern
  and legacy records, definition repairs, scope denials, executable verification
  queries, and unchanged records on 11 incompatible-state rollback cases.
- `npm run lint`: passed without warnings/errors when run after test cleanup.
- `npm run build`: passed, 779 modules; existing >500 kB chunk warning remains.
- `git diff --check`: passed; Git reported existing LF/CRLF conversion notices.
- One concurrent validation run hit a lint directory-scan race during disposable
  cluster cleanup and the existing production test's 45-second subprocess timeout.
  Lint passed after cleanup; production and migration tests passed on focused
  retest; the final complete sequential suite passed. No checks were weakened.

The regenerated handover catalog contains 18 managed tables, 56 fixed-search-path routines,
75 managed policies, 30 managed triggers and ten standalone migration indexes
(in addition to constraint-backed indexes). Original values and record counts
were preserved for synthetic historical accounts, assignments, attendance,
documents, versions, reviews, evaluations, announcements, audit events and
object metadata during successful repeated upgrades.

Compute the delivered SQL SHA256 with
`Get-FileHash supabase/INSync_Consolidated_Update.sql -Algorithm SHA256`.
The SQL header records the exact represented migration hashes. The previous
pre-M12 hash is superseded; record the newly reviewed artifact in the operator ledger.
These are **local synthetic SQL results**, not live Supabase verification.
Live baseline compatibility, historical anomaly review, deferred M05/M09 gates,
provider Auth/Storage behavior and operator execution remain unverified.

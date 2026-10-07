# Nondestructive remediation runbook

Phases 0-1, 2026-10-07. **M01 authored and rehearsed in synthetic in-memory
Postgres only; no real-project migration applied.** Later migrations are pending.
This session will not execute SQL against a real project. Every future rollout
requires operator review of prerequisites, anomaly disposition and live checks.

1. Confirm repository revision, operator identity, explicitly disposable rehearsal
   project, Auth/API settings and provider snapshot/restore capability. Never run
   `schema.sql` or the legacy broad policy patch as an existing-data upgrade.
2. Read `inspection/README.md`. Compare `01_metadata.sql` results with the audit
   before assuming baseline columns, function owners, grants, policies or bucket
   settings. Operator runs inspection separately; no SQL has been run here.
3. Inventory using `02_anomalies.sql`; reconcile complete counts under query limits.
   Keep real identifiers/output private. Review differences and record per-group
   proposals using `inspection/REPAIR_PROPOSAL.md`. No automatic deduplication,
   normalization, rubric invention, timestamp guessing or Storage cleanup.
4. Review `../DECISIONS.md` assumptions. Stop constraint deployment on unresolved
   anomalies. CHECKs use NOT VALID then VALIDATE where appropriate; UNIQUE requires
   explicit duplicate resolution before index creation. Preserve original history.
5. Rehearse `migrations/M01_authority.sql` first; M02 and later files are pending.
   Apply only to the reviewed baseline, once, in the file's transaction. The exact
   order/file list will be extended as phases land;
   no glob execution or bootstrap replay. M01 authority precedes trusted audit,
   attendance/storage, data model operations, aggregate/index and year changes.
6. For each migration: capture private before snapshot/catalog/row counts; verify
   prerequisites; apply in its specified transaction; run catalog-verification
   query and assigned regression cases; compare domain invariants and row counts.
   Inject failures/concurrency as specified in `tests/FIXTURES.md`.
7. Rollback plan must preserve data and fail closed. Revert additive application
   changes only where compatible; use a reviewed corrective migration to repair
   schema. Never restore broad self-promotion/cross-roster policies as rollback.
   Exercise restore only on disposable data; preserve audit and original evidence.
8. Before any separately authorized live rollout, complete role/status/scope
   policy tests, Auth/Storage checks, post-catalog comparisons, browser/mobile/
   screen-reader checks and independent anomaly/SQL review. Record unverified
   cases and residual advisories. Build success is only compilation evidence.

Post-check checklist to expand per migration: protected field tampering denied;
retained JWT deactivation denied; assigned joins work; no extra permissive policies
or EXECUTE bypass; private known-path anonymous object delivery denied; atomic
attendance/review/audit outcomes; verified/logged totals reconcile above API cap;
legacy rows preserved; zero-row/conflict failures visible; correct current-year
count; no real secrets in artifacts. All these live checks remain pending.

## M01 deployment/rehearsal gate

Read `migrations/README.md` and `tests/M01.md`. M01 replaces policies/grants on all
12 tables as one transaction and adds only nullable columns; it does not update,
delete, merge or normalize legacy rows. Trusted postgres table/function ownership,
expected signup trigger and absence of unreviewed triggers/views/privileged RPCs
are checked before changes. Extra restrictive Storage policies also block preflight.
Review all functions affected by PUBLIC/anon/authenticated EXECUTE revocation.
Privately review approval provenance of every existing Admin/Instructor and all
known demo accounts using the read-only privileged-profile inventory. A stored
Active role cannot prove that prior self-escalation was authorized. Propose any
account remediation separately; M01 never silently demotes legacy accounts.
The existing document bucket's public flag/limits are intentionally unchanged until
Phase 2; do not claim private-object authorization is sufficient for public delivery.

Coordinate the migration and client build: the new client requires `my_profile`,
clock/correction/review/upload RPCs and restricted staff-name RPC. Force older
clients to refresh; raw writes are now denied. New clocks get server instants;
legacy open sessions without instants require a correction rather than a guessed
timezone. Legacy messages without audience snapshot are author/Admin-only. Review
these behavior changes with fixture data before any separately authorized rollout.

Run M01's final catalog queries and the local suite. Then run `tests/M01.md`'s live
SDK/REST, Auth confirmation, retained-token, FK embedding and Storage cases on a
disposable Supabase project. Reconcile unchanged legacy row counts and object
inventory. M01 includes no unique/CHECK validation requiring historical repair;
the previously recorded anomaly review remains mandatory before Phase 2/4 indexes.

## Trusted first-Admin bootstrap procedure (operator only)

Do this only if there is no existing authorized Active Admin and ownership has
been verified out of band. Create/confirm a disposable or subsequently authorized
real Auth account through Auth; M01 always creates intern/Pending + extension.
Verify the exact auth.users UUID belongs to the intended operator. As the trusted
postgres SQL operator (never browser/service key), use a transaction to update that
**exact UUID**, guarded by `role='intern' and status='Pending'`, to admin/Active,
RETURNING id/role/status. Require exactly one row; rollback on zero/multiple or any
mismatch. Privately record operator approval; no bootstrap account/credential is
seeded by migrations. Preserve the extension/history; later lifecycle work handles
retirement. No user-controlled Auth metadata or request claim can bootstrap Admin.

Subsequent approvals use an existing Active Admin, enforced independently in DB.
M02 will supply trusted audit generation; until then bootstrap/critical transition
recording is an explicit operator task. Do not promote arbitrary matching emails
or run a broadly filtered UPDATE. The trusted-role exception in profile guard is
`current_user='postgres'`; anon/authenticated must have no membership allowing that
role or any equivalent BYPASSRLS/owner privilege.

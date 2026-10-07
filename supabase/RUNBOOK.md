# Nondestructive remediation runbook

Phase 0 preparation only, 2026-10-07. **No migrations authored/applied yet.**
This is not an executable deployment guide until each phase supplies reviewed SQL,
prerequisites, rollback notes and catalog checks. This session produces SQL/docs
only and will not execute SQL against a real project.

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
5. Rehearse each future additive M01, M02, ... migration in order on disposable
   synthetic data. The exact order/file list will be recorded as phases land;
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

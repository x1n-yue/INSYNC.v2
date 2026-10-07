# Versioned upgrade path

Do not run `../schema.sql` or the legacy policy patch to repair an existing project.
Migrations here are reviewed SQL deliverables; none are executed against a real
project by this session. Use the ordered gates in `../RUNBOOK.md`. Do not apply
files by glob or assume a bootstrap reset is a rollback.

| Order | Migration | Prerequisites / impact |
|---|---|---|
| 1 | `M01_authority.sql` | Baseline 12-table catalog reviewed; trusted postgres owns tables/helpers; expected signup trigger active; no unreviewed exposed views/definer functions/domain/Auth triggers or restrictive Storage policies. Replaces old policies and grants in one transaction; adds nullable columns, does not rewrite legacy rows. |
| 2 | `M02_trusted_audit.sql` | M01; trusted mandatory row audit, no browser audit writes; persisted review note and locked per-item bulk RPC. Legacy audit provenance unchanged. |
| 3 | `M03_attendance_integrity.sql` | M02; read-only phase2 inspection and separately reviewed legacy disposition. Stops on duplicate daily/open/Pending identity. Unique indexes, NOT VALID CHECKs, future-write triggers, serialized server clock capture. Maintenance window required. |
| 4 | `M04_private_documents_bucket.sql` | M01 Storage policies and reviewed existing bucket. Explicit private/MIME/size UPDATE. Independent of M03 legacy gate; may be scheduled after M01 if M03 is blocked. Preserves objects and unrelated buckets. |
| 5, deferred | `M05_validate_attendance.sql` | M03/M04; repeat inspection and explicitly reviewed historical repairs, if any. No guessing/backfill. VALIDATE only clean history; failure leaves M03 new-write enforcement intact. |

M01's preflight stops on unexpected ownership, privileged routines, exposed views,
extra domain/Auth triggers or restrictive Storage policy drift. Resolve drift in
a separately reviewed proposal before rehearsal; never simply remove the guard.
All old policies on the 12 tables are replaced, including unknown permissive ones.
Existing Storage policies are restricted to buckets other than documents; existing
other-bucket predicates/grants are preserved, with SELECT/INSERT granted as needed
for the new document operations. No UPDATE/DELETE grants are added for Storage.
The new documents policies require Active status, own insertion or assigned current
evidence reads. No documents UPDATE/DELETE policy is added. Actual bucket privacy
is addressed separately by M04; public delivery bypasses private-object RLS.

Schema deployment must precede the new client build: App requires `my_profile`,
Intern uses clock/correction/upload RPCs and Instructor uses review RPCs. Older
clients will receive denied raw-write errors after M01; coordinate their refresh.
Apply only once using a reviewed migration ledger. The M01 file's human version
label must be mapped to a timestamp filename by an operator before adopting
Supabase CLI migration tracking; do not assume `supabase db push` discovers M01.

Rehearsal: `npm test` uses a fresh in-memory Postgres engine, synthetic Auth/Storage
tables and `../tests/baseline.sql`; it never reads/runs bootstrap. Supabase HTTP,
real grants/owners, JWT session behavior, PostgREST FK embedding and private object
delivery require separate disposable project verification in `../tests/M01.md`
and `../tests/PHASE2.md`. Phase 2 also starts a fresh loopback-only native Postgres
17.10 cluster with synthetic Auth/Storage tables for real separate-connection
race/fault tests. It accepts no external database URL/credentials and removes
only its verified disposable directory after stopping the process.

M01-M05 are human version labels, not automatic Supabase CLI timestamp discovery.
Record exact reviewed file hashes in the operator migration ledger; convert each
to a timestamp filename only as part of a reviewed CLI adoption. Future Phase 4
domain work starts at M06; do not reuse a committed version number.

Rollback: before commit SQL errors roll back the transaction. After commit disable
affected operations and apply a reviewed forward repair while keeping authorization
closed. Preserve all added evidence/recipient/timestamp columns. Do not restore
legacy self-promotion, global instructor policies or public EXECUTE defaults.

# INSync project context prompt

LATEST INSTRUCTION: move to a NEW Supabase project; preserve the old project.
No further old-project queries/mutations/reset execution. `.env.new` has blank
public config fields and is ignored; `.env` remains unchanged until a new URL/key
is supplied and verified. Follow supabase/INSync_New_Project_Setup_README.md.
Fresh generator now defaults to fresh-only, without reading old private identities
or generating a reset. Do not use --prepare-reset for this setup.

2026-10-14: authorized test application reset/rebuild actually executed against
verified project upnkotnmoeaykummcnlx. Current schema includes M01–M14 final effects,
with M05/M09 validated on fresh empty data and the preserved last-Admin guard.
Auth users/Storage/integration fingerprints unchanged; known profiles reconciled.
Do not rerun checkpoint-bound reset or invent demo data/privileged roles. Read
supabase/INSync_Reset_Rebuild_README.md and private recovery ledger for evidence.
Live rollback SQL/anonymous REST tests pass; credentialed UI/email/file delivery
remain unverified. Older no-live-operation statements apply to their dated tasks.

Coordinator follow-up: M13 adds `send_announcement(uuid,text,text,uuid)` with
atomic frozen audience/audit and request-UUID retries, plus the existing M12
verification contract/grants independently of year changes. Frontend sending
uses this RPC; timestamps compare exact six-digit instants across Z/offset
encodings. Intern New Submission reads actual requirement IDs for its dropdown;
Other requires a title, and flexible approval remains separate from clearance.
See `supabase/M13_Coordinator_Repair_README.md` for unapplied live steps/limits.

Use this context with the current source, DECISIONS.md, CLIENT_IMPROVEMENTS.md,
FIX_PROGRESS.md and the migration ledger. Verify the checkout before changing it.
Older AI guidance has been replaced; do not infer deployed state from this file.

You are working on INSync, an internship monitoring system for academic OJT.
It uses React 19 / JavaScript / JSX, Vite 7, Tailwind 4 and Supabase Auth,
Postgres and private Storage. Node >=22.12 is required. There is no Express
backend. Reuse existing components, tokens, icons, modals, toasts and helpers.

Roles are Intern, Instructor and Admin. Public registration always creates
Intern/Pending. Only Active Admins control effective roles and assignments.
Instructors access their assigned interns; SQL RPCs, RLS and Storage policies
are the effective authority, not frontend checks. First Admin creation is an
operator procedure, never an arbitrary signup role or seed account.

Interns see assignment/progress, separate logged and verified hours, attendance
charts, evaluations and frozen-audience announcements. Clock RPCs use server
timestamps and Asia/Manila business dates. Ordinary clock-out remains unverified.
Corrections, overnight intervals and reviewer evidence follow the existing rules.
The four rubric criteria/weights are server-scored; invalid legacy scores are
Unavailable. Evaluation filters use inclusive Manila dates and Monday–Sunday weeks.

Instructor lists search name, student ID and company and filter the real section
relationship before pagination. Dashboard totals use complete authorized,
count-checked reads, independent of displayed pages. Bulk correction reviews
retain their 100-item limit and per-item outcomes. Computed attention uses the
existing risk rules; it does not create stored alerts or invent deadlines.
Academic-year master data has no historical cohort FK or atomic current-year
switching/uniqueness implementation. Do not invent one or assume D14 was enforced.

Flexible submissions are separate from legacy clearance requirements. Active
interns supply a title, optional description and 1–10 PDF/JPEG/PNG files, <=10 MiB
per file and <=50 MiB total. Whole-set server reservations last 15 minutes;
finalization is atomic and checks every object MIME/size plus expected version
and review revision. Assigned staff review an explicit version; requesting
revision requires an explanation. Resubmission preserves old files/reviews and
resets the current review. Ambiguous outcomes reconcile before cleanup; only
abandoned uncommitted staged files can be removed. Committed evidence must survive.
Access uses private Storage and 60-second signed links.

The original documents/checklist remains accessible. Flexible approvals DO NOT
satisfy clearance. Clearance requires the persisted target met by verified hours,
all four standard types (moa, endorsement, consent, medical) and approved valid
current evidence for every standard/custom requirement. Unknown evidence stays
unknown. Do not change clearance, attendance or scoring policy without authorization.

Admin account lifecycle and assignment use controlled atomic RPCs. Section
selection uses admin_set_assignment. Master removal archives entries after
reference-impact inspection and deliberate confirmation; existing links/history
remain, new assignments to archived entries fail, and current-year archival is
blocked. Audit filters query complete server history with deterministic timestamp
and UUID pagination. Legacy audit provenance remains unverified. Mandatory
transactional audit failure must roll back its business mutation.

Imports, certificates, manual backups and uptime monitoring remain unavailable.
Informational reports now support PDF/genuine XLSX/CSV for Intern/Instructor and
filtered Admin audit. See OWNER_HANDOVER.md and HANDOVER_AUDIT_2026-10-13.md for
the current categories, limits, authorization and local evidence. Password
recovery and M12 custom requirement/closed attendance/current-year controls
are implemented; do not replace them with unavailable placeholders.
Do not claim email, SMS, push, real-time messaging or certificate issuance.

Database: initial_schema.sql is for genuinely empty projects only. Never use the
legacy destructive schema.sql as an upgrade. M01–M12 are additive human-labeled
migration deliverables. M10 flexible submissions precedes M11 Admin history and
and M12 handover workflows must be installed before the current client. Existing M05/M09 historical gates
can remain deferred under the runbook; no migration silently repairs old data.
Inspect actual catalog, drift and ledger; never replay committed migrations.

Validate focused changes, then npm test, npm run lint and npm run build. Local
fixtures are disposable PGlite/native Postgres, never production. Optional browser
workflow tests use synthetic transports. Passing build/local tests do not prove
live JWT/RLS/Storage delivery. Count-checked reads have a 50,000-row bound and
are not transactional snapshots. Preserve drafts and distinguish unavailable,
empty, unverified and successful states. Keep controls labeled and keyboard usable.

Preserve unrelated user changes. Do not inspect/expose secrets or .env contents.
Do not apply SQL remotely, push, merge or publish without explicit authorization.
Report implementation choices separately from explicit client requests and state
actual validation results and remaining limitations.

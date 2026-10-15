# Company Attendance Sheet fallback — M17

Current workflow: [Supervisor logbook submission and M18 rollout](LOGBOOK_ATTENDANCE.md). Supervisor uploads signed paper evidence; the assigned Coordinator encodes and uses **Verify & Record Attendance** once. This supersedes new Coordinator uploads under M17. Historical records remain unchanged. Local only: no live migration, reset or deployment.


Prepared locally, 2026-10-14–15. This paper process replaces the proposed offline/PWA
attendance plan. No service worker, PWA, IndexedDB attendance queue or offline
synchronization was added. No live migration, reset, Auth change or deployment
was performed. User-confirmed target: `tcntyrwwqzyyqlzdtuer`; the stale CLI link
still points elsewhere and must not be used for rollout.

> The M17 sections below document the previous Coordinator-upload implementation and retained historical records. For all NEW entries, follow LOGBOOK_ATTENDANCE.md: Supervisor upload and one explicit Coordinator Verify & Record action.

## Short user guide

1. **Before an outage:** Intern opens My Attendance → Download blank company
   sheet. Coordinator can download sheets for assigned Interns in DTR Review.
   Choose the company and covered period, download the landscape A4 PDF, print
   in advance and keep copies at the company. The embedded PDF needs no internet
   to print afterward. A company logbook with all required fields is acceptable.
2. **During the outage:** Intern writes the date, actual Time In and Time Out,
   end date if overnight, signature and remarks. Company Supervisor signs and
   prints their name. This step works entirely on paper, without opening INSync.
3. **After service returns:** Coordinator opens DTR Review → Record Manual
   Attendance, selects an assigned Active Intern, enters the Manila dates/times,
   chooses a company reference and copies the company/Supervisor names from the
   signed sheet. Choose no internet/mobile data, system unavailable or Other.
   Other needs a meaningful explanation. Review the exact session/hours preview.
   Upload PDF/JPEG/PNG signed evidence, or reuse an authorized uploaded sheet.
   Confirm review of both signatures. Save creates **Unverified** attendance.
4. **Verify separately:** Open View manual attendance, review the encoded
   dates/hours, company/Supervisor information, encoder/time and fallback reason,
   then Preview signed evidence. Confirm that review and select Verify manual
   attendance. Saving alone never verifies attendance.
5. **Hours and DTR:** The entry uses the existing attendance ledger. Valid closed
   entries count toward logged hours immediately. Verified hours and clearance
   change only after explicit authorized verification. DTR/report exports and
   dashboards use the existing calculation and distinguish the manual source.

For transcription mistakes, the Coordinator may revise an **unverified manual**
entry with a meaningful reason, current evidence and renewed signature review.
Before/after values and actors remain in immutable history. Verified manual
records cannot be edited or deleted. This does not allow editing online punches.

## Existing rules preserved

Inspection found the existing M03 model permits **one session per Intern per
Manila start date**, one open online session, and a maximum **16-hour session**.
Those constraints remain. Same-day non-overlapping second sessions receive a
clear existing-model conflict; different start dates can use the same evidence.
Overnight sessions require an explicit Time Out date and still obey 16 hours.
No schedule, break deduction, new daily-hour cap or rounding policy is introduced.
The server stores exact elapsed seconds / 3600; the interface displays two
decimals using existing conventions. Source and verification filters do not alter
whole-ledger dashboard/clearance totals or the “Export all CSV” dataset.

Creation/revisions serialize with online clocking on the same Intern advisory
lock and with account/assignment operations on the existing lifecycle lock.
Exact duplicate, overlap, open-session, daily-identity, future-date, missing/reversed
timestamp and stale revision checks run on the server. Stable UUID retry identities
return the existing exact request; changed content fails. No rejection overwrites
or closes existing attendance. Online clocking and accomplishments remain intact.
Time Log Exception Request UI, queues, mutation grants and counts remain retired.

## Companies, evidence and privacy

Company references use stable UUIDs from current membership, retained Supervisor
assignment history or trusted company-assignment audit history. The Coordinator
must confirm the company appropriate to the **attendance date** from the paper.
Undated current membership is not invented as a historical placement timeline.
Registered company name, name printed on paper and Supervisor printed name are
captured separately and never silently updated on reassignment or renaming.
The paper signatory need not log into INSync; no Supervisor attendance-management
permissions are added. Unknown past company relationships require operator
reconciliation, rather than choosing an unrelated company.

New private bucket: **attendance-evidence**, PDF/JPEG/PNG, up to **10 MiB per file**.
Uploads use server reservations, 15-minute expiry, `upsert:false`, and final
metadata MIME/size validation before any attendance entry can reference them.
Storage policies deny public/Intern/Supervisor access, raw updates and committed
file deletion, including in the presence of permissive unrelated policies.
No Auth users, existing Storage objects or unrelated buckets are changed.

One sheet can cover several dates and several explicitly declared Interns in an
authorized company. Include **every Intern shown** in the sheet participants.
Staff access requires authorization for **all participants**; reassignment of any
participant removes access for staff who no longer have the whole scope. Existing
Admin oversight remains. Interns see only their own ledger rows/source/status and
details, and never receive paper-file paths, shared participant lists or signed
URLs. All paper evidence is staff-only, even for single-Intern uploads, preventing
accidental disclosure of multi-Intern logbooks.

Private previews use authorized 60-second signed links with PDF/image previews
and an accessible new-tab link. The preview/confirmation expires before another
verification attempt. Actual signature validity is the Coordinator's review;
the system does not automatically authenticate handwriting or infer signatures.

Upload progress shows actual reservation/upload/validation phases. Failed or
ambiguous responses retain the receipt and form for retry. Explicit Abandon unused
upload first cancels an unreferenced receipt on the server, then removes bytes
through Storage API. Referenced/previous revision evidence is always retained.
Unused reservations remain auditable. If authorization changed or cleanup cannot
be confirmed, cleanup remains an operator task; do not delete referenced bytes or
run an old reset/cleanup script to resolve it.

## Database and rollout

[M17_company_attendance.sql](supabase/migrations/M17_company_attendance.sql) is an
additive follow-up requiring reviewed M01–M16 final contracts and trusted
`postgres` ownership. Earlier migrations are unchanged. It adds source/encoding/
revision/verification metadata to `attendance_logs`, two private evidence/history
tables, explicit RPCs, restrictive Storage policies and mandatory audit/immutability
triggers. There is no parallel hours ledger or historical attendance rewrite.
Standard verification keeps its original RPC identity/signature and reviewed
interval checks. Manual entries use a separate explicit evidence-review wrapper
around the same private verification core; old generic verification cannot bypass it.

Prepared M17 SHA256:
`82e78408ea0bf4e93dfed172a63e92574eec9c546c30a268fb296cfa0b21692b`.

1. Obtain separate rollout authorization. Verify the target project banner and
   connection, migration ledger, owners/RLS/grants and a provider backup. Run
   [read-only inspection 09](supabase/inspection/09_company_attendance.sql). Never
   use a bare stale `--linked` command, reset script or `schema.sql` on this database.
2. Rehearse against an isolated copy. Apply any reviewed missing M15/M16
   prerequisites first, then **M17 before the new client**. An existing bucket with
   unexpected configuration aborts the migration; no unrelated bucket is changed.
   Record exact file hashes in the operator ledger; human M labels are not automatic
   CLI timestamp discovery. Refresh PostgREST schema cache after commit.
3. Publish the matching client only with deployment authorization. The old client
   keeps online clocking, existing attendance reads and ordinary verification.
   It may count newly created manual hours as attendance, but cannot verify manual
   rows through its generic button. Coordinate the short client upgrade window.
4. Verify actual provider uploads, signed delivery, current JWT/RLS/embedded reads
   and deployed UI with isolated accounts. Never test by encoding real students'
   attendance. Reconcile historical row counts unchanged and unrelated Storage/
   Auth inventories unchanged.

Offline generators now include final M01–M17 contracts: **25 application tables,
89 public routines, 59 public + 16 Storage policies, 47 public + one Auth trigger**.
The consolidated existing-database updater is an alternative reviewed final-state
upgrade; do not apply it and then replay M17. Fresh SQL is only for a verified
empty application catalog. Default fresh generation executes no SQL and prepares
no reset. No new environment variables or service-role frontend keys are needed.

## Changed files and local verification

- `src/components/CompanyAttendance.jsx`, scoped `companyAttendance.css`;
  Coordinator, Intern and Admin dashboards; AuditHistory categories.
- `src/lib/companyAttendance.js`, `companyAttendanceSheet.js`; report/DTR source
  columns in `reports.js` and `exports.js`.
- M17, inspection 09, both offline generators, regenerated fresh/consolidated SQL,
  migration/setup/context/decision/handover guides and verification inventories.
- `tests/company-attendance-postgres.test.js` uses actual isolated PostgreSQL
  RPCs, RLS, grants, audit failures and separate connections. It tests authority,
  hours, explicit verification, duplicate/overlap/open/date rules, shared-file
  scope, expiry/cancellation, provenance, revisions, immutability and old clocking.
- `tests/company-attendance.test.jsx` tests the client controls/validation,
  upload/recovery, exact hours/report data and actual multi-page PDF generation.
  Updated installation/updater assertions cover all new objects and reruns.
- `tests/browser/company-attendance-workflows.mjs` renders the actual React app
  with a synthetic transport, blocked remote requests and no environment loading.
  Checks download, 1920/768/375 forms, upload failure/retry/progress, lost-response
  save retry after refresh, revisions, private preview, explicit verification,
  own-Intern view and the actual CSV download. Browser fixtures do not prove live RLS.

Rendered evidence, PDF/CSV artifacts and result files are in the ignored
`.client-review/company-attendance/` directory. PDF pages are parsed and rendered
with PyMuPDF and checked for landscape A4 size, repeated headings, final date and
text bounds. Desktop/mobile screenshots supplement overflow assertions.
Physical printer output, assistive-technology sessions and live Supabase provider
delivery remain unverified. See FIX_PROGRESS.md for final test/lint/build results.

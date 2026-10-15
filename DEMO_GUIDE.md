# INSync demonstration guide — 2026-10-13

Current follow-up: [shared ratings, selectable feedback and Supervisor layout](EVALUATION_CONTROLS.md). Additive M16 and the matching client are prepared locally; M15 remains unchanged. No live migration, reset or deployment was performed.

Current 2026-10-14 deliverable: [Supervisor evaluations and correction retirement](SUPERVISOR_WORKFLOW.md). The user authorizes a fourth role and an additive upgrade for deployed project `tcntyrwwqzyyqlzdtuer`. M15 and the new client are prepared locally; no live schema change, reset or deployment was performed. Older correction-request/new-evaluation and three-role guidance below is historical and superseded.


Historical walkthrough: current reporting, recovery, M12 workflows and acceptance
instructions are in [OWNER_HANDOVER.md](OWNER_HANDOVER.md) and the
[handover feature/evidence matrix](HANDOVER_AUDIT_2026-10-13.md). Instructor/Intern
informational reports are now implemented; the unavailable-report notes below
describe the earlier audit. Never use old setup lists to omit required M12.

Local frontend and isolated database evidence is recorded in [AUDIT_DEMO_2026-10-13.md](AUDIT_DEMO_2026-10-13.md). **Live Supabase demonstration workflows have not been verified.** Use this guide to rehearse against an authorized disposable project before the client demonstration. The normal app contains no role preview, demo login, fixture injection or fake success mode.

## Setup and prerequisites

1. Use Node >=22.12 and the committed dependencies. Configure the intended project using `VITE_SUPABASE_URL` and its **public** publishable/anon key as documented in [WEB_SETUP.md](WEB_SETUP.md). Preserve an existing configured `.env`. Restart Vite after configuration changes. Never put a service-role key in the frontend.
2. An authorized operator must verify the target project and migration ledger. For an **empty disposable project only**, apply `supabase/initial_schema.sql` once, followed by this exact order:

   ```text
   M01_authority.sql
   M02_trusted_audit.sql
   M03_attendance_integrity.sql
   M04_private_documents_bucket.sql
   M05_validate_attendance.sql
   M06_rubric_hours.sql
   M07_account_lifecycle.sql
   M08_document_versions.sql
   M09_validate_domain.sql
   M10_flexible_submissions.sql
   M11_admin_history.sql
   ```

   For an **existing project**, first run reviewed read-only inspection scripts `01_metadata.sql`, `02_anomalies.sql`, `03_phase2_attendance.sql`, and `04_phase4_domain.sql` under `supabase/inspection/`. Apply **only unapplied migrations** with the documented prerequisites/ledger and separately authorized operator review. M05 and M09 may remain deferred for historical anomalies; their failure is not permission to alter/delete records. M04's independent ordering exception and all stopping gates are in [migrations/README.md](supabase/migrations/README.md). Do not use legacy `schema.sql`, broad policy patch, reset, or assume `supabase db push` discovers human M01 filenames.
3. Verify the `documents` bucket is private, 10 MiB per file, PDF/JPEG/PNG only, with the reviewed Storage policies and JSONB metadata contract. Verify the Auth confirmation setting, site URL and allowed redirect URLs. Actual email delivery and a confirmed login must be rehearsed with an authorized test address.
4. Prepare an authorized Active Admin, Active Instructor, and an assigned Active Intern, plus a Pending Intern to show approval. Public signup cannot create staff. If no authorized Admin exists, use the exact identity-checked operator bootstrap in [RUNBOOK.md](supabase/RUNBOOK.md), not client metadata. Keep test credentials outside repository documents. Add a company, section, reviewed current academic year and saved target. Assigned instructors cannot be deactivated/demoted while references remain; explicitly reassign/unassign first.
5. Use isolated fixture accounts/documents for mutations. Rehearse with a second instructor/intern to check foreign-access denial. Never send announcements or change real accounts/history merely to demonstrate a screen. Generate disposable PDF/JPEG/PNG evidence and label test messages clearly.

Missing-table/RPC errors require checking the **project and migration ledger**, not hiding the failed panel. `my_profile`/authority come from M01, evaluations from M06, lifecycle/assignment from M07, standard document history/version/access from M08, flexible submissions from M10, and full audit/archives from M11. Use the catalog checks at the end of each migration and the runbook. No live migration was applied in this session.

## Walkthrough

### Authentication and approval

1. Show full-screen login; toggle password visibility and demonstrate required-field validation. On a normal desktop, login and its errors fit without scrolling. Registration scrolls only the white panel, keeping branding stationary. On mobile/short screens, the form panel scrolls to every control.
2. Register a fixture Intern using the existing fields. Explain the actual confirmation email step when enabled; **email confirmation and administrator activation are separate**. Sign in with the confirmed Pending account and show the access gate.
3. As Admin, search Account Management, activate the fixture, then sign in as the Intern. After signout/reload, verify session behavior. A refreshed token should keep an unfinished form and route; an Inactive account must lose workspace access.

### Admin

1. Overview: real account/company counts and recent audit records. Do not call the unavailable uptime card connected monitoring.
2. Account Management: search, pages/page size, inspect role/status/company edit and Pending activation. Demonstrate a saved change only on a fixture account.
3. Interns: assign the fixture instructor, company and section; save a fractional target such as 500.25. Confirm the target from the Intern screen. Attach missing standard requirements only when supported/eligible; custom requirements stay distinct.
4. Master Data: show search/add/edit on disposable entries. Inspect archive impact, including references/current-year restriction; archive only a disposable eligible entry with explicit `ARCHIVE` confirmation. Existing assignment links must remain visible, and archived entries must disappear from new-assignment choices.
5. Bulk Import: download a blank planning CSV/XLSX and explain that imports are unavailable.
6. Audit Logs: search an actor/action/category and inclusive Manila date range; change pages/page size, refresh and export CSV. CSV covers **all authorized audit rows**, not only filtered or displayed rows; legacy provenance remains unverified.
7. Backup & Security: informational status only; real backup availability/restore must be checked by the authorized operator in Supabase.

### Intern

1. My Dashboard: assignment, saved target, announcements and calendar charts. Explain **logged versus verified** hours and verified completion progress. Unknown evidence stays Unknown/Unavailable.
2. My Attendance: clock in, show elapsed session, clock out with accomplishments. Clock-out logs hours and does **not** verify them. Correction requests/reviews are retired; demonstrate valid closed attendance verification through the Coordinator instead. Download the informational all-record DTR CSV; it is not an official certified summary.
3. My Documents: upload standard evidence, obtain a revision explanation, resubmit, and approve the current version. Open **File & review history** to show retained previous files and review decisions. Private links last at most 60 seconds; regenerate expired links. Version-zero legacy evidence needs explicit resubmission before new approval/clearance.
4. Create a flexible submission with two files; review/revise/resubmit or approve it. Show version/review history. Approval of flexible files does **not** satisfy the clearance checklist. Clearance additionally requires verified target hours and valid approvals for MOA, Endorsement, Consent, Medical and every current custom requirement.
5. My Evaluations: show the Instructor's persisted rubric/feedback; test calendar/custom date filters. Intern controls are read-only. Missing/invalid scores are Unavailable.
6. Reports: supported DTR CSV only; do not promise PDF/Excel summaries or certificates.

### Instructor

1. Class Dashboard/Progress Tracker: assigned roster, name/student-ID/company search, section filter, page size/pages, attention links and verified progress. Filtered lists do not redefine complete-roster totals.
2. Evaluations: review a submitted Supervisor fixture source, read original criteria/feedback, save the manual student-facing explanation, preview and publish. Ratings are preserved by default; an adjustment needs an internal reason. Server score is authoritative. Only use isolated fixture recipients.
3. DTR Review: approve the overnight fixture request, or reject another with a required explanation. Review selected pages/requests only; failed items/notes remain for retry. Approval must actually reconcile attendance, not only change the request badge.
4. Intern Documents: select the correct UUID-labelled assigned Intern, inspect current files/history, request revision with explanation, approve current evidence or revoke Approved to Pending. Review flexible file sets separately. A stale version/review conflict requires refresh.
5. Announcements: send only to isolated fixture recipients, personally or **My active roster**. Confirm the intended recipient sees it and a foreign fixture does not. Reassignment must not redirect an existing message. Show alert dismissal/error handling if fixture alerts exist.
6. Reports: categories are informational; downloads are unavailable.

## Avoid unavailable or unverified features

Bulk imports, certificate issuance, Instructor report downloads, Intern PDF/Excel summaries, manual backups and connected uptime monitoring remain intentionally unavailable. No implemented password-recovery flow exists. Do not present mocks, a build pass, local SQL impersonation, or link preparation as successful live email/JWT/Storage delivery. Keep source reference discrepancies explicit: the current Figma folder/ZIP contains auth only, not the 19 role designs.

## Validation and demo assessment

Run from the project root:

```powershell
npm run lint
npm test
npm run build
npm audit --ignore-scripts --json
node tests/browser/auth-workflows.mjs
node tests/browser/client-workflows.mjs
node tests/browser/redesign-workflows.mjs
node tests/browser/audit-workflows.mjs
git diff --check
```

Browser checks require the already available optional Playwright tooling under `.client-review/node_modules/playwright` and local Chrome/Edge; installation instructions are in [CLIENT_IMPROVEMENTS.md](CLIENT_IMPROVEMENTS.md). Run browser suites sequentially after heavy database/build jobs. They disable env-file loading and remote requests. Do not point synthetic fixtures at a real project. Do not run the saved-baseline replay as a passing regression suite: its purpose is to demonstrate the earlier failures.

Current results: build/lint pass; **2,238 tests across 17 files pass**; dependency audit has zero reported vulnerabilities. All four browser suites pass **57 groups** (auth 8, client 12, redesign 23, audit 14), including all 19 role destinations at five sizes and authentication at 13 sizes, with no browser exceptions. Existing large-chunk build warning remains. Results/screenshots are ignored `.client-review` artifacts; exact coverage and limitations are in the audit matrix.

- **Verified locally:** actual React navigation/forms and mocked success/failure workflows; actual isolated PostgreSQL definitions, RLS, grants, author/recipient/identity rules, rollback and concurrency; edge-to-edge/responsive auth scrolling and role layout checks.
- **Verified against live Supabase:** none in this audit.
- **Still needs setup/live rehearsal:** project/public configuration and migration ledger; confirmed fixture Auth identities/roles; actual emails, JWT/PostgREST joins/caps/RPC shapes; private object bytes, download/expiry/cleanup; actual frozen-recipient delivery; physical keyboard/zoom/screen-reader/other-browser checks.

The local implementation is suitable for continued rehearsal. A live demonstration assessment depends on completing those project-specific checks; this guide makes no deployment or production-readiness claim.

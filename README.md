# INSync internship monitoring

Latest plan, 2026-10-14: use a **new Supabase project** and preserve the old one.
Follow [new-project setup](supabase/INSync_New_Project_Setup_README.md), not reset
scripts. `.env.new` is a blank, ignored configuration template; the active `.env`
has not changed. New-project credentials, remote setup and acceptance are pending.

2026-10-14: the explicitly authorized test application database was reset and
rebuilt on the verified INSync.V2 project. Auth users/Storage objects were preserved
and established profiles reconciled. See [reset/rebuild execution and verification](supabase/INSync_Reset_Rebuild_README.md).
Fresh schemas now include M14's preserved last-Active-Admin protection. The reset
files are single-use for the captured old catalog; do not replay them on new data.

Current owner acceptance package: [handover and setup guide](OWNER_HANDOVER.md)
and [feature inventory, audit and verification evidence](HANDOVER_AUDIT_2026-10-13.md).
The current client requires reviewed M12 contracts for custom requirements,
ordinary attendance verification, explicit current-year setup and prospective
legacy file metadata preservation. Existing databases can use the guarded
[consolidated update guide](supabase/INSync_Consolidated_Update_README.md).
Live migration, Auth/email/Storage and deployed acceptance remain operator tasks.

Coordinator announcement/attendance repair and the Intern document-type dropdown:
read [the focused M13 operator guide](supabase/M13_Coordinator_Repair_README.md).
M13 installs controlled sending/scoped history access and the expected-timestamp
verification RPC. Existing databases can apply it independently when its prerequisites
match; no live execution is implied.

Current audit and local fixes (2026-10-13): [audit/status matrix](AUDIT_DEMO_2026-10-13.md)
and [client demo walkthrough/setup](DEMO_GUIDE.md). Local and mocked checks are
reported separately from live Supabase verification, which remains pending.

Client PDF improvements (2026-10-09) are implemented in the current checkout.
Read [delivery and deployment notes](CLIENT_IMPROVEMENTS.md) and
[the client checklist](CLIENT_REQUEST_CHECKLIST.md). Deploy reviewed **M10 then
M11 and M12 before this client**, after their documented prerequisites. Flexible
multi-file submissions are separate from legacy requirements and **do not change
clearance policy**. Audit history now filters the entire server history.

React 19 / Vite / Tailwind, Supabase Auth, Postgres and Storage. The browser
uses public keys; effective authorization belongs to RLS and controlled RPCs.
Remediation is in progress: see FIX_PROGRESS.md for all 39 findings and limits.
The system is not described as secure or production-ready.

## Local setup

For browser setup, the exact fresh Supabase SQL order, and first-Admin creation,
see [WEB_SETUP.md](WEB_SETUP.md). New empty projects start with the seed-free
[initial_schema.sql](supabase/initial_schema.sql), then M01-M14; existing projects
must use the inspection/upgrade runbook instead.

Use Node **22.12.0 or later** (supported test lines: 22 and 24), npm and the
committed lockfile. .nvmrc selects Node 22; Windows CI checks 22 and 24.

If the app is already configured on your client's laptop, copy its project-root
`.env` to this checkout's project root, then restart `npm run dev`. The `.env`
file is deliberately excluded from Git, so cloning the repository does not copy
the Supabase connection settings. Otherwise, start from the blank template below
and fill in the project's public settings before starting Vite. `.env.example`
contains no working project credentials; don't overwrite an existing configured
`.env` with it.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Set VITE_SUPABASE_URL to your HTTPS project URL and VITE_SUPABASE_ANON_KEY to
its publishable key (sb_publishable_...) or legacy anon JWT. HTTP is accepted
only for local loopback Supabase. Never use secret/service-role keys in VITE_
settings. All VITE_ values are public build inputs. Missing/malformed settings
render a setup screen without constructing a Supabase client; the guard validates
format, not key authenticity, project connectivity or RLS. Invalid real public
keys, unavailable services and expired sessions still require backend error
handling; remaining authentication/reliability work is tracked in Phase 5.
See [Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

Development and preview bind to 127.0.0.1 by default. Do not expose a dev server
to an untrusted network; use a reviewed deployment for shared access.

## Database setup and upgrades

**Do not run or re-run supabase/schema.sql against existing data.** It is a
legacy destructive bootstrap for fresh disposable projects only: it drops tables,
contains legacy authorization and hardcoded example seed data, and is not a repair
path. IF EXISTS does not make a reset safe. The old attendance policy patch is
historical, superseded by M01 and must not be used as an upgrade shortcut.
No reset helper is needed or supplied by this remediation.

Read [the runbook](supabase/RUNBOOK.md) and [migration guide](supabase/migrations/README.md).
Inspect the actual catalog and anomalies first; review each repair proposal before
any legacy-data change. Rehearse additive migrations on disposable synthetic data.
An operator must approve and apply reviewed migrations in the specified order,
record hashes, verify the catalog and coordinate client deployment. This session
never applies SQL to a real project. A genuinely new deployment needs an operator-
reviewed initial schema without demo seeds plus the reviewed migrations; the
legacy bootstrap alone is insufficient. `supabase/initial_schema.sql` supplies
that seed-free starting catalog for new empty projects; it still requires M01-M11
and disposable live checks. No live bootstrap/seed is automated.

Public registration always requests intern and creates intern/Pending. Pending
users can authenticate but have only own status access. Trusted first-Admin
bootstrap uses an Auth-verified UUID and controlled operator SQL described in the
runbook. Effective staff roles require Active Admin approval. Phase 4 adds atomic
account/assignment operations, validated hour targets, server-scored evaluations
and versioned document operations; deploy M06-M08 before this client. M09 is a
separate historical-validation gate, never a legacy-data repair.

All three dashboards use the same logged/verified hours, target, risk and clearance
rules. Clearance eligibility requires verified hours meeting the persisted target,
all four standard requirement types and approval of every current requirement.
Invalid or unavailable evidence yields unknown eligibility. Calendar periods use
Asia/Manila; charts show sums and retain the year. No certificate is issued.

Instructor Class Dashboard At Risk/Cleared cards now show complete assigned-roster
confirmed counts with Unknown notes and clickable filtered lists. They reuse the
existing D13 risk and clearance rules, with metadata-only refresh and Retry.
See [card implementation and deadline proposal](INSTRUCTOR_CARD_IMPLEMENTATION.md).

Uploads reserve server-generated paths for PDF/JPEG/PNG up to 10 MiB. Replacement
retains committed evidence and review history, resets current review, and checks
the expected upload/review versions. Failed or ambiguous responses are reconciled
before cleanup through the Storage API. Owners can retry unfinished-upload cleanup.
Legacy files remain readable but require resubmission before new approval/clearance.
View/Download prepares a signed link lasting 60 seconds; actual provider delivery
and deletion of file bytes still require disposable live verification. Interns
receive UUID-addressed personal and roster announcements with explicit feed states.

## Downloads and unavailable features

Admin can download blank student/instructor planning templates as CSV or XLSX,
and an audit CSV. Intern can export all their own DTR records as informational CSV,
independent of screen period filters. Exports fetch fresh RLS-scoped pages, check
counts and identities and stop on detected changes/errors. Limit: 50,000 records;
these reads are not a transactional snapshot. Legacy audit events are labeled
unverified. DTR separates raw stored, valid logged and verified hours; legacy or
invalid evidence remains unknown, with no invented totals or certification.
CSV cells are escaped against spreadsheet formulas. Download dispatch does not
prove a file was saved. XLSX writer loads only when requested.

Bulk import (including file selection/drag-drop) remains disabled: templates only
help plan records and do not provision accounts. Instructor reports, intern PDF/
Excel summaries/archives, certificates and manual backups are disabled and labeled
unavailable. Uptime monitoring is not connected. Verify real backup availability,
retention and restoration in the provider console; this UI cannot claim a backup.

Login and Intern registration use the downloaded Figma Make layout with real
Supabase authentication. Demo shortcuts and prototype credential handling have
been removed; VITE_DEMO_MODE no longer enables them. Registration retains the
existing optional school/student ID fields, requests only Intern, and requires
administrator activation. Confirmation instructions follow Supabase's returned
session. Operators must rotate any real account that reused the previously
published demo password; this session performs no real account inventory or rotation.

## Checks and deployment

```powershell
npm test
npm run lint
npm run build
npm audit --ignore-scripts
```

Tests use synthetic transports, PGlite and fresh loopback-only native Postgres;
no external database URL or real Auth/Storage endpoint is accepted. See tests/README.md
and supabase/tests/PHASE3.md and PHASE4.md for verification and limits. CI is authored here; its
remote execution is not claimed. Build success is compilation, not policy proof.

Set public environment values in the deployment build environment, run npm ci
and npm run build, and serve dist via HTTPS static hosting with an index.html
fallback. Environment changes require a rebuild/redeploy. Deploy the required
reviewed migrations before the corresponding client, refresh older clients, then
perform disposable Auth/PostgREST/Storage/browser checks in the runbook. Do not
serve source, .env files, test databases or credentials. No publication occurs here.

Vite 7.3.7 retains the existing esbuild pipeline, with React plugin 5.2.0,
esbuild 0.28.2 and source-map-js 1.2.2. Vite 7 requires a recent Node minor; see
[Vite 7 migration guidance](https://v7.vite.dev/guide/migration).
Its default browser baseline is Chrome/Edge 107, Firefox 104 and Safari 16;
verify the actual target devices separately. ESLint 9 is retained for the React
plugin's declared compatibility; its unsupported-major notice is a tooling risk,
separate from npm security advisories. Large dashboard chunks remain Phase 6.

# INSync client-demo audit — 2026-10-13

Historical audit. The subsequent [handover audit](HANDOVER_AUDIT_2026-10-13.md)
supersedes current feature availability and adds reporting/recovery/M12 workflows;
the original results and live-service limitations below remain historical evidence.

Current checkout audit, including the existing redesign and uncommitted client improvements. This record supersedes the current-state assessment in the historical October 7 audit; it does not erase its findings or prove their live deployment. Walkthrough: [DEMO_GUIDE.md](DEMO_GUIDE.md).

## Evidence and scope

Read project guidance, decisions, client-delivery/progress records, verification contracts, source, dependency scripts/lockfile, initial schema, M01–M11, RLS/grants/RPC/Storage definitions, and existing test coverage. Traced the controls on all 19 role destinations to their actual handlers. There is no applicable application-root AGENTS.md; the reference export's AGENTS.md was read. Existing dirty files were retained; a private, ignored source/hash snapshot separated this audit's edits from previous work. No credentials, accounts.txt, environment contents, real accounts/documents, or live announcements were used for tests.

The reference root is **`D:\Development\Projects\INSYNC.v2\figma-redesign`**. Reinspection of `figma-redesign.zip` found 31 files, a single root `package.json`, no nested project, and no differences from the extracted folder. ZIP SHA-256: `e99f123f6bbdef6afb208997a05500490dca342dbd5c47f3e68b0bf47e104d8f`.

`index.html` → `src/main.tsx` → `src/App.tsx` leads to LoginForm/RegistrationForm and imports only authentication components. There are **no Admin, Intern, or Instructor page components/navigation** in either current reference. All 19 role screens below are absent from the export, although implemented in the working application using its navy/teal design system. No older authentication export was used. No files were extracted over application code. Exact role-page visual matching cannot be established from this supplied reference.

## Feature-status and handler matrix

**B** = actual React UI in local Chrome, mocked Supabase transport; **D** = actual repository migrations/RLS/functions on isolated PostgreSQL fixtures; **U** = focused unit/transport checks. Every role destination was also inspected at five viewport sizes. None of these columns establishes live Supabase verification.

| Area / page | Supported controls and authority | Local evidence / status |
|---|---|---|
| Login / registration | Supabase Auth signup/signin/signout/listener; `my_profile` status/identity/role gate; original fields and password toggles | B/D/U: confirmation-on/off and obscured-existing-account wording, Pending restrictions, activation, role routes, restoration, failures, duplicate prevention; password recovery is not implemented and no recovery control is advertised |
| Admin — Overview | Complete authorized account/master counts and separate audit preview; navigation links | B/D/U: Unknown/Unavailable on failed reads; uptime explicitly unavailable |
| Admin — Account Management | Search, page size/pages, edit/status/activation; `admin_update_account` | B/D: activation success and failed edit/draft; D: atomic lifecycle, self-escalation denial, assignment restrictions, audit rollback |
| Admin — Interns | Instructor/company/section/target edits; `admin_set_assignment`, `attach_standard_docs` | B/D/U: persisted fractional target/assignment, validation and zero-row failure; D: standard attachment identity and concurrency |
| Admin — Master Data | Add/edit reference rows, search, archive impact/confirmation; `admin_master_impact`, `admin_archive_master` | B/D: native dialog, reference retention/current-year eligibility/new-assignment guards; no delete or automatic rollover |
| Admin — Bulk Import | Blank student/instructor CSV/XLSX planning templates | B/U: supported downloads; import/file processing remains disabled |
| Admin — Audit Logs | `audit_history` server actor/action/category/inclusive Manila-date filters/pages, Retry/refresh; separate full authorized CSV export | B/D/U: history beyond preview, filters/page contracts and download scope; legacy provenance retained |
| Admin — Backup & Security | Informational access/backup status | B: manual backups and uptime monitoring unavailable; no invented snapshots |
| Intern — My Dashboard | Assignment, separate logged/verified progress, calendar charts, announcements | B/D/U: saved target, weighted score, frozen recipients; explicit failed/unknown evidence |
| Intern — My Attendance | `clock_in`, accomplishment/`clock_out`, periods, overnight `submit_correction`, request history, informational full DTR CSV | B/D/U: success and failure/drafts, clock-out unverified, approved and rejected corrections; D: server dates, durations, duplicate/race protection |
| Intern — My Documents | Reserved private upload/finalize/recovery, replacement, clearance list, current signed access, retained file/review history; separate flexible multi-file sets | B/D/U: revision/resubmission/approval, previous versions/notes, history failure/Retry, flexible approval separate from clearance, partial-upload cleanup and unknown outcomes |
| Intern — My Evaluations | Read-only server result/criteria/feedback and Manila calendar/custom date filters | B/D/U: score 73 for 5/4/3/2, invalid legacy result unavailable, date validation; no submit controls |
| Intern — Reports | Informational full DTR CSV | B/U: CSV supported; PDF/Excel summaries and certificate issuance disabled |
| Instructor — Class Dashboard | Assigned roster summaries/attention, search/section/page controls and related navigation | B/D/U: 65-row filtering before pagination, full-roster counts, explicit failures/retry; D: assigned-only access |
| Instructor — Progress Tracker | Saved-target verified progress, separate logged hours, unknown evidence | B/D/U: complete authorized roster derivation; no invented pace/clearance |
| Instructor — Evaluations | Four 1–5 ratings, feedback, retry identity, `submit_evaluation`, history | B/D/U: successful submission and preserved failed draft; D: authoritative 25/35/20/20 score/idempotency |
| Instructor — DTR Review | Per-item/bulk `review_exceptions`, notes, selection across filtered pages | B/D/U: overnight approval, required rejection explanation, attendance unchanged on rejection; D: mixed failures/rollback/concurrent review |
| Instructor — Intern Documents | Current version/revision-guarded approve/revise/revoke, signed access, history; flexible review | B/D/U: standard revision/resubmission/approval/history and flexible approval; D: stale evidence denial, immutable records/Storage guards |
| Instructor — Reports | Informational report categories | B: all downloads accurately unavailable |
| Instructor — Announcements | Personal UUID/active-roster insert; database freezes recipient IDs; alert dismissal | B/D: both scopes, retained audience after reassignment, failures/draft, alert failure/retry; D: foreign/inactive recipient denial |

Shared navigation, sidebar collapse, mobile drawer, keyboard dialogs/focus, notices, empty states and contained table scrolling are exercised in the browser suites. The auth shell is edge-to-edge with a stationary desktop branding panel and sole right-panel scrolling. Login, including errors, fits normal desktop sizes; registration and narrow/short forms keep all controls reachable. The synthetic keyboard test models visualViewport shrink; physical mobile keyboard, screen reader, actual browser zoom and other browsers remain unverified.

## Confirmed defects and fixes

| ID | Observed failure / expected behavior | Root cause and smallest fix | Reproduction / retest |
|---|---|---|---|
| DEMO-01 | Delayed token refresh removed an unfinished evaluation and changed route; same-account refresh must retain the workspace while rechecking access | App set full-screen loading on every session object. Retain the verified identity for silent same-account revalidation; clear immediately on identity change and gate failed/status/role-invalid profiles | Four-failure saved pre-audit browser replay includes this failure; current audit browser asserts draft/route retention and Inactive/identity failure gates |
| DEMO-02 | Late getSession response resurrected a signed-out workspace; newer auth events must win | Restoration had only an unmount guard. Auth-event revision invalidates earlier restoration; signout also has an in-flight guard | Same saved baseline replay; current browser asserts sign-in remains after SIGNED_OUT plus late response |
| DEMO-03 | Rejected direct intern assignment read stranded all pages on loading; failed section must show unavailable without blocking other pages | Uncaught direct reads in Promise.all/name lookup/recovery and Admin audit preview. Normalize rejected reads, keep `data:null` plus error, preserve useful technical console diagnostics | Same saved baseline replay; current browser uses thrown transport, then reaches attendance; new unit checks distinguish failure from successful empty count |
| DEMO-04 | Thrown alert dismissal produced an unhandled exception without feedback; alert should remain until confirmed success | Direct update lacked try/catch/in-flight protection. Catch/diagnose, retain row, show refresh/retry guidance, disable duplicate request for that alert | Same saved baseline replay produced an unhandled mutation error; current browser retains alert and sees the error with no page exceptions |
| DEMO-05 | A 25-second signing response advertised expiry at 85 seconds after request start; short-lived links must not outlive the requested lifetime in UI | Expiry was calculated after response. Anchor deadline before signing; reject responses arriving after the deadline; accurately label links “up to 60 seconds” | Saved baseline helper returns `expiresAt:85000`; new fake-clock tests require 60000 and reject an already-expired response |
| DEMO-06 | Persisted clearance versions/review events were inaccessible from role UI; replacing a file should leave its earlier evidence/explanations inspectable | M08 already grants RLS-protected history reads and authorized historical Storage access, but no UI consumed them. Add read-only, requirement-ID-scoped dialog and re-read committed version before signing | Baseline source had no `document_versions`/`document_review_events` history query; browser checks both versions, revision note, approval, prior-file link preparation and failed-read Retry; unit checks reject staged/foreign/mismatched evidence |
| DEMO-07 | Inactive account was headed “pending activation”; restrictions must describe actual status | Static heading. Use an Inactive heading while retaining the existing activation gate | Auth/browser checks both distinct status headings and denial of dashboard access |

The new history dialog initially used an unsupported `open` prop on the existing mount-controlled Modal. Browser testing caught that integration regression; it is fixed by mounting only the requested dialog, and the final suites retest dialogs/scroll restoration. A test's outdated Inactive heading expectation and fixture identity/criterion labels were also corrected rather than weakening the assertions.

## Validation

| Command | Result |
|---|---|
| Baseline `npm test` | 16 files / 2,226 tests passed before audit changes |
| Final `npm test` | 17 files / **2,238 tests passed**; real isolated PGlite/native PostgreSQL migration, policy, fault and concurrency checks included |
| `npm run lint` | Passed, zero errors/warnings |
| `npm run build` | Passed, 778 modules; existing >500 kB chunk warning persists (largest ~997.78 kB, gzip ~285.98 kB) |
| `npm audit --ignore-scripts --json` | Passed, zero reported vulnerabilities |
| `npm ls --depth=0` | Passed, no invalid/missing top-level dependency |
| `node tests/browser/auth-workflows.mjs` | 8 groups passed, 13 viewport sizes; no browser exceptions |
| `node tests/browser/client-workflows.mjs` | 12 groups passed, no browser exceptions |
| `node tests/browser/redesign-workflows.mjs` | 23 groups passed, all 19 role destinations at five sizes (95 views); no browser exceptions |
| `node tests/browser/audit-workflows.mjs` | 14 groups passed: complete mocked success/failure workflows, identity change, history Retry/mobile dialog; no browser exceptions |
| `git diff --check` | Passed; existing LF/CRLF conversion notices only |

Browser scripts load actual React screens with an explicitly substituted **mocked** Supabase client, `envFile:false`, and remote browser requests blocked. The mocked success paths are handler/UI integration evidence, not JWT/PostgREST/Auth/Storage delivery proof. SQL suites independently execute actual definitions in disposable local databases. Generated results, baseline failure evidence and screenshots are under ignored `.client-review/`.

All four final browser suites passed **57 check groups** in total. Desktop login
and mobile registration screenshots were visually inspected, as was the new
mobile history dialog. A production-asset marker check found no audit/browser
fixture markers. Hash comparison confirmed all 14 snapshotted SQL/package files
unchanged; the application entry point is retained. No outstanding reproduced
local code defect or failed final automated check remains from this audit.

## Deployment blockers and remaining differences

No live catalog was available/tested here, so no specific deployed table/RPC is claimed missing. Required definitions already exist in M01–M11; the tests found no new independently reproducible database-definition defect. **No SQL migration, schema, RLS or Storage policy was changed or applied by this audit.** Existing live migration status remains unknown. M08 history tables/access, M10 flexible submissions and M11 audit/archive contracts must be present before their screens can work against a project. Follow the exact operator steps in [DEMO_GUIDE.md](DEMO_GUIDE.md), [migrations/README.md](supabase/migrations/README.md) and [RUNBOOK.md](supabase/RUNBOOK.md); do not reset real data or guess at historical repairs.

Unverified live items: public configuration/project association, actual email confirmation and Auth identities, first-Admin/role fixtures, deployed grants/policies/functions, PostgREST joins/row caps/RPC response shapes, private object bytes/delivery/expiry/cleanup, and real recipient delivery. No publishing/deployment occurred. Large bundle and count-checked nontransactional reads remain documented limitations; equal-count concurrent changes can escape snapshot detection. UI styling preserves the existing navy/teal design; missing role exports prevent a page-specific Figma comparison. Standard-history layout follows the shared system because that screen is absent from the export.

## Files changed in this audit

- `src/App.jsx`: session event ordering, draft-preserving revalidation, identity/status/role validation, inactive heading and signout guard.
- `src/lib/requests.js`, Admin/Intern dashboards: explicit direct-read failures/diagnostics.
- Instructor dashboard: safe alert dismissal; both document role pages: shared history entry point.
- `src/components/DocumentHistory.jsx`, `DocumentActions.jsx`, `src/lib/documents.js`: retained evidence/history and conservative private-link lifetime.
- `tests/demo-audit.test.js`, `tests/browser/audit-client.js`, `audit-workflows.mjs`: focused regression and complete mocked workflow checks; existing browser fixtures updated for actual identities/headings.
- `eslint.config.js`: excludes only the generated pre-audit snapshot from lint, preserving application/test checks.
- This audit, `DEMO_GUIDE.md`, README, FIX_PROGRESS, tests README and historical audit pointer.

`package.json`, lockfile, environment files, application entry point, current reference export, database definitions and unrelated existing source edits are preserved.

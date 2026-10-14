# INSync redesign integration

## Authentication scrolling correction — October 13, 2026

This supersedes the initial document-scrolling authentication layout described
below. The previous minimum-height grid grew with registration and moved both
panels. Authentication now has a viewport-height vh/dvh shell with zero minimum
child heights, a stationary branding column, and one scrollable white form panel.
Login spacing fits normal desktop heights including validation; short/mobile/
zoom layouts retain scrolling. A shell-local visualViewport resize listener also
handles keyboard overlays and is removed when authentication unmounts. No global
overflow lock is used. The illustration retains its original SVG drawing and
proportions; its slot and branding spacing adapt to height. Switching screens
resets the form-panel scroll position. Handlers, fields and policies are unchanged.

Local Chrome checks cover 13 viewport sizes, field/server errors, registration
wheel scrolling with unchanged branding coordinates, all fields/notices/actions
reachable, a synthetic visual-viewport keyboard shrink/recovery, and actual
dashboard scrolling after all three role sign-ins. No real mobile device/keyboard
or live authentication was used. Build/lint and diff checks pass.

## Inspection and implementation plan

Read the workspace README, AI_CONTEXT_PROMPT, DECISIONS, CLIENT_IMPROVEMENTS,
FIX_PROGRESS, source, authentication components, shared workflow/domain helpers,
package scripts, existing browser fixtures, and the supplied Make export.
There is no workspace/ancestor AGENTS.md. The reference export's AGENTS.md applies
to that reference tree; its TypeScript/Vite 8 scaffold is not the application stack.
The working tree already contained substantial client improvements and authentication
work. This integration builds on that work without resetting it.

Plan: correct full-screen authentication; reuse the export's identity and tokens;
build shared dashboard navigation and presentation components; adapt all existing
pages and associated workflows; verify business behavior and responsive layouts
using existing local synthetic testing arrangements. No backend rewrite or deployment.

## Reference export and gaps

Initially `figma-redesign` was absent. The supplied `figma-redesign.zip` was safely
extracted into that directory without overwriting existing files. After the user
reported a complete updated export, both the folder and ZIP were re-inspected.
The visible export still contains only:

- `src/App.tsx`: login, registration, validation, and registration result UI.
- `src/components/auth/`: AuthLayout, FormField, PasswordField, Notice,
  SubmitButton, and icons.
- `src/index.css`: navy/teal/mint/canvas tokens, Inter/system typography,
  and reduced-motion rules.
- `public/favicon.svg`: favicon; the branding illustration is an inline SVG in
  AuthLayout. There are no additional dashboard assets or font files.

The ZIP inspected was 40,133 bytes, last modified October 12, 2026 at 9:14 PM.
Following the user's explicit reinspection request, all hidden/nested folder
files and every ZIP entry were enumerated. All **31 archive files match the
folder byte-for-byte**; there are no folder-only files and exactly one manifest,
`package.json` at the root. A separate extraction is unnecessary because there
are no different or newer archive files. Exact reference root:
`D:\Development\Projects\INSYNC.v2\figma-redesign`.

Supporting entry-point evidence, inspected directly in both folder and archive:

1. `index.html` loads `/src/main.tsx`.
2. `src/main.tsx` imports `./App` and `./index.css` and mounts `App`.
3. `src/App.tsx` declares `Screen = "login" | "register"`, imports only React and
   AuthLayout/FormField/Notice/PasswordField/SubmitButton, and its default component
   renders only `LoginForm` or `RegistrationForm`. There are no role routes or
   dashboard navigation destinations in the entry-point/import graph.
4. Every source component reachable from App is under `src/components/auth`.
   AuthLayout imports only React and its Icons module. No alternate entry point,
   role-page component, hidden nested project, or role-screen source was found.
5. `plans/insync-auth-interface.md` expressly describes Login and Intern Registration
   as the prototype scope. This is supporting evidence, not authority for the real
   application's behavior.

Archive SHA-256:
`e99f123f6bbdef6afb208997a05500490dca342dbd5c47f3e68b0bf47e104d8f`.
The machine-readable enumeration/hash/import audit is saved locally in
`.client-review/reference-audit.json` (ignored testing artifacts).
The older `figma-auth-ui` directory and ZIP are not used as design references.
No Admin, Intern, or Instructor dashboard screens, page components, navigation
layouts, role preview screens, or dashboard dialogs are present in this reference.
All 19 role-page layouts below therefore adapt the actual application using the
export's established design system. Exact dashboard-layout fidelity cannot be
claimed without those reference screens. The export remains intact.

Specific missing screens: Admin Overview, Account Management, Interns, Master Data,
Bulk Import, Audit Logs, Backup & Security; Intern My Dashboard, My Attendance,
My Documents, My Evaluations, Reports; Instructor Class Dashboard, Progress Tracker,
Evaluations, DTR Review, Intern Documents, Reports, Announcements. Their associated
role dialogs/detail panels are likewise absent. Each existing real destination
is still integrated and tested using the current reference's visual tokens.

## Page mapping and coverage

| Role | Existing destination | Visual reference / integrated coverage |
|---|---|---|
| Shared | Login | Export login; real Supabase sign-in, validation, visibility toggle, loading, errors |
| Shared | Registration | Export registration; existing name, email, password, confirmation, optional student ID and school retained; Intern/Pending and accurate email confirmation instructions |
| Admin | Overview | Shared design system; real counts/unavailable monitoring, recent accounts, audit preview |
| Admin | Account Management | Shared design system; search, pagination, status badges, role/status editing dialog, lifecycle handlers |
| Admin | Interns | Shared design system; assignment search/pages, instructor/company/section/target controls, standard requirement provisioning |
| Admin | Master Data | Shared design system; search, add/edit dialogs, archive impact and explicit archive confirmation |
| Admin | Bulk Import | Shared design system; disabled import, supported blank CSV/XLSX planning-template handlers |
| Admin | Audit Logs | Shared design system; complete server history filters/pages, provenance, refresh/retry, full audit CSV |
| Admin | Backup & Security | Shared design system; role-permission cards, explicitly unavailable backup/monitoring |
| Intern | My Dashboard | Shared design system; assignments, announcements, attendance shortcut, logged/verified metrics, chart, progress, evaluation preview |
| Intern | My Attendance | Shared design system; real clock handlers/accomplishment dialog, period filters, validated DTR display, overnight corrections and history |
| Intern | My Documents | Shared design system; flexible multi-file submission/resubmission/history/recovery; separate legacy clearance checklist, upload/replacement, private signed file actions |
| Intern | My Evaluations | Shared design system; read-only records, existing criteria/feedback, inclusive Manila date filters, invalid/empty/error states |
| Intern | Reports | Shared design system; all-own informational DTR CSV; disabled PDF/Excel/archives/certificate |
| Instructor | Class Dashboard | Shared design system; scoped roster search/section/pages, full-roster totals, attention shortcuts |
| Instructor | Progress Tracker | Shared design system; verified target progress, separate logged hours, risk/clearance evidence |
| Instructor | Evaluations | Shared design system; existing four-criterion weighted form, server-scored save, records, failed drafts |
| Instructor | DTR Review | Shared design system; scoped correction queue, selection across pages, review/rejection notes, individual outcomes/history |
| Instructor | Intern Documents | Shared design system; scoped intern selection, flexible review/version history, legacy requirements, revision explanations, approve/revoke/file handlers |
| Instructor | Reports | Shared design system; categories and clearly disabled downloads |
| Instructor | Announcements | Shared design system; individual/active-roster recipient selection, existing insert, saved feed, scoped alerts and dismissal |

## Shared implementation

- `src/components/Brand.jsx`: reuse the export's link mark and navy/teal wordmark.
- `src/components/UI.jsx`: page headers/action slots, metric cards, labeled status
  badges, loading, empty states, error notices with retry.
- `src/components/Shell.jsx`: unchanged role-tab architecture, navy sidebar,
  accessible collapse controls, full mobile drawer, bottom navigation, account
  menu/sign-out, skip link and focus/scroll reset on destination changes.
- `src/components/auth/AuthLayout.jsx`, `auth/auth.css`: edge-to-edge 45/55
  desktop panels; no outer margin, padding, maximum width, shadow or rounded card;
  100% width and vh/dvh minimum heights; only inner form width is constrained.
  Flex auto margins center content when space permits and safely start above it
  when content is tall. Compact mobile branding and ordinary document scrolling.
  Original illustration, headline and desktop feature pills retained.
- `src/index.css`: shared navy/teal tokens, scoped dashboard/dialog presentation,
  responsive contained tables, controls, focus and reduced-motion rules. Both
  reference trees excluded from Tailwind source scanning.
- `ListControls`, `Modal`, `Toast`, `DocumentActions`, `AnnouncementsFeed`,
  `AuditHistory`, `Submissions`: reusable presentation and accessibility updates.
  Native dialogs retain focus trapping/Escape/return focus; dialog-local notices
  keep failed saves visible in the native top layer.
- Existing role components keep their actual data fetching and mutation handlers.
- `src/App.jsx`: shared branding/loading/status gates; failed signed-in profile
  retrieval has an explicit unavailable/retry state, stale profile replies are
  ignored, and local logout clearing follows a successful sign-out response.
  Failed initial session restoration exits loading and shows sign-in with an error.
  The existing Supabase session listener, role routes and activation requirements
  remain in use.

Meaningful display fixes: unavailable reads no longer produce misleading recent
evaluation empty states, missing correction history, zero-result pagination, or
an empty attendance chart. DTR cells use the existing attendanceEvidence helper;
raw historical hours remain visible, invalid evidence is Unknown, overnight end
dates are explicit, and logged/verified hours are displayed separately. No records
or calculation policy are changed.

Browser runners have separate ignored Vite caches so their different synthetic
transports cannot race over a shared optimizer cache. ESLint excludes only those
generated cache directories, while application and authored browser tests remain
checked. No dependencies were added.

## Preserved boundaries

React 19/JSX, Vite 7, Tailwind 4, Supabase clients, Recharts and dependencies retained.
No package/environment/entry-point wholesale replacement, service credentials,
prototype data, role switchers, simulated application mutations, artificial delays,
or new backend are introduced. No schema, RLS, RPC authorization, private Storage
policy, relationships, or historical records are modified.

Existing clock/correction, clearance, rubric, assignment, archive, export,
file-version/review/recovery and frozen announcement-recipient semantics remain
authoritative. Missing support stays unavailable. Prototype authentication is not
imported. No password recovery exists in the inspected working login component;
no unsupported recovery flow is invented.

## Validation

| Check | Result |
|---|---|
| `npm test` | 16 files, all 2,226 tests passed, including disposable local Postgres checks. The final session-restoration guard also passed 18 focused phase3-config checks and the authentication browser suite. |
| `npm run lint` | Passed. Authored frontend/tests are checked; generated browser dependency caches are excluded. |
| `npm run build` | Passed, 776 modules. Existing large eager bundle warning remains (main JS approximately 992 kB / 284 kB gzip). |
| `git diff --check` | Passed; Git prints existing LF/CRLF notices for prior modified files. |
| Auth browser | Nine viewport sizes, including 1440/1024 desktop at 420px height and mobile at 360px height; full-screen geometry, 45/55 split, fields/actions reachable, validation/password toggles, Pending/Inactive gates, signup confirmation, persisted sessions and all three role routes. |
| Workflow browser | Real React screens using existing synthetic transports: scoped roster search/pages/totals; two-file upload/revision/resubmission/history/recovery; 60-second signed-link expiry; full audit filtering; archival/focus/Escape; unavailable/read retry. |
| Redesign browser | All 19 destinations at 1440×1000, 1440×360, 720×500, 390×844 and 320×360. Desktop collapse/mobile drawer, native-dialog failed drafts, assignment saving, announcements, supported CSV dispatch, unavailable actions, profile error/retry and overnight/legacy DTR evidence. |

All browser runs use local Chrome/Playwright, disable environment loading and
block remote requests. Screenshots/results are saved in ignored `.client-review`.
The current export's illustration was also compared directly with the working
component and is identical. Some fixture RPCs (account mutation, clocking,
correction, evaluation) deliberately lack success implementations: browser checks
verify the actual handler reaches that RPC and preserves a failed draft, not a
successful live operation. Existing SQL/helper/transport suites provide separate
local verification. Downloads prove browser dispatch, not provider delivery.

Transient browser startup timeouts occurred while running builds/native SQL and
browser servers concurrently. The runners now use separate caches within ignored
test `node_modules` and are validated without those competing jobs; application
checks are not disabled or weakened.

## Backend/deployment limitations

This frontend work does not establish the live database catalog or migration state.
The existing project requires operator-managed migrations through M11 (including
M10 flexible submissions and M11 audit history), as documented in the README and
Supabase runbook. No remote catalog was inspected or SQL applied, so no actual
missing deployed table/RPC is claimed or concealed. Missing-retrieval errors remain
visible. Historical validation gates and current-academic-year/cohort limitations
remain documented in DECISIONS/FIX_PROGRESS. Existing eager bundle size is a
separate performance limitation.

Real email delivery, JWT/RLS behavior, Storage byte delivery, real mobile keyboards,
screen readers, other browsers and live Supabase deployments remain unverified.
No publication, deployment, production-readiness claim or live-record mutation.

## Remaining visual differences

All dashboard layouts are design-system adaptations because the visible supplied
export lacks them. Authentication deliberately uses the requested full-screen
panels instead of the export's rounded outer card and retains the application's
school field and optional student ID policy. Primary teal is #0e837d rather than
#0f8c85 so white action text meets contrast requirements. Typography falls back
to system sans-serif when the existing remote Inter font cannot load.

# Client improvements — 2026-10-09

Controlling reference: all nine pages of `INSYNC.UI.Mock(1).pdf`, including
screenshots and comments, reviewed before edits. Screenshots use 80% zoom;
implementation targets normal zoom and mobile. Starting checkout:
`3c057ee9335ef7cecb3be750e061d3caf9999c1c`. No applicable AGENTS.md found.
The untracked PDF and user screenshot are preserved.

| Request | Affected implementation | Status |
|---|---|---|
| Preserve intern dashboard/attendance; improve readability | InternDashboard, shared CSS | Complete |
| Organize instructor roster/progress, search, section, pagination | InstructorDashboard, list helpers/controls | Complete |
| Evaluation calendar date filters | InternDashboard, date/list helpers | Complete |
| Flexible multiple-file submissions, revisions, history, recovery | Submissions, submissions helper, M10 | Complete |
| Preserve legacy checklist and clearance | Existing M08/business/metrics; separate submissions UI | Complete |
| Simplify instructor filters, add Admin section assignment | InstructorDashboard, AdminDashboard | Complete |
| Preserve announcements | Existing snapshots/feed; mutation feedback | Complete |
| Admin overview/accounts/master/audit usability | AdminDashboard, AuditHistory, M11 | Complete |
| Responsive/accessibility/error states | Shared Modal, CSS, changed forms; Chrome desktop/mobile | Complete |
| Meaningful local SQL/client coverage; test/lint/build/browser | tests/client-*; final results in FIX_PROGRESS | Complete |
| Migration order, defaults, compatibility, limitations | CLIENT_IMPROVEMENTS, DECISIONS, setup/runbooks | Complete |
| Actual deployed Auth/RLS/Storage, other browsers/screen readers | Separately authorized disposable provider acceptance | Partial — not executed |

No implementation item is Blocked. Completion refers to local deliverables;
reviewed migrations have not been applied remotely. The current revision had no
functional academic-year roster selectors to remove; the new filters use only
the actual section relationship. Archival is the documented history-preserving
implementation of master removal. See CLIENT_IMPROVEMENTS.md for remaining limits.

Explicit PDF requests: flexible document types and multiple files, required
revision description, evaluation date filtering, organized student lists, removal
of redundant year selectors, Admin layout/review. The PDF approves attendance and
announcements and permits useful improvements. Title/description fields, bounded
file sets, pagination sizes, soft archival and accessible controls are implementation
choices implementing this request, not additional institutional policies.

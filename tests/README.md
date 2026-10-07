# Local baseline tests

Run `npm test` (one run), `npm run test:watch` (local watcher) and `npm run lint`.
Node 24.18.0 was used in Phase 0; runtime alignment is tracked under INS-037.
Vitest uses its own config and Node environment. Tests replace global fetch with
a throwing stub; the SDK probe supplies its own in-memory response, never a remote
endpoint. Tests never import the application Supabase client or read .env files.

`audit-baseline.test.js` permanently records seven audit probes as **characterization
tests of known defects**, not proof of correctness. Its 11 cases include numeric
input variants. Source extraction is intentionally temporary: it binds probes to
actual handlers/calculations while Phase 0 forbids application behavior changes.
When a finding is fixed, replace that probe with shared-module or transport tests
asserting the desired result; do not preserve buggy behavior just to keep it green.

| Probe | Finding | Replacement acceptance |
|---|---|---|
| UTC/local reconstruction | INS-012 | Manila date boundaries, actual elapsed instants, overnight lookup |
| computeHours overnight/seconds | INS-016 | Positive valid overnight duration; invalid claims rejected |
| required-hours coercion | INS-018 | Explicit finite range/precision validation, persisted value |
| Zero-row assignment handler | INS-039 | Conflict/error, draft retained, no local success/audit |
| SDK maybeSingle cardinality | INS-011 | Keep SDK limitation check; add DB uniqueness/concurrency suite |
| Month/year chart aggregation | INS-025 | Calendar periods and year-aware sums from shared derivation |
| Token contrast | INS-034 | All supported status/action foreground-background pairs >=4.5 |

SQL fixtures and policy test plan: `../supabase/tests/FIXTURES.md`. These are not
implemented/executed policy tests yet. No build/test result asserts deployed RLS,
Postgres transactions, Storage privacy, Auth, browser or accessibility correctness.

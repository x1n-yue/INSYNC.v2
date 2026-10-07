# INSync remediation progress

Updated 2026-10-07, Phase 0 only. Owner: repository remediation agent. Both audit
and checklist read in full before edits. Starting HEAD `75998c0` (the audit refers
to an earlier source revision); working tree was clean. No applicable AGENTS.md
found in workspace/ancestor locations. No application source, bootstrap, legacy
patch or Vite application configuration changed. No SQL/remote Supabase execution.

**Phase 0 deliverables and local validation complete.**
All 39 findings remain **Not-fixed** because Phase 0 establishes the baseline only.
Tests that reproduce defects must not be interpreted as fixes or deployed security
evidence. Defaults are recorded in `DECISIONS.md` and can be revised before their
phase. Continue only on the user's “continue”; Phase 1 has not started.

## Phase 0 artifacts and checks

- `package.json`, `package-lock.json`, `vitest.config.js`, `eslint.config.js`:
  Vitest, lint and test/watch scripts, isolated Node tests. Application build/dev
  configuration left intact. Vitest 4.1.11, ESLint/@eslint/js 9.39.5, React lint
  plugin 7.37.5, hooks plugin 7.1.1, globals 17.13.0 pinned as dev dependencies.
- `.env.example`: two public browser placeholders only; startup guard is Phase 3.
- `tests/setup.js`, `tests/audit-baseline.test.js`, `tests/README.md`: seven audit
  probes in 11 characterization cases with no live transport or app-client import.
- `supabase/inspection/01_metadata.sql`, `02_anomalies.sql`, `README.md`,
  `REPAIR_PROPOSAL.md`: unexecuted read-only catalog/anomaly inventory and per-group
  review proposal, covering duplicates, partial checklists, hour targets, role/
  assignment, rubric, time/review, paths/orphans and current-year flags.
- `supabase/tests/FIXTURES.md`: disposable role/status/scope fixture specification,
  full 12-table/Storage contract and RT-01 to RT-22 acceptance plan; not an executed
  policy suite. `supabase/RUNBOOK.md`: preparation gates only; migrations pending.
- `DECISIONS.md`: conservative defaults and implementation/change points.

Validation environment: Windows PowerShell, Node **24.18.0**, npm **11.16.0**.

| Check | Actual result / limit |
|---|---|
| Pre-edit `npm run build` | Passed, Vite 5.4.21, 673 modules. JS 931.35 kB / gzip 260.18 kB; CSS 22.80 kB / gzip 5.35 kB. >500 kB warning. |
| Post-edit `npm test` | Passed on Vitest 4.1.11: 1 file, 11 cases; known defects reproduced, synthetic SDK transport only. |
| Post-edit `npm run lint` | Passed: zero errors, six existing unused imports (3 Admin, 3 Instructor). Generated Vite timestamp config files excluded after one concurrent build/lint run raced a deleted temporary file. |
| Post-edit `npm run build` | Passed, 673 modules; same JS/CSS bytes, hashes and sizes as pre-edit baseline. >500 kB warning persists. Compilation only. |
| `npm ls --depth=0` | Passed with final pinned tooling; no invalid top-level dependency. |
| `npm audit --ignore-scripts` | Exit 1: 3 remaining packages, Vite (high), source-map-js (high), esbuild (moderate); existing Phase 3 debt. Initial 3.x Vitest trial added advisories and was replaced; none of those remain. No forced audit fix. |
| Lockfile/application diff | Existing production dependency versions unchanged; application source/bootstrap/legacy patch/Vite config unchanged. `git diff --check` passed. |
| Inspection/policy SQL | Authored and statically reviewed only; no Postgres parser/server/live result. Requires operator rehearsal on disposable data. |
| Browser / accessibility / real Auth / Storage | Not executed. |

ESLint 9 is marked unsupported by npm; latest 9.x retained for React lint plugin
peer compatibility. Reassess in Phase 3. Runtime floor mismatch and exposed dev
host remain open. Vitest has an independent nested Vite; root application Vite is
unchanged. No fresh Node 22 install/CI/browser validation is claimed.

## Finding register

Files listed are Phase 0 evidence/preparation; runtime fixes and SQL migrations
will be recorded when implemented. “Pending RT” means a verification specification,
never a passing test. Baseline probes are in `tests/audit-baseline.test.js`.

| ID | Status | Phase 0 files / evidence | Tests / next phase and remaining risk |
|---|---|---|---|
| INS-001 | Not-fixed | inspection/01_metadata.sql; FIXTURES.md; D08 | Pending RT-01/02/03; Phase 1; self-role/status field escalation unchanged. |
| INS-002 | Not-fixed | FIXTURES.md; D08 | Pending RT-01; Phase 1; signup still trusts role metadata. |
| INS-003 | Not-fixed | inspection/01_metadata.sql; FIXTURES.md | Pending RT-03/04/19; Phase 1; Pending/Inactive DB/Storage scope unchanged. |
| INS-004 | Not-fixed | inspection/01_metadata.sql; FIXTURES.md; D09 | Pending RT-03/04; Phase 1; global instructor/ownership mutation exposure unchanged. |
| INS-005 | Not-fixed | inspection/01_metadata.sql; FIXTURES.md | Pending RT-02/03; Phase 1; unrelated profile/assignment enumeration unchanged. |
| INS-006 | Not-fixed | FIXTURES.md; D07 | Pending RT-03/16; Phase 1; author/audience enforcement absent. |
| INS-007 | Not-fixed | inspection/02_anomalies.sql; D01-D04 | Pending RT-03/08/10; Phase 1; attendance/correction field forgery unchanged. |
| INS-008 | Not-fixed | inspection/02_anomalies.sql; D10/D11 | Pending RT-03/07/15; Phase 1; owner checklist/review forgery unchanged. |
| INS-009 | Not-fixed | inspection/01_metadata.sql; D15 | Pending RT-12/20; Phase 2; client audit forgery/omission unchanged. |
| INS-010 | Not-fixed | FIXTURES.md; RUNBOOK.md | Pending RT-11/12/13; Phase 2; partial approval/races unchanged. |
| INS-011 | Not-fixed | baseline SDK probe; inspection/02_anomalies.sql; D01 | Probe passes demonstrating limitation; pending RT-08/12/13; Phase 2; no daily uniqueness yet. |
| INS-012 | Not-fixed | baseline date probe; D02/D03 | Probe reproduces +24h; pending RT-09/17; Phase 2; UTC/local mismatch unchanged. |
| INS-013 | Not-fixed | RUNBOOK.md; inspection/README.md | Pending RT-22; Phase 3; old bootstrap/README unsafe wording unchanged, runbook forbids existing-data use. |
| INS-014 | Not-fixed | package tooling; audit baseline recorded above | Pending RT-22; Phase 3; 3 existing vulnerable packages/dev host remain. |
| INS-015 | Not-fixed | inspection/01_metadata.sql; D11 | Pending RT-04/15; Phase 2; deployed bucket privacy unknown, existing-public repair absent. |
| INS-016 | Not-fixed | baseline computeHours probe; inspection/02_anomalies.sql; D03/D17 | Probe reproduces zero-clamp/second loss; pending RT-09/10/12; Phase 2. |
| INS-017 | Not-fixed | inspection/02_anomalies.sql; FIXTURES.md; D12 | Pending RT-14; Phase 4; malformed/null/inconsistent scores still accepted. |
| INS-018 | Not-fixed | 5 baseline numeric cases; inspection/02_anomalies.sql; D06 | Coercion reproduced; pending RT-05/17; Phase 4; no validator/CHECK yet. |
| INS-019 | Not-fixed | inspection/02_anomalies.sql; D09 | Pending RT-05; Phase 4; lifecycle/assignment partial commits unchanged. |
| INS-020 | Not-fixed | inspection/02_anomalies.sql; D10 | Pending RT-07; Phase 4; duplicates/partial provisioning unchanged. |
| INS-021 | Not-fixed | FIXTURES.md; D11 | Pending RT-04/15; Phase 4; no private View/Download UI yet. |
| INS-022 | Not-fixed | inspection/02_anomalies.sql; D10/D11 | Pending RT-15; Phase 4; upload/version/cleanup races unchanged. |
| INS-023 | Not-fixed | FIXTURES.md; D05/D15 | Pending RT-20; Phase 3; simulated operations still claim success. |
| INS-024 | Not-fixed | duplicate-name fixtures; D07 | Pending RT-16; Phase 4; Intern inbox/UUID targeting absent. |
| INS-025 | Not-fixed | baseline chart probe; D02/D04/D05/D13 | Cross-year averaging reproduced; pending RT-17/18; Phase 4; shared metrics not extracted yet. |
| INS-026 | Not-fixed | FIXTURES.md | Pending RT-18/19; Phase 5; failed reads still resemble empty data. |
| INS-027 | Not-fixed | inspection/01_metadata.sql; FIXTURES.md | Pending RT-18; Phase 5; capped totals, pagination/staleness unresolved. |
| INS-028 | Not-fixed | FIXTURES.md | Pending RT-19; Phase 5; auth race/missing-profile handling unchanged. |
| INS-029 | Not-fixed | REPAIR_PROPOSAL.md; D16 | Pending RT-06/21; Phase 6; deletion impact/stale dependent forms unchanged. |
| INS-030 | Not-fixed | inspection/02_anomalies.sql; D14 | Pending RT-06; Phase 6; section/current-year flows absent. |
| INS-031 | Not-fixed | .env.example | Template added; pending RT-19/22; Phase 3; startup still crashes without valid config. |
| INS-032 | Not-fixed | FIXTURES.md; D17 | Pending RT-08/15/19; Phase 5; failed saves still lose drafts. |
| INS-033 | Not-fixed | FIXTURES.md | Pending RT-21 browser/screen-reader; Phase 6; dialog/input/toast issues unchanged. |
| INS-034 | Not-fixed | baseline contrast probe | Low contrast reproduced; pending RT-21; Phase 6; token changes not made. |
| INS-035 | Not-fixed | FIXTURES.md | Pending RT-06/21; Phase 6; action terms/colors unchanged. |
| INS-036 | Not-fixed | before-build sizes above | Pending RT-18/22; Phase 6; eager dashboard/chart chunk remains. |
| INS-037 | Not-fixed | test tooling runtime documented; DECISIONS.md | Pending RT-22; Phase 3; engines >=18 remains inconsistent with dependency tree. |
| INS-038 | Not-fixed | FIXTURES.md; D08 | Pending RT-01/20; Phase 3; demo shortcut still exposed, no real-account inventory/rotation performed. |
| INS-039 | Not-fixed | baseline zero-row handler probe | False local success/audit reproduced; pending RT-19; Phase 5; mutation assertions unchanged. |

Paths inspection/*, REPAIR_PROPOSAL.md and FIXTURES.md refer to their respective
subdirectories under supabase/. Dxx refers to DECISIONS.md. No finding is marked
Fixed-pending-live-verification until its implementation and local checks exist.

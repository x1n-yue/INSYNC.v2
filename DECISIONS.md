# Remediation decisions

Phases 0-1, 2026-10-07. These are conservative **assumed defaults**, not confirmed
institutional policy. Ambiguous behavior is paused at this decision record before
implementation; work continues using these defaults as requested. Phase 1 implements
the authority subset and its controlled-operation prerequisites. Update the relevant decision, shared module, migration,
inspection thresholds and tests together before changing a default. Never apply a
new rule retroactively by silently rewriting legacy data.

| ID | Assumed rule | Rationale / change point |
|---|---|---|
| D01 | One attendance record per intern per Manila start date; one open session per intern; no second shift after closure on that date. | Matches current daily DTR. Multi-shift requires an explicit interval/shift model before changing unique identity (INS-011). |
| D02 | Business timezone Asia/Manila, calendar week Monday-Sunday; month/year use real calendar boundaries. | Server clock events are timestamptz; business date is start instant in Manila. Open lookup ignores today's date. No client clock is authoritative (INS-012/025). |
| D03 | Valid shift duration >0 and <=16 hours; overnight end must explicitly be the next date; equal times invalid. No future correction start/end instant. | Long/ambiguous claims require review instead of zero clamping. Precision retains seconds, displayed hours rounded consistently; enforce limit in DB/shared validation (INS-016). |
| D04 | Logged hours include valid closed sessions. Verified hours require closed, positive server-derived hours and trusted staff verification with reviewer identity; open/null/invalid rows are unknown, never certified zero. | Show both totals separately. Clearance uses verified hours; ordinary clock-out remains unverified until an authorized review. No automatic verification or new daily verification queue is assumed (INS-007/025). |
| D05 | Clearance requires verified hours >= persisted valid target and all required documents approved with real current-version evidence, including the four standard types. Empty/partial/unknown checklist fails clearance; custom requirements also count. | Evaluation score is informational until a passing criterion is explicitly commissioned. Certificates remain unavailable pending an official issuance process (INS-020/023/025). |
| D06 | Required hours: finite numeric >0, <=10000, maximum two decimal places. 486 is only an explicit new-intern default; never a fallback for missing/invalid persisted values. | Review unusual historical targets before CHECK validation. Limits shared with read-only anomaly SQL (INS-018). |
| D07 | Broadcast means active intern recipients in the author's own assigned roster; personal targets are UUIDs. Admin does not gain an implicit global-broadcast audience. | Prefer recipient snapshot at send time so reassignment neither exposes old messages to new interns nor removes intended delivery. Schema/UI must document snapshot implementation; no display-name identity (INS-006/024). |
| D08 | Public signup always effective intern/Pending; requested_role is non-authoritative. Only an Active Admin approves effective role/status. | Ordinary self-edit limited to existing full_name; add phone only with explicit field/schema support. Email/id/role/status/student_id/organization protected until deliberately allowed. First Admin requires trusted operator procedure (INS-001/002). |
| D09 | Only Admin changes company, section, target hours or assignment. Instructor must be Active and effective instructor. Demotion/deactivation of an instructor with assigned interns is blocked until explicit reassignment/unassignment. | Atomic operation; no automatic mass unassignment. Intern extension/history retained when role changes, excluded from active intern rosters; reactivation revalidates references (INS-004/019). |
| D10 | Requirement identity is (intern_id, doc_type), case-sensitive; standard types moa, endorsement, consent, medical. Attach missing types only, provisioning stays Admin-owned. | Never normalize custom legacy identities or overwrite existing evidence. Replacement creates a new version, resets Pending, clears current review note, preserves prior history (INS-008/020/022). |
| D11 | Uploads limited to PDF/JPEG/PNG, <=10 MiB. Generated unique object names under owner UUID; original filename metadata only. | Client and bucket checks are complementary; MIME declarations do not establish file content safety. No public bucket or global DELETE. Cleanup only for authorized unreferenced staged objects (INS-015/022). |
| D12 | Four exact integer rubric keys: punctuality/performance/conduct/communication, each 1-5. Weights 25/35/20/20; round server-derived score to integer. | Submission UUID idempotency permits retry while distinct evaluations remain allowed. Missing/null legacy scores display unavailable, never 0 (INS-017). |
| D13 | At Risk means a known shortfall plus either >=7 Manila calendar days without a valid closed record or an outstanding Needs Revision document; Completed follows D05. Missing prerequisites show unknown. | No forecast deadline exists; do not invent pace targets. Any 8-hour/day estimate is explicitly a configurable assumption. Revisit risk logic when actual placement dates exist (INS-025). |
| D14 | Exactly one current academic year after operator configuration; allow zero only as an explicit setup-required state. Switch atomically; no seed chosen for existing data. | At most one enforced in DB; block deleting the current year until replacement. Sections remain assignment metadata; no historical cohort linkage inferred (INS-030). |
| D15 | Audit failure aborts the associated controlled DB transaction; actor/time from trusted context. No client-written events; no automatic log deletion/retention purge. | Retention policy requires separate operator decision. Never store credentials or full file contents in audit details (INS-009). |
| D16 | In-use company/section deletion requires displayed impact and deliberate confirmation; optional explicit reassignment, no silent choice. Preserve history; rollback of policy changes must not reopen broad access. | Review existing SET NULL behavior in Phase 6; refreshed dependent forms required after success (INS-029). |
| D17 | Accomplishment <=500 characters; trimmed correction reason and revision/rejection note required, with a 500-character limit for notes/reasons. | No silent truncation. Client/server validation; failed save retains draft (INS-016/032). |
| D18 | No real-project SQL execution in this session. All migrations/runbook are deliverables only; legacy repairs require separate per-group review. | Phase 0 provides inspection and repair proposal, not data changes. All Supabase fixtures disposable; no Auth/Storage network tests yet. |
| D19 | Non-Active own-profile access is a status-only `my_profile()` JSON response (id/status); direct profile reads denied. Related staff exposure is only id/full_name through scoped name RPC. | Active instructors read assigned intern profiles for existing roster needs, Active Admin reads all. Existing Intern staff-profile FK embeds replaced by restricted name mapping (INS-003/005). |
| D20 | Storage evidence is immutable after INSERT; only active intern owns upload path. Assigned staff read only objects referenced by assigned documents whose path prefix matches intern_id. No documents object UPDATE/DELETE until scoped cleanup is designed. | Existing public-bucket hardening stays Phase 2. Legacy foreign-folder metadata cannot authorize cross-roster reads (INS-004/008). |
| D21 | Add trusted clock instants, explicit correction end date, atomic correction review and path-pinned document review in M01 so raw write revocation preserves legitimate flows. | These are Phase 1 authority prerequisites, pulled forward from later phases. Phase 2 still owns trusted audit, review notes/server bulk, reviewed uniqueness/CHECKs, private bucket limits and multi-client concurrency verification. No ambiguous legacy timestamp backfill. |
| D22 | Legacy announcements with unknown recipient snapshot remain readable only to original author/Active Admin; no recipients inferred from current assignment. New broadcast snapshot freezes active assigned intern UUIDs at send time. | Reassignment changes staff data access, never old-message recipient privacy. Public signup requests only intern; staff requests go through administrator, not a privileged signup option (INS-002/006). |
| D23 | Existing Admin profile management stays direct RLS+field guard; profile creation belongs to Auth signup, profile deletion unsupported. Self-name edits require Active status. Trusted postgres operator is the sole first-Admin bootstrap exception. | Documented operator procedure uses exact Auth-verified UUID and asserts one returned row; no client-supplied role claim/GUC grants authority. Atomic lifecycle operation remains Phase 4 (INS-001/019). |

Tooling choice: standalone Node Vitest configuration keeps application build,
runtime, dev host and source behavior unchanged. Use patched Vitest 4.1.11 instead
of the initially trialed 3.x version, whose dependency audit added critical
advisories. Vitest's nested Vite is independent of application Vite 5.4.21; the
existing application-tooling upgrade remains Phase 3. ESLint 9.39.5 is the latest
9.x compatible with eslint-plugin-react 7.37.5's declared peers; npm marks that
major unsupported. Reassess compatible lint plugins/runtime in Phase 3. Current
validation runtime is Node 24.18.0/npm 11.16.0; declared Node floor remains an open
INS-037 issue until Phase 3. Test-tool dependency engines may require a higher
minor floor than >=22; use actual lockfile engines for that phase's alignment.

Phase 1 adds PGlite 0.5.8 as a dev-only in-memory Postgres test engine. Migration
SQL is applied exclusively to freshly constructed synthetic Auth/Storage/domain
fixtures. No remote DB/Auth/Storage service is contacted and bootstrap is never
read/executed by the harness. These tests verify SQL locally, not deployed policy
metadata, PostgREST behavior, signed URLs or cryptographic JWT validation.

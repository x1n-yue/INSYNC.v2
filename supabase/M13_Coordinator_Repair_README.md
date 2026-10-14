# Coordinator operations and submission dropdown

## Diagnosis and limits

The current frontend previously inserted announcements directly and fetched sent
history with SELECT. M01 grants those operations and uses a BEFORE INSERT trigger
to freeze recipients in `announcements.recipient_ids`; there is no separate
recipient table. The reported `permission denied for table announcements` is not
reproduced against that intended catalog. It indicates live privilege/deployment
drift, or a trigger executing with incompatible ownership, but the exact live
statement has not been inspected. M13 supplies a controlled send RPC, repairs the
SELECT grant/read policy, and checks required audience/audit protections. It does
not grant browser INSERT/UPDATE/DELETE or disable RLS.

`verify_attendance(p_id uuid,p_expected_in timestamptz,p_expected_out timestamptz)`
already exists in M12; frontend names/types match. The reported schema-cache error
is consistent with unapplied M12, missing EXECUTE/public-schema exposure, an old
signature, a stale PostgREST cache, or the client pointing at another project.
M13 independently installs that function/grants and notifies PostgREST, without
changing years/cohorts or requiring unrelated M12 conversions. The frontend also
fixes a confirmed response-validation defect: equivalent Z/offset timestamp
encodings are compared as the same instant, retaining six fractional digits.

No authenticated live Supabase database/session or database connector is available
in this session. Local PostgreSQL and browser mocks do not prove live deployment.
No live migrations, announcements, account edits or document uploads were run.

## Manual SQL Editor steps

1. Confirm the intended project and configured public client endpoint privately.
   Take the provider-supported database backup and verify restore arrangements.
   Database backups do not back up Storage file bytes.
2. Run `inspection/06_coordinator_operations.sql` as postgres for read-only
   function/signature, owner, ACL, RLS, policy and trigger evidence. Review actual
   definitions, not only object names. Keep definitions containing secrets private.
3. In a maintenance window, paste **all** of
   `migrations/M13_coordinator_operations.sql` into a new SQL Editor query and run
   as trusted postgres. It requires reviewed M01 authority, M02 audit and M03
   integrity, plus enabled trusted audience/audit triggers. The script is
   transactional and safely rerunnable; no rows are backfilled or deleted.
4. If a prerequisite/overload/argument/owner/policy check fails, run `ROLLBACK;`
   if needed and reconcile the named object with the read-only results. Do not
   disable protections or apply bootstrap/reset scripts. The update must complete
   and COMMIT; fragments are not an installation procedure.
5. Rerun `inspection/06_coordinator_operations.sql`. Expect both RPC signatures
   installed, postgres-owned SECURITY DEFINER with `pg_catalog, public` paths,
   authenticated EXECUTE=true and anonymous EXECUTE=false. Announcements require
   RLS=true, authenticated SELECT=true and direct INSERT/UPDATE/DELETE=false;
   independent column INSERT/UPDATE grants must also be absent. Audience and
   mandatory audit triggers must remain enabled. Inspect policy definitions.
6. The successful transaction sends `NOTIFY pgrst,'reload schema'`. If the SQL
   definitions/grants are correct but the API still reports a cache error, run
   `NOTIFY pgrst,'reload schema';` separately, verify `public` is an exposed API
   schema in Supabase settings and verify the browser uses this same project.
   Refresh the client after schema reload. Do not change API settings blindly.
7. With explicitly disposable/authorized test accounts, verify assigned-person
   and active-roster sends, recipient history after reassignment, denied foreign
   recipients, valid closed attendance verification, stale/open denial, and retry.
   No real announcements should be sent solely for testing.

The consolidated generator includes M13's final RPC/grant/read-policy definitions;
its full existing-schema prerequisites still apply. The previously supplied
`m11_retain_year` is retained, but related unreviewed `academic_year_id` cohort
definitions can still block the consolidated updater. This focused M13 does not
rewrite those relationships. It can repair these operations independently when
its own prerequisites match. M12 remains needed for its other handover features.

Neither manual file writes `supabase_migrations.schema_migrations`. Record the
executed file/hash/results in the operator ledger. Do not mark M12 or all original
migrations applied merely because this subset repair succeeds; do not blindly
replay migrations through future CLI tooling. Reconcile effects first.

## Frontend behavior

The sender uses a stable request UUID across unconfirmed retries. Subject,
message and recipient draft remain unchanged after failure; controls are locked
only while sending or reconciling an unknown outcome. Confirmed SQL rejection
allows correction. Recipient arrays are frozen in the same transaction as the
announcement and mandatory audit; retrying a committed request does not rebind
its audience or produce another audit row.

The Intern New Submission document-type dropdown reads complete authorized
`documents` requirement metadata. It lists only actual requirements, using UUIDs
and distinct reference labels for repeated names. Standard types use readable
labels; custom requirements use saved names. Other document requires a title.
Requirements can be refreshed with Retry on failure, distinct from a confirmed
empty list. Drafts and selected files survive failures; only real submission
success resets them. Historical titles/resubmission remain editable through the
existing version workflow. There is no new schema or requirement/submission link.

Selecting any assigned requirement shows a link to the separate clearance section.
Flexible uploads/reviews never alter clearance documents or establish clearance.
The existing 1–10 PDF/JPEG/PNG, 10 MiB each/50 MiB total limits and replacement
of the file draft on reselection remain unchanged.

A one-second valid attendance has positive stored hours but rounds to `0.00` at
two decimals. No screenshot row timestamps were supplied or queried live; no
historical hours/timestamps were edited for presentation. Actual logged/verified
values remain distinct. SQL verifies the exact trusted closed interval only.

## Local validation

Commands: `npm test -- --no-file-parallelism`, `npm run lint`, `npm run build`;
focused files `tests/coordinator-postgres.test.js`, `tests/coordinator-ui.test.js`,
`tests/consolidated-update.test.js`, `tests/handover-postgres.test.js`,
`tests/client-postgres.test.js`; optional fixture browser runner
`node tests/browser/coordinator-workflows.mjs` and the audit/handover runners.
The browser runners substitute only the Supabase transport, use no environment
credentials, and block remote network requests. Final results are recorded after
the checks complete; no local result establishes live readiness.

Final results, 2026-10-13:

- Full suite: **2,365 tests / 25 files passed**, 183.86 seconds, including 14
  Coordinator native PostgreSQL tests, 34 consolidated update tests and 7 focused
  mocked-transport/type-selection tests. The focused repair runs twice, and the
  consolidated updater runs repeatedly over baseline and historical fixtures.
- `npm run lint`: passed, zero errors/warnings. `npm run build`: passed, 1,034
  modules; the existing >500 kB main-chunk warning remains. `git diff --check`: passed.
- Coordinator browser: **8 groups passed**, including mobile width, predefined
  and custom titles, file replacement/validation, option error vs empty, retained
  drafts/files, duplicate prevention, unknown-response retry after reassignment,
  frozen recipient visibility, and one-second/offset-encoded verification refresh.
- Cross-role audit browser: **14 groups passed**, including real UI signup/activation,
  assignments, attendance/corrections, clearance versions, flexible review,
  evaluations, session restrictions and announcement audiences. Transport is mocked.
- Production fixture browser: **13 groups passed**; actual production-bundled UI
  with mocked Supabase transport, including existing verification/requirements,
  upload history, recovery and PDF/XLSX/CSV artifact validation. It is isolated
  from the normal `dist` and must never be deployed.
- Two intermediate failures were corrected in test tooling: obsolete direct
  announcement writes in historical/cleanup fixtures now use the proper old path
  before upgrade or the RPC after upgrade; cold browser navigation uses the
  existing 45-second navigation allowance. The UI label also became explicitly
  associated rather than wrapping option text. Final runs have no browser errors.

Reviewed artifacts: focused M13 SHA256
`2DF30C24085BCC4EEFCE3FD62A5603468B714012D07E1A16428F6D9281C6D923`;
consolidated updater SHA256
`61EAC298FD2AE88D5EA80DB7BC596EC07C9AF058909545F7829EEE97CB08F8AF`.
No live/deployed workflow is verified. M13 application, API cache/exposure and
authorized live retesting remain outstanding; full consolidated cohort inspection
is a separate unresolved prerequisite. No migrations are marked applied locally.

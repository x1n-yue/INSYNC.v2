# INSync — new Supabase project setup

Current workflow: [Supervisor logbook submission and M18 rollout](../LOGBOOK_ATTENDANCE.md). Supervisor uploads signed paper evidence; the assigned Coordinator encodes and uses **Verify & Record Attendance** once. This supersedes new Coordinator uploads under M17. Historical records remain unchanged. Local only: no live migration, reset or deployment.


Historical M17 paper fallback: [user guide, source/evidence rules and rollout](../COMPANY_ATTENDANCE.md). M17 is a prerequisite to M18; M18 must precede the current matching client. No live rollout or reset.

Current M16 follow-up: [evaluation controls and rollout](../EVALUATION_CONTROLS.md). Apply reviewed M15, then M16, before the matching client. Local preparation only; no reset or live rollout.

Current additive M15 upgrade: [Supervisor workflow and rollout](../SUPERVISOR_WORKFLOW.md). Supervisor is authorized; correction mutations and direct Coordinator evaluation creation are retired. Target: `tcntyrwwqzyyqlzdtuer`; no live rollout occurred. Historical cleanup/demo/reset procedures below do not authorize removing current evaluation/correction history.


Prepared 2026-10-14. Use a dedicated **new** Supabase project. The old project
`upnkotnmoeaykummcnlx` must be preserved: no further reset, drop, migration,
credential reuse, or reconciliation against it. Its earlier authorized reset
already committed; the change of plan stops further changes, not past commits.

New project URL/reference and publishable key have not been supplied. No new
remote project has been verified or changed. `.env.new` contains blank public
configuration fields and is ignored by Git; the active `.env` is unchanged.

## 0. Verify the destination before any remote changes

1. Create the new project in the intended Supabase organization. In its Dashboard
   verify the project name, organization, URL and reference. Record the reference
   privately. It must differ from the old reference above.
2. Put the new URL and its **same-project** publishable (`sb_publishable_...`) or
   legacy anon key in `.env.new`. Never use a secret/service-role key, Auth JWT or
   database password as a `VITE_` value. No other application environment
   variables are required. Do not commit this file or paste secrets into reports.
3. If using CLI, `npx supabase projects list` is read-only. Match its reference to
   the Dashboard and URL. The existing local CLI link points to the old project;
   **do not use a bare `--linked` command**. After independent verification,
   `npx supabase link --project-ref NEW_PROJECT_REF` changes the local link.
   Honor any CLI approval restrictions. Do not override them.
4. Inspect the NEW SQL Editor catalog. Public application tables must be absent;
   review any public functions/types/views/sequences or existing Auth integration
   before proceeding. Never delete conflicting objects to make the guard pass.

```sql
-- READ ONLY, on the NEW project only.
select c.relname,c.relkind from pg_catalog.pg_class c
where c.relnamespace='public'::regnamespace and c.relkind in ('r','p','v','m','S');
select p.oid::regprocedure from pg_catalog.pg_proc p
where p.pronamespace='public'::regnamespace;
select t.typname,t.typtype from pg_catalog.pg_type t
where t.typnamespace='public'::regnamespace;
select id,public,file_size_limit,allowed_mime_types from storage.buckets;
```

## 1. Provision private Storage before installing

In the **NEW** Dashboard, Storage → create bucket:

| Setting | Required value |
|---|---|
| Bucket ID/name | `documents` |
| Public bucket | **Off** |
| File size limit | **10 MiB = 10,485,760 bytes** |
| Allowed MIME types | `application/pdf`, `image/jpeg`, `image/png` only |

Verify the saved row using the read-only query above. MIME ordering is irrelevant;
all three types must be present, with no extras. Leave provider Storage RLS and
grants intact. Do not add a blanket public/authenticated Storage access policy.
Application policies are installed in step 2. The 50 MiB flexible-submission total
and 1–10 file limit are separately enforced by the application/RPC, not by changing
the per-file bucket limit. Only private authorized short-lived access is supported.

## 2. Run the complete fresh installer once

Open the NEW project's SQL Editor, confirm its project banner/reference and
execute **all of `supabase/INSync_Fresh_Install.sql`**, as the trusted `postgres`
operator. Do not also run `schema.sql`, `initial_schema.sql`, individual migrations
or `INSync_Consolidated_Update.sql`. Do not run any cleanup/reset SQL or private
`.insync-recovery/` script on this project.

Optional CLI execution, only after step 0 and with the verified reference:

```powershell
npx supabase db query --linked --project-ref NEW_PROJECT_REF --file supabase/INSync_Fresh_Install.sql --output json
```

Run CLI database commands sequentially. The installer uses one transaction and
reloads PostgREST's schema cache on successful commit. It is intentionally **not
rerunnable** over populated application tables; a second install aborts without
clearing records. If a transaction fails, inspect the named prerequisite, issue
`ROLLBACK;` if the same connection remains in an aborted transaction, resolve the
prerequisite and rerun the whole installer. Do not skip failed sections or weaken
RLS. Shared public objects, incompatible integration triggers/policies, missing
provider grants, or unsupported identities require explicit review.

Included final definitions: seed-free initial schema and M01–M18, including
M05/M09 validated constraints, version/history workflows, custom requirements,
saved academic-year relationships, authorized risk/clearance evidence, reporting
queries, M12 verification and M13 coordinator fixes, and M14 last-Admin protection.
No demo accounts/data, reset scripts, bulk imports, or certificate authority are
installed. These SQL Editor steps do **not** mark CLI migrations applied; do not
stamp/replay migration history blindly. Use the existing-database consolidated
updater for later reviewed changes, and reconcile tooling history only after
verifying equivalent effects in a separate operator procedure.

Offline regeneration, when the reviewed consolidated contract matches current
source hashes: `node scripts/build-reset-install.mjs`. Its default now writes only
the fresh installer, reads no old private identity checkpoint and executes no SQL.
Never use `--prepare-reset` for this new-project setup.

Expected catalog: 28 RLS-protected application tables, 100 public routines,
62 public policies, 16 application Storage policies and 51 application-related
triggers (50 public + one Auth signup integration). All fresh constraints are
validated. Table/function grants are explicit; raw announcement writes are denied.
The matching frontend RPCs are:

```text
send_announcement(p_request_id uuid, p_title text, p_body text, p_target_intern_id uuid)
verify_attendance(p_id uuid, p_expected_in timestamptz, p_expected_out timestamptz)
```

Run `supabase/INSync_New_Project_Verify.sql` as read-only catalog diagnostics.
Inspect the returned definitions and grants, not just counts. Unrelated provider
Storage policies could increase that count and must be reviewed for bypasses.

## 3. Configure Auth and local redirect URLs

In the NEW Dashboard:

- Enable email/password signup. Keep email confirmation **enabled**.
- Set Site URL to the exact local app origin, normally `http://127.0.0.1:5173`.
  Signup currently uses this Site URL; it does not override emailRedirectTo.
- Allow that app root URL and `http://127.0.0.1:5173/?auth=recovery` for password
  recovery. If using `localhost` or a different printed Vite port, configure those
  exact corresponding root/recovery URLs too. Match the URL actually opened.
- Configure approved SMTP sender/email delivery and applicable rate limits for
  the intended testers. Confirm actual confirmation/recovery delivery; local SQL
  tests do not verify email. Do not disable confirmation to make tests pass.
- Add a future HTTPS hosted origin/root/recovery URL only when the deployment
  destination is known and deployment is separately authorized.

Public signup must always create `intern / Pending`; metadata never grants staff
roles. Pending/restricted accounts cannot access internship records. Do not enable
an anonymous-signin workflow or use provider user creation as a role approval path.

## 4. Activate the new local configuration

When `.env.new` is filled and verified, stop the current dev server. Back up `.env`
privately outside Git and copy `.env.new` to `.env`. Do not overwrite it with blank
values now. Vite does **not** load `.env.new` during normal `npm run dev` or
`npm run build`; replacing `.env` is the standard configuration switch.
Alternatively, `npm run dev -- --mode new` explicitly loads `.env.new` overrides.
Verify both new values are filled before using that mode. Restart Vite and use a
fresh browser profile/session so an old-project session is not mistaken for a new
login. Retained old browser storage is not migrated to the new backend.

## 5. Secure first-Admin bootstrap

Register the designated owner's actual account against the NEW app/project and
confirm its email. Verify its identity and UUID in the NEW Dashboard Auth Users.
Do not reuse an old project's UUID, infer privilege from metadata/email domains,
or promote every account. If the owner is not identified, stop only this step
until the operator supplies that identity.

Replace BOTH placeholders below with the verified owner's UUID and exact
confirmed email. Run manually as the NEW project's trusted `postgres` operator.
This bootstrap does not create passwords or bypass email confirmation. Afterward
use normal Admin controls for all further approvals/role changes.

```sql
begin;
select pg_catalog.pg_advisory_xact_lock(404,1);
do $$
declare
  owner_id uuid := 'YOUR-VERIFIED-NEW-AUTH-UUID';
  owner_email text := 'YOUR-VERIFIED-OWNER-EMAIL';
  changed integer;
begin
  if current_user <> 'postgres' then
    raise exception 'Trusted postgres operator required';
  end if;
  if exists(select 1 from public.profiles where role='admin' and status='Active') then
    raise exception 'An Active Admin exists; use normal account approval';
  end if;
  if not exists(select 1 from auth.users where id=owner_id and email=owner_email
    and email_confirmed_at is not null and deleted_at is null) then
    raise exception 'Verify the owner identity and confirm email first';
  end if;
  update public.profiles set role='admin',status='Active'
  where id=owner_id and email=owner_email and role='intern' and status='Pending';
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'Expected exactly one verified Pending Intern; no promotion committed';
  end if;
end $$;
commit;
```

Log out/in. Verify the Admin dashboard loads. Other users remain Pending until
approved by this Admin. No old application records or privileged roles are
imported. Already-existing supported Auth users on the new project would be
reconciled only as Pending Intern, never automatically as staff.

## 6. New-project acceptance workflows

Use dedicated test accounts and synthetic files, not real people/history.

1. Register/confirm an Instructor fixture and Intern fixtures. Verify Pending
   denial. Admin activates and sets only the Instructor/Intern roles as intended.
   Save company/section/instructor and a test target via Admin controls.
2. Instructor sends an individual and assigned-active-roster fixture announcement.
   Confirm sent history and intended recipient visibility, failure drafts, safe
   retry and no partial records. Direct/unassigned writes must be denied; frozen
   recipients must survive later reassignment. Never send to real users for testing.
3. Intern clocks in/out. Verify separate logged/verified hours. Instructor verifies
   valid closed evidence using exact expected instants. Open/stale/foreign reviews
   must fail unchanged; repeated review must not double-count. A very short valid
   session may display `0.00` due to rounding; do not edit timestamps or invent hours.
4. Confirm correction UI is absent, all old correction mutation calls are denied, and historical data remains intact.
5. Upload each assigned standard/custom requirement; request revision, replace and
   approve current evidence. Verify old versions/reviews retained and authorized
   signed links deliver bytes; unassigned/cross-intern download must fail.
6. Flexible New Submission: assigned document dropdown/custom duplicate names,
   Other with required title, optional description, complete 1–10-file set. Verify
   persisted readable title, validation, failures and draft retention. Selecting a
   clearance name must not upload into or satisfy clearance. Approve/resubmit as
   assigned Instructor and verify file/version history.
7. Provision an isolated Supervisor/company/intern link, save a private draft, submit to the assigned Coordinator, manually simplify/preview/publish. Verify server original/final scores, adjusted-rating reason, source privacy, duplicate retries and own published Intern visibility.
   Check verified-target/current-approval clearance and evidence-based risk totals.
8. Check complete authorized report data across pagination, PDF/XLSX/CSV output,
   audit export, logout, reload, recovery/session expiry and retry. Verify each
   role independently against API authorization as well as visible UI controls.

## Current execution evidence and limits

`.env.new` prepared; active configuration unchanged. New-project remote execution,
Auth/SMTP settings, owner bootstrap, physical Storage upload/download and browser
cross-role acceptance are **pending configuration and testing**. No deployment is
authorized or performed. Local PostgreSQL uses synthetic provider schemas; it
verifies application SQL/RLS/role behavior, not live provider email/Storage bytes.

Local validation commands:

Actual results on 2026-10-14: `npm test` passed **2,387 tests across 27 files**,
including 15 new-project prerequisite/bootstrap checks and the existing native
PostgreSQL announcement, verification, versioned submission and cross-role tests.
`npm run lint` passed. `npm run build -- --mode new` passed (1,034 modules) with
the existing large-chunk advisory; its artifacts contain no old project reference.
`git diff --check` passed, and Git confirms `.env.new` is ignored.

```powershell
npm test -- tests/new-project-install.test.js tests/fresh-install.test.js tests/coordinator-postgres.test.js tests/coordinator-ui.test.js
npm run lint
npm run build -- --mode new
```

The last command validates compilation with the blank new-project configuration;
it deliberately produces the truthful configuration-required state, not a usable
live-backend build. Supply and verify the new settings before acceptance testing.
Never publish this blank-config build. For broader regression evidence use
`npm test`; browser fixtures and their limitations are documented in `tests/README.md`.

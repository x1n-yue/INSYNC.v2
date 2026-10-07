# INSync — Internship Performance Monitoring System

Converted stack: **React + JavaScript (Vite) + Tailwind CSS**, with **Supabase**
(Postgres + Auth + Storage) as the backend — the React app talks to Supabase
directly through the client SDK, no custom Node server required.

Three roles: **Admin**, **Instructor** (OJT Coordinator), **Intern**.

## What's in this version

Compared to earlier conversions, this source added a much larger feature
set for Instructor and Intern, all wired to real Supabase tables:

- **Rubric-based evaluations** — instructor scores an intern on 4 weighted
  criteria (1–5 each); the app computes a 0–100 overall score and stores
  both the per-criterion scores and written feedback.
- **DTR exception requests** — an intern can request a correction for a
  missed/incorrect clock-in or clock-out; the instructor approves or
  rejects requests individually or in bulk from a review queue.
- **Clock-out accomplishment log** — clocking out prompts the intern for a
  short note on what they worked on that day; it's saved with the
  attendance record.
- **Documents / clearance workflow** — interns upload clearance files
  (MOA, endorsement letter, consent form, medical certificate, etc.) to
  Supabase Storage; the instructor reviews each one (approve / request
  revision with a note) per intern.
- **Announcements** — instructor broadcasts a message to all interns or
  one specific intern.
- **Alerts** — instructor-facing, dismissible (nothing in the current UI
  auto-generates them yet — see notes below).

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), create a new project.
2. In **Project Settings → API**, copy the **Project URL** and **anon public key**.
3. Copy `.env.example` to `.env` in this folder and paste them in:

   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```

## 2. Run the database schema

1. Open the Supabase dashboard → **SQL Editor**.
2. Paste the entire contents of `supabase/schema.sql` and run it.

This creates every table the app uses (`profiles`, `interns`,
`attendance_logs`, `attendance_exceptions`, `evaluations`, `documents`,
`announcements`, `alerts`, `audit_logs`, plus master data), the
auto-profile-on-signup trigger, Row Level Security policies for all of
them, and a private **`documents` Storage bucket** with policies so an
intern can only read/write their own folder while instructors and admins
can read (and approve) everyone's. It also seeds companies/sections/years
so the app isn't empty on first load. The whole script starts by dropping
its own tables/functions/trigger/policies (all `IF EXISTS`), so it's safe
to re-run from scratch any time.

> Auth users can only be created through Supabase Auth (sign-up flow, the
> dashboard, or the Admin API) — never with a plain SQL `insert`. See step 3.

## 3. Create your first accounts

1. Run the app (`npm install`, `npm run dev`) and use the **Register** tab
   to create an account for each role you want to test (admin, instructor,
   intern).
2. New accounts are created with `status = 'Pending'` and can't sign in yet.
   In the Supabase dashboard → **Table Editor → profiles**, change a row's
   `status` to `Active` (and `role` if needed) to activate it. In the real
   app, an existing admin does this from **Account Management**.
3. For an **intern** account, assign them to an instructor and company,
   set their required hours, and attach their document checklist — all
   from the UI now: sign in as an Admin → **Interns** tab (next to Account
   Management). No SQL needed. Instructors only see interns explicitly
   assigned to them there.

## 4. Install and run

```bash
npm install
npm run dev
```

Then open the printed local URL. Sign in with an account you activated in
step 3.

## Notes on this conversion

- **No custom Node/Express server.** The React app calls Supabase's REST
  and Storage APIs directly via `@supabase/supabase-js`, protected by the
  RLS policies in `supabase/schema.sql`.
- **Creating new users as an Admin**: the client-side Supabase SDK can't
  create other users' auth accounts without signing the admin out (that
  requires a service-role key, which must never ship to the browser). So
  new accounts are created via **Register**, and an Admin approves/edits
  them afterward in **Account Management**.
- **Alerts aren't auto-generated.** The Instructor UI can dismiss alerts,
  but nothing currently creates one (e.g. from low attendance). Insert
  rows into `alerts` directly, or add an automated check (a Supabase Edge
  Function on a schedule, or a Postgres trigger) if you want them raised
  automatically.
- **Document requirements aren't auto-created for new interns.** Use the
  "Attach Standard Documents" button on Admin → Interns to give an intern
  the standard 4-item checklist (MOA, Endorsement Letter, Consent Form,
  Medical Certificate) in one click. For a custom checklist, insert rows
  into `documents` directly (see the example at the bottom of `schema.sql`).
- **Clock-out fix included**: attendance updates match on `intern_id` +
  `log_date` (not just the row's local `id`) and use `.maybeSingle()`
  instead of `.single()`, so a permissions problem surfaces a clear error
  toast instead of a generic "cannot coerce to a single object" crash.
  The RLS policy on `attendance_logs` also has an explicit `WITH CHECK`
  clause matching its `USING` clause, which was the root cause the last
  time this surfaced.
- **Approving a DTR exception request writes real attendance data.**
  When an instructor approves a "Time Log Exception Request," the app
  creates (or corrects) the matching `attendance_logs` row for that date
  — not just the exception's own status. That's what makes an approved
  correction actually show up in the intern's Daily Time Record and
  Weekly Hours Log graph, and count toward their rendered hours. This
  needed one RLS change: instructors can now `INSERT` into
  `attendance_logs` (previously only the intern themselves or an admin
  could), since approving a day with no existing record at all requires
  creating one. If your database predates this, run
  `supabase/patch_attendance_exception_insert.sql` once in the SQL editor
  — it's a small, non-destructive patch (unlike re-running all of
  `schema.sql`, which drops and recreates every table).
- **Backups**: real Postgres backups are managed by Supabase itself
  (Project Settings → Database → Backups). The "Run Manual Backup" button
  in Admin → Backup & Security is a UI simulation that logs an audit
  event, since triggering a real snapshot isn't exposed to client apps.
- **Mobile**: below the `md` breakpoint (roughly phone/small-tablet
  widths), the sidebar is replaced by a bottom tab bar. Each dashboard's
  first 4 nav items show as tabs directly; if a dashboard has more than 5
  items total, a 5th "More" tab opens a sheet with the rest (Admin and
  Instructor both hit this; Intern's 5 items fit directly). Tapping the
  avatar in the mobile top bar opens a sheet with the account's email,
  role, and Sign Out. Tables scroll horizontally where needed, and
  multi-field forms (like the intern's DTR exception request) stack to
  one column below the `sm` breakpoint.
- Review the RLS policies in `supabase/schema.sql` before using this with
  real student data — they're a reasonable starting point, not a
  professional security audit.

## Project structure

```
src/
  App.jsx                  Auth/session handling, routes to each dashboard
  lib/supabaseClient.js    Supabase client (reads VITE_SUPABASE_* env vars)
  components/
    LoginPage.jsx           Sign in / register (Supabase Auth)
    AdminDashboard.jsx       Accounts, master data, audit log, backup
    InstructorDashboard.jsx  Roster, rubric evaluations, DTR review, documents, announcements, alerts, reports
    InternDashboard.jsx      Clock in/out + accomplishments, DTR + exceptions, documents, evaluations, reports
    Shell.jsx, Modal.jsx, Toast.jsx, Icons.jsx   Shared UI
supabase/
  schema.sql                Tables, trigger, RLS policies, storage bucket + policies, seed data
```

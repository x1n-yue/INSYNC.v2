-- INSync consolidated EXISTING-database updater, generated 2026-10-13.
-- Read INSync_Consolidated_Update_README.md; take a provider backup and rehearse first.
-- Latest final contracts; NOT a concatenation/replay of migration files.
-- Represented sources (hashes identify the exact reviewed SQL):
-- migrations/M01_authority.sql SHA256 0bc4ac9cc24a5f6665590760c6eca481c8d8dfeb45c70c33c1a5d42688274825
-- migrations/M02_trusted_audit.sql SHA256 ce82f52120a262353a9fbd5e847c1f17d82e80bc03bf49b80e0ba28f6a63ebef
-- migrations/M03_attendance_integrity.sql SHA256 03aac1989555c237c976892d1ad40ba9cc78da3499a3819d41459ff4ce47bf16
-- migrations/M04_private_documents_bucket.sql SHA256 7615f9b492deb993bd6a2d3da8ace6fc680e5b891b1a7da18201fbd862447583
-- migrations/M06_rubric_hours.sql SHA256 7bd83bb4167b67dbe756ce34b99c7481eddb961e6bdd155d2011bb1129a45371
-- migrations/M07_account_lifecycle.sql SHA256 140c73cd3beed103b23764da1651f27994bc36ab0347aae03c6224dc81685305
-- migrations/M08_document_versions.sql SHA256 4e98c1bc8feb71575b777fe0eba29557dd1c64ee4e110f664117ce7139804b8f
-- migrations/M10_flexible_submissions.sql SHA256 ca63814a2e4a401bdaeca7d924741522daeae83d29ad9ae711ea9b73ed785cde
-- migrations/M11_admin_history.sql SHA256 8820174af95dfaeaefa09a6339e2c94e8d866034bb33fcd91bdc85f834d54ec4
-- migrations/M12_handover_workflows.sql SHA256 724212e28c6f2643429170b4635bedefa8e19741df841ced84bd02962836e1cd
-- migrations/M13_coordinator_operations.sql SHA256 2df30c24085bcc4eefce3fd62a5603468b714012d07e1a16428f6d9281c6d923
-- migrations/M14_last_admin_protection.sql SHA256 9c7bbeba0c1816d797f565e9b9a95808638cb50f994f8e1011d6b5683b223707
-- migrations/M15_supervisor_evaluations.sql SHA256 d7739e22e31ad6cd535e708b7e4a9dea66d3d4849530cde9a5f8fa834837a03b
-- migrations/M16_evaluation_controls.sql SHA256 5f520d4aca5b5cfdf8abbcd2043fc9d98475f2149775d52ea51da88a3717bab6
-- migrations/M17_company_attendance.sql SHA256 82e78408ea0bf4e93dfed172a63e92574eec9c546c30a268fb296cfa0b21692b
-- migrations/M18_supervisor_logbook.sql SHA256 228aed215fe5898b4712db4bb9d5b28764dd54fbdc727c91b809ed41b1e713e9
-- M05/M09 are excluded deferred historical validation; existing validation is retained.
-- No seeds, resets, historical conversions, Auth accounts, file deletion or CLI ledger writes.
-- All operations are transactional (ordinary indexes, no CONCURRENTLY operations).
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SET LOCAL check_function_bodies = off;
SELECT pg_catalog.pg_advisory_xact_lock(404,1);

-- Temporary manifest/helper disappear at commit; nothing is added to migration history.
CREATE TEMP TABLE insync_update_contract (value jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE insync_retained_trigger_contract (
 table_oid oid NOT NULL, trigger_name text NOT NULL, trigger_definition text NOT NULL,
 function_oid oid NOT NULL, function_definition text NOT NULL, function_acl text,
 enabled_mode "char" NOT NULL
) ON COMMIT DROP;
INSERT INTO pg_temp.insync_update_contract VALUES ($insync_manifest$
{
  "baseTables": [
    "companies",
    "course_sections",
    "academic_years",
    "profiles",
    "interns",
    "attendance_logs",
    "attendance_exceptions",
    "evaluations",
    "documents",
    "announcements",
    "alerts",
    "audit_logs"
  ],
  "tables": [
    "companies",
    "course_sections",
    "academic_years",
    "profiles",
    "interns",
    "attendance_logs",
    "attendance_exceptions",
    "evaluations",
    "documents",
    "announcements",
    "alerts",
    "audit_logs",
    "logbook_submissions",
    "logbook_versions",
    "logbook_events",
    "attendance_sheet_evidence",
    "manual_attendance_events",
    "document_versions",
    "document_review_events",
    "submissions",
    "submission_versions",
    "submission_files",
    "submission_reviews",
    "supervisor_assignments",
    "supervisor_evaluations",
    "evaluation_reviews",
    "evaluation_routing_events",
    "evaluation_adjustment_events"
  ],
  "baseColumns": [
    {
      "tab": "academic_years",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "academic_years",
      "name": "label",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "academic_years",
      "name": "is_current",
      "type": "boolean",
      "required": true,
      "def": "false"
    },
    {
      "tab": "alerts",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "alerts",
      "name": "intern_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "alerts",
      "name": "type",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "alerts",
      "name": "detail",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "alerts",
      "name": "severity",
      "type": "text",
      "required": true,
      "def": "'medium'::text"
    },
    {
      "tab": "alerts",
      "name": "dismissed",
      "type": "boolean",
      "required": true,
      "def": "false"
    },
    {
      "tab": "alerts",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "announcements",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "announcements",
      "name": "instructor_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "announcements",
      "name": "title",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "announcements",
      "name": "body",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "announcements",
      "name": "target",
      "type": "text",
      "required": true,
      "def": "'All Interns'::text"
    },
    {
      "tab": "announcements",
      "name": "target_intern_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "announcements",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "attendance_exceptions",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "attendance_exceptions",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_exceptions",
      "name": "log_date",
      "type": "date",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_exceptions",
      "name": "claimed_time_in",
      "type": "time without time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_exceptions",
      "name": "claimed_time_out",
      "type": "time without time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_exceptions",
      "name": "reason",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_exceptions",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Pending'::text"
    },
    {
      "tab": "attendance_exceptions",
      "name": "reviewed_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_exceptions",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "attendance_logs",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "attendance_logs",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "log_date",
      "type": "date",
      "required": true,
      "def": "CURRENT_DATE"
    },
    {
      "tab": "attendance_logs",
      "name": "time_in",
      "type": "time without time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "time_out",
      "type": "time without time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "hours",
      "type": "numeric",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "accomplishment",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "verified",
      "type": "boolean",
      "required": true,
      "def": "false"
    },
    {
      "tab": "attendance_logs",
      "name": "verified_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "audit_logs",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "audit_logs",
      "name": "actor_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "audit_logs",
      "name": "actor_name",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "audit_logs",
      "name": "action",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "audit_logs",
      "name": "detail",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "audit_logs",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "companies",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "companies",
      "name": "name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "course_sections",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "course_sections",
      "name": "name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "documents",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "documents",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "documents",
      "name": "doc_type",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "documents",
      "name": "name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "documents",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Pending'::text"
    },
    {
      "tab": "documents",
      "name": "file_path",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "documents",
      "name": "file_name",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "documents",
      "name": "note",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "documents",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "documents",
      "name": "updated_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "evaluations",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "evaluations",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "evaluator_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "type",
      "type": "text",
      "required": true,
      "def": "'Evaluation'::text"
    },
    {
      "tab": "evaluations",
      "name": "competencies",
      "type": "jsonb",
      "required": true,
      "def": "'{}'::jsonb"
    },
    {
      "tab": "evaluations",
      "name": "feedback",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "overall_score",
      "type": "numeric",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "interns",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "interns",
      "name": "instructor_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "interns",
      "name": "company_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "interns",
      "name": "section_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "interns",
      "name": "required_hours",
      "type": "numeric",
      "required": true,
      "def": "486"
    },
    {
      "tab": "interns",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'On Track'::text"
    },
    {
      "tab": "profiles",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "profiles",
      "name": "full_name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "profiles",
      "name": "email",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "profiles",
      "name": "role",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "profiles",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Pending'::text"
    },
    {
      "tab": "profiles",
      "name": "organization",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "profiles",
      "name": "student_id",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "profiles",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "profiles",
      "name": "status",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "profiles",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Active'::text"
    },
    {
      "tab": "evaluations",
      "name": "overall_score",
      "type": "numeric",
      "required": true,
      "def": null
    }
  ],
  "baseConstraints": [
    {
      "tab": "academic_years",
      "name": "academic_years_label_key",
      "kind": "u",
      "def": "UNIQUE (label)"
    },
    {
      "tab": "academic_years",
      "name": "academic_years_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "alerts",
      "name": "alerts_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE"
    },
    {
      "tab": "alerts",
      "name": "alerts_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "alerts",
      "name": "alerts_severity_check",
      "kind": "c",
      "def": "CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))"
    },
    {
      "tab": "announcements",
      "name": "announcements_instructor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (instructor_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "announcements",
      "name": "announcements_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "announcements",
      "name": "announcements_target_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (target_intern_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "attendance_exceptions",
      "name": "attendance_exceptions_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE"
    },
    {
      "tab": "attendance_exceptions",
      "name": "attendance_exceptions_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "attendance_exceptions",
      "name": "attendance_exceptions_reviewed_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)"
    },
    {
      "tab": "attendance_exceptions",
      "name": "attendance_exceptions_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])))"
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_logs_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE"
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_logs_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_logs_verified_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (verified_by) REFERENCES public.profiles(id)"
    },
    {
      "tab": "audit_logs",
      "name": "audit_logs_actor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (actor_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "audit_logs",
      "name": "audit_logs_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "companies",
      "name": "companies_name_key",
      "kind": "u",
      "def": "UNIQUE (name)"
    },
    {
      "tab": "companies",
      "name": "companies_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "course_sections",
      "name": "course_sections_name_key",
      "kind": "u",
      "def": "UNIQUE (name)"
    },
    {
      "tab": "course_sections",
      "name": "course_sections_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "documents",
      "name": "documents_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE"
    },
    {
      "tab": "documents",
      "name": "documents_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "documents",
      "name": "documents_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])))"
    },
    {
      "tab": "evaluations",
      "name": "evaluations_evaluator_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (evaluator_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "evaluations",
      "name": "evaluations_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id) ON DELETE CASCADE"
    },
    {
      "tab": "evaluations",
      "name": "evaluations_overall_score_check",
      "kind": "c",
      "def": "CHECK (((overall_score >= (0)::numeric) AND (overall_score <= (100)::numeric)))"
    },
    {
      "tab": "evaluations",
      "name": "evaluations_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "interns",
      "name": "interns_company_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL"
    },
    {
      "tab": "interns",
      "name": "interns_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE"
    },
    {
      "tab": "interns",
      "name": "interns_instructor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (instructor_id) REFERENCES public.profiles(id) ON DELETE SET NULL"
    },
    {
      "tab": "interns",
      "name": "interns_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "interns",
      "name": "interns_section_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (section_id) REFERENCES public.course_sections(id) ON DELETE SET NULL"
    },
    {
      "tab": "profiles",
      "name": "profiles_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    {
      "tab": "profiles",
      "name": "profiles_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)"
    },
    {
      "tab": "profiles",
      "name": "profiles_role_check",
      "kind": "c",
      "def": "CHECK ((role = ANY (ARRAY['admin'::text, 'instructor'::text, 'intern'::text])))"
    },
    {
      "tab": "profiles",
      "name": "profiles_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Pending'::text])))"
    },
    {
      "tab": "alerts",
      "name": "alerts_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "attendance_exceptions",
      "name": "attendance_exceptions_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_logs_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "documents",
      "name": "documents_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "evaluations",
      "name": "evaluations_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "interns",
      "name": "interns_company_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (company_id) REFERENCES public.companies(id)"
    },
    {
      "tab": "interns",
      "name": "interns_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "interns",
      "name": "interns_instructor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (instructor_id) REFERENCES public.profiles(id)"
    },
    {
      "tab": "interns",
      "name": "interns_section_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (section_id) REFERENCES public.course_sections(id)"
    },
    {
      "tab": "profiles",
      "name": "profiles_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (id) REFERENCES auth.users(id)"
    },
    {
      "tab": "profiles",
      "name": "profiles_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Active'::text, 'Pending'::text, 'Inactive'::text])))"
    },
    {
      "tab": "evaluations",
      "name": "evaluations_overall_score_check",
      "kind": "c",
      "def": "CHECK (((overall_score >= (0)::numeric) AND (overall_score <= (100)::numeric)))"
    }
  ],
  "columns": [
    {
      "tab": "academic_years",
      "name": "archived_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "announcements",
      "name": "recipient_ids",
      "type": "uuid[]",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_exceptions",
      "name": "claimed_end_date",
      "type": "date",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_exceptions",
      "name": "reviewed_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_exceptions",
      "name": "review_note",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "clocked_in_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "clocked_out_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_source",
      "type": "text",
      "required": true,
      "def": "'online'::text"
    },
    {
      "tab": "attendance_logs",
      "name": "manual_evidence_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "manual_details",
      "type": "jsonb",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "manual_revision",
      "type": "integer",
      "required": true,
      "def": "0"
    },
    {
      "tab": "attendance_logs",
      "name": "encoded_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "encoded_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "revised_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "revised_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "revision_reason",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "verified_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "logbook_submission_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_logs",
      "name": "logbook_version",
      "type": "integer",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "company_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "participant_ids",
      "type": "uuid[]",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "uploaded_by",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "file_path",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "file_name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "mime_type",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "byte_size",
      "type": "bigint",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "expires_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "ready_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "committed_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "abandoned_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "logbook_submission_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "audit_logs",
      "name": "source",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "audit_logs",
      "name": "event_data",
      "type": "jsonb",
      "required": false,
      "def": null
    },
    {
      "tab": "companies",
      "name": "archived_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "course_sections",
      "name": "archived_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "document_review_events",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "document_review_events",
      "name": "document_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "document_review_events",
      "name": "version_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "document_review_events",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "document_review_events",
      "name": "review_revision",
      "type": "bigint",
      "required": true,
      "def": null
    },
    {
      "tab": "document_review_events",
      "name": "status",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "document_review_events",
      "name": "note",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "document_review_events",
      "name": "reviewed_by",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "document_review_events",
      "name": "reviewed_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "document_versions",
      "name": "document_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "version_no",
      "type": "bigint",
      "required": false,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "expected_version",
      "type": "bigint",
      "required": true,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "file_path",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "file_name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "mime_type",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "byte_size",
      "type": "bigint",
      "required": true,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "clock_timestamp()"
    },
    {
      "tab": "document_versions",
      "name": "expires_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "committed_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "abandoned_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Pending'::text"
    },
    {
      "tab": "document_versions",
      "name": "note",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "reviewed_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "document_versions",
      "name": "reviewed_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "documents",
      "name": "reviewed_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "documents",
      "name": "reviewed_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "documents",
      "name": "upload_version",
      "type": "bigint",
      "required": true,
      "def": "0"
    },
    {
      "tab": "documents",
      "name": "review_revision",
      "type": "bigint",
      "required": true,
      "def": "0"
    },
    {
      "tab": "documents",
      "name": "legacy_evidence",
      "type": "jsonb",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "source_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "source_version",
      "type": "integer",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "review_revision",
      "type": "integer",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "criterion",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "original_rating",
      "type": "integer",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "final_rating",
      "type": "integer",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "reason_code",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "reason_text",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "coordinator_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "evaluation_reviews",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_reviews",
      "name": "coordinator_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_reviews",
      "name": "source_version",
      "type": "integer",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_reviews",
      "name": "revision",
      "type": "integer",
      "required": true,
      "def": "0"
    },
    {
      "tab": "evaluation_reviews",
      "name": "summary",
      "type": "text",
      "required": true,
      "def": "''::text"
    },
    {
      "tab": "evaluation_reviews",
      "name": "strengths",
      "type": "text",
      "required": true,
      "def": "''::text"
    },
    {
      "tab": "evaluation_reviews",
      "name": "improvements",
      "type": "text",
      "required": true,
      "def": "''::text"
    },
    {
      "tab": "evaluation_reviews",
      "name": "guidance",
      "type": "text",
      "required": true,
      "def": "''::text"
    },
    {
      "tab": "evaluation_reviews",
      "name": "criteria",
      "type": "jsonb",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_reviews",
      "name": "adjustment_reason",
      "type": "text",
      "required": true,
      "def": "''::text"
    },
    {
      "tab": "evaluation_reviews",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Submitted to Coordinator'::text"
    },
    {
      "tab": "evaluation_reviews",
      "name": "final_evaluation_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluation_reviews",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "evaluation_reviews",
      "name": "feedback_mode",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluation_reviews",
      "name": "feedback_catalog_version",
      "type": "integer",
      "required": true,
      "def": "1"
    },
    {
      "tab": "evaluation_reviews",
      "name": "feedback_choices",
      "type": "jsonb",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluation_reviews",
      "name": "additional_remarks",
      "type": "text",
      "required": true,
      "def": "''::text"
    },
    {
      "tab": "evaluation_reviews",
      "name": "written_feedback",
      "type": "jsonb",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluation_reviews",
      "name": "adjustment_reasons",
      "type": "jsonb",
      "required": true,
      "def": "'{}'::jsonb"
    },
    {
      "tab": "evaluation_reviews",
      "name": "legacy_adjustment_reason",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluation_routing_events",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "evaluation_routing_events",
      "name": "source_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_routing_events",
      "name": "previous_coordinator_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_routing_events",
      "name": "coordinator_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_routing_events",
      "name": "actor_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_routing_events",
      "name": "reason",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "evaluation_routing_events",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "evaluations",
      "name": "submission_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "source_evaluation_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "source_version",
      "type": "integer",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "provenance",
      "type": "text",
      "required": true,
      "def": "'legacy_coordinator'::text"
    },
    {
      "tab": "evaluations",
      "name": "strengths",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "improvements",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "guidance",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "evaluations",
      "name": "evaluation_date",
      "type": "date",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_events",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "logbook_events",
      "name": "submission_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_events",
      "name": "actor_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_events",
      "name": "event_kind",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_events",
      "name": "before_values",
      "type": "jsonb",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_events",
      "name": "after_values",
      "type": "jsonb",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_events",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "logbook_submissions",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_submissions",
      "name": "supervisor_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_submissions",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_submissions",
      "name": "company_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_submissions",
      "name": "assignment_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_submissions",
      "name": "supervisor_name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_submissions",
      "name": "intern_name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_submissions",
      "name": "company_name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_submissions",
      "name": "coordinator_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_submissions",
      "name": "current_version",
      "type": "integer",
      "required": true,
      "def": "1"
    },
    {
      "tab": "logbook_submissions",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "logbook_versions",
      "name": "submission_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "version",
      "type": "integer",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "revision",
      "type": "integer",
      "required": true,
      "def": "1"
    },
    {
      "tab": "logbook_versions",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Draft'::text"
    },
    {
      "tab": "logbook_versions",
      "name": "date_start",
      "type": "date",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "date_end",
      "type": "date",
      "required": true,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "remarks",
      "type": "text",
      "required": true,
      "def": "''::text"
    },
    {
      "tab": "logbook_versions",
      "name": "evidence_ids",
      "type": "uuid[]",
      "required": true,
      "def": "'{}'::uuid[]"
    },
    {
      "tab": "logbook_versions",
      "name": "receiving_coordinator_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "submitted_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "return_reason",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "returned_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "returned_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "verified_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "verified_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "request_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "logbook_versions",
      "name": "recorded_sessions",
      "type": "jsonb",
      "required": false,
      "def": null
    },
    {
      "tab": "manual_attendance_events",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "manual_attendance_events",
      "name": "attendance_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "manual_attendance_events",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "manual_attendance_events",
      "name": "actor_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "manual_attendance_events",
      "name": "event_kind",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "manual_attendance_events",
      "name": "before_values",
      "type": "jsonb",
      "required": false,
      "def": null
    },
    {
      "tab": "manual_attendance_events",
      "name": "after_values",
      "type": "jsonb",
      "required": true,
      "def": null
    },
    {
      "tab": "manual_attendance_events",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "profiles",
      "name": "requested_role",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "profiles",
      "name": "supervisor_company_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "submission_files",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "submission_files",
      "name": "version_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_files",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_files",
      "name": "ordinal",
      "type": "integer",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_files",
      "name": "file_path",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_files",
      "name": "file_name",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_files",
      "name": "mime_type",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_files",
      "name": "byte_size",
      "type": "bigint",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_reviews",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "submission_reviews",
      "name": "version_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_reviews",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_reviews",
      "name": "review_revision",
      "type": "bigint",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_reviews",
      "name": "status",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_reviews",
      "name": "note",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "submission_reviews",
      "name": "reviewed_by",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_reviews",
      "name": "reviewed_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "submission_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "expected_version",
      "type": "bigint",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "expected_revision",
      "type": "bigint",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "version_no",
      "type": "bigint",
      "required": false,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "title",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "description",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "manifest",
      "type": "jsonb",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "clock_timestamp()"
    },
    {
      "tab": "submission_versions",
      "name": "expires_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "committed_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "abandoned_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Pending'::text"
    },
    {
      "tab": "submission_versions",
      "name": "review_revision",
      "type": "bigint",
      "required": true,
      "def": "0"
    },
    {
      "tab": "submission_versions",
      "name": "note",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "reviewed_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "submission_versions",
      "name": "reviewed_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "submissions",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "submissions",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "submissions",
      "name": "current_version",
      "type": "bigint",
      "required": true,
      "def": "0"
    },
    {
      "tab": "submissions",
      "name": "review_revision",
      "type": "bigint",
      "required": true,
      "def": "0"
    },
    {
      "tab": "submissions",
      "name": "title",
      "type": "text",
      "required": true,
      "def": null
    },
    {
      "tab": "submissions",
      "name": "description",
      "type": "text",
      "required": true,
      "def": "''::text"
    },
    {
      "tab": "submissions",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Pending'::text"
    },
    {
      "tab": "submissions",
      "name": "note",
      "type": "text",
      "required": false,
      "def": null
    },
    {
      "tab": "submissions",
      "name": "reviewed_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "submissions",
      "name": "reviewed_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "submissions",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "clock_timestamp()"
    },
    {
      "tab": "submissions",
      "name": "updated_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "clock_timestamp()"
    },
    {
      "tab": "supervisor_assignments",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": "gen_random_uuid()"
    },
    {
      "tab": "supervisor_assignments",
      "name": "supervisor_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_assignments",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_assignments",
      "name": "company_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_assignments",
      "name": "assigned_by",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_assignments",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    },
    {
      "tab": "supervisor_assignments",
      "name": "ended_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "supervisor_assignments",
      "name": "ended_by",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "intern_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "company_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "assignment_id",
      "type": "uuid",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "coordinator_id",
      "type": "uuid",
      "required": false,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "evaluation_date",
      "type": "date",
      "required": true,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "rubric",
      "type": "jsonb",
      "required": true,
      "def": "'{\"conduct\": 20, \"performance\": 35, \"punctuality\": 25, \"communication\": 20}'::jsonb"
    },
    {
      "tab": "supervisor_evaluations",
      "name": "criteria",
      "type": "jsonb",
      "required": true,
      "def": "'{}'::jsonb"
    },
    {
      "tab": "supervisor_evaluations",
      "name": "overall_score",
      "type": "integer",
      "required": false,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "feedback",
      "type": "text",
      "required": true,
      "def": "''::text"
    },
    {
      "tab": "supervisor_evaluations",
      "name": "status",
      "type": "text",
      "required": true,
      "def": "'Supervisor Draft'::text"
    },
    {
      "tab": "supervisor_evaluations",
      "name": "version",
      "type": "integer",
      "required": true,
      "def": "1"
    },
    {
      "tab": "supervisor_evaluations",
      "name": "submitted_at",
      "type": "timestamp with time zone",
      "required": false,
      "def": null
    },
    {
      "tab": "supervisor_evaluations",
      "name": "created_at",
      "type": "timestamp with time zone",
      "required": true,
      "def": "now()"
    }
  ],
  "constraints": [
    {
      "tab": "attendance_exceptions",
      "name": "m03_correction_interval",
      "kind": "c",
      "def": "CHECK (((claimed_time_in IS NOT NULL) AND (claimed_time_out IS NOT NULL) AND (claimed_end_date IS NOT NULL) AND ((claimed_end_date = log_date) OR (claimed_end_date = (log_date + 1))) AND ((claimed_end_date + claimed_time_out) > (log_date + claimed_time_in)) AND (((claimed_end_date + claimed_time_out) - (log_date + claimed_time_in)) <= '16:00:00'::interval) AND (NULLIF(btrim(reason), ''::text) IS NOT NULL) AND (length(reason) <= 500)))",
      "validated": false
    },
    {
      "tab": "attendance_exceptions",
      "name": "m03_correction_review",
      "kind": "c",
      "def": "CHECK ((((status = 'Pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (review_note IS NULL)) OR ((status = ANY (ARRAY['Approved'::text, 'Rejected'::text])) AND (reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL) AND ((review_note IS NULL) OR (length(review_note) <= 500)) AND ((status <> 'Rejected'::text) OR (NULLIF(btrim(review_note), ''::text) IS NOT NULL)))))",
      "validated": false
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_logs_attendance_source_check",
      "kind": "c",
      "def": "CHECK ((attendance_source = ANY (ARRAY['online'::text, 'manual_company_sheet'::text])))",
      "validated": true
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_logs_encoded_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (encoded_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_logs_logbook_submission_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (logbook_submission_id) REFERENCES public.logbook_submissions(id)",
      "validated": true
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_logs_manual_evidence_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (manual_evidence_id) REFERENCES public.attendance_sheet_evidence(id)",
      "validated": true
    },
    {
      "tab": "attendance_logs",
      "name": "attendance_logs_revised_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (revised_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "attendance_logs",
      "name": "m03_accomplishment_length",
      "kind": "c",
      "def": "CHECK (((accomplishment IS NULL) OR (length(accomplishment) <= 500)))",
      "validated": false
    },
    {
      "tab": "attendance_logs",
      "name": "m03_attendance_interval",
      "kind": "c",
      "def": "CHECK (((clocked_in_at IS NOT NULL) AND (time_in IS NOT NULL) AND (log_date = ((clocked_in_at AT TIME ZONE 'Asia/Manila'::text))::date) AND (time_in = ((clocked_in_at AT TIME ZONE 'Asia/Manila'::text))::time without time zone) AND (((time_out IS NULL) AND (clocked_out_at IS NULL) AND (hours IS NULL) AND (NOT verified) AND (verified_by IS NULL)) OR ((time_out IS NOT NULL) AND (clocked_out_at IS NOT NULL) AND (hours IS NOT NULL) AND (time_out = ((clocked_out_at AT TIME ZONE 'Asia/Manila'::text))::time without time zone) AND (clocked_out_at > clocked_in_at) AND ((clocked_out_at - clocked_in_at) <= '16:00:00'::interval) AND (hours = (EXTRACT(epoch FROM (clocked_out_at - clocked_in_at)) / (3600)::numeric)) AND ((verified AND (verified_by IS NOT NULL)) OR ((NOT verified) AND (verified_by IS NULL)))))))",
      "validated": false
    },
    {
      "tab": "attendance_logs",
      "name": "m03_daily_identity",
      "kind": "u",
      "def": "UNIQUE (intern_id, log_date)",
      "validated": true
    },
    {
      "tab": "attendance_logs",
      "name": "m17_manual_shape",
      "kind": "c",
      "def": "CHECK ((((attendance_source = 'online'::text) AND (manual_evidence_id IS NULL) AND (manual_details IS NULL) AND (manual_revision = 0) AND (encoded_by IS NULL) AND (encoded_at IS NULL) AND (revised_by IS NULL) AND (revised_at IS NULL) AND (revision_reason IS NULL)) OR ((attendance_source = 'manual_company_sheet'::text) AND (manual_evidence_id IS NOT NULL) AND (manual_details IS NOT NULL) AND (jsonb_typeof(manual_details) = 'object'::text) AND (encoded_by IS NOT NULL) AND (encoded_at IS NOT NULL) AND (manual_revision > 0) AND (clocked_in_at IS NOT NULL) AND (clocked_out_at IS NOT NULL) AND ((verified AND (verified_at IS NOT NULL)) OR ((NOT verified) AND (verified_at IS NULL))) AND (((manual_revision = 1) AND (revised_by IS NULL) AND (revised_at IS NULL) AND (revision_reason IS NULL)) OR ((manual_revision > 1) AND (revised_by IS NOT NULL) AND (revised_at IS NOT NULL) AND (revision_reason IS NOT NULL) AND (length(btrim(revision_reason)) >= 10) AND (length(btrim(revision_reason)) <= 500))))))",
      "validated": false
    },
    {
      "tab": "attendance_logs",
      "name": "m18_logbook_link",
      "kind": "f",
      "def": "FOREIGN KEY (logbook_submission_id, logbook_version) REFERENCES public.logbook_versions(submission_id, version)",
      "validated": true
    },
    {
      "tab": "attendance_logs",
      "name": "m18_logbook_shape",
      "kind": "c",
      "def": "CHECK ((((logbook_submission_id IS NULL) AND (logbook_version IS NULL)) OR ((logbook_submission_id IS NOT NULL) AND (logbook_version IS NOT NULL) AND (attendance_source = 'manual_company_sheet'::text) AND verified)))",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_byte_size_check",
      "kind": "c",
      "def": "CHECK (((byte_size >= 1) AND (byte_size <= 10485760)))",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_check",
      "kind": "c",
      "def": "CHECK (((committed_at IS NULL) OR ((ready_at IS NOT NULL) AND (abandoned_at IS NULL))))",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_company_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (company_id) REFERENCES public.companies(id)",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_file_name_check",
      "kind": "c",
      "def": "CHECK (((length(file_name) >= 1) AND (length(file_name) <= 200)))",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_file_path_key",
      "kind": "u",
      "def": "UNIQUE (file_path)",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_logbook_submission_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (logbook_submission_id) REFERENCES public.logbook_submissions(id)",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_mime_type_check",
      "kind": "c",
      "def": "CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text])))",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_participant_ids_check",
      "kind": "c",
      "def": "CHECK (((cardinality(participant_ids) >= 1) AND (cardinality(participant_ids) <= 50)))",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "attendance_sheet_evidence",
      "name": "attendance_sheet_evidence_uploaded_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "document_review_events",
      "name": "document_review_events_document_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (document_id) REFERENCES public.documents(id)",
      "validated": true
    },
    {
      "tab": "document_review_events",
      "name": "document_review_events_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "document_review_events",
      "name": "document_review_events_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "document_review_events",
      "name": "document_review_events_reviewed_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "document_review_events",
      "name": "document_review_events_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])))",
      "validated": true
    },
    {
      "tab": "document_review_events",
      "name": "document_review_events_version_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (version_id) REFERENCES public.document_versions(id)",
      "validated": true
    },
    {
      "tab": "document_review_events",
      "name": "document_review_events_version_id_review_revision_key",
      "kind": "u",
      "def": "UNIQUE (version_id, review_revision)",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_byte_size_check",
      "kind": "c",
      "def": "CHECK (((byte_size > 0) AND (byte_size <= 10485760)))",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_check",
      "kind": "c",
      "def": "CHECK ((NOT ((committed_at IS NOT NULL) AND (abandoned_at IS NOT NULL))))",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_check1",
      "kind": "c",
      "def": "CHECK ((((committed_at IS NULL) AND (version_no IS NULL)) OR ((committed_at IS NOT NULL) AND (version_no > 0))))",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_check2",
      "kind": "c",
      "def": "CHECK ((split_part(file_path, '/'::text, 1) = (intern_id)::text))",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_document_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (document_id) REFERENCES public.documents(id)",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_document_id_version_no_key",
      "kind": "u",
      "def": "UNIQUE (document_id, version_no)",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_expected_version_check",
      "kind": "c",
      "def": "CHECK ((expected_version >= 0))",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_file_path_key",
      "kind": "u",
      "def": "UNIQUE (file_path)",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_mime_type_check",
      "kind": "c",
      "def": "CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text])))",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_reviewed_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "document_versions",
      "name": "document_versions_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])))",
      "validated": true
    },
    {
      "tab": "documents",
      "name": "documents_reviewed_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "documents",
      "name": "m08_requirement_identity",
      "kind": "u",
      "def": "UNIQUE (intern_id, doc_type)",
      "validated": true
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "evaluation_adjustment_events_check",
      "kind": "c",
      "def": "CHECK (((final_rating >= 1) AND (final_rating <= 5) AND (final_rating <> original_rating)))",
      "validated": true
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "evaluation_adjustment_events_coordinator_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (coordinator_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "evaluation_adjustment_events_criterion_check",
      "kind": "c",
      "def": "CHECK ((criterion = ANY (ARRAY['punctuality'::text, 'performance'::text, 'conduct'::text, 'communication'::text])))",
      "validated": true
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "evaluation_adjustment_events_original_rating_check",
      "kind": "c",
      "def": "CHECK (((original_rating >= 1) AND (original_rating <= 5)))",
      "validated": true
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "evaluation_adjustment_events_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "evaluation_adjustment_events_reason_text_check",
      "kind": "c",
      "def": "CHECK (((length(reason_text) >= 1) AND (length(reason_text) <= 500)))",
      "validated": true
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "evaluation_adjustment_events_source_id_review_revision_crit_key",
      "kind": "u",
      "def": "UNIQUE (source_id, review_revision, criterion)",
      "validated": true
    },
    {
      "tab": "evaluation_adjustment_events",
      "name": "evaluation_adjustment_events_source_id_source_version_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (source_id, source_version) REFERENCES public.supervisor_evaluations(id, version)",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_additional_remarks_check",
      "kind": "c",
      "def": "CHECK ((length(additional_remarks) <= 1000))",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_adjustment_reason_check",
      "kind": "c",
      "def": "CHECK ((length(adjustment_reason) <= 2000))",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_adjustment_reasons_check",
      "kind": "c",
      "def": "CHECK ((jsonb_typeof(adjustment_reasons) = 'object'::text))",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_coordinator_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (coordinator_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_feedback_catalog_version_check",
      "kind": "c",
      "def": "CHECK ((feedback_catalog_version = 1))",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_feedback_mode_check",
      "kind": "c",
      "def": "CHECK ((feedback_mode = ANY (ARRAY['selected'::text, 'written'::text])))",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_final_evaluation_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (final_evaluation_id) REFERENCES public.evaluations(id)",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_final_evaluation_id_key",
      "kind": "u",
      "def": "UNIQUE (final_evaluation_id)",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_guidance_check",
      "kind": "c",
      "def": "CHECK ((length(guidance) <= 2000))",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (id) REFERENCES public.supervisor_evaluations(id)",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_id_source_version_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (id, source_version) REFERENCES public.supervisor_evaluations(id, version)",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_improvements_check",
      "kind": "c",
      "def": "CHECK ((length(improvements) <= 2000))",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Submitted to Coordinator'::text, 'Coordinator Draft'::text, 'Published to Intern'::text])))",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_strengths_check",
      "kind": "c",
      "def": "CHECK ((length(strengths) <= 2000))",
      "validated": true
    },
    {
      "tab": "evaluation_reviews",
      "name": "evaluation_reviews_summary_check",
      "kind": "c",
      "def": "CHECK ((length(summary) <= 2000))",
      "validated": true
    },
    {
      "tab": "evaluation_routing_events",
      "name": "evaluation_routing_events_actor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (actor_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "evaluation_routing_events",
      "name": "evaluation_routing_events_coordinator_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (coordinator_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "evaluation_routing_events",
      "name": "evaluation_routing_events_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "evaluation_routing_events",
      "name": "evaluation_routing_events_previous_coordinator_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (previous_coordinator_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "evaluation_routing_events",
      "name": "evaluation_routing_events_reason_check",
      "kind": "c",
      "def": "CHECK (((length(btrim(reason)) >= 1) AND (length(btrim(reason)) <= 2000)))",
      "validated": true
    },
    {
      "tab": "evaluation_routing_events",
      "name": "evaluation_routing_events_source_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (source_id) REFERENCES public.supervisor_evaluations(id)",
      "validated": true
    },
    {
      "tab": "evaluations",
      "name": "evaluations_provenance_check",
      "kind": "c",
      "def": "CHECK ((provenance = ANY (ARRAY['legacy_coordinator'::text, 'supervisor_review'::text])))",
      "validated": true
    },
    {
      "tab": "evaluations",
      "name": "evaluations_source_evaluation_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (source_evaluation_id) REFERENCES public.supervisor_evaluations(id)",
      "validated": true
    },
    {
      "tab": "evaluations",
      "name": "evaluations_source_evaluation_id_key",
      "kind": "u",
      "def": "UNIQUE (source_evaluation_id)",
      "validated": true
    },
    {
      "tab": "evaluations",
      "name": "m06_evaluation_rubric",
      "kind": "c",
      "def": "CHECK (((overall_score IS NOT NULL) AND (evaluator_id IS NOT NULL) AND (public.rubric_score(competencies) IS NOT NULL) AND (overall_score = (public.rubric_score(competencies))::numeric)))",
      "validated": false
    },
    {
      "tab": "evaluations",
      "name": "m15_final_source_version",
      "kind": "f",
      "def": "FOREIGN KEY (source_evaluation_id, source_version) REFERENCES public.supervisor_evaluations(id, version)",
      "validated": true
    },
    {
      "tab": "evaluations",
      "name": "m15_source_reference",
      "kind": "c",
      "def": "CHECK ((((provenance = 'legacy_coordinator'::text) AND (source_evaluation_id IS NULL) AND (source_version IS NULL)) OR ((provenance = 'supervisor_review'::text) AND (source_evaluation_id IS NOT NULL) AND (source_version IS NOT NULL))))",
      "validated": true
    },
    {
      "tab": "interns",
      "name": "m06_required_hours",
      "kind": "c",
      "def": "CHECK (public.valid_required_hours(required_hours))",
      "validated": false
    },
    {
      "tab": "logbook_events",
      "name": "logbook_events_actor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (actor_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "logbook_events",
      "name": "logbook_events_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "logbook_events",
      "name": "logbook_events_submission_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (submission_id) REFERENCES public.logbook_submissions(id)",
      "validated": true
    },
    {
      "tab": "logbook_submissions",
      "name": "logbook_submissions_assignment_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (assignment_id) REFERENCES public.supervisor_assignments(id)",
      "validated": true
    },
    {
      "tab": "logbook_submissions",
      "name": "logbook_submissions_company_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (company_id) REFERENCES public.companies(id)",
      "validated": true
    },
    {
      "tab": "logbook_submissions",
      "name": "logbook_submissions_coordinator_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (coordinator_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "logbook_submissions",
      "name": "logbook_submissions_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.interns(id)",
      "validated": true
    },
    {
      "tab": "logbook_submissions",
      "name": "logbook_submissions_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "logbook_submissions",
      "name": "logbook_submissions_supervisor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (supervisor_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_check",
      "kind": "c",
      "def": "CHECK ((date_end >= date_start))",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_evidence_ids_check",
      "kind": "c",
      "def": "CHECK ((cardinality(evidence_ids) <= 10))",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (submission_id, version)",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_receiving_coordinator_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (receiving_coordinator_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_remarks_check",
      "kind": "c",
      "def": "CHECK ((length(remarks) <= 1000))",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_request_id_key",
      "kind": "u",
      "def": "UNIQUE (request_id)",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_returned_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (returned_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Draft'::text, 'Pending Review'::text, 'Returned for Correction'::text, 'Verified'::text])))",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_submission_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (submission_id) REFERENCES public.logbook_submissions(id)",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_verified_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (verified_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "logbook_versions",
      "name": "logbook_versions_version_check",
      "kind": "c",
      "def": "CHECK ((version > 0))",
      "validated": true
    },
    {
      "tab": "manual_attendance_events",
      "name": "manual_attendance_events_actor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (actor_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "manual_attendance_events",
      "name": "manual_attendance_events_attendance_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (attendance_id) REFERENCES public.attendance_logs(id)",
      "validated": true
    },
    {
      "tab": "manual_attendance_events",
      "name": "manual_attendance_events_event_kind_check",
      "kind": "c",
      "def": "CHECK ((event_kind = ANY (ARRAY['created'::text, 'revised'::text, 'verified'::text])))",
      "validated": true
    },
    {
      "tab": "manual_attendance_events",
      "name": "manual_attendance_events_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.interns(id)",
      "validated": true
    },
    {
      "tab": "manual_attendance_events",
      "name": "manual_attendance_events_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "profiles",
      "name": "profiles_role_check",
      "kind": "c",
      "def": "CHECK ((role = ANY (ARRAY['intern'::text, 'instructor'::text, 'admin'::text, 'supervisor'::text])))",
      "validated": true
    },
    {
      "tab": "profiles",
      "name": "profiles_supervisor_company_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (supervisor_company_id) REFERENCES public.companies(id)",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_byte_size_check",
      "kind": "c",
      "def": "CHECK (((byte_size >= 1) AND (byte_size <= 10485760)))",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_check",
      "kind": "c",
      "def": "CHECK ((split_part(file_path, '/'::text, 1) = (intern_id)::text))",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_file_name_check",
      "kind": "c",
      "def": "CHECK (((length(file_name) >= 1) AND (length(file_name) <= 255)))",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_file_path_key",
      "kind": "u",
      "def": "UNIQUE (file_path)",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_mime_type_check",
      "kind": "c",
      "def": "CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text])))",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_ordinal_check",
      "kind": "c",
      "def": "CHECK (((ordinal >= 1) AND (ordinal <= 10)))",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_version_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (version_id) REFERENCES public.submission_versions(id)",
      "validated": true
    },
    {
      "tab": "submission_files",
      "name": "submission_files_version_id_ordinal_key",
      "kind": "u",
      "def": "UNIQUE (version_id, ordinal)",
      "validated": true
    },
    {
      "tab": "submission_reviews",
      "name": "submission_reviews_check",
      "kind": "c",
      "def": "CHECK (((status <> 'Needs Revision'::text) OR (NULLIF(btrim(note), ''::text) IS NOT NULL)))",
      "validated": true
    },
    {
      "tab": "submission_reviews",
      "name": "submission_reviews_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "submission_reviews",
      "name": "submission_reviews_note_check",
      "kind": "c",
      "def": "CHECK ((length(note) <= 500))",
      "validated": true
    },
    {
      "tab": "submission_reviews",
      "name": "submission_reviews_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "submission_reviews",
      "name": "submission_reviews_reviewed_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "submission_reviews",
      "name": "submission_reviews_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Approved'::text, 'Needs Revision'::text])))",
      "validated": true
    },
    {
      "tab": "submission_reviews",
      "name": "submission_reviews_version_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (version_id) REFERENCES public.submission_versions(id)",
      "validated": true
    },
    {
      "tab": "submission_reviews",
      "name": "submission_reviews_version_id_review_revision_key",
      "kind": "u",
      "def": "UNIQUE (version_id, review_revision)",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_check",
      "kind": "c",
      "def": "CHECK ((NOT ((committed_at IS NOT NULL) AND (abandoned_at IS NOT NULL))))",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_check1",
      "kind": "c",
      "def": "CHECK ((((committed_at IS NULL) AND (version_no IS NULL)) OR ((committed_at IS NOT NULL) AND (version_no > 0))))",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_description_check",
      "kind": "c",
      "def": "CHECK ((length(description) <= 2000))",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_expected_revision_check",
      "kind": "c",
      "def": "CHECK ((expected_revision >= 0))",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_expected_version_check",
      "kind": "c",
      "def": "CHECK ((expected_version >= 0))",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_note_check",
      "kind": "c",
      "def": "CHECK ((length(note) <= 500))",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_review_revision_check",
      "kind": "c",
      "def": "CHECK ((review_revision >= 0))",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_reviewed_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])))",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_submission_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (submission_id) REFERENCES public.submissions(id)",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_submission_id_version_no_key",
      "kind": "u",
      "def": "UNIQUE (submission_id, version_no)",
      "validated": true
    },
    {
      "tab": "submission_versions",
      "name": "submission_versions_title_check",
      "kind": "c",
      "def": "CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)))",
      "validated": true
    },
    {
      "tab": "submissions",
      "name": "submissions_current_version_check",
      "kind": "c",
      "def": "CHECK ((current_version >= 0))",
      "validated": true
    },
    {
      "tab": "submissions",
      "name": "submissions_description_check",
      "kind": "c",
      "def": "CHECK ((length(description) <= 2000))",
      "validated": true
    },
    {
      "tab": "submissions",
      "name": "submissions_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "submissions",
      "name": "submissions_note_check",
      "kind": "c",
      "def": "CHECK ((length(note) <= 500))",
      "validated": true
    },
    {
      "tab": "submissions",
      "name": "submissions_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "submissions",
      "name": "submissions_review_revision_check",
      "kind": "c",
      "def": "CHECK ((review_revision >= 0))",
      "validated": true
    },
    {
      "tab": "submissions",
      "name": "submissions_reviewed_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "submissions",
      "name": "submissions_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])))",
      "validated": true
    },
    {
      "tab": "submissions",
      "name": "submissions_title_check",
      "kind": "c",
      "def": "CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)))",
      "validated": true
    },
    {
      "tab": "supervisor_assignments",
      "name": "supervisor_assignments_assigned_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (assigned_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "supervisor_assignments",
      "name": "supervisor_assignments_check",
      "kind": "c",
      "def": "CHECK (((ended_at IS NULL) = (ended_by IS NULL)))",
      "validated": true
    },
    {
      "tab": "supervisor_assignments",
      "name": "supervisor_assignments_company_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (company_id) REFERENCES public.companies(id)",
      "validated": true
    },
    {
      "tab": "supervisor_assignments",
      "name": "supervisor_assignments_ended_by_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (ended_by) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "supervisor_assignments",
      "name": "supervisor_assignments_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.interns(id)",
      "validated": true
    },
    {
      "tab": "supervisor_assignments",
      "name": "supervisor_assignments_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "supervisor_assignments",
      "name": "supervisor_assignments_supervisor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (supervisor_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_assignment_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (assignment_id) REFERENCES public.supervisor_assignments(id)",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_check",
      "kind": "c",
      "def": "CHECK (((status = 'Supervisor Draft'::text) OR ((submitted_at IS NOT NULL) AND (coordinator_id IS NOT NULL) AND (public.rubric_score(criteria) IS NOT NULL) AND (overall_score = public.rubric_score(criteria)))))",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_company_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (company_id) REFERENCES public.companies(id)",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_coordinator_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (coordinator_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_feedback_check",
      "kind": "c",
      "def": "CHECK ((length(feedback) <= 2000))",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_id_version_key",
      "kind": "u",
      "def": "UNIQUE (id, version)",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_intern_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (intern_id) REFERENCES public.interns(id)",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_pkey",
      "kind": "p",
      "def": "PRIMARY KEY (id)",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Supervisor Draft'::text, 'Submitted to Coordinator'::text])))",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_supervisor_id_fkey",
      "kind": "f",
      "def": "FOREIGN KEY (supervisor_id) REFERENCES public.profiles(id)",
      "validated": true
    },
    {
      "tab": "supervisor_evaluations",
      "name": "supervisor_evaluations_version_check",
      "kind": "c",
      "def": "CHECK ((version > 0))",
      "validated": true
    }
  ],
  "indexes": [
    {
      "tab": "attendance_logs",
      "name": "m03_one_open_session",
      "def": "CREATE UNIQUE INDEX m03_one_open_session ON public.attendance_logs USING btree (intern_id) WHERE (time_out IS NULL)"
    },
    {
      "tab": "attendance_exceptions",
      "name": "m03_one_pending_correction",
      "def": "CREATE UNIQUE INDEX m03_one_pending_correction ON public.attendance_exceptions USING btree (intern_id, log_date) WHERE (status = 'Pending'::text)"
    },
    {
      "tab": "evaluations",
      "name": "m06_evaluation_retry",
      "def": "CREATE UNIQUE INDEX m06_evaluation_retry ON public.evaluations USING btree (evaluator_id, submission_id) WHERE (submission_id IS NOT NULL)"
    },
    {
      "tab": "submission_files",
      "name": "m10_files_version",
      "def": "CREATE INDEX m10_files_version ON public.submission_files USING btree (version_id, ordinal)"
    },
    {
      "tab": "submission_reviews",
      "name": "m10_reviews_version",
      "def": "CREATE INDEX m10_reviews_version ON public.submission_reviews USING btree (version_id, review_revision)"
    },
    {
      "tab": "submissions",
      "name": "m10_submissions_owner",
      "def": "CREATE INDEX m10_submissions_owner ON public.submissions USING btree (intern_id, id)"
    },
    {
      "tab": "submission_versions",
      "name": "m10_versions_submission",
      "def": "CREATE INDEX m10_versions_submission ON public.submission_versions USING btree (submission_id, id)"
    },
    {
      "tab": "audit_logs",
      "name": "m11_audit_actor",
      "def": "CREATE INDEX m11_audit_actor ON public.audit_logs USING btree (actor_id, created_at DESC, id DESC)"
    },
    {
      "tab": "audit_logs",
      "name": "m11_audit_order",
      "def": "CREATE INDEX m11_audit_order ON public.audit_logs USING btree (created_at DESC, id DESC)"
    },
    {
      "tab": "academic_years",
      "name": "m12_current_year",
      "def": "CREATE UNIQUE INDEX m12_current_year ON public.academic_years USING btree (is_current) WHERE is_current"
    },
    {
      "tab": "supervisor_assignments",
      "name": "m15_current_supervision",
      "def": "CREATE UNIQUE INDEX m15_current_supervision ON public.supervisor_assignments USING btree (supervisor_id, intern_id) WHERE (ended_at IS NULL)"
    }
  ],
  "functions": [
    {
      "name": "admin_add_requirement",
      "args": "p_intern_id uuid, p_name text, p_request_id uuid",
      "identity": "public.admin_add_requirement(uuid,text,uuid)",
      "result": "public.documents",
      "names": [
        "p_intern_id",
        "p_name",
        "p_request_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.admin_add_requirement(p_intern_id uuid, p_name text, p_request_id uuid)\n RETURNS public.documents\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nDECLARE r public.documents;\nBEGIN\n PERFORM pg_advisory_xact_lock(404,1);\n IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active Admin required' USING errcode='42501'; END IF;\n PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;\n IF p_request_id IS NULL OR nullif(btrim(p_name),'') IS NULL OR length(btrim(p_name))>200\n THEN RAISE EXCEPTION 'Requirement name (1-200 characters) and retry identity required'; END IF;\n IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_intern_id AND role='intern')\n  OR NOT EXISTS (SELECT 1 FROM public.interns WHERE id=p_intern_id)\n THEN RAISE EXCEPTION 'Current Intern account and extension required'; END IF;\n SELECT * INTO r FROM public.documents WHERE id=p_request_id;\n IF FOUND THEN\n  IF r.intern_id IS DISTINCT FROM p_intern_id OR r.name IS DISTINCT FROM btrim(p_name)\n   OR r.doc_type IS DISTINCT FROM 'custom:'||p_request_id::text\n  THEN RAISE EXCEPTION 'Requirement retry identity reused with different content' USING errcode='40001'; END IF;\n  RETURN r;\n END IF;\n INSERT INTO public.documents(id,intern_id,doc_type,name)\n VALUES(p_request_id,p_intern_id,'custom:'||p_request_id::text,btrim(p_name)) RETURNING * INTO r;\n RETURN r;\nEND $function$\n",
      "allowed": true,
      "source": "M12_handover_workflows.sql"
    },
    {
      "name": "admin_archive_master",
      "args": "p_table text, p_id uuid, p_expected_references bigint",
      "identity": "public.admin_archive_master(text,uuid,bigint)",
      "result": "jsonb",
      "names": [
        "p_table",
        "p_id",
        "p_expected_references"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.admin_archive_master(p_table text, p_id uuid, p_expected_references bigint)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare impact jsonb; entry jsonb;\nbegin\n perform pg_advisory_xact_lock(404,1);\n impact:=public.admin_master_impact(p_table,p_id);\n if not (impact->>'can_archive')::boolean then raise exception 'Already archived or current academic year; refresh'; end if;\n if (impact->>'references')::bigint is distinct from p_expected_references then raise exception 'Reference impact changed; inspect again' using errcode='40001'; end if;\n execute format('update public.%I set archived_at=clock_timestamp() where id=$1 and archived_at is null returning to_jsonb(%I)',p_table,p_table)\n  into entry using p_id;\n if entry is null then raise exception 'Entry changed; refresh' using errcode='40001'; end if;\n return jsonb_build_object('id',p_id,'entry',entry,'references',impact->'references');\nend $function$\n",
      "allowed": true,
      "source": "M11_admin_history.sql"
    },
    {
      "name": "admin_master_impact",
      "args": "p_table text, p_id uuid",
      "identity": "public.admin_master_impact(text,uuid)",
      "result": "jsonb",
      "names": [
        "p_table",
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.admin_master_impact(p_table text, p_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r jsonb; refs bigint;\r\nbegin\r\n if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;\r\n if p_table not in ('companies','course_sections','academic_years') or p_table is null then raise exception 'Unsupported master table'; end if;\r\n execute format('select to_jsonb(t) from public.%I t where id=$1',p_table) into r using p_id;\r\n if r is null then raise exception 'Entry missing; refresh' using errcode='40001'; end if;\r\n if p_table='companies' then select (select count(*) from public.interns where company_id=p_id)+(select count(*) from public.profiles where supervisor_company_id=p_id)+(select count(*) from public.supervisor_assignments where company_id=p_id)+(select count(*) from public.supervisor_evaluations where company_id=p_id) into refs;\r\n elsif p_table='course_sections' then select count(*) into refs from public.interns where section_id=p_id;\r\n else refs:=0; end if;\r\n return jsonb_build_object('id',p_id,'entry',r,'references',refs,'can_archive',r->>'archived_at' is null and coalesce((r->>'is_current')::boolean,false)=false);\r\nend $function$\n",
      "allowed": true,
      "source": "M15_supervisor_evaluations.sql"
    },
    {
      "name": "admin_reroute_evaluation",
      "args": "p_id uuid, p_coordinator_id uuid, p_reason text, p_expected_revision integer",
      "identity": "public.admin_reroute_evaluation(uuid,uuid,text,integer)",
      "result": "public.evaluation_reviews",
      "names": [
        "p_id",
        "p_coordinator_id",
        "p_reason",
        "p_expected_revision"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.admin_reroute_evaluation(p_id uuid, p_coordinator_id uuid, p_reason text, p_expected_revision integer)\n RETURNS public.evaluation_reviews\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.evaluation_reviews; s public.supervisor_evaluations;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;\r\n select * into r from public.evaluation_reviews where id=p_id for update;\r\n select * into s from public.supervisor_evaluations where id=p_id;\r\n if r.id is null or r.status='Published to Intern' or r.revision is distinct from p_expected_revision then raise exception 'Unpublished current review required'; end if;\r\n if not exists(select 1 from public.interns i join public.profiles p on p.id=i.instructor_id join public.profiles student on student.id=i.id\r\n where i.id=s.intern_id and i.company_id=s.company_id and i.instructor_id=p_coordinator_id and p.role='instructor' and p.status='Active' and student.role='intern' and student.status='Active')\r\n then raise exception 'Current eligible Coordinator and original company required'; end if;\r\n insert into public.evaluation_routing_events(source_id,previous_coordinator_id,coordinator_id,actor_id,reason) values(p_id,r.coordinator_id,p_coordinator_id,auth.uid(),p_reason);\r\n update public.evaluation_reviews set coordinator_id=p_coordinator_id,revision=revision+1,summary='',strengths='',improvements='',guidance='',criteria=s.criteria,adjustment_reason='',adjustment_reasons='{}',feedback_mode=null,feedback_choices=null,additional_remarks='',written_feedback=null,legacy_adjustment_reason=null,status='Submitted to Coordinator' where id=p_id returning * into r;\r\n return r;\r\nend $function$\n",
      "allowed": true,
      "source": "M16_evaluation_controls.sql"
    },
    {
      "name": "admin_reroute_logbook",
      "args": "p_id uuid, p_coordinator uuid, p_version integer, p_revision integer, p_reason text",
      "identity": "public.admin_reroute_logbook(uuid,uuid,integer,integer,text)",
      "result": "public.logbook_submissions",
      "names": [
        "p_id",
        "p_coordinator",
        "p_version",
        "p_revision",
        "p_reason"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.admin_reroute_logbook(p_id uuid, p_coordinator uuid, p_version integer, p_revision integer, p_reason text)\n RETURNS public.logbook_submissions\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare s public.logbook_submissions; v public.logbook_versions; previous jsonb;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;\r\n select * into s from public.logbook_submissions where id=p_id for update;\r\n select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version;\r\n if s.id is null or v.status='Verified' or v.version is distinct from p_version or v.revision is distinct from p_revision or p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'Current unresolved submission and meaningful rerouting reason required'; end if;\r\n if not exists(select 1 from public.interns i join public.profiles p on p.id=i.instructor_id join public.profiles student on student.id=i.id where i.id=s.intern_id and i.company_id=s.company_id and i.instructor_id=p_coordinator and p.role='instructor' and p.status='Active' and student.role='intern' and student.status='Active') then raise exception 'Recipient must be current eligible assigned Coordinator in the preserved company'; end if;\r\n previous:=to_jsonb(s);\r\n update public.logbook_submissions set coordinator_id=p_coordinator where id=p_id returning * into s;\r\n -- Invalidate any open review, without rewriting original receiving identity.\r\n update public.logbook_versions set revision=revision+1 where submission_id=p_id and version=v.version;\r\n insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'admin_rerouted',previous,to_jsonb(s)||jsonb_build_object('reason',btrim(p_reason)));\r\n return s;\r\nend $function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "admin_set_assignment",
      "args": "p_id uuid, p_instructor_id uuid, p_company_id uuid, p_section_id uuid, p_required_hours numeric",
      "identity": "public.admin_set_assignment(uuid,uuid,uuid,uuid,numeric)",
      "result": "public.interns",
      "names": [
        "p_id",
        "p_instructor_id",
        "p_company_id",
        "p_section_id",
        "p_required_hours"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.admin_set_assignment(p_id uuid, p_instructor_id uuid, p_company_id uuid, p_section_id uuid, p_required_hours numeric)\n RETURNS public.interns\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.interns;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;\r\n perform 1 from public.profiles where id=auth.uid() for share;\r\n if not public.valid_required_hours(p_required_hours) then raise exception 'Required hours must be >0, <=10000, at most two decimal places'; end if;\r\n if not exists(select 1 from public.profiles where id=p_id and role='intern') then raise exception 'Current intern required'; end if;\r\n if p_instructor_id is not null and not exists(select 1 from public.profiles where id=p_instructor_id and role='instructor' and status='Active')\r\n then raise exception 'Active instructor required'; end if;\r\n update public.interns set instructor_id=p_instructor_id,company_id=p_company_id,section_id=p_section_id,required_hours=p_required_hours\r\n where id=p_id returning * into r;\r\n if not found then raise exception 'Intern extension not found; refresh' using errcode='40001'; end if;\r\n return r;\r\nend $function$\n",
      "allowed": true,
      "source": "M07_account_lifecycle.sql"
    },
    {
      "name": "admin_set_current_year",
      "args": "p_id uuid, p_expected_current uuid",
      "identity": "public.admin_set_current_year(uuid,uuid)",
      "result": "jsonb",
      "names": [
        "p_id",
        "p_expected_current"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.admin_set_current_year(p_id uuid, p_expected_current uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nDECLARE chosen public.academic_years; previous uuid;\nBEGIN\n PERFORM pg_advisory_xact_lock(404,1);\n IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active Admin required' USING errcode='42501'; END IF;\n PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;\n SELECT * INTO chosen FROM public.academic_years WHERE id=p_id FOR UPDATE;\n IF NOT FOUND OR chosen.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Active academic year required; refresh' USING errcode='40001'; END IF;\n SELECT id INTO previous FROM public.academic_years WHERE is_current;\n IF previous=p_id THEN RETURN jsonb_build_object('id',p_id,'year',to_jsonb(chosen),'previous_id',previous); END IF;\n IF previous IS DISTINCT FROM p_expected_current THEN RAISE EXCEPTION 'Current year changed; refresh before confirming' USING errcode='40001'; END IF;\n UPDATE public.academic_years SET is_current=false WHERE is_current;\n UPDATE public.academic_years SET is_current=true WHERE id=p_id RETURNING * INTO chosen;\n RETURN jsonb_build_object('id',p_id,'year',to_jsonb(chosen),'previous_id',previous);\nEND $function$\n",
      "allowed": true,
      "source": "M12_handover_workflows.sql"
    },
    {
      "name": "admin_set_supervision",
      "args": "p_supervisor_id uuid, p_intern_id uuid, p_assigned boolean",
      "identity": "public.admin_set_supervision(uuid,uuid,boolean)",
      "result": "public.supervisor_assignments",
      "names": [
        "p_supervisor_id",
        "p_intern_id",
        "p_assigned"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.admin_set_supervision(p_supervisor_id uuid, p_intern_id uuid, p_assigned boolean)\n RETURNS public.supervisor_assignments\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.supervisor_assignments; company uuid;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;\r\n if p_assigned is null then raise exception 'Assignment decision required'; end if;\r\n select * into r from public.supervisor_assignments where supervisor_id=p_supervisor_id and intern_id=p_intern_id and ended_at is null;\r\n if not p_assigned then\r\n  if not found then raise exception 'Current assignment not found; refresh'; end if;\r\n  update public.supervisor_assignments set ended_at=clock_timestamp(),ended_by=auth.uid() where id=r.id returning * into r; return r;\r\n end if;\r\n select supervisor_company_id into company from public.profiles where id=p_supervisor_id and role='supervisor' and status='Active';\r\n if company is null or not exists(select 1 from public.interns i join public.profiles p on p.id=i.id\r\n where i.id=p_intern_id and i.company_id=company and p.role='intern' and p.status='Active')\r\n or not exists(select 1 from public.companies where id=company and archived_at is null)\r\n then raise exception 'Active Supervisor and Intern in the same available company required'; end if;\r\n if r.id is not null then return r; end if;\r\n insert into public.supervisor_assignments(supervisor_id,intern_id,company_id,assigned_by) values(p_supervisor_id,p_intern_id,company,auth.uid()) returning * into r; return r;\r\nend $function$\n",
      "allowed": true,
      "source": "M15_supervisor_evaluations.sql"
    },
    {
      "name": "admin_update_account",
      "args": "p_id uuid, p_patch jsonb",
      "identity": "public.admin_update_account(uuid,jsonb)",
      "result": "jsonb",
      "names": [
        "p_id",
        "p_patch"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.admin_update_account(p_id uuid, p_patch jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare p public.profiles; i public.interns; k text; next_role text; next_status text;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;\r\n perform 1 from public.profiles where id=auth.uid() for share;\r\n if jsonb_typeof(p_patch) is distinct from 'object' or p_patch='{}'::jsonb then raise exception 'Account patch required'; end if;\r\n for k in select jsonb_object_keys(p_patch) loop\r\n  if k not in ('full_name','role','status','company_id') then raise exception 'Unsupported account field'; end if;\r\n end loop;\r\n select * into p from public.profiles where id=p_id for update;\r\n if not found then raise exception 'Account not found; refresh' using errcode='40001'; end if;\r\n next_role:=case when p_patch?'role' then p_patch->>'role' else p.role end;\r\n next_status:=case when p_patch?'status' then p_patch->>'status' else p.status end;\r\n if next_role is null or next_role not in ('intern','instructor','admin','supervisor') or next_status is null or next_status not in ('Pending','Inactive','Active')\r\n then raise exception 'Valid role/status required'; end if;\r\n if p_patch?'full_name' and (jsonb_typeof(p_patch->'full_name') is distinct from 'string' or nullif(btrim(p_patch->>'full_name'),'') is null or length(p_patch->>'full_name')>200)\r\n then raise exception 'Name required, <=200 characters'; end if;\r\n if (next_role<>'instructor' or next_status<>'Active') and exists(select 1 from public.interns where instructor_id=p_id)\r\n then raise exception 'Reassign or explicitly unassign interns first'; end if;\r\n if next_role<>'intern' and exists(select 1 from public.interns where id=p_id and instructor_id is not null)\r\n then raise exception 'Explicitly unassign this intern before changing role'; end if;\r\n if next_role='intern' then\r\n   insert into public.interns(id) values(p_id) on conflict(id) do nothing;\r\n   if p_patch?'company_id' then\r\n    update public.interns set company_id=(p_patch->>'company_id')::uuid where id=p_id;\r\n   end if;\r\n elsif next_role='supervisor' then\r\n   if not exists(select 1 from public.companies where id=coalesce((p_patch->>'company_id')::uuid,p.supervisor_company_id) and archived_at is null) then raise exception 'Select an available Supervisor company'; end if;\r\n elsif p_patch?'company_id' then raise exception 'Company applies to Intern or Supervisor accounts'; end if;\r\n update public.profiles set full_name=case when p_patch?'full_name' then btrim(p_patch->>'full_name') else full_name end,\r\n   role=next_role,status=next_status,supervisor_company_id=case when next_role='supervisor' then case when p_patch?'company_id' then (p_patch->>'company_id')::uuid else supervisor_company_id end else null end where id=p_id returning * into p;\r\n select * into i from public.interns where id=p_id;\r\n -- Deferred triggers also enforce trusted SQL changes; errors still abort RPC.\r\n return jsonb_build_object('id',p.id,'profile',to_jsonb(p),'intern',case when i.id is null then null else to_jsonb(i) end);\r\nend $function$\n",
      "allowed": true,
      "source": "M15_supervisor_evaluations.sql"
    },
    {
      "name": "assigned_intern",
      "args": "p_id uuid",
      "identity": "public.assigned_intern(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.assigned_intern(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ select coalesce(public.current_role()='instructor' and exists(\r\n     select 1 from public.interns i join public.profiles p on p.id=i.id\r\n     where i.id=p_id and i.instructor_id=auth.uid() and p.role='intern'),false) $function$\n",
      "allowed": true,
      "source": "M01_authority.sql"
    },
    {
      "name": "attach_standard_docs",
      "args": "p_id uuid",
      "identity": "public.attach_standard_docs(uuid)",
      "result": "jsonb",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.attach_standard_docs(p_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare result jsonb;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;\r\n if not exists(select 1 from public.profiles where id=p_id and role='intern') then raise exception 'Current intern required'; end if;\r\n insert into public.documents(intern_id,doc_type,name)\r\n select p_id,t,k from (values('moa','Memorandum of Agreement (MOA)'),('endorsement','Endorsement Letter'),\r\n   ('consent','Parent / Guardian Consent Form'),('medical','Medical Certificate')) x(t,k)\r\n on conflict(intern_id,doc_type) do nothing;\r\n select coalesce(jsonb_agg(to_jsonb(d) order by d.doc_type),'[]'::jsonb) into result from public.documents d where intern_id=p_id;\r\n return jsonb_build_object('id',p_id,'documents',result);\r\nend $function$\n",
      "allowed": true,
      "source": "M08_document_versions.sql"
    },
    {
      "name": "attendance_sheet_access",
      "args": "p_id uuid",
      "identity": "public.attendance_sheet_access(uuid)",
      "result": "jsonb",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.attendance_sheet_access(p_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare e public.attendance_sheet_evidence;\nbegin\n select * into e from public.attendance_sheet_evidence where id=p_id;\n if not found or e.abandoned_at is not null or not public.attendance_sheet_object_allowed(e.file_path,'read') then raise exception 'Authorized sheet review required' using errcode='42501'; end if;\n return jsonb_build_object('bucket','attendance-evidence','path',e.file_path,'name',e.file_name,'mime',e.mime_type);\nend $function$\n",
      "allowed": true,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "attendance_sheet_context",
      "args": "p_intern uuid",
      "identity": "public.attendance_sheet_context(uuid)",
      "result": "jsonb",
      "names": [
        "p_intern"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.attendance_sheet_context(p_intern uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare result jsonb;\nbegin\n if not public.can_read_intern(p_intern) then raise exception 'Own or assigned Intern required' using errcode='42501'; end if;\n select jsonb_build_object('intern_id',i.id,'intern_name',p.full_name,'identifier',coalesce(nullif(p.student_id,''),p.id::text),\n 'current_company_id',i.company_id,'companies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)\n from public.companies c where public.manual_company_allowed(i.id,c.id)),'[]'::jsonb)) into result\n from public.interns i join public.profiles p on p.id=i.id where i.id=p_intern;\n if result is null then raise exception 'Intern record unavailable'; end if;\n return result;\nend $function$\n",
      "allowed": true,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "attendance_sheet_object_allowed",
      "args": "p_path text, p_operation text",
      "identity": "public.attendance_sheet_object_allowed(text,text)",
      "result": "boolean",
      "names": [
        "p_path",
        "p_operation"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.attendance_sheet_object_allowed(p_path text, p_operation text)\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare e public.attendance_sheet_evidence;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n select * into e from public.attendance_sheet_evidence where file_path=p_path;\r\n if not found then return false; end if;\r\n -- DELETE predicates also require SELECT visibility. Abandoned, unreferenced\r\n -- uploads remain visible to their still-authorized uploader for byte cleanup.\r\n if p_operation='read' then return public.can_read_attendance_sheet(e.id) and ((e.abandoned_at is null and e.ready_at is not null) or e.uploaded_by=auth.uid()); end if;\r\n if (public.current_role() is distinct from 'instructor' and not (public.current_role()='supervisor' and e.logbook_submission_id is not null)) or e.uploaded_by<>auth.uid() then return false; end if;\r\n if p_operation='insert' and e.logbook_submission_id is not null then\r\n return public.supervises_intern(e.participant_ids[1]) and exists(select 1 from public.logbook_submissions s join public.logbook_versions v on v.submission_id=s.id and v.version=s.current_version where s.id=e.logbook_submission_id and s.supervisor_id=auth.uid() and exists(select 1 from public.supervisor_assignments a where a.id=s.assignment_id and a.ended_at is null) and v.status in ('Draft','Returned for Correction')) and e.ready_at is null and e.abandoned_at is null and e.expires_at>clock_timestamp(); end if;\r\n if p_operation='insert' then return public.can_read_attendance_sheet(e.id) and e.ready_at is null and e.abandoned_at is null and e.expires_at>clock_timestamp(); end if;\r\n if p_operation='delete' then return e.abandoned_at is not null and e.committed_at is null\r\n and not exists(select 1 from public.attendance_logs where manual_evidence_id=e.id)\r\n and not exists(select 1 from public.manual_attendance_events where before_values->>'manual_evidence_id'=e.id::text or after_values->>'manual_evidence_id'=e.id::text); end if;\r\n return false;\r\nend $function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "audit_history",
      "args": "p_actor text, p_action text, p_category text, p_from date, p_to date, p_page integer, p_size integer",
      "identity": "public.audit_history(text,text,text,date,date,integer,integer)",
      "result": "jsonb",
      "names": [
        "p_actor",
        "p_action",
        "p_category",
        "p_from",
        "p_to",
        "p_page",
        "p_size"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.audit_history(p_actor text DEFAULT ''::text, p_action text DEFAULT ''::text, p_category text DEFAULT ''::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_page integer DEFAULT 1, p_size integer DEFAULT 25)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare result jsonb;\nbegin\n if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;\n if p_size is null or p_size not in (10,25,50,100) or p_page is null or p_page<1 then raise exception 'Valid page and page size required'; end if;\n if p_from>p_to then raise exception 'Start date must not exceed end date'; end if;\n if length(p_actor)>200 or length(p_action)>200 or length(p_category)>100 then raise exception 'Filter too long'; end if;\n with filtered as materialized (\n  select l.* from public.audit_logs l where\n   (coalesce(p_actor,'')='' or strpos(lower(coalesce(l.actor_name,'')),lower(p_actor))>0 or l.actor_id::text=p_actor)\n   and (coalesce(p_action,'')='' or strpos(lower(coalesce(l.action,'')),lower(p_action))>0)\n   and (coalesce(p_category,'')='' or l.event_data->>'table'=p_category)\n   and (p_from is null or l.created_at >= p_from::timestamp at time zone 'Asia/Manila')\n   and (p_to is null or l.created_at < (p_to+1)::timestamp at time zone 'Asia/Manila')\n ), counted as (select count(*) n from filtered), paging as (\n  select n,greatest(1,ceil(n::numeric/p_size)::integer) pages,\n   least(p_page,greatest(1,ceil(n::numeric/p_size)::integer)) page from counted\n ), page_rows as (\n  select * from filtered order by created_at desc,id desc limit p_size offset (select (page-1)::bigint*p_size from paging)\n ) select jsonb_build_object('id','audit-history','total',n,'pages',pages,'page',page,'size',p_size,\n  'rows',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from page_rows x),'[]'::jsonb)) into result from paging;\n return result;\nend $function$\n",
      "allowed": true,
      "source": "M11_admin_history.sql"
    },
    {
      "name": "bind_announcement",
      "args": "",
      "identity": "public.bind_announcement()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.bind_announcement()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nbegin\r\n  if public.current_role() not in ('admin','instructor') or public.current_role() is null\r\n     or new.instructor_id is distinct from auth.uid() then\r\n    raise exception 'Active staff author required' using errcode='42501';\r\n  end if;\r\n  if new.recipient_ids is not null then raise exception 'Audience is server-derived'; end if;\r\n  if new.target_intern_id is null then\r\n    if new.target <> 'All Interns' then raise exception 'Recipient UUID required'; end if;\r\n    select coalesce(array_agg(i.id),array[]::uuid[]) into new.recipient_ids\r\n    from public.interns i join public.profiles p on p.id=i.id\r\n    where i.instructor_id=auth.uid() and p.role='intern' and p.status='Active';\r\n    if cardinality(new.recipient_ids)=0 then raise exception 'No active assigned recipients'; end if;\r\n  else\r\n    if new.target='All Interns' or not exists(select 1 from public.interns i join public.profiles p on p.id=i.id\r\n      where i.id=new.target_intern_id and i.instructor_id=auth.uid() and p.role='intern' and p.status='Active') then\r\n      raise exception 'Recipient must be an active assigned intern' using errcode='42501';\r\n    end if;\r\n    new.target := 'Personal'; -- Display names are not identity or privacy rules.\r\n    new.recipient_ids := array[new.target_intern_id];\r\n  end if;\r\n  return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M01_authority.sql"
    },
    {
      "name": "can_delete_staged_document",
      "args": "p_path text",
      "identity": "public.can_delete_staged_document(text)",
      "result": "boolean",
      "names": [
        "p_path"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_delete_staged_document(p_path text)\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nBEGIN\n PERFORM pg_advisory_xact_lock(404,1);\n RETURN public.owns_intern(auth.uid()) AND (\n  EXISTS(SELECT 1 FROM public.document_versions WHERE file_path=p_path AND intern_id=auth.uid() AND committed_at IS NULL AND abandoned_at IS NOT NULL)\n  OR EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id\n   WHERE f.file_path=p_path AND f.intern_id=auth.uid() AND v.committed_at IS NULL AND v.abandoned_at IS NOT NULL))\n  AND NOT EXISTS(SELECT 1 FROM public.documents WHERE file_path=p_path)\n  AND NOT EXISTS(SELECT 1 FROM public.document_versions WHERE file_path=p_path AND committed_at IS NOT NULL)\n  AND NOT EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id WHERE f.file_path=p_path AND v.committed_at IS NOT NULL)\n  AND NOT EXISTS(SELECT 1 FROM public.documents WHERE legacy_evidence->>'file_path'=p_path);\nEND $function$\n",
      "allowed": true,
      "source": "M12_handover_workflows.sql"
    },
    {
      "name": "can_insert_reserved_document",
      "args": "p_path text",
      "identity": "public.can_insert_reserved_document(text)",
      "result": "boolean",
      "names": [
        "p_path"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_insert_reserved_document(p_path text)\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nbegin\n perform pg_advisory_xact_lock(404,1);\n return public.owns_intern(auth.uid()) and (\n  exists(select 1 from public.document_versions v join public.documents d on d.id=v.document_id\n   where v.file_path=p_path and v.intern_id=auth.uid() and v.committed_at is null and v.abandoned_at is null\n    and v.expires_at>clock_timestamp() and v.expected_version=d.upload_version)\n  or exists(select 1 from public.submission_files f join public.submission_versions v on v.id=f.version_id join public.submissions s on s.id=v.submission_id\n   where f.file_path=p_path and f.intern_id=auth.uid() and v.committed_at is null and v.abandoned_at is null\n    and v.expires_at>clock_timestamp() and v.expected_version=s.current_version and v.expected_revision=s.review_revision));\nend $function$\n",
      "allowed": true,
      "source": "M10_flexible_submissions.sql"
    },
    {
      "name": "can_read_attendance_sheet",
      "args": "p_id uuid",
      "identity": "public.can_read_attendance_sheet(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_read_attendance_sheet(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select exists(select 1 from public.attendance_sheet_evidence e where e.id=p_id and\r\n case when e.logbook_submission_id is not null then public.can_read_logbook_evidence(e.id) else\r\n public.is_admin() or (public.current_role()='instructor' and not exists(select 1 from unnest(e.participant_ids) i where not public.assigned_intern(i))) end)\r\n$function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "can_read_document_object",
      "args": "p_path text",
      "identity": "public.can_read_document_object(text)",
      "result": "boolean",
      "names": [
        "p_path"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_read_document_object(p_path text)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\n SELECT public.is_active() AND ((public.current_role()='intern' AND split_part(p_path,'/',1)=auth.uid()::text) OR public.is_admin()\n  OR EXISTS(SELECT 1 FROM public.documents d WHERE d.file_path=p_path AND split_part(p_path,'/',1)=d.intern_id::text AND public.assigned_intern(d.intern_id))\n  OR EXISTS(SELECT 1 FROM public.document_versions v WHERE v.file_path=p_path AND v.committed_at IS NOT NULL AND public.assigned_intern(v.intern_id))\n  OR EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id\n   WHERE f.file_path=p_path AND v.committed_at IS NOT NULL AND public.assigned_intern(f.intern_id))\n  OR EXISTS(SELECT 1 FROM public.documents d WHERE d.legacy_evidence->>'file_path'=p_path\n   AND split_part(p_path,'/',1)=d.intern_id::text AND d.legacy_evidence->>'intern_id'=d.intern_id::text\n   AND d.legacy_evidence->>'id'=d.id::text AND d.legacy_evidence->>'upload_version'='0'\n   AND d.legacy_evidence->>'provenance'='stored-legacy-metadata-unverified' AND public.assigned_intern(d.intern_id)))\n$function$\n",
      "allowed": true,
      "source": "M12_handover_workflows.sql"
    },
    {
      "name": "can_read_intern",
      "args": "p_id uuid",
      "identity": "public.can_read_intern(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_read_intern(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ select public.can_review(p_id) or public.owns_intern(p_id) $function$\n",
      "allowed": true,
      "source": "M01_authority.sql"
    },
    {
      "name": "can_read_logbook",
      "args": "p_id uuid",
      "identity": "public.can_read_logbook(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_read_logbook(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select public.is_admin() or exists(select 1 from public.logbook_submissions s where s.id=p_id and\r\n ((public.current_role()='supervisor' and s.supervisor_id=auth.uid()) or\r\n (public.current_role()='instructor' and s.coordinator_id=auth.uid() and public.assigned_intern(s.intern_id)\r\n and exists(select 1 from public.interns i join public.profiles p on p.id=i.id where i.id=s.intern_id and i.company_id=s.company_id and p.role='intern' and p.status='Active')\r\n and exists(select 1 from public.logbook_versions v where v.submission_id=s.id and v.status<>'Draft'))))\r\n$function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "can_read_logbook_evidence",
      "args": "p_id uuid",
      "identity": "public.can_read_logbook_evidence(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_read_logbook_evidence(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select exists(select 1 from public.attendance_sheet_evidence e join public.logbook_submissions s on s.id=e.logbook_submission_id where e.id=p_id and\r\n (public.is_admin() or (public.current_role()='supervisor' and s.supervisor_id=auth.uid()) or\r\n (public.can_review_logbook(s.id) and exists(select 1 from public.logbook_versions v where v.submission_id=s.id and v.status<>'Draft' and e.id=any(v.evidence_ids)))))\r\n$function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "can_review",
      "args": "p_id uuid",
      "identity": "public.can_review(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_review(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ select public.is_admin() or public.assigned_intern(p_id) $function$\n",
      "allowed": true,
      "source": "M01_authority.sql"
    },
    {
      "name": "can_review_logbook",
      "args": "p_id uuid",
      "identity": "public.can_review_logbook(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_review_logbook(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select public.current_role()='instructor' and exists(select 1 from public.logbook_submissions where id=p_id and coordinator_id=auth.uid()) and public.can_read_logbook(p_id)\r\n$function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "can_review_source",
      "args": "p_id uuid",
      "identity": "public.can_review_source(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.can_review_source(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select public.is_admin() or exists(select 1 from public.evaluation_reviews r join public.supervisor_evaluations s on s.id=r.id\r\n join public.interns i on i.id=s.intern_id join public.profiles p on p.id=i.id\r\n where r.id=p_id and s.status='Submitted to Coordinator' and r.coordinator_id=auth.uid() and public.assigned_intern(s.intern_id)\r\n and i.company_id=s.company_id and p.role='intern' and p.status='Active')\r\n$function$\n",
      "allowed": true,
      "source": "M15_supervisor_evaluations.sql"
    },
    {
      "name": "cancel_attendance_sheet",
      "args": "p_id uuid",
      "identity": "public.cancel_attendance_sheet(uuid)",
      "result": "jsonb",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.cancel_attendance_sheet(p_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare e public.attendance_sheet_evidence;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n select * into e from public.attendance_sheet_evidence where id=p_id for update;\r\n if not found or e.uploaded_by<>auth.uid() or (public.current_role() is distinct from 'instructor' and not (public.current_role()='supervisor' and e.logbook_submission_id is not null)) then raise exception 'Own Coordinator upload required' using errcode='42501'; end if;\r\n if e.committed_at is not null or exists(select 1 from public.attendance_logs where manual_evidence_id=p_id)\r\n or exists(select 1 from public.manual_attendance_events where before_values->>'manual_evidence_id'=p_id::text or after_values->>'manual_evidence_id'=p_id::text) then raise exception 'Referenced attendance evidence must be preserved'; end if;\r\n if e.abandoned_at is null then update public.attendance_sheet_evidence set abandoned_at=clock_timestamp() where id=p_id returning * into e; end if;\r\n return to_jsonb(e)||jsonb_build_object('object_exists',exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path));\r\nend $function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "cancel_document_upload",
      "args": "p_id uuid",
      "identity": "public.cancel_document_upload(uuid)",
      "result": "jsonb",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.cancel_document_upload(p_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare v public.document_versions; d public.documents;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n select * into v from public.document_versions where id=p_id and intern_id=auth.uid() for update;\r\n if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned reservation required' using errcode='42501'; end if;\r\n if v.committed_at is not null then\r\n   select * into d from public.documents where id=v.document_id;\r\n   return jsonb_build_object('id',v.id,'committed',true,'document',to_jsonb(d));\r\n end if;\r\n update public.document_versions set abandoned_at=coalesce(abandoned_at,clock_timestamp()) where id=v.id;\r\n return jsonb_build_object('id',v.id,'committed',false,'path',v.file_path,\r\n   'object_exists',exists(select 1 from storage.objects where bucket_id='documents' and name=v.file_path));\r\nend $function$\n",
      "allowed": true,
      "source": "M08_document_versions.sql"
    },
    {
      "name": "cancel_submission",
      "args": "p_version_id uuid",
      "identity": "public.cancel_submission(uuid)",
      "result": "jsonb",
      "names": [
        "p_version_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.cancel_submission(p_version_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare v public.submission_versions; s public.submissions; paths jsonb;\nbegin\n perform pg_advisory_xact_lock(404,1);\n select * into v from public.submission_versions where id=p_version_id and intern_id=auth.uid() for update;\n if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned reservation required' using errcode='42501'; end if;\n if v.committed_at is not null then\n  select * into s from public.submissions where id=v.submission_id;\n  return jsonb_build_object('id',v.id,'committed',true,'submission',to_jsonb(s),'version',v.version_no);\n end if;\n update public.submission_versions set abandoned_at=coalesce(abandoned_at,clock_timestamp()) where id=v.id;\n select coalesce(jsonb_agg(jsonb_build_object('path',f.file_path,'object_exists',exists(select 1 from storage.objects where bucket_id='documents' and name=f.file_path)) order by f.ordinal),'[]'::jsonb)\n into paths from public.submission_files f where version_id=v.id;\n return jsonb_build_object('id',v.id,'committed',false,'files',paths);\nend $function$\n",
      "allowed": true,
      "source": "M10_flexible_submissions.sql"
    },
    {
      "name": "check_account_relationships",
      "args": "",
      "identity": "public.check_account_relationships()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.check_account_relationships()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare target uuid; p public.profiles;\r\nbegin\r\n target:=case when tg_op='DELETE' then old.id else new.id end;\r\n select * into p from public.profiles where id=target;\r\n if not found then return new; end if;\r\n if p.role='intern' and not exists(select 1 from public.interns where id=target) then raise exception 'Intern extension required'; end if;\r\n if (p.role<>'instructor' or p.status<>'Active') and exists(select 1 from public.interns where instructor_id=target)\r\n then raise exception 'Reassign or explicitly unassign interns before instructor demotion/deactivation'; end if;\r\n if exists(select 1 from public.interns i left join public.profiles staff on staff.id=i.instructor_id\r\n   where i.id=target and i.instructor_id is not null\r\n     and (p.role<>'intern' or staff.role is distinct from 'instructor' or staff.status is distinct from 'Active'))\r\n then raise exception 'Assignment requires an intern and an Active instructor'; end if;\r\n return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M07_account_lifecycle.sql"
    },
    {
      "name": "check_manual_session",
      "args": "p_intern uuid, p_in timestamp with time zone, p_out timestamp with time zone, p_exclude uuid",
      "identity": "public.check_manual_session(uuid,timestamp with time zone,timestamp with time zone,uuid)",
      "result": "void",
      "names": [
        "p_intern",
        "p_in",
        "p_out",
        "p_exclude"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.check_manual_session(p_intern uuid, p_in timestamp with time zone, p_out timestamp with time zone, p_exclude uuid)\n RETURNS void\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nbegin\n if p_in is null or p_out is null or not isfinite(p_in) or not isfinite(p_out) or p_out<=p_in then raise exception 'Both timestamps are required; Time Out must follow Time In with an explicit end date'; end if;\n if p_out-p_in>interval '16 hours' then raise exception 'Existing attendance limit: a session must be at most 16 hours'; end if;\n if p_in>clock_timestamp() or p_out>clock_timestamp() then raise exception 'Future attendance is not permitted'; end if;\n if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and time_out is null) then raise exception 'Open online attendance conflicts; manual entry cannot close or replace it'; end if;\n if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and clocked_in_at=p_in and clocked_out_at=p_out) then raise exception 'Exact duplicate attendance session'; end if;\n if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and clocked_in_at<p_out and clocked_out_at>p_in) then raise exception 'Attendance overlaps an existing online or manual session'; end if;\n if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and log_date=(p_in at time zone 'Asia/Manila')::date) then raise exception 'Existing model allows one session per Intern per Manila start date; this date already has attendance'; end if;\nend $function$\n",
      "allowed": false,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "clock_in",
      "args": "",
      "identity": "public.clock_in()",
      "result": "public.attendance_logs",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.clock_in()\n RETURNS public.attendance_logs\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.attendance_logs; ts timestamptz;\r\nbegin\r\n  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;\r\n  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,101));\r\n  perform 1 from public.profiles where id=auth.uid() for share;\r\n  if not public.owns_intern(auth.uid()) then raise exception 'Account changed; refresh' using errcode='42501'; end if;\r\n  ts:=clock_timestamp(); -- after serialization, including midnight lock waits\r\n  if exists(select 1 from public.attendance_logs where intern_id=auth.uid()\r\n    and (time_out is null or log_date=(ts at time zone 'Asia/Manila')::date)) then\r\n    raise exception 'Attendance already exists or a session is open; refresh' using errcode='40001';\r\n  end if;\r\n  insert into public.attendance_logs(intern_id,log_date,time_in,clocked_in_at,created_at,verified,verified_by)\r\n  values(auth.uid(),(ts at time zone 'Asia/Manila')::date,(ts at time zone 'Asia/Manila')::time,ts,ts,false,null) returning * into r;\r\n  return r;\r\nend $function$\n",
      "allowed": true,
      "source": "M03_attendance_integrity.sql"
    },
    {
      "name": "clock_out",
      "args": "p_id uuid, p_accomplishment text",
      "identity": "public.clock_out(uuid,text)",
      "result": "public.attendance_logs",
      "names": [
        "p_id",
        "p_accomplishment"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.clock_out(p_id uuid, p_accomplishment text)\n RETURNS public.attendance_logs\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.attendance_logs; ts timestamptz; seconds numeric;\r\nbegin\r\n  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;\r\n  if p_accomplishment is null or length(p_accomplishment)>500 then raise exception 'Accomplishment must be at most 500 characters'; end if;\r\n  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,101));\r\n  perform 1 from public.profiles where id=auth.uid() for share;\r\n  if not public.owns_intern(auth.uid()) then raise exception 'Account changed; refresh' using errcode='42501'; end if;\r\n  select * into r from public.attendance_logs where id=p_id and intern_id=auth.uid() for update;\r\n  if not found or r.time_out is not null or r.verified or r.clocked_in_at is null then\r\n    raise exception 'Open unverified clock session not found; refresh or request correction' using errcode='40001';\r\n  end if;\r\n  ts:=clock_timestamp(); seconds:=extract(epoch from ts-r.clocked_in_at);\r\n  if seconds<=0 or seconds>57600 then raise exception 'Shift duration must be positive and at most 16 hours; request correction'; end if;\r\n  update public.attendance_logs set time_out=(ts at time zone 'Asia/Manila')::time,clocked_out_at=ts,\r\n    hours=seconds/3600,accomplishment=p_accomplishment where id=r.id and time_out is null returning * into r;\r\n  if not found then raise exception 'Session changed; refresh' using errcode='40001'; end if;\r\n  return r;\r\nend $function$\n",
      "allowed": true,
      "source": "M03_attendance_integrity.sql"
    },
    {
      "name": "correction_instants",
      "args": "p_date date, p_in time without time zone, p_out time without time zone, p_end date",
      "identity": "public.correction_instants(date,time without time zone,time without time zone,date)",
      "result": "TABLE(start_at timestamp with time zone, end_at timestamp with time zone)",
      "names": [
        "p_date",
        "p_in",
        "p_out",
        "p_end",
        "start_at",
        "end_at"
      ],
      "modes": [
        "i",
        "i",
        "i",
        "i",
        "t",
        "t"
      ],
      "def": "CREATE OR REPLACE FUNCTION public.correction_instants(p_date date, p_in time without time zone, p_out time without time zone, p_end date)\n RETURNS TABLE(start_at timestamp with time zone, end_at timestamp with time zone)\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nbegin\r\n  if p_date is null or p_in is null or p_out is null or p_end is null\r\n     or p_end not in (p_date,p_date+1) then raise exception 'Explicit valid start/end date and times required'; end if;\r\n  start_at := (p_date+p_in) at time zone 'Asia/Manila';\r\n  end_at := (p_end+p_out) at time zone 'Asia/Manila';\r\n  if end_at<=start_at or end_at-start_at>interval '16 hours' or end_at>clock_timestamp() then\r\n    raise exception 'Invalid, future or excessive claimed interval';\r\n  end if;\r\n  return next;\r\nend $function$\n",
      "allowed": false,
      "source": "M01_authority.sql"
    },
    {
      "name": "current_role",
      "args": "",
      "identity": "public.\"current_role\"()",
      "result": "text",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.\"current_role\"()\n RETURNS text\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ select role from public.profiles where id=auth.uid() and status='Active' $function$\n",
      "allowed": true,
      "source": "M01_authority.sql"
    },
    {
      "name": "document_access",
      "args": "p_id uuid, p_expected_version bigint, p_expected_revision bigint",
      "identity": "public.document_access(uuid,bigint,bigint)",
      "result": "jsonb",
      "names": [
        "p_id",
        "p_expected_version",
        "p_expected_revision"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.document_access(p_id uuid, p_expected_version bigint, p_expected_revision bigint)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare d public.documents;\r\nbegin\r\n select * into d from public.documents where id=p_id;\r\n if not found or not public.can_read_intern(d.intern_id) then raise exception 'Document access not permitted' using errcode='42501'; end if;\r\n if d.upload_version is distinct from p_expected_version or d.review_revision is distinct from p_expected_revision\r\n then raise exception 'Evidence changed; refresh' using errcode='40001'; end if;\r\n if d.file_path is null or split_part(d.file_path,'/',1)<>d.intern_id::text\r\n or not exists(select 1 from storage.objects where bucket_id='documents' and name=d.file_path) then raise exception 'File missing; request resubmission'; end if;\r\n return jsonb_build_object('id',d.id,'file_path',d.file_path,'file_name',d.file_name,'upload_version',d.upload_version);\r\nend $function$\n",
      "allowed": true,
      "source": "M08_document_versions.sql"
    },
    {
      "name": "evaluation_adjustment_text",
      "args": "p_original jsonb, p_final jsonb, p_reasons jsonb",
      "identity": "public.evaluation_adjustment_text(jsonb,jsonb,jsonb)",
      "result": "text",
      "names": [
        "p_original",
        "p_final",
        "p_reasons"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.evaluation_adjustment_text(p_original jsonb, p_final jsonb, p_reasons jsonb)\n RETURNS text\n LANGUAGE plpgsql\n IMMUTABLE\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare c jsonb:=public.evaluation_feedback_catalog(); criterion text; reason jsonb; option jsonb; text_value text; result text:=''; overview text:='';\r\nbegin\r\n if public.rubric_score(p_original) is null or public.rubric_score(p_final) is null or jsonb_typeof(p_reasons) is distinct from 'object' then raise exception 'Valid ratings and per-criterion adjustment reasons required'; end if;\r\n for criterion in select jsonb_object_keys(p_reasons) loop\r\n  if criterion not in ('punctuality','performance','conduct','communication') or p_original->criterion=p_final->criterion then raise exception 'Reasons must match changed criteria'; end if;\r\n end loop;\r\n foreach criterion in array array['punctuality','performance','conduct','communication'] loop\r\n  if p_original->criterion=p_final->criterion then continue; end if;\r\n  reason:=p_reasons->criterion;\r\n  if jsonb_typeof(reason) is distinct from 'object' or not reason?'code' or not reason?'explanation'\r\n   or (select count(*) from jsonb_object_keys(reason))<>2 or jsonb_typeof(reason->'explanation') is distinct from 'string'\r\n  then raise exception 'Select a valid reason for changed criterion: %',criterion; end if;\r\n  select o into option from jsonb_array_elements(c->'adjustments'->criterion) o where o->>'id'=reason->>'code';\r\n  if not found then raise exception 'Select a valid reason for changed criterion: %',criterion; end if;\r\n  if option->>'id'='other' then\r\n   text_value:=regexp_replace(reason->>'explanation','^\\s+|\\s+$','','g');\r\n   if length(text_value)<10 or length(reason->>'explanation')>500 or text_value!~'[[:alpha:]]' then raise exception 'Other adjustment explanation must be meaningful, 10-500 characters'; end if;\r\n  else\r\n   if reason->>'explanation'<>'' then raise exception 'Preset reasons do not accept hidden explanations'; end if;\r\n   text_value:=option->>'text';\r\n  end if;\r\n  result:=result||case when result='' then '' else E'\\n' end||criterion||': '||text_value;\r\n  overview:=overview||case when overview='' then '' else E'\\n' end||criterion||': '||(option->>'label');\r\n end loop;\r\n -- Keep M15's 2000-character compatibility field. Full individual explanations\r\n -- are retained in adjustment_reasons and immutable adjustment events.\r\n return case when length(result)>2000 then overview||E'\\nFull explanations are retained in the per-criterion reasons.' else result end;\r\nend $function$\n",
      "allowed": false,
      "source": "M16_evaluation_controls.sql"
    },
    {
      "name": "evaluation_feedback_catalog",
      "args": "",
      "identity": "public.evaluation_feedback_catalog()",
      "result": "jsonb",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.evaluation_feedback_catalog()\n RETURNS jsonb\n LANGUAGE sql\n IMMUTABLE\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select $catalog${\"version\":1,\"groups\":{\"strengths\":[{\"id\":\"punctuality\",\"label\":\"Reliable attendance\",\"text\":\"Demonstrates reliable attendance and punctuality.\"},{\"id\":\"quality\",\"label\":\"Quality work\",\"text\":\"Produces careful, good-quality work.\"},{\"id\":\"conduct\",\"label\":\"Professional conduct\",\"text\":\"Demonstrates professional conduct in the workplace.\"},{\"id\":\"communication\",\"label\":\"Clear communication\",\"text\":\"Communicates clearly with the team.\"},{\"id\":\"teamwork\",\"label\":\"Teamwork\",\"text\":\"Works cooperatively with colleagues.\"},{\"id\":\"initiative\",\"label\":\"Initiative\",\"text\":\"Shows initiative when carrying out assigned work.\"}],\"improvements\":[{\"id\":\"none\",\"label\":\"No additional concerns\",\"text\":\"No additional concerns are recorded in this review.\"},{\"id\":\"punctuality\",\"label\":\"Attendance and punctuality\",\"text\":\"Attendance and punctuality need further attention.\"},{\"id\":\"quality\",\"label\":\"Work quality\",\"text\":\"Work quality needs further attention.\"},{\"id\":\"conduct\",\"label\":\"Workplace conduct\",\"text\":\"Workplace conduct needs further attention.\"},{\"id\":\"communication\",\"label\":\"Communication\",\"text\":\"Communication needs further attention.\"},{\"id\":\"time_management\",\"label\":\"Time management\",\"text\":\"Time management needs further attention.\"}],\"guidance\":[{\"id\":\"none\",\"label\":\"No additional actions\",\"text\":\"No additional actions are recommended at this review.\"},{\"id\":\"maintain\",\"label\":\"Maintain good practices\",\"text\":\"Continue the good practices identified in this review.\"},{\"id\":\"plan\",\"label\":\"Plan daily tasks\",\"text\":\"Plan daily tasks and check priorities with the Supervisor.\"},{\"id\":\"check_work\",\"label\":\"Check work before submission\",\"text\":\"Check completed work before submitting it.\"},{\"id\":\"ask\",\"label\":\"Ask for clarification\",\"text\":\"Ask for clarification when instructions or expectations are unclear.\"},{\"id\":\"updates\",\"label\":\"Provide progress updates\",\"text\":\"Provide regular progress updates to the Supervisor.\"},{\"id\":\"discuss\",\"label\":\"Discuss improvements with Supervisor\",\"text\":\"Discuss the identified areas for improvement with the Supervisor.\"}],\"overall\":[{\"id\":\"meeting\",\"label\":\"Meeting expectations\",\"text\":\"The intern is meeting the expectations discussed in this review.\"},{\"id\":\"progress\",\"label\":\"Making steady progress\",\"text\":\"The intern is making steady progress in the internship.\"},{\"id\":\"development\",\"label\":\"Further development needed\",\"text\":\"Further development is needed in the areas identified in this review.\"},{\"id\":\"support\",\"label\":\"Continued guidance recommended\",\"text\":\"Continued guidance is recommended to support the intern's development.\"}]},\"conflicts\":[[\"strengths:punctuality\",\"improvements:punctuality\"],[\"strengths:quality\",\"improvements:quality\"],[\"strengths:conduct\",\"improvements:conduct\"],[\"strengths:communication\",\"improvements:communication\"],[\"overall:development\",\"improvements:none\"],[\"overall:support\",\"guidance:none\"]],\"adjustments\":{\"punctuality\":[{\"id\":\"attendance_records\",\"label\":\"Reviewed attendance evidence\",\"text\":\"Adjusted after reviewing attendance evidence for this criterion.\"},{\"id\":\"supervisor_clarification\",\"label\":\"Clarified with Supervisor\",\"text\":\"Adjusted after clarifying the attendance rating with the Supervisor.\"},{\"id\":\"other\",\"label\":\"Other\",\"text\":null}],\"performance\":[{\"id\":\"work_evidence\",\"label\":\"Reviewed work evidence\",\"text\":\"Adjusted after reviewing work evidence for this criterion.\"},{\"id\":\"supervisor_clarification\",\"label\":\"Clarified with Supervisor\",\"text\":\"Adjusted after clarifying the work performance rating with the Supervisor.\"},{\"id\":\"other\",\"label\":\"Other\",\"text\":null}],\"conduct\":[{\"id\":\"conduct_evidence\",\"label\":\"Reviewed conduct evidence\",\"text\":\"Adjusted after reviewing workplace conduct evidence for this criterion.\"},{\"id\":\"supervisor_clarification\",\"label\":\"Clarified with Supervisor\",\"text\":\"Adjusted after clarifying the conduct rating with the Supervisor.\"},{\"id\":\"other\",\"label\":\"Other\",\"text\":null}],\"communication\":[{\"id\":\"communication_evidence\",\"label\":\"Reviewed communication evidence\",\"text\":\"Adjusted after reviewing communication evidence for this criterion.\"},{\"id\":\"supervisor_clarification\",\"label\":\"Clarified with Supervisor\",\"text\":\"Adjusted after clarifying the communication rating with the Supervisor.\"},{\"id\":\"other\",\"label\":\"Other\",\"text\":null}]}}$catalog$::jsonb\r\n$function$\n",
      "allowed": true,
      "source": "M16_evaluation_controls.sql"
    },
    {
      "name": "evaluation_feedback_text",
      "args": "p_choices jsonb, p_remarks text",
      "identity": "public.evaluation_feedback_text(jsonb,text)",
      "result": "jsonb",
      "names": [
        "p_choices",
        "p_remarks"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.evaluation_feedback_text(p_choices jsonb, p_remarks text)\n RETURNS jsonb\n LANGUAGE plpgsql\n IMMUTABLE\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare c jsonb:=public.evaluation_feedback_catalog(); selections jsonb:=public.normalize_evaluation_choices(p_choices); result jsonb:='{}'; g text; value text; remarks text;\r\nbegin\r\n if p_remarks is null or length(p_remarks)>1000 then raise exception 'Additional remarks must be at most 1000 characters'; end if;\r\n remarks:=regexp_replace(p_remarks,'^\\s+|\\s+$','','g');\r\n foreach g in array array['strengths','improvements','guidance','overall'] loop\r\n  select coalesce(string_agg(o->>'text',' ' order by n),'') into value from jsonb_array_elements(c->'groups'->g) with ordinality items(o,n) where (selections->g)?(o->>'id');\r\n  if g='overall' then\r\n   value:=case when value<>'' and remarks<>'' then value||E'\\n\\n'||remarks when remarks<>'' then remarks else value end;\r\n   result:=result||jsonb_build_object('summary',value);\r\n  else result:=result||jsonb_build_object(g,value); end if;\r\n end loop;\r\n return result;\r\nend $function$\n",
      "allowed": false,
      "source": "M16_evaluation_controls.sql"
    },
    {
      "name": "finalize_document_upload",
      "args": "p_upload_id uuid",
      "identity": "public.finalize_document_upload(uuid)",
      "result": "public.documents",
      "names": [
        "p_upload_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.finalize_document_upload(p_upload_id uuid)\n RETURNS public.documents\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nDECLARE v public.document_versions; d public.documents; snapshot jsonb;\nBEGIN\n PERFORM pg_advisory_xact_lock(404,1);\n SELECT * INTO v FROM public.document_versions WHERE id=p_upload_id AND intern_id=auth.uid() FOR UPDATE;\n IF NOT FOUND OR NOT public.owns_intern(auth.uid()) THEN RAISE EXCEPTION 'Owned reservation required' USING errcode='42501'; END IF;\n SELECT * INTO d FROM public.documents WHERE id=v.document_id FOR UPDATE;\n IF v.committed_at IS NOT NULL THEN RETURN d; END IF;\n IF v.abandoned_at IS NOT NULL OR v.expires_at<=clock_timestamp() OR v.expected_version<>d.upload_version\n THEN RAISE EXCEPTION 'Upload expired or evidence changed; refresh' USING errcode='40001'; END IF;\n IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='documents' AND name=v.file_path\n  AND metadata->>'mimetype'=v.mime_type AND (metadata->>'size')::numeric=v.byte_size)\n THEN RAISE EXCEPTION 'Stored object MIME/size evidence missing or mismatched'; END IF;\n snapshot:=d.legacy_evidence;\n IF d.upload_version=0 AND snapshot IS NULL AND (d.file_path IS NOT NULL OR d.file_name IS NOT NULL OR d.note IS NOT NULL OR d.reviewed_by IS NOT NULL OR d.reviewed_at IS NOT NULL OR d.status<>'Pending')\n THEN snapshot:=(to_jsonb(d)-'legacy_evidence')||jsonb_build_object('captured_at',clock_timestamp(),'provenance','stored-legacy-metadata-unverified'); END IF;\n UPDATE public.document_versions SET version_no=d.upload_version+1,committed_at=clock_timestamp() WHERE id=v.id;\n UPDATE public.documents SET file_path=v.file_path,file_name=v.file_name,upload_version=upload_version+1,review_revision=0,\n  status='Pending',note=null,reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp(),legacy_evidence=snapshot\n WHERE id=d.id RETURNING * INTO d;\n RETURN d;\nEND $function$\n",
      "allowed": true,
      "source": "M12_handover_workflows.sql"
    },
    {
      "name": "finalize_submission",
      "args": "p_version_id uuid",
      "identity": "public.finalize_submission(uuid)",
      "result": "public.submissions",
      "names": [
        "p_version_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.finalize_submission(p_version_id uuid)\n RETURNS public.submissions\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare v public.submission_versions; s public.submissions;\nbegin\n perform pg_advisory_xact_lock(404,1);\n select * into v from public.submission_versions where id=p_version_id and intern_id=auth.uid() for update;\n if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned reservation required' using errcode='42501'; end if;\n select * into s from public.submissions where id=v.submission_id for update;\n if v.committed_at is not null then return s; end if;\n if v.abandoned_at is not null or v.expires_at<=clock_timestamp() or v.expected_version<>s.current_version or v.expected_revision<>s.review_revision\n then raise exception 'Reservation expired or submission/review changed; refresh' using errcode='40001'; end if;\n if (select count(*) from public.submission_files where version_id=v.id)<>jsonb_array_length(v.manifest)\n  or exists(select 1 from public.submission_files f where version_id=v.id and not exists(select 1 from storage.objects o\n   where o.bucket_id='documents' and o.name=f.file_path and o.metadata->>'mimetype'=f.mime_type and (o.metadata->>'size')::numeric=f.byte_size))\n then raise exception 'Complete file set with exact stored MIME/size required'; end if;\n update public.submission_versions set version_no=s.current_version+1,committed_at=clock_timestamp() where id=v.id;\n update public.submissions set current_version=current_version+1,review_revision=0,title=v.title,description=v.description,\n  status='Pending',note=null,reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp() where id=s.id returning * into s;\n return s;\nend $function$\n",
      "allowed": true,
      "source": "M10_flexible_submissions.sql"
    },
    {
      "name": "finish_attendance_sheet",
      "args": "p_id uuid",
      "identity": "public.finish_attendance_sheet(uuid)",
      "result": "public.attendance_sheet_evidence",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.finish_attendance_sheet(p_id uuid)\n RETURNS public.attendance_sheet_evidence\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare e public.attendance_sheet_evidence;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n select * into e from public.attendance_sheet_evidence where id=p_id for update;\r\n if not found or e.uploaded_by<>auth.uid() or (public.current_role() is distinct from 'instructor' and not (public.current_role()='supervisor' and e.logbook_submission_id is not null)) or not public.can_read_attendance_sheet(p_id) then raise exception 'Own authorized sheet upload required' using errcode='42501'; end if;\r\n if e.logbook_submission_id is not null and e.committed_at is null and not exists(select 1 from public.logbook_submissions s join public.logbook_versions v on v.submission_id=s.id and v.version=s.current_version join public.supervisor_assignments a on a.id=s.assignment_id where s.id=e.logbook_submission_id and a.ended_at is null and public.supervises_intern(s.intern_id) and v.status in ('Draft','Returned for Correction')) then raise exception 'Current editable supervision assignment required' using errcode='42501'; end if;\r\n if e.abandoned_at is not null or (e.committed_at is null and e.expires_at<=clock_timestamp()) then raise exception 'Sheet reservation expired or abandoned'; end if;\r\n if not exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path\r\n and metadata->>'mimetype'=e.mime_type and (metadata->>'size')::numeric=e.byte_size) then raise exception 'Complete validated evidence upload required'; end if;\r\n if e.ready_at is not null then return e; end if;\r\n update public.attendance_sheet_evidence set ready_at=clock_timestamp() where id=p_id returning * into e;\r\n return e;\r\nend $function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "guard_alert_update",
      "args": "",
      "identity": "public.guard_alert_update()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_alert_update()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ begin\r\n  if not public.is_admin() and (to_jsonb(new)-'dismissed') is distinct from (to_jsonb(old)-'dismissed') then\r\n    raise exception 'Only dismissal may be changed' using errcode='42501';\r\n  end if;\r\n  return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M01_authority.sql"
    },
    {
      "name": "guard_archived_assignment",
      "args": "",
      "identity": "public.guard_archived_assignment()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_archived_assignment()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nbegin\n perform pg_advisory_xact_lock(404,1);\n if new.company_id is not null and (tg_op='INSERT' or new.company_id is distinct from old.company_id)\n  and exists(select 1 from public.companies where id=new.company_id and archived_at is not null)\n then raise exception 'Archived company cannot receive new assignments'; end if;\n if new.section_id is not null and (tg_op='INSERT' or new.section_id is distinct from old.section_id)\n  and exists(select 1 from public.course_sections where id=new.section_id and archived_at is not null)\n then raise exception 'Archived section cannot receive new assignments'; end if;\n return new;\nend $function$\n",
      "allowed": false,
      "source": "M11_admin_history.sql"
    },
    {
      "name": "guard_attendance_future",
      "args": "",
      "identity": "public.guard_attendance_future()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_attendance_future()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ begin\r\n  if tg_table_name='attendance_logs' then\r\n    if new.log_date>(clock_timestamp() at time zone 'Asia/Manila')::date\r\n      or new.clocked_in_at>clock_timestamp() or new.clocked_out_at>clock_timestamp() then\r\n      raise exception 'Future attendance is not permitted';\r\n    end if;\r\n  else\r\n    if new.log_date>(clock_timestamp() at time zone 'Asia/Manila')::date\r\n      or ((new.claimed_end_date+new.claimed_time_out) at time zone 'Asia/Manila')>clock_timestamp() then\r\n      raise exception 'Future correction is not permitted';\r\n    end if;\r\n  end if;\r\n  return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M03_attendance_integrity.sql"
    },
    {
      "name": "guard_attendance_sheet_history",
      "args": "",
      "identity": "public.guard_attendance_sheet_history()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_attendance_sheet_history()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nbegin\n if tg_op='DELETE' then raise exception 'Retain sheet reservation/history; clean abandoned bytes through Storage API'; end if;\n if old.committed_at is not null and new is distinct from old then raise exception 'Committed attendance evidence is immutable'; end if;\n if (to_jsonb(new)-array['ready_at','committed_at','abandoned_at']) is distinct from (to_jsonb(old)-array['ready_at','committed_at','abandoned_at']) then raise exception 'Sheet upload identity and participants are immutable'; end if;\n return new;\nend $function$\n",
      "allowed": false,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "guard_domain_identity",
      "args": "",
      "identity": "public.guard_domain_identity()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_domain_identity()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nbegin\r\n  if new.id is distinct from old.id or new.intern_id is distinct from old.intern_id then\r\n    raise exception 'Record ownership is immutable' using errcode='42501';\r\n  end if;\r\n  if tg_table_name='evaluations' then\r\n    if new.evaluator_id is distinct from old.evaluator_id then\r\n      raise exception 'Evaluation author is immutable' using errcode='42501';\r\n    end if;\r\n  end if;\r\n  return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M01_authority.sql"
    },
    {
      "name": "guard_evaluation_adjustment_event",
      "args": "",
      "identity": "public.guard_evaluation_adjustment_event()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_evaluation_adjustment_event()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ begin raise exception 'Adjustment history is immutable'; end $function$\n",
      "allowed": false,
      "source": "M16_evaluation_controls.sql"
    },
    {
      "name": "guard_frozen_evaluation",
      "args": "",
      "identity": "public.guard_frozen_evaluation()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_frozen_evaluation()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nbegin\r\n if tg_op='DELETE' or tg_table_name='evaluations' then raise exception 'Evaluation history is immutable'; end if;\r\n if old.status='Submitted to Coordinator' then raise exception 'Evaluation history is immutable'; end if;\r\n if new.id<>old.id or new.supervisor_id<>old.supervisor_id or new.intern_id<>old.intern_id or new.company_id<>old.company_id or new.assignment_id<>old.assignment_id or new.rubric<>old.rubric then raise exception 'Source identity is immutable'; end if;\r\n return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M15_supervisor_evaluations.sql"
    },
    {
      "name": "guard_last_active_admin",
      "args": "",
      "identity": "public.guard_last_active_admin()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_last_active_admin()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nBEGIN\n IF old.role<>'admin' OR old.status<>'Active' THEN\n  IF tg_op='DELETE' THEN RETURN old; END IF;\n  RETURN new;\n END IF;\n IF tg_op='UPDATE' AND new.role='admin' AND new.status='Active' THEN RETURN new; END IF;\n PERFORM pg_advisory_xact_lock(404,1);\n IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>old.id AND role='admin' AND status='Active') THEN\n  RAISE EXCEPTION 'Keep at least one Active Admin. Activate another administrator before removing this account or changing its role/status.' USING errcode='23514';\n END IF;\n IF tg_op='DELETE' THEN RETURN old; END IF;\n RETURN new;\nEND $function$\n",
      "allowed": false,
      "source": "M14_last_admin_protection.sql"
    },
    {
      "name": "guard_logbook_version",
      "args": "",
      "identity": "public.guard_logbook_version()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_logbook_version()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nbegin\r\n if tg_op='DELETE' then raise exception 'Logbook history must be preserved'; end if;\r\n if old.status='Verified' and new is distinct from old then raise exception 'Verified logbook version is immutable'; end if;\r\n if old.status<>'Draft' and (to_jsonb(new)-array['status','revision','return_reason','returned_by','returned_at','verified_by','verified_at','request_id','recorded_sessions']) is distinct from\r\n (to_jsonb(old)-array['status','revision','return_reason','returned_by','returned_at','verified_by','verified_at','request_id','recorded_sessions']) then raise exception 'Submitted evidence and provenance are immutable'; end if;\r\n return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "guard_manual_attendance",
      "args": "",
      "identity": "public.guard_manual_attendance()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_manual_attendance()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nbegin\n if tg_op='DELETE' then if old.attendance_source='manual_company_sheet' then raise exception 'Manual attendance and evidence history must be preserved'; end if; return old; end if;\n if tg_op='UPDATE' and old.attendance_source='manual_company_sheet' then\n  if old.verified and new is distinct from old then raise exception 'Verified manual attendance is immutable'; end if;\n  if new.id<>old.id or new.intern_id<>old.intern_id or new.attendance_source<>old.attendance_source or new.encoded_by<>old.encoded_by or new.encoded_at<>old.encoded_at then raise exception 'Manual attendance identities and original encoding provenance are immutable'; end if;\n  if new.verified and not old.verified then\n   if (to_jsonb(new)-array['verified','verified_by','verified_at']) is distinct from (to_jsonb(old)-array['verified','verified_by','verified_at']) then raise exception 'Verification cannot alter encoded attendance'; end if;\n   new.verified_at:=clock_timestamp();\n  end if;\n end if;\n return new;\nend $function$\n",
      "allowed": false,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "guard_manual_history",
      "args": "",
      "identity": "public.guard_manual_history()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_manual_history()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ begin raise exception 'Manual attendance history is immutable'; end $function$\n",
      "allowed": false,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "guard_profile_update",
      "args": "",
      "identity": "public.guard_profile_update()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_profile_update()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nbegin\r\n  if new.id is distinct from old.id then raise exception 'Profile identity is immutable' using errcode='42501'; end if;\r\n  -- Trusted SQL operator is the explicitly documented first-Admin bootstrap;\r\n  -- authenticated/anon cannot SET ROLE postgres. Never use caller-set claims.\r\n  if current_user <> 'postgres' and not public.is_admin() and\r\n     (to_jsonb(new)-'full_name') is distinct from (to_jsonb(old)-'full_name') then\r\n    raise exception 'Only Active Admin may change protected profile fields' using errcode='42501';\r\n  end if;\r\n  return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M01_authority.sql"
    },
    {
      "name": "guard_supervision_relationships",
      "args": "",
      "identity": "public.guard_supervision_relationships()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.guard_supervision_relationships()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nbegin\r\n if exists(select 1 from public.supervisor_assignments a join public.profiles s on s.id=a.supervisor_id\r\n join public.interns i on i.id=a.intern_id join public.profiles p on p.id=i.id\r\n where a.ended_at is null and (s.role<>'supervisor' or s.status<>'Active' or p.role<>'intern' or p.status<>'Active'\r\n or s.supervisor_company_id is distinct from a.company_id or i.company_id is distinct from a.company_id))\r\n then raise exception 'End affected Supervisor assignments before changing role, status or company'; end if;\r\n if exists(select 1 from public.profiles where role='supervisor' and supervisor_company_id is null)\r\n then raise exception 'Supervisor company required'; end if;\r\n return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M15_supervisor_evaluations.sql"
    },
    {
      "name": "handle_new_user",
      "args": "",
      "identity": "public.handle_new_user()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.handle_new_user()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nbegin\r\n  insert into public.profiles(id,full_name,email,role,status,organization,student_id,requested_role)\r\n  values(new.id,coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),'New account'),\r\n    coalesce(new.email,''),'intern','Pending',new.raw_user_meta_data->>'organization',\r\n    new.raw_user_meta_data->>'student_id',\r\n    case when new.raw_user_meta_data->>'requested_role' in ('intern','instructor','admin')\r\n      then new.raw_user_meta_data->>'requested_role' else 'intern' end);\r\n  insert into public.interns(id) values(new.id);\r\n  return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M01_authority.sql"
    },
    {
      "name": "is_active",
      "args": "",
      "identity": "public.is_active()",
      "result": "boolean",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.is_active()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ select coalesce(exists(select 1 from public.profiles where id=auth.uid() and status='Active'),false) $function$\n",
      "allowed": true,
      "source": "M01_authority.sql"
    },
    {
      "name": "is_admin",
      "args": "",
      "identity": "public.is_admin()",
      "result": "boolean",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.is_admin()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ select coalesce(public.current_role()='admin',false) $function$\n",
      "allowed": true,
      "source": "M01_authority.sql"
    },
    {
      "name": "legacy_document_access",
      "args": "p_id uuid",
      "identity": "public.legacy_document_access(uuid)",
      "result": "jsonb",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.legacy_document_access(p_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nDECLARE d public.documents; old jsonb;\nBEGIN\n SELECT * INTO d FROM public.documents WHERE id=p_id;\n IF NOT FOUND OR NOT public.can_read_intern(d.intern_id) THEN RAISE EXCEPTION 'Legacy file access not permitted' USING errcode='42501'; END IF;\n old:=d.legacy_evidence;\n IF old IS NULL OR old->>'id' IS DISTINCT FROM d.id::text OR old->>'intern_id' IS DISTINCT FROM d.intern_id::text\n  OR old->>'upload_version' IS DISTINCT FROM '0' OR old->>'provenance' IS DISTINCT FROM 'stored-legacy-metadata-unverified'\n  OR split_part(old->>'file_path','/',1) IS DISTINCT FROM d.intern_id::text\n  OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='documents' AND name=old->>'file_path')\n THEN RAISE EXCEPTION 'Legacy file unavailable; original metadata retained without reconstructed evidence'; END IF;\n RETURN jsonb_build_object('id',d.id,'file_path',old->>'file_path','file_name',old->>'file_name');\nEND $function$\n",
      "allowed": true,
      "source": "M12_handover_workflows.sql"
    },
    {
      "name": "logbook_queue",
      "args": "p_after uuid, p_size integer",
      "identity": "public.logbook_queue(uuid,integer)",
      "result": "SETOF jsonb",
      "names": [
        "p_after",
        "p_size"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.logbook_queue(p_after uuid DEFAULT NULL::uuid, p_size integer DEFAULT 100)\n RETURNS SETOF jsonb\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select to_jsonb(s)||jsonb_build_object('current_coordinator_id',case when public.is_admin() then (select instructor_id from public.interns where id=s.intern_id) else null end,'current',to_jsonb(v),'history',\r\n (select coalesce(jsonb_agg(to_jsonb(h) order by h.version desc),'[]') from public.logbook_versions h where h.submission_id=s.id and (h.status<>'Draft' or public.is_admin() or s.supervisor_id=auth.uid())),\r\n 'files',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'file_name',e.file_name,'mime_type',e.mime_type,'byte_size',e.byte_size,'ready_at',e.ready_at,'committed_at',e.committed_at,'expires_at',e.expires_at,'abandoned_at',e.abandoned_at) order by e.created_at),'[]')\r\n from public.attendance_sheet_evidence e where e.logbook_submission_id=s.id and public.can_read_logbook_evidence(e.id)))\r\n from public.logbook_submissions s join public.logbook_versions v on v.submission_id=s.id and v.version=s.current_version\r\n where public.can_read_logbook(s.id) and (p_after is null or s.id>p_after)\r\n and (v.status<>'Draft' or public.is_admin() or s.supervisor_id=auth.uid())\r\n order by s.id limit greatest(1,least(coalesce(p_size,100),500))\r\n$function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "manual_attendance_details",
      "args": "p_intern uuid, p_evidence uuid, p_details jsonb",
      "identity": "public.manual_attendance_details(uuid,uuid,jsonb)",
      "result": "jsonb",
      "names": [
        "p_intern",
        "p_evidence",
        "p_details"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.manual_attendance_details(p_intern uuid, p_evidence uuid, p_details jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare e public.attendance_sheet_evidence; company_name text; key text;\r\nbegin\r\n if public.current_role() is distinct from 'instructor' or not public.assigned_intern(p_intern)\r\n or not exists(select 1 from public.profiles where id=p_intern and role='intern' and status='Active') then raise exception 'Assigned Active Intern and OJT Coordinator required' using errcode='42501'; end if;\r\n select * into e from public.attendance_sheet_evidence where id=p_evidence for update;\r\n if not found or not public.can_read_attendance_sheet(e.id) or not p_intern=any(e.participant_ids) or not public.manual_company_allowed(p_intern,e.company_id) then raise exception 'Authorized evidence for this Intern/company required' using errcode='42501'; end if;\r\n if e.logbook_submission_id is not null then raise exception 'Supervisor logbooks require Verify & Record Attendance for the whole submitted version'; end if;\r\n if e.ready_at is null or e.abandoned_at is not null or (e.committed_at is null and e.expires_at<=clock_timestamp())\r\n or not exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path and metadata->>'mimetype'=e.mime_type and (metadata->>'size')::numeric=e.byte_size) then raise exception 'Successfully uploaded, validated signed evidence required'; end if;\r\n if jsonb_typeof(p_details) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_details))<>6 or p_details->'signatures_reviewed' is distinct from 'true'::jsonb then raise exception 'Confirm review of Intern and Supervisor signatures'; end if;\r\n foreach key in array array['company_on_sheet','supervisor_on_sheet','fallback_reason','reason_explanation','remarks'] loop\r\n  if jsonb_typeof(p_details->key) is distinct from 'string' then raise exception 'Complete printed company, Supervisor and fallback information'; end if;\r\n end loop;\r\n if length(btrim(p_details->>'company_on_sheet')) not between 1 and 200 or length(btrim(p_details->>'supervisor_on_sheet')) not between 1 and 200\r\n or p_details->>'fallback_reason' not in ('no_connectivity','system_unavailable','other') or length(p_details->>'remarks')>500\r\n or length(p_details->>'reason_explanation')>500 or (p_details->>'fallback_reason'='other' and (length(btrim(p_details->>'reason_explanation'))<10 or p_details->>'reason_explanation'!~'[[:alpha:]]'))\r\n or (p_details->>'fallback_reason'<>'other' and p_details->>'reason_explanation'<>'') then raise exception 'Valid company/Supervisor information required; Other needs a meaningful 10-500 character explanation'; end if;\r\n select name into company_name from public.companies where id=e.company_id;\r\n return p_details||jsonb_build_object('company_id',e.company_id,'registered_company_name',company_name);\r\nend $function$\n",
      "allowed": false,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "manual_company_allowed",
      "args": "p_intern uuid, p_company uuid",
      "identity": "public.manual_company_allowed(uuid,uuid)",
      "result": "boolean",
      "names": [
        "p_intern",
        "p_company"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.manual_company_allowed(p_intern uuid, p_company uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\n select exists(select 1 from public.interns where id=p_intern and company_id=p_company)\n or exists(select 1 from public.supervisor_assignments where intern_id=p_intern and company_id=p_company)\n or exists(select 1 from public.audit_logs where source='database-trigger-v2' and event_data->>'table'='interns'\n and event_data->>'record_id'=p_intern::text and (event_data->>'company_id'=p_company::text or event_data->>'previous_company_id'=p_company::text))\n$function$\n",
      "allowed": false,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "my_profile",
      "args": "",
      "identity": "public.my_profile()",
      "result": "jsonb",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.my_profile()\n RETURNS jsonb\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ select case when p.status='Active' then to_jsonb(p)\r\n     else jsonb_build_object('id',p.id,'status',p.status) end\r\n     from public.profiles p where p.id=auth.uid() $function$\n",
      "allowed": true,
      "source": "M01_authority.sql"
    },
    {
      "name": "normalize_evaluation_choices",
      "args": "p_choices jsonb",
      "identity": "public.normalize_evaluation_choices(jsonb)",
      "result": "jsonb",
      "names": [
        "p_choices"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.normalize_evaluation_choices(p_choices jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n IMMUTABLE\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare c jsonb:=public.evaluation_feedback_catalog(); result jsonb:='{}'; g text; ids jsonb; pair jsonb; chosen text[]:='{}';\r\nbegin\r\n if jsonb_typeof(p_choices) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_choices))<>4 then raise exception 'Select valid feedback groups'; end if;\r\n foreach g in array array['strengths','improvements','guidance','overall'] loop\r\n  ids:=p_choices->g;\r\n  if jsonb_typeof(ids) is distinct from 'array' then raise exception 'Feedback group must be an array'; end if;\r\n  if exists(select 1 from jsonb_array_elements(ids) x where jsonb_typeof(x)<>'string')\r\n   or (select count(distinct x) from jsonb_array_elements_text(ids) x)<>jsonb_array_length(ids)\r\n   or exists(select 1 from jsonb_array_elements_text(ids) x where not exists(select 1 from jsonb_array_elements(c->'groups'->g) o where o->>'id'=x))\r\n  then raise exception 'Unknown or duplicate feedback option'; end if;\r\n  if (g='overall' and jsonb_array_length(ids)>1) or (ids?'none' and jsonb_array_length(ids)>1) then raise exception 'Choose compatible feedback options'; end if;\r\n  result:=result||jsonb_build_object(g,(select coalesce(jsonb_agg(o->'id' order by n),'[]'::jsonb) from jsonb_array_elements(c->'groups'->g) with ordinality items(o,n) where ids?(o->>'id')));\r\n  chosen:=chosen||array(select g||':'||x from jsonb_array_elements_text(ids) x);\r\n end loop;\r\n for pair in select * from jsonb_array_elements(c->'conflicts') loop\r\n  if (pair->>0)=any(chosen) and (pair->>1)=any(chosen) then raise exception 'Feedback choices contradict each other'; end if;\r\n end loop;\r\n return result;\r\nend $function$\n",
      "allowed": false,
      "source": "M16_evaluation_controls.sql"
    },
    {
      "name": "owns_intern",
      "args": "p_id uuid",
      "identity": "public.owns_intern(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.owns_intern(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ select coalesce(public.current_role()='intern' and p_id=auth.uid()\r\n     and exists(select 1 from public.interns where id=p_id),false) $function$\n",
      "allowed": true,
      "source": "M01_authority.sql"
    },
    {
      "name": "record_manual_attendance",
      "args": "p_id uuid, p_intern uuid, p_in timestamp with time zone, p_out timestamp with time zone, p_evidence uuid, p_details jsonb",
      "identity": "public.record_manual_attendance(uuid,uuid,timestamp with time zone,timestamp with time zone,uuid,jsonb)",
      "result": "public.attendance_logs",
      "names": [
        "p_id",
        "p_intern",
        "p_in",
        "p_out",
        "p_evidence",
        "p_details"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.record_manual_attendance(p_id uuid, p_intern uuid, p_in timestamp with time zone, p_out timestamp with time zone, p_evidence uuid, p_details jsonb)\n RETURNS public.attendance_logs\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare r public.attendance_logs; details jsonb;\nbegin\n perform pg_advisory_xact_lock(404,1);\n perform pg_advisory_xact_lock(hashtextextended(p_intern::text,101));\n perform 1 from public.interns where id=p_intern for share;\n perform 1 from public.profiles where id in (auth.uid(),p_intern) for share;\n details:=public.manual_attendance_details(p_intern,p_evidence,p_details);\n if p_id is null then raise exception 'Attendance retry identity required'; end if;\n select * into r from public.attendance_logs where id=p_id for update;\n if found then\n  if r.attendance_source='manual_company_sheet' and r.encoded_by=auth.uid() and r.intern_id=p_intern and r.clocked_in_at=p_in and r.clocked_out_at=p_out and r.manual_evidence_id=p_evidence and (r.manual_details-'registered_company_name')=(details-'registered_company_name') then return r; end if;\n  raise exception 'Attendance identity already used or revised; refresh';\n end if;\n perform public.check_manual_session(p_intern,p_in,p_out,null);\n insert into public.attendance_logs(id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,attendance_source,manual_evidence_id,manual_details,manual_revision,encoded_by,encoded_at)\n values(p_id,p_intern,(p_in at time zone 'Asia/Manila')::date,(p_in at time zone 'Asia/Manila')::time,(p_out at time zone 'Asia/Manila')::time,p_in,p_out,extract(epoch from p_out-p_in)/3600,false,'manual_company_sheet',p_evidence,details,1,auth.uid(),clock_timestamp()) returning * into r;\n update public.attendance_sheet_evidence set committed_at=coalesce(committed_at,clock_timestamp()) where id=p_evidence;\n return r;\nend $function$\n",
      "allowed": false,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "related_profile_names",
      "args": "p_ids uuid[]",
      "identity": "public.related_profile_names(uuid[])",
      "result": "TABLE(id uuid, full_name text)",
      "names": [
        "p_ids",
        "id",
        "full_name"
      ],
      "modes": [
        "i",
        "t",
        "t"
      ],
      "def": "CREATE OR REPLACE FUNCTION public.related_profile_names(p_ids uuid[])\n RETURNS TABLE(id uuid, full_name text)\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$ select p.id,p.full_name from public.profiles p\r\n     where public.is_active() and p.id=any(p_ids) and (\r\n       p.id=auth.uid() or public.is_admin() or public.assigned_intern(p.id)\r\n       or (public.current_role()='intern' and (\r\n         exists(select 1 from public.interns i where i.id=auth.uid() and i.instructor_id=p.id and p.role='instructor')\r\n         or exists(select 1 from public.evaluations e where e.intern_id=auth.uid() and e.evaluator_id=p.id and p.role in ('admin','instructor'))))) $function$\n",
      "allowed": true,
      "source": "M01_authority.sql"
    },
    {
      "name": "return_logbook",
      "args": "p_id uuid, p_version integer, p_revision integer, p_reason text",
      "identity": "public.return_logbook(uuid,integer,integer,text)",
      "result": "public.logbook_versions",
      "names": [
        "p_id",
        "p_version",
        "p_revision",
        "p_reason"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.return_logbook(p_id uuid, p_version integer, p_revision integer, p_reason text)\n RETURNS public.logbook_versions\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare v public.logbook_versions; oldv jsonb;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if public.can_review_logbook(p_id) is not true then raise exception 'Assigned receiving Coordinator required' using errcode='42501'; end if;\r\n select v0.* into v from public.logbook_versions v0 join public.logbook_submissions s on s.id=v0.submission_id and s.current_version=v0.version where s.id=p_id for update of v0;\r\n if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 or btrim(p_reason)!~'[[:alpha:]]' then raise exception 'Explain the missing signatures, unreadable evidence, wrong dates or other correction (10–1000 characters)'; end if;\r\n if v.version=p_version and v.status='Returned for Correction' and v.returned_by=auth.uid() and v.return_reason=btrim(p_reason) and v.revision=p_revision+1 then return v; end if;\r\n if v.status<>'Pending Review' or v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Review changed; refresh' using errcode='40001'; end if;\r\n oldv:=to_jsonb(v);\r\n update public.logbook_versions set status='Returned for Correction',return_reason=btrim(p_reason),returned_by=auth.uid(),returned_at=clock_timestamp(),revision=revision+1 where submission_id=p_id and version=p_version returning * into v;\r\n insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'returned',oldv,to_jsonb(v));\r\n return v;\r\nend $function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "review_document",
      "args": "p_id uuid, p_status text, p_note text, p_expected_path text",
      "identity": "public.review_document(uuid,text,text,text)",
      "result": "public.documents",
      "names": [
        "p_id",
        "p_status",
        "p_note",
        "p_expected_path"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.review_document(p_id uuid, p_status text, p_note text, p_expected_path text)\n RETURNS public.documents\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.documents;\r\nbegin\r\n  select * into r from public.documents where id=p_id for update;\r\n  if not found or not public.can_review(r.intern_id) then raise exception 'Review not permitted' using errcode='42501'; end if;\r\n  if p_status is null or p_status not in ('Pending','Approved','Needs Revision') then raise exception 'Invalid review status'; end if;\r\n  if r.file_path is distinct from p_expected_path then raise exception 'Evidence changed; refresh' using errcode='40001'; end if;\r\n  if p_status='Approved' and (r.file_path is null or split_part(r.file_path,'/',1)<>r.intern_id::text\r\n     or not exists(select 1 from storage.objects where bucket_id='documents' and name=r.file_path)) then\r\n    raise exception 'Valid uploaded evidence required';\r\n  end if;\r\n  if p_status='Needs Revision' and nullif(btrim(p_note),'') is null then raise exception 'Revision note required'; end if;\r\n  if length(p_note)>500 then raise exception 'Note exceeds 500 characters'; end if;\r\n  update public.documents set status=p_status,note=case when p_status='Needs Revision' then btrim(p_note) else null end,\r\n    reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),updated_at=clock_timestamp()\r\n    where id=r.id returning * into r;\r\n  return r;\r\nend $function$\n",
      "allowed": false,
      "source": "M01_authority.sql"
    },
    {
      "name": "review_document_version",
      "args": "p_id uuid, p_status text, p_note text, p_expected_version bigint, p_expected_revision bigint",
      "identity": "public.review_document_version(uuid,text,text,bigint,bigint)",
      "result": "public.documents",
      "names": [
        "p_id",
        "p_status",
        "p_note",
        "p_expected_version",
        "p_expected_revision"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.review_document_version(p_id uuid, p_status text, p_note text, p_expected_version bigint, p_expected_revision bigint)\n RETURNS public.documents\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare d public.documents; v public.document_versions; ts timestamptz;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n ts:=clock_timestamp();\r\n select * into d from public.documents where id=p_id for update;\r\n if not found or not public.can_review(d.intern_id) then raise exception 'Review not permitted' using errcode='42501'; end if;\r\n if d.upload_version is distinct from p_expected_version or d.review_revision is distinct from p_expected_revision\r\n then raise exception 'Evidence or review changed; refresh' using errcode='40001'; end if;\r\n if p_status is null or not ((d.status='Pending' and p_status in ('Approved','Needs Revision')) or (d.status='Approved' and p_status='Pending'))\r\n then raise exception 'Invalid review transition; refresh'; end if;\r\n if length(p_note)>500 or (p_status='Needs Revision' and nullif(btrim(p_note),'') is null) then raise exception 'Revision note required; maximum 500 characters'; end if;\r\n select * into v from public.document_versions where document_id=d.id and version_no=d.upload_version and committed_at is not null;\r\n if not found or v.file_path<>d.file_path or not exists(select 1 from storage.objects where bucket_id='documents' and name=v.file_path\r\n   and metadata->>'mimetype'=v.mime_type and (metadata->>'size')::numeric=v.byte_size)\r\n then raise exception 'Current version evidence missing; resubmit before review'; end if;\r\n update public.documents set status=p_status,note=nullif(btrim(p_note),''),reviewed_by=auth.uid(),reviewed_at=ts,\r\n   review_revision=review_revision+1,updated_at=ts where id=d.id returning * into d;\r\n update public.document_versions set status=p_status,note=d.note,reviewed_by=auth.uid(),reviewed_at=ts where id=v.id;\r\n insert into public.document_review_events(document_id,version_id,intern_id,review_revision,status,note,reviewed_by,reviewed_at)\r\n values(d.id,v.id,d.intern_id,d.review_revision,p_status,d.note,auth.uid(),ts);\r\n return d;\r\nend $function$\n",
      "allowed": true,
      "source": "M08_document_versions.sql"
    },
    {
      "name": "review_exception",
      "args": "p_id uuid, p_decision text, p_note text",
      "identity": "public.review_exception(uuid,text,text)",
      "result": "public.attendance_exceptions",
      "names": [
        "p_id",
        "p_decision",
        "p_note"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.review_exception(p_id uuid, p_decision text, p_note text DEFAULT NULL::text)\n RETURNS public.attendance_exceptions\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.attendance_exceptions; a public.attendance_logs;\r\n        start_ts timestamptz; end_ts timestamptz; n integer;\r\nbegin\r\n  select * into r from public.attendance_exceptions where id=p_id;\r\n  if not found or not public.can_review(r.intern_id) then raise exception 'Review not permitted' using errcode='42501'; end if;\r\n  if p_decision is null or p_decision not in ('Approved','Rejected') then raise exception 'Invalid decision'; end if;\r\n  if length(p_note)>500 or (p_decision='Rejected' and nullif(btrim(p_note),'') is null) then\r\n    raise exception 'Rejection note required; notes must be at most 500 characters';\r\n  end if;\r\n  perform pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));\r\n  -- Freeze caller status and assignment for this review; concurrent lifecycle\r\n  -- writes wait or cause a transactional conflict, never grant stale authority.\r\n  perform 1 from public.profiles where id=auth.uid() for share;\r\n  perform 1 from public.interns where id=r.intern_id for share;\r\n  select * into r from public.attendance_exceptions where id=p_id for update;\r\n  if not found or not public.can_review(r.intern_id) then raise exception 'Assignment changed' using errcode='42501'; end if;\r\n  if r.status<>'Pending' then raise exception 'Correction already reviewed; refresh' using errcode='40001'; end if;\r\n  if p_decision='Approved' then\r\n    -- Legacy NULL end date is same-day only; reversed times are never guessed.\r\n    select start_at,end_at into start_ts,end_ts from public.correction_instants(\r\n      r.log_date,r.claimed_time_in,r.claimed_time_out,coalesce(r.claimed_end_date,r.log_date));\r\n    select count(*) into n from public.attendance_logs where intern_id=r.intern_id and log_date=r.log_date;\r\n    if n>1 then raise exception 'Duplicate legacy attendance requires review' using errcode='40001'; end if;\r\n    select * into a from public.attendance_logs where intern_id=r.intern_id and log_date=r.log_date for update;\r\n    if found then\r\n      update public.attendance_logs set time_in=r.claimed_time_in,time_out=r.claimed_time_out,\r\n        clocked_in_at=start_ts,clocked_out_at=end_ts,hours=extract(epoch from end_ts-start_ts)/3600,\r\n        verified=true,verified_by=auth.uid() where id=a.id;\r\n    else\r\n      insert into public.attendance_logs(intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,verified_by)\r\n      values(r.intern_id,r.log_date,r.claimed_time_in,r.claimed_time_out,start_ts,end_ts,\r\n        extract(epoch from end_ts-start_ts)/3600,true,auth.uid());\r\n    end if;\r\n  end if;\r\n  update public.attendance_exceptions set status=p_decision,review_note=nullif(btrim(p_note),''),\r\n    reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=r.id and status='Pending' returning * into r;\r\n  if not found then raise exception 'Correction changed; refresh' using errcode='40001'; end if;\r\n  return r;\r\nend $function$\n",
      "allowed": false,
      "source": "M02_trusted_audit.sql"
    },
    {
      "name": "review_exceptions",
      "args": "p_ids uuid[], p_decision text, p_note text",
      "identity": "public.review_exceptions(uuid[],text,text)",
      "result": "TABLE(id uuid, ok boolean, error text, code text, data jsonb)",
      "names": [
        "p_ids",
        "p_decision",
        "p_note",
        "id",
        "ok",
        "error",
        "code",
        "data"
      ],
      "modes": [
        "i",
        "i",
        "i",
        "t",
        "t",
        "t",
        "t",
        "t"
      ],
      "def": "CREATE OR REPLACE FUNCTION public.review_exceptions(p_ids uuid[], p_decision text, p_note text DEFAULT NULL::text)\n RETURNS TABLE(id uuid, ok boolean, error text, code text, data jsonb)\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare item uuid; r public.attendance_exceptions;\r\nbegin\r\n  if public.current_role() is null or public.current_role() not in ('admin','instructor') then\r\n    raise exception 'Active staff required' using errcode='42501';\r\n  end if;\r\n  if p_ids is null or cardinality(p_ids)<1 or cardinality(p_ids)>100 or array_position(p_ids,null) is not null then\r\n    raise exception 'Select between 1 and 100 correction UUIDs';\r\n  end if;\r\n  -- Intern-first ordering also prevents inverse lock order for different\r\n  -- requests belonging to the same two interns.\r\n  for item in select x.item_id from (select distinct unnest(p_ids) as item_id) x\r\n    left join public.attendance_exceptions e on e.id=x.item_id and public.can_review(e.intern_id)\r\n    order by e.intern_id,x.item_id loop\r\n    id:=item; data:=null; error:=null; code:=null;\r\n    begin\r\n      r:=public.review_exception(item,p_decision,p_note);\r\n      ok:=true; data:=to_jsonb(r);\r\n    exception when others then\r\n      ok:=false; error:=sqlerrm; code:=sqlstate;\r\n    end;\r\n    return next;\r\n  end loop;\r\nend $function$\n",
      "allowed": false,
      "source": "M02_trusted_audit.sql"
    },
    {
      "name": "review_submission",
      "args": "p_id uuid, p_version bigint, p_revision bigint, p_status text, p_note text",
      "identity": "public.review_submission(uuid,bigint,bigint,text,text)",
      "result": "public.submissions",
      "names": [
        "p_id",
        "p_version",
        "p_revision",
        "p_status",
        "p_note"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.review_submission(p_id uuid, p_version bigint, p_revision bigint, p_status text, p_note text)\n RETURNS public.submissions\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare s public.submissions; v public.submission_versions; ts timestamptz;\nbegin\n perform pg_advisory_xact_lock(404,1);\n select * into s from public.submissions where id=p_id for update;\n if not found or not public.can_review(s.intern_id) then raise exception 'Assigned staff required' using errcode='42501'; end if;\n if s.current_version is distinct from p_version or s.review_revision is distinct from p_revision\n then raise exception 'File set or review changed; refresh' using errcode='40001'; end if;\n if s.status<>'Pending' or p_status is null or p_status not in ('Approved','Needs Revision') then raise exception 'Pending current version required'; end if;\n if length(p_note)>500 or (p_status='Needs Revision' and nullif(btrim(p_note),'') is null)\n then raise exception 'Revision explanation required; maximum 500 characters'; end if;\n select * into v from public.submission_versions where submission_id=s.id and version_no=s.current_version and committed_at is not null;\n if not found or (select count(*) from public.submission_files where version_id=v.id)<>jsonb_array_length(v.manifest)\n  or exists(select 1 from public.submission_files f where version_id=v.id and not exists(select 1 from storage.objects o\n    where o.bucket_id='documents' and o.name=f.file_path and o.metadata->>'mimetype'=f.mime_type and (o.metadata->>'size')::numeric=f.byte_size))\n then raise exception 'Complete committed file evidence required'; end if;\n ts:=clock_timestamp();\n update public.submissions set status=p_status,note=nullif(btrim(p_note),''),reviewed_by=auth.uid(),reviewed_at=ts,\n  review_revision=review_revision+1,updated_at=ts where id=s.id returning * into s;\n update public.submission_versions set status=s.status,note=s.note,reviewed_by=s.reviewed_by,reviewed_at=ts,review_revision=s.review_revision where id=v.id;\n insert into public.submission_reviews(version_id,intern_id,review_revision,status,note,reviewed_by,reviewed_at)\n  values(v.id,s.intern_id,s.review_revision,s.status,s.note,auth.uid(),ts);\n return s;\nend $function$\n",
      "allowed": true,
      "source": "M10_flexible_submissions.sql"
    },
    {
      "name": "revise_manual_attendance",
      "args": "p_id uuid, p_revision integer, p_in timestamp with time zone, p_out timestamp with time zone, p_evidence uuid, p_details jsonb, p_reason text",
      "identity": "public.revise_manual_attendance(uuid,integer,timestamp with time zone,timestamp with time zone,uuid,jsonb,text)",
      "result": "public.attendance_logs",
      "names": [
        "p_id",
        "p_revision",
        "p_in",
        "p_out",
        "p_evidence",
        "p_details",
        "p_reason"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.revise_manual_attendance(p_id uuid, p_revision integer, p_in timestamp with time zone, p_out timestamp with time zone, p_evidence uuid, p_details jsonb, p_reason text)\n RETURNS public.attendance_logs\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare r public.attendance_logs; details jsonb;\nbegin\n perform pg_advisory_xact_lock(404,1);\n select * into r from public.attendance_logs where id=p_id;\n if not found or not public.assigned_intern(r.intern_id) or public.current_role() is distinct from 'instructor' then raise exception 'Assigned OJT Coordinator required' using errcode='42501'; end if;\n perform pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));\n perform 1 from public.interns where id=r.intern_id for share;\n select * into r from public.attendance_logs where id=p_id for update;\n details:=public.manual_attendance_details(r.intern_id,p_evidence,p_details);\n if details->'company_id'=r.manual_details->'company_id' then\n  details:=details||jsonb_build_object('registered_company_name',r.manual_details->>'registered_company_name');\n end if;\n if r.attendance_source<>'manual_company_sheet' or r.verified then raise exception 'Only unverified manual attendance may be revised'; end if;\n if p_reason is null or length(btrim(p_reason)) not between 10 and 500 or p_reason!~'[[:alpha:]]' then raise exception 'Meaningful 10-500 character revision reason required'; end if;\n if r.manual_revision=p_revision+1 and r.clocked_in_at=p_in and r.clocked_out_at=p_out and r.manual_evidence_id=p_evidence and r.manual_details=details and r.revision_reason=p_reason and r.revised_by=auth.uid() then return r; end if;\n if r.manual_revision is distinct from p_revision then raise exception 'Attendance revision changed; refresh' using errcode='40001'; end if;\n perform public.check_manual_session(r.intern_id,p_in,p_out,r.id);\n update public.attendance_logs set log_date=(p_in at time zone 'Asia/Manila')::date,time_in=(p_in at time zone 'Asia/Manila')::time,time_out=(p_out at time zone 'Asia/Manila')::time,\n clocked_in_at=p_in,clocked_out_at=p_out,hours=extract(epoch from p_out-p_in)/3600,manual_evidence_id=p_evidence,manual_details=details,\n manual_revision=manual_revision+1,revised_by=auth.uid(),revised_at=clock_timestamp(),revision_reason=p_reason where id=p_id returning * into r;\n update public.attendance_sheet_evidence set committed_at=coalesce(committed_at,clock_timestamp()) where id=p_evidence;\n return r;\nend $function$\n",
      "allowed": true,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "rubric_score",
      "args": "p_criteria jsonb",
      "identity": "public.rubric_score(jsonb)",
      "result": "integer",
      "names": [
        "p_criteria"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.rubric_score(p_criteria jsonb)\n RETURNS integer\n LANGUAGE plpgsql\n IMMUTABLE\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare k text; n numeric; total numeric:=0;\r\nbegin\r\n if jsonb_typeof(p_criteria) is distinct from 'object' then return null; end if;\r\n if (select count(*) from jsonb_object_keys(p_criteria))<>4 then return null; end if;\r\n foreach k in array array['punctuality','performance','conduct','communication'] loop\r\n   if jsonb_typeof(p_criteria->k) is distinct from 'number' then return null; end if;\r\n   n:=(p_criteria->>k)::numeric;\r\n   if n<1 or n>5 or n<>trunc(n) then return null; end if;\r\n   total:=total+n*case k when 'punctuality' then 25 when 'performance' then 35 else 20 end/5;\r\n end loop;\r\n return round(total)::integer;\r\nend $function$\n",
      "allowed": true,
      "source": "M06_rubric_hours.sql"
    },
    {
      "name": "save_evaluation_review",
      "args": "p_id uuid, p_expected_revision integer, p_summary text, p_strengths text, p_improvements text, p_guidance text, p_criteria jsonb, p_reason text, p_publish boolean",
      "identity": "public.save_evaluation_review(uuid,integer,text,text,text,text,jsonb,text,boolean)",
      "result": "public.evaluation_reviews",
      "names": [
        "p_id",
        "p_expected_revision",
        "p_summary",
        "p_strengths",
        "p_improvements",
        "p_guidance",
        "p_criteria",
        "p_reason",
        "p_publish"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.save_evaluation_review(p_id uuid, p_expected_revision integer, p_summary text, p_strengths text, p_improvements text, p_guidance text, p_criteria jsonb, p_reason text, p_publish boolean DEFAULT false)\n RETURNS public.evaluation_reviews\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.evaluation_reviews; s public.supervisor_evaluations; final public.evaluations; score integer; reason_text text; fields jsonb; criterion text; option jsonb;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n select * into r from public.evaluation_reviews where id=p_id for update;\r\n if not found or public.current_role() is distinct from 'instructor' or r.coordinator_id<>auth.uid() or not public.can_review_source(p_id)\r\n then raise exception 'Routed evaluation for current assigned Intern required' using errcode='42501'; end if;\r\n select * into s from public.supervisor_evaluations where id=p_id;\r\n if r.status='Published to Intern' then\r\n  if p_publish and r.summary=p_summary and r.strengths=p_strengths and r.improvements=p_improvements and r.guidance=p_guidance and r.criteria=p_criteria and r.adjustment_reason=p_reason then return r; end if;\r\n  raise exception 'Published evaluation is immutable';\r\n end if;\r\n if r.revision is distinct from p_expected_revision then raise exception 'Review changed; refresh' using errcode='40001'; end if;\r\n score:=public.rubric_score(p_criteria);\r\n if score is null or p_publish is null or p_summary is null or p_strengths is null or p_improvements is null or p_guidance is null or p_reason is null then raise exception 'Complete valid ratings and review fields'; end if;\r\n reason_text:=public.evaluation_adjustment_text(s.criteria,p_criteria,r.adjustment_reasons);\r\n if p_criteria<>s.criteria and p_reason is distinct from reason_text then raise exception 'Use a valid per-criterion adjustment reason; upgrade the evaluation client'; end if;\r\n fields:=jsonb_build_object('summary',p_summary,'strengths',p_strengths,'improvements',p_improvements,'guidance',p_guidance);\r\n if r.feedback_mode='selected' then\r\n  if fields is distinct from public.evaluation_feedback_text(r.feedback_choices,r.additional_remarks) then\r\n   update public.evaluation_reviews set feedback_mode='written',written_feedback=fields where id=p_id;\r\n  end if;\r\n end if;\r\n if p_publish and p_summary!~'[^[:space:]]' then raise exception 'Student-facing summary required to publish'; end if;\r\n update public.evaluation_reviews set summary=p_summary,strengths=p_strengths,improvements=p_improvements,guidance=p_guidance,\r\n criteria=p_criteria,adjustment_reason=p_reason,revision=revision+1,status='Coordinator Draft' where id=p_id returning * into r;\r\n if p_publish then\r\n  insert into public.evaluations(intern_id,evaluator_id,competencies,overall_score,feedback,source_evaluation_id,source_version,provenance,strengths,improvements,guidance,evaluation_date,submission_id)\r\n  values(s.intern_id,auth.uid(),r.criteria,score,r.summary,s.id,s.version,'supervisor_review',r.strengths,r.improvements,r.guidance,s.evaluation_date,s.id) returning * into final;\r\n  update public.evaluation_reviews set status='Published to Intern',final_evaluation_id=final.id where id=p_id returning * into r;\r\n end if;\r\n foreach criterion in array array['punctuality','performance','conduct','communication'] loop\r\n  if s.criteria->criterion=p_criteria->criterion then continue; end if;\r\n  select o into option from jsonb_array_elements(public.evaluation_feedback_catalog()->'adjustments'->criterion) o where o->>'id'=r.adjustment_reasons->criterion->>'code';\r\n  insert into public.evaluation_adjustment_events(source_id,source_version,review_revision,criterion,original_rating,final_rating,reason_code,reason_text,coordinator_id)\r\n  values(s.id,s.version,r.revision,criterion,(s.criteria->>criterion)::integer,(p_criteria->>criterion)::integer,r.adjustment_reasons->criterion->>'code',case when option->>'id'='other' then regexp_replace(r.adjustment_reasons->criterion->>'explanation','^\\s+|\\s+$','','g') else option->>'text' end,auth.uid());\r\n end loop;\r\n return r;\r\nend $function$\n",
      "allowed": true,
      "source": "M16_evaluation_controls.sql"
    },
    {
      "name": "save_evaluation_review_v2",
      "args": "p_id uuid, p_expected_revision integer, p_mode text, p_choices jsonb, p_remarks text, p_written jsonb, p_criteria jsonb, p_adjustments jsonb, p_expected_feedback jsonb, p_publish boolean",
      "identity": "public.save_evaluation_review_v2(uuid,integer,text,jsonb,text,jsonb,jsonb,jsonb,jsonb,boolean)",
      "result": "public.evaluation_reviews",
      "names": [
        "p_id",
        "p_expected_revision",
        "p_mode",
        "p_choices",
        "p_remarks",
        "p_written",
        "p_criteria",
        "p_adjustments",
        "p_expected_feedback",
        "p_publish"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.save_evaluation_review_v2(p_id uuid, p_expected_revision integer, p_mode text, p_choices jsonb, p_remarks text, p_written jsonb, p_criteria jsonb, p_adjustments jsonb, p_expected_feedback jsonb, p_publish boolean)\n RETURNS public.evaluation_reviews\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.evaluation_reviews; s public.supervisor_evaluations; fields jsonb; choices jsonb; reason text; previous_written jsonb; criterion text; option jsonb;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n select * into r from public.evaluation_reviews where id=p_id for update;\r\n if not found or public.current_role() is distinct from 'instructor' or r.coordinator_id<>auth.uid() or not public.can_review_source(p_id)\r\n then raise exception 'Routed evaluation for current assigned Intern required' using errcode='42501'; end if;\r\n select * into s from public.supervisor_evaluations where id=p_id;\r\n if p_mode is null or p_mode not in ('selected','written') or p_publish is null then raise exception 'Select a feedback mode'; end if;\r\n choices:=public.normalize_evaluation_choices(p_choices);\r\n reason:=public.evaluation_adjustment_text(s.criteria,p_criteria,p_adjustments);\r\n if p_remarks is null or length(p_remarks)>1000 then raise exception 'Additional remarks must be at most 1000 characters'; end if;\r\n if p_mode='selected' then\r\n  if p_publish and jsonb_array_length(choices->'overall')<>1 then raise exception 'Select overall feedback before publication'; end if;\r\n  fields:=public.evaluation_feedback_text(choices,p_remarks);\r\n else\r\n  if jsonb_typeof(p_written) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_written))<>4 then raise exception 'Written feedback fields required'; end if;\r\n  foreach criterion in array array['summary','strengths','improvements','guidance'] loop\r\n   if jsonb_typeof(p_written->criterion) is distinct from 'string' then raise exception 'Written feedback fields required'; end if;\r\n  end loop;\r\n  fields:=p_written;\r\n end if;\r\n if fields is distinct from p_expected_feedback then raise exception 'Feedback preview changed; refresh before publishing' using errcode='40001'; end if;\r\n if r.status='Published to Intern' then\r\n  if p_publish and r.feedback_mode=p_mode and r.feedback_choices=choices and r.additional_remarks=p_remarks and r.adjustment_reasons=p_adjustments\r\n   and r.criteria=p_criteria and jsonb_build_object('summary',r.summary,'strengths',r.strengths,'improvements',r.improvements,'guidance',r.guidance)=fields then return r; end if;\r\n  raise exception 'Published evaluation is immutable';\r\n end if;\r\n if r.revision is distinct from p_expected_revision then raise exception 'Review changed; refresh' using errcode='40001'; end if;\r\n previous_written:=r.written_feedback;\r\n if p_mode='written' then previous_written:=fields;\r\n elsif previous_written is null and coalesce(r.feedback_mode,'written')='written' and (r.summary<>'' or r.strengths<>'' or r.improvements<>'' or r.guidance<>'') then\r\n  previous_written:=jsonb_build_object('summary',r.summary,'strengths',r.strengths,'improvements',r.improvements,'guidance',r.guidance);\r\n end if;\r\n update public.evaluation_reviews set feedback_mode=p_mode,feedback_choices=choices,additional_remarks=p_remarks,written_feedback=previous_written,\r\n  legacy_adjustment_reason=coalesce(legacy_adjustment_reason,case when adjustment_reasons='{}'::jsonb and adjustment_reason<>'' then adjustment_reason end),adjustment_reasons=p_adjustments where id=p_id;\r\n r:=public.save_evaluation_review(p_id,p_expected_revision,fields->>'summary',fields->>'strengths',fields->>'improvements',fields->>'guidance',p_criteria,reason,p_publish);\r\n return r;\r\nend $function$\n",
      "allowed": true,
      "source": "M16_evaluation_controls.sql"
    },
    {
      "name": "save_logbook_draft",
      "args": "p_id uuid, p_intern uuid, p_start date, p_end date, p_remarks text, p_evidence uuid[], p_version integer, p_revision integer",
      "identity": "public.save_logbook_draft(uuid,uuid,date,date,text,uuid[],integer,integer)",
      "result": "public.logbook_versions",
      "names": [
        "p_id",
        "p_intern",
        "p_start",
        "p_end",
        "p_remarks",
        "p_evidence",
        "p_version",
        "p_revision"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.save_logbook_draft(p_id uuid, p_intern uuid, p_start date, p_end date, p_remarks text, p_evidence uuid[], p_version integer, p_revision integer)\n RETURNS public.logbook_versions\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare s public.logbook_submissions; v public.logbook_versions; previous jsonb; a public.supervisor_assignments; eid uuid;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if not public.supervises_intern(p_intern) then raise exception 'Active Supervisor and explicitly assigned Intern required' using errcode='42501'; end if;\r\n if p_id is null or p_version is null or p_revision is null or p_version<1 or p_revision<0 or p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<p_start or p_end>(clock_timestamp() at time zone 'Asia/Manila')::date or p_remarks is null or length(p_remarks)>1000\r\n or p_evidence is null or cardinality(p_evidence)>10 or cardinality(p_evidence)<>(select count(distinct x) from unnest(p_evidence) x) then raise exception 'Valid past covered dates, remarks and at most 10 evidence pages required'; end if;\r\n select * into s from public.logbook_submissions where id=p_id for update;\r\n select * into a from public.supervisor_assignments where supervisor_id=auth.uid() and intern_id=p_intern and ended_at is null;\r\n if s.id is null then\r\n  if p_version is distinct from 1 or p_revision is distinct from 0 then raise exception 'Start a new draft' using errcode='40001'; end if;\r\n  insert into public.logbook_submissions(id,supervisor_id,intern_id,company_id,assignment_id,supervisor_name,intern_name,company_name)\r\n  select p_id,auth.uid(),p_intern,a.company_id,a.id,sp.full_name,ip.full_name,c.name from public.profiles sp,public.profiles ip,public.companies c where sp.id=auth.uid() and ip.id=p_intern and c.id=a.company_id returning * into s;\r\n else\r\n  if s.supervisor_id<>auth.uid() or s.intern_id<>p_intern or s.assignment_id<>a.id or s.company_id<>a.company_id then raise exception 'Submission ownership or assignment changed' using errcode='42501'; end if;\r\n end if;\r\n select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version for update;\r\n previous:=to_jsonb(v);\r\n if v.submission_id is not null and v.status='Returned for Correction' then\r\n  if v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Submission changed; refresh' using errcode='40001'; end if;\r\n  update public.logbook_submissions set current_version=current_version+1 where id=p_id returning * into s;\r\n elsif v.submission_id is not null and (v.status<>'Draft' or v.version is distinct from p_version or v.revision is distinct from p_revision) then\r\n  -- Exact retry of a saved draft is safe, including a lost resubmission response.\r\n  if v.status='Draft' and v.version in (p_version,p_version+1) and v.date_start=p_start and v.date_end=p_end and v.remarks=p_remarks and v.evidence_ids=p_evidence then return v; end if;\r\n  raise exception 'Submitted evidence is immutable or draft changed; refresh' using errcode='40001';\r\n end if;\r\n foreach eid in array p_evidence loop\r\n  if not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path\r\n   where e.id=eid and e.logbook_submission_id=p_id and e.uploaded_by=auth.uid() and e.ready_at is not null and e.abandoned_at is null and (e.committed_at is not null or e.expires_at>clock_timestamp())\r\n   and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size) then raise exception 'Successfully uploaded private evidence required'; end if;\r\n end loop;\r\n if (select coalesce(sum(byte_size),0) from public.attendance_sheet_evidence where id=any(p_evidence))>52428800 then raise exception 'Evidence limit is 50 MiB total'; end if;\r\n insert into public.logbook_versions(submission_id,version,date_start,date_end,remarks,evidence_ids)\r\n values(p_id,s.current_version,p_start,p_end,p_remarks,p_evidence)\r\n on conflict(submission_id,version) do update set date_start=p_start,date_end=p_end,remarks=p_remarks,evidence_ids=p_evidence,revision=logbook_versions.revision+1 returning * into v;\r\n update public.attendance_sheet_evidence set committed_at=clock_timestamp() where id=any(p_evidence) and committed_at is null;\r\n insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'draft_saved',previous,to_jsonb(v));\r\n return v;\r\nend $function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "save_supervisor_evaluation",
      "args": "p_id uuid, p_intern_id uuid, p_date date, p_criteria jsonb, p_feedback text, p_expected_version integer, p_submit boolean",
      "identity": "public.save_supervisor_evaluation(uuid,uuid,date,jsonb,text,integer,boolean)",
      "result": "public.supervisor_evaluations",
      "names": [
        "p_id",
        "p_intern_id",
        "p_date",
        "p_criteria",
        "p_feedback",
        "p_expected_version",
        "p_submit"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.save_supervisor_evaluation(p_id uuid, p_intern_id uuid, p_date date, p_criteria jsonb, p_feedback text, p_expected_version integer, p_submit boolean DEFAULT false)\n RETURNS public.supervisor_evaluations\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.supervisor_evaluations; a public.supervisor_assignments; coordinator uuid; score integer; criterion text; rating numeric;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if public.current_role() is distinct from 'supervisor' then raise exception 'Active Supervisor required' using errcode='42501'; end if;\r\n if p_id is null or p_date is null or p_criteria is null or p_feedback is null or length(p_feedback)>2000 or p_submit is null then raise exception 'Evaluation date, ratings and feedback required'; end if;\r\n if jsonb_typeof(p_criteria) is distinct from 'object' then raise exception 'Draft ratings must be an object'; end if;\r\n for criterion in select jsonb_object_keys(p_criteria) loop\r\n  if criterion not in ('punctuality','performance','conduct','communication') or jsonb_typeof(p_criteria->criterion) is distinct from 'number'\r\n  then raise exception 'Use only the four rubric criteria with integer ratings 1 to 5'; end if;\r\n  rating:=(p_criteria->>criterion)::numeric;\r\n  if rating<1 or rating>5 or rating<>trunc(rating) then raise exception 'Integer ratings 1 to 5 required'; end if;\r\n end loop;\r\n select * into r from public.supervisor_evaluations where id=p_id for update;\r\n if found and (r.supervisor_id<>auth.uid() or r.intern_id<>p_intern_id) then raise exception 'Evaluation ownership mismatch' using errcode='42501'; end if;\r\n -- Exact retry returns the frozen submission, even if the assignment later ends.\r\n if r.status='Submitted to Coordinator' then\r\n  if p_submit and r.evaluation_date=p_date and r.criteria=p_criteria and r.feedback=p_feedback then return r; end if;\r\n  raise exception 'Submitted evaluation is immutable';\r\n end if;\r\n if not public.supervises_intern(p_intern_id) then raise exception 'Current assigned Intern required' using errcode='42501'; end if;\r\n select * into a from public.supervisor_assignments where supervisor_id=auth.uid() and intern_id=p_intern_id and ended_at is null;\r\n if r.id is not null and (r.version is distinct from p_expected_version or r.company_id<>a.company_id or r.assignment_id<>a.id) then raise exception 'Draft version or assignment changed; refresh' using errcode='40001'; end if;\r\n if r.id is null and p_expected_version is distinct from 0 then raise exception 'New draft expects version zero'; end if;\r\n score:=public.rubric_score(p_criteria);\r\n if p_submit then\r\n  if score is null then raise exception 'Complete four integer ratings from 1 to 5'; end if;\r\n  select i.instructor_id into coordinator from public.interns i join public.profiles p on p.id=i.instructor_id\r\n  where i.id=p_intern_id and p.role='instructor' and p.status='Active';\r\n  if coordinator is null then raise exception 'No eligible assigned OJT Coordinator. Ask Admin to assign an Active Coordinator before submission.'; end if;\r\n end if;\r\n if r.id is null then\r\n  insert into public.supervisor_evaluations(id,supervisor_id,intern_id,company_id,assignment_id,evaluation_date)\r\n  values(p_id,auth.uid(),p_intern_id,a.company_id,a.id,p_date) returning * into r;\r\n end if;\r\n update public.supervisor_evaluations set criteria=p_criteria,feedback=p_feedback,evaluation_date=p_date,overall_score=score,\r\n version=version+1,status=case when p_submit then 'Submitted to Coordinator' else 'Supervisor Draft' end,\r\n submitted_at=case when p_submit then clock_timestamp() else null end,coordinator_id=coordinator where id=p_id returning * into r;\r\n if p_submit then insert into public.evaluation_reviews(id,coordinator_id,source_version,criteria) values(r.id,coordinator,r.version,r.criteria); end if;\r\n return r;\r\nend $function$\n",
      "allowed": true,
      "source": "M15_supervisor_evaluations.sql"
    },
    {
      "name": "send_announcement",
      "args": "p_request_id uuid, p_title text, p_body text, p_target_intern_id uuid",
      "identity": "public.send_announcement(uuid,text,text,uuid)",
      "result": "public.announcements",
      "names": [
        "p_request_id",
        "p_title",
        "p_body",
        "p_target_intern_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.send_announcement(p_request_id uuid, p_title text, p_body text, p_target_intern_id uuid DEFAULT NULL::uuid)\n RETURNS public.announcements\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nDECLARE saved public.announcements; recipients uuid[]; actual uuid[];\nBEGIN\n PERFORM pg_advisory_xact_lock(404,1);\n IF public.current_role() IS NULL OR public.current_role() NOT IN ('instructor','admin')\n THEN RAISE EXCEPTION 'Active staff author required' USING errcode='42501'; END IF;\n PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;\n IF p_request_id IS NULL OR nullif(btrim(p_title),'') IS NULL OR nullif(btrim(p_body),'') IS NULL\n THEN RAISE EXCEPTION 'Retry identity, subject and message required'; END IF;\n SELECT * INTO saved FROM public.announcements WHERE id=p_request_id FOR UPDATE;\n IF FOUND THEN\n  IF saved.instructor_id IS DISTINCT FROM auth.uid() OR saved.title IS DISTINCT FROM btrim(p_title)\n   OR saved.body IS DISTINCT FROM btrim(p_body) OR saved.target_intern_id IS DISTINCT FROM p_target_intern_id\n  THEN RAISE EXCEPTION 'Announcement retry identity reused with different content or author' USING errcode='40001'; END IF;\n  RETURN saved; -- Recipients remain frozen, including after reassignment.\n END IF;\n SELECT coalesce(array_agg(i.id ORDER BY i.id),ARRAY[]::uuid[]) INTO recipients\n FROM public.interns i JOIN public.profiles p ON p.id=i.id\n WHERE i.instructor_id=auth.uid() AND p.role='intern' AND p.status='Active'\n  AND (p_target_intern_id IS NULL OR i.id=p_target_intern_id);\n IF cardinality(recipients)=0 THEN\n  RAISE EXCEPTION 'Select an active assigned intern or a nonempty assigned active roster' USING errcode='42501';\n END IF;\n -- M01 derives the immutable recipient array inside this same INSERT. M02\n -- audit failure aborts everything; no separate recipient transaction exists.\n INSERT INTO public.announcements(id,instructor_id,title,body,target,target_intern_id)\n VALUES(p_request_id,auth.uid(),btrim(p_title),btrim(p_body),\n  CASE WHEN p_target_intern_id IS NULL THEN 'All Interns' ELSE 'Personal' END,p_target_intern_id)\n RETURNING * INTO saved;\n SELECT array_agg(x ORDER BY x) INTO actual FROM unnest(saved.recipient_ids) x;\n IF actual IS DISTINCT FROM recipients OR saved.instructor_id IS DISTINCT FROM auth.uid()\n  OR saved.title IS DISTINCT FROM btrim(p_title) OR saved.body IS DISTINCT FROM btrim(p_body)\n  OR saved.target_intern_id IS DISTINCT FROM p_target_intern_id\n THEN RAISE EXCEPTION 'Announcement audience/content changed during creation; transaction rolled back'; END IF;\n RETURN saved;\nEND $function$\n",
      "allowed": true,
      "source": "M13_coordinator_operations.sql"
    },
    {
      "name": "stage_attendance_sheet",
      "args": "p_id uuid, p_company uuid, p_participants uuid[], p_name text, p_mime text, p_size bigint",
      "identity": "public.stage_attendance_sheet(uuid,uuid,uuid[],text,text,bigint)",
      "result": "public.attendance_sheet_evidence",
      "names": [
        "p_id",
        "p_company",
        "p_participants",
        "p_name",
        "p_mime",
        "p_size"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.stage_attendance_sheet(p_id uuid, p_company uuid, p_participants uuid[], p_name text, p_mime text, p_size bigint)\n RETURNS public.attendance_sheet_evidence\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare e public.attendance_sheet_evidence; ext text; participant uuid;\nbegin\n perform pg_advisory_xact_lock(404,1);\n if public.current_role() is distinct from 'instructor' then raise exception 'Active assigned OJT Coordinator required' using errcode='42501'; end if;\n if p_id is null or p_participants is null or cardinality(p_participants) not between 1 and 50\n or cardinality(p_participants)<>(select count(distinct x) from unnest(p_participants) x)\n or p_name is null or length(p_name) not between 1 and 200 or p_size is null or p_size not between 1 and 10485760 then raise exception 'Valid sheet identity, participants and file details required'; end if;\n foreach participant in array p_participants loop\n  if not public.assigned_intern(participant) or not public.manual_company_allowed(participant,p_company)\n  or not exists(select 1 from public.profiles where id=participant and role='intern' and status='Active')\n  then raise exception 'Every sheet participant must be an assigned Active Intern in this company or retained supervision history' using errcode='42501'; end if;\n end loop;\n ext:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else null end;\n if ext is null then raise exception 'PDF, JPEG or PNG evidence required'; end if;\n select * into e from public.attendance_sheet_evidence where id=p_id for update;\n if found then\n  if e.uploaded_by=auth.uid() and e.company_id=p_company and e.participant_ids=p_participants and e.file_name=p_name and e.mime_type=p_mime and e.byte_size=p_size and e.abandoned_at is null then return e; end if;\n  raise exception 'Upload identity already used; start a new upload';\n end if;\n insert into public.attendance_sheet_evidence(id,company_id,participant_ids,uploaded_by,file_path,file_name,mime_type,byte_size,expires_at)\n values(p_id,p_company,p_participants,auth.uid(),'sheets/'||p_id::text||'.'||ext,p_name,p_mime,p_size,clock_timestamp()+interval '15 minutes') returning * into e;\n return e;\nend $function$\n",
      "allowed": false,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "stage_document_upload",
      "args": "p_id uuid, p_name text, p_mime text, p_size bigint, p_expected_version bigint",
      "identity": "public.stage_document_upload(uuid,text,text,bigint,bigint)",
      "result": "jsonb",
      "names": [
        "p_id",
        "p_name",
        "p_mime",
        "p_size",
        "p_expected_version"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.stage_document_upload(p_id uuid, p_name text, p_mime text, p_size bigint, p_expected_version bigint)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare d public.documents; v public.document_versions; receipt uuid:=gen_random_uuid(); ext text;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n select * into d from public.documents where id=p_id and intern_id=auth.uid() for update;\r\n if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned requirement required' using errcode='42501'; end if;\r\n if p_expected_version is distinct from d.upload_version then raise exception 'Document changed; refresh' using errcode='40001'; end if;\r\n ext:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else null end;\r\n if ext is null or p_size is null or p_size<=0 or p_size>10485760 or nullif(btrim(p_name),'') is null or length(p_name)>255 or p_name~'[[:cntrl:]]'\r\n then raise exception 'PDF/JPEG/PNG, 1 byte-10 MiB and valid filename required'; end if;\r\n insert into public.document_versions(id,document_id,intern_id,expected_version,file_path,file_name,mime_type,byte_size,expires_at)\r\n values(receipt,d.id,auth.uid(),d.upload_version,auth.uid()::text||'/'||receipt::text||'.'||ext,p_name,p_mime,p_size,clock_timestamp()+interval '15 minutes') returning * into v;\r\n return jsonb_build_object('id',d.id,'upload',to_jsonb(v));\r\nend $function$\n",
      "allowed": true,
      "source": "M08_document_versions.sql"
    },
    {
      "name": "stage_logbook_evidence",
      "args": "p_id uuid, p_submission uuid, p_name text, p_mime text, p_size bigint",
      "identity": "public.stage_logbook_evidence(uuid,uuid,text,text,bigint)",
      "result": "public.attendance_sheet_evidence",
      "names": [
        "p_id",
        "p_submission",
        "p_name",
        "p_mime",
        "p_size"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.stage_logbook_evidence(p_id uuid, p_submission uuid, p_name text, p_mime text, p_size bigint)\n RETURNS public.attendance_sheet_evidence\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare s public.logbook_submissions; e public.attendance_sheet_evidence; ext text;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n select * into s from public.logbook_submissions where id=p_submission for update;\r\n if s.id is null or s.supervisor_id<>auth.uid() or not public.supervises_intern(s.intern_id)\r\n or not exists(select 1 from public.supervisor_assignments where id=s.assignment_id and ended_at is null)\r\n or not exists(select 1 from public.logbook_versions where submission_id=s.id and version=s.current_version and status in ('Draft','Returned for Correction')) then raise exception 'Own editable submission and current assignment required' using errcode='42501'; end if;\r\n ext:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end;\r\n if p_id is null or p_name is null or length(p_name) not between 1 and 200 or ext is null or p_size is null or p_size not between 1 and 10485760 then raise exception 'PDF, JPEG or PNG up to 10 MiB required'; end if;\r\n select * into e from public.attendance_sheet_evidence where id=p_id;\r\n if found then\r\n  if e.logbook_submission_id=p_submission and e.uploaded_by=auth.uid() and e.file_name=p_name and e.mime_type=p_mime and e.byte_size=p_size and e.abandoned_at is null then return e; end if;\r\n  raise exception 'Upload identity already used';\r\n end if;\r\n if (select count(*) from public.attendance_sheet_evidence where logbook_submission_id=p_submission and committed_at is null and abandoned_at is null and expires_at>clock_timestamp())>=10 then raise exception 'At most 10 active page uploads; abandon unused uploads first'; end if;\r\n insert into public.attendance_sheet_evidence(id,company_id,participant_ids,uploaded_by,file_path,file_name,mime_type,byte_size,expires_at,logbook_submission_id)\r\n values(p_id,s.company_id,array[s.intern_id],auth.uid(),'sheets/'||p_id::text||'.'||ext,p_name,p_mime,p_size,clock_timestamp()+interval '15 minutes',s.id) returning * into e;\r\n return e;\r\nend $function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "stage_submission",
      "args": "p_attempt_id uuid, p_submission_id uuid, p_title text, p_description text, p_files jsonb, p_expected_version bigint, p_expected_revision bigint",
      "identity": "public.stage_submission(uuid,uuid,text,text,jsonb,bigint,bigint)",
      "result": "jsonb",
      "names": [
        "p_attempt_id",
        "p_submission_id",
        "p_title",
        "p_description",
        "p_files",
        "p_expected_version",
        "p_expected_revision"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.stage_submission(p_attempt_id uuid, p_submission_id uuid, p_title text, p_description text, p_files jsonb, p_expected_version bigint, p_expected_revision bigint)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare s public.submissions; v public.submission_versions; f jsonb; n integer:=0; total bigint:=0; ext text; fid uuid; result jsonb;\nbegin\n perform pg_advisory_xact_lock(404,1);\n if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;\n if p_attempt_id is null or p_title is null or length(btrim(p_title)) not between 1 and 200 or p_description is null or length(p_description)>2000\n then raise exception 'Title 1-200 and description <=2000 characters required'; end if;\n if jsonb_typeof(p_files) is distinct from 'array' then raise exception 'File manifest required'; end if;\n if jsonb_array_length(p_files) not between 1 and 10 then raise exception 'Select 1-10 files'; end if;\n for f in select value from jsonb_array_elements(p_files) loop\n  if jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'name') is distinct from 'string'\n   or jsonb_typeof(f->'mime') is distinct from 'string' or jsonb_typeof(f->'size') is distinct from 'number'\n   or nullif(btrim(f->>'name'),'') is null or length(f->>'name')>255 or (f->>'name')~'[[:cntrl:]]'\n   or (f->>'mime') not in ('application/pdf','image/jpeg','image/png')\n   or (f->>'size')::numeric not between 1 and 10485760 or (f->>'size')::numeric<>trunc((f->>'size')::numeric)\n  then raise exception 'Each file needs a valid filename, PDF/JPEG/PNG MIME and 1 byte-10 MiB size'; end if;\n  total:=total+(f->>'size')::bigint;\n end loop;\n if total>52428800 then raise exception 'File set exceeds 50 MiB'; end if;\n select * into v from public.submission_versions where id=p_attempt_id;\n if found then\n  if v.intern_id<>auth.uid() then raise exception 'Reservation not owned' using errcode='42501'; end if;\n  if (p_submission_id is not null and p_submission_id<>v.submission_id) or v.title<>btrim(p_title) or v.description<>p_description\n    or v.manifest<>p_files or v.expected_version is distinct from p_expected_version or v.expected_revision is distinct from p_expected_revision\n  then raise exception 'Attempt ID reused with different content'; end if;\n else\n  if p_submission_id is null then\n   if p_expected_version is distinct from 0 or p_expected_revision is distinct from 0 then raise exception 'New submission expects version/revision zero'; end if;\n   insert into public.submissions(intern_id,title,description) values(auth.uid(),btrim(p_title),p_description) returning * into s;\n  else\n   select * into s from public.submissions where id=p_submission_id and intern_id=auth.uid() for update;\n   if not found then raise exception 'Owned submission required' using errcode='42501'; end if;\n   if s.current_version is distinct from p_expected_version or s.review_revision is distinct from p_expected_revision\n   then raise exception 'Submission changed; refresh' using errcode='40001'; end if;\n  end if;\n  insert into public.submission_versions(id,submission_id,intern_id,expected_version,expected_revision,title,description,manifest,expires_at)\n   values(p_attempt_id,s.id,auth.uid(),s.current_version,s.review_revision,btrim(p_title),p_description,p_files,clock_timestamp()+interval '15 minutes') returning * into v;\n  for f in select value from jsonb_array_elements(p_files) loop\n   n:=n+1; fid:=gen_random_uuid(); ext:=case f->>'mime' when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;\n   insert into public.submission_files(id,version_id,intern_id,ordinal,file_path,file_name,mime_type,byte_size)\n    values(fid,v.id,auth.uid(),n,auth.uid()::text||'/'||s.id::text||'/'||v.id::text||'/'||fid::text||'.'||ext,f->>'name',f->>'mime',(f->>'size')::bigint);\n  end loop;\n end if;\n select coalesce(jsonb_agg(to_jsonb(x) order by ordinal),'[]'::jsonb) into result from public.submission_files x where version_id=v.id;\n return jsonb_build_object('id',v.id,'version',to_jsonb(v),'files',result);\nend $function$\n",
      "allowed": true,
      "source": "M10_flexible_submissions.sql"
    },
    {
      "name": "submission_file_access",
      "args": "p_id uuid, p_version_id uuid",
      "identity": "public.submission_file_access(uuid,uuid)",
      "result": "jsonb",
      "names": [
        "p_id",
        "p_version_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.submission_file_access(p_id uuid, p_version_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare f public.submission_files; v public.submission_versions;\nbegin\n select * into f from public.submission_files where id=p_id and version_id=p_version_id;\n if not found or not public.can_read_intern(f.intern_id) then raise exception 'File access not permitted' using errcode='42501'; end if;\n select * into v from public.submission_versions where id=f.version_id and committed_at is not null;\n if not found or not exists(select 1 from storage.objects where bucket_id='documents' and name=f.file_path)\n then raise exception 'Committed file missing; refresh or request resubmission'; end if;\n return jsonb_build_object('id',f.id,'file_path',f.file_path,'file_name',f.file_name);\nend $function$\n",
      "allowed": true,
      "source": "M10_flexible_submissions.sql"
    },
    {
      "name": "submission_recovery_list",
      "args": "",
      "identity": "public.submission_recovery_list()",
      "result": "jsonb",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.submission_recovery_list()\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare result jsonb;\nbegin\n if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;\n select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'created_at',v.created_at) order by v.created_at),'[]'::jsonb)\n into result from public.submission_versions v where v.intern_id=auth.uid() and v.committed_at is null\n  and (v.abandoned_at is null or exists(select 1 from public.submission_files f join storage.objects o on o.bucket_id='documents' and o.name=f.file_path where f.version_id=v.id));\n if jsonb_array_length(result)>50000 then raise exception 'Recovery list too large; operator assistance required'; end if;\n return jsonb_build_object('id',auth.uid(),'versions',result);\nend $function$\n",
      "allowed": true,
      "source": "M10_flexible_submissions.sql"
    },
    {
      "name": "submit_correction",
      "args": "p_date date, p_in time without time zone, p_out time without time zone, p_end date, p_reason text",
      "identity": "public.submit_correction(date,time without time zone,time without time zone,date,text)",
      "result": "public.attendance_exceptions",
      "names": [
        "p_date",
        "p_in",
        "p_out",
        "p_end",
        "p_reason"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.submit_correction(p_date date, p_in time without time zone, p_out time without time zone, p_end date, p_reason text)\n RETURNS public.attendance_exceptions\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.attendance_exceptions;\r\nbegin\r\n  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;\r\n  if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Reason required, at most 500 characters'; end if;\r\n  perform * from public.correction_instants(p_date,p_in,p_out,p_end);\r\n  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,101));\r\n  if exists(select 1 from public.attendance_exceptions where intern_id=auth.uid() and log_date=p_date and status='Pending') then\r\n    raise exception 'A Pending correction already exists for this date' using errcode='40001';\r\n  end if;\r\n  insert into public.attendance_exceptions(intern_id,log_date,claimed_time_in,claimed_time_out,claimed_end_date,reason,status,reviewed_by,created_at)\r\n  values(auth.uid(),p_date,p_in,p_out,p_end,btrim(p_reason),'Pending',null,clock_timestamp()) returning * into r;\r\n  return r;\r\nend $function$\n",
      "allowed": false,
      "source": "M01_authority.sql"
    },
    {
      "name": "submit_document_upload",
      "args": "p_id uuid, p_path text, p_name text",
      "identity": "public.submit_document_upload(uuid,text,text)",
      "result": "public.documents",
      "names": [
        "p_id",
        "p_path",
        "p_name"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.submit_document_upload(p_id uuid, p_path text, p_name text)\n RETURNS public.documents\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.documents;\r\nbegin\r\n  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;\r\n  select * into r from public.documents where id=p_id and intern_id=auth.uid() for update;\r\n  if not found then raise exception 'Requirement not found' using errcode='40001'; end if;\r\n  if p_path is null or split_part(p_path,'/',1)<>auth.uid()::text\r\n     or cardinality(string_to_array(p_path,'/'))<>2 or split_part(p_path,'/',2) in ('','.','..')\r\n     or nullif(btrim(p_name),'') is null then raise exception 'Own folder and filename required'; end if;\r\n  if not exists(select 1 from storage.objects where bucket_id='documents' and name=p_path) then\r\n    raise exception 'Uploaded object not found';\r\n  end if;\r\n  update public.documents set file_path=p_path,file_name=p_name,status='Pending',note=null,\r\n    reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp() where id=r.id returning * into r;\r\n  return r;\r\nend $function$\n",
      "allowed": false,
      "source": "M01_authority.sql"
    },
    {
      "name": "submit_evaluation",
      "args": "p_intern_id uuid, p_criteria jsonb, p_feedback text, p_submission_id uuid",
      "identity": "public.submit_evaluation(uuid,jsonb,text,uuid)",
      "result": "public.evaluations",
      "names": [
        "p_intern_id",
        "p_criteria",
        "p_feedback",
        "p_submission_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.submit_evaluation(p_intern_id uuid, p_criteria jsonb, p_feedback text, p_submission_id uuid)\n RETURNS public.evaluations\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare r public.evaluations; score integer;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if not public.can_review(p_intern_id) or not exists(select 1 from public.profiles where id=p_intern_id and role='intern')\r\n then raise exception 'Evaluation not permitted' using errcode='42501'; end if;\r\n score:=public.rubric_score(p_criteria);\r\n if score is null or p_submission_id is null or length(p_feedback)>500 then\r\n   raise exception 'Four integer criteria 1-5, submission UUID and feedback <=500 required'; end if;\r\n select * into r from public.evaluations where evaluator_id=auth.uid() and submission_id=p_submission_id;\r\n if found then\r\n   if r.intern_id is distinct from p_intern_id or r.competencies is distinct from p_criteria\r\n     or r.feedback is distinct from nullif(btrim(p_feedback),'') then raise exception 'Submission key reused with different content' using errcode='40001'; end if;\r\n   return r;\r\n end if;\r\n insert into public.evaluations(intern_id,evaluator_id,competencies,feedback,overall_score,submission_id)\r\n values(p_intern_id,auth.uid(),p_criteria,nullif(btrim(p_feedback),''),score,p_submission_id) returning * into r;\r\n return r;\r\nend $function$\n",
      "allowed": false,
      "source": "M06_rubric_hours.sql"
    },
    {
      "name": "submit_logbook",
      "args": "p_id uuid, p_version integer, p_revision integer",
      "identity": "public.submit_logbook(uuid,integer,integer)",
      "result": "public.logbook_versions",
      "names": [
        "p_id",
        "p_version",
        "p_revision"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.submit_logbook(p_id uuid, p_version integer, p_revision integer)\n RETURNS public.logbook_versions\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare s public.logbook_submissions; v public.logbook_versions; recipient uuid; oldv jsonb;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n select * into s from public.logbook_submissions where id=p_id for update;\r\n if s.id is null or s.supervisor_id<>auth.uid() or not public.supervises_intern(s.intern_id) or not exists(select 1 from public.supervisor_assignments where id=s.assignment_id and ended_at is null) then raise exception 'Current explicit assignment required' using errcode='42501'; end if;\r\n select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version for update;\r\n if v.version=p_version and v.status='Pending Review' and v.revision=p_revision+1 then return v; end if;\r\n if v.status<>'Draft' or v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Draft changed; refresh' using errcode='40001'; end if;\r\n if cardinality(v.evidence_ids)=0 then raise exception 'Upload and save signed evidence before submission'; end if;\r\n if exists(select 1 from unnest(v.evidence_ids) eid where not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path where e.id=eid and e.committed_at is not null and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size)) then raise exception 'Preserved signed evidence unavailable'; end if;\r\n select i.instructor_id into recipient from public.interns i join public.profiles p on p.id=i.instructor_id where i.id=s.intern_id and i.company_id=s.company_id and p.role='instructor' and p.status='Active';\r\n if recipient is null then raise exception 'No eligible assigned OJT Coordinator. Ask Admin to resolve the assignment; your draft and evidence are saved.'; end if;\r\n if s.coordinator_id is not null and s.coordinator_id<>recipient then raise exception 'Coordinator changed. Ask Admin to explicitly reroute this submission before resubmitting; draft preserved.'; end if;\r\n oldv:=to_jsonb(v);\r\n update public.logbook_submissions set coordinator_id=recipient where id=p_id;\r\n update public.logbook_versions set status='Pending Review',receiving_coordinator_id=recipient,submitted_at=clock_timestamp(),revision=revision+1 where submission_id=p_id and version=v.version returning * into v;\r\n insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'submitted',oldv,to_jsonb(v));\r\n return v;\r\nend $function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "supervises_intern",
      "args": "p_id uuid",
      "identity": "public.supervises_intern(uuid)",
      "result": "boolean",
      "names": [
        "p_id"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.supervises_intern(p_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select coalesce(public.current_role()='supervisor' and exists(\r\n select 1 from public.supervisor_assignments a join public.interns i on i.id=a.intern_id\r\n join public.profiles p on p.id=i.id join public.profiles s on s.id=a.supervisor_id\r\n where a.supervisor_id=auth.uid() and a.intern_id=p_id and a.ended_at is null\r\n and a.company_id=i.company_id and a.company_id=s.supervisor_company_id and p.role='intern' and p.status='Active'),false)\r\n$function$\n",
      "allowed": true,
      "source": "M15_supervisor_evaluations.sql"
    },
    {
      "name": "supervisor_roster",
      "args": "p_after uuid, p_size integer",
      "identity": "public.supervisor_roster(uuid,integer)",
      "result": "TABLE(id uuid, full_name text, student_id text, company_id uuid)",
      "names": [
        "p_after",
        "p_size",
        "id",
        "full_name",
        "student_id",
        "company_id"
      ],
      "modes": [
        "i",
        "i",
        "t",
        "t",
        "t",
        "t"
      ],
      "def": "CREATE OR REPLACE FUNCTION public.supervisor_roster(p_after uuid DEFAULT NULL::uuid, p_size integer DEFAULT 500)\n RETURNS TABLE(id uuid, full_name text, student_id text, company_id uuid)\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select i.id,p.full_name,p.student_id,i.company_id from public.interns i join public.profiles p on p.id=i.id where public.supervises_intern(i.id) and (p_after is null or i.id>p_after) order by i.id limit greatest(1,least(coalesce(p_size,500),500))\r\n$function$\n",
      "allowed": true,
      "source": "M15_supervisor_evaluations.sql"
    },
    {
      "name": "unfinished_document_uploads",
      "args": "",
      "identity": "public.unfinished_document_uploads()",
      "result": "SETOF public.document_versions",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.unfinished_document_uploads()\n RETURNS SETOF public.document_versions\n LANGUAGE sql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select v.* from public.document_versions v where public.owns_intern(auth.uid()) and v.intern_id=auth.uid()\r\n and committed_at is null and (abandoned_at is not null or expires_at<=clock_timestamp()) order by created_at\r\n$function$\n",
      "allowed": true,
      "source": "M08_document_versions.sql"
    },
    {
      "name": "valid_required_hours",
      "args": "p_value numeric",
      "identity": "public.valid_required_hours(numeric)",
      "result": "boolean",
      "names": [
        "p_value"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.valid_required_hours(p_value numeric)\n RETURNS boolean\n LANGUAGE sql\n IMMUTABLE\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n select coalesce(p_value::text not in ('NaN','Infinity','-Infinity') and p_value>0\r\n   and p_value<=10000 and p_value=round(p_value,2),false)\r\n$function$\n",
      "allowed": true,
      "source": "M06_rubric_hours.sql"
    },
    {
      "name": "verify_attendance",
      "args": "p_id uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone",
      "identity": "public.verify_attendance(uuid,timestamp with time zone,timestamp with time zone)",
      "result": "public.attendance_logs",
      "names": [
        "p_id",
        "p_expected_in",
        "p_expected_out"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.verify_attendance(p_id uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone)\n RETURNS public.attendance_logs\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nbegin\n if exists(select 1 from public.attendance_logs where id=p_id and attendance_source='manual_company_sheet') then raise exception 'Review signed sheet using explicit manual attendance verification'; end if;\n return public.verify_attendance_core(p_id,p_expected_in,p_expected_out);\nend $function$\n",
      "allowed": true,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "verify_attendance_core",
      "args": "p_id uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone",
      "identity": "public.verify_attendance_core(uuid,timestamp with time zone,timestamp with time zone)",
      "result": "public.attendance_logs",
      "names": [
        "p_id",
        "p_expected_in",
        "p_expected_out"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.verify_attendance_core(p_id uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone)\n RETURNS public.attendance_logs\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare r public.attendance_logs;\nbegin\n perform pg_advisory_xact_lock(404,1);\n select * into r from public.attendance_logs where id=p_id;\n if not found or not public.can_review(r.intern_id) then raise exception 'Assigned active staff required' using errcode='42501'; end if;\n perform pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));\n perform 1 from public.profiles where id=auth.uid() for share;\n perform 1 from public.interns where id=r.intern_id for share;\n select * into r from public.attendance_logs where id=p_id for update;\n if not found or not public.can_review(r.intern_id) or not exists(select 1 from public.profiles where id=r.intern_id and role='intern') then raise exception 'Assignment or account changed; refresh' using errcode='42501'; end if;\n if p_expected_in is null or p_expected_out is null or r.clocked_in_at is distinct from p_expected_in or r.clocked_out_at is distinct from p_expected_out then raise exception 'Attendance changed; refresh before reviewing' using errcode='40001'; end if;\n if r.time_in is null or r.time_out is null or r.hours is null\n or r.log_date is distinct from (r.clocked_in_at at time zone 'Asia/Manila')::date\n or r.time_in is distinct from (r.clocked_in_at at time zone 'Asia/Manila')::time\n or r.time_out is distinct from (r.clocked_out_at at time zone 'Asia/Manila')::time\n or r.clocked_out_at<=r.clocked_in_at or r.clocked_out_at-r.clocked_in_at>interval '16 hours'\n or r.clocked_out_at>clock_timestamp() or r.hours is distinct from extract(epoch from r.clocked_out_at-r.clocked_in_at)/3600\n or (r.verified and r.verified_by is null) or (not r.verified and r.verified_by is not null) then raise exception 'Closed trustworthy attendance required; legacy or invalid evidence requires authorized review'; end if;\n if r.verified then return r; end if;\n update public.attendance_logs set verified=true,verified_by=auth.uid() where id=p_id returning * into r;\n return r;\nend $function$\n",
      "allowed": false,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "verify_manual_attendance",
      "args": "p_id uuid, p_revision integer, p_evidence uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone, p_reviewed boolean",
      "identity": "public.verify_manual_attendance(uuid,integer,uuid,timestamp with time zone,timestamp with time zone,boolean)",
      "result": "public.attendance_logs",
      "names": [
        "p_id",
        "p_revision",
        "p_evidence",
        "p_expected_in",
        "p_expected_out",
        "p_reviewed"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.verify_manual_attendance(p_id uuid, p_revision integer, p_evidence uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone, p_reviewed boolean)\n RETURNS public.attendance_logs\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare r public.attendance_logs;\nbegin\n perform pg_advisory_xact_lock(404,1);\n select * into r from public.attendance_logs where id=p_id for update;\n if not found or not public.can_review(r.intern_id) or not public.can_read_attendance_sheet(r.manual_evidence_id) then raise exception 'Authorized attendance/evidence review required' using errcode='42501'; end if;\n if p_reviewed is distinct from true or r.attendance_source<>'manual_company_sheet' or r.manual_revision is distinct from p_revision or r.manual_evidence_id is distinct from p_evidence then raise exception 'Review current encoded session, evidence and signatures before explicit verification'; end if;\n if not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path\n where e.id=p_evidence and e.committed_at is not null and e.abandoned_at is null and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size) then raise exception 'Preserved evidence unavailable; verification blocked'; end if;\n return public.verify_attendance_core(p_id,p_expected_in,p_expected_out);\nend $function$\n",
      "allowed": true,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "verify_record_logbook",
      "args": "p_id uuid, p_version integer, p_revision integer, p_request uuid, p_sessions jsonb, p_reviewed boolean",
      "identity": "public.verify_record_logbook(uuid,integer,integer,uuid,jsonb,boolean)",
      "result": "public.logbook_versions",
      "names": [
        "p_id",
        "p_version",
        "p_revision",
        "p_request",
        "p_sessions",
        "p_reviewed"
      ],
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.verify_record_logbook(p_id uuid, p_version integer, p_revision integer, p_request uuid, p_sessions jsonb, p_reviewed boolean)\n RETURNS public.logbook_versions\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare s public.logbook_submissions; v public.logbook_versions; oldv jsonb; item jsonb; pin timestamptz; pout timestamptz; n integer:=0; eid uuid; now_at timestamptz;\r\nbegin\r\n perform pg_advisory_xact_lock(404,1);\r\n if public.can_review_logbook(p_id) is not true then raise exception 'Assigned receiving Active Coordinator required' using errcode='42501'; end if;\r\n select * into s from public.logbook_submissions where id=p_id for update;\r\n perform pg_advisory_xact_lock(hashtextextended(s.intern_id::text,101));\r\n select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version for update;\r\n if p_request is null or p_reviewed is distinct from true or jsonb_typeof(p_sessions) is distinct from 'array' or jsonb_array_length(p_sessions) not between 1 and 62 then raise exception 'Confirm evidence and enter 1–62 valid sessions'; end if;\r\n if v.status='Verified' and v.version=p_version and v.request_id=p_request and v.recorded_sessions=p_sessions then return v; end if;\r\n if v.status<>'Pending Review' or v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Submission already reviewed or version changed; refresh' using errcode='40001'; end if;\r\n foreach eid in array v.evidence_ids loop\r\n  if not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path where e.id=eid and e.logbook_submission_id=p_id and e.committed_at is not null and e.abandoned_at is null and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size) then raise exception 'Preserved signed evidence unavailable'; end if;\r\n end loop;\r\n if cardinality(v.evidence_ids)=0 then raise exception 'Signed evidence required'; end if;\r\n oldv:=to_jsonb(v); now_at:=clock_timestamp();\r\n for item in select value from jsonb_array_elements(p_sessions) loop\r\n  n:=n+1;\r\n  begin\r\n   if jsonb_typeof(item) is distinct from 'object' or (select count(*) from jsonb_object_keys(item))<>2 or jsonb_typeof(item->'time_in') is distinct from 'string' or jsonb_typeof(item->'time_out') is distinct from 'string'\r\n   or item->>'time_in'!~'(Z|[+-][0-9]{2}:[0-9]{2})$' or item->>'time_out'!~'(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Both canonical timestamps with explicit offsets required'; end if;\r\n   pin:=(item->>'time_in')::timestamptz; pout:=(item->>'time_out')::timestamptz;\r\n   perform public.check_manual_session(s.intern_id,pin,pout,null);\r\n   if (pin at time zone 'Asia/Manila')::date not between v.date_start and v.date_end or (pout at time zone 'Asia/Manila')::date not between v.date_start and v.date_end then raise exception 'Session dates must fall within submitted covered dates'; end if;\r\n   insert into public.attendance_logs(id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,verified_by,verified_at,attendance_source,manual_evidence_id,manual_details,manual_revision,encoded_by,encoded_at,logbook_submission_id,logbook_version)\r\n   values(gen_random_uuid(),s.intern_id,(pin at time zone 'Asia/Manila')::date,(pin at time zone 'Asia/Manila')::time,(pout at time zone 'Asia/Manila')::time,pin,pout,extract(epoch from pout-pin)/3600,true,auth.uid(),now_at,'manual_company_sheet',v.evidence_ids[1],\r\n   jsonb_build_object('company_id',s.company_id,'company_on_sheet',s.company_name,'registered_company_name',s.company_name,'supervisor_on_sheet',s.supervisor_name,'remarks','','source_label','Manual — Company Logbook','signatures_reviewed',true),1,auth.uid(),now_at,s.id,v.version);\r\n  exception when others then raise exception 'Session %: %',n,sqlerrm; end;\r\n end loop;\r\n update public.logbook_versions set status='Verified',verified_by=auth.uid(),verified_at=now_at,request_id=p_request,recorded_sessions=p_sessions,revision=revision+1 where submission_id=p_id and version=p_version returning * into v;\r\n insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'verified_and_recorded',oldv,to_jsonb(v));\r\n return v;\r\nend $function$\n",
      "allowed": true,
      "source": "M18_supervisor_logbook.sql"
    },
    {
      "name": "write_manual_attendance_event",
      "args": "",
      "identity": "public.write_manual_attendance_event()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.write_manual_attendance_event()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\nbegin\n if new.attendance_source='manual_company_sheet' and (tg_op='INSERT' or new is distinct from old) then\n  insert into public.manual_attendance_events(attendance_id,intern_id,actor_id,event_kind,before_values,after_values,created_at)\n  values(new.id,new.intern_id,auth.uid(),case when tg_op='INSERT' then 'created' when new.verified and not old.verified then 'verified' else 'revised' end,\n  case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new),clock_timestamp());\n end if;\n return new;\nend $function$\n",
      "allowed": false,
      "source": "M17_company_attendance.sql"
    },
    {
      "name": "write_trusted_audit",
      "args": "",
      "identity": "public.write_trusted_audit()",
      "result": "trigger",
      "names": null,
      "modes": null,
      "def": "CREATE OR REPLACE FUNCTION public.write_trusted_audit()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\ndeclare before_row jsonb; after_row jsonb; row_data jsonb; changed jsonb;\r\n        actor uuid:=auth.uid(); actor_label text;\r\nbegin\r\n  before_row:=case when tg_op<>'INSERT' then to_jsonb(old) else '{}'::jsonb end;\r\n  after_row:=case when tg_op<>'DELETE' then to_jsonb(new) else '{}'::jsonb end;\r\n  if tg_op='UPDATE' and before_row=after_row then return new; end if;\r\n  row_data:=case when tg_op='DELETE' then before_row else after_row end;\r\n  select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into changed\r\n  from (select jsonb_object_keys(before_row || after_row) as k) fields\r\n  where before_row->k is distinct from after_row->k;\r\n  select full_name into actor_label from public.profiles where id=actor;\r\n  -- Minimal metadata: no credentials, file bytes, or whole profile snapshots.\r\n  -- No exception handler: an audit failure aborts the business mutation.\r\n  insert into public.audit_logs(actor_id,actor_name,action,detail,created_at,source,event_data)\r\n  values(actor,coalesce(actor_label,'System / trusted SQL'),tg_table_name || ' ' || lower(tg_op),\r\n    'Record ' || coalesce(row_data->>'id','unknown'),clock_timestamp(),'database-trigger-v2',\r\n    jsonb_build_object('table',tg_table_name,'operation',tg_op,'record_id',row_data->>'id',\r\n      'intern_id',row_data->>'intern_id','changed_fields',changed,\r\n      'previous_status',before_row->>'status','status',after_row->>'status',\r\n      'previous_role',before_row->>'role','role',after_row->>'role',\r\n      'previous_instructor_id',before_row->>'instructor_id','instructor_id',after_row->>'instructor_id',\r\n      'previous_company_id',before_row->>'company_id','company_id',after_row->>'company_id',\r\n      'previous_section_id',before_row->>'section_id','section_id',after_row->>'section_id',\r\n      'previous_required_hours',before_row->'required_hours','required_hours',after_row->'required_hours',\r\n      'entity_label',case when tg_table_name in ('companies','course_sections','academic_years')\r\n        then coalesce(row_data->>'name',row_data->>'label') else null end,\r\n      'previous_entity_label',case when tg_table_name in ('companies','course_sections','academic_years')\r\n        then coalesce(before_row->>'name',before_row->>'label') else null end,\r\n      'reviewed_by',after_row->>'reviewed_by','verified_by',after_row->>'verified_by',\r\n      'context',case when actor is null then 'system-or-sql' else 'authenticated' end));\r\n  if tg_op='DELETE' then return old; end if;\r\n  return new;\r\nend $function$\n",
      "allowed": false,
      "source": "M02_trusted_audit.sql"
    }
  ],
  "triggers": [
    {
      "schema": "auth",
      "tab": "users",
      "name": "on_auth_user_created",
      "def": "CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()"
    },
    {
      "schema": "public",
      "tab": "academic_years",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.academic_years FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "alerts",
      "name": "m01_alert_fields",
      "def": "CREATE TRIGGER m01_alert_fields BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.guard_alert_update()"
    },
    {
      "schema": "public",
      "tab": "alerts",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "announcements",
      "name": "m01_announcement_audience",
      "def": "CREATE TRIGGER m01_announcement_audience BEFORE INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.bind_announcement()"
    },
    {
      "schema": "public",
      "tab": "announcements",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "attendance_exceptions",
      "name": "m01_exception_identity",
      "def": "CREATE TRIGGER m01_exception_identity BEFORE UPDATE ON public.attendance_exceptions FOR EACH ROW EXECUTE FUNCTION public.guard_domain_identity()"
    },
    {
      "schema": "public",
      "tab": "attendance_exceptions",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.attendance_exceptions FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "attendance_exceptions",
      "name": "m03_future",
      "def": "CREATE TRIGGER m03_future BEFORE INSERT OR UPDATE ON public.attendance_exceptions FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_future()"
    },
    {
      "schema": "public",
      "tab": "attendance_logs",
      "name": "m01_attendance_identity",
      "def": "CREATE TRIGGER m01_attendance_identity BEFORE UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.guard_domain_identity()"
    },
    {
      "schema": "public",
      "tab": "attendance_logs",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "attendance_logs",
      "name": "m03_future",
      "def": "CREATE TRIGGER m03_future BEFORE INSERT OR UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_future()"
    },
    {
      "schema": "public",
      "tab": "attendance_logs",
      "name": "m17_manual_events",
      "def": "CREATE TRIGGER m17_manual_events AFTER INSERT OR UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.write_manual_attendance_event()"
    },
    {
      "schema": "public",
      "tab": "attendance_logs",
      "name": "m17_manual_guard",
      "def": "CREATE TRIGGER m17_manual_guard BEFORE DELETE OR UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.guard_manual_attendance()"
    },
    {
      "schema": "public",
      "tab": "attendance_sheet_evidence",
      "name": "m17_evidence_audit",
      "def": "CREATE TRIGGER m17_evidence_audit AFTER INSERT OR DELETE OR UPDATE ON public.attendance_sheet_evidence FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "attendance_sheet_evidence",
      "name": "m17_sheet_history",
      "def": "CREATE TRIGGER m17_sheet_history BEFORE DELETE OR UPDATE ON public.attendance_sheet_evidence FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_sheet_history()"
    },
    {
      "schema": "public",
      "tab": "companies",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "course_sections",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.course_sections FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "document_review_events",
      "name": "m08_review_audit",
      "def": "CREATE TRIGGER m08_review_audit AFTER INSERT OR DELETE OR UPDATE ON public.document_review_events FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "document_versions",
      "name": "m08_version_audit",
      "def": "CREATE TRIGGER m08_version_audit AFTER INSERT OR DELETE OR UPDATE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "documents",
      "name": "m01_document_identity",
      "def": "CREATE TRIGGER m01_document_identity BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.guard_domain_identity()"
    },
    {
      "schema": "public",
      "tab": "documents",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "evaluation_adjustment_events",
      "name": "m16_adjustment_audit",
      "def": "CREATE TRIGGER m16_adjustment_audit AFTER INSERT ON public.evaluation_adjustment_events FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "evaluation_adjustment_events",
      "name": "m16_adjustment_immutable",
      "def": "CREATE TRIGGER m16_adjustment_immutable BEFORE DELETE OR UPDATE ON public.evaluation_adjustment_events FOR EACH ROW EXECUTE FUNCTION public.guard_evaluation_adjustment_event()"
    },
    {
      "schema": "public",
      "tab": "evaluation_reviews",
      "name": "m15_audit",
      "def": "CREATE TRIGGER m15_audit AFTER INSERT OR DELETE OR UPDATE ON public.evaluation_reviews FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "evaluation_routing_events",
      "name": "m15_audit",
      "def": "CREATE TRIGGER m15_audit AFTER INSERT OR DELETE OR UPDATE ON public.evaluation_routing_events FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "evaluations",
      "name": "m01_evaluation_identity",
      "def": "CREATE TRIGGER m01_evaluation_identity BEFORE UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.guard_domain_identity()"
    },
    {
      "schema": "public",
      "tab": "evaluations",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "evaluations",
      "name": "m15_frozen_final",
      "def": "CREATE TRIGGER m15_frozen_final BEFORE DELETE OR UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.guard_frozen_evaluation()"
    },
    {
      "schema": "public",
      "tab": "interns",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.interns FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "interns",
      "name": "m07_intern_relationship",
      "def": "CREATE CONSTRAINT TRIGGER m07_intern_relationship AFTER INSERT OR DELETE OR UPDATE ON public.interns DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_account_relationships()"
    },
    {
      "schema": "public",
      "tab": "interns",
      "name": "m11_assignment_archive_guard",
      "def": "CREATE TRIGGER m11_assignment_archive_guard BEFORE INSERT OR UPDATE ON public.interns FOR EACH ROW EXECUTE FUNCTION public.guard_archived_assignment()"
    },
    {
      "schema": "public",
      "tab": "interns",
      "name": "m15_intern_relationship",
      "def": "CREATE CONSTRAINT TRIGGER m15_intern_relationship AFTER INSERT OR UPDATE ON public.interns DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.guard_supervision_relationships()"
    },
    {
      "schema": "public",
      "tab": "logbook_events",
      "name": "m18_events_audit",
      "def": "CREATE TRIGGER m18_events_audit AFTER INSERT ON public.logbook_events FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "logbook_events",
      "name": "m18_events_immutable",
      "def": "CREATE TRIGGER m18_events_immutable BEFORE DELETE OR UPDATE ON public.logbook_events FOR EACH ROW EXECUTE FUNCTION public.guard_manual_history()"
    },
    {
      "schema": "public",
      "tab": "logbook_versions",
      "name": "m18_version_guard",
      "def": "CREATE TRIGGER m18_version_guard BEFORE DELETE OR UPDATE ON public.logbook_versions FOR EACH ROW EXECUTE FUNCTION public.guard_logbook_version()"
    },
    {
      "schema": "public",
      "tab": "manual_attendance_events",
      "name": "m17_event_audit",
      "def": "CREATE TRIGGER m17_event_audit AFTER INSERT ON public.manual_attendance_events FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "manual_attendance_events",
      "name": "m17_history_immutable",
      "def": "CREATE TRIGGER m17_history_immutable BEFORE DELETE OR UPDATE ON public.manual_attendance_events FOR EACH ROW EXECUTE FUNCTION public.guard_manual_history()"
    },
    {
      "schema": "public",
      "tab": "profiles",
      "name": "m01_profile_fields",
      "def": "CREATE TRIGGER m01_profile_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update()"
    },
    {
      "schema": "public",
      "tab": "profiles",
      "name": "m02_trusted_audit",
      "def": "CREATE TRIGGER m02_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "profiles",
      "name": "m07_profile_relationship",
      "def": "CREATE CONSTRAINT TRIGGER m07_profile_relationship AFTER INSERT OR UPDATE ON public.profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_account_relationships()"
    },
    {
      "schema": "public",
      "tab": "profiles",
      "name": "m14_last_active_admin",
      "def": "CREATE TRIGGER m14_last_active_admin BEFORE DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_last_active_admin()"
    },
    {
      "schema": "public",
      "tab": "profiles",
      "name": "m15_profile_relationship",
      "def": "CREATE CONSTRAINT TRIGGER m15_profile_relationship AFTER INSERT OR UPDATE ON public.profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.guard_supervision_relationships()"
    },
    {
      "schema": "public",
      "tab": "submission_files",
      "name": "m10_trusted_audit",
      "def": "CREATE TRIGGER m10_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.submission_files FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "submission_reviews",
      "name": "m10_trusted_audit",
      "def": "CREATE TRIGGER m10_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.submission_reviews FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "submission_versions",
      "name": "m10_trusted_audit",
      "def": "CREATE TRIGGER m10_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.submission_versions FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "submissions",
      "name": "m10_trusted_audit",
      "def": "CREATE TRIGGER m10_trusted_audit AFTER INSERT OR DELETE OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "supervisor_assignments",
      "name": "m15_assignment_relationship",
      "def": "CREATE CONSTRAINT TRIGGER m15_assignment_relationship AFTER INSERT OR UPDATE ON public.supervisor_assignments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.guard_supervision_relationships()"
    },
    {
      "schema": "public",
      "tab": "supervisor_assignments",
      "name": "m15_audit",
      "def": "CREATE TRIGGER m15_audit AFTER INSERT OR DELETE OR UPDATE ON public.supervisor_assignments FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "supervisor_evaluations",
      "name": "m15_audit",
      "def": "CREATE TRIGGER m15_audit AFTER INSERT OR DELETE OR UPDATE ON public.supervisor_evaluations FOR EACH ROW EXECUTE FUNCTION public.write_trusted_audit()"
    },
    {
      "schema": "public",
      "tab": "supervisor_evaluations",
      "name": "m15_frozen_source",
      "def": "CREATE TRIGGER m15_frozen_source BEFORE DELETE OR UPDATE ON public.supervisor_evaluations FOR EACH ROW EXECUTE FUNCTION public.guard_frozen_evaluation()"
    }
  ],
  "policies": [
    {
      "schema": "public",
      "tab": "academic_years",
      "name": "m01_years_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.is_active()",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "academic_years",
      "name": "m01_years_write",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "ALL",
      "qual": "public.is_admin()",
      "with_check": "public.is_admin()"
    },
    {
      "schema": "public",
      "tab": "academic_years",
      "name": "m15_year_scope",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.\"current_role\"() <> 'supervisor'::text)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "alerts",
      "name": "m01_alerts_admin",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "ALL",
      "qual": "public.is_admin()",
      "with_check": "public.is_admin()"
    },
    {
      "schema": "public",
      "tab": "alerts",
      "name": "m01_alerts_dismiss",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "UPDATE",
      "qual": "public.assigned_intern(intern_id)",
      "with_check": "public.assigned_intern(intern_id)"
    },
    {
      "schema": "public",
      "tab": "alerts",
      "name": "m01_alerts_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_review(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "announcements",
      "name": "m01_announcements_insert",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "((public.\"current_role\"() = ANY (ARRAY['admin'::text, 'instructor'::text])) AND (instructor_id = auth.uid()))"
    },
    {
      "schema": "public",
      "tab": "announcements",
      "name": "m01_announcements_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.is_active() AND (public.is_admin() OR (instructor_id = auth.uid()) OR ((public.\"current_role\"() = 'intern'::text) AND (auth.uid() = ANY (recipient_ids)))))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "announcements",
      "name": "m15_announcement_scope",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.\"current_role\"() = ANY (ARRAY['admin'::text, 'instructor'::text, 'intern'::text]))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "attendance_exceptions",
      "name": "m01_exceptions_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_intern(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "attendance_logs",
      "name": "m01_attendance_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_intern(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "attendance_sheet_evidence",
      "name": "m17_evidence_boundary",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_attendance_sheet(id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "attendance_sheet_evidence",
      "name": "m17_evidence_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_attendance_sheet(id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "audit_logs",
      "name": "m01_audit_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.is_admin()",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "companies",
      "name": "m01_companies_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.is_active()",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "companies",
      "name": "m01_companies_write",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "ALL",
      "qual": "public.is_admin()",
      "with_check": "public.is_admin()"
    },
    {
      "schema": "public",
      "tab": "companies",
      "name": "m15_company_scope",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "((public.\"current_role\"() <> 'supervisor'::text) OR (id = ( SELECT profiles.supervisor_company_id\n   FROM public.profiles\n  WHERE (profiles.id = auth.uid()))))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "course_sections",
      "name": "m01_sections_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.is_active()",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "course_sections",
      "name": "m01_sections_write",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "ALL",
      "qual": "public.is_admin()",
      "with_check": "public.is_admin()"
    },
    {
      "schema": "public",
      "tab": "course_sections",
      "name": "m15_section_scope",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.\"current_role\"() <> 'supervisor'::text)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "document_review_events",
      "name": "m08_reviews_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_intern(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "document_versions",
      "name": "m08_versions_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.owns_intern(intern_id) OR ((committed_at IS NOT NULL) AND public.can_review(intern_id)))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "documents",
      "name": "m01_documents_insert",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "(public.is_admin() AND (status = 'Pending'::text) AND (file_path IS NULL) AND (file_name IS NULL) AND (note IS NULL) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL))"
    },
    {
      "schema": "public",
      "tab": "documents",
      "name": "m01_documents_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_intern(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "evaluation_adjustment_events",
      "name": "m16_adjustments_boundary",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.is_admin() OR ((coordinator_id = auth.uid()) AND public.can_review_source(source_id)))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "evaluation_adjustment_events",
      "name": "m16_adjustments_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.is_admin() OR ((coordinator_id = auth.uid()) AND public.can_review_source(source_id)))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "evaluation_reviews",
      "name": "m15_review_boundary",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_review_source(id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "evaluation_reviews",
      "name": "m15_review_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_review_source(id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "evaluation_routing_events",
      "name": "m15_route_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.is_admin()",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "evaluations",
      "name": "m01_evaluations_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_intern(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "interns",
      "name": "m01_interns_admin",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "ALL",
      "qual": "public.is_admin()",
      "with_check": "public.is_admin()"
    },
    {
      "schema": "public",
      "tab": "interns",
      "name": "m01_interns_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_intern(id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "logbook_events",
      "name": "m18_events_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.can_read_logbook(submission_id) AND ((event_kind <> 'draft_saved'::text) OR public.is_admin() OR (EXISTS ( SELECT 1\n   FROM public.logbook_submissions s\n  WHERE ((s.id = logbook_events.submission_id) AND (s.supervisor_id = auth.uid()))))))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "logbook_submissions",
      "name": "m18_submission_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_logbook(id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "logbook_versions",
      "name": "m18_version_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.can_read_logbook(submission_id) AND ((status <> 'Draft'::text) OR public.is_admin() OR (EXISTS ( SELECT 1\n   FROM public.logbook_submissions s\n  WHERE ((s.id = logbook_versions.submission_id) AND (s.supervisor_id = auth.uid()))))))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "manual_attendance_events",
      "name": "m17_events_boundary",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_review(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "manual_attendance_events",
      "name": "m17_events_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_review(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "profiles",
      "name": "m01_profiles_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.is_active() AND ((id = auth.uid()) OR public.is_admin() OR public.assigned_intern(id)))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "profiles",
      "name": "m01_profiles_update",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "UPDATE",
      "qual": "(public.is_admin() OR (public.is_active() AND (id = auth.uid())))",
      "with_check": "(public.is_admin() OR (public.is_active() AND (id = auth.uid())))"
    },
    {
      "schema": "public",
      "tab": "submission_files",
      "name": "m10_delete_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "DELETE",
      "qual": "false",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submission_files",
      "name": "m10_files_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.owns_intern(intern_id) OR (public.can_review(intern_id) AND (EXISTS ( SELECT 1\n   FROM public.submission_versions v\n  WHERE ((v.id = submission_files.version_id) AND (v.committed_at IS NOT NULL))))))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submission_files",
      "name": "m10_files_read_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.owns_intern(intern_id) OR (public.can_review(intern_id) AND (EXISTS ( SELECT 1\n   FROM public.submission_versions v\n  WHERE ((v.id = submission_files.version_id) AND (v.committed_at IS NOT NULL))))))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submission_files",
      "name": "m10_insert_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "false"
    },
    {
      "schema": "public",
      "tab": "submission_files",
      "name": "m10_update_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "UPDATE",
      "qual": "false",
      "with_check": "false"
    },
    {
      "schema": "public",
      "tab": "submission_reviews",
      "name": "m10_delete_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "DELETE",
      "qual": "false",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submission_reviews",
      "name": "m10_insert_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "false"
    },
    {
      "schema": "public",
      "tab": "submission_reviews",
      "name": "m10_reviews_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_intern(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submission_reviews",
      "name": "m10_reviews_read_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "public.can_read_intern(intern_id)",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submission_reviews",
      "name": "m10_update_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "UPDATE",
      "qual": "false",
      "with_check": "false"
    },
    {
      "schema": "public",
      "tab": "submission_versions",
      "name": "m10_delete_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "DELETE",
      "qual": "false",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submission_versions",
      "name": "m10_insert_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "false"
    },
    {
      "schema": "public",
      "tab": "submission_versions",
      "name": "m10_update_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "UPDATE",
      "qual": "false",
      "with_check": "false"
    },
    {
      "schema": "public",
      "tab": "submission_versions",
      "name": "m10_versions_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.owns_intern(intern_id) OR ((committed_at IS NOT NULL) AND public.can_review(intern_id)))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submission_versions",
      "name": "m10_versions_read_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.owns_intern(intern_id) OR ((committed_at IS NOT NULL) AND public.can_review(intern_id)))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submissions",
      "name": "m10_delete_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "DELETE",
      "qual": "false",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submissions",
      "name": "m10_insert_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "false"
    },
    {
      "schema": "public",
      "tab": "submissions",
      "name": "m10_submissions_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.owns_intern(intern_id) OR ((current_version > 0) AND public.can_review(intern_id)))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submissions",
      "name": "m10_submissions_read_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.owns_intern(intern_id) OR ((current_version > 0) AND public.can_review(intern_id)))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "submissions",
      "name": "m10_update_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "UPDATE",
      "qual": "false",
      "with_check": "false"
    },
    {
      "schema": "public",
      "tab": "supervisor_assignments",
      "name": "m15_assignment_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.is_admin() OR ((public.\"current_role\"() = 'supervisor'::text) AND (supervisor_id = auth.uid())))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "supervisor_evaluations",
      "name": "m15_source_boundary",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.is_admin() OR ((public.\"current_role\"() = 'supervisor'::text) AND (supervisor_id = auth.uid())) OR ((status = 'Submitted to Coordinator'::text) AND public.can_review_source(id)))",
      "with_check": null
    },
    {
      "schema": "public",
      "tab": "supervisor_evaluations",
      "name": "m15_source_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "(public.is_admin() OR ((public.\"current_role\"() = 'supervisor'::text) AND (supervisor_id = auth.uid())) OR ((status = 'Submitted to Coordinator'::text) AND public.can_review_source(id)))",
      "with_check": null
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m01_document_objects_insert",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "((bucket_id = 'documents'::text) AND public.can_insert_reserved_document(name))"
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m01_document_objects_read",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "((bucket_id = 'documents'::text) AND public.can_read_document_object(name))",
      "with_check": null
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m08_document_anon_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "anon"
      ],
      "cmd": "ALL",
      "qual": "(bucket_id <> 'documents'::text)",
      "with_check": "(bucket_id <> 'documents'::text)"
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m08_document_delete_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "DELETE",
      "qual": "((bucket_id <> 'documents'::text) OR public.can_delete_staged_document(name))",
      "with_check": null
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m08_document_insert_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "((bucket_id <> 'documents'::text) OR public.can_insert_reserved_document(name))"
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m08_document_read_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "((bucket_id <> 'documents'::text) OR public.can_read_document_object(name))",
      "with_check": null
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m08_document_update_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "UPDATE",
      "qual": "(bucket_id <> 'documents'::text)",
      "with_check": "(bucket_id <> 'documents'::text)"
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m08_staged_cleanup",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "DELETE",
      "qual": "((bucket_id = 'documents'::text) AND public.can_delete_staged_document(name))",
      "with_check": null
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m17_sheet_anon_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "anon"
      ],
      "cmd": "ALL",
      "qual": "(bucket_id <> 'attendance-evidence'::text)",
      "with_check": "(bucket_id <> 'attendance-evidence'::text)"
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m17_sheet_delete",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "DELETE",
      "qual": "((bucket_id = 'attendance-evidence'::text) AND public.attendance_sheet_object_allowed(name, 'delete'::text))",
      "with_check": null
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m17_sheet_delete_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "DELETE",
      "qual": "((bucket_id <> 'attendance-evidence'::text) OR public.attendance_sheet_object_allowed(name, 'delete'::text))",
      "with_check": null
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m17_sheet_insert",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "((bucket_id = 'attendance-evidence'::text) AND public.attendance_sheet_object_allowed(name, 'insert'::text))"
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m17_sheet_insert_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "INSERT",
      "qual": null,
      "with_check": "((bucket_id <> 'attendance-evidence'::text) OR public.attendance_sheet_object_allowed(name, 'insert'::text))"
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m17_sheet_select",
      "permissive": "PERMISSIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "((bucket_id = 'attendance-evidence'::text) AND public.attendance_sheet_object_allowed(name, 'read'::text))",
      "with_check": null
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m17_sheet_select_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "SELECT",
      "qual": "((bucket_id <> 'attendance-evidence'::text) OR public.attendance_sheet_object_allowed(name, 'read'::text))",
      "with_check": null
    },
    {
      "schema": "storage",
      "tab": "objects",
      "name": "m17_sheet_update_guard",
      "permissive": "RESTRICTIVE",
      "roles": [
        "authenticated"
      ],
      "cmd": "UPDATE",
      "qual": "(bucket_id <> 'attendance-evidence'::text)",
      "with_check": "(bucket_id <> 'attendance-evidence'::text)"
    }
  ],
  "grants": [
    {
      "tab": "academic_years",
      "privilege": "SELECT"
    },
    {
      "tab": "alerts",
      "privilege": "DELETE"
    },
    {
      "tab": "alerts",
      "privilege": "INSERT"
    },
    {
      "tab": "alerts",
      "privilege": "SELECT"
    },
    {
      "tab": "alerts",
      "privilege": "UPDATE"
    },
    {
      "tab": "announcements",
      "privilege": "SELECT"
    },
    {
      "tab": "attendance_exceptions",
      "privilege": "SELECT"
    },
    {
      "tab": "attendance_logs",
      "privilege": "SELECT"
    },
    {
      "tab": "attendance_sheet_evidence",
      "privilege": "SELECT"
    },
    {
      "tab": "audit_logs",
      "privilege": "SELECT"
    },
    {
      "tab": "companies",
      "privilege": "SELECT"
    },
    {
      "tab": "course_sections",
      "privilege": "SELECT"
    },
    {
      "tab": "document_review_events",
      "privilege": "SELECT"
    },
    {
      "tab": "document_versions",
      "privilege": "SELECT"
    },
    {
      "tab": "documents",
      "privilege": "SELECT"
    },
    {
      "tab": "evaluation_adjustment_events",
      "privilege": "SELECT"
    },
    {
      "tab": "evaluation_reviews",
      "privilege": "SELECT"
    },
    {
      "tab": "evaluation_routing_events",
      "privilege": "SELECT"
    },
    {
      "tab": "evaluations",
      "privilege": "SELECT"
    },
    {
      "tab": "interns",
      "privilege": "SELECT"
    },
    {
      "tab": "logbook_events",
      "privilege": "SELECT"
    },
    {
      "tab": "logbook_submissions",
      "privilege": "SELECT"
    },
    {
      "tab": "logbook_versions",
      "privilege": "SELECT"
    },
    {
      "tab": "manual_attendance_events",
      "privilege": "SELECT"
    },
    {
      "tab": "profiles",
      "privilege": "SELECT"
    },
    {
      "tab": "submission_files",
      "privilege": "SELECT"
    },
    {
      "tab": "submission_reviews",
      "privilege": "SELECT"
    },
    {
      "tab": "submission_versions",
      "privilege": "SELECT"
    },
    {
      "tab": "submissions",
      "privilege": "SELECT"
    },
    {
      "tab": "supervisor_assignments",
      "privilege": "SELECT"
    },
    {
      "tab": "supervisor_evaluations",
      "privilege": "SELECT"
    }
  ],
  "columnGrants": [
    {
      "tab": "academic_years",
      "name": "label",
      "privilege": "INSERT"
    },
    {
      "tab": "academic_years",
      "name": "label",
      "privilege": "UPDATE"
    },
    {
      "tab": "alerts",
      "name": "dismissed",
      "privilege": "UPDATE"
    },
    {
      "tab": "companies",
      "name": "name",
      "privilege": "INSERT"
    },
    {
      "tab": "companies",
      "name": "name",
      "privilege": "UPDATE"
    },
    {
      "tab": "course_sections",
      "name": "name",
      "privilege": "INSERT"
    },
    {
      "tab": "course_sections",
      "name": "name",
      "privilege": "UPDATE"
    },
    {
      "tab": "documents",
      "name": "doc_type",
      "privilege": "INSERT"
    },
    {
      "tab": "documents",
      "name": "intern_id",
      "privilege": "INSERT"
    },
    {
      "tab": "documents",
      "name": "name",
      "privilege": "INSERT"
    },
    {
      "tab": "profiles",
      "name": "full_name",
      "privilege": "UPDATE"
    }
  ],
  "baselineChecks": [
    {
      "tab": "alerts",
      "name": "alerts_severity_check",
      "kind": "c",
      "def": "CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))",
      "validated": true
    },
    {
      "tab": "attendance_exceptions",
      "name": "attendance_exceptions_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])))",
      "validated": true
    },
    {
      "tab": "documents",
      "name": "documents_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Needs Revision'::text])))",
      "validated": true
    },
    {
      "tab": "evaluations",
      "name": "evaluations_overall_score_check",
      "kind": "c",
      "def": "CHECK (((overall_score >= (0)::numeric) AND (overall_score <= (100)::numeric)))",
      "validated": true
    },
    {
      "tab": "profiles",
      "name": "profiles_role_check",
      "kind": "c",
      "def": "CHECK ((role = ANY (ARRAY['intern'::text, 'instructor'::text, 'admin'::text, 'supervisor'::text])))",
      "validated": true
    },
    {
      "tab": "profiles",
      "name": "profiles_status_check",
      "kind": "c",
      "def": "CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Pending'::text])))",
      "validated": true
    }
  ],
  "retainedAcademicYearGuardBody": "begin\n if exists(select 1 from public.interns where academic_year_id=old.id)\n   or exists(select 1 from public.attendance_logs where academic_year_id=old.id)\n   or exists(select 1 from public.attendance_exceptions where academic_year_id=old.id)\n   or exists(select 1 from public.evaluations where academic_year_id=old.id)\n   or exists(select 1 from public.documents where academic_year_id=old.id)\n then raise exception 'Academic year is in use by assignments or historical records; retain it for history' using errcode='23503'; end if;\n return old;\nend"
}
$insync_manifest$::jsonb);

-- M01 ownership/security preflight, generalized to supported intermediate installs.
DO $preflight$
DECLARE m jsonb; r record; t text; cols text; populated boolean;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 IF current_user <> 'postgres' OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'INSync requires the reviewed postgres SQL operator with trusted ownership'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated')
 THEN RAISE EXCEPTION 'Supabase anon/authenticated roles required; do not manufacture provider roles'; END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls))
 OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE (rolsuper OR rolbypassrls)
  AND (pg_catalog.pg_has_role('anon',oid,'MEMBER') OR pg_catalog.pg_has_role('authenticated',oid,'MEMBER')))
 THEN RAISE EXCEPTION 'API roles have trusted privileges: inspect role membership before updating'; END IF;
 IF pg_catalog.to_regclass('auth.users') IS NULL OR pg_catalog.to_regclass('storage.objects') IS NULL OR pg_catalog.to_regclass('storage.buckets') IS NULL
 THEN RAISE EXCEPTION 'Real Supabase Auth/Storage catalog required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Provider Storage object RLS is disabled: restore reviewed provider configuration before updating'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='storage.objects'::regclass AND attname='metadata' AND atttypid='jsonb'::regtype AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Inspect provider storage.objects.metadata JSONB size/mimetype contract (M08/M10)'; END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='documents')
 THEN RAISE EXCEPTION 'Missing documents bucket: inspect Storage configuration; create the reviewed private 10 MiB PDF/JPEG/PNG bucket using the provider'; END IF;
 FOR t IN SELECT jsonb_array_elements_text(m->'baseTables') LOOP
  IF pg_catalog.to_regclass(format('public.%I',t)) IS NULL
  THEN RAISE EXCEPTION 'Missing baseline public.%: restore/reconcile the existing 12-table catalog. Do not run initial_schema.sql on existing accounts',t; END IF;
 END LOOP;
 -- Stable lock order; maintenance window prevents live writes/DDL during verification.
 FOR t IN SELECT jsonb_array_elements_text(m->'tables') ORDER BY 1 LOOP
  IF pg_catalog.to_regclass(format('public.%I',t)) IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=pg_catalog.to_regclass(format('public.%I',t)) AND relkind='r' AND relowner='postgres'::regrole AND NOT relispartition AND NOT relforcerowsecurity)
   THEN RAISE EXCEPTION 'Unsupported ownership/table kind/forced RLS on public.%: review manually',t; END IF;
   EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
  END IF;
 END LOOP;
 LOCK TABLE auth.users,storage.objects,storage.buckets IN SHARE ROW EXCLUSIVE MODE;
 FOR r IN SELECT n.nspname,c.relname,t.tgname,t.oid AS trigger_oid FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal
  AND ((n.nspname='public' AND m->'tables' ? c.relname) OR (n.nspname='auth' AND c.relname='users')) LOOP
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'triggers') e WHERE e->>'schema'=r.nspname AND e->>'tab'=r.relname AND e->>'name'=r.tgname)
  THEN
   -- Preserve ONLY the complete inspected retention contract. Matching a name
   -- or a prefix alone is never sufficient. No trigger/function/grant is altered.
   IF r.nspname='public' AND r.relname='academic_years' AND r.tgname='m11_retain_year'
    AND EXISTS (
     SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_catalog.pg_language l ON l.oid=p.prolang
     WHERE t.oid=r.trigger_oid AND t.tgtype=11 AND t.tgenabled='O' AND t.tgnargs=0
      AND t.tgattr=''::int2vector AND t.tgqual IS NULL AND t.tgconstraint=0
      AND NOT t.tgdeferrable AND NOT t.tginitdeferred AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
      AND n.nspname='public' AND p.proname='guard_academic_year_delete'
      AND p.proowner='postgres'::regrole AND p.prokind='f' AND p.pronargs=0
      AND p.prorettype='trigger'::regtype AND NOT p.proretset AND NOT p.prosecdef
      AND NOT p.proisstrict AND NOT p.proleakproof AND p.provolatile='v' AND p.proparallel='u'
      AND l.lanname='plpgsql' AND p.proconfig=ARRAY['search_path=pg_catalog, public']
      AND regexp_replace(p.prosrc,'[[:space:]]','','g')=regexp_replace(m->>'retainedAcademicYearGuardBody','[[:space:]]','','g')
    ) THEN
    INSERT INTO pg_temp.insync_retained_trigger_contract
     SELECT t.tgrelid,t.tgname,pg_catalog.pg_get_triggerdef(t.oid),p.oid,
      pg_catalog.pg_get_functiondef(p.oid),p.proacl::text,t.tgenabled
     FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid WHERE t.oid=r.trigger_oid;
    CONTINUE;
   END IF;
   RAISE EXCEPTION 'Unexpected trigger %.%.%: inspect before updating',r.nspname,r.relname,r.tgname
   USING DETAIL='This trigger is not defined in the reviewed repository catalog. Its name alone cannot establish compatible behavior.',
    HINT='Run supabase/inspection/05_consolidated_trigger_compatibility.sql and review the trigger and function definitions. Do not drop or disable it, or bypass this guard.';
  END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created'
  AND tgfoid=pg_catalog.to_regprocedure('public.handle_new_user()') AND tgenabled IN ('O','A'))
 THEN RAISE EXCEPTION 'Expected active Auth signup trigger missing: reconcile operator setup first'; END IF;
 FOR r IN SELECT p.*,p.oid::regprocedure::text AS identity FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' LOOP
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(m->'functions') e WHERE e->>'name'=r.proname) THEN
   IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'functions') e WHERE e->>'identity'=r.identity)
   THEN RAISE EXCEPTION 'Unexpected overload %: inventory callers/dependencies; no function will be dropped',r.identity; END IF;
   IF r.proowner <> 'postgres'::regrole OR r.prokind <> 'f' THEN RAISE EXCEPTION 'Unexpected owner/routine kind on %',r.identity; END IF;
   IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'functions') e WHERE e->>'identity'=r.identity
    AND e->>'result'=pg_catalog.pg_get_function_result(r.oid)
    AND (e->'names'='null'::jsonb OR e->'names'=to_jsonb(r.proargnames))
    AND e->'modes'=coalesce(to_jsonb(r.proargmodes::text[]),'null'::jsonb))
   THEN RAISE EXCEPTION 'Incompatible return/argument contract %: plan a dependency-aware transition, no DROP/CASCADE attempted',r.identity; END IF;
  ELSIF r.prosecdef AND (pg_catalog.has_function_privilege('anon',r.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',r.oid,'EXECUTE'))
  THEN RAISE EXCEPTION 'Unexpected exposed SECURITY DEFINER %: review before updating',r.identity; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m')
  AND (pg_catalog.has_table_privilege('anon',c.oid,'SELECT') OR pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT')))
 THEN RAISE EXCEPTION 'Unexpected exposed public view: inspect permissions/dependencies'; END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects' AND p.permissive='RESTRICTIVE'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'policies') e WHERE e->>'schema'='storage' AND e->>'name'=p.policyname))
 THEN RAISE EXCEPTION 'Unexpected restrictive Storage policy: review provider/other-bucket behavior'; END IF;
 -- Inspect ALL existing column definitions; do not treat IF NOT EXISTS as repair.
 FOR r IN SELECT c.relname AS tab,a.attname AS name,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,
  pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS def,a.attgenerated,a.attidentity
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
  WHERE n.nspname='public' AND m->'tables' ? c.relname AND a.attnum>0 AND NOT a.attisdropped LOOP
  IF r.attgenerated<>'' OR r.attidentity<>'' OR NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements((m->'baseColumns')||(m->'columns')) e WHERE e->>'tab'=r.tab AND e->>'name'=r.name
    AND e->>'type'=r.type AND (e->>'required')::boolean=r.required AND e->>'def' IS NOT DISTINCT FROM r.def)
  THEN RAISE EXCEPTION 'Incompatible column public.%.% (type/nullability/default/generated): inspect and propose a safe conversion',r.tab,r.name
   USING HINT='For existing academic_year_id history columns, run supabase/inspection/05_consolidated_trigger_compatibility.sql. Their type, defaults, foreign keys, indexes and dependent routines require review; none will be dropped or guessed.';
  END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'baseColumns') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND attname=r.e->>'name' AND NOT attisdropped)
  THEN RAISE EXCEPTION 'Missing baseline column public.%.%: restore/reconcile explicitly',r.e->>'tab',r.e->>'name'; END IF;
 END LOOP;
 -- A populated, partially defined evidence table needs an explicit transition:
 -- defaults must not invent version identities, review statuses or timestamps.
 FOR r IN SELECT e FROM jsonb_array_elements(m->'columns') e LOOP
  IF pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND attname=r.e->>'name' AND NOT attisdropped) THEN
   IF NOT m->'baseTables' ? (r.e->>'tab') THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',r.e->>'tab') INTO populated;
    IF populated THEN RAISE EXCEPTION 'Incompatible populated partial evidence table public.% missing %: prepare a reviewed transition; no identity/status/timestamp backfill',r.e->>'tab',r.e->>'name'; END IF;
   ELSIF r.e->>'tab'='documents' AND r.e->>'name' IN ('upload_version','review_revision') THEN
    FOREACH t IN ARRAY ARRAY['document_versions','document_review_events'] LOOP
     IF pg_catalog.to_regclass(format('public.%I',t)) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',t) INTO populated;
      IF populated THEN RAISE EXCEPTION 'Incompatible current document version contract: missing documents.% with existing % history; no version-zero backfill',r.e->>'name',t; END IF;
     END IF;
    END LOOP;
   END IF;
  END IF;
 END LOOP;
 FOR r IN SELECT c.relname AS tab,x.conname AS name,regexp_replace(pg_catalog.pg_get_constraintdef(x.oid),' NOT VALID$','') AS def
  FROM pg_catalog.pg_constraint x JOIN pg_catalog.pg_class c ON c.oid=x.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND m->'tables' ? c.relname AND x.contype<>'t' LOOP
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements((m->'baseConstraints')||(m->'constraints')) e WHERE e->>'tab'=r.tab AND e->>'name'=r.name AND e->>'def'=r.def)
  THEN RAISE EXCEPTION 'Incompatible/unreviewed constraint public.%.%: inspect definition, no constraint is dropped',r.tab,r.name; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'baseConstraints') e WHERE e->>'kind'<>'c' LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND conname=r.e->>'name' AND convalidated)
  THEN RAISE EXCEPTION 'Missing/unvalidated baseline constraint public.%.%: reconcile baseline before updating',r.e->>'tab',r.e->>'name'; END IF;
 END LOOP;
 -- M03/M07/M08 hard gates: no guessed deduplication, relationships or evidence.
 IF EXISTS (SELECT 1 FROM public.attendance_logs GROUP BY intern_id,log_date HAVING count(*)>1)
 OR EXISTS (SELECT 1 FROM public.attendance_logs WHERE time_out IS NULL GROUP BY intern_id HAVING count(*)>1)
 OR EXISTS (SELECT 1 FROM public.attendance_exceptions WHERE status='Pending' GROUP BY intern_id,log_date HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Duplicate attendance daily/open/Pending identities: run inspection/03_phase2_attendance.sql and review per-record repairs'; END IF;
 IF EXISTS (SELECT 1 FROM public.documents GROUP BY intern_id,doc_type HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Duplicate clearance requirement identity: run inspection/04_phase4_domain.sql and preserve evidence in a reviewed repair'; END IF;
 IF EXISTS (SELECT 1 FROM public.profiles p LEFT JOIN public.interns i ON i.id=p.id LEFT JOIN public.profiles staff ON staff.id=i.instructor_id
  WHERE (p.role='intern' AND i.id IS NULL) OR (i.instructor_id IS NOT NULL AND (p.role<>'intern' OR staff.role IS DISTINCT FROM 'instructor' OR staff.status IS DISTINCT FROM 'Active')))
 THEN RAISE EXCEPTION 'Legacy role/assignment anomaly: review inspection/04_phase4_domain.sql; no account or assignment repaired'; END IF;
 IF (SELECT count(*) FROM public.academic_years WHERE is_current)>1
 THEN RAISE EXCEPTION 'Conflicting current academic years: an authorized operator must review and explicitly choose one active year; no automatic repair'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='academic_years' AND column_name='archived_at') THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.academic_years WHERE is_current AND archived_at IS NOT NULL)' INTO populated;
  IF populated THEN RAISE EXCEPTION 'Incompatible archived current year: review and choose an active year before updating'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='legacy_evidence') THEN
  EXECUTE $check$SELECT EXISTS(SELECT 1 FROM public.documents d WHERE legacy_evidence IS NOT NULL AND (
   legacy_evidence->>'id' IS DISTINCT FROM d.id::text OR legacy_evidence->>'intern_id' IS DISTINCT FROM d.intern_id::text
   OR legacy_evidence->>'upload_version' IS DISTINCT FROM '0' OR legacy_evidence->>'provenance' IS DISTINCT FROM 'stored-legacy-metadata-unverified'))$check$ INTO populated;
  IF populated THEN RAISE EXCEPTION 'Incompatible legacy metadata snapshot: inspect original evidence; no reconstruction'; END IF;
 END IF;
END $preflight$;

-- M01/M02/M03/M06/M08/M10/M11 additive final columns and six evidence tables.
-- Missing old baseline tables are a prerequisite failure, never silently recreated.
DO $columns$
DECLARE m jsonb; t text; r record;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 FOR t IN SELECT jsonb_array_elements_text(m->'tables') LOOP
  IF pg_catalog.to_regclass(format('public.%I',t)) IS NULL THEN EXECUTE format('CREATE TABLE public.%I ()',t); END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'columns') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND attname=r.e->>'name' AND NOT attisdropped) THEN
   EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s%s%s',r.e->>'tab',r.e->>'name',r.e->>'type',
    CASE WHEN r.e->>'def' IS NULL THEN '' ELSE ' DEFAULT '||(r.e->>'def') END,
    CASE WHEN (r.e->>'required')::boolean THEN ' NOT NULL' ELSE '' END);
  END IF;
 END LOOP;
END $columns$;

-- Final function bodies only: superseded M01/M02/M03 and M08 helpers are folded
-- into their latest definitions. Identity-preserving CREATE OR REPLACE retains
-- dependent objects; preflight rejects unexpected overloads/incompatible returns.
-- Latest source: migrations/M12_handover_workflows.sql; public.admin_add_requirement(uuid,text,uuid)
CREATE OR REPLACE FUNCTION public.admin_add_requirement(p_intern_id uuid, p_name text, p_request_id uuid)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE r public.documents;
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active Admin required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 IF p_request_id IS NULL OR nullif(btrim(p_name),'') IS NULL OR length(btrim(p_name))>200
 THEN RAISE EXCEPTION 'Requirement name (1-200 characters) and retry identity required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_intern_id AND role='intern')
  OR NOT EXISTS (SELECT 1 FROM public.interns WHERE id=p_intern_id)
 THEN RAISE EXCEPTION 'Current Intern account and extension required'; END IF;
 SELECT * INTO r FROM public.documents WHERE id=p_request_id;
 IF FOUND THEN
  IF r.intern_id IS DISTINCT FROM p_intern_id OR r.name IS DISTINCT FROM btrim(p_name)
   OR r.doc_type IS DISTINCT FROM 'custom:'||p_request_id::text
  THEN RAISE EXCEPTION 'Requirement retry identity reused with different content' USING errcode='40001'; END IF;
  RETURN r;
 END IF;
 INSERT INTO public.documents(id,intern_id,doc_type,name)
 VALUES(p_request_id,p_intern_id,'custom:'||p_request_id::text,btrim(p_name)) RETURNING * INTO r;
 RETURN r;
END $function$
;
-- Latest source: migrations/M11_admin_history.sql; public.admin_archive_master(text,uuid,bigint)
CREATE OR REPLACE FUNCTION public.admin_archive_master(p_table text, p_id uuid, p_expected_references bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare impact jsonb; entry jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 impact:=public.admin_master_impact(p_table,p_id);
 if not (impact->>'can_archive')::boolean then raise exception 'Already archived or current academic year; refresh'; end if;
 if (impact->>'references')::bigint is distinct from p_expected_references then raise exception 'Reference impact changed; inspect again' using errcode='40001'; end if;
 execute format('update public.%I set archived_at=clock_timestamp() where id=$1 and archived_at is null returning to_jsonb(%I)',p_table,p_table)
  into entry using p_id;
 if entry is null then raise exception 'Entry changed; refresh' using errcode='40001'; end if;
 return jsonb_build_object('id',p_id,'entry',entry,'references',impact->'references');
end $function$
;
-- Latest source: migrations/M15_supervisor_evaluations.sql; public.admin_master_impact(text,uuid)
CREATE OR REPLACE FUNCTION public.admin_master_impact(p_table text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r jsonb; refs bigint;
begin
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 if p_table not in ('companies','course_sections','academic_years') or p_table is null then raise exception 'Unsupported master table'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',p_table) into r using p_id;
 if r is null then raise exception 'Entry missing; refresh' using errcode='40001'; end if;
 if p_table='companies' then select (select count(*) from public.interns where company_id=p_id)+(select count(*) from public.profiles where supervisor_company_id=p_id)+(select count(*) from public.supervisor_assignments where company_id=p_id)+(select count(*) from public.supervisor_evaluations where company_id=p_id) into refs;
 elsif p_table='course_sections' then select count(*) into refs from public.interns where section_id=p_id;
 else refs:=0; end if;
 return jsonb_build_object('id',p_id,'entry',r,'references',refs,'can_archive',r->>'archived_at' is null and coalesce((r->>'is_current')::boolean,false)=false);
end $function$
;
-- Latest source: migrations/M16_evaluation_controls.sql; public.admin_reroute_evaluation(uuid,uuid,text,integer)
CREATE OR REPLACE FUNCTION public.admin_reroute_evaluation(p_id uuid, p_coordinator_id uuid, p_reason text, p_expected_revision integer)
 RETURNS public.evaluation_reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.evaluation_reviews; s public.supervisor_evaluations;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 select * into r from public.evaluation_reviews where id=p_id for update;
 select * into s from public.supervisor_evaluations where id=p_id;
 if r.id is null or r.status='Published to Intern' or r.revision is distinct from p_expected_revision then raise exception 'Unpublished current review required'; end if;
 if not exists(select 1 from public.interns i join public.profiles p on p.id=i.instructor_id join public.profiles student on student.id=i.id
 where i.id=s.intern_id and i.company_id=s.company_id and i.instructor_id=p_coordinator_id and p.role='instructor' and p.status='Active' and student.role='intern' and student.status='Active')
 then raise exception 'Current eligible Coordinator and original company required'; end if;
 insert into public.evaluation_routing_events(source_id,previous_coordinator_id,coordinator_id,actor_id,reason) values(p_id,r.coordinator_id,p_coordinator_id,auth.uid(),p_reason);
 update public.evaluation_reviews set coordinator_id=p_coordinator_id,revision=revision+1,summary='',strengths='',improvements='',guidance='',criteria=s.criteria,adjustment_reason='',adjustment_reasons='{}',feedback_mode=null,feedback_choices=null,additional_remarks='',written_feedback=null,legacy_adjustment_reason=null,status='Submitted to Coordinator' where id=p_id returning * into r;
 return r;
end $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.admin_reroute_logbook(uuid,uuid,integer,integer,text)
CREATE OR REPLACE FUNCTION public.admin_reroute_logbook(p_id uuid, p_coordinator uuid, p_version integer, p_revision integer, p_reason text)
 RETURNS public.logbook_submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.logbook_submissions; v public.logbook_versions; previous jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 select * into s from public.logbook_submissions where id=p_id for update;
 select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version;
 if s.id is null or v.status='Verified' or v.version is distinct from p_version or v.revision is distinct from p_revision or p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'Current unresolved submission and meaningful rerouting reason required'; end if;
 if not exists(select 1 from public.interns i join public.profiles p on p.id=i.instructor_id join public.profiles student on student.id=i.id where i.id=s.intern_id and i.company_id=s.company_id and i.instructor_id=p_coordinator and p.role='instructor' and p.status='Active' and student.role='intern' and student.status='Active') then raise exception 'Recipient must be current eligible assigned Coordinator in the preserved company'; end if;
 previous:=to_jsonb(s);
 update public.logbook_submissions set coordinator_id=p_coordinator where id=p_id returning * into s;
 -- Invalidate any open review, without rewriting original receiving identity.
 update public.logbook_versions set revision=revision+1 where submission_id=p_id and version=v.version;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'admin_rerouted',previous,to_jsonb(s)||jsonb_build_object('reason',btrim(p_reason)));
 return s;
end $function$
;
-- Latest source: migrations/M07_account_lifecycle.sql; public.admin_set_assignment(uuid,uuid,uuid,uuid,numeric)
CREATE OR REPLACE FUNCTION public.admin_set_assignment(p_id uuid, p_instructor_id uuid, p_company_id uuid, p_section_id uuid, p_required_hours numeric)
 RETURNS public.interns
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.interns;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for share;
 if not public.valid_required_hours(p_required_hours) then raise exception 'Required hours must be >0, <=10000, at most two decimal places'; end if;
 if not exists(select 1 from public.profiles where id=p_id and role='intern') then raise exception 'Current intern required'; end if;
 if p_instructor_id is not null and not exists(select 1 from public.profiles where id=p_instructor_id and role='instructor' and status='Active')
 then raise exception 'Active instructor required'; end if;
 update public.interns set instructor_id=p_instructor_id,company_id=p_company_id,section_id=p_section_id,required_hours=p_required_hours
 where id=p_id returning * into r;
 if not found then raise exception 'Intern extension not found; refresh' using errcode='40001'; end if;
 return r;
end $function$
;
-- Latest source: migrations/M12_handover_workflows.sql; public.admin_set_current_year(uuid,uuid)
CREATE OR REPLACE FUNCTION public.admin_set_current_year(p_id uuid, p_expected_current uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE chosen public.academic_years; previous uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active Admin required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 SELECT * INTO chosen FROM public.academic_years WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR chosen.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Active academic year required; refresh' USING errcode='40001'; END IF;
 SELECT id INTO previous FROM public.academic_years WHERE is_current;
 IF previous=p_id THEN RETURN jsonb_build_object('id',p_id,'year',to_jsonb(chosen),'previous_id',previous); END IF;
 IF previous IS DISTINCT FROM p_expected_current THEN RAISE EXCEPTION 'Current year changed; refresh before confirming' USING errcode='40001'; END IF;
 UPDATE public.academic_years SET is_current=false WHERE is_current;
 UPDATE public.academic_years SET is_current=true WHERE id=p_id RETURNING * INTO chosen;
 RETURN jsonb_build_object('id',p_id,'year',to_jsonb(chosen),'previous_id',previous);
END $function$
;
-- Latest source: migrations/M15_supervisor_evaluations.sql; public.admin_set_supervision(uuid,uuid,boolean)
CREATE OR REPLACE FUNCTION public.admin_set_supervision(p_supervisor_id uuid, p_intern_id uuid, p_assigned boolean)
 RETURNS public.supervisor_assignments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.supervisor_assignments; company uuid;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 if p_assigned is null then raise exception 'Assignment decision required'; end if;
 select * into r from public.supervisor_assignments where supervisor_id=p_supervisor_id and intern_id=p_intern_id and ended_at is null;
 if not p_assigned then
  if not found then raise exception 'Current assignment not found; refresh'; end if;
  update public.supervisor_assignments set ended_at=clock_timestamp(),ended_by=auth.uid() where id=r.id returning * into r; return r;
 end if;
 select supervisor_company_id into company from public.profiles where id=p_supervisor_id and role='supervisor' and status='Active';
 if company is null or not exists(select 1 from public.interns i join public.profiles p on p.id=i.id
 where i.id=p_intern_id and i.company_id=company and p.role='intern' and p.status='Active')
 or not exists(select 1 from public.companies where id=company and archived_at is null)
 then raise exception 'Active Supervisor and Intern in the same available company required'; end if;
 if r.id is not null then return r; end if;
 insert into public.supervisor_assignments(supervisor_id,intern_id,company_id,assigned_by) values(p_supervisor_id,p_intern_id,company,auth.uid()) returning * into r; return r;
end $function$
;
-- Latest source: migrations/M15_supervisor_evaluations.sql; public.admin_update_account(uuid,jsonb)
CREATE OR REPLACE FUNCTION public.admin_update_account(p_id uuid, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare p public.profiles; i public.interns; k text; next_role text; next_status text;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for share;
 if jsonb_typeof(p_patch) is distinct from 'object' or p_patch='{}'::jsonb then raise exception 'Account patch required'; end if;
 for k in select jsonb_object_keys(p_patch) loop
  if k not in ('full_name','role','status','company_id') then raise exception 'Unsupported account field'; end if;
 end loop;
 select * into p from public.profiles where id=p_id for update;
 if not found then raise exception 'Account not found; refresh' using errcode='40001'; end if;
 next_role:=case when p_patch?'role' then p_patch->>'role' else p.role end;
 next_status:=case when p_patch?'status' then p_patch->>'status' else p.status end;
 if next_role is null or next_role not in ('intern','instructor','admin','supervisor') or next_status is null or next_status not in ('Pending','Inactive','Active')
 then raise exception 'Valid role/status required'; end if;
 if p_patch?'full_name' and (jsonb_typeof(p_patch->'full_name') is distinct from 'string' or nullif(btrim(p_patch->>'full_name'),'') is null or length(p_patch->>'full_name')>200)
 then raise exception 'Name required, <=200 characters'; end if;
 if (next_role<>'instructor' or next_status<>'Active') and exists(select 1 from public.interns where instructor_id=p_id)
 then raise exception 'Reassign or explicitly unassign interns first'; end if;
 if next_role<>'intern' and exists(select 1 from public.interns where id=p_id and instructor_id is not null)
 then raise exception 'Explicitly unassign this intern before changing role'; end if;
 if next_role='intern' then
   insert into public.interns(id) values(p_id) on conflict(id) do nothing;
   if p_patch?'company_id' then
    update public.interns set company_id=(p_patch->>'company_id')::uuid where id=p_id;
   end if;
 elsif next_role='supervisor' then
   if not exists(select 1 from public.companies where id=coalesce((p_patch->>'company_id')::uuid,p.supervisor_company_id) and archived_at is null) then raise exception 'Select an available Supervisor company'; end if;
 elsif p_patch?'company_id' then raise exception 'Company applies to Intern or Supervisor accounts'; end if;
 update public.profiles set full_name=case when p_patch?'full_name' then btrim(p_patch->>'full_name') else full_name end,
   role=next_role,status=next_status,supervisor_company_id=case when next_role='supervisor' then case when p_patch?'company_id' then (p_patch->>'company_id')::uuid else supervisor_company_id end else null end where id=p_id returning * into p;
 select * into i from public.interns where id=p_id;
 -- Deferred triggers also enforce trusted SQL changes; errors still abort RPC.
 return jsonb_build_object('id',p.id,'profile',to_jsonb(p),'intern',case when i.id is null then null else to_jsonb(i) end);
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.assigned_intern(uuid)
CREATE OR REPLACE FUNCTION public.assigned_intern(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select coalesce(public.current_role()='instructor' and exists(
     select 1 from public.interns i join public.profiles p on p.id=i.id
     where i.id=p_id and i.instructor_id=auth.uid() and p.role='intern'),false) $function$
;
-- Latest source: migrations/M08_document_versions.sql; public.attach_standard_docs(uuid)
CREATE OR REPLACE FUNCTION public.attach_standard_docs(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_id and role='intern') then raise exception 'Current intern required'; end if;
 insert into public.documents(intern_id,doc_type,name)
 select p_id,t,k from (values('moa','Memorandum of Agreement (MOA)'),('endorsement','Endorsement Letter'),
   ('consent','Parent / Guardian Consent Form'),('medical','Medical Certificate')) x(t,k)
 on conflict(intern_id,doc_type) do nothing;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.doc_type),'[]'::jsonb) into result from public.documents d where intern_id=p_id;
 return jsonb_build_object('id',p_id,'documents',result);
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.attendance_sheet_access(uuid)
CREATE OR REPLACE FUNCTION public.attendance_sheet_access(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare e public.attendance_sheet_evidence;
begin
 select * into e from public.attendance_sheet_evidence where id=p_id;
 if not found or e.abandoned_at is not null or not public.attendance_sheet_object_allowed(e.file_path,'read') then raise exception 'Authorized sheet review required' using errcode='42501'; end if;
 return jsonb_build_object('bucket','attendance-evidence','path',e.file_path,'name',e.file_name,'mime',e.mime_type);
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.attendance_sheet_context(uuid)
CREATE OR REPLACE FUNCTION public.attendance_sheet_context(p_intern uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare result jsonb;
begin
 if not public.can_read_intern(p_intern) then raise exception 'Own or assigned Intern required' using errcode='42501'; end if;
 select jsonb_build_object('intern_id',i.id,'intern_name',p.full_name,'identifier',coalesce(nullif(p.student_id,''),p.id::text),
 'current_company_id',i.company_id,'companies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)
 from public.companies c where public.manual_company_allowed(i.id,c.id)),'[]'::jsonb)) into result
 from public.interns i join public.profiles p on p.id=i.id where i.id=p_intern;
 if result is null then raise exception 'Intern record unavailable'; end if;
 return result;
end $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.attendance_sheet_object_allowed(text,text)
CREATE OR REPLACE FUNCTION public.attendance_sheet_object_allowed(p_path text, p_operation text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare e public.attendance_sheet_evidence;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into e from public.attendance_sheet_evidence where file_path=p_path;
 if not found then return false; end if;
 -- DELETE predicates also require SELECT visibility. Abandoned, unreferenced
 -- uploads remain visible to their still-authorized uploader for byte cleanup.
 if p_operation='read' then return public.can_read_attendance_sheet(e.id) and ((e.abandoned_at is null and e.ready_at is not null) or e.uploaded_by=auth.uid()); end if;
 if (public.current_role() is distinct from 'instructor' and not (public.current_role()='supervisor' and e.logbook_submission_id is not null)) or e.uploaded_by<>auth.uid() then return false; end if;
 if p_operation='insert' and e.logbook_submission_id is not null then
 return public.supervises_intern(e.participant_ids[1]) and exists(select 1 from public.logbook_submissions s join public.logbook_versions v on v.submission_id=s.id and v.version=s.current_version where s.id=e.logbook_submission_id and s.supervisor_id=auth.uid() and exists(select 1 from public.supervisor_assignments a where a.id=s.assignment_id and a.ended_at is null) and v.status in ('Draft','Returned for Correction')) and e.ready_at is null and e.abandoned_at is null and e.expires_at>clock_timestamp(); end if;
 if p_operation='insert' then return public.can_read_attendance_sheet(e.id) and e.ready_at is null and e.abandoned_at is null and e.expires_at>clock_timestamp(); end if;
 if p_operation='delete' then return e.abandoned_at is not null and e.committed_at is null
 and not exists(select 1 from public.attendance_logs where manual_evidence_id=e.id)
 and not exists(select 1 from public.manual_attendance_events where before_values->>'manual_evidence_id'=e.id::text or after_values->>'manual_evidence_id'=e.id::text); end if;
 return false;
end $function$
;
-- Latest source: migrations/M11_admin_history.sql; public.audit_history(text,text,text,date,date,integer,integer)
CREATE OR REPLACE FUNCTION public.audit_history(p_actor text DEFAULT ''::text, p_action text DEFAULT ''::text, p_category text DEFAULT ''::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_page integer DEFAULT 1, p_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'Active Admin required' using errcode='42501'; end if;
 if p_size is null or p_size not in (10,25,50,100) or p_page is null or p_page<1 then raise exception 'Valid page and page size required'; end if;
 if p_from>p_to then raise exception 'Start date must not exceed end date'; end if;
 if length(p_actor)>200 or length(p_action)>200 or length(p_category)>100 then raise exception 'Filter too long'; end if;
 with filtered as materialized (
  select l.* from public.audit_logs l where
   (coalesce(p_actor,'')='' or strpos(lower(coalesce(l.actor_name,'')),lower(p_actor))>0 or l.actor_id::text=p_actor)
   and (coalesce(p_action,'')='' or strpos(lower(coalesce(l.action,'')),lower(p_action))>0)
   and (coalesce(p_category,'')='' or l.event_data->>'table'=p_category)
   and (p_from is null or l.created_at >= p_from::timestamp at time zone 'Asia/Manila')
   and (p_to is null or l.created_at < (p_to+1)::timestamp at time zone 'Asia/Manila')
 ), counted as (select count(*) n from filtered), paging as (
  select n,greatest(1,ceil(n::numeric/p_size)::integer) pages,
   least(p_page,greatest(1,ceil(n::numeric/p_size)::integer)) page from counted
 ), page_rows as (
  select * from filtered order by created_at desc,id desc limit p_size offset (select (page-1)::bigint*p_size from paging)
 ) select jsonb_build_object('id','audit-history','total',n,'pages',pages,'page',page,'size',p_size,
  'rows',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from page_rows x),'[]'::jsonb)) into result from paging;
 return result;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.bind_announcement()
CREATE OR REPLACE FUNCTION public.bind_announcement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if public.current_role() not in ('admin','instructor') or public.current_role() is null
     or new.instructor_id is distinct from auth.uid() then
    raise exception 'Active staff author required' using errcode='42501';
  end if;
  if new.recipient_ids is not null then raise exception 'Audience is server-derived'; end if;
  if new.target_intern_id is null then
    if new.target <> 'All Interns' then raise exception 'Recipient UUID required'; end if;
    select coalesce(array_agg(i.id),array[]::uuid[]) into new.recipient_ids
    from public.interns i join public.profiles p on p.id=i.id
    where i.instructor_id=auth.uid() and p.role='intern' and p.status='Active';
    if cardinality(new.recipient_ids)=0 then raise exception 'No active assigned recipients'; end if;
  else
    if new.target='All Interns' or not exists(select 1 from public.interns i join public.profiles p on p.id=i.id
      where i.id=new.target_intern_id and i.instructor_id=auth.uid() and p.role='intern' and p.status='Active') then
      raise exception 'Recipient must be an active assigned intern' using errcode='42501';
    end if;
    new.target := 'Personal'; -- Display names are not identity or privacy rules.
    new.recipient_ids := array[new.target_intern_id];
  end if;
  return new;
end $function$
;
-- Latest source: migrations/M12_handover_workflows.sql; public.can_delete_staged_document(text)
CREATE OR REPLACE FUNCTION public.can_delete_staged_document(p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 RETURN public.owns_intern(auth.uid()) AND (
  EXISTS(SELECT 1 FROM public.document_versions WHERE file_path=p_path AND intern_id=auth.uid() AND committed_at IS NULL AND abandoned_at IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id
   WHERE f.file_path=p_path AND f.intern_id=auth.uid() AND v.committed_at IS NULL AND v.abandoned_at IS NOT NULL))
  AND NOT EXISTS(SELECT 1 FROM public.documents WHERE file_path=p_path)
  AND NOT EXISTS(SELECT 1 FROM public.document_versions WHERE file_path=p_path AND committed_at IS NOT NULL)
  AND NOT EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id WHERE f.file_path=p_path AND v.committed_at IS NOT NULL)
  AND NOT EXISTS(SELECT 1 FROM public.documents WHERE legacy_evidence->>'file_path'=p_path);
END $function$
;
-- Latest source: migrations/M10_flexible_submissions.sql; public.can_insert_reserved_document(text)
CREATE OR REPLACE FUNCTION public.can_insert_reserved_document(p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 perform pg_advisory_xact_lock(404,1);
 return public.owns_intern(auth.uid()) and (
  exists(select 1 from public.document_versions v join public.documents d on d.id=v.document_id
   where v.file_path=p_path and v.intern_id=auth.uid() and v.committed_at is null and v.abandoned_at is null
    and v.expires_at>clock_timestamp() and v.expected_version=d.upload_version)
  or exists(select 1 from public.submission_files f join public.submission_versions v on v.id=f.version_id join public.submissions s on s.id=v.submission_id
   where f.file_path=p_path and f.intern_id=auth.uid() and v.committed_at is null and v.abandoned_at is null
    and v.expires_at>clock_timestamp() and v.expected_version=s.current_version and v.expected_revision=s.review_revision));
end $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.can_read_attendance_sheet(uuid)
CREATE OR REPLACE FUNCTION public.can_read_attendance_sheet(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select exists(select 1 from public.attendance_sheet_evidence e where e.id=p_id and
 case when e.logbook_submission_id is not null then public.can_read_logbook_evidence(e.id) else
 public.is_admin() or (public.current_role()='instructor' and not exists(select 1 from unnest(e.participant_ids) i where not public.assigned_intern(i))) end)
$function$
;
-- Latest source: migrations/M12_handover_workflows.sql; public.can_read_document_object(text)
CREATE OR REPLACE FUNCTION public.can_read_document_object(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 SELECT public.is_active() AND ((public.current_role()='intern' AND split_part(p_path,'/',1)=auth.uid()::text) OR public.is_admin()
  OR EXISTS(SELECT 1 FROM public.documents d WHERE d.file_path=p_path AND split_part(p_path,'/',1)=d.intern_id::text AND public.assigned_intern(d.intern_id))
  OR EXISTS(SELECT 1 FROM public.document_versions v WHERE v.file_path=p_path AND v.committed_at IS NOT NULL AND public.assigned_intern(v.intern_id))
  OR EXISTS(SELECT 1 FROM public.submission_files f JOIN public.submission_versions v ON v.id=f.version_id
   WHERE f.file_path=p_path AND v.committed_at IS NOT NULL AND public.assigned_intern(f.intern_id))
  OR EXISTS(SELECT 1 FROM public.documents d WHERE d.legacy_evidence->>'file_path'=p_path
   AND split_part(p_path,'/',1)=d.intern_id::text AND d.legacy_evidence->>'intern_id'=d.intern_id::text
   AND d.legacy_evidence->>'id'=d.id::text AND d.legacy_evidence->>'upload_version'='0'
   AND d.legacy_evidence->>'provenance'='stored-legacy-metadata-unverified' AND public.assigned_intern(d.intern_id)))
$function$
;
-- Latest source: migrations/M01_authority.sql; public.can_read_intern(uuid)
CREATE OR REPLACE FUNCTION public.can_read_intern(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select public.can_review(p_id) or public.owns_intern(p_id) $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.can_read_logbook(uuid)
CREATE OR REPLACE FUNCTION public.can_read_logbook(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select public.is_admin() or exists(select 1 from public.logbook_submissions s where s.id=p_id and
 ((public.current_role()='supervisor' and s.supervisor_id=auth.uid()) or
 (public.current_role()='instructor' and s.coordinator_id=auth.uid() and public.assigned_intern(s.intern_id)
 and exists(select 1 from public.interns i join public.profiles p on p.id=i.id where i.id=s.intern_id and i.company_id=s.company_id and p.role='intern' and p.status='Active')
 and exists(select 1 from public.logbook_versions v where v.submission_id=s.id and v.status<>'Draft'))))
$function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.can_read_logbook_evidence(uuid)
CREATE OR REPLACE FUNCTION public.can_read_logbook_evidence(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select exists(select 1 from public.attendance_sheet_evidence e join public.logbook_submissions s on s.id=e.logbook_submission_id where e.id=p_id and
 (public.is_admin() or (public.current_role()='supervisor' and s.supervisor_id=auth.uid()) or
 (public.can_review_logbook(s.id) and exists(select 1 from public.logbook_versions v where v.submission_id=s.id and v.status<>'Draft' and e.id=any(v.evidence_ids)))))
$function$
;
-- Latest source: migrations/M01_authority.sql; public.can_review(uuid)
CREATE OR REPLACE FUNCTION public.can_review(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select public.is_admin() or public.assigned_intern(p_id) $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.can_review_logbook(uuid)
CREATE OR REPLACE FUNCTION public.can_review_logbook(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select public.current_role()='instructor' and exists(select 1 from public.logbook_submissions where id=p_id and coordinator_id=auth.uid()) and public.can_read_logbook(p_id)
$function$
;
-- Latest source: migrations/M15_supervisor_evaluations.sql; public.can_review_source(uuid)
CREATE OR REPLACE FUNCTION public.can_review_source(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select public.is_admin() or exists(select 1 from public.evaluation_reviews r join public.supervisor_evaluations s on s.id=r.id
 join public.interns i on i.id=s.intern_id join public.profiles p on p.id=i.id
 where r.id=p_id and s.status='Submitted to Coordinator' and r.coordinator_id=auth.uid() and public.assigned_intern(s.intern_id)
 and i.company_id=s.company_id and p.role='intern' and p.status='Active')
$function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.cancel_attendance_sheet(uuid)
CREATE OR REPLACE FUNCTION public.cancel_attendance_sheet(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare e public.attendance_sheet_evidence;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into e from public.attendance_sheet_evidence where id=p_id for update;
 if not found or e.uploaded_by<>auth.uid() or (public.current_role() is distinct from 'instructor' and not (public.current_role()='supervisor' and e.logbook_submission_id is not null)) then raise exception 'Own Coordinator upload required' using errcode='42501'; end if;
 if e.committed_at is not null or exists(select 1 from public.attendance_logs where manual_evidence_id=p_id)
 or exists(select 1 from public.manual_attendance_events where before_values->>'manual_evidence_id'=p_id::text or after_values->>'manual_evidence_id'=p_id::text) then raise exception 'Referenced attendance evidence must be preserved'; end if;
 if e.abandoned_at is null then update public.attendance_sheet_evidence set abandoned_at=clock_timestamp() where id=p_id returning * into e; end if;
 return to_jsonb(e)||jsonb_build_object('object_exists',exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path));
end $function$
;
-- Latest source: migrations/M08_document_versions.sql; public.cancel_document_upload(uuid)
CREATE OR REPLACE FUNCTION public.cancel_document_upload(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v public.document_versions; d public.documents;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into v from public.document_versions where id=p_id and intern_id=auth.uid() for update;
 if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned reservation required' using errcode='42501'; end if;
 if v.committed_at is not null then
   select * into d from public.documents where id=v.document_id;
   return jsonb_build_object('id',v.id,'committed',true,'document',to_jsonb(d));
 end if;
 update public.document_versions set abandoned_at=coalesce(abandoned_at,clock_timestamp()) where id=v.id;
 return jsonb_build_object('id',v.id,'committed',false,'path',v.file_path,
   'object_exists',exists(select 1 from storage.objects where bucket_id='documents' and name=v.file_path));
end $function$
;
-- Latest source: migrations/M10_flexible_submissions.sql; public.cancel_submission(uuid)
CREATE OR REPLACE FUNCTION public.cancel_submission(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v public.submission_versions; s public.submissions; paths jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into v from public.submission_versions where id=p_version_id and intern_id=auth.uid() for update;
 if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned reservation required' using errcode='42501'; end if;
 if v.committed_at is not null then
  select * into s from public.submissions where id=v.submission_id;
  return jsonb_build_object('id',v.id,'committed',true,'submission',to_jsonb(s),'version',v.version_no);
 end if;
 update public.submission_versions set abandoned_at=coalesce(abandoned_at,clock_timestamp()) where id=v.id;
 select coalesce(jsonb_agg(jsonb_build_object('path',f.file_path,'object_exists',exists(select 1 from storage.objects where bucket_id='documents' and name=f.file_path)) order by f.ordinal),'[]'::jsonb)
 into paths from public.submission_files f where version_id=v.id;
 return jsonb_build_object('id',v.id,'committed',false,'files',paths);
end $function$
;
-- Latest source: migrations/M07_account_lifecycle.sql; public.check_account_relationships()
CREATE OR REPLACE FUNCTION public.check_account_relationships()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare target uuid; p public.profiles;
begin
 target:=case when tg_op='DELETE' then old.id else new.id end;
 select * into p from public.profiles where id=target;
 if not found then return new; end if;
 if p.role='intern' and not exists(select 1 from public.interns where id=target) then raise exception 'Intern extension required'; end if;
 if (p.role<>'instructor' or p.status<>'Active') and exists(select 1 from public.interns where instructor_id=target)
 then raise exception 'Reassign or explicitly unassign interns before instructor demotion/deactivation'; end if;
 if exists(select 1 from public.interns i left join public.profiles staff on staff.id=i.instructor_id
   where i.id=target and i.instructor_id is not null
     and (p.role<>'intern' or staff.role is distinct from 'instructor' or staff.status is distinct from 'Active'))
 then raise exception 'Assignment requires an intern and an Active instructor'; end if;
 return new;
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.check_manual_session(uuid,timestamp with time zone,timestamp with time zone,uuid)
CREATE OR REPLACE FUNCTION public.check_manual_session(p_intern uuid, p_in timestamp with time zone, p_out timestamp with time zone, p_exclude uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 if p_in is null or p_out is null or not isfinite(p_in) or not isfinite(p_out) or p_out<=p_in then raise exception 'Both timestamps are required; Time Out must follow Time In with an explicit end date'; end if;
 if p_out-p_in>interval '16 hours' then raise exception 'Existing attendance limit: a session must be at most 16 hours'; end if;
 if p_in>clock_timestamp() or p_out>clock_timestamp() then raise exception 'Future attendance is not permitted'; end if;
 if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and time_out is null) then raise exception 'Open online attendance conflicts; manual entry cannot close or replace it'; end if;
 if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and clocked_in_at=p_in and clocked_out_at=p_out) then raise exception 'Exact duplicate attendance session'; end if;
 if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and clocked_in_at<p_out and clocked_out_at>p_in) then raise exception 'Attendance overlaps an existing online or manual session'; end if;
 if exists(select 1 from public.attendance_logs where intern_id=p_intern and id is distinct from p_exclude and log_date=(p_in at time zone 'Asia/Manila')::date) then raise exception 'Existing model allows one session per Intern per Manila start date; this date already has attendance'; end if;
end $function$
;
-- Latest source: migrations/M03_attendance_integrity.sql; public.clock_in()
CREATE OR REPLACE FUNCTION public.clock_in()
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_logs; ts timestamptz;
begin
  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,101));
  perform 1 from public.profiles where id=auth.uid() for share;
  if not public.owns_intern(auth.uid()) then raise exception 'Account changed; refresh' using errcode='42501'; end if;
  ts:=clock_timestamp(); -- after serialization, including midnight lock waits
  if exists(select 1 from public.attendance_logs where intern_id=auth.uid()
    and (time_out is null or log_date=(ts at time zone 'Asia/Manila')::date)) then
    raise exception 'Attendance already exists or a session is open; refresh' using errcode='40001';
  end if;
  insert into public.attendance_logs(intern_id,log_date,time_in,clocked_in_at,created_at,verified,verified_by)
  values(auth.uid(),(ts at time zone 'Asia/Manila')::date,(ts at time zone 'Asia/Manila')::time,ts,ts,false,null) returning * into r;
  return r;
end $function$
;
-- Latest source: migrations/M03_attendance_integrity.sql; public.clock_out(uuid,text)
CREATE OR REPLACE FUNCTION public.clock_out(p_id uuid, p_accomplishment text)
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_logs; ts timestamptz; seconds numeric;
begin
  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
  if p_accomplishment is null or length(p_accomplishment)>500 then raise exception 'Accomplishment must be at most 500 characters'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,101));
  perform 1 from public.profiles where id=auth.uid() for share;
  if not public.owns_intern(auth.uid()) then raise exception 'Account changed; refresh' using errcode='42501'; end if;
  select * into r from public.attendance_logs where id=p_id and intern_id=auth.uid() for update;
  if not found or r.time_out is not null or r.verified or r.clocked_in_at is null then
    raise exception 'Open unverified clock session not found; refresh or request correction' using errcode='40001';
  end if;
  ts:=clock_timestamp(); seconds:=extract(epoch from ts-r.clocked_in_at);
  if seconds<=0 or seconds>57600 then raise exception 'Shift duration must be positive and at most 16 hours; request correction'; end if;
  update public.attendance_logs set time_out=(ts at time zone 'Asia/Manila')::time,clocked_out_at=ts,
    hours=seconds/3600,accomplishment=p_accomplishment where id=r.id and time_out is null returning * into r;
  if not found then raise exception 'Session changed; refresh' using errcode='40001'; end if;
  return r;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.correction_instants(date,time without time zone,time without time zone,date)
CREATE OR REPLACE FUNCTION public.correction_instants(p_date date, p_in time without time zone, p_out time without time zone, p_end date)
 RETURNS TABLE(start_at timestamp with time zone, end_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if p_date is null or p_in is null or p_out is null or p_end is null
     or p_end not in (p_date,p_date+1) then raise exception 'Explicit valid start/end date and times required'; end if;
  start_at := (p_date+p_in) at time zone 'Asia/Manila';
  end_at := (p_end+p_out) at time zone 'Asia/Manila';
  if end_at<=start_at or end_at-start_at>interval '16 hours' or end_at>clock_timestamp() then
    raise exception 'Invalid, future or excessive claimed interval';
  end if;
  return next;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public."current_role"()
CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select role from public.profiles where id=auth.uid() and status='Active' $function$
;
-- Latest source: migrations/M08_document_versions.sql; public.document_access(uuid,bigint,bigint)
CREATE OR REPLACE FUNCTION public.document_access(p_id uuid, p_expected_version bigint, p_expected_revision bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare d public.documents;
begin
 select * into d from public.documents where id=p_id;
 if not found or not public.can_read_intern(d.intern_id) then raise exception 'Document access not permitted' using errcode='42501'; end if;
 if d.upload_version is distinct from p_expected_version or d.review_revision is distinct from p_expected_revision
 then raise exception 'Evidence changed; refresh' using errcode='40001'; end if;
 if d.file_path is null or split_part(d.file_path,'/',1)<>d.intern_id::text
 or not exists(select 1 from storage.objects where bucket_id='documents' and name=d.file_path) then raise exception 'File missing; request resubmission'; end if;
 return jsonb_build_object('id',d.id,'file_path',d.file_path,'file_name',d.file_name,'upload_version',d.upload_version);
end $function$
;
-- Latest source: migrations/M16_evaluation_controls.sql; public.evaluation_adjustment_text(jsonb,jsonb,jsonb)
CREATE OR REPLACE FUNCTION public.evaluation_adjustment_text(p_original jsonb, p_final jsonb, p_reasons jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare c jsonb:=public.evaluation_feedback_catalog(); criterion text; reason jsonb; option jsonb; text_value text; result text:=''; overview text:='';
begin
 if public.rubric_score(p_original) is null or public.rubric_score(p_final) is null or jsonb_typeof(p_reasons) is distinct from 'object' then raise exception 'Valid ratings and per-criterion adjustment reasons required'; end if;
 for criterion in select jsonb_object_keys(p_reasons) loop
  if criterion not in ('punctuality','performance','conduct','communication') or p_original->criterion=p_final->criterion then raise exception 'Reasons must match changed criteria'; end if;
 end loop;
 foreach criterion in array array['punctuality','performance','conduct','communication'] loop
  if p_original->criterion=p_final->criterion then continue; end if;
  reason:=p_reasons->criterion;
  if jsonb_typeof(reason) is distinct from 'object' or not reason?'code' or not reason?'explanation'
   or (select count(*) from jsonb_object_keys(reason))<>2 or jsonb_typeof(reason->'explanation') is distinct from 'string'
  then raise exception 'Select a valid reason for changed criterion: %',criterion; end if;
  select o into option from jsonb_array_elements(c->'adjustments'->criterion) o where o->>'id'=reason->>'code';
  if not found then raise exception 'Select a valid reason for changed criterion: %',criterion; end if;
  if option->>'id'='other' then
   text_value:=regexp_replace(reason->>'explanation','^\s+|\s+$','','g');
   if length(text_value)<10 or length(reason->>'explanation')>500 or text_value!~'[[:alpha:]]' then raise exception 'Other adjustment explanation must be meaningful, 10-500 characters'; end if;
  else
   if reason->>'explanation'<>'' then raise exception 'Preset reasons do not accept hidden explanations'; end if;
   text_value:=option->>'text';
  end if;
  result:=result||case when result='' then '' else E'\n' end||criterion||': '||text_value;
  overview:=overview||case when overview='' then '' else E'\n' end||criterion||': '||(option->>'label');
 end loop;
 -- Keep M15's 2000-character compatibility field. Full individual explanations
 -- are retained in adjustment_reasons and immutable adjustment events.
 return case when length(result)>2000 then overview||E'\nFull explanations are retained in the per-criterion reasons.' else result end;
end $function$
;
-- Latest source: migrations/M16_evaluation_controls.sql; public.evaluation_feedback_catalog()
CREATE OR REPLACE FUNCTION public.evaluation_feedback_catalog()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select $catalog${"version":1,"groups":{"strengths":[{"id":"punctuality","label":"Reliable attendance","text":"Demonstrates reliable attendance and punctuality."},{"id":"quality","label":"Quality work","text":"Produces careful, good-quality work."},{"id":"conduct","label":"Professional conduct","text":"Demonstrates professional conduct in the workplace."},{"id":"communication","label":"Clear communication","text":"Communicates clearly with the team."},{"id":"teamwork","label":"Teamwork","text":"Works cooperatively with colleagues."},{"id":"initiative","label":"Initiative","text":"Shows initiative when carrying out assigned work."}],"improvements":[{"id":"none","label":"No additional concerns","text":"No additional concerns are recorded in this review."},{"id":"punctuality","label":"Attendance and punctuality","text":"Attendance and punctuality need further attention."},{"id":"quality","label":"Work quality","text":"Work quality needs further attention."},{"id":"conduct","label":"Workplace conduct","text":"Workplace conduct needs further attention."},{"id":"communication","label":"Communication","text":"Communication needs further attention."},{"id":"time_management","label":"Time management","text":"Time management needs further attention."}],"guidance":[{"id":"none","label":"No additional actions","text":"No additional actions are recommended at this review."},{"id":"maintain","label":"Maintain good practices","text":"Continue the good practices identified in this review."},{"id":"plan","label":"Plan daily tasks","text":"Plan daily tasks and check priorities with the Supervisor."},{"id":"check_work","label":"Check work before submission","text":"Check completed work before submitting it."},{"id":"ask","label":"Ask for clarification","text":"Ask for clarification when instructions or expectations are unclear."},{"id":"updates","label":"Provide progress updates","text":"Provide regular progress updates to the Supervisor."},{"id":"discuss","label":"Discuss improvements with Supervisor","text":"Discuss the identified areas for improvement with the Supervisor."}],"overall":[{"id":"meeting","label":"Meeting expectations","text":"The intern is meeting the expectations discussed in this review."},{"id":"progress","label":"Making steady progress","text":"The intern is making steady progress in the internship."},{"id":"development","label":"Further development needed","text":"Further development is needed in the areas identified in this review."},{"id":"support","label":"Continued guidance recommended","text":"Continued guidance is recommended to support the intern's development."}]},"conflicts":[["strengths:punctuality","improvements:punctuality"],["strengths:quality","improvements:quality"],["strengths:conduct","improvements:conduct"],["strengths:communication","improvements:communication"],["overall:development","improvements:none"],["overall:support","guidance:none"]],"adjustments":{"punctuality":[{"id":"attendance_records","label":"Reviewed attendance evidence","text":"Adjusted after reviewing attendance evidence for this criterion."},{"id":"supervisor_clarification","label":"Clarified with Supervisor","text":"Adjusted after clarifying the attendance rating with the Supervisor."},{"id":"other","label":"Other","text":null}],"performance":[{"id":"work_evidence","label":"Reviewed work evidence","text":"Adjusted after reviewing work evidence for this criterion."},{"id":"supervisor_clarification","label":"Clarified with Supervisor","text":"Adjusted after clarifying the work performance rating with the Supervisor."},{"id":"other","label":"Other","text":null}],"conduct":[{"id":"conduct_evidence","label":"Reviewed conduct evidence","text":"Adjusted after reviewing workplace conduct evidence for this criterion."},{"id":"supervisor_clarification","label":"Clarified with Supervisor","text":"Adjusted after clarifying the conduct rating with the Supervisor."},{"id":"other","label":"Other","text":null}],"communication":[{"id":"communication_evidence","label":"Reviewed communication evidence","text":"Adjusted after reviewing communication evidence for this criterion."},{"id":"supervisor_clarification","label":"Clarified with Supervisor","text":"Adjusted after clarifying the communication rating with the Supervisor."},{"id":"other","label":"Other","text":null}]}}$catalog$::jsonb
$function$
;
-- Latest source: migrations/M16_evaluation_controls.sql; public.evaluation_feedback_text(jsonb,text)
CREATE OR REPLACE FUNCTION public.evaluation_feedback_text(p_choices jsonb, p_remarks text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare c jsonb:=public.evaluation_feedback_catalog(); selections jsonb:=public.normalize_evaluation_choices(p_choices); result jsonb:='{}'; g text; value text; remarks text;
begin
 if p_remarks is null or length(p_remarks)>1000 then raise exception 'Additional remarks must be at most 1000 characters'; end if;
 remarks:=regexp_replace(p_remarks,'^\s+|\s+$','','g');
 foreach g in array array['strengths','improvements','guidance','overall'] loop
  select coalesce(string_agg(o->>'text',' ' order by n),'') into value from jsonb_array_elements(c->'groups'->g) with ordinality items(o,n) where (selections->g)?(o->>'id');
  if g='overall' then
   value:=case when value<>'' and remarks<>'' then value||E'\n\n'||remarks when remarks<>'' then remarks else value end;
   result:=result||jsonb_build_object('summary',value);
  else result:=result||jsonb_build_object(g,value); end if;
 end loop;
 return result;
end $function$
;
-- Latest source: migrations/M12_handover_workflows.sql; public.finalize_document_upload(uuid)
CREATE OR REPLACE FUNCTION public.finalize_document_upload(p_upload_id uuid)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v public.document_versions; d public.documents; snapshot jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 SELECT * INTO v FROM public.document_versions WHERE id=p_upload_id AND intern_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR NOT public.owns_intern(auth.uid()) THEN RAISE EXCEPTION 'Owned reservation required' USING errcode='42501'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=v.document_id FOR UPDATE;
 IF v.committed_at IS NOT NULL THEN RETURN d; END IF;
 IF v.abandoned_at IS NOT NULL OR v.expires_at<=clock_timestamp() OR v.expected_version<>d.upload_version
 THEN RAISE EXCEPTION 'Upload expired or evidence changed; refresh' USING errcode='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='documents' AND name=v.file_path
  AND metadata->>'mimetype'=v.mime_type AND (metadata->>'size')::numeric=v.byte_size)
 THEN RAISE EXCEPTION 'Stored object MIME/size evidence missing or mismatched'; END IF;
 snapshot:=d.legacy_evidence;
 IF d.upload_version=0 AND snapshot IS NULL AND (d.file_path IS NOT NULL OR d.file_name IS NOT NULL OR d.note IS NOT NULL OR d.reviewed_by IS NOT NULL OR d.reviewed_at IS NOT NULL OR d.status<>'Pending')
 THEN snapshot:=(to_jsonb(d)-'legacy_evidence')||jsonb_build_object('captured_at',clock_timestamp(),'provenance','stored-legacy-metadata-unverified'); END IF;
 UPDATE public.document_versions SET version_no=d.upload_version+1,committed_at=clock_timestamp() WHERE id=v.id;
 UPDATE public.documents SET file_path=v.file_path,file_name=v.file_name,upload_version=upload_version+1,review_revision=0,
  status='Pending',note=null,reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp(),legacy_evidence=snapshot
 WHERE id=d.id RETURNING * INTO d;
 RETURN d;
END $function$
;
-- Latest source: migrations/M10_flexible_submissions.sql; public.finalize_submission(uuid)
CREATE OR REPLACE FUNCTION public.finalize_submission(p_version_id uuid)
 RETURNS public.submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v public.submission_versions; s public.submissions;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into v from public.submission_versions where id=p_version_id and intern_id=auth.uid() for update;
 if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned reservation required' using errcode='42501'; end if;
 select * into s from public.submissions where id=v.submission_id for update;
 if v.committed_at is not null then return s; end if;
 if v.abandoned_at is not null or v.expires_at<=clock_timestamp() or v.expected_version<>s.current_version or v.expected_revision<>s.review_revision
 then raise exception 'Reservation expired or submission/review changed; refresh' using errcode='40001'; end if;
 if (select count(*) from public.submission_files where version_id=v.id)<>jsonb_array_length(v.manifest)
  or exists(select 1 from public.submission_files f where version_id=v.id and not exists(select 1 from storage.objects o
   where o.bucket_id='documents' and o.name=f.file_path and o.metadata->>'mimetype'=f.mime_type and (o.metadata->>'size')::numeric=f.byte_size))
 then raise exception 'Complete file set with exact stored MIME/size required'; end if;
 update public.submission_versions set version_no=s.current_version+1,committed_at=clock_timestamp() where id=v.id;
 update public.submissions set current_version=current_version+1,review_revision=0,title=v.title,description=v.description,
  status='Pending',note=null,reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp() where id=s.id returning * into s;
 return s;
end $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.finish_attendance_sheet(uuid)
CREATE OR REPLACE FUNCTION public.finish_attendance_sheet(p_id uuid)
 RETURNS public.attendance_sheet_evidence
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare e public.attendance_sheet_evidence;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into e from public.attendance_sheet_evidence where id=p_id for update;
 if not found or e.uploaded_by<>auth.uid() or (public.current_role() is distinct from 'instructor' and not (public.current_role()='supervisor' and e.logbook_submission_id is not null)) or not public.can_read_attendance_sheet(p_id) then raise exception 'Own authorized sheet upload required' using errcode='42501'; end if;
 if e.logbook_submission_id is not null and e.committed_at is null and not exists(select 1 from public.logbook_submissions s join public.logbook_versions v on v.submission_id=s.id and v.version=s.current_version join public.supervisor_assignments a on a.id=s.assignment_id where s.id=e.logbook_submission_id and a.ended_at is null and public.supervises_intern(s.intern_id) and v.status in ('Draft','Returned for Correction')) then raise exception 'Current editable supervision assignment required' using errcode='42501'; end if;
 if e.abandoned_at is not null or (e.committed_at is null and e.expires_at<=clock_timestamp()) then raise exception 'Sheet reservation expired or abandoned'; end if;
 if not exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path
 and metadata->>'mimetype'=e.mime_type and (metadata->>'size')::numeric=e.byte_size) then raise exception 'Complete validated evidence upload required'; end if;
 if e.ready_at is not null then return e; end if;
 update public.attendance_sheet_evidence set ready_at=clock_timestamp() where id=p_id returning * into e;
 return e;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.guard_alert_update()
CREATE OR REPLACE FUNCTION public.guard_alert_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin
  if not public.is_admin() and (to_jsonb(new)-'dismissed') is distinct from (to_jsonb(old)-'dismissed') then
    raise exception 'Only dismissal may be changed' using errcode='42501';
  end if;
  return new;
end $function$
;
-- Latest source: migrations/M11_admin_history.sql; public.guard_archived_assignment()
CREATE OR REPLACE FUNCTION public.guard_archived_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 perform pg_advisory_xact_lock(404,1);
 if new.company_id is not null and (tg_op='INSERT' or new.company_id is distinct from old.company_id)
  and exists(select 1 from public.companies where id=new.company_id and archived_at is not null)
 then raise exception 'Archived company cannot receive new assignments'; end if;
 if new.section_id is not null and (tg_op='INSERT' or new.section_id is distinct from old.section_id)
  and exists(select 1 from public.course_sections where id=new.section_id and archived_at is not null)
 then raise exception 'Archived section cannot receive new assignments'; end if;
 return new;
end $function$
;
-- Latest source: migrations/M03_attendance_integrity.sql; public.guard_attendance_future()
CREATE OR REPLACE FUNCTION public.guard_attendance_future()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin
  if tg_table_name='attendance_logs' then
    if new.log_date>(clock_timestamp() at time zone 'Asia/Manila')::date
      or new.clocked_in_at>clock_timestamp() or new.clocked_out_at>clock_timestamp() then
      raise exception 'Future attendance is not permitted';
    end if;
  else
    if new.log_date>(clock_timestamp() at time zone 'Asia/Manila')::date
      or ((new.claimed_end_date+new.claimed_time_out) at time zone 'Asia/Manila')>clock_timestamp() then
      raise exception 'Future correction is not permitted';
    end if;
  end if;
  return new;
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.guard_attendance_sheet_history()
CREATE OR REPLACE FUNCTION public.guard_attendance_sheet_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 if tg_op='DELETE' then raise exception 'Retain sheet reservation/history; clean abandoned bytes through Storage API'; end if;
 if old.committed_at is not null and new is distinct from old then raise exception 'Committed attendance evidence is immutable'; end if;
 if (to_jsonb(new)-array['ready_at','committed_at','abandoned_at']) is distinct from (to_jsonb(old)-array['ready_at','committed_at','abandoned_at']) then raise exception 'Sheet upload identity and participants are immutable'; end if;
 return new;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.guard_domain_identity()
CREATE OR REPLACE FUNCTION public.guard_domain_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if new.id is distinct from old.id or new.intern_id is distinct from old.intern_id then
    raise exception 'Record ownership is immutable' using errcode='42501';
  end if;
  if tg_table_name='evaluations' then
    if new.evaluator_id is distinct from old.evaluator_id then
      raise exception 'Evaluation author is immutable' using errcode='42501';
    end if;
  end if;
  return new;
end $function$
;
-- Latest source: migrations/M16_evaluation_controls.sql; public.guard_evaluation_adjustment_event()
CREATE OR REPLACE FUNCTION public.guard_evaluation_adjustment_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin raise exception 'Adjustment history is immutable'; end $function$
;
-- Latest source: migrations/M15_supervisor_evaluations.sql; public.guard_frozen_evaluation()
CREATE OR REPLACE FUNCTION public.guard_frozen_evaluation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 if tg_op='DELETE' or tg_table_name='evaluations' then raise exception 'Evaluation history is immutable'; end if;
 if old.status='Submitted to Coordinator' then raise exception 'Evaluation history is immutable'; end if;
 if new.id<>old.id or new.supervisor_id<>old.supervisor_id or new.intern_id<>old.intern_id or new.company_id<>old.company_id or new.assignment_id<>old.assignment_id or new.rubric<>old.rubric then raise exception 'Source identity is immutable'; end if;
 return new;
end $function$
;
-- Latest source: migrations/M14_last_admin_protection.sql; public.guard_last_active_admin()
CREATE OR REPLACE FUNCTION public.guard_last_active_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF old.role<>'admin' OR old.status<>'Active' THEN
  IF tg_op='DELETE' THEN RETURN old; END IF;
  RETURN new;
 END IF;
 IF tg_op='UPDATE' AND new.role='admin' AND new.status='Active' THEN RETURN new; END IF;
 PERFORM pg_advisory_xact_lock(404,1);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>old.id AND role='admin' AND status='Active') THEN
  RAISE EXCEPTION 'Keep at least one Active Admin. Activate another administrator before removing this account or changing its role/status.' USING errcode='23514';
 END IF;
 IF tg_op='DELETE' THEN RETURN old; END IF;
 RETURN new;
END $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.guard_logbook_version()
CREATE OR REPLACE FUNCTION public.guard_logbook_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 if tg_op='DELETE' then raise exception 'Logbook history must be preserved'; end if;
 if old.status='Verified' and new is distinct from old then raise exception 'Verified logbook version is immutable'; end if;
 if old.status<>'Draft' and (to_jsonb(new)-array['status','revision','return_reason','returned_by','returned_at','verified_by','verified_at','request_id','recorded_sessions']) is distinct from
 (to_jsonb(old)-array['status','revision','return_reason','returned_by','returned_at','verified_by','verified_at','request_id','recorded_sessions']) then raise exception 'Submitted evidence and provenance are immutable'; end if;
 return new;
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.guard_manual_attendance()
CREATE OR REPLACE FUNCTION public.guard_manual_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 if tg_op='DELETE' then if old.attendance_source='manual_company_sheet' then raise exception 'Manual attendance and evidence history must be preserved'; end if; return old; end if;
 if tg_op='UPDATE' and old.attendance_source='manual_company_sheet' then
  if old.verified and new is distinct from old then raise exception 'Verified manual attendance is immutable'; end if;
  if new.id<>old.id or new.intern_id<>old.intern_id or new.attendance_source<>old.attendance_source or new.encoded_by<>old.encoded_by or new.encoded_at<>old.encoded_at then raise exception 'Manual attendance identities and original encoding provenance are immutable'; end if;
  if new.verified and not old.verified then
   if (to_jsonb(new)-array['verified','verified_by','verified_at']) is distinct from (to_jsonb(old)-array['verified','verified_by','verified_at']) then raise exception 'Verification cannot alter encoded attendance'; end if;
   new.verified_at:=clock_timestamp();
  end if;
 end if;
 return new;
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.guard_manual_history()
CREATE OR REPLACE FUNCTION public.guard_manual_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin raise exception 'Manual attendance history is immutable'; end $function$
;
-- Latest source: migrations/M01_authority.sql; public.guard_profile_update()
CREATE OR REPLACE FUNCTION public.guard_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if new.id is distinct from old.id then raise exception 'Profile identity is immutable' using errcode='42501'; end if;
  -- Trusted SQL operator is the explicitly documented first-Admin bootstrap;
  -- authenticated/anon cannot SET ROLE postgres. Never use caller-set claims.
  if current_user <> 'postgres' and not public.is_admin() and
     (to_jsonb(new)-'full_name') is distinct from (to_jsonb(old)-'full_name') then
    raise exception 'Only Active Admin may change protected profile fields' using errcode='42501';
  end if;
  return new;
end $function$
;
-- Latest source: migrations/M15_supervisor_evaluations.sql; public.guard_supervision_relationships()
CREATE OR REPLACE FUNCTION public.guard_supervision_relationships()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 if exists(select 1 from public.supervisor_assignments a join public.profiles s on s.id=a.supervisor_id
 join public.interns i on i.id=a.intern_id join public.profiles p on p.id=i.id
 where a.ended_at is null and (s.role<>'supervisor' or s.status<>'Active' or p.role<>'intern' or p.status<>'Active'
 or s.supervisor_company_id is distinct from a.company_id or i.company_id is distinct from a.company_id))
 then raise exception 'End affected Supervisor assignments before changing role, status or company'; end if;
 if exists(select 1 from public.profiles where role='supervisor' and supervisor_company_id is null)
 then raise exception 'Supervisor company required'; end if;
 return new;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  insert into public.profiles(id,full_name,email,role,status,organization,student_id,requested_role)
  values(new.id,coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),'New account'),
    coalesce(new.email,''),'intern','Pending',new.raw_user_meta_data->>'organization',
    new.raw_user_meta_data->>'student_id',
    case when new.raw_user_meta_data->>'requested_role' in ('intern','instructor','admin')
      then new.raw_user_meta_data->>'requested_role' else 'intern' end);
  insert into public.interns(id) values(new.id);
  return new;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.is_active()
CREATE OR REPLACE FUNCTION public.is_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select coalesce(exists(select 1 from public.profiles where id=auth.uid() and status='Active'),false) $function$
;
-- Latest source: migrations/M01_authority.sql; public.is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select coalesce(public.current_role()='admin',false) $function$
;
-- Latest source: migrations/M12_handover_workflows.sql; public.legacy_document_access(uuid)
CREATE OR REPLACE FUNCTION public.legacy_document_access(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE d public.documents; old jsonb;
BEGIN
 SELECT * INTO d FROM public.documents WHERE id=p_id;
 IF NOT FOUND OR NOT public.can_read_intern(d.intern_id) THEN RAISE EXCEPTION 'Legacy file access not permitted' USING errcode='42501'; END IF;
 old:=d.legacy_evidence;
 IF old IS NULL OR old->>'id' IS DISTINCT FROM d.id::text OR old->>'intern_id' IS DISTINCT FROM d.intern_id::text
  OR old->>'upload_version' IS DISTINCT FROM '0' OR old->>'provenance' IS DISTINCT FROM 'stored-legacy-metadata-unverified'
  OR split_part(old->>'file_path','/',1) IS DISTINCT FROM d.intern_id::text
  OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='documents' AND name=old->>'file_path')
 THEN RAISE EXCEPTION 'Legacy file unavailable; original metadata retained without reconstructed evidence'; END IF;
 RETURN jsonb_build_object('id',d.id,'file_path',old->>'file_path','file_name',old->>'file_name');
END $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.logbook_queue(uuid,integer)
CREATE OR REPLACE FUNCTION public.logbook_queue(p_after uuid DEFAULT NULL::uuid, p_size integer DEFAULT 100)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select to_jsonb(s)||jsonb_build_object('current_coordinator_id',case when public.is_admin() then (select instructor_id from public.interns where id=s.intern_id) else null end,'current',to_jsonb(v),'history',
 (select coalesce(jsonb_agg(to_jsonb(h) order by h.version desc),'[]') from public.logbook_versions h where h.submission_id=s.id and (h.status<>'Draft' or public.is_admin() or s.supervisor_id=auth.uid())),
 'files',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'file_name',e.file_name,'mime_type',e.mime_type,'byte_size',e.byte_size,'ready_at',e.ready_at,'committed_at',e.committed_at,'expires_at',e.expires_at,'abandoned_at',e.abandoned_at) order by e.created_at),'[]')
 from public.attendance_sheet_evidence e where e.logbook_submission_id=s.id and public.can_read_logbook_evidence(e.id)))
 from public.logbook_submissions s join public.logbook_versions v on v.submission_id=s.id and v.version=s.current_version
 where public.can_read_logbook(s.id) and (p_after is null or s.id>p_after)
 and (v.status<>'Draft' or public.is_admin() or s.supervisor_id=auth.uid())
 order by s.id limit greatest(1,least(coalesce(p_size,100),500))
$function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.manual_attendance_details(uuid,uuid,jsonb)
CREATE OR REPLACE FUNCTION public.manual_attendance_details(p_intern uuid, p_evidence uuid, p_details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare e public.attendance_sheet_evidence; company_name text; key text;
begin
 if public.current_role() is distinct from 'instructor' or not public.assigned_intern(p_intern)
 or not exists(select 1 from public.profiles where id=p_intern and role='intern' and status='Active') then raise exception 'Assigned Active Intern and OJT Coordinator required' using errcode='42501'; end if;
 select * into e from public.attendance_sheet_evidence where id=p_evidence for update;
 if not found or not public.can_read_attendance_sheet(e.id) or not p_intern=any(e.participant_ids) or not public.manual_company_allowed(p_intern,e.company_id) then raise exception 'Authorized evidence for this Intern/company required' using errcode='42501'; end if;
 if e.logbook_submission_id is not null then raise exception 'Supervisor logbooks require Verify & Record Attendance for the whole submitted version'; end if;
 if e.ready_at is null or e.abandoned_at is not null or (e.committed_at is null and e.expires_at<=clock_timestamp())
 or not exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=e.file_path and metadata->>'mimetype'=e.mime_type and (metadata->>'size')::numeric=e.byte_size) then raise exception 'Successfully uploaded, validated signed evidence required'; end if;
 if jsonb_typeof(p_details) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_details))<>6 or p_details->'signatures_reviewed' is distinct from 'true'::jsonb then raise exception 'Confirm review of Intern and Supervisor signatures'; end if;
 foreach key in array array['company_on_sheet','supervisor_on_sheet','fallback_reason','reason_explanation','remarks'] loop
  if jsonb_typeof(p_details->key) is distinct from 'string' then raise exception 'Complete printed company, Supervisor and fallback information'; end if;
 end loop;
 if length(btrim(p_details->>'company_on_sheet')) not between 1 and 200 or length(btrim(p_details->>'supervisor_on_sheet')) not between 1 and 200
 or p_details->>'fallback_reason' not in ('no_connectivity','system_unavailable','other') or length(p_details->>'remarks')>500
 or length(p_details->>'reason_explanation')>500 or (p_details->>'fallback_reason'='other' and (length(btrim(p_details->>'reason_explanation'))<10 or p_details->>'reason_explanation'!~'[[:alpha:]]'))
 or (p_details->>'fallback_reason'<>'other' and p_details->>'reason_explanation'<>'') then raise exception 'Valid company/Supervisor information required; Other needs a meaningful 10-500 character explanation'; end if;
 select name into company_name from public.companies where id=e.company_id;
 return p_details||jsonb_build_object('company_id',e.company_id,'registered_company_name',company_name);
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.manual_company_allowed(uuid,uuid)
CREATE OR REPLACE FUNCTION public.manual_company_allowed(p_intern uuid, p_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select exists(select 1 from public.interns where id=p_intern and company_id=p_company)
 or exists(select 1 from public.supervisor_assignments where intern_id=p_intern and company_id=p_company)
 or exists(select 1 from public.audit_logs where source='database-trigger-v2' and event_data->>'table'='interns'
 and event_data->>'record_id'=p_intern::text and (event_data->>'company_id'=p_company::text or event_data->>'previous_company_id'=p_company::text))
$function$
;
-- Latest source: migrations/M01_authority.sql; public.my_profile()
CREATE OR REPLACE FUNCTION public.my_profile()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select case when p.status='Active' then to_jsonb(p)
     else jsonb_build_object('id',p.id,'status',p.status) end
     from public.profiles p where p.id=auth.uid() $function$
;
-- Latest source: migrations/M16_evaluation_controls.sql; public.normalize_evaluation_choices(jsonb)
CREATE OR REPLACE FUNCTION public.normalize_evaluation_choices(p_choices jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare c jsonb:=public.evaluation_feedback_catalog(); result jsonb:='{}'; g text; ids jsonb; pair jsonb; chosen text[]:='{}';
begin
 if jsonb_typeof(p_choices) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_choices))<>4 then raise exception 'Select valid feedback groups'; end if;
 foreach g in array array['strengths','improvements','guidance','overall'] loop
  ids:=p_choices->g;
  if jsonb_typeof(ids) is distinct from 'array' then raise exception 'Feedback group must be an array'; end if;
  if exists(select 1 from jsonb_array_elements(ids) x where jsonb_typeof(x)<>'string')
   or (select count(distinct x) from jsonb_array_elements_text(ids) x)<>jsonb_array_length(ids)
   or exists(select 1 from jsonb_array_elements_text(ids) x where not exists(select 1 from jsonb_array_elements(c->'groups'->g) o where o->>'id'=x))
  then raise exception 'Unknown or duplicate feedback option'; end if;
  if (g='overall' and jsonb_array_length(ids)>1) or (ids?'none' and jsonb_array_length(ids)>1) then raise exception 'Choose compatible feedback options'; end if;
  result:=result||jsonb_build_object(g,(select coalesce(jsonb_agg(o->'id' order by n),'[]'::jsonb) from jsonb_array_elements(c->'groups'->g) with ordinality items(o,n) where ids?(o->>'id')));
  chosen:=chosen||array(select g||':'||x from jsonb_array_elements_text(ids) x);
 end loop;
 for pair in select * from jsonb_array_elements(c->'conflicts') loop
  if (pair->>0)=any(chosen) and (pair->>1)=any(chosen) then raise exception 'Feedback choices contradict each other'; end if;
 end loop;
 return result;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.owns_intern(uuid)
CREATE OR REPLACE FUNCTION public.owns_intern(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select coalesce(public.current_role()='intern' and p_id=auth.uid()
     and exists(select 1 from public.interns where id=p_id),false) $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.record_manual_attendance(uuid,uuid,timestamp with time zone,timestamp with time zone,uuid,jsonb)
CREATE OR REPLACE FUNCTION public.record_manual_attendance(p_id uuid, p_intern uuid, p_in timestamp with time zone, p_out timestamp with time zone, p_evidence uuid, p_details jsonb)
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_logs; details jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 perform pg_advisory_xact_lock(hashtextextended(p_intern::text,101));
 perform 1 from public.interns where id=p_intern for share;
 perform 1 from public.profiles where id in (auth.uid(),p_intern) for share;
 details:=public.manual_attendance_details(p_intern,p_evidence,p_details);
 if p_id is null then raise exception 'Attendance retry identity required'; end if;
 select * into r from public.attendance_logs where id=p_id for update;
 if found then
  if r.attendance_source='manual_company_sheet' and r.encoded_by=auth.uid() and r.intern_id=p_intern and r.clocked_in_at=p_in and r.clocked_out_at=p_out and r.manual_evidence_id=p_evidence and (r.manual_details-'registered_company_name')=(details-'registered_company_name') then return r; end if;
  raise exception 'Attendance identity already used or revised; refresh';
 end if;
 perform public.check_manual_session(p_intern,p_in,p_out,null);
 insert into public.attendance_logs(id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,attendance_source,manual_evidence_id,manual_details,manual_revision,encoded_by,encoded_at)
 values(p_id,p_intern,(p_in at time zone 'Asia/Manila')::date,(p_in at time zone 'Asia/Manila')::time,(p_out at time zone 'Asia/Manila')::time,p_in,p_out,extract(epoch from p_out-p_in)/3600,false,'manual_company_sheet',p_evidence,details,1,auth.uid(),clock_timestamp()) returning * into r;
 update public.attendance_sheet_evidence set committed_at=coalesce(committed_at,clock_timestamp()) where id=p_evidence;
 return r;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.related_profile_names(uuid[])
CREATE OR REPLACE FUNCTION public.related_profile_names(p_ids uuid[])
 RETURNS TABLE(id uuid, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select p.id,p.full_name from public.profiles p
     where public.is_active() and p.id=any(p_ids) and (
       p.id=auth.uid() or public.is_admin() or public.assigned_intern(p.id)
       or (public.current_role()='intern' and (
         exists(select 1 from public.interns i where i.id=auth.uid() and i.instructor_id=p.id and p.role='instructor')
         or exists(select 1 from public.evaluations e where e.intern_id=auth.uid() and e.evaluator_id=p.id and p.role in ('admin','instructor'))))) $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.return_logbook(uuid,integer,integer,text)
CREATE OR REPLACE FUNCTION public.return_logbook(p_id uuid, p_version integer, p_revision integer, p_reason text)
 RETURNS public.logbook_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v public.logbook_versions; oldv jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 if public.can_review_logbook(p_id) is not true then raise exception 'Assigned receiving Coordinator required' using errcode='42501'; end if;
 select v0.* into v from public.logbook_versions v0 join public.logbook_submissions s on s.id=v0.submission_id and s.current_version=v0.version where s.id=p_id for update of v0;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 or btrim(p_reason)!~'[[:alpha:]]' then raise exception 'Explain the missing signatures, unreadable evidence, wrong dates or other correction (10–1000 characters)'; end if;
 if v.version=p_version and v.status='Returned for Correction' and v.returned_by=auth.uid() and v.return_reason=btrim(p_reason) and v.revision=p_revision+1 then return v; end if;
 if v.status<>'Pending Review' or v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Review changed; refresh' using errcode='40001'; end if;
 oldv:=to_jsonb(v);
 update public.logbook_versions set status='Returned for Correction',return_reason=btrim(p_reason),returned_by=auth.uid(),returned_at=clock_timestamp(),revision=revision+1 where submission_id=p_id and version=p_version returning * into v;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'returned',oldv,to_jsonb(v));
 return v;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.review_document(uuid,text,text,text)
CREATE OR REPLACE FUNCTION public.review_document(p_id uuid, p_status text, p_note text, p_expected_path text)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.documents;
begin
  select * into r from public.documents where id=p_id for update;
  if not found or not public.can_review(r.intern_id) then raise exception 'Review not permitted' using errcode='42501'; end if;
  if p_status is null or p_status not in ('Pending','Approved','Needs Revision') then raise exception 'Invalid review status'; end if;
  if r.file_path is distinct from p_expected_path then raise exception 'Evidence changed; refresh' using errcode='40001'; end if;
  if p_status='Approved' and (r.file_path is null or split_part(r.file_path,'/',1)<>r.intern_id::text
     or not exists(select 1 from storage.objects where bucket_id='documents' and name=r.file_path)) then
    raise exception 'Valid uploaded evidence required';
  end if;
  if p_status='Needs Revision' and nullif(btrim(p_note),'') is null then raise exception 'Revision note required'; end if;
  if length(p_note)>500 then raise exception 'Note exceeds 500 characters'; end if;
  update public.documents set status=p_status,note=case when p_status='Needs Revision' then btrim(p_note) else null end,
    reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=r.id returning * into r;
  return r;
end $function$
;
-- Latest source: migrations/M08_document_versions.sql; public.review_document_version(uuid,text,text,bigint,bigint)
CREATE OR REPLACE FUNCTION public.review_document_version(p_id uuid, p_status text, p_note text, p_expected_version bigint, p_expected_revision bigint)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare d public.documents; v public.document_versions; ts timestamptz;
begin
 perform pg_advisory_xact_lock(404,1);
 ts:=clock_timestamp();
 select * into d from public.documents where id=p_id for update;
 if not found or not public.can_review(d.intern_id) then raise exception 'Review not permitted' using errcode='42501'; end if;
 if d.upload_version is distinct from p_expected_version or d.review_revision is distinct from p_expected_revision
 then raise exception 'Evidence or review changed; refresh' using errcode='40001'; end if;
 if p_status is null or not ((d.status='Pending' and p_status in ('Approved','Needs Revision')) or (d.status='Approved' and p_status='Pending'))
 then raise exception 'Invalid review transition; refresh'; end if;
 if length(p_note)>500 or (p_status='Needs Revision' and nullif(btrim(p_note),'') is null) then raise exception 'Revision note required; maximum 500 characters'; end if;
 select * into v from public.document_versions where document_id=d.id and version_no=d.upload_version and committed_at is not null;
 if not found or v.file_path<>d.file_path or not exists(select 1 from storage.objects where bucket_id='documents' and name=v.file_path
   and metadata->>'mimetype'=v.mime_type and (metadata->>'size')::numeric=v.byte_size)
 then raise exception 'Current version evidence missing; resubmit before review'; end if;
 update public.documents set status=p_status,note=nullif(btrim(p_note),''),reviewed_by=auth.uid(),reviewed_at=ts,
   review_revision=review_revision+1,updated_at=ts where id=d.id returning * into d;
 update public.document_versions set status=p_status,note=d.note,reviewed_by=auth.uid(),reviewed_at=ts where id=v.id;
 insert into public.document_review_events(document_id,version_id,intern_id,review_revision,status,note,reviewed_by,reviewed_at)
 values(d.id,v.id,d.intern_id,d.review_revision,p_status,d.note,auth.uid(),ts);
 return d;
end $function$
;
-- Latest source: migrations/M02_trusted_audit.sql; public.review_exception(uuid,text,text)
CREATE OR REPLACE FUNCTION public.review_exception(p_id uuid, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS public.attendance_exceptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_exceptions; a public.attendance_logs;
        start_ts timestamptz; end_ts timestamptz; n integer;
begin
  select * into r from public.attendance_exceptions where id=p_id;
  if not found or not public.can_review(r.intern_id) then raise exception 'Review not permitted' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('Approved','Rejected') then raise exception 'Invalid decision'; end if;
  if length(p_note)>500 or (p_decision='Rejected' and nullif(btrim(p_note),'') is null) then
    raise exception 'Rejection note required; notes must be at most 500 characters';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));
  -- Freeze caller status and assignment for this review; concurrent lifecycle
  -- writes wait or cause a transactional conflict, never grant stale authority.
  perform 1 from public.profiles where id=auth.uid() for share;
  perform 1 from public.interns where id=r.intern_id for share;
  select * into r from public.attendance_exceptions where id=p_id for update;
  if not found or not public.can_review(r.intern_id) then raise exception 'Assignment changed' using errcode='42501'; end if;
  if r.status<>'Pending' then raise exception 'Correction already reviewed; refresh' using errcode='40001'; end if;
  if p_decision='Approved' then
    -- Legacy NULL end date is same-day only; reversed times are never guessed.
    select start_at,end_at into start_ts,end_ts from public.correction_instants(
      r.log_date,r.claimed_time_in,r.claimed_time_out,coalesce(r.claimed_end_date,r.log_date));
    select count(*) into n from public.attendance_logs where intern_id=r.intern_id and log_date=r.log_date;
    if n>1 then raise exception 'Duplicate legacy attendance requires review' using errcode='40001'; end if;
    select * into a from public.attendance_logs where intern_id=r.intern_id and log_date=r.log_date for update;
    if found then
      update public.attendance_logs set time_in=r.claimed_time_in,time_out=r.claimed_time_out,
        clocked_in_at=start_ts,clocked_out_at=end_ts,hours=extract(epoch from end_ts-start_ts)/3600,
        verified=true,verified_by=auth.uid() where id=a.id;
    else
      insert into public.attendance_logs(intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,verified_by)
      values(r.intern_id,r.log_date,r.claimed_time_in,r.claimed_time_out,start_ts,end_ts,
        extract(epoch from end_ts-start_ts)/3600,true,auth.uid());
    end if;
  end if;
  update public.attendance_exceptions set status=p_decision,review_note=nullif(btrim(p_note),''),
    reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=r.id and status='Pending' returning * into r;
  if not found then raise exception 'Correction changed; refresh' using errcode='40001'; end if;
  return r;
end $function$
;
-- Latest source: migrations/M02_trusted_audit.sql; public.review_exceptions(uuid[],text,text)
CREATE OR REPLACE FUNCTION public.review_exceptions(p_ids uuid[], p_decision text, p_note text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, ok boolean, error text, code text, data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare item uuid; r public.attendance_exceptions;
begin
  if public.current_role() is null or public.current_role() not in ('admin','instructor') then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  if p_ids is null or cardinality(p_ids)<1 or cardinality(p_ids)>100 or array_position(p_ids,null) is not null then
    raise exception 'Select between 1 and 100 correction UUIDs';
  end if;
  -- Intern-first ordering also prevents inverse lock order for different
  -- requests belonging to the same two interns.
  for item in select x.item_id from (select distinct unnest(p_ids) as item_id) x
    left join public.attendance_exceptions e on e.id=x.item_id and public.can_review(e.intern_id)
    order by e.intern_id,x.item_id loop
    id:=item; data:=null; error:=null; code:=null;
    begin
      r:=public.review_exception(item,p_decision,p_note);
      ok:=true; data:=to_jsonb(r);
    exception when others then
      ok:=false; error:=sqlerrm; code:=sqlstate;
    end;
    return next;
  end loop;
end $function$
;
-- Latest source: migrations/M10_flexible_submissions.sql; public.review_submission(uuid,bigint,bigint,text,text)
CREATE OR REPLACE FUNCTION public.review_submission(p_id uuid, p_version bigint, p_revision bigint, p_status text, p_note text)
 RETURNS public.submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.submissions; v public.submission_versions; ts timestamptz;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into s from public.submissions where id=p_id for update;
 if not found or not public.can_review(s.intern_id) then raise exception 'Assigned staff required' using errcode='42501'; end if;
 if s.current_version is distinct from p_version or s.review_revision is distinct from p_revision
 then raise exception 'File set or review changed; refresh' using errcode='40001'; end if;
 if s.status<>'Pending' or p_status is null or p_status not in ('Approved','Needs Revision') then raise exception 'Pending current version required'; end if;
 if length(p_note)>500 or (p_status='Needs Revision' and nullif(btrim(p_note),'') is null)
 then raise exception 'Revision explanation required; maximum 500 characters'; end if;
 select * into v from public.submission_versions where submission_id=s.id and version_no=s.current_version and committed_at is not null;
 if not found or (select count(*) from public.submission_files where version_id=v.id)<>jsonb_array_length(v.manifest)
  or exists(select 1 from public.submission_files f where version_id=v.id and not exists(select 1 from storage.objects o
    where o.bucket_id='documents' and o.name=f.file_path and o.metadata->>'mimetype'=f.mime_type and (o.metadata->>'size')::numeric=f.byte_size))
 then raise exception 'Complete committed file evidence required'; end if;
 ts:=clock_timestamp();
 update public.submissions set status=p_status,note=nullif(btrim(p_note),''),reviewed_by=auth.uid(),reviewed_at=ts,
  review_revision=review_revision+1,updated_at=ts where id=s.id returning * into s;
 update public.submission_versions set status=s.status,note=s.note,reviewed_by=s.reviewed_by,reviewed_at=ts,review_revision=s.review_revision where id=v.id;
 insert into public.submission_reviews(version_id,intern_id,review_revision,status,note,reviewed_by,reviewed_at)
  values(v.id,s.intern_id,s.review_revision,s.status,s.note,auth.uid(),ts);
 return s;
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.revise_manual_attendance(uuid,integer,timestamp with time zone,timestamp with time zone,uuid,jsonb,text)
CREATE OR REPLACE FUNCTION public.revise_manual_attendance(p_id uuid, p_revision integer, p_in timestamp with time zone, p_out timestamp with time zone, p_evidence uuid, p_details jsonb, p_reason text)
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_logs; details jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.attendance_logs where id=p_id;
 if not found or not public.assigned_intern(r.intern_id) or public.current_role() is distinct from 'instructor' then raise exception 'Assigned OJT Coordinator required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));
 perform 1 from public.interns where id=r.intern_id for share;
 select * into r from public.attendance_logs where id=p_id for update;
 details:=public.manual_attendance_details(r.intern_id,p_evidence,p_details);
 if details->'company_id'=r.manual_details->'company_id' then
  details:=details||jsonb_build_object('registered_company_name',r.manual_details->>'registered_company_name');
 end if;
 if r.attendance_source<>'manual_company_sheet' or r.verified then raise exception 'Only unverified manual attendance may be revised'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 500 or p_reason!~'[[:alpha:]]' then raise exception 'Meaningful 10-500 character revision reason required'; end if;
 if r.manual_revision=p_revision+1 and r.clocked_in_at=p_in and r.clocked_out_at=p_out and r.manual_evidence_id=p_evidence and r.manual_details=details and r.revision_reason=p_reason and r.revised_by=auth.uid() then return r; end if;
 if r.manual_revision is distinct from p_revision then raise exception 'Attendance revision changed; refresh' using errcode='40001'; end if;
 perform public.check_manual_session(r.intern_id,p_in,p_out,r.id);
 update public.attendance_logs set log_date=(p_in at time zone 'Asia/Manila')::date,time_in=(p_in at time zone 'Asia/Manila')::time,time_out=(p_out at time zone 'Asia/Manila')::time,
 clocked_in_at=p_in,clocked_out_at=p_out,hours=extract(epoch from p_out-p_in)/3600,manual_evidence_id=p_evidence,manual_details=details,
 manual_revision=manual_revision+1,revised_by=auth.uid(),revised_at=clock_timestamp(),revision_reason=p_reason where id=p_id returning * into r;
 update public.attendance_sheet_evidence set committed_at=coalesce(committed_at,clock_timestamp()) where id=p_evidence;
 return r;
end $function$
;
-- Latest source: migrations/M06_rubric_hours.sql; public.rubric_score(jsonb)
CREATE OR REPLACE FUNCTION public.rubric_score(p_criteria jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare k text; n numeric; total numeric:=0;
begin
 if jsonb_typeof(p_criteria) is distinct from 'object' then return null; end if;
 if (select count(*) from jsonb_object_keys(p_criteria))<>4 then return null; end if;
 foreach k in array array['punctuality','performance','conduct','communication'] loop
   if jsonb_typeof(p_criteria->k) is distinct from 'number' then return null; end if;
   n:=(p_criteria->>k)::numeric;
   if n<1 or n>5 or n<>trunc(n) then return null; end if;
   total:=total+n*case k when 'punctuality' then 25 when 'performance' then 35 else 20 end/5;
 end loop;
 return round(total)::integer;
end $function$
;
-- Latest source: migrations/M16_evaluation_controls.sql; public.save_evaluation_review(uuid,integer,text,text,text,text,jsonb,text,boolean)
CREATE OR REPLACE FUNCTION public.save_evaluation_review(p_id uuid, p_expected_revision integer, p_summary text, p_strengths text, p_improvements text, p_guidance text, p_criteria jsonb, p_reason text, p_publish boolean DEFAULT false)
 RETURNS public.evaluation_reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.evaluation_reviews; s public.supervisor_evaluations; final public.evaluations; score integer; reason_text text; fields jsonb; criterion text; option jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.evaluation_reviews where id=p_id for update;
 if not found or public.current_role() is distinct from 'instructor' or r.coordinator_id<>auth.uid() or not public.can_review_source(p_id)
 then raise exception 'Routed evaluation for current assigned Intern required' using errcode='42501'; end if;
 select * into s from public.supervisor_evaluations where id=p_id;
 if r.status='Published to Intern' then
  if p_publish and r.summary=p_summary and r.strengths=p_strengths and r.improvements=p_improvements and r.guidance=p_guidance and r.criteria=p_criteria and r.adjustment_reason=p_reason then return r; end if;
  raise exception 'Published evaluation is immutable';
 end if;
 if r.revision is distinct from p_expected_revision then raise exception 'Review changed; refresh' using errcode='40001'; end if;
 score:=public.rubric_score(p_criteria);
 if score is null or p_publish is null or p_summary is null or p_strengths is null or p_improvements is null or p_guidance is null or p_reason is null then raise exception 'Complete valid ratings and review fields'; end if;
 reason_text:=public.evaluation_adjustment_text(s.criteria,p_criteria,r.adjustment_reasons);
 if p_criteria<>s.criteria and p_reason is distinct from reason_text then raise exception 'Use a valid per-criterion adjustment reason; upgrade the evaluation client'; end if;
 fields:=jsonb_build_object('summary',p_summary,'strengths',p_strengths,'improvements',p_improvements,'guidance',p_guidance);
 if r.feedback_mode='selected' then
  if fields is distinct from public.evaluation_feedback_text(r.feedback_choices,r.additional_remarks) then
   update public.evaluation_reviews set feedback_mode='written',written_feedback=fields where id=p_id;
  end if;
 end if;
 if p_publish and p_summary!~'[^[:space:]]' then raise exception 'Student-facing summary required to publish'; end if;
 update public.evaluation_reviews set summary=p_summary,strengths=p_strengths,improvements=p_improvements,guidance=p_guidance,
 criteria=p_criteria,adjustment_reason=p_reason,revision=revision+1,status='Coordinator Draft' where id=p_id returning * into r;
 if p_publish then
  insert into public.evaluations(intern_id,evaluator_id,competencies,overall_score,feedback,source_evaluation_id,source_version,provenance,strengths,improvements,guidance,evaluation_date,submission_id)
  values(s.intern_id,auth.uid(),r.criteria,score,r.summary,s.id,s.version,'supervisor_review',r.strengths,r.improvements,r.guidance,s.evaluation_date,s.id) returning * into final;
  update public.evaluation_reviews set status='Published to Intern',final_evaluation_id=final.id where id=p_id returning * into r;
 end if;
 foreach criterion in array array['punctuality','performance','conduct','communication'] loop
  if s.criteria->criterion=p_criteria->criterion then continue; end if;
  select o into option from jsonb_array_elements(public.evaluation_feedback_catalog()->'adjustments'->criterion) o where o->>'id'=r.adjustment_reasons->criterion->>'code';
  insert into public.evaluation_adjustment_events(source_id,source_version,review_revision,criterion,original_rating,final_rating,reason_code,reason_text,coordinator_id)
  values(s.id,s.version,r.revision,criterion,(s.criteria->>criterion)::integer,(p_criteria->>criterion)::integer,r.adjustment_reasons->criterion->>'code',case when option->>'id'='other' then regexp_replace(r.adjustment_reasons->criterion->>'explanation','^\s+|\s+$','','g') else option->>'text' end,auth.uid());
 end loop;
 return r;
end $function$
;
-- Latest source: migrations/M16_evaluation_controls.sql; public.save_evaluation_review_v2(uuid,integer,text,jsonb,text,jsonb,jsonb,jsonb,jsonb,boolean)
CREATE OR REPLACE FUNCTION public.save_evaluation_review_v2(p_id uuid, p_expected_revision integer, p_mode text, p_choices jsonb, p_remarks text, p_written jsonb, p_criteria jsonb, p_adjustments jsonb, p_expected_feedback jsonb, p_publish boolean)
 RETURNS public.evaluation_reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.evaluation_reviews; s public.supervisor_evaluations; fields jsonb; choices jsonb; reason text; previous_written jsonb; criterion text; option jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.evaluation_reviews where id=p_id for update;
 if not found or public.current_role() is distinct from 'instructor' or r.coordinator_id<>auth.uid() or not public.can_review_source(p_id)
 then raise exception 'Routed evaluation for current assigned Intern required' using errcode='42501'; end if;
 select * into s from public.supervisor_evaluations where id=p_id;
 if p_mode is null or p_mode not in ('selected','written') or p_publish is null then raise exception 'Select a feedback mode'; end if;
 choices:=public.normalize_evaluation_choices(p_choices);
 reason:=public.evaluation_adjustment_text(s.criteria,p_criteria,p_adjustments);
 if p_remarks is null or length(p_remarks)>1000 then raise exception 'Additional remarks must be at most 1000 characters'; end if;
 if p_mode='selected' then
  if p_publish and jsonb_array_length(choices->'overall')<>1 then raise exception 'Select overall feedback before publication'; end if;
  fields:=public.evaluation_feedback_text(choices,p_remarks);
 else
  if jsonb_typeof(p_written) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_written))<>4 then raise exception 'Written feedback fields required'; end if;
  foreach criterion in array array['summary','strengths','improvements','guidance'] loop
   if jsonb_typeof(p_written->criterion) is distinct from 'string' then raise exception 'Written feedback fields required'; end if;
  end loop;
  fields:=p_written;
 end if;
 if fields is distinct from p_expected_feedback then raise exception 'Feedback preview changed; refresh before publishing' using errcode='40001'; end if;
 if r.status='Published to Intern' then
  if p_publish and r.feedback_mode=p_mode and r.feedback_choices=choices and r.additional_remarks=p_remarks and r.adjustment_reasons=p_adjustments
   and r.criteria=p_criteria and jsonb_build_object('summary',r.summary,'strengths',r.strengths,'improvements',r.improvements,'guidance',r.guidance)=fields then return r; end if;
  raise exception 'Published evaluation is immutable';
 end if;
 if r.revision is distinct from p_expected_revision then raise exception 'Review changed; refresh' using errcode='40001'; end if;
 previous_written:=r.written_feedback;
 if p_mode='written' then previous_written:=fields;
 elsif previous_written is null and coalesce(r.feedback_mode,'written')='written' and (r.summary<>'' or r.strengths<>'' or r.improvements<>'' or r.guidance<>'') then
  previous_written:=jsonb_build_object('summary',r.summary,'strengths',r.strengths,'improvements',r.improvements,'guidance',r.guidance);
 end if;
 update public.evaluation_reviews set feedback_mode=p_mode,feedback_choices=choices,additional_remarks=p_remarks,written_feedback=previous_written,
  legacy_adjustment_reason=coalesce(legacy_adjustment_reason,case when adjustment_reasons='{}'::jsonb and adjustment_reason<>'' then adjustment_reason end),adjustment_reasons=p_adjustments where id=p_id;
 r:=public.save_evaluation_review(p_id,p_expected_revision,fields->>'summary',fields->>'strengths',fields->>'improvements',fields->>'guidance',p_criteria,reason,p_publish);
 return r;
end $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.save_logbook_draft(uuid,uuid,date,date,text,uuid[],integer,integer)
CREATE OR REPLACE FUNCTION public.save_logbook_draft(p_id uuid, p_intern uuid, p_start date, p_end date, p_remarks text, p_evidence uuid[], p_version integer, p_revision integer)
 RETURNS public.logbook_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.logbook_submissions; v public.logbook_versions; previous jsonb; a public.supervisor_assignments; eid uuid;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.supervises_intern(p_intern) then raise exception 'Active Supervisor and explicitly assigned Intern required' using errcode='42501'; end if;
 if p_id is null or p_version is null or p_revision is null or p_version<1 or p_revision<0 or p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<p_start or p_end>(clock_timestamp() at time zone 'Asia/Manila')::date or p_remarks is null or length(p_remarks)>1000
 or p_evidence is null or cardinality(p_evidence)>10 or cardinality(p_evidence)<>(select count(distinct x) from unnest(p_evidence) x) then raise exception 'Valid past covered dates, remarks and at most 10 evidence pages required'; end if;
 select * into s from public.logbook_submissions where id=p_id for update;
 select * into a from public.supervisor_assignments where supervisor_id=auth.uid() and intern_id=p_intern and ended_at is null;
 if s.id is null then
  if p_version is distinct from 1 or p_revision is distinct from 0 then raise exception 'Start a new draft' using errcode='40001'; end if;
  insert into public.logbook_submissions(id,supervisor_id,intern_id,company_id,assignment_id,supervisor_name,intern_name,company_name)
  select p_id,auth.uid(),p_intern,a.company_id,a.id,sp.full_name,ip.full_name,c.name from public.profiles sp,public.profiles ip,public.companies c where sp.id=auth.uid() and ip.id=p_intern and c.id=a.company_id returning * into s;
 else
  if s.supervisor_id<>auth.uid() or s.intern_id<>p_intern or s.assignment_id<>a.id or s.company_id<>a.company_id then raise exception 'Submission ownership or assignment changed' using errcode='42501'; end if;
 end if;
 select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version for update;
 previous:=to_jsonb(v);
 if v.submission_id is not null and v.status='Returned for Correction' then
  if v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Submission changed; refresh' using errcode='40001'; end if;
  update public.logbook_submissions set current_version=current_version+1 where id=p_id returning * into s;
 elsif v.submission_id is not null and (v.status<>'Draft' or v.version is distinct from p_version or v.revision is distinct from p_revision) then
  -- Exact retry of a saved draft is safe, including a lost resubmission response.
  if v.status='Draft' and v.version in (p_version,p_version+1) and v.date_start=p_start and v.date_end=p_end and v.remarks=p_remarks and v.evidence_ids=p_evidence then return v; end if;
  raise exception 'Submitted evidence is immutable or draft changed; refresh' using errcode='40001';
 end if;
 foreach eid in array p_evidence loop
  if not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path
   where e.id=eid and e.logbook_submission_id=p_id and e.uploaded_by=auth.uid() and e.ready_at is not null and e.abandoned_at is null and (e.committed_at is not null or e.expires_at>clock_timestamp())
   and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size) then raise exception 'Successfully uploaded private evidence required'; end if;
 end loop;
 if (select coalesce(sum(byte_size),0) from public.attendance_sheet_evidence where id=any(p_evidence))>52428800 then raise exception 'Evidence limit is 50 MiB total'; end if;
 insert into public.logbook_versions(submission_id,version,date_start,date_end,remarks,evidence_ids)
 values(p_id,s.current_version,p_start,p_end,p_remarks,p_evidence)
 on conflict(submission_id,version) do update set date_start=p_start,date_end=p_end,remarks=p_remarks,evidence_ids=p_evidence,revision=logbook_versions.revision+1 returning * into v;
 update public.attendance_sheet_evidence set committed_at=clock_timestamp() where id=any(p_evidence) and committed_at is null;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'draft_saved',previous,to_jsonb(v));
 return v;
end $function$
;
-- Latest source: migrations/M15_supervisor_evaluations.sql; public.save_supervisor_evaluation(uuid,uuid,date,jsonb,text,integer,boolean)
CREATE OR REPLACE FUNCTION public.save_supervisor_evaluation(p_id uuid, p_intern_id uuid, p_date date, p_criteria jsonb, p_feedback text, p_expected_version integer, p_submit boolean DEFAULT false)
 RETURNS public.supervisor_evaluations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.supervisor_evaluations; a public.supervisor_assignments; coordinator uuid; score integer; criterion text; rating numeric;
begin
 perform pg_advisory_xact_lock(404,1);
 if public.current_role() is distinct from 'supervisor' then raise exception 'Active Supervisor required' using errcode='42501'; end if;
 if p_id is null or p_date is null or p_criteria is null or p_feedback is null or length(p_feedback)>2000 or p_submit is null then raise exception 'Evaluation date, ratings and feedback required'; end if;
 if jsonb_typeof(p_criteria) is distinct from 'object' then raise exception 'Draft ratings must be an object'; end if;
 for criterion in select jsonb_object_keys(p_criteria) loop
  if criterion not in ('punctuality','performance','conduct','communication') or jsonb_typeof(p_criteria->criterion) is distinct from 'number'
  then raise exception 'Use only the four rubric criteria with integer ratings 1 to 5'; end if;
  rating:=(p_criteria->>criterion)::numeric;
  if rating<1 or rating>5 or rating<>trunc(rating) then raise exception 'Integer ratings 1 to 5 required'; end if;
 end loop;
 select * into r from public.supervisor_evaluations where id=p_id for update;
 if found and (r.supervisor_id<>auth.uid() or r.intern_id<>p_intern_id) then raise exception 'Evaluation ownership mismatch' using errcode='42501'; end if;
 -- Exact retry returns the frozen submission, even if the assignment later ends.
 if r.status='Submitted to Coordinator' then
  if p_submit and r.evaluation_date=p_date and r.criteria=p_criteria and r.feedback=p_feedback then return r; end if;
  raise exception 'Submitted evaluation is immutable';
 end if;
 if not public.supervises_intern(p_intern_id) then raise exception 'Current assigned Intern required' using errcode='42501'; end if;
 select * into a from public.supervisor_assignments where supervisor_id=auth.uid() and intern_id=p_intern_id and ended_at is null;
 if r.id is not null and (r.version is distinct from p_expected_version or r.company_id<>a.company_id or r.assignment_id<>a.id) then raise exception 'Draft version or assignment changed; refresh' using errcode='40001'; end if;
 if r.id is null and p_expected_version is distinct from 0 then raise exception 'New draft expects version zero'; end if;
 score:=public.rubric_score(p_criteria);
 if p_submit then
  if score is null then raise exception 'Complete four integer ratings from 1 to 5'; end if;
  select i.instructor_id into coordinator from public.interns i join public.profiles p on p.id=i.instructor_id
  where i.id=p_intern_id and p.role='instructor' and p.status='Active';
  if coordinator is null then raise exception 'No eligible assigned OJT Coordinator. Ask Admin to assign an Active Coordinator before submission.'; end if;
 end if;
 if r.id is null then
  insert into public.supervisor_evaluations(id,supervisor_id,intern_id,company_id,assignment_id,evaluation_date)
  values(p_id,auth.uid(),p_intern_id,a.company_id,a.id,p_date) returning * into r;
 end if;
 update public.supervisor_evaluations set criteria=p_criteria,feedback=p_feedback,evaluation_date=p_date,overall_score=score,
 version=version+1,status=case when p_submit then 'Submitted to Coordinator' else 'Supervisor Draft' end,
 submitted_at=case when p_submit then clock_timestamp() else null end,coordinator_id=coordinator where id=p_id returning * into r;
 if p_submit then insert into public.evaluation_reviews(id,coordinator_id,source_version,criteria) values(r.id,coordinator,r.version,r.criteria); end if;
 return r;
end $function$
;
-- Latest source: migrations/M13_coordinator_operations.sql; public.send_announcement(uuid,text,text,uuid)
CREATE OR REPLACE FUNCTION public.send_announcement(p_request_id uuid, p_title text, p_body text, p_target_intern_id uuid DEFAULT NULL::uuid)
 RETURNS public.announcements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE saved public.announcements; recipients uuid[]; actual uuid[];
BEGIN
 PERFORM pg_advisory_xact_lock(404,1);
 IF public.current_role() IS NULL OR public.current_role() NOT IN ('instructor','admin')
 THEN RAISE EXCEPTION 'Active staff author required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 IF p_request_id IS NULL OR nullif(btrim(p_title),'') IS NULL OR nullif(btrim(p_body),'') IS NULL
 THEN RAISE EXCEPTION 'Retry identity, subject and message required'; END IF;
 SELECT * INTO saved FROM public.announcements WHERE id=p_request_id FOR UPDATE;
 IF FOUND THEN
  IF saved.instructor_id IS DISTINCT FROM auth.uid() OR saved.title IS DISTINCT FROM btrim(p_title)
   OR saved.body IS DISTINCT FROM btrim(p_body) OR saved.target_intern_id IS DISTINCT FROM p_target_intern_id
  THEN RAISE EXCEPTION 'Announcement retry identity reused with different content or author' USING errcode='40001'; END IF;
  RETURN saved; -- Recipients remain frozen, including after reassignment.
 END IF;
 SELECT coalesce(array_agg(i.id ORDER BY i.id),ARRAY[]::uuid[]) INTO recipients
 FROM public.interns i JOIN public.profiles p ON p.id=i.id
 WHERE i.instructor_id=auth.uid() AND p.role='intern' AND p.status='Active'
  AND (p_target_intern_id IS NULL OR i.id=p_target_intern_id);
 IF cardinality(recipients)=0 THEN
  RAISE EXCEPTION 'Select an active assigned intern or a nonempty assigned active roster' USING errcode='42501';
 END IF;
 -- M01 derives the immutable recipient array inside this same INSERT. M02
 -- audit failure aborts everything; no separate recipient transaction exists.
 INSERT INTO public.announcements(id,instructor_id,title,body,target,target_intern_id)
 VALUES(p_request_id,auth.uid(),btrim(p_title),btrim(p_body),
  CASE WHEN p_target_intern_id IS NULL THEN 'All Interns' ELSE 'Personal' END,p_target_intern_id)
 RETURNING * INTO saved;
 SELECT array_agg(x ORDER BY x) INTO actual FROM unnest(saved.recipient_ids) x;
 IF actual IS DISTINCT FROM recipients OR saved.instructor_id IS DISTINCT FROM auth.uid()
  OR saved.title IS DISTINCT FROM btrim(p_title) OR saved.body IS DISTINCT FROM btrim(p_body)
  OR saved.target_intern_id IS DISTINCT FROM p_target_intern_id
 THEN RAISE EXCEPTION 'Announcement audience/content changed during creation; transaction rolled back'; END IF;
 RETURN saved;
END $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.stage_attendance_sheet(uuid,uuid,uuid[],text,text,bigint)
CREATE OR REPLACE FUNCTION public.stage_attendance_sheet(p_id uuid, p_company uuid, p_participants uuid[], p_name text, p_mime text, p_size bigint)
 RETURNS public.attendance_sheet_evidence
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare e public.attendance_sheet_evidence; ext text; participant uuid;
begin
 perform pg_advisory_xact_lock(404,1);
 if public.current_role() is distinct from 'instructor' then raise exception 'Active assigned OJT Coordinator required' using errcode='42501'; end if;
 if p_id is null or p_participants is null or cardinality(p_participants) not between 1 and 50
 or cardinality(p_participants)<>(select count(distinct x) from unnest(p_participants) x)
 or p_name is null or length(p_name) not between 1 and 200 or p_size is null or p_size not between 1 and 10485760 then raise exception 'Valid sheet identity, participants and file details required'; end if;
 foreach participant in array p_participants loop
  if not public.assigned_intern(participant) or not public.manual_company_allowed(participant,p_company)
  or not exists(select 1 from public.profiles where id=participant and role='intern' and status='Active')
  then raise exception 'Every sheet participant must be an assigned Active Intern in this company or retained supervision history' using errcode='42501'; end if;
 end loop;
 ext:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else null end;
 if ext is null then raise exception 'PDF, JPEG or PNG evidence required'; end if;
 select * into e from public.attendance_sheet_evidence where id=p_id for update;
 if found then
  if e.uploaded_by=auth.uid() and e.company_id=p_company and e.participant_ids=p_participants and e.file_name=p_name and e.mime_type=p_mime and e.byte_size=p_size and e.abandoned_at is null then return e; end if;
  raise exception 'Upload identity already used; start a new upload';
 end if;
 insert into public.attendance_sheet_evidence(id,company_id,participant_ids,uploaded_by,file_path,file_name,mime_type,byte_size,expires_at)
 values(p_id,p_company,p_participants,auth.uid(),'sheets/'||p_id::text||'.'||ext,p_name,p_mime,p_size,clock_timestamp()+interval '15 minutes') returning * into e;
 return e;
end $function$
;
-- Latest source: migrations/M08_document_versions.sql; public.stage_document_upload(uuid,text,text,bigint,bigint)
CREATE OR REPLACE FUNCTION public.stage_document_upload(p_id uuid, p_name text, p_mime text, p_size bigint, p_expected_version bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare d public.documents; v public.document_versions; receipt uuid:=gen_random_uuid(); ext text;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into d from public.documents where id=p_id and intern_id=auth.uid() for update;
 if not found or not public.owns_intern(auth.uid()) then raise exception 'Owned requirement required' using errcode='42501'; end if;
 if p_expected_version is distinct from d.upload_version then raise exception 'Document changed; refresh' using errcode='40001'; end if;
 ext:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else null end;
 if ext is null or p_size is null or p_size<=0 or p_size>10485760 or nullif(btrim(p_name),'') is null or length(p_name)>255 or p_name~'[[:cntrl:]]'
 then raise exception 'PDF/JPEG/PNG, 1 byte-10 MiB and valid filename required'; end if;
 insert into public.document_versions(id,document_id,intern_id,expected_version,file_path,file_name,mime_type,byte_size,expires_at)
 values(receipt,d.id,auth.uid(),d.upload_version,auth.uid()::text||'/'||receipt::text||'.'||ext,p_name,p_mime,p_size,clock_timestamp()+interval '15 minutes') returning * into v;
 return jsonb_build_object('id',d.id,'upload',to_jsonb(v));
end $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.stage_logbook_evidence(uuid,uuid,text,text,bigint)
CREATE OR REPLACE FUNCTION public.stage_logbook_evidence(p_id uuid, p_submission uuid, p_name text, p_mime text, p_size bigint)
 RETURNS public.attendance_sheet_evidence
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.logbook_submissions; e public.attendance_sheet_evidence; ext text;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into s from public.logbook_submissions where id=p_submission for update;
 if s.id is null or s.supervisor_id<>auth.uid() or not public.supervises_intern(s.intern_id)
 or not exists(select 1 from public.supervisor_assignments where id=s.assignment_id and ended_at is null)
 or not exists(select 1 from public.logbook_versions where submission_id=s.id and version=s.current_version and status in ('Draft','Returned for Correction')) then raise exception 'Own editable submission and current assignment required' using errcode='42501'; end if;
 ext:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end;
 if p_id is null or p_name is null or length(p_name) not between 1 and 200 or ext is null or p_size is null or p_size not between 1 and 10485760 then raise exception 'PDF, JPEG or PNG up to 10 MiB required'; end if;
 select * into e from public.attendance_sheet_evidence where id=p_id;
 if found then
  if e.logbook_submission_id=p_submission and e.uploaded_by=auth.uid() and e.file_name=p_name and e.mime_type=p_mime and e.byte_size=p_size and e.abandoned_at is null then return e; end if;
  raise exception 'Upload identity already used';
 end if;
 if (select count(*) from public.attendance_sheet_evidence where logbook_submission_id=p_submission and committed_at is null and abandoned_at is null and expires_at>clock_timestamp())>=10 then raise exception 'At most 10 active page uploads; abandon unused uploads first'; end if;
 insert into public.attendance_sheet_evidence(id,company_id,participant_ids,uploaded_by,file_path,file_name,mime_type,byte_size,expires_at,logbook_submission_id)
 values(p_id,s.company_id,array[s.intern_id],auth.uid(),'sheets/'||p_id::text||'.'||ext,p_name,p_mime,p_size,clock_timestamp()+interval '15 minutes',s.id) returning * into e;
 return e;
end $function$
;
-- Latest source: migrations/M10_flexible_submissions.sql; public.stage_submission(uuid,uuid,text,text,jsonb,bigint,bigint)
CREATE OR REPLACE FUNCTION public.stage_submission(p_attempt_id uuid, p_submission_id uuid, p_title text, p_description text, p_files jsonb, p_expected_version bigint, p_expected_revision bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.submissions; v public.submission_versions; f jsonb; n integer:=0; total bigint:=0; ext text; fid uuid; result jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
 if p_attempt_id is null or p_title is null or length(btrim(p_title)) not between 1 and 200 or p_description is null or length(p_description)>2000
 then raise exception 'Title 1-200 and description <=2000 characters required'; end if;
 if jsonb_typeof(p_files) is distinct from 'array' then raise exception 'File manifest required'; end if;
 if jsonb_array_length(p_files) not between 1 and 10 then raise exception 'Select 1-10 files'; end if;
 for f in select value from jsonb_array_elements(p_files) loop
  if jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'name') is distinct from 'string'
   or jsonb_typeof(f->'mime') is distinct from 'string' or jsonb_typeof(f->'size') is distinct from 'number'
   or nullif(btrim(f->>'name'),'') is null or length(f->>'name')>255 or (f->>'name')~'[[:cntrl:]]'
   or (f->>'mime') not in ('application/pdf','image/jpeg','image/png')
   or (f->>'size')::numeric not between 1 and 10485760 or (f->>'size')::numeric<>trunc((f->>'size')::numeric)
  then raise exception 'Each file needs a valid filename, PDF/JPEG/PNG MIME and 1 byte-10 MiB size'; end if;
  total:=total+(f->>'size')::bigint;
 end loop;
 if total>52428800 then raise exception 'File set exceeds 50 MiB'; end if;
 select * into v from public.submission_versions where id=p_attempt_id;
 if found then
  if v.intern_id<>auth.uid() then raise exception 'Reservation not owned' using errcode='42501'; end if;
  if (p_submission_id is not null and p_submission_id<>v.submission_id) or v.title<>btrim(p_title) or v.description<>p_description
    or v.manifest<>p_files or v.expected_version is distinct from p_expected_version or v.expected_revision is distinct from p_expected_revision
  then raise exception 'Attempt ID reused with different content'; end if;
 else
  if p_submission_id is null then
   if p_expected_version is distinct from 0 or p_expected_revision is distinct from 0 then raise exception 'New submission expects version/revision zero'; end if;
   insert into public.submissions(intern_id,title,description) values(auth.uid(),btrim(p_title),p_description) returning * into s;
  else
   select * into s from public.submissions where id=p_submission_id and intern_id=auth.uid() for update;
   if not found then raise exception 'Owned submission required' using errcode='42501'; end if;
   if s.current_version is distinct from p_expected_version or s.review_revision is distinct from p_expected_revision
   then raise exception 'Submission changed; refresh' using errcode='40001'; end if;
  end if;
  insert into public.submission_versions(id,submission_id,intern_id,expected_version,expected_revision,title,description,manifest,expires_at)
   values(p_attempt_id,s.id,auth.uid(),s.current_version,s.review_revision,btrim(p_title),p_description,p_files,clock_timestamp()+interval '15 minutes') returning * into v;
  for f in select value from jsonb_array_elements(p_files) loop
   n:=n+1; fid:=gen_random_uuid(); ext:=case f->>'mime' when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
   insert into public.submission_files(id,version_id,intern_id,ordinal,file_path,file_name,mime_type,byte_size)
    values(fid,v.id,auth.uid(),n,auth.uid()::text||'/'||s.id::text||'/'||v.id::text||'/'||fid::text||'.'||ext,f->>'name',f->>'mime',(f->>'size')::bigint);
  end loop;
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by ordinal),'[]'::jsonb) into result from public.submission_files x where version_id=v.id;
 return jsonb_build_object('id',v.id,'version',to_jsonb(v),'files',result);
end $function$
;
-- Latest source: migrations/M10_flexible_submissions.sql; public.submission_file_access(uuid,uuid)
CREATE OR REPLACE FUNCTION public.submission_file_access(p_id uuid, p_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare f public.submission_files; v public.submission_versions;
begin
 select * into f from public.submission_files where id=p_id and version_id=p_version_id;
 if not found or not public.can_read_intern(f.intern_id) then raise exception 'File access not permitted' using errcode='42501'; end if;
 select * into v from public.submission_versions where id=f.version_id and committed_at is not null;
 if not found or not exists(select 1 from storage.objects where bucket_id='documents' and name=f.file_path)
 then raise exception 'Committed file missing; refresh or request resubmission'; end if;
 return jsonb_build_object('id',f.id,'file_path',f.file_path,'file_name',f.file_name);
end $function$
;
-- Latest source: migrations/M10_flexible_submissions.sql; public.submission_recovery_list()
CREATE OR REPLACE FUNCTION public.submission_recovery_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare result jsonb;
begin
 if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'created_at',v.created_at) order by v.created_at),'[]'::jsonb)
 into result from public.submission_versions v where v.intern_id=auth.uid() and v.committed_at is null
  and (v.abandoned_at is null or exists(select 1 from public.submission_files f join storage.objects o on o.bucket_id='documents' and o.name=f.file_path where f.version_id=v.id));
 if jsonb_array_length(result)>50000 then raise exception 'Recovery list too large; operator assistance required'; end if;
 return jsonb_build_object('id',auth.uid(),'versions',result);
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.submit_correction(date,time without time zone,time without time zone,date,text)
CREATE OR REPLACE FUNCTION public.submit_correction(p_date date, p_in time without time zone, p_out time without time zone, p_end date, p_reason text)
 RETURNS public.attendance_exceptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_exceptions;
begin
  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
  if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Reason required, at most 500 characters'; end if;
  perform * from public.correction_instants(p_date,p_in,p_out,p_end);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,101));
  if exists(select 1 from public.attendance_exceptions where intern_id=auth.uid() and log_date=p_date and status='Pending') then
    raise exception 'A Pending correction already exists for this date' using errcode='40001';
  end if;
  insert into public.attendance_exceptions(intern_id,log_date,claimed_time_in,claimed_time_out,claimed_end_date,reason,status,reviewed_by,created_at)
  values(auth.uid(),p_date,p_in,p_out,p_end,btrim(p_reason),'Pending',null,clock_timestamp()) returning * into r;
  return r;
end $function$
;
-- Latest source: migrations/M01_authority.sql; public.submit_document_upload(uuid,text,text)
CREATE OR REPLACE FUNCTION public.submit_document_upload(p_id uuid, p_path text, p_name text)
 RETURNS public.documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.documents;
begin
  if not public.owns_intern(auth.uid()) then raise exception 'Active intern required' using errcode='42501'; end if;
  select * into r from public.documents where id=p_id and intern_id=auth.uid() for update;
  if not found then raise exception 'Requirement not found' using errcode='40001'; end if;
  if p_path is null or split_part(p_path,'/',1)<>auth.uid()::text
     or cardinality(string_to_array(p_path,'/'))<>2 or split_part(p_path,'/',2) in ('','.','..')
     or nullif(btrim(p_name),'') is null then raise exception 'Own folder and filename required'; end if;
  if not exists(select 1 from storage.objects where bucket_id='documents' and name=p_path) then
    raise exception 'Uploaded object not found';
  end if;
  update public.documents set file_path=p_path,file_name=p_name,status='Pending',note=null,
    reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp() where id=r.id returning * into r;
  return r;
end $function$
;
-- Latest source: migrations/M06_rubric_hours.sql; public.submit_evaluation(uuid,jsonb,text,uuid)
CREATE OR REPLACE FUNCTION public.submit_evaluation(p_intern_id uuid, p_criteria jsonb, p_feedback text, p_submission_id uuid)
 RETURNS public.evaluations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.evaluations; score integer;
begin
 perform pg_advisory_xact_lock(404,1);
 if not public.can_review(p_intern_id) or not exists(select 1 from public.profiles where id=p_intern_id and role='intern')
 then raise exception 'Evaluation not permitted' using errcode='42501'; end if;
 score:=public.rubric_score(p_criteria);
 if score is null or p_submission_id is null or length(p_feedback)>500 then
   raise exception 'Four integer criteria 1-5, submission UUID and feedback <=500 required'; end if;
 select * into r from public.evaluations where evaluator_id=auth.uid() and submission_id=p_submission_id;
 if found then
   if r.intern_id is distinct from p_intern_id or r.competencies is distinct from p_criteria
     or r.feedback is distinct from nullif(btrim(p_feedback),'') then raise exception 'Submission key reused with different content' using errcode='40001'; end if;
   return r;
 end if;
 insert into public.evaluations(intern_id,evaluator_id,competencies,feedback,overall_score,submission_id)
 values(p_intern_id,auth.uid(),p_criteria,nullif(btrim(p_feedback),''),score,p_submission_id) returning * into r;
 return r;
end $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.submit_logbook(uuid,integer,integer)
CREATE OR REPLACE FUNCTION public.submit_logbook(p_id uuid, p_version integer, p_revision integer)
 RETURNS public.logbook_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.logbook_submissions; v public.logbook_versions; recipient uuid; oldv jsonb;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into s from public.logbook_submissions where id=p_id for update;
 if s.id is null or s.supervisor_id<>auth.uid() or not public.supervises_intern(s.intern_id) or not exists(select 1 from public.supervisor_assignments where id=s.assignment_id and ended_at is null) then raise exception 'Current explicit assignment required' using errcode='42501'; end if;
 select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version for update;
 if v.version=p_version and v.status='Pending Review' and v.revision=p_revision+1 then return v; end if;
 if v.status<>'Draft' or v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Draft changed; refresh' using errcode='40001'; end if;
 if cardinality(v.evidence_ids)=0 then raise exception 'Upload and save signed evidence before submission'; end if;
 if exists(select 1 from unnest(v.evidence_ids) eid where not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path where e.id=eid and e.committed_at is not null and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size)) then raise exception 'Preserved signed evidence unavailable'; end if;
 select i.instructor_id into recipient from public.interns i join public.profiles p on p.id=i.instructor_id where i.id=s.intern_id and i.company_id=s.company_id and p.role='instructor' and p.status='Active';
 if recipient is null then raise exception 'No eligible assigned OJT Coordinator. Ask Admin to resolve the assignment; your draft and evidence are saved.'; end if;
 if s.coordinator_id is not null and s.coordinator_id<>recipient then raise exception 'Coordinator changed. Ask Admin to explicitly reroute this submission before resubmitting; draft preserved.'; end if;
 oldv:=to_jsonb(v);
 update public.logbook_submissions set coordinator_id=recipient where id=p_id;
 update public.logbook_versions set status='Pending Review',receiving_coordinator_id=recipient,submitted_at=clock_timestamp(),revision=revision+1 where submission_id=p_id and version=v.version returning * into v;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'submitted',oldv,to_jsonb(v));
 return v;
end $function$
;
-- Latest source: migrations/M15_supervisor_evaluations.sql; public.supervises_intern(uuid)
CREATE OR REPLACE FUNCTION public.supervises_intern(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select coalesce(public.current_role()='supervisor' and exists(
 select 1 from public.supervisor_assignments a join public.interns i on i.id=a.intern_id
 join public.profiles p on p.id=i.id join public.profiles s on s.id=a.supervisor_id
 where a.supervisor_id=auth.uid() and a.intern_id=p_id and a.ended_at is null
 and a.company_id=i.company_id and a.company_id=s.supervisor_company_id and p.role='intern' and p.status='Active'),false)
$function$
;
-- Latest source: migrations/M15_supervisor_evaluations.sql; public.supervisor_roster(uuid,integer)
CREATE OR REPLACE FUNCTION public.supervisor_roster(p_after uuid DEFAULT NULL::uuid, p_size integer DEFAULT 500)
 RETURNS TABLE(id uuid, full_name text, student_id text, company_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select i.id,p.full_name,p.student_id,i.company_id from public.interns i join public.profiles p on p.id=i.id where public.supervises_intern(i.id) and (p_after is null or i.id>p_after) order by i.id limit greatest(1,least(coalesce(p_size,500),500))
$function$
;
-- Latest source: migrations/M08_document_versions.sql; public.unfinished_document_uploads()
CREATE OR REPLACE FUNCTION public.unfinished_document_uploads()
 RETURNS SETOF public.document_versions
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select v.* from public.document_versions v where public.owns_intern(auth.uid()) and v.intern_id=auth.uid()
 and committed_at is null and (abandoned_at is not null or expires_at<=clock_timestamp()) order by created_at
$function$
;
-- Latest source: migrations/M06_rubric_hours.sql; public.valid_required_hours(numeric)
CREATE OR REPLACE FUNCTION public.valid_required_hours(p_value numeric)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select coalesce(p_value::text not in ('NaN','Infinity','-Infinity') and p_value>0
   and p_value<=10000 and p_value=round(p_value,2),false)
$function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.verify_attendance(uuid,timestamp with time zone,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.verify_attendance(p_id uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone)
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 if exists(select 1 from public.attendance_logs where id=p_id and attendance_source='manual_company_sheet') then raise exception 'Review signed sheet using explicit manual attendance verification'; end if;
 return public.verify_attendance_core(p_id,p_expected_in,p_expected_out);
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.verify_attendance_core(uuid,timestamp with time zone,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.verify_attendance_core(p_id uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone)
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_logs;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.attendance_logs where id=p_id;
 if not found or not public.can_review(r.intern_id) then raise exception 'Assigned active staff required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.intern_id::text,101));
 perform 1 from public.profiles where id=auth.uid() for share;
 perform 1 from public.interns where id=r.intern_id for share;
 select * into r from public.attendance_logs where id=p_id for update;
 if not found or not public.can_review(r.intern_id) or not exists(select 1 from public.profiles where id=r.intern_id and role='intern') then raise exception 'Assignment or account changed; refresh' using errcode='42501'; end if;
 if p_expected_in is null or p_expected_out is null or r.clocked_in_at is distinct from p_expected_in or r.clocked_out_at is distinct from p_expected_out then raise exception 'Attendance changed; refresh before reviewing' using errcode='40001'; end if;
 if r.time_in is null or r.time_out is null or r.hours is null
 or r.log_date is distinct from (r.clocked_in_at at time zone 'Asia/Manila')::date
 or r.time_in is distinct from (r.clocked_in_at at time zone 'Asia/Manila')::time
 or r.time_out is distinct from (r.clocked_out_at at time zone 'Asia/Manila')::time
 or r.clocked_out_at<=r.clocked_in_at or r.clocked_out_at-r.clocked_in_at>interval '16 hours'
 or r.clocked_out_at>clock_timestamp() or r.hours is distinct from extract(epoch from r.clocked_out_at-r.clocked_in_at)/3600
 or (r.verified and r.verified_by is null) or (not r.verified and r.verified_by is not null) then raise exception 'Closed trustworthy attendance required; legacy or invalid evidence requires authorized review'; end if;
 if r.verified then return r; end if;
 update public.attendance_logs set verified=true,verified_by=auth.uid() where id=p_id returning * into r;
 return r;
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.verify_manual_attendance(uuid,integer,uuid,timestamp with time zone,timestamp with time zone,boolean)
CREATE OR REPLACE FUNCTION public.verify_manual_attendance(p_id uuid, p_revision integer, p_evidence uuid, p_expected_in timestamp with time zone, p_expected_out timestamp with time zone, p_reviewed boolean)
 RETURNS public.attendance_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.attendance_logs;
begin
 perform pg_advisory_xact_lock(404,1);
 select * into r from public.attendance_logs where id=p_id for update;
 if not found or not public.can_review(r.intern_id) or not public.can_read_attendance_sheet(r.manual_evidence_id) then raise exception 'Authorized attendance/evidence review required' using errcode='42501'; end if;
 if p_reviewed is distinct from true or r.attendance_source<>'manual_company_sheet' or r.manual_revision is distinct from p_revision or r.manual_evidence_id is distinct from p_evidence then raise exception 'Review current encoded session, evidence and signatures before explicit verification'; end if;
 if not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path
 where e.id=p_evidence and e.committed_at is not null and e.abandoned_at is null and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size) then raise exception 'Preserved evidence unavailable; verification blocked'; end if;
 return public.verify_attendance_core(p_id,p_expected_in,p_expected_out);
end $function$
;
-- Latest source: migrations/M18_supervisor_logbook.sql; public.verify_record_logbook(uuid,integer,integer,uuid,jsonb,boolean)
CREATE OR REPLACE FUNCTION public.verify_record_logbook(p_id uuid, p_version integer, p_revision integer, p_request uuid, p_sessions jsonb, p_reviewed boolean)
 RETURNS public.logbook_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.logbook_submissions; v public.logbook_versions; oldv jsonb; item jsonb; pin timestamptz; pout timestamptz; n integer:=0; eid uuid; now_at timestamptz;
begin
 perform pg_advisory_xact_lock(404,1);
 if public.can_review_logbook(p_id) is not true then raise exception 'Assigned receiving Active Coordinator required' using errcode='42501'; end if;
 select * into s from public.logbook_submissions where id=p_id for update;
 perform pg_advisory_xact_lock(hashtextextended(s.intern_id::text,101));
 select * into v from public.logbook_versions where submission_id=p_id and version=s.current_version for update;
 if p_request is null or p_reviewed is distinct from true or jsonb_typeof(p_sessions) is distinct from 'array' or jsonb_array_length(p_sessions) not between 1 and 62 then raise exception 'Confirm evidence and enter 1–62 valid sessions'; end if;
 if v.status='Verified' and v.version=p_version and v.request_id=p_request and v.recorded_sessions=p_sessions then return v; end if;
 if v.status<>'Pending Review' or v.version is distinct from p_version or v.revision is distinct from p_revision then raise exception 'Submission already reviewed or version changed; refresh' using errcode='40001'; end if;
 foreach eid in array v.evidence_ids loop
  if not exists(select 1 from public.attendance_sheet_evidence e join storage.objects o on o.bucket_id='attendance-evidence' and o.name=e.file_path where e.id=eid and e.logbook_submission_id=p_id and e.committed_at is not null and e.abandoned_at is null and o.metadata->>'mimetype'=e.mime_type and (o.metadata->>'size')::numeric=e.byte_size) then raise exception 'Preserved signed evidence unavailable'; end if;
 end loop;
 if cardinality(v.evidence_ids)=0 then raise exception 'Signed evidence required'; end if;
 oldv:=to_jsonb(v); now_at:=clock_timestamp();
 for item in select value from jsonb_array_elements(p_sessions) loop
  n:=n+1;
  begin
   if jsonb_typeof(item) is distinct from 'object' or (select count(*) from jsonb_object_keys(item))<>2 or jsonb_typeof(item->'time_in') is distinct from 'string' or jsonb_typeof(item->'time_out') is distinct from 'string'
   or item->>'time_in'!~'(Z|[+-][0-9]{2}:[0-9]{2})$' or item->>'time_out'!~'(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Both canonical timestamps with explicit offsets required'; end if;
   pin:=(item->>'time_in')::timestamptz; pout:=(item->>'time_out')::timestamptz;
   perform public.check_manual_session(s.intern_id,pin,pout,null);
   if (pin at time zone 'Asia/Manila')::date not between v.date_start and v.date_end or (pout at time zone 'Asia/Manila')::date not between v.date_start and v.date_end then raise exception 'Session dates must fall within submitted covered dates'; end if;
   insert into public.attendance_logs(id,intern_id,log_date,time_in,time_out,clocked_in_at,clocked_out_at,hours,verified,verified_by,verified_at,attendance_source,manual_evidence_id,manual_details,manual_revision,encoded_by,encoded_at,logbook_submission_id,logbook_version)
   values(gen_random_uuid(),s.intern_id,(pin at time zone 'Asia/Manila')::date,(pin at time zone 'Asia/Manila')::time,(pout at time zone 'Asia/Manila')::time,pin,pout,extract(epoch from pout-pin)/3600,true,auth.uid(),now_at,'manual_company_sheet',v.evidence_ids[1],
   jsonb_build_object('company_id',s.company_id,'company_on_sheet',s.company_name,'registered_company_name',s.company_name,'supervisor_on_sheet',s.supervisor_name,'remarks','','source_label','Manual — Company Logbook','signatures_reviewed',true),1,auth.uid(),now_at,s.id,v.version);
  exception when others then raise exception 'Session %: %',n,sqlerrm; end;
 end loop;
 update public.logbook_versions set status='Verified',verified_by=auth.uid(),verified_at=now_at,request_id=p_request,recorded_sessions=p_sessions,revision=revision+1 where submission_id=p_id and version=p_version returning * into v;
 insert into public.logbook_events(submission_id,actor_id,event_kind,before_values,after_values) values(p_id,auth.uid(),'verified_and_recorded',oldv,to_jsonb(v));
 return v;
end $function$
;
-- Latest source: migrations/M17_company_attendance.sql; public.write_manual_attendance_event()
CREATE OR REPLACE FUNCTION public.write_manual_attendance_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 if new.attendance_source='manual_company_sheet' and (tg_op='INSERT' or new is distinct from old) then
  insert into public.manual_attendance_events(attendance_id,intern_id,actor_id,event_kind,before_values,after_values,created_at)
  values(new.id,new.intern_id,auth.uid(),case when tg_op='INSERT' then 'created' when new.verified and not old.verified then 'verified' else 'revised' end,
  case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new),clock_timestamp());
 end if;
 return new;
end $function$
;
-- Latest source: migrations/M02_trusted_audit.sql; public.write_trusted_audit()
CREATE OR REPLACE FUNCTION public.write_trusted_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare before_row jsonb; after_row jsonb; row_data jsonb; changed jsonb;
        actor uuid:=auth.uid(); actor_label text;
begin
  before_row:=case when tg_op<>'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  after_row:=case when tg_op<>'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  if tg_op='UPDATE' and before_row=after_row then return new; end if;
  row_data:=case when tg_op='DELETE' then before_row else after_row end;
  select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into changed
  from (select jsonb_object_keys(before_row || after_row) as k) fields
  where before_row->k is distinct from after_row->k;
  select full_name into actor_label from public.profiles where id=actor;
  -- Minimal metadata: no credentials, file bytes, or whole profile snapshots.
  -- No exception handler: an audit failure aborts the business mutation.
  insert into public.audit_logs(actor_id,actor_name,action,detail,created_at,source,event_data)
  values(actor,coalesce(actor_label,'System / trusted SQL'),tg_table_name || ' ' || lower(tg_op),
    'Record ' || coalesce(row_data->>'id','unknown'),clock_timestamp(),'database-trigger-v2',
    jsonb_build_object('table',tg_table_name,'operation',tg_op,'record_id',row_data->>'id',
      'intern_id',row_data->>'intern_id','changed_fields',changed,
      'previous_status',before_row->>'status','status',after_row->>'status',
      'previous_role',before_row->>'role','role',after_row->>'role',
      'previous_instructor_id',before_row->>'instructor_id','instructor_id',after_row->>'instructor_id',
      'previous_company_id',before_row->>'company_id','company_id',after_row->>'company_id',
      'previous_section_id',before_row->>'section_id','section_id',after_row->>'section_id',
      'previous_required_hours',before_row->'required_hours','required_hours',after_row->'required_hours',
      'entity_label',case when tg_table_name in ('companies','course_sections','academic_years')
        then coalesce(row_data->>'name',row_data->>'label') else null end,
      'previous_entity_label',case when tg_table_name in ('companies','course_sections','academic_years')
        then coalesce(before_row->>'name',before_row->>'label') else null end,
      'reviewed_by',after_row->>'reviewed_by','verified_by',after_row->>'verified_by',
      'context',case when actor is null then 'system-or-sql' else 'authenticated' end));
  if tg_op='DELETE' then return old; end if;
  return new;
end $function$
;

-- M01/M03/M06/M08/M10 constraints; preserve already VALIDATED M05/M09 checks.
-- New-write CHECKs from M03/M06 remain NOT VALID on old history; no backfill.
DO $constraints$
DECLARE m jsonb; r record; actual text; already_valid boolean;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 -- M15 expands the reviewed three-role CHECK without touching rows. Preflight
 -- accepts only known baseline/final definitions, never arbitrary role drift.
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND conname='profiles_role_check'
 AND pg_get_constraintdef(oid) IS DISTINCT FROM (SELECT e->>'def' FROM jsonb_array_elements(m->'baselineChecks') e WHERE e->>'tab'='profiles' AND e->>'name'='profiles_role_check')) THEN
  ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
 END IF;
 -- Baseline CHECKs absent in a supported older catalog can be restored only
 -- by validating existing data. A violation aborts; no value is coerced/deleted.
 FOR r IN SELECT e FROM jsonb_array_elements(m->'baselineChecks') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND conname=r.e->>'name') THEN
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s',r.e->>'tab',r.e->>'name',r.e->>'def');
  ELSE
   EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',r.e->>'tab',r.e->>'name');
  END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'constraints') e ORDER BY CASE e->>'kind' WHEN 'p' THEN 0 WHEN 'u' THEN 1 WHEN 'c' THEN 2 ELSE 3 END LOOP
  SELECT regexp_replace(pg_catalog.pg_get_constraintdef(oid),' NOT VALID$',''),convalidated INTO actual,already_valid FROM pg_catalog.pg_constraint
   WHERE conrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND conname=r.e->>'name';
  IF NOT FOUND THEN
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s%s',r.e->>'tab',r.e->>'name',r.e->>'def',
    CASE WHEN NOT (r.e->>'validated')::boolean THEN ' NOT VALID' ELSE '' END);
  ELSIF actual<>r.e->>'def' THEN RAISE EXCEPTION 'Constraint definition conflict %.%',r.e->>'tab',r.e->>'name'; END IF;
  IF (r.e->>'validated')::boolean AND already_valid IS FALSE THEN
   EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',r.e->>'tab',r.e->>'name');
  END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'indexes') e LOOP
  IF pg_catalog.to_regclass(format('public.%I',r.e->>'name')) IS NULL THEN EXECUTE r.e->>'def'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index i WHERE i.indexrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'name'))
   AND i.indrelid=pg_catalog.to_regclass(format('public.%I',r.e->>'tab')) AND i.indisvalid AND i.indisready AND pg_catalog.pg_get_indexdef(i.indexrelid)=r.e->>'def')
  THEN RAISE EXCEPTION 'Outdated/invalid index public.%: inspect dependencies, no DROP attempted',r.e->>'name'; END IF;
 END LOOP;
END $constraints$;

-- M01/M02/M06/M07/M08/M10/M11 final row/column ACL and RLS contracts.
do $$ begin
 if not exists(select 1 from storage.buckets where id='attendance-evidence') then
  if exists(select 1 from information_schema.columns where table_schema='storage' and table_name='buckets' and column_name='name') then
   execute $bucket$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('attendance-evidence','attendance-evidence',false,10485760,array['application/pdf','image/jpeg','image/png'])$bucket$;
  else
   insert into storage.buckets(id,public,file_size_limit,allowed_mime_types) values('attendance-evidence',false,10485760,array['application/pdf','image/jpeg','image/png']);
  end if;
 end if;
 if not exists(select 1 from storage.buckets where id='attendance-evidence' and not public and file_size_limit=10485760
 and cardinality(allowed_mime_types)=3 and allowed_mime_types @> array['application/pdf','image/jpeg','image/png']) then
  raise exception 'Inspect attendance-evidence bucket drift; no bucket configuration is overwritten';
 end if;
end $$;

-- Replace domain policies intentionally: old permissive OR policies defeat scope.
-- Preserve unrelated tables/functions/provider grants; clear API column grants too.
DO $security$
DECLARE m jsonb; t text; r record; cols text; ddl text;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 EXECUTE 'REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated';
 EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
 FOR t IN SELECT jsonb_array_elements_text(m->'tables') LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  FOR r IN SELECT policyname FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename=t LOOP EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,t); END LOOP;
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
  SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass(format('public.%I',t)) AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT(%s),INSERT(%s),UPDATE(%s),REFERENCES(%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,cols,cols,t);
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'grants') e LOOP EXECUTE format('GRANT %s ON TABLE public.%I TO authenticated',r.e->>'privilege',r.e->>'tab'); END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'columnGrants') e LOOP EXECUTE format('GRANT %s(%I) ON TABLE public.%I TO authenticated',r.e->>'privilege',r.e->>'name',r.e->>'tab'); END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'functions') e LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.e->>'identity');
  IF (r.e->>'allowed')::boolean THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',r.e->>'identity'); END IF;
 END LOOP;
 -- M01 other-bucket predicates stay effective; documents are excluded exactly
 -- once. Existing final managed Storage policies are replaced below, not wrapped.
 FOR r IN SELECT * FROM pg_catalog.pg_policies p WHERE schemaname='storage' AND tablename='objects'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'policies') e WHERE e->>'schema'='storage' AND e->>'name'=p.policyname) LOOP
  ddl:=format('ALTER POLICY %I ON storage.objects',r.policyname);
  IF r.cmd IN ('ALL','SELECT','UPDATE','DELETE') AND coalesce(r.qual,'') NOT LIKE '((bucket_id <> ''documents''::text) AND %)'
  THEN ddl:=ddl||format(' USING (bucket_id <> ''documents'' AND (%s))',coalesce(r.qual,'true')); END IF;
  IF r.cmd IN ('ALL','INSERT','UPDATE') AND coalesce(r.with_check,r.qual,'') NOT LIKE '((bucket_id <> ''documents''::text) AND %)'
  THEN ddl:=ddl||format(' WITH CHECK (bucket_id <> ''documents'' AND (%s))',coalesce(r.with_check,r.qual,'true')); END IF;
  IF ddl<>format('ALTER POLICY %I ON storage.objects',r.policyname) THEN EXECUTE ddl; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'policies') e LOOP
  IF r.e->>'schema'='storage' THEN EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects',r.e->>'name'); END IF;
  ddl:=format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',r.e->>'name',r.e->>'schema',r.e->>'tab',r.e->>'permissive',r.e->>'cmd',
   (SELECT string_agg(CASE WHEN x='public' THEN 'PUBLIC' ELSE quote_ident(x) END,',') FROM jsonb_array_elements_text(r.e->'roles') x));
  IF r.e->>'qual' IS NOT NULL THEN ddl:=ddl||' USING ('||(r.e->>'qual')||')'; END IF;
  IF r.e->>'with_check' IS NOT NULL THEN ddl:=ddl||' WITH CHECK ('||(r.e->>'with_check')||')'; END IF;
  EXECUTE ddl;
 END LOOP;
 -- M08 API DELETE is receipt-scoped by restrictive policies, never global cleanup.
 GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
 -- M04 hardens only this existing bucket. Existing object bytes/history retained.
 UPDATE storage.buckets SET public=false,file_size_limit=10485760,allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'] WHERE id='documents';
END $security$;

-- M01/M02/M03/M07/M08/M10/M11 final triggers, including deferred account guards.
-- Named known triggers are recreated to repair outdated timing/functions/enabling.
DO $triggers$
DECLARE m jsonb; r record;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'triggers') e LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I',r.e->>'name',r.e->>'schema',r.e->>'tab');
  EXECUTE r.e->>'def';
 END LOOP;
END $triggers$;
SET LOCAL check_function_bodies = on;

-- Fail before COMMIT if any final function/policy/ACL/trigger contract differs.
DO $verify$
DECLARE m jsonb; r record; actual record;
BEGIN
 SELECT value INTO m FROM pg_temp.insync_update_contract;
 FOR r IN SELECT * FROM pg_temp.insync_retained_trigger_contract LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
   WHERE t.tgrelid=r.table_oid AND t.tgname=r.trigger_name
    AND pg_catalog.pg_get_triggerdef(t.oid)=r.trigger_definition AND t.tgenabled=r.enabled_mode
    AND p.oid=r.function_oid AND p.proowner='postgres'::regrole
    AND pg_catalog.pg_get_functiondef(p.oid)=r.function_definition AND p.proacl::text IS NOT DISTINCT FROM r.function_acl)
  THEN RAISE EXCEPTION 'Retained academic-year protection changed; update aborted'; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'functions') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(r.e->>'identity') AND p.proowner='postgres'::regrole
   AND pg_catalog.pg_get_functiondef(p.oid)=r.e->>'def' AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
   AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')=(r.e->>'allowed')::boolean)
  THEN RAISE EXCEPTION 'Final RPC/security definition failed: %',r.e->>'identity'; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'triggers') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid=pg_catalog.to_regclass(format('%I.%I',r.e->>'schema',r.e->>'tab'))
   AND t.tgname=r.e->>'name' AND t.tgenabled='O' AND pg_catalog.pg_get_triggerdef(t.oid)=r.e->>'def')
  THEN RAISE EXCEPTION 'Final trigger failed: %.%.%',r.e->>'schema',r.e->>'tab',r.e->>'name'; END IF;
 END LOOP;
 FOR r IN SELECT e FROM jsonb_array_elements(m->'policies') e LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname=r.e->>'schema' AND p.tablename=r.e->>'tab' AND p.policyname=r.e->>'name'
   AND p.permissive=r.e->>'permissive' AND p.cmd=r.e->>'cmd' AND to_jsonb(p.roles::text[])=r.e->'roles'
   AND p.qual IS NOT DISTINCT FROM r.e->>'qual' AND p.with_check IS NOT DISTINCT FROM r.e->>'with_check')
  THEN RAISE EXCEPTION 'Final policy failed: %.%.%',r.e->>'schema',r.e->>'tab',r.e->>'name'; END IF;
 END LOOP;
 FOR r IN SELECT c.oid,c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND m->'tables' ? c.relname LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=r.oid AND relrowsecurity)
   OR pg_catalog.has_table_privilege('anon',r.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  THEN RAISE EXCEPTION 'Final RLS/anon table access failed: %',r.relname; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a, LATERAL pg_catalog.aclexplode(a.attacl) x WHERE a.attrelid=r.oid
   AND x.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid) AND NOT EXISTS
    (SELECT 1 FROM jsonb_array_elements(m->'columnGrants') e WHERE x.grantee='authenticated'::regrole::oid
     AND e->>'tab'=r.relname AND e->>'name'=a.attname AND e->>'privilege'=x.privilege_type))
  THEN RAISE EXCEPTION 'Unexpected API column grant: %',r.relname; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.aclexplode((SELECT relacl FROM pg_catalog.pg_class WHERE oid=r.oid)) x
   WHERE x.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid) AND NOT EXISTS
    (SELECT 1 FROM jsonb_array_elements(m->'grants') e WHERE x.grantee='authenticated'::regrole::oid AND e->>'tab'=r.relname AND e->>'privilege'=x.privilege_type))
  THEN RAISE EXCEPTION 'Unexpected API table grant: %',r.relname; END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='documents' AND NOT public AND file_size_limit=10485760
  AND allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png']::text[])
 THEN RAISE EXCEPTION 'Private documents bucket verification failed'; END IF;
 RAISE NOTICE 'INSync final contracts installed. M05/M09 history validation remains a separate reviewed gate; live API/Auth/Storage still requires verification.';
END $verify$;
-- Delivered only on successful COMMIT; a rollback sends no schema-cache notification.
NOTIFY pgrst, 'reload schema';
COMMIT;

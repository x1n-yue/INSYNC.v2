-- Read-only catalog evidence for an unexpected consolidated-update trigger.
-- Run separately as the trusted SQL Editor operator, after any failed transaction
-- has been rolled back. This file does not alter triggers, functions or records.
-- Results contain definitions, not account rows or Storage contents. Review
-- function bodies for embedded secrets before sharing them outside your project.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';

-- Inventory all user triggers on INSync tables, plus Auth signup. This avoids
-- repeated one-at-a-time failures if more than one live definition is unfamiliar.
SELECT n.nspname AS table_schema, c.relname AS table_name, t.tgname,
       t.tgenabled AS enabled_mode,
       pg_catalog.pg_get_triggerdef(t.oid, true) AS trigger_definition,
       pn.nspname AS function_schema, p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_arguments,
       pg_catalog.pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer, p.proconfig AS function_settings,
       p.proacl::text AS function_acl
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal
  AND ((n.nspname = 'public' AND c.relname IN (
    'companies', 'course_sections', 'academic_years', 'profiles', 'interns',
    'attendance_logs', 'attendance_exceptions', 'evaluations', 'documents',
    'announcements', 'alerts', 'audit_logs', 'document_versions',
    'document_review_events', 'submissions', 'submission_versions',
    'submission_files', 'submission_reviews'))
    OR (n.nspname = 'auth' AND c.relname = 'users'))
ORDER BY n.nspname, c.relname, t.tgname;

-- Exact bodies behind master-data triggers, including m11_retain_year if present.
-- Shared helper routines called by these functions may need separate inspection.
SELECT DISTINCT pn.nspname AS function_schema, p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_arguments,
       pg_catalog.pg_get_functiondef(p.oid) AS function_definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal AND n.nspname = 'public'
  AND c.relname IN ('academic_years', 'companies', 'course_sections')
ORDER BY function_schema, function_name, function_arguments;

-- The supplied retention function references academic_year_id on five tables.
-- Inventory definitions only; do not invent or backfill academic-year values.
SELECT n.nspname AS table_schema,c.relname AS table_name,a.attname AS column_name,
       pg_catalog.format_type(a.atttypid,a.atttypmod) AS column_type,
       a.attnotnull AS required,pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS column_default,
       a.attgenerated AS generated_kind,a.attidentity AS identity_kind
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
WHERE n.nspname='public' AND a.attname='academic_year_id'
  AND a.attnum>0 AND NOT a.attisdropped
ORDER BY c.relname;

SELECT n.nspname AS table_schema,c.relname AS table_name,x.conname AS constraint_name,
       pg_catalog.pg_get_constraintdef(x.oid) AS constraint_definition,x.convalidated AS validated
FROM pg_catalog.pg_constraint x
JOIN pg_catalog.pg_class c ON c.oid=x.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND (
  x.confrelid=pg_catalog.to_regclass('public.academic_years')
  OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid=c.oid AND a.attname='academic_year_id'
      AND a.attnum=ANY(x.conkey) AND NOT a.attisdropped))
ORDER BY c.relname,x.conname;

SELECT n.nspname AS table_schema,c.relname AS table_name,i.relname AS index_name,
       pg_catalog.pg_get_indexdef(i.oid) AS index_definition,
       x.indisvalid AS valid,x.indisready AS ready
FROM pg_catalog.pg_index x
JOIN pg_catalog.pg_class c ON c.oid=x.indrelid
JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND (
  c.relname='academic_years'
  OR pg_catalog.pg_get_indexdef(i.oid) LIKE '%academic_year_id%')
ORDER BY c.relname,i.relname;

-- Include cohort-aware routines: overwriting a different live implementation
-- without inspecting it could change assignment or historical-write behavior.
SELECT n.nspname AS function_schema,p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_arguments,
       pg_catalog.pg_get_functiondef(p.oid) AS cohort_function_definition,
       pg_catalog.pg_get_userbyid(p.proowner) AS function_owner,
       p.proacl::text AS function_acl
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND p.prosrc LIKE '%academic_year_id%'
ORDER BY p.proname,function_arguments;

ROLLBACK;

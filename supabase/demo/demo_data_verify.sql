-- READ ONLY. Run in the NEW project's SQL Editor; confirm its banner/reference.
-- Summarizes exact seeded IDs, current state, pre-existing checklist and audits.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';

WITH
demo_ids AS (
 SELECT kind,slot,('de600001-2026-4000-8000-'||lpad(slot::text,12,'0'))::uuid AS id
 FROM (VALUES ('attendance',101),('attendance',102),('attendance',103),('attendance',104),
  ('attendance',105),('attendance',106),('correction',201),('requirement',301),('requirement',302),
  ('requirement',303),('requirement',304),('requirement',305),('evaluation',401),
  ('announcement',501),('announcement',502)) AS x(kind,slot)
),
accounts AS (
 SELECT x.email,x.expected_role,u.id AS auth_id,p.id AS profile_id,
  u.email_confirmed_at IS NOT NULL AS confirmed,u.deleted_at IS NULL AS not_deleted,
  p.role,p.status
 FROM (VALUES ('fangonbernstain566@gmail.com','admin'),('mangokamen1@gmail.com','instructor'),
  ('hhimii.mu@gmail.com','intern')) AS x(email,expected_role)
 LEFT JOIN auth.users u ON lower(u.email)=x.email
 LEFT JOIN public.profiles p ON p.id=u.id AND lower(p.email)=x.email
),
seeded AS (
 SELECT 'attendance' AS kind,a.id,jsonb_build_object('date',a.log_date,'time_in',a.time_in,'time_out',a.time_out,
  'hours',a.hours,'verified',a.verified,'verified_by',a.verified_by,
  'clocked_in_manila',a.clocked_in_at AT TIME ZONE 'Asia/Manila',
  'clocked_out_manila',a.clocked_out_at AT TIME ZONE 'Asia/Manila','accomplishment',a.accomplishment) AS details
 FROM public.attendance_logs a JOIN demo_ids d ON d.id=a.id AND d.kind='attendance'
 UNION ALL SELECT 'correction',e.id,jsonb_build_object('date',e.log_date,'end_date',e.claimed_end_date,
  'time_in',e.claimed_time_in,'time_out',e.claimed_time_out,'status',e.status,'reason',e.reason,
  'reviewed_by',e.reviewed_by,'review_note',e.review_note)
 FROM public.attendance_exceptions e JOIN demo_ids d ON d.id=e.id AND d.kind='correction'
 UNION ALL SELECT 'requirement',q.id,jsonb_build_object('type',q.doc_type,'name',q.name,'status',q.status,
  'stored_file_reference',q.file_path IS NOT NULL,'upload_version',q.upload_version,'review_revision',q.review_revision,'note',q.note)
 FROM public.documents q JOIN demo_ids d ON d.id=q.id AND d.kind='requirement'
 UNION ALL SELECT 'evaluation',e.id,jsonb_build_object('type',e.type,'criteria',e.competencies,
  'score',e.overall_score,'server_score',public.rubric_score(e.competencies),
  'submission_id',e.submission_id,'evaluator_id',e.evaluator_id,'feedback',e.feedback)
 FROM public.evaluations e JOIN demo_ids d ON d.id=e.id AND d.kind='evaluation'
 UNION ALL SELECT 'announcement',a.id,jsonb_build_object('title',a.title,'body',a.body,
  'target',a.target,'target_intern_id',a.target_intern_id,'sender',a.instructor_id,
  'frozen_recipient_ids',a.recipient_ids,'created_manila',a.created_at AT TIME ZONE 'Asia/Manila')
 FROM public.announcements a JOIN demo_ids d ON d.id=a.id AND d.kind='announcement'
),
counts AS (
 SELECT d.kind,count(s.id) AS present,count(*) AS maximum_seeded FROM demo_ids d
 LEFT JOIN seeded s ON s.kind=d.kind AND s.id=d.id GROUP BY d.kind
),
intern_context AS (
 SELECT i.* FROM public.interns i JOIN accounts a ON a.profile_id=i.id WHERE a.expected_role='intern'
)
SELECT jsonb_pretty(jsonb_build_object(
 'intended_project','tcntyrwwqzyyqlzdtuer',
 'project_verification','Operator must check SQL Editor banner; this value is not auto-detected',
 'demo_tag','[INSync demo:tcntyrwwqzyyqlzdtuer:v1]',
 'accounts',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.email) FROM accounts a),'[]'::jsonb),
 'assignment',coalesce((SELECT jsonb_agg(jsonb_build_object('intern',i.id,'instructor',i.instructor_id,
  'company',i.company_id,'section',i.section_id,'saved_target',i.required_hours)) FROM intern_context i),'[]'::jsonb),
 'seeded_counts',(SELECT jsonb_object_agg(c.kind,jsonb_build_object('present',c.present,'maximum_seeded',c.maximum_seeded)) FROM counts c),
 'seeded_rows',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',s.kind,'id',s.id,'details',s.details) ORDER BY s.kind,s.id) FROM seeded s),'[]'::jsonb),
 'demo_hours',(SELECT jsonb_build_object('logged',coalesce(sum(a.hours),0),
  'verified',coalesce(sum(a.hours) FILTER(WHERE a.verified),0),'unverified',coalesce(sum(a.hours) FILTER(WHERE NOT a.verified),0))
  FROM public.attendance_logs a JOIN demo_ids d ON d.id=a.id AND d.kind='attendance'),
 'lifetime_attendance',(SELECT jsonb_build_object(
  'intern_context_available',(SELECT count(*)=1 FROM intern_context),
  'stored_logged_hours',CASE WHEN EXISTS(SELECT 1 FROM intern_context) THEN coalesce(sum(a.hours),0) END,
  'stored_verified_hours',CASE WHEN EXISTS(SELECT 1 FROM intern_context) THEN coalesce(sum(a.hours) FILTER(WHERE a.verified),0) END,
  'unknown_or_open_rows',CASE WHEN EXISTS(SELECT 1 FROM intern_context) THEN count(*) FILTER(WHERE a.clocked_in_at IS NULL OR a.clocked_out_at IS NULL OR a.hours IS NULL
   OR a.clocked_out_at<=a.clocked_in_at OR a.clocked_out_at-a.clocked_in_at>interval '16 hours'
   OR a.hours<>extract(epoch FROM a.clocked_out_at-a.clocked_in_at)/3600 OR (a.verified AND a.verified_by IS NULL)) END,
  'note','Stored totals are not certified if unknown evidence exists; use the application clearance calculation')
  FROM public.attendance_logs a JOIN intern_context i ON i.id=a.intern_id),
 'all_current_requirements',coalesce((SELECT jsonb_agg(jsonb_build_object('id',q.id,'type',q.doc_type,'name',q.name,
  'status',q.status,'created_by_this_seed',EXISTS(SELECT 1 FROM demo_ids d WHERE d.kind='requirement' AND d.id=q.id),
  'stored_file_reference',q.file_path IS NOT NULL,'upload_version',q.upload_version) ORDER BY q.doc_type,q.id)
  FROM public.documents q JOIN intern_context i ON i.id=q.intern_id),'[]'::jsonb),
 'retained_trusted_audit_events',(SELECT count(*) FROM public.audit_logs a WHERE a.source='database-trigger-v2'
  AND a.event_data->>'record_id'=ANY(ARRAY(SELECT d.id::text FROM demo_ids d))),
 'files','No Storage objects, versions, submissions or file paths are seeded; test uploads in the app'
)) AS demo_summary;
COMMIT;

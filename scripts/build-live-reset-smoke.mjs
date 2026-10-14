// Prepare private rollback-only DB checks from verified test identities.
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8').replace(/^\uFEFF/,'');
const cp=JSON.parse(JSON.parse(read('.insync-recovery/pre-reset-exact.json')).rows.find(r=>r.checkpoint_json).checkpoint_json);
const roles=Object.fromEntries(cp.public_data.profiles.map(p=>[p.role,p.id]));
const A=roles.admin,I=roles.instructor,S=roles.intern;
if(!A||!I||!S)throw Error('Verified test roles missing: no guessing');
const actor=id=>`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',true); SET LOCAL ROLE authenticated;`;
const check=(label,body)=>`DO $test$ ${body} END $test$; INSERT INTO pg_temp.insync_smoke VALUES('${label}');`;
const out=`-- PRIVATE, explicitly authorized test identities; rollback-only, no messages delivered.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';
CREATE TEMP TABLE insync_smoke(check_name text) ON COMMIT DROP;
GRANT INSERT,SELECT ON pg_temp.insync_smoke TO authenticated;
${actor(A)}
${check('Verified Admin profile RPC',`BEGIN IF (public.my_profile()->>'id') IS DISTINCT FROM '${A}' THEN RAISE EXCEPTION 'Admin profile mismatch'; END IF;`)}
SELECT public.admin_set_assignment('${S}','${I}',null,null,8);
SELECT public.attach_standard_docs('${S}');
${actor(I)}
${check('Assigned individual and active-roster announcement RPC; sender history',`DECLARE r public.announcements; BEGIN
 r:=public.send_announcement(p_request_id=>gen_random_uuid(),p_title=>'INSync rollback-only individual',p_body=>'Uncommitted fixture',p_target_intern_id=>'${S}');
 IF r.recipient_ids IS DISTINCT FROM ARRAY['${S}'::uuid] THEN RAISE EXCEPTION 'Incorrect individual audience'; END IF;
 r:=public.send_announcement(p_request_id=>gen_random_uuid(),p_title=>'INSync rollback-only roster',p_body=>'Uncommitted fixture',p_target_intern_id=>null);
 IF r.recipient_ids IS DISTINCT FROM ARRAY['${S}'::uuid] OR (SELECT count(*) FROM public.announcements)<>2 THEN RAISE EXCEPTION 'Incorrect roster/history'; END IF;`)}
${check('Unauthorized recipient and raw announcement writes rejected atomically',`BEGIN
 BEGIN PERFORM public.send_announcement(gen_random_uuid(),'Denied fixture','Uncommitted','${A}'); RAISE EXCEPTION 'Foreign target accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.announcements(instructor_id,title,body,target) VALUES('${I}','Denied raw','No','All Interns'); RAISE EXCEPTION 'Raw write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.announcements)<>2 THEN RAISE EXCEPTION 'Partial announcement persisted'; END IF;`)}
${actor(S)}
${check('Recipient sees intended frozen announcements',`BEGIN IF (SELECT count(*) FROM public.announcements)<>2 THEN RAISE EXCEPTION 'Recipient visibility failed'; END IF;`)}
${check('Server clock-out remains logged and unverified; review metadata/instants preserved',`DECLARE r public.attendance_logs; BEGIN
 r:=public.clock_in();
 PERFORM set_config('request.jwt.claim.sub','${I}',true);
 BEGIN PERFORM public.verify_attendance(r.id,r.clocked_in_at,null); RAISE EXCEPTION 'Open verification accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','${S}',true);
 r:=public.clock_out(r.id,'Rollback-only clock fixture');
 IF r.verified OR r.verified_by IS NOT NULL OR r.hours IS NULL OR r.hours<=0 THEN RAISE EXCEPTION 'Clock evidence/autoverification failure'; END IF;`)}
${actor(I)}
${check('Named verification signature; stale protection and safe repeated verification',`DECLARE r public.attendance_logs; v public.attendance_logs; BEGIN
 SELECT * INTO r FROM public.attendance_logs WHERE intern_id='${S}';
 BEGIN PERFORM public.verify_attendance(p_id=>r.id,p_expected_in=>r.clocked_in_at,p_expected_out=>r.clocked_out_at+interval '1 second'); RAISE EXCEPTION 'Stale verification accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 v:=public.verify_attendance(p_id=>r.id,p_expected_in=>r.clocked_in_at,p_expected_out=>r.clocked_out_at);
 IF NOT v.verified OR v.verified_by IS DISTINCT FROM '${I}'::uuid OR v.hours IS DISTINCT FROM r.hours OR v.clocked_in_at IS DISTINCT FROM r.clocked_in_at OR v.clocked_out_at IS DISTINCT FROM r.clocked_out_at THEN RAISE EXCEPTION 'Verification modified original evidence'; END IF;
 -- No Admin audit read grant is broadened for this count check; idempotency is
 -- confirmed via the same row while native tests also verify audit count.
 v:=public.verify_attendance(r.id,r.clocked_in_at,r.clocked_out_at);
 IF v.hours IS DISTINCT FROM r.hours THEN RAISE EXCEPTION 'Repeated verification changed hours'; END IF;`)}
${check('Authoritative evaluation scoring',`DECLARE r public.evaluations; BEGIN
 r:=public.submit_evaluation('${S}','{"punctuality":5,"performance":4,"conduct":3,"communication":2}','Rollback-only feedback',gen_random_uuid());
 IF r.overall_score<>73 THEN RAISE EXCEPTION 'Server rubric mismatch'; END IF;`)}
${actor(S)}
${check('Intern reads evaluation; cannot perform staff verification',`BEGIN
 IF (SELECT overall_score FROM public.evaluations)<>73 THEN RAISE EXCEPTION 'Own evaluation visibility failed'; END IF;
 BEGIN PERFORM public.verify_attendance((SELECT id FROM public.attendance_logs),null,null); RAISE EXCEPTION 'Intern staff action accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;`)}
${check('Document reservation/recovery authorized; missing physical evidence cannot finalize',`DECLARE d public.documents; r jsonb; BEGIN
 SELECT * INTO d FROM public.documents WHERE doc_type='moa';
 r:=public.stage_document_upload(d.id,'RollbackFixture.pdf','application/pdf',20,0);
 BEGIN PERFORM public.finalize_document_upload((r->'upload'->>'id')::uuid); RAISE EXCEPTION 'Missing physical file accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Missing physical file accepted' THEN RAISE; END IF; END;
 PERFORM public.cancel_document_upload((r->'upload'->>'id')::uuid);
 IF EXISTS(SELECT 1 FROM public.documents WHERE status='Approved' OR upload_version>0) THEN RAISE EXCEPTION 'Clearance evidence fabricated'; END IF;`)}
${check('Flexible complete-set reservation/recovery; missing objects remain uncommitted',`DECLARE r jsonb; BEGIN
 r:=public.stage_submission(gen_random_uuid(),null,'MOA','Rollback-only flexible fixture','[{"name":"Fixture.pdf","mime":"application/pdf","size":20}]',0,0);
 BEGIN PERFORM public.finalize_submission((r->>'id')::uuid); RAISE EXCEPTION 'Missing flexible file accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Missing flexible file accepted' THEN RAISE; END IF; END;
 PERFORM public.cancel_submission((r->>'id')::uuid);
 IF EXISTS(SELECT 1 FROM public.submissions WHERE current_version>0) OR EXISTS(SELECT 1 FROM public.documents WHERE status='Approved') THEN RAISE EXCEPTION 'Flexible/clearance state fabricated'; END IF;`)}
${actor(A)}
SELECT public.admin_set_assignment('${S}',null,null,null,8);
${actor(S)}
${check('Reassignment preserves intended announcement visibility',`BEGIN IF (SELECT count(*) FROM public.announcements)<>2 THEN RAISE EXCEPTION 'Audience rebound after reassignment'; END IF;`)}
${actor(I)}
${check('Unassigned Instructor cannot access or verify another intern records',`BEGIN
 IF EXISTS(SELECT 1 FROM public.attendance_logs) OR EXISTS(SELECT 1 FROM public.documents) OR EXISTS(SELECT 1 FROM public.evaluations) THEN RAISE EXCEPTION 'Unassigned record access'; END IF;
`)}
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
DO $test$ DECLARE r public.attendance_logs; BEGIN
 SELECT * INTO r FROM public.attendance_logs;
 PERFORM set_config('request.jwt.claim.sub','${I}',true);PERFORM set_config('role','authenticated',true);
 BEGIN PERFORM public.verify_attendance(r.id,r.clocked_in_at,r.clocked_out_at); RAISE EXCEPTION 'Unassigned verification accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('role','postgres',true);PERFORM set_config('request.jwt.claim.sub','',true);
END $test$;
${actor(A)}
${check('Last Active Admin protection and authorized audit retrieval',`DECLARE r jsonb; BEGIN
 BEGIN PERFORM public.admin_update_account('${A}','{"status":"Inactive"}'); RAISE EXCEPTION 'Last Admin removed'; EXCEPTION WHEN check_violation THEN NULL; END;
 r:=public.audit_history(); IF (r->>'total')::bigint<1 THEN RAISE EXCEPTION 'Audit retrieval failed'; END IF;`)}
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT jsonb_agg(check_name ORDER BY check_name) AS passed FROM pg_temp.insync_smoke;
ROLLBACK;
`;
writeFileSync(new URL('.insync-recovery/live-rollback-smoke.sql',root),out);
console.log('Prepared private rollback-only smoke SQL. No live changes executed.');

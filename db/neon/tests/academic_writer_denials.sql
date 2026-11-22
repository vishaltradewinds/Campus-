BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/acad-stu','{"uid":"acad-stu","role":"student"}'),
 ('users/acad-inst','{"uid":"acad-inst","role":"institution"}'),
 ('institutions/acad-inst','{"id":"acad-inst","empanelmentStatus":"empanelled"}'),
 ('students/acad-stu','{"id":"acad-stu","institutionId":"acad-inst","graduationYear":2027,"institutionVerificationStatus":"verified","platformVerificationStatus":"verified","campaignConsents":{"camp":{"status":"approved","academicDataShared":true}}}'),
 ('students/acad-other','{"id":"acad-other","institutionId":"other"}');
SET LOCAL ROLE nexustalent_academic_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound academic scope leaked'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','acad-stu',true),set_config('nexustalent.target_id','acad-stu',true),set_config('nexustalent.academic_action','REQUEST_ACADEMIC_CORRECTION',true),set_config('nexustalent.request_id','acad-req-001',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='students/acad-other') THEN RAISE EXCEPTION 'Foreign student visible'; END IF;
 BEGIN UPDATE nexustalent.records SET payload=jsonb_set(payload,'{graduationYear}','2028') WHERE document_path='students/acad-stu'; RAISE EXCEPTION 'Direct academic change'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
WITH e AS (SELECT encode(sha256(convert_to('acad-req-001:acad-stu:REQUEST_ACADEMIC_CORRECTION','UTF8')),'hex') id)
INSERT INTO nexustalent.records(document_path,payload) SELECT 'academicCorrections/'||id,jsonb_build_object('id',id,'studentId','acad-stu','institutionId','acad-inst','status','pending','before',jsonb_build_object('graduationYear',2027),'proposed',jsonb_build_object('graduationYear',2028),'reason','Transcript correction','requestedAt','test') FROM e;
UPDATE nexustalent.records SET payload=payload||jsonb_build_object('academicCorrection',(SELECT payload FROM nexustalent.records WHERE collection='academicCorrections')) WHERE document_path='students/acad-stu';
SELECT set_config('nexustalent.correction_id',encode(sha256(convert_to('acad-req-001:acad-stu:REQUEST_ACADEMIC_CORRECTION','UTF8')),'hex'),true),set_config('nexustalent.actor_uid','acad-inst',true),set_config('nexustalent.academic_action','REVIEW_ACADEMIC_CORRECTION',true),set_config('nexustalent.request_id','acad-review-001',true);
UPDATE nexustalent.records SET payload=payload||'{"status":"approved","reviewedBy":"acad-inst","reviewedAt":"test-review","reviewNote":"Transcript checked"}' WHERE collection='academicCorrections';
DO $$ BEGIN
 BEGIN UPDATE nexustalent.records SET payload=payload||jsonb_build_object('academicCorrection',(SELECT payload FROM nexustalent.records WHERE collection='academicCorrections'),'graduationYear',2028) WHERE document_path='students/acad-stu'; RAISE EXCEPTION 'Approval without revocation'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=payload||jsonb_build_object('academicCorrection',(SELECT payload FROM nexustalent.records WHERE collection='academicCorrections'))||'{"graduationYear":2028,"academicCorrectedAt":"test-review","institutionVerificationStatus":"pending","platformVerificationStatus":"pending","verificationNotes":"Academic correction reviewed; fresh verification required.","campaignConsents":{"camp":{"status":"denied","academicDataShared":false,"skillBenchmarksShared":false,"projectReposShared":false,"contactInfoShared":false,"updatedAt":"test-review","reasonForDenial":"Academic profile corrected; fresh consent required"}}}' WHERE document_path='students/acad-stu';
DO $$ BEGIN IF (SELECT payload->>'graduationYear' FROM nexustalent.records WHERE document_path='students/acad-stu') IS DISTINCT FROM '2028' THEN RAISE EXCEPTION 'Valid correction missing'; END IF; END $$;
ROLLBACK;
BEGIN; SET LOCAL ROLE nexustalent_academic_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Academic context persisted'; END IF; END $$;
ROLLBACK;

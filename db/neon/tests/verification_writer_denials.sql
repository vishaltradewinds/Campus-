BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/verify-admin','{"uid":"verify-admin","role":"super_admin"}'),
 ('users/verify-inst','{"uid":"verify-inst","role":"institution"}'),
 ('institutions/verify-inst','{"id":"verify-inst","empanelmentStatus":"empanelled"}'),
 ('students/verify-own','{"id":"verify-own","institutionId":"verify-inst","institutionVerificationStatus":"pending","platformVerificationStatus":"pending"}'),
 ('students/verify-other','{"id":"verify-other","institutionId":"other","institutionVerificationStatus":"pending"}'),
 ('employers/verify-emp','{"id":"verify-emp","verificationStatus":"pending"}');
SET LOCAL ROLE nexustalent_verification_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound verification leaked'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','verify-admin',true),set_config('nexustalent.admin_claim','false',true),set_config('nexustalent.verification_action','UPDATE_EMPLOYER_VERIFICATION',true),set_config('nexustalent.request_id','verify-001',true),set_config('nexustalent.target_id','verify-emp',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection='employers') THEN RAISE EXCEPTION 'Unclaimed admin access'; END IF;
 UPDATE nexustalent.records SET payload=payload||'{"verificationStatus":"verified","verifiedByAdmin":true}' WHERE document_path='employers/verify-emp';
 IF FOUND THEN RAISE EXCEPTION 'Unclaimed admin write'; END IF;
END $$;
SELECT set_config('nexustalent.admin_claim','true',true);
UPDATE nexustalent.records SET payload=payload||'{"verificationStatus":"verified","verifiedByAdmin":true}' WHERE document_path='employers/verify-emp';
DO $$ BEGIN IF (SELECT payload->>'verificationStatus' FROM nexustalent.records WHERE document_path='employers/verify-emp') IS DISTINCT FROM 'verified' THEN RAISE EXCEPTION 'Valid admin action missing'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','verify-inst',true),set_config('nexustalent.admin_claim','false',true),set_config('nexustalent.verification_action','UPDATE_STUDENT_INSTITUTION_VERIFICATION',true),set_config('nexustalent.target_id','verify-other',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection='students') THEN RAISE EXCEPTION 'Cross-institution student visible'; END IF;
 UPDATE nexustalent.records SET payload=payload||'{"institutionVerificationStatus":"verified","verificationNotes":"evidence"}' WHERE document_path='students/verify-other';
 IF FOUND THEN RAISE EXCEPTION 'Cross-institution update'; END IF;
END $$;
SELECT set_config('nexustalent.target_id','verify-own',true);
DO $$ BEGIN
 BEGIN UPDATE nexustalent.records SET payload=payload||'{"institutionVerificationStatus":"verified","platformVerificationStatus":"verified","verificationNotes":"evidence"}' WHERE document_path='students/verify-own'; RAISE EXCEPTION 'Platform escalation'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE nexustalent.records SET payload=payload||'{"institutionVerificationStatus":"verified","verificationNotes":""}' WHERE document_path='students/verify-own'; RAISE EXCEPTION 'Missing verification evidence'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=payload||'{"institutionVerificationStatus":"verified","verificationNotes":"Synthetic evidence"}' WHERE document_path='students/verify-own';
DO $$ BEGIN IF (SELECT payload->>'institutionVerificationStatus' FROM nexustalent.records WHERE document_path='students/verify-own') IS DISTINCT FROM 'verified' THEN RAISE EXCEPTION 'Valid verification missing'; END IF; END $$;
ROLLBACK;
BEGIN; SET LOCAL ROLE nexustalent_verification_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Verification context persisted'; END IF; END $$;
ROLLBACK;

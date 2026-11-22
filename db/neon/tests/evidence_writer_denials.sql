BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/ev-admin','{"uid":"ev-admin","role":"super_admin"}'),('users/ev-stu','{"uid":"ev-stu","role":"student"}'),
 ('students/ev-stu','{"id":"ev-stu","evidenceIds":[]}'),('institutions/ev-inst','{"id":"ev-inst","empanelmentStatus":"empanelled"}'),
 ('careerEvidence/ev-source','{"id":"ev-source","studentId":"ev-stu","status":"under_review","sourceType":"institution","sourceId":"ev-inst","lineageHash":"old"}'),
 ('careerEvidence/ev-foreign','{"id":"ev-foreign","studentId":"other","status":"verified"}');
SET LOCAL ROLE nexustalent_evidence_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound evidence leaked'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','ev-admin',true),set_config('nexustalent.evidence_action','REVIEW_CAREER_EVIDENCE',true),set_config('nexustalent.evidence_id','ev-source',true),set_config('nexustalent.request_id','ev-review-001',true),set_config('nexustalent.admin_claim','false',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection='careerEvidence') THEN RAISE EXCEPTION 'Unclaimed admin evidence access'; END IF; END $$;
SELECT set_config('nexustalent.admin_claim','true',true);
DO $$ BEGIN
 BEGIN UPDATE nexustalent.records SET payload=payload||jsonb_build_object('status','verified','reviewedBy','ev-admin','reviewedAt','test','disputeStatus','none','lineageHash',repeat('a',64),'sourceId','forged') WHERE collection='careerEvidence'; RAISE EXCEPTION 'Provenance altered'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=payload||jsonb_build_object('status','verified','reviewedBy','ev-admin','reviewedAt','test','disputeStatus','none','lineageHash',repeat('a',64)) WHERE collection='careerEvidence';
UPDATE nexustalent.records SET payload=payload||'{"evidenceIds":["ev-source"]}' WHERE collection='students';
SELECT set_config('nexustalent.actor_uid','ev-stu',true),set_config('nexustalent.admin_claim','false',true),set_config('nexustalent.evidence_action','DISPUTE_CAREER_EVIDENCE',true),set_config('nexustalent.evidence_id','ev-foreign',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection='careerEvidence') THEN RAISE EXCEPTION 'Foreign evidence visible'; END IF; END $$;
SELECT set_config('nexustalent.evidence_id','ev-source',true);
DO $$ BEGIN
 BEGIN UPDATE nexustalent.records SET payload=payload||jsonb_build_object('status','rejected','disputeStatus','open','disputeReason','Synthetic dispute','disputeOpenedBy','ev-stu','lineageHash',repeat('b',64)) WHERE collection='careerEvidence'; RAISE EXCEPTION 'Student changed verification status'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=payload||jsonb_build_object('disputeStatus','open','disputeReason','Synthetic dispute','disputeOpenedBy','ev-stu','lineageHash',repeat('b',64)) WHERE collection='careerEvidence';
ROLLBACK;
BEGIN; SET LOCAL ROLE nexustalent_evidence_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Evidence context persisted'; END IF; END $$;
ROLLBACK;

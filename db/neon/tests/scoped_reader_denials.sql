-- Synthetic data and test roles only. Run as the disposable CI owner.
BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/rls-admin','{"uid":"rls-admin","role":"super_admin"}'),
 ('users/rls-inst','{"uid":"rls-inst","role":"institution"}'),
 ('institutions/rls-inst','{"id":"rls-inst","empanelmentStatus":"pending_empanelment"}'),
 ('opportunities/rls-own','{"id":"rls-own","studentId":"ci-student","employerId":"ci-employer","institutionId":"rls-inst"}'),
 ('opportunities/rls-other','{"id":"rls-other","studentId":"outside","employerId":"outside","institutionId":"outside"}'),
 ('campaigns/rls-target','{"id":"rls-target","employerId":"ci-employer","targetedInstitutionIds":["rls-inst"]}'),
 ('campaigns/rls-other','{"id":"rls-other","employerId":"outside","targetedInstitutionIds":["outside"]}'),
 ('careerEvidence/rls-own','{"id":"rls-own","studentId":"ci-student","status":"verified"}'),
 ('careerEvidence/rls-queue','{"id":"rls-queue","studentId":"outside","status":"submitted"}'),
 ('auditEvents/rls-hidden','{"id":"rls-hidden"}');
SET LOCAL ROLE nexustalent_reader_ci;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Missing context leaked rows'; END IF;
END $$;
SELECT set_config('nexustalent.actor_uid','ci-student',true),set_config('nexustalent.admin_claim','true',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM nexustalent.records)<>4 THEN RAISE EXCEPTION 'Student scope mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path IN ('users/rls-admin','opportunities/rls-other','careerEvidence/rls-queue')) THEN RAISE EXCEPTION 'Student cross-tenant leak'; END IF;
 IF has_table_privilege(current_user,'nexustalent.records','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Reader has write privilege'; END IF;
 BEGIN
  UPDATE nexustalent.records SET payload='{}' WHERE document_path='students/ci-student';
  RAISE EXCEPTION 'Unexpected reader write';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SELECT set_config('nexustalent.actor_uid','rls-inst',true),set_config('nexustalent.admin_claim','false',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='campaigns/rls-target') OR EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path IN ('campaigns/rls-other','opportunities/rls-other','users/ci-student')) THEN RAISE EXCEPTION 'Institution scope mismatch'; END IF;
END $$;
SELECT set_config('nexustalent.actor_uid','ci-employer',true),set_config('nexustalent.admin_claim','false',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='opportunities/rls-own') OR EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path IN ('students/ci-student','opportunities/rls-other','careerEvidence/rls-own')) THEN RAISE EXCEPTION 'Employer scope mismatch'; END IF;
END $$;
SELECT set_config('nexustalent.actor_uid','rls-admin',true),set_config('nexustalent.admin_claim','false',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM nexustalent.records)<>1 THEN RAISE EXCEPTION 'Unclaimed admin scope mismatch'; END IF;
END $$;
SELECT set_config('nexustalent.admin_claim','true',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='careerEvidence/rls-queue') OR EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path IN ('careerEvidence/rls-own','auditEvents/rls-hidden','students/ci-student')) THEN RAISE EXCEPTION 'Claimed admin scope mismatch'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE nexustalent_reader_ci;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Transaction context persisted'; END IF;
END $$;
ROLLBACK;
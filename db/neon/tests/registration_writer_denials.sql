BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
SET LOCAL ROLE nexustalent_registrar_ci;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound registrar leaked records'; END IF;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('users/rls-reg','{"uid":"rls-reg","role":"student","email":"test@example.test"}');
  RAISE EXCEPTION 'Unbound registration succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SELECT set_config('nexustalent.actor_uid','rls-reg',true),set_config('nexustalent.registration_email','test@example.test',true),set_config('nexustalent.registration_role','student',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='users/ci-student') THEN RAISE EXCEPTION 'Registrar leaked another identity'; END IF;
 IF has_table_privilege(current_user,'nexustalent.records','UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Registrar can modify existing rows'; END IF;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('users/rls-reg','{"uid":"rls-reg","role":"super_admin","email":"test@example.test"}');
  RAISE EXCEPTION 'Admin escalation succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('users/rls-other','{"uid":"rls-other","role":"student","email":"test@example.test"}');
  RAISE EXCEPTION 'Cross-actor insert succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('users/rls-reg','{"uid":"rls-reg","role":"student","email":"forged@example.test"}');
  RAISE EXCEPTION 'Email substitution succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('students/rls-reg','{"id":"rls-reg","email":"test@example.test","platformVerificationStatus":"pending","institutionVerificationStatus":"pending"}');
  RAISE EXCEPTION 'Orphan profile inserted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES ('users/rls-reg','{"uid":"rls-reg","role":"student","email":"test@example.test","name":"Synthetic"}');
DO $$ BEGIN
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('employers/rls-reg','{"id":"rls-reg","verificationStatus":"pending","verified":false,"contactEmail":"test@example.test"}');
  RAISE EXCEPTION 'Cross-role profile inserted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('students/rls-reg','{"id":"rls-reg","email":"test@example.test","platformVerificationStatus":"verified","institutionVerificationStatus":"pending"}');
  RAISE EXCEPTION 'Self-verification succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('requirements/rls-reg','{"id":"rls-reg","employerId":"rls-reg"}');
  RAISE EXCEPTION 'Unrelated collection write succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE nexustalent.records SET payload='{}' WHERE document_path='users/rls-reg';
  RAISE EXCEPTION 'Account overwrite succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('auditEvents/forged','{"eventId":"forged","actorUid":"rls-reg","actorRole":"student","action":"REGISTER_STAKEHOLDER","immutable":true,"ids":["rls-reg"]}');
  RAISE EXCEPTION 'Forged audit identifier succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES ('students/rls-reg','{"id":"rls-reg","email":"test@example.test","platformVerificationStatus":"pending","institutionVerificationStatus":"pending"}');
WITH e AS (SELECT encode(sha256(convert_to('REGISTER_STAKEHOLDER:rls-reg','UTF8')),'hex') AS id)
INSERT INTO nexustalent.records(document_path,payload)
 SELECT 'auditEvents/'||id,jsonb_build_object('eventId',id,'actorUid','rls-reg','actorRole','student','action','REGISTER_STAKEHOLDER','immutable',true,'ids',jsonb_build_array('rls-reg')) FROM e;
DO $$ BEGIN
 IF (SELECT count(*) FROM nexustalent.records WHERE document_path='users/rls-reg' OR document_path='students/rls-reg' OR payload->>'actorUid'='rls-reg')<>3 THEN RAISE EXCEPTION 'Registration rows not visible'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE nexustalent_registrar_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Registration context persisted'; END IF; END $$;
ROLLBACK;
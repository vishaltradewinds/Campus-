-- Synthetic CI data only; rollback all fixtures.
BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/offer-reader-student','{"uid":"offer-reader-student","role":"student"}'),
 ('users/offer-reader-employer','{"uid":"offer-reader-employer","role":"employer"}'),
 ('offers/offer-reader-own','{"id":"offer-reader-own","studentId":"offer-reader-student","status":"issued","currency":"INR"}'),
 ('offers/offer-reader-foreign','{"id":"offer-reader-foreign","studentId":"foreign","status":"issued","currency":"INR"}'),
 ('offers/offer-reader-invalid','{"id":"offer-reader-invalid","studentId":"offer-reader-student","status":"draft","currency":"INR"}');
SET LOCAL ROLE nexustalent_reader_ci;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection='offers') THEN RAISE EXCEPTION 'Missing context leaked offers'; END IF;
END $$;
SELECT set_config('nexustalent.actor_uid','offer-reader-student',true),set_config('nexustalent.admin_claim','false',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM nexustalent.records WHERE collection='offers')<>1 OR NOT EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='offers/offer-reader-own') THEN RAISE EXCEPTION 'Student offer scope mismatch'; END IF;
 IF has_table_privilege(current_user,'nexustalent.records','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Reader has write privilege'; END IF;
END $$;
SELECT set_config('nexustalent.actor_uid','offer-reader-employer',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection='offers') THEN RAISE EXCEPTION 'Employer offer reader access widened'; END IF;
END $$;
ROLLBACK;

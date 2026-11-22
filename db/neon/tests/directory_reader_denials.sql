BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('institutions/dir-public','{"id":"dir-public","name":"Synthetic campus","code":"D1","empanelmentStatus":"empanelled","privateField":"not disclosed"}'),
 ('institutions/dir-pending','{"id":"dir-pending","name":"Pending campus","code":"D2","empanelmentStatus":"pending"}'),
 ('users/dir-private','{"uid":"dir-private","role":"student"}');
SET LOCAL ROLE nexustalent_directory_ci;
DO $$ BEGIN
 IF has_table_privilege(current_user,'nexustalent.records','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(current_user,'nexustalent.records','SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Raw table access granted'; END IF;
 IF (SELECT row_to_json(r)::jsonb FROM nexustalent.registration_directory() r WHERE id='dir-public') IS DISTINCT FROM '{"id":"dir-public","name":"Synthetic campus","code":"D1"}'::jsonb THEN RAISE EXCEPTION 'Directory scope mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM nexustalent.registration_directory() WHERE id='dir-pending') THEN RAISE EXCEPTION 'Unapproved institution visible'; END IF;
 BEGIN PERFORM payload FROM nexustalent.records; RAISE EXCEPTION 'Raw record read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM nexustalent.actor_role(); RAISE EXCEPTION 'Unrelated function allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;

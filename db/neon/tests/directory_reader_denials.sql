BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('institutions/dir-public','{"id":"dir-public","name":"Synthetic campus","code":"D1","empanelmentStatus":"empanelled","privateField":"not disclosed"}'),
 ('institutions/dir-pending','{"id":"dir-pending","name":"Pending campus","code":"D2","empanelmentStatus":"pending"}'),
 ('users/dir-private','{"uid":"dir-private","role":"student"}');
INSERT INTO nexustalent.records(document_path,payload)
 SELECT 'institutions/zz-page-'||lpad(i::text,3,'0'),jsonb_build_object('id','zz-page-'||lpad(i::text,3,'0'),'name','Synthetic campus','code','CI-'||i,'empanelmentStatus','empanelled','privateField','not disclosed') FROM generate_series(1,205) i;
SET LOCAL ROLE nexustalent_directory_ci;
DO $$ BEGIN
 IF has_table_privilege(current_user,'nexustalent.records','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(current_user,'nexustalent.records','SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Raw table access granted'; END IF;
 IF (SELECT row_to_json(r)::jsonb FROM nexustalent.registration_directory() r WHERE id='dir-public') IS DISTINCT FROM '{"id":"dir-public","name":"Synthetic campus","code":"D1"}'::jsonb THEN RAISE EXCEPTION 'Directory scope mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM nexustalent.registration_directory() WHERE id='dir-pending') THEN RAISE EXCEPTION 'Unapproved institution visible'; END IF;
 IF (SELECT count(*) FROM nexustalent.registration_directory_page('zz-page-000'))<>101 THEN RAISE EXCEPTION 'First page size mismatch'; END IF;
 IF (SELECT count(*) FROM nexustalent.registration_directory_page('zz-page-100'))<>101 THEN RAISE EXCEPTION 'Second page size mismatch'; END IF;
 IF (SELECT array_agg(id ORDER BY id) FROM nexustalent.registration_directory_page('zz-page-200')) IS DISTINCT FROM ARRAY['zz-page-201','zz-page-202','zz-page-203','zz-page-204','zz-page-205'] THEN RAISE EXCEPTION 'Final page mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM nexustalent.registration_directory_page('') WHERE id='dir-pending') THEN RAISE EXCEPTION 'Unapproved institution visible through page'; END IF;
 IF (SELECT row_to_json(r)::jsonb FROM nexustalent.registration_directory_page('') r WHERE id='dir-public') IS DISTINCT FROM '{"id":"dir-public","name":"Synthetic campus","code":"D1"}'::jsonb THEN RAISE EXCEPTION 'Paged directory scope mismatch'; END IF;
 BEGIN PERFORM nexustalent.registration_directory_page('bad/cursor'); RAISE EXCEPTION 'Invalid cursor accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Invalid directory cursor' THEN RAISE; END IF; END;
 BEGIN PERFORM payload FROM nexustalent.records; RAISE EXCEPTION 'Raw record read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM nexustalent.actor_role(); RAISE EXCEPTION 'Unrelated function allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;

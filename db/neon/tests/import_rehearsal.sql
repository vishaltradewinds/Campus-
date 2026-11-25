-- Synthetic import rehearsal on disposable CI only. No external input.
DO $$
BEGIN
 IF current_database() <> 'nexustalent_ci' OR current_user <> 'postgres' THEN
  RAISE EXCEPTION 'Disposable CI database required';
 END IF;
 IF EXISTS (SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Empty target required'; END IF;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES
   ('users/fixture-student','{"uid":"fixture-student","role":"student"}'),
   ('students/fixture-student','{"id":"fixture-student","institutionId":"fixture-campus"}'),
   ('institutions/fixture-campus','{"id":"fixture-campus"}'),
   ('employers/fixture-employer','{"id":"fixture-employer"}'),
   ('users/fixture-campus','{"uid":"fixture-campus","role":"institution"}'),
   ('users/fixture-employer','{"uid":"fixture-employer","role":"employer"}');
  IF (SELECT count(*) FROM nexustalent.records) <> 6 THEN RAISE EXCEPTION 'Import count mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM nexustalent.records s JOIN nexustalent.records i ON i.document_path='institutions/'||(s.payload->>'institutionId') WHERE s.document_path='students/fixture-student') THEN RAISE EXCEPTION 'Relationship missing'; END IF;
  BEGIN
   INSERT INTO nexustalent.records(document_path,payload) VALUES ('offers/fixture-rollback','{}'),('users/fixture-bad','{"uid":"wrong","role":"student"}');
   RAISE EXCEPTION 'Invalid import accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM nexustalent.records WHERE document_path='offers/fixture-rollback') THEN RAISE EXCEPTION 'Partial insert survived'; END IF;
  BEGIN
   INSERT INTO nexustalent.records(document_path,payload) VALUES ('students/fixture-student','{"id":"fixture-student"}');
   RAISE EXCEPTION 'Duplicate import accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  RAISE EXCEPTION 'Rollback rehearsal' USING ERRCODE='ZX002';
 EXCEPTION WHEN SQLSTATE 'ZX002' THEN NULL;
 END;
 IF EXISTS (SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Import rollback left data'; END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO nexustalent.records(document_path,payload) VALUES
      ('users/__synthetic_probe__','{"uid":"__synthetic_probe__","role":"student"}'),
      ('students/__synthetic_probe__','{"id":"__synthetic_probe__","institutionId":"test-campus"}'),
      ('auditEvents/__synthetic_probe__','{"action":"SYNTHETIC"}');
    UPDATE nexustalent.records SET payload=payload||'{"availability":"actively_seeking"}' WHERE document_path='students/__synthetic_probe__';
    IF (SELECT revision FROM nexustalent.records WHERE document_path='students/__synthetic_probe__')<>2 THEN RAISE EXCEPTION 'revision not incremented'; END IF;
    BEGIN
      INSERT INTO nexustalent.records(document_path,payload) VALUES ('users/__invalid__','{"uid":"other","role":"student"}');
      RAISE EXCEPTION 'identity constraint unexpectedly allowed mismatch';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE nexustalent.records SET payload='{}' WHERE document_path='auditEvents/__synthetic_probe__';
      RAISE EXCEPTION 'audit update unexpectedly allowed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    SET LOCAL ROLE nexustalent_api;
    IF (SELECT count(*) FROM nexustalent.records)<>0 THEN RAISE EXCEPTION 'RLS leaked data'; END IF;
    BEGIN
      INSERT INTO nexustalent.records(document_path,payload) VALUES ('users/__runtime_probe__','{"uid":"__runtime_probe__","role":"student"}');
      RAISE EXCEPTION 'RLS unexpectedly accepted write';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
    RAISE EXCEPTION 'Rollback synthetic fixture' USING ERRCODE='ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END
$$;
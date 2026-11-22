-- DISPOSABLE CI ONLY. Never apply to Neon or a shared/production database.
DO $$ BEGIN IF current_database() <> 'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE nexustalent_runtime_ci LOGIN PASSWORD 'synthetic-ci-only' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB INHERIT;
GRANT nexustalent_api TO nexustalent_runtime_ci;
-- Intentionally permissive fixture to test server business transactions, NOT production RLS.
CREATE POLICY ci_disposable_read ON nexustalent.records FOR SELECT TO nexustalent_api USING (true);
CREATE POLICY ci_disposable_insert ON nexustalent.records FOR INSERT TO nexustalent_api WITH CHECK (true);
CREATE POLICY ci_disposable_update ON nexustalent.records FOR UPDATE TO nexustalent_api USING (true) WITH CHECK (true);
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/ci-employer','{"uid":"ci-employer","role":"employer"}'),
 ('employers/ci-employer','{"id":"ci-employer","name":"Synthetic employer","verificationStatus":"verified"}'),
 ('users/ci-student','{"uid":"ci-student","role":"student"}'),
 ('students/ci-student','{"id":"ci-student","name":"Synthetic student"}');
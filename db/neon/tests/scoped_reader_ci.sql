-- Disposable CI only. This credential is never deployed.
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE nexustalent_reader_ci LOGIN PASSWORD 'synthetic-reader-ci' INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_reader TO nexustalent_reader_ci;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE nexustalent_disclosure_ci LOGIN PASSWORD 'synthetic-disclosure-ci' INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_disclosure_writer TO nexustalent_disclosure_ci;

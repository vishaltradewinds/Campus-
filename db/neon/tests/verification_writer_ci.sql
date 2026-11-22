DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE nexustalent_verification_ci LOGIN PASSWORD 'synthetic-verification-ci' INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_verification_writer TO nexustalent_verification_ci;

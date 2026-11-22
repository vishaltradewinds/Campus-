-- Disposable CI only.
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE nexustalent_registrar_ci LOGIN PASSWORD 'synthetic-registrar-ci' INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_registrar TO nexustalent_registrar_ci;
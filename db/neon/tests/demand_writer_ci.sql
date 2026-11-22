DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE nexustalent_demand_ci LOGIN PASSWORD 'synthetic-demand-ci' INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_demand_writer TO nexustalent_demand_ci;
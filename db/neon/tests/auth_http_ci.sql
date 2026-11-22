-- Disposable role fixtures only.
DO $$ BEGIN IF current_database()<>'nexustalent_ci' OR current_user<>'postgres' THEN RAISE EXCEPTION 'CI only'; END IF; END $$;
CREATE ROLE nexustalent_login_ci LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD 'synthetic-login-ci';
CREATE ROLE nexustalent_session_ci LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD 'synthetic-session-ci';
GRANT nexustalent_login_api TO nexustalent_login_ci;
GRANT nexustalent_session_reader TO nexustalent_session_ci;

CREATE ROLE nexustalent_enrollment_ci LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD 'synthetic-enrollment-ci';
GRANT nexustalent_enrollment_api TO nexustalent_enrollment_ci;

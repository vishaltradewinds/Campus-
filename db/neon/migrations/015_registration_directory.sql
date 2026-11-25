-- Fixed, function-only registration directory. No direct table grants to the API login.
CREATE ROLE nexustalent_directory_reader NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE nexustalent_directory_resolver NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_directory_resolver TO CURRENT_USER;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_directory_reader,nexustalent_directory_resolver;
GRANT SELECT ON nexustalent.records TO nexustalent_directory_resolver;
CREATE POLICY registration_directory_resolve ON nexustalent.records FOR SELECT TO nexustalent_directory_resolver USING (
 collection='institutions' AND document_path NOT LIKE '%/%/%' AND payload->>'empanelmentStatus'='empanelled');
CREATE FUNCTION nexustalent.registration_directory() RETURNS TABLE(id text,name text,code text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records r WHERE r.collection='institutions' AND (jsonb_typeof(r.payload->'id') IS DISTINCT FROM 'string' OR r.document_path IS DISTINCT FROM 'institutions/'||(r.payload->>'id') OR jsonb_typeof(r.payload->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(r.payload->'code') IS DISTINCT FROM 'string')) THEN RAISE EXCEPTION 'Malformed institution directory'; END IF;
 RETURN QUERY SELECT r.payload->>'id',r.payload->>'name',r.payload->>'code' FROM nexustalent.records r WHERE r.collection='institutions' AND r.document_path NOT LIKE '%/%/%' AND r.payload->>'empanelmentStatus'='empanelled' ORDER BY r.document_path LIMIT 101;
END
$$;
REVOKE ALL ON FUNCTION nexustalent.registration_directory() FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent TO nexustalent_directory_resolver;
ALTER FUNCTION nexustalent.registration_directory() OWNER TO nexustalent_directory_resolver;
REVOKE CREATE ON SCHEMA nexustalent FROM nexustalent_directory_resolver;
GRANT EXECUTE ON FUNCTION nexustalent.registration_directory() TO nexustalent_directory_reader;

-- Keyset paging keeps the registration lookup bounded without truncating the
-- complete directory. The existing zero-argument function remains compatible.
CREATE FUNCTION nexustalent.registration_directory_page(after_id text) RETURNS TABLE(id text,name text,code text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF after_id IS NULL OR length(after_id)>200 OR position('/' in after_id)>0 OR after_id IN ('.','..') THEN RAISE EXCEPTION 'Invalid directory cursor'; END IF;
 IF EXISTS(SELECT 1 FROM nexustalent.records r WHERE r.collection='institutions' AND (jsonb_typeof(r.payload->'id') IS DISTINCT FROM 'string' OR r.document_path IS DISTINCT FROM 'institutions/'||(r.payload->>'id') OR jsonb_typeof(r.payload->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(r.payload->'code') IS DISTINCT FROM 'string')) THEN RAISE EXCEPTION 'Malformed institution directory'; END IF;
 RETURN QUERY SELECT r.payload->>'id',r.payload->>'name',r.payload->>'code' FROM nexustalent.records r
 WHERE r.collection='institutions' AND r.document_path NOT LIKE '%/%/%' AND r.payload->>'empanelmentStatus'='empanelled'
 AND r.document_path COLLATE "C" > ('institutions/'||after_id) COLLATE "C" ORDER BY r.document_path COLLATE "C" LIMIT 101;
END
$$;
REVOKE ALL ON FUNCTION nexustalent.registration_directory_page(text) FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent TO nexustalent_directory_resolver;
ALTER FUNCTION nexustalent.registration_directory_page(text) OWNER TO nexustalent_directory_resolver;
REVOKE CREATE ON SCHEMA nexustalent FROM nexustalent_directory_resolver;
GRANT EXECUTE ON FUNCTION nexustalent.registration_directory_page(text) TO nexustalent_directory_reader;

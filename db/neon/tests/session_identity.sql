BEGIN;
DO $$ BEGIN
 IF current_database()<>'nexustalent_ci' OR current_user<>'postgres' THEN RAISE EXCEPTION 'CI only'; END IF;
END $$;
INSERT INTO nexustalent_identity.principals(uid,email,disabled,admin_authorized) VALUES
 ('fixture-active','active@example.invalid',false,false),('fixture-admin','admin@example.invalid',false,true),('fixture-disabled','disabled@example.invalid',true,false);
INSERT INTO nexustalent_identity.sessions(token_hash,uid,created_at,expires_at,revoked_at) VALUES
 (repeat('a',64),'fixture-active',now()-interval '1 minute',now()+interval '1 hour',null),
 (repeat('b',64),'fixture-admin',now()-interval '1 minute',now()+interval '1 hour',null),
 (repeat('c',64),'fixture-disabled',now()-interval '1 minute',now()+interval '1 hour',null),
 (repeat('d',64),'fixture-active',now()-interval '2 hours',now()-interval '1 hour',null),
 (repeat('e',64),'fixture-active',now()-interval '1 minute',now()+interval '1 hour',now());
SET LOCAL ROLE nexustalent_session_reader;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM nexustalent_identity.resolve_session(repeat('a',64)) WHERE uid='fixture-active' AND NOT admin_claim) THEN RAISE EXCEPTION 'Active session failed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM nexustalent_identity.resolve_session(repeat('b',64)) WHERE admin_claim) THEN RAISE EXCEPTION 'Admin failed'; END IF;
 IF EXISTS (SELECT 1 FROM nexustalent_identity.resolve_session(repeat('c',64))) OR EXISTS (SELECT 1 FROM nexustalent_identity.resolve_session(repeat('d',64))) OR EXISTS (SELECT 1 FROM nexustalent_identity.resolve_session(repeat('e',64))) OR EXISTS (SELECT 1 FROM nexustalent_identity.resolve_session('invalid')) THEN RAISE EXCEPTION 'Invalid session accepted'; END IF;
 BEGIN
  PERFORM 1 FROM nexustalent_identity.sessions;
  RAISE EXCEPTION 'Raw session access allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE nexustalent_identity.principals SET admin_authorized=true;
  RAISE EXCEPTION 'Principal mutation allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;

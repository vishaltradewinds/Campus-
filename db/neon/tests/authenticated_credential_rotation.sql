-- PostgreSQL16 disposable acceptance only. No real accounts or live data.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'nexustalent_ci' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'Disposable CI only';
 END IF;
END $$;

INSERT INTO nexustalent_identity.principals(uid,email,admin_authorized,disabled) VALUES
 ('rotation-ci','rotation@example.invalid',false,false),
 ('rotation-admin','rotation-admin@example.invalid',true,false),
 ('rotation-disabled','rotation-disabled@example.invalid',false,true);
INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES
 ('rotation-ci','rotation@example.invalid','scrypt-v1:'||repeat('a',32)||':'||repeat('b',128)),
 ('rotation-admin','rotation-admin@example.invalid','scrypt-v1:'||repeat('a',32)||':'||repeat('b',128)),
 ('rotation-disabled','rotation-disabled@example.invalid','scrypt-v1:'||repeat('a',32)||':'||repeat('b',128));
INSERT INTO nexustalent_identity.sessions(token_hash,uid,expires_at) VALUES
 (repeat('1',64),'rotation-ci',clock_timestamp()+interval '1 hour'),
 (repeat('2',64),'rotation-ci',clock_timestamp()+interval '1 hour'),
 (repeat('3',64),'rotation-admin',clock_timestamp()+interval '1 hour'),
 (repeat('4',64),'rotation-disabled',clock_timestamp()+interval '1 hour'),
 (repeat('5',64),'rotation-ci',clock_timestamp()+interval '1 hour');
UPDATE nexustalent_identity.sessions SET revoked_at=clock_timestamp() WHERE token_hash=repeat('5',64);

SET LOCAL ROLE nexustalent_login_api;
DO $$
DECLARE old_hash text := 'scrypt-v1:'||repeat('a',32)||':'||repeat('b',128);
        new_hash text := 'scrypt-v1:'||repeat('c',32)||':'||repeat('d',128);
BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent_identity.credential_for_session(repeat('3',64))) THEN
  RAISE EXCEPTION 'Administrator exposed to password-change service';
 END IF;
 IF EXISTS(SELECT 1 FROM nexustalent_identity.credential_for_session(repeat('4',64))) THEN
  RAISE EXCEPTION 'Disabled principal exposed';
 END IF;
 IF EXISTS(SELECT 1 FROM nexustalent_identity.credential_for_session(repeat('5',64))) THEN
  RAISE EXCEPTION 'Revoked session exposed';
 END IF;
 IF nexustalent_identity.change_credential(repeat('1',64),'broken',new_hash) THEN
  RAISE EXCEPTION 'Wrong expected hash changed password';
 END IF;
 IF nexustalent_identity.change_credential(repeat('3',64),old_hash,new_hash) THEN
  RAISE EXCEPTION 'Admin password changed';
 END IF;
 IF nexustalent_identity.change_credential(repeat('4',64),old_hash,new_hash) THEN
  RAISE EXCEPTION 'Disabled account password changed';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM nexustalent_identity.credential_for_session(repeat('1',64))) THEN
  RAISE EXCEPTION 'Valid ordinary session not found';
 END IF;
 IF NOT nexustalent_identity.change_credential(repeat('1',64),old_hash,new_hash) THEN
  RAISE EXCEPTION 'Valid credential rotation rejected';
 END IF;
 IF nexustalent_identity.change_credential(repeat('2',64),old_hash,new_hash) THEN
  RAISE EXCEPTION 'Other previous session reused';
 END IF;
 IF EXISTS(SELECT 1 FROM nexustalent_identity.credential_for_session(repeat('1',64))) THEN
  RAISE EXCEPTION 'Rotated session still resolves';
 END IF;
 BEGIN
  UPDATE nexustalent_identity.credentials SET password_hash=old_hash WHERE uid='rotation-ci';
  RAISE EXCEPTION 'Direct credential table update unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE nexustalent_identity.sessions SET revoked_at=NULL WHERE uid='rotation-ci';
  RAISE EXCEPTION 'Direct session table update unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;

DO $$
DECLARE new_hash text := 'scrypt-v1:'||repeat('c',32)||':'||repeat('d',128);
BEGIN
 IF (SELECT password_hash FROM nexustalent_identity.credentials WHERE uid='rotation-ci')<>new_hash THEN
  RAISE EXCEPTION 'Credential change not committed';
 END IF;
 IF (SELECT count(*) FROM nexustalent_identity.sessions WHERE uid='rotation-ci' AND revoked_at IS NULL)<>0 THEN
  RAISE EXCEPTION 'Old sessions remained active after change';
 END IF;
 IF (SELECT count(*) FROM nexustalent_identity.sessions WHERE uid='rotation-ci')<>3 THEN
  RAISE EXCEPTION 'Unexpected session record loss';
 END IF;
 IF (SELECT password_hash FROM nexustalent_identity.credentials WHERE uid='rotation-admin')=new_hash THEN
  RAISE EXCEPTION 'Administrator credential mutated';
 END IF;
END $$;
ROLLBACK;

import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import express from 'express';
import {hashPassword,createCredentialService} from '../server/postgresCredentials';
import {createPostgresSessionVerifier} from '../server/postgresSessionIdentity';
import {createStandaloneAuthRouter} from '../server/standaloneAuthRouter';
import {createBrowserAuthRouter} from '../server/browserAuthRouter';
assert.equal(process.env.NODE_ENV,'test');
assert.equal(process.env.NEXUSTALENT_STANDALONE_AUTH_TEST,'1');
assert.equal(process.env.NEXUSTALENT_AUTH_PG_CI,'1');
const poolFor=(key:string,username:string)=>{
 const raw=process.env[key];assert.ok(raw);const u=new URL(raw);
 assert.equal(u.protocol,'postgresql:');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'5432');assert.equal(u.pathname,'/nexustalent_ci');assert.equal(u.username,username);assert.equal(u.search,'');assert.equal(u.hash,'');
 return new pg.Pool({connectionString:raw,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});
};
const owner=poolFor('NEXUSTALENT_AUTH_OWNER_CI_URL','postgres');
const login=poolFor('NEXUSTALENT_AUTH_LOGIN_CI_URL','nexustalent_login_ci');
const reader=poolFor('NEXUSTALENT_AUTH_READER_CI_URL','nexustalent_session_ci');
test.after(async()=>{await Promise.all([owner.end(),login.end(),reader.end()]);});
test('real PostgreSQL HTTP login, scoped session validation, logout and disabled account',async()=>{
 const uid='standalone-auth-http-ci', email='standalone-auth-http@example.invalid', password='synthetic-password-for-ci';
 const hash=await hashPassword(password);
 const app=express();
 const service=createCredentialService((q,p)=>login.query(q,p));
 const verify=createPostgresSessionVerifier((q,p)=>reader.query(q,p));
 app.use('/auth',createStandaloneAuthRouter(service));
 app.get('/protected',async(req,res)=>{const result=await verify(req.get('authorization')?.slice(7)||'');return res.status(result.status==='verified'?200:401).json(result);});
 let server:ReturnType<typeof app.listen>|undefined;
 try{
  for(const [p,role] of [[login,'nexustalent_login_ci'],[reader,'nexustalent_session_ci']] as const){
   const state=await p.query("SELECT current_user AS role,current_database() AS db,NOT (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb) AS restricted FROM pg_roles WHERE rolname=current_user");
   assert.deepEqual(state.rows[0],{role,db:'nexustalent_ci',restricted:true});
   await assert.rejects(()=>p.query('SELECT * FROM nexustalent_identity.credentials'),(e:any)=>e.code==='42501');
   await assert.rejects(()=>p.query('SELECT * FROM nexustalent_identity.sessions'),(e:any)=>e.code==='42501');
  }
  await assert.rejects(()=>reader.query("SELECT nexustalent_identity.issue_session('x','x','x')"),(e:any)=>e.code==='42501');
  await assert.rejects(()=>login.query("SELECT * FROM nexustalent_identity.resolve_session('x')"),(e:any)=>e.code==='42501');
  await owner.query('INSERT INTO nexustalent_identity.principals(uid,email) VALUES ($1,$2)',[uid,email]);
  await owner.query('INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES ($1,$2,$3)',[uid,email,hash]);
  server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));
  const address=server.address();assert.ok(address&&typeof address!=='string');const base='http://127.0.0.1:'+address.port;
  const signIn=(p:string)=>fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login:email,password:p})});
  assert.equal((await signIn('incorrect-password')).status,401);
  const response=await signIn(password);assert.equal(response.status,200);const {token}=await response.json();
  const headers={authorization:'Bearer '+token};
  const r=await fetch(base+'/protected',{headers});assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'verified',identity:{uid,email,adminClaim:false}});
  assert.equal((await fetch(base+'/auth/logout',{method:'POST',headers})).status,204);
  assert.equal((await fetch(base+'/protected',{headers})).status,401);
  const second=await signIn(password);assert.equal(second.status,200);const next=await second.json();
  await owner.query('UPDATE nexustalent_identity.principals SET disabled=true WHERE uid=$1',[uid]);
  assert.equal((await fetch(base+'/protected',{headers:{authorization:'Bearer '+next.token}})).status,401);
  assert.equal((await signIn(password)).status,401);
 }finally{
  if(server)await new Promise<void>((r,j)=>server!.close(e=>e?j(e):r()));
  await owner.query('DELETE FROM nexustalent_identity.principals WHERE uid=$1',[uid]);
 }
 const result=await owner.query('SELECT count(*)::int AS n FROM nexustalent_identity.sessions WHERE uid=$1',[uid]);assert.equal(result.rows[0].n,0);
});

test('real PostgreSQL browser cookie login, session and logout',async()=>{
 const uid='standalone-browser-ci',email='standalone-browser@example.invalid',password='synthetic-browser-password';
 const origin='https://127.0.0.1:4443';
 const app=express();
 app.use('/auth',createBrowserAuthRouter(createCredentialService((q,p)=>login.query(q,p)),createPostgresSessionVerifier((q,p)=>reader.query(q,p)),origin));
 let server:ReturnType<typeof app.listen>|undefined;
 try{
  await owner.query('INSERT INTO nexustalent_identity.principals(uid,email) VALUES ($1,$2)',[uid,email]);
  await owner.query('INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES ($1,$2,$3)',[uid,email,await hashPassword(password)]);
  server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));
  const address=server.address();assert.ok(address&&typeof address!=='string');const base='http://127.0.0.1:'+address.port+'/auth';
  const signIn=(o:string,p:string)=>fetch(base+'/login',{method:'POST',headers:{origin:o,'content-type':'application/json'},body:JSON.stringify({login:email,password:p})});
  assert.equal((await signIn('https://foreign.invalid',password)).status,403);
  assert.equal((await signIn(origin,'incorrect-password')).status,401);
  const r=await signIn(origin,password);assert.equal(r.status,204);assert.equal(await r.text(),'');
  const set=r.headers.get('set-cookie');assert.ok(set&&set.includes('HttpOnly')&&set.includes('Secure')&&set.includes('SameSite=Strict'));
  const cookie=set.split(';')[0];
  const session=()=>fetch(base+'/session',{headers:{cookie}});
  assert.deepEqual(await (await session()).json(),{status:'authenticated',principal:{uid,email}});
  assert.equal((await fetch(base+'/logout',{method:'POST',headers:{cookie,origin:'https://foreign.invalid'}})).status,403);
  assert.equal((await session()).status,200);
  assert.equal((await fetch(base+'/logout',{method:'POST',headers:{cookie,origin}})).status,204);
  assert.equal((await session()).status,401);
  const state=await owner.query('SELECT count(*)::int AS n FROM nexustalent_identity.sessions WHERE uid=$1 AND revoked_at IS NOT NULL',[uid]);assert.equal(state.rows[0].n,1);
 }finally{
  if(server)await new Promise<void>((r,j)=>server!.close(e=>e?j(e):r()));
  await owner.query('DELETE FROM nexustalent_identity.principals WHERE uid=$1',[uid]);
 }
});

test('real PG16 cookie password change atomically revokes every ordinary session',async()=>{
 const uid='standalone-rotation-ci',email='standalone-rotation@example.invalid';
 const old='synthetic-old-password-long',replacement='synthetic-new-password-long';
 const origin='https://127.0.0.1:4443';
 const service=createCredentialService((q,p)=>login.query(q,p));
 const verify=createPostgresSessionVerifier((q,p)=>reader.query(q,p));
 const app=express();app.use('/auth',createBrowserAuthRouter(service,verify,origin));
 let server:ReturnType<typeof app.listen>|undefined;
 try{
  await owner.query('INSERT INTO nexustalent_identity.principals(uid,email) VALUES($1,$2)',[uid,email]);
  await owner.query('INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES($1,$2,$3)',[uid,email,await hashPassword(old)]);
  server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));
  const a=server.address();assert.ok(a&&typeof a!=='string');
  const base='http://127.0.0.1:'+a.port+'/auth';
  const signIn=(password:string)=>fetch(base+'/login',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({login:email,password})});
  const first=await signIn(old),second=await signIn(old);
  assert.equal(first.status,204);assert.equal(second.status,204);
  const cookie1=first.headers.get('set-cookie')!.split(';')[0];
  const cookie2=second.headers.get('set-cookie')!.split(';')[0];
  assert.notEqual(cookie1,cookie2);
  const verifyCookie=(cookie:string)=>fetch(base+'/session',{headers:{cookie}});
  assert.equal((await verifyCookie(cookie1)).status,200);
  assert.equal((await verifyCookie(cookie2)).status,200);
  const change=await fetch(base+'/password',{method:'POST',headers:{'content-type':'application/json',origin,cookie:cookie1},body:JSON.stringify({currentPassword:old,newPassword:replacement})});
  assert.equal(change.status,204);
  assert.match(change.headers.get('set-cookie')||'',/__Host-nexustalent-session=;/);
  assert.equal((await verifyCookie(cookie1)).status,401);
  assert.equal((await verifyCookie(cookie2)).status,401);
  assert.equal((await signIn(old)).status,401);
  const current=await signIn(replacement);assert.equal(current.status,204);
  assert.equal((await verifyCookie(current.headers.get('set-cookie')!.split(';')[0])).status,200);
  const active=await owner.query('SELECT count(*)::int AS n FROM nexustalent_identity.sessions WHERE uid=$1 AND revoked_at IS NULL',[uid]);
  assert.equal(active.rows[0].n,1);
 }finally{
  if(server)await new Promise<void>((r,j)=>server!.close(e=>e?j(e):r()));
  await owner.query('DELETE FROM nexustalent_identity.principals WHERE uid=$1',[uid]);
 }
});


test('real PG16 concurrent issuance cannot use a password rotated in an overlapping transaction',async()=>{
 const uid='standalone-rotation-race-ci',email='standalone-rotation-race@example.invalid';
 const old=await hashPassword('synthetic-race-old-password');
 const replacement=await hashPassword('synthetic-race-new-password');
 const originalToken='a'.repeat(64),staleToken='b'.repeat(64),newToken='c'.repeat(64);
 const loginPid=(await login.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
 const tx=await owner.connect();
 let open=false;
 let attempt:Promise<{issued:boolean,error?:unknown}>|undefined;
 try{
  await tx.query('INSERT INTO nexustalent_identity.principals(uid,email) VALUES($1,$2)',[uid,email]);
  await tx.query('INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES($1,$2,$3)',[uid,email,old]);
  assert.equal((await login.query('SELECT nexustalent_identity.issue_session($1,$2,$3) AS issued',[uid,old,originalToken])).rows[0].issued,true);
  await tx.query('BEGIN');open=true;
  assert.equal((await tx.query('SELECT nexustalent_identity.change_credential($1,$2,$3) AS changed',[originalToken,old,replacement])).rows[0].changed,true);
  let settled=false;
  attempt=login.query('SELECT nexustalent_identity.issue_session($1,$2,$3) AS issued',[uid,old,staleToken])
   .then(r=>({issued:r.rows[0].issued as boolean}),error=>({issued:false,error})).finally(()=>{settled=true;});
  // Observe the actual lock wait rather than rely on a fixed sleep.
  let waiting=false;
  for(let i=0;i<50&&!settled;i++){
   await tx.query('SELECT pg_stat_clear_snapshot()');
   const state=await tx.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[loginPid]);
   if(state.rows[0]?.wait_event_type==='Lock'){waiting=true;break;}
   await new Promise(r=>setTimeout(r,20));
  }
  await tx.query('COMMIT');open=false;
  const result=await attempt;
  assert.equal(result.error,undefined);
  assert.equal(waiting,true,'issuance must wait for the credential lock');
  assert.equal(result.issued,false,'stale password cannot issue a session');
  assert.equal((await login.query('SELECT nexustalent_identity.issue_session($1,$2,$3) AS issued',[uid,replacement,newToken])).rows[0].issued,true);
  const active=await tx.query('SELECT token_hash FROM nexustalent_identity.sessions WHERE uid=$1 AND revoked_at IS NULL',[uid]);
  assert.deepEqual(active.rows,[{token_hash:newToken}]);
 }finally{
  if(open)await tx.query('ROLLBACK');
  if(attempt)await attempt;
  await tx.query('DELETE FROM nexustalent_identity.principals WHERE uid=$1',[uid]);
  tx.release();
 }
});

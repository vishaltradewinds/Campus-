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

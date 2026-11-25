// Chromium virtual authenticator signs real WebAuthn assertions over HTTPS.
// Synthetic pre-enrolled public key and in-memory review fixture only.
// Does not attest hardware passkeys, production enrollment, or live database.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import express from 'express';
import {createServer} from 'node:https';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createAdminPasskeySessionAcceptance} from '../server/adminPasskeySessionAcceptance.ts';
import {createAdminReviewAcceptanceRouter} from '../server/adminReviewAcceptanceRouter.ts';
assert.equal(process.env.NODE_ENV,'test');
const env={NODE_ENV:'test',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'};
const origin='https://localhost:4444',uid='browser-admin-ci';
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const credentialId=randomBytes(32);
const account={uid,email:'browser-admin@example.invalid',role:'super_admin',enabled:true,adminAuthorized:true};
let enabled=true,writes=0;
const sessions=createAdminPasskeySessionAcceptance({
 origin,credentials:[{uid,credentialId:credentialId.toString('base64url'),publicKeyPem:publicKey.export({type:'spki',format:'pem'}).toString()}],
 lookupAdminAccount:async requested=>requested===uid&&enabled?{status:'verified',account}:{status:'denied'}
},env);
const app=express();
app.get('/',(_req,res)=>res.type('html').send('<!doctype html><title>Isolated administrator passkey acceptance</title><h1>Administrator acceptance fixture</h1>'));
app.use('/auth',express.json({limit:'8kb'}),(req,res,next)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.get('origin')!==origin||req.get('cookie')||req.get('authorization')||req.get('sec-fetch-site')==='cross-site')return res.sendStatus(403);
 next();
});
app.post('/auth/challenge',(req,res)=>{
 const c=sessions.issueChallenge(req.body?.credentialId);
 return c?res.json(c):res.sendStatus(401);
});
app.post('/auth/assertion',async(req,res)=>{
 const result=await sessions.authenticate(req.body);
 return result.status==='verified'?res.json(result):res.sendStatus(result.status==='denied'?401:503);
});
app.use('/admin',createAdminReviewAcceptanceRouter({origin,verify:sessions.verify,review:async input=>{
 assert.equal(input.actorUid,uid);assert.equal(input.adminClaim,true);
 assert.equal(input.payload.employerId,'browser-employer-ci');
 writes++;return {replayed:false,auditEventId:'a'.repeat(64),ids:['browser-employer-ci']};
}},env));
const dir=await mkdtemp(join(tmpdir(),'nexus-admin-browser-'));
let server,browser;
try{
 const key=join(dir,'key.pem'),cert=join(dir,'cert.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost','-keyout',key,'-out',cert],{stdio:'ignore'});
 server=createServer({key:await readFile(key),cert:await readFile(cert)},app);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4444,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP localhost 127.0.0.1']});
 const context=await browser.newContext({ignoreHTTPSErrors:true});
 const page=await context.newPage(),cdp=await context.newCDPSession(page);
 await cdp.send('WebAuthn.enable');
 const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{
  protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true
 }});
 await cdp.send('WebAuthn.addCredential',{authenticatorId,credential:{
  credentialId:credentialId.toString('base64'),isResidentCredential:false,rpId:'localhost',
  privateKey:privateKey.export({type:'pkcs8',format:'der'}).toString('base64'),signCount:0
 }});
 await page.goto(origin);
 const result=await page.evaluate(async id=>{
  const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
  const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const post=(url,body,token)=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  const challenge=await (await post('/auth/challenge',{credentialId:id})).json();
  const credential=await navigator.credentials.get({publicKey:{challenge:decode(challenge.challenge),rpId:'localhost',allowCredentials:[{id:decode(id),type:'public-key'}],userVerification:'required',timeout:10000}});
  const assertion={credentialId:encode(credential.rawId),clientDataJSON:encode(credential.response.clientDataJSON),authenticatorData:encode(credential.response.authenticatorData),signature:encode(credential.response.signature)};
  const auth=await post('/auth/assertion',assertion);
  if(auth.status!==200)throw Error('Signed WebAuthn assertion was denied: '+auth.status);
  const login=await auth.json();
  const review={action:'UPDATE_EMPLOYER_VERIFICATION',requestId:'browser-review-001',payload:{employerId:'browser-employer-ci',status:'verified',notes:'Synthetic browser evidence'}};
  const ordinary=await post('/admin/reviews',review,'ordinary-session');
  const accepted=await post('/admin/reviews',review,login.token);
  const replay=await post('/auth/assertion',assertion);
  return {ordinary:ordinary.status,review:accepted.status,replay:replay.status,token:login.token};
 },credentialId.toString('base64url'));
 assert.equal(result.ordinary,401);assert.equal(result.review,201);assert.equal(result.replay,401);assert.equal(writes,1);
 enabled=false;
 const denied=await page.evaluate(async token=>(await fetch('/admin/reviews',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({action:'UPDATE_EMPLOYER_VERIFICATION',requestId:'browser-review-002',payload:{employerId:'browser-employer-ci',status:'rejected',notes:'Synthetic evidence'}})})).status,result.token);
 assert.equal(denied,401);assert.equal(writes,1);
 enabled=true;assert.equal((await sessions.verify(result.token)).status,'denied');
 console.log('PASS: Chromium virtual WebAuthn assertion, isolated admin session, review authorization, replay and revocation; synthetic fixture only.');
 await context.close();
}finally{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 await rm(dir,{recursive:true,force:true});
}

import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {build} from 'esbuild';
import express from 'express';
import {createServer} from 'node:https';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createBrowserAuthRouter} from '../server/browserAuthRouter.ts';
import {createCookieAuthorization} from '../server/cookieAuthorization.ts';
assert.equal(process.env.NODE_ENV,'test');
assert.equal(process.env.NEXUSTALENT_STANDALONE_AUTH_TEST,'1');
const origin='https://127.0.0.1:4443';
const real=process.env.NEXUSTALENT_AUTH_PG_CI==='1';
const actors=['student','institution','employer'].map(role=>({uid:real?'ci-new-'+role:'browser-'+role,email:real?'ci-new-'+role+'@example.test':role+'@example.invalid',name:'Synthetic '+role,role}));
const password='Synthetic-browser-only-123456';
const sessions=new Map();
let service={
 async login(email,passwordInput){const actor=actors.find(x=>x.email===email);if(!actor||passwordInput!==password)return null;const token=randomBytes(32).toString('base64url');sessions.set(token,actor);return token;},
 async logout(token){return sessions.delete(token);}
};
let verify=async token=>{const a=sessions.get(token);return a?{status:'verified',identity:{uid:a.uid,email:a.email,adminClaim:false}}:{status:'denied'};};
const baseEntry="import React from 'react';import {createRoot} from 'react-dom/client';import {StandaloneStakeholderAcceptance} from './src/components/StandaloneStakeholderAcceptance.tsx';";
const entry=real?baseEntry+"import {StandaloneDashboardAcceptance} from './src/components/StandaloneDashboardAcceptance.tsx';createRoot(document.getElementById('root')).render(React.createElement(StandaloneStakeholderAcceptance,{renderDashboard:identity=>React.createElement(StandaloneDashboardAcceptance,{identity})}));":baseEntry+"createRoot(document.getElementById('root')).render(React.createElement(StandaloneStakeholderAcceptance));";
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'browser-acceptance-entry.tsx',loader:'tsx'},bundle:true,write:false,platform:'browser',metafile:true,define:{'process.env.NODE_ENV':'\"production\"'}});
assert.ok(!Object.keys(bundle.metafile.inputs).some(p=>/node_modules\/(?:@firebase\/|firebase\/)|src\/lib\/firebase\.ts$/.test(p)),'Legacy Firebase SDK must not enter standalone browser bundle');
const dir=await mkdtemp(join(tmpdir(),'nexus-standalone-'));
let server,browser,backend,owner,login,reader;
let prepared=false;
try{
 if(real){
  assert.equal(process.env.NEXUSTALENT_DATASTORE,'postgres');assert.equal(process.env.NEXUSTALENT_PG_INTEGRATION,'1');
  const {default:pg}=await import('pg');
  function pool(key,username){const value=process.env[key];assert.ok(value);const u=new URL(value);assert.equal(u.protocol,'postgresql:');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'5432');assert.equal(u.pathname,'/nexustalent_ci');assert.equal(u.username,username);assert.equal(u.search,'');assert.equal(u.hash,'');return new pg.Pool({connectionString:value,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});}
  owner=pool('NEXUSTALENT_AUTH_OWNER_CI_URL','postgres');login=pool('NEXUSTALENT_AUTH_LOGIN_CI_URL','nexustalent_login_ci');reader=pool('NEXUSTALENT_AUTH_READER_CI_URL','nexustalent_session_ci');
  delete process.env.NEXUSTALENT_TEST_DATABASE_URL;
  backend=await import('../server/trustedBackend.ts');
  const {createCredentialService,hashPassword}=await import('../server/postgresCredentials.ts');
  const {createPostgresSessionVerifier}=await import('../server/postgresSessionIdentity.ts');
  service=createCredentialService((q,p)=>login.query(q,p));verify=createPostgresSessionVerifier((q,p)=>reader.query(q,p));
  prepared=true;
  for(const a of actors){const account=await backend.readOwnAccount(a.uid);assert.equal(account.role,a.role);assert.equal(account.email,a.email);
   await owner.query('INSERT INTO nexustalent_identity.principals(uid,email) VALUES ($1,$2)',[a.uid,a.email]);
   await owner.query('INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES ($1,$2,$3)',[a.uid,a.email,await hashPassword(password)]);
  }
 }
 const key=join(dir,'key.pem'),cert=join(dir,'cert.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1','-keyout',key,'-out',cert],{stdio:'ignore'});
 const app=express();app.disable('x-powered-by');
 const auth=createCookieAuthorization(verify,origin);
 app.use('/api/auth',createBrowserAuthRouter(service,verify,origin));
 app.get('/api/account/me',auth,async(req,res)=>{if(Object.keys(req.query).length)return res.sendStatus(400);try{return res.json({account:real?await backend.readOwnAccount(res.locals.identity.uid):actors.find(x=>x.uid===res.locals.identity.uid)});}catch{return res.sendStatus(503);}});
 app.get('/api/workspace',auth,async(req,res)=>{if(Object.keys(req.query).length)return res.sendStatus(400);if(real){try{return res.json(await backend.readStakeholderWorkspace(res.locals.identity.uid,false));}catch{return res.sendStatus(503);}}const a=actors.find(x=>x.uid===res.locals.identity.uid);return res.json({uid:a.uid,role:a.role,status:'ready',profile:{id:a.uid},collections:Object.fromEntries(['employers','institutions','students','requirements','campaigns','calls','opportunities','users'].map(k=>[k,[]]))});});
 if(real){
  const mutation=(expected,execute)=>[auth,express.json({limit:'64kb'}),async(req,res)=>{
   if(Object.keys(req.query).length||!req.body||Object.keys(req.body).sort().join(',')!=='action,payload,requestId'||req.body.action!==expected||typeof req.body.requestId!=='string'||!req.body.payload||typeof req.body.payload!=='object'||Array.isArray(req.body.payload))return res.sendStatus(400);
   try{return res.json(await execute({actorUid:res.locals.identity.uid,adminClaim:false,action:req.body.action,requestId:req.body.requestId,payload:req.body.payload}));}
   catch{return res.status(403).json({error:'Mutation denied'});}
  }];
  app.post('/api/recruitment/transitions',...mutation('CREATE_REQUIREMENT_CAMPAIGN',backend.executeRecruitmentTransition));
  app.post('/api/profile/mutations',...mutation('UPDATE_STUDENT_AVAILABILITY',backend.executeTrustedProfileMutation));
 }
 app.get('/bundle.js',(_req,res)=>res.type('application/javascript').send(bundle.outputFiles[0].text));
 app.get('/',(_req,res)=>res.type('html').send('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'));
 server=createServer({key:await readFile(key),cert:await readFile(cert)},app);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4443,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true});
 for(const actor of actors){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
  try{
   const page=await context.newPage();
   const pageErrors=[];page.on('pageerror',e=>{pageErrors.push(e.name+': '+e.message);console.error('Synthetic browser page exception: '+e.name+': '+e.message);});
   await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
   await page.goto(origin);
   await page.getByLabel('Email',{exact:true}).fill(actor.email);
   await page.getByLabel('Password',{exact:true}).fill(password);
   await page.getByRole('button',{name:'Sign in',exact:true}).click();
   async function confirmWorkspace(){
    if(!real){await page.getByRole('region',{name:'Stakeholder workspace'}).getByText('Role: '+actor.role,{exact:true}).waitFor();return;}
    await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
    const result=await context.request.get(origin+'/api/workspace');assert.equal(result.status(),200);const view=await result.json();assert.equal(view.uid,actor.uid);assert.equal(view.role,actor.role);
    assert.equal(typeof view.profile.name,'string');
    try{await page.getByRole('heading',{level:1,name:view.profile.name,exact:true}).waitFor({timeout:12000});}catch(error){console.error('Synthetic dashboard render diagnostic:',JSON.stringify({role:actor.role,headings:await page.locator('h1,h2,h3').allTextContents(),status:await page.getByRole('status').allTextContents(),pageErrors,body:(await page.locator('body').innerText()).slice(0,1500)}));throw error;}
    assert.deepEqual(pageErrors,[]);
   }
   await confirmWorkspace();
   if(real&&actor.role==='student'){
    const select=page.getByLabel('Placement Availability');
    const next=(await select.inputValue())==='open_to_offers'?'actively_seeking':'open_to_offers';
    const [response]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/profile/mutations'&&r.request().method()==='POST'),select.selectOption(next)]);
    assert.equal(response.status(),200);assert.equal((await response.json()).replayed,false);
    assert.equal((await backend.readStakeholderWorkspace(actor.uid,false)).profile.availability,next);
    await page.reload();await confirmWorkspace();assert.equal(await page.getByLabel('Placement Availability').inputValue(),next);
    console.log('PASS browser student availability persisted');
   }
   if(real&&actor.role==='employer'){
    const title='Synthetic browser recruitment acceptance';
    await page.locator('#create-demand-btn').click();
    for(const [id,value] of Object.entries({'job-role-title-input':title,'vacancies-count-input':'2','joining-window-input':'June 2027','required-skills-input':'SQL','job-locations-input':'Test City','salary-min-lpa-input':'5','salary-max-lpa-input':'7','ideal-candidate-profile-summary':'Synthetic acceptance only'}))await page.locator('#'+id).fill(value);
    const [response]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),page.locator('#submit-requirement-btn').click()]);
    assert.equal(response.status(),200);const result=await response.json();assert.equal(result.replayed,false);assert.equal(result.ids.length,2);
    const view=await backend.readStakeholderWorkspace(actor.uid,false);
    assert.ok(view.collections.requirements.some(r=>r.role===title&&r.id===result.ids[0]&&r.vacancies===2));
    assert.ok(view.collections.campaigns.some(c=>c.id===result.ids[1]&&c.requirementId===result.ids[0]));
    await page.locator('#submit-requirement-btn').waitFor({state:'hidden'});
    await page.reload();await confirmWorkspace();
    assert.ok((await backend.readStakeholderWorkspace(actor.uid,false)).collections.requirements.some(r=>r.id===result.ids[0]));
    const selector=page.getByLabel('Select Active Hiring Campaign');if(await selector.count())await selector.selectOption(result.ids[0]);
    await page.getByRole('heading',{level:2,name:title,exact:true}).waitFor();
    console.log('PASS browser recruitment demand and campaign persisted');
   }
   const cookies=await context.cookies(origin);const c=cookies.find(x=>x.name==='__Host-nexustalent-session');assert.ok(c&&c.httpOnly&&c.secure&&c.sameSite==='Strict'&&c.path==='/');
   assert.equal(await page.evaluate(()=>document.cookie.includes('__Host-nexustalent-session')),false);
   assert.equal((await context.request.get(origin+'/api/workspace?uid=other')).status(),400);
   await page.reload();await confirmWorkspace();
   await page.getByRole('button',{name:'Sign out',exact:true}).click();
   await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
   assert.equal((await context.request.get(origin+'/api/workspace')).status(),401);
   assert.equal((await context.cookies(origin)).some(x=>x.name==='__Host-nexustalent-session'),false);
   console.log('PASS standalone browser journey: '+actor.role);
  }finally{await context.close();}
 }
 if(real){const r=await owner.query('SELECT count(*)::int AS n FROM nexustalent_identity.sessions WHERE uid=ANY($1) AND revoked_at IS NOT NULL',[actors.map(a=>a.uid)]);assert.equal(r.rows[0].n,actors.length);}else assert.equal(sessions.size,0);
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));try{if(prepared)await owner.query('DELETE FROM nexustalent_identity.principals WHERE uid=ANY($1)',[actors.map(a=>a.uid)]);}finally{await backend?.closePostgresIntegrationStore();await Promise.all([owner?.end(),login?.end(),reader?.end()]);await rm(dir,{recursive:true,force:true});}}

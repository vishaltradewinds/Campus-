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
const actors=['student','institution','employer'].map(role=>({uid:'browser-'+role,email:role+'@example.invalid',name:'Synthetic '+role,role}));
const password='Synthetic-browser-only-123456';
const sessions=new Map();
const service={
 async login(email,passwordInput){const actor=actors.find(x=>x.email===email);if(!actor||passwordInput!==password)return null;const token=randomBytes(32).toString('base64url');sessions.set(token,actor);return token;},
 async logout(token){return sessions.delete(token);}
};
const verify=async token=>{const a=sessions.get(token);return a?{status:'verified',identity:{uid:a.uid,email:a.email,adminClaim:false}}:{status:'denied'};};
const bundle=await build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import {StandaloneStakeholderAcceptance} from './src/components/StandaloneStakeholderAcceptance.tsx';createRoot(document.getElementById('root')).render(React.createElement(StandaloneStakeholderAcceptance));",resolveDir:process.cwd(),sourcefile:'browser-acceptance-entry.tsx',loader:'tsx'},bundle:true,write:false,platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
const dir=await mkdtemp(join(tmpdir(),'nexus-standalone-'));
let server,browser;
try{
 const key=join(dir,'key.pem'),cert=join(dir,'cert.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1','-keyout',key,'-out',cert],{stdio:'ignore'});
 const app=express();app.disable('x-powered-by');
 const auth=createCookieAuthorization(verify,origin);
 app.use('/api/auth',createBrowserAuthRouter(service,verify,origin));
 app.get('/api/account/me',auth,(_req,res)=>res.json({account:actors.find(x=>x.uid===res.locals.identity.uid)}));
 app.get('/api/workspace',auth,(_req,res)=>{const a=actors.find(x=>x.uid===res.locals.identity.uid);return res.json({uid:a.uid,role:a.role,status:'ready',profile:{id:a.uid},collections:Object.fromEntries(['employers','institutions','students','requirements','campaigns','calls','opportunities','users'].map(k=>[k,[]]))});});
 app.get('/bundle.js',(_req,res)=>res.type('application/javascript').send(bundle.outputFiles[0].text));
 app.get('/',(_req,res)=>res.type('html').send('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'));
 server=createServer({key:await readFile(key),cert:await readFile(cert)},app);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4443,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true});
 for(const actor of actors){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
  try{
   const page=await context.newPage();
   await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
   await page.goto(origin);
   await page.getByLabel('Email',{exact:true}).fill(actor.email);
   await page.getByLabel('Password',{exact:true}).fill(password);
   await page.getByRole('button',{name:'Sign in',exact:true}).click();
   await page.getByRole('region',{name:'Stakeholder workspace'}).getByText('Role: '+actor.role,{exact:true}).waitFor();
   const cookies=await context.cookies(origin);const c=cookies.find(x=>x.name==='__Host-nexustalent-session');assert.ok(c&&c.httpOnly&&c.secure&&c.sameSite==='Strict'&&c.path==='/');
   assert.equal(await page.evaluate(()=>document.cookie.includes('__Host-nexustalent-session')),false);
   await page.reload();await page.getByRole('region',{name:'Stakeholder workspace'}).getByText('Role: '+actor.role,{exact:true}).waitFor();
   await page.getByRole('button',{name:'Sign out',exact:true}).click();
   await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
   assert.equal((await context.request.get(origin+'/api/workspace')).status(),401);
   assert.equal((await context.cookies(origin)).some(x=>x.name==='__Host-nexustalent-session'),false);
   console.log('PASS standalone browser journey: '+actor.role);
  }finally{await context.close();}
 }
 assert.equal(sessions.size,0);
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}

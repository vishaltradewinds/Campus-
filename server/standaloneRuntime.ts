import express from 'express';
import path from 'node:path';
import {statSync} from 'node:fs';
import {createBrowserAuthRouter} from './browserAuthRouter';
import {createCookieAuthorization} from './cookieAuthorization';
import {applyBaselineSecurityHeaders} from './securityHeaders';
import {createInMemoryRateLimiter} from './inMemoryRateLimiter';
import {apiNotFound} from './apiNotFound';
import type {IdentityVerifier} from './identityProvider';
type Service=Parameters<typeof createBrowserAuthRouter>[0];
type Mount=typeof import('./stakeholderRoutes').mountStakeholderRoutes;
/** Test-only integrated runtime. Never reads or accepts production connection details. */
export function createStandaloneRuntime(input:{origin:string;dist:string;service:Service;verify:IdentityVerifier;mount:Mount;acceptanceNow?:()=>number},env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_STANDALONE_AUTH_TEST!=='1'||env.NEXUSTALENT_DATASTORE!=='postgres'||env.NEXUSTALENT_PG_INTEGRATION!=='1')throw Error('Standalone runtime is test-only until cutover authorization');
 const origin=new URL(input.origin);
 if(origin.protocol!=='https:'||origin.hostname!=='127.0.0.1'||origin.origin!==input.origin)throw Error('Loopback HTTPS required');
 if(!path.isAbsolute(input.dist))throw Error('Absolute standalone build directory required');
 if(!statSync(path.join(input.dist,'standalone.html'),{throwIfNoEntry:false})?.isFile()||!statSync(path.join(input.dist,'assets'),{throwIfNoEntry:false})?.isDirectory())throw Error('Standalone build incomplete');
 const app=express();app.disable('x-powered-by');app.set('trust proxy',false);
 app.use(applyBaselineSecurityHeaders);
 app.use((_req,res,next)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  next();
 });
 app.use('/api/auth',createBrowserAuthRouter(input.service,input.verify,input.origin,env,input.acceptanceNow));
 app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 // Liveness is deliberately process-only: hosting probes must not wake Neon.
 app.get('/api/health',(_req,res)=>res.json({status:'ok',scope:'process_only',deploymentReady:false}));
 app.use(express.json({limit:'64kb'}));
 const limit=createInMemoryRateLimiter({windowMs:60000,maxRequests:20,maxBuckets:10000,...(input.acceptanceNow?{now:input.acceptanceNow}:{})});
 const aiLimit=createInMemoryRateLimiter({windowMs:60000,maxRequests:5,maxBuckets:10000,...(input.acceptanceNow?{now:input.acceptanceNow}:{})});
 input.mount(app,(req,res,next)=>limit(req.ip+':'+req.path).allowed?next():res.sendStatus(429),createCookieAuthorization(input.verify,input.origin,env),(req,res,next)=>aiLimit(req.ip).allowed?next():res.sendStatus(429));
 app.use('/api',apiNotFound);
 app.use('/assets',express.static(path.join(input.dist,'assets'),{index:false,dotfiles:'deny',fallthrough:false,maxAge:'1h'}));
 app.get(['/', '/standalone.html'],(_req,res)=>{res.setHeader('Cache-Control','no-store');res.sendFile(path.join(input.dist,'standalone.html'));});
 app.use((_req,res)=>{res.setHeader('Cache-Control','no-store');res.sendStatus(404);});
 app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{if(res.headersSent)return _next(err);res.setHeader('Cache-Control','no-store');const code=(err as {status?:number})?.status;return res.status(code===404?404:code===413?413:400).json({error:code===404?'Not found':'Invalid request'});});
 return app;
}

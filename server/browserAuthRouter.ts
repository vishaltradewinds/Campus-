import express from 'express';
import {createHash} from 'node:crypto';
import type {IdentityVerifier} from './identityProvider';
import {createInMemoryRateLimiter} from './inMemoryRateLimiter';
type Service={login:(login:string,password:string)=>Promise<string|null>;logout:(token:string)=>Promise<boolean>;enroll?:(token:string,password:string)=>Promise<boolean>;changePassword?:(token:string,currentPassword:string,newPassword:string)=>Promise<boolean>};
import {sessionCookieName as cookieName,sessionCookieOptions as cookieOptions,readSessionCookie as readCookie,directBrowserRequestStatus,validOrdinaryPrincipal} from './cookieAuthorization';
const valid=(value:string)=>/^[A-Za-z0-9_-]{43}$/.test(value)&&Buffer.from(value,'base64url').toString('base64url')===value;
export function createBrowserAuthRouter(service:Service,verify:IdentityVerifier,origin:string,env:NodeJS.ProcessEnv=process.env,acceptanceNow?:()=>number){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_STANDALONE_AUTH_TEST!=='1')throw Error('Browser authentication is test-only');
 const target=new URL(origin);
 if(target.protocol!=='https:'||target.hostname!=='127.0.0.1'||target.origin!==origin)throw Error('Test origin required');
 const router=express.Router();
 const ipLimit=createInMemoryRateLimiter({windowMs:60000,maxRequests:30,maxBuckets:1000,...(acceptanceNow?{now:acceptanceNow}:{})});
 const accountLimit=createInMemoryRateLimiter({windowMs:60000,maxRequests:5,maxBuckets:1000,...(acceptanceNow?{now:acceptanceNow}:{})});
 let active=0;
 router.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  const rejected=directBrowserRequestStatus(req,origin);
  if(rejected!==null)return res.sendStatus(rejected);
  if(!ipLimit(req.socket.remoteAddress||'').allowed)return res.sendStatus(429);
  next();
 });
 router.use(express.json({limit:'4kb'}));
 router.post('/enroll',async(req,res)=>{
  if(!service.enroll)return res.sendStatus(404);
  const b=req.body;
  if(!b||Object.keys(b).sort().join(',')!=='password,token'||typeof b.token!=='string'||!valid(b.token)||typeof b.password!=='string'||Buffer.byteLength(b.password)<12||Buffer.byteLength(b.password)>256)return res.sendStatus(400);
  if(readCookie(req.headers.cookie))return res.sendStatus(409);
  const key=createHash('sha256').update('enrollment:'+b.token).digest('hex');
  if(!accountLimit(key).allowed||active>=2)return res.sendStatus(429);
  active++;
  try{return res.sendStatus(await service.enroll(b.token,b.password)?204:403);}catch{return res.sendStatus(503);}finally{active--;}
 });
 router.post('/login',async(req,res)=>{
  const b=req.body;
  if(!b||typeof b.login!=='string'||b.login.length>320||typeof b.password!=='string'||Buffer.byteLength(b.password)>256||Object.keys(b).some(k=>!['login','password'].includes(k)))return res.sendStatus(400);
  if(readCookie(req.headers.cookie))return res.sendStatus(409);
  const key=createHash('sha256').update(b.login.trim().toLowerCase()).digest('hex');
  if(!accountLimit(key).allowed||active>=2)return res.sendStatus(429);
  active++;
  try{const token=await service.login(b.login,b.password);if(!token||!valid(token))return res.sendStatus(401);
   res.cookie(cookieName,token,{...cookieOptions,maxAge:8*60*60*1000});return res.sendStatus(204);
  }catch{return res.sendStatus(503);}finally{active--;}
 });
 router.post('/password',async(req,res)=>{
  if(!service.changePassword)return res.sendStatus(404);
  const token=readCookie(req.headers.cookie);
  if(!token)return res.sendStatus(401);
  const b=req.body;
  if(!b||Object.keys(b).sort().join(',')!=='currentPassword,newPassword'||
     typeof b.currentPassword!=='string'||typeof b.newPassword!=='string'||
     b.currentPassword.length<12||b.newPassword.length<12||
     Buffer.byteLength(b.currentPassword,'utf8')>256||Buffer.byteLength(b.newPassword,'utf8')>256||
     b.currentPassword===b.newPassword)return res.sendStatus(400);
  const key=createHash('sha256').update('change:'+token).digest('hex');
  if(!accountLimit(key).allowed||active>=2)return res.sendStatus(429);
  active++;
  try{
   const changed=await service.changePassword(token,b.currentPassword,b.newPassword);
   if(!changed)return res.sendStatus(403);
   // SQL revokes every active session for this account, not just this cookie.
   res.clearCookie(cookieName,cookieOptions);
   return res.sendStatus(204);
  }catch{return res.sendStatus(503);}
  finally{active--;}
 });
 router.get('/session',async(req,res)=>{
  const t=readCookie(req.headers.cookie);if(!t)return res.status(401).json({status:'anonymous'});
  try{const r=await verify(t);if(r.status==='denied'){res.clearCookie(cookieName,cookieOptions);return res.status(401).json({status:'anonymous'});}
   if(r.status!=='verified'||typeof r.identity.email!=='string')return res.status(503).json({status:'unavailable'});
   if(!validOrdinaryPrincipal(r.identity)){res.clearCookie(cookieName,cookieOptions);return res.status(401).json({status:'anonymous'});}
   return res.json({status:'authenticated',principal:{uid:r.identity.uid,email:r.identity.email}});
  }catch{return res.status(503).json({status:'unavailable'});}
 });
 router.post('/logout',async(req,res)=>{
  const t=readCookie(req.headers.cookie);if(!t)return res.sendStatus(401);
  try{if(!await service.logout(t))return res.sendStatus(503);res.clearCookie(cookieName,cookieOptions);return res.sendStatus(204);}
  catch{return res.sendStatus(503);}
 });
 router.use((_err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.sendStatus(400));
 return router;
}

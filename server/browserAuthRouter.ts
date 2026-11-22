import express from 'express';
import {createHash} from 'node:crypto';
import type {IdentityVerifier} from './identityProvider';
import {createInMemoryRateLimiter} from './inMemoryRateLimiter';
type Service={login:(login:string,password:string)=>Promise<string|null>;logout:(token:string)=>Promise<boolean>};
const cookieName='__Host-nexustalent-session';
const valid=(value:string)=>/^[A-Za-z0-9_-]{43}$/.test(value)&&Buffer.from(value,'base64url').toString('base64url')===value;
const cookieOptions={httpOnly:true,secure:true,sameSite:'strict' as const,path:'/'};
function readCookie(header:string|undefined){
 const matches=(header||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));
 if(matches.length!==1)return null;
 const value=matches[0].slice(cookieName.length+1);return valid(value)?value:null;
}
export function createBrowserAuthRouter(service:Service,verify:IdentityVerifier,origin:string,env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_STANDALONE_AUTH_TEST!=='1')throw Error('Browser authentication is test-only');
 const target=new URL(origin);
 if(target.protocol!=='https:'||target.hostname!=='127.0.0.1'||target.origin!==origin)throw Error('Test origin required');
 const router=express.Router();
 const ipLimit=createInMemoryRateLimiter({windowMs:60000,maxRequests:30,maxBuckets:1000});
 const accountLimit=createInMemoryRateLimiter({windowMs:60000,maxRequests:5,maxBuckets:1000});
 let active=0;
 router.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||''))return res.sendStatus(403);
  if(req.headers.authorization)return res.sendStatus(400);
  const supplied=req.get('origin');
  if((supplied&&supplied!==origin)||(req.method!=='GET'&&supplied!==origin)||req.get('sec-fetch-site')==='cross-site')return res.sendStatus(403);
  if(!ipLimit(req.socket.remoteAddress||'').allowed)return res.sendStatus(429);
  next();
 });
 router.use(express.json({limit:'4kb'}));
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
 router.get('/session',async(req,res)=>{
  const t=readCookie(req.headers.cookie);if(!t)return res.status(401).json({status:'anonymous'});
  try{const r=await verify(t);if(r.status==='denied')return res.status(401).json({status:'anonymous'});
   if(r.status!=='verified'||typeof r.identity.email!=='string')return res.status(503).json({status:'unavailable'});
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

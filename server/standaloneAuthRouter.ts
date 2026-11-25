import express from 'express';
import {createHash} from 'node:crypto';
import {createInMemoryRateLimiter} from './inMemoryRateLimiter';
type Service={login:(login:string,password:string)=>Promise<string|null>;logout:(token:string)=>Promise<boolean>};
export function createStandaloneAuthRouter(service:Service,env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_STANDALONE_AUTH_TEST!=='1')throw Error('Standalone authentication HTTP is test-only');
 const router=express.Router();
 const ipLimit=createInMemoryRateLimiter({windowMs:60000,maxRequests:10,maxBuckets:1000});
 const accountLimit=createInMemoryRateLimiter({windowMs:60000,maxRequests:5,maxBuckets:1000});
 let active=0;
 router.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||''))return res.status(403).json({error:'Isolated test only'});
  if(req.get('origin'))return res.status(403).json({error:'Browser access not enabled'});
  if(!ipLimit(req.socket.remoteAddress||'').allowed)return res.status(429).json({error:'Try again later'});
  next();
 });
 router.use(express.json({limit:'4kb'}));
 router.post('/login',async(req,res)=>{
  const b=req.body;
  if(!b||typeof b.login!=='string'||b.login.length>320||typeof b.password!=='string'||Buffer.byteLength(b.password)>256||Object.keys(b).some(k=>!['login','password'].includes(k)))return res.status(400).json({error:'Invalid credentials'});
  const key=createHash('sha256').update(b.login.trim().toLowerCase()).digest('hex');
  if(!accountLimit(key).allowed||active>=2)return res.status(429).json({error:'Try again later'});
  active++;
  try{
   const token=await service.login(b.login,b.password);
   if(!token)return res.status(401).json({error:'Invalid credentials'});
   return res.json({token});
  }catch{return res.status(503).json({error:'Authentication unavailable'});}
  finally{active--;}
 });
 router.post('/logout',async(req,res)=>{
  const token=req.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!token)return res.status(401).json({error:'Authentication required'});
  try{if(!await service.logout(token))return res.status(503).json({error:'Revocation not confirmed'});return res.status(204).end();}
  catch{return res.status(503).json({error:'Revocation not confirmed'});}
 });
 router.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(400).json({error:'Invalid request'}));
 return router;
}

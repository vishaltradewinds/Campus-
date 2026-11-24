import express from 'express';
import {z} from 'zod';
import type {IdentityVerifier} from './identityProvider';
import {createInMemoryRateLimiter} from './inMemoryRateLimiter';

const id=z.string().min(1).max(200).regex(/^[^/\s]+$/);
const requestId=z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/);
const notes=z.string().trim().min(1).max(2000);
const status=z.enum(['pending','verified','rejected']);
const inputSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('UPDATE_EMPLOYER_VERIFICATION'),requestId,payload:z.object({employerId:id,status,notes}).strict()}).strict(),
 z.object({action:z.literal('UPDATE_INSTITUTION_EMPANELMENT'),requestId,payload:z.object({institutionId:id,status:z.enum(['pending','empanelled','rejected']),tier:z.enum(['Tier-1 High Assurance','Tier-2 Verified','Tier-3 Provisional']),notes}).strict()}).strict(),
 z.object({action:z.literal('UPDATE_STUDENT_PLATFORM_VERIFICATION'),requestId,payload:z.object({studentId:id,status,notes}).strict()}).strict()
]);
type ReviewInput=z.infer<typeof inputSchema> & {actorUid:string;adminClaim:true};
type ReviewResult={replayed:boolean;auditEventId:string;ids:string[]};

// Isolated HTTP acceptance adapter, not a production entrypoint. A real
// independently verified WebAuthn ceremony is still required. The caller
// injects the reviewed proof verifier and exact-target trusted review service.
export function createAdminReviewAcceptanceRouter(deps:{
 verify:IdentityVerifier;
 review:(input:ReviewInput)=>Promise<ReviewResult>;
 origin:string;
},env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_ADMIN_ACCEPTANCE_TEST!=='1')throw Error('Administrator review is test-only');
 const u=new URL(deps.origin);
 if(u.protocol!=='https:'||u.hostname!=='127.0.0.1'||u.origin!==deps.origin)throw Error('Loopback HTTPS origin required');
 const router=express.Router();
 const limit=createInMemoryRateLimiter({windowMs:60000,maxRequests:30,maxBuckets:1000});
 router.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||''))return res.sendStatus(403);
  if(req.get('origin')!==deps.origin||req.get('sec-fetch-site')==='cross-site')return res.sendStatus(403);
  if(req.headers.cookie!==undefined)return res.sendStatus(400);
  const raw=req.rawHeaders.filter((_,i)=>i%2===0).filter(x=>x.toLowerCase()==='authorization');
  if(raw.length>1)return res.sendStatus(400);
  if(!limit(req.socket.remoteAddress||'').allowed)return res.sendStatus(429);
  next();
 });
 router.use(express.json({limit:'8kb'}));
 router.post('/reviews',async(req,res)=>{
  const token=req.get('authorization')?.match(/^Bearer ([A-Za-z0-9._~-]{1,8192})$/)?.[1];
  if(!token)return res.sendStatus(401);
  try{
   const result=await deps.verify(token);
   if(result.status==='denied')return res.sendStatus(401);
   if(result.status!=='verified')return res.sendStatus(503);
   if(result.identity.adminClaim!==true)return res.sendStatus(403);
   const parsed=inputSchema.safeParse(req.body);
   if(!parsed.success)return res.status(400).json({error:'Invalid review request'});
   const reply=await deps.review({...parsed.data,actorUid:result.identity.uid,adminClaim:true});
   const valid=typeof reply?.replayed==='boolean'&&typeof reply.auditEventId==='string'&&/^[0-9a-f]{64}$/.test(reply.auditEventId)&&Array.isArray(reply.ids)&&reply.ids.every(x=>typeof x==='string');
   if(!valid)return res.sendStatus(503);
   return res.status(reply.replayed?200:201).json({replayed:reply.replayed,auditEventId:reply.auditEventId,ids:reply.ids});
  }catch{return res.status(503).json({error:'Review not confirmed'});}
 });
 router.use((_err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.sendStatus(400));
 return router;
}

import type {Request,RequestHandler} from 'express';
import type {IdentityVerifier} from './identityProvider';
export const sessionCookieName='__Host-nexustalent-session';
export const sessionCookieOptions={httpOnly:true,secure:true,sameSite:'strict' as const,path:'/'};
export function readSessionCookie(header:string|undefined){
 const matches=(header||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(sessionCookieName+'='));
 if(matches.length!==1)return null;
 const value=matches[0].slice(sessionCookieName.length+1);
 return /^[A-Za-z0-9_-]{43}$/.test(value)&&Buffer.from(value,'base64url').toString('base64url')===value?value:null;
}
// Direct-loopback rehearsal only. Do not trust client-supplied proxy metadata.
// Production ingress requires a separately verified trusted-proxy policy.
export function directBrowserRequestStatus(req:Request,origin:string):400|403|null{
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||''))return 403;
 if(['forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-forwarded-port','x-real-ip'].some(key=>req.headers[key]!==undefined))return 403;
 if(req.headers.authorization!==undefined)return 400;
 const supplied=req.get('origin');
 if((supplied!==undefined&&supplied!==origin)||(!['GET','HEAD'].includes(req.method)&&supplied!==origin)||req.get('sec-fetch-site')==='cross-site')return 403;
 return null;
}
export function validOrdinaryPrincipal(identity:unknown):boolean{
 if(!identity||typeof identity!=='object')return false;
 const p=identity as {uid?:unknown;adminClaim?:unknown;email?:unknown};
 return p.adminClaim===false&&typeof p.uid==='string'&&p.uid.length>0&&p.uid.length<=200&&p.uid===p.uid.trim()&&!p.uid.includes('/')&&!/[\u0000-\u001f\u007f]/.test(p.uid);
}
export function createCookieAuthorization(verify:IdentityVerifier,origin:string,env:NodeJS.ProcessEnv=process.env):RequestHandler{
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_STANDALONE_AUTH_TEST!=='1')throw Error('Cookie authorization is test-only');
 const u=new URL(origin);if(u.protocol!=='https:'||u.hostname!=='127.0.0.1'||u.origin!==origin)throw Error('Test origin required');
 return async(req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  const rejected=directBrowserRequestStatus(req,origin);
  if(rejected!==null)return res.sendStatus(rejected);
  const token=readSessionCookie(req.headers.cookie);if(!token)return res.sendStatus(401);
  try{
   const r=await verify(token);
   if(r.status==='denied'){res.clearCookie(sessionCookieName,sessionCookieOptions);return res.sendStatus(401);}
   if(r.status!=='verified')return res.sendStatus(503);
   // No administrator access in standalone rehearsal; never provide a Firebase credential.
   if(!validOrdinaryPrincipal(r.identity))return res.sendStatus(403);
   res.locals.identity=r.identity;
   return next();
  }catch{return res.sendStatus(503);}
 };
}

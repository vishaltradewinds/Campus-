import type {RequestHandler} from 'express';
import type {IdentityVerifier} from './identityProvider';
export const sessionCookieName='__Host-nexustalent-session';
export const sessionCookieOptions={httpOnly:true,secure:true,sameSite:'strict' as const,path:'/'};
export function readSessionCookie(header:string|undefined){
 const matches=(header||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(sessionCookieName+'='));
 if(matches.length!==1)return null;
 const value=matches[0].slice(sessionCookieName.length+1);
 return /^[A-Za-z0-9_-]{43}$/.test(value)&&Buffer.from(value,'base64url').toString('base64url')===value?value:null;
}
export function createCookieAuthorization(verify:IdentityVerifier,origin:string,env:NodeJS.ProcessEnv=process.env):RequestHandler{
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_STANDALONE_AUTH_TEST!=='1')throw Error('Cookie authorization is test-only');
 const u=new URL(origin);if(u.protocol!=='https:'||u.hostname!=='127.0.0.1'||u.origin!==origin)throw Error('Test origin required');
 return async(req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||''))return res.sendStatus(403);
  if(req.headers.authorization)return res.sendStatus(400);
  const supplied=req.get('origin');
  if((supplied&&supplied!==origin)||(!['GET','HEAD'].includes(req.method)&&supplied!==origin)||req.get('sec-fetch-site')==='cross-site')return res.sendStatus(403);
  const token=readSessionCookie(req.headers.cookie);if(!token)return res.sendStatus(401);
  try{
   const r=await verify(token);
   if(r.status==='denied'){res.clearCookie(sessionCookieName,sessionCookieOptions);return res.sendStatus(401);}
   if(r.status!=='verified')return res.sendStatus(503);
   // No administrator access in standalone rehearsal; never provide a Firebase credential.
   if(r.identity.adminClaim)return res.sendStatus(403);
   res.locals.identity=r.identity;
   return next();
  }catch{return res.sendStatus(503);}
 };
}

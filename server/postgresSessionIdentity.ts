import {createHash} from 'node:crypto';
import type {IdentityVerifier} from './identityProvider';
type Query=(sql:string,params:string[])=>Promise<{rows:unknown[]}>;
export function createPostgresSessionVerifier(query:Query):IdentityVerifier{
 return async token=>{
  // Exactly 32 random bytes encoded as unpadded base64url (canonical).
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)||Buffer.from(token,'base64url').toString('base64url')!==token)return {status:'denied'};
  try{
   const hash=createHash('sha256').update(token,'ascii').digest('hex');
   const {rows}=await query('SELECT uid,email,admin_claim FROM nexustalent_identity.resolve_session($1)',[hash]);
   if(rows.length===0)return {status:'denied'};
   const row=rows[0] as Record<string,unknown>;
   if(rows.length!==1||!row||typeof row.uid!=='string'||!row.uid||row.uid.length>200||row.uid.includes('/')||typeof row.email!=='string'||typeof row.admin_claim!=='boolean')return {status:'unavailable'};
   // Ordinary PostgreSQL sessions cannot establish administrative authority.
   if(row.admin_claim!==false)return {status:'denied'};
   return {status:'verified',identity:{uid:row.uid,email:row.email,adminClaim:false}};
  }catch{return {status:'unavailable'};}
 };
}

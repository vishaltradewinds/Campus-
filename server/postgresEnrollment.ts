import {createHash} from 'node:crypto';
import {hashPassword} from './postgresCredentials';
type Query=(sql:string,params:string[])=>Promise<{rows:any[]}>;
export function createEnrollmentService(query:Query){
 return async(token:string,password:string)=>{
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||Buffer.from(token,'base64url').toString('base64url')!==token)return false;
  if(typeof password!=='string'||password.length<12||Buffer.byteLength(password,'utf8')>256)return false;
  try{
   const hash=await hashPassword(password);
   const digest=createHash('sha256').update(token,'ascii').digest('hex');
   const r=await query('SELECT nexustalent_identity.consume_enrollment($1,$2) AS enrolled',[digest,hash]);
   return r.rows.length===1&&r.rows[0]?.enrolled===true;
  }catch{throw Error('Enrollment service unavailable');}
 };
}

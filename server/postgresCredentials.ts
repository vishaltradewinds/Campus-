import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
const options={N:32768,r:8,p:1,maxmem:64*1024*1024};
const pattern=/^scrypt-v1:([0-9a-f]{32}):([0-9a-f]{128})$/;
const derive=(password:string,salt:Buffer)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,options,(e,key)=>e?reject(e):resolve(key)));
function validPassword(p:string){return typeof p==='string'&&Buffer.byteLength(p,'utf8')<=256&&p.length>=12;}
export async function hashPassword(password:string){if(!validPassword(password))throw Error('Invalid password length');const salt=randomBytes(16);return 'scrypt-v1:'+salt.toString('hex')+':'+(await derive(password,salt)).toString('hex');}
export async function verifyPassword(password:string,encoded:string){if(!validPassword(password))return false;const m=pattern.exec(encoded);if(!m)return false;return timingSafeEqual(await derive(password,Buffer.from(m[1],'hex')),Buffer.from(m[2],'hex'));}
const digest=(token:string)=>createHash('sha256').update(token,'ascii').digest('hex');
type Query=(sql:string,params:string[])=>Promise<{rows:any[]}>;
const dummy='scrypt-v1:'+'0'.repeat(32)+':'+'0'.repeat(128);
export function createCredentialService(query:Query){
 return {
 async login(login:string,password:string){
  if(typeof login!=='string'||login.length>320||!validPassword(password))return null;
  try{
   const normalized=login.trim().toLowerCase();
   if(normalized.length<3)return null;
   const {rows}=await query('SELECT uid,password_hash FROM nexustalent_identity.login_credential($1)',[normalized]);
   const row=rows.length===1?rows[0]:null;
   const hash=typeof row?.password_hash==='string'&&pattern.test(row.password_hash)?row.password_hash:dummy;
   const matches=await verifyPassword(password,hash);
   if(!matches||!row||hash===dummy||typeof row.uid!=='string')return null;
   const token=randomBytes(32).toString('base64url');
   const result=await query('SELECT nexustalent_identity.issue_session($1,$2,$3) AS issued',[row.uid,hash,digest(token)]);
   return result.rows.length===1&&result.rows[0]?.issued===true?token:null;
  }catch{return null;}
 },
 async logout(token:string){
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)||Buffer.from(token,'base64url').toString('base64url')!==token)return false;
  try{const r=await query('SELECT nexustalent_identity.revoke_session($1) AS revoked',[digest(token)]);return r.rows.length===1&&r.rows[0]?.revoked===true;}catch{return false;}
 }
 };
}

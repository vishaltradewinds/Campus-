import type {IdentityVerifier,PrincipalResult} from './identityProvider';

// Isolated acceptance contract, not an authenticator. The injected proof
// verifier must independently validate a real phishing-resistant ceremony
// before production integration can be reviewed. Never accept client claims.
export type AdminProof = {
 uid:string;
 audience:'nexustalent-admin';
 method:'webauthn';
 userVerified:true;
 authenticatedAt:number;
 expiresAt:number;
};
export type AdminAccount = {uid:string;email:string;role:'super_admin';enabled:true;adminAuthorized:true};
type ProofResult={status:'verified';proof:AdminProof}|{status:'denied'|'unavailable'};
type AccountResult={status:'verified';account:AdminAccount}|{status:'denied'|'unavailable'};
export function createAdminAcceptanceVerifier(input:{
 verifyAdminProof:(token:string)=>Promise<ProofResult>;
 lookupAdminAccount:(uid:string)=>Promise<AccountResult>;
 now?:()=>number;
},env:NodeJS.ProcessEnv=process.env):IdentityVerifier{
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_ADMIN_ACCEPTANCE_TEST!=='1')throw Error('Administrator acceptance is test-only');
 return async token=>{
  // No ordinary session tokens, provider fallback, or browser-supplied roles.
  if(typeof token!=='string'||token.length===0||token.length>8192)return {status:'denied'};
  try{
   const proof=await input.verifyAdminProof(token);
   if(proof.status!=='verified')return {status:proof.status};
   const p=proof.proof,now=(input.now??Date.now)();
   if(!p||typeof p.uid!=='string'||!p.uid||p.uid.length>200||p.uid.includes('/')||
      p.audience!=='nexustalent-admin'||p.method!=='webauthn'||p.userVerified!==true||
      !Number.isSafeInteger(now)||!Number.isSafeInteger(p.authenticatedAt)||!Number.isSafeInteger(p.expiresAt)||
      p.authenticatedAt>now||now-p.authenticatedAt>5*60*1000||
      p.expiresAt<=now||p.expiresAt-p.authenticatedAt>5*60*1000)return {status:'denied'};
   const account=await input.lookupAdminAccount(p.uid);
   if(account.status!=='verified')return {status:account.status};
   const a=account.account;
   if(!a||a.uid!==p.uid||typeof a.email!=='string'||!a.email.trim()||a.email.length>320||
      a.role!=='super_admin'||a.enabled!==true||a.adminAuthorized!==true)return {status:'denied'};
   const after=(input.now??Date.now)();
   if(!Number.isSafeInteger(after)||after<now||after>=p.expiresAt)return {status:'denied'};
   return {status:'verified',identity:{uid:a.uid,email:a.email,adminClaim:true}};
  }catch{return {status:'unavailable'};}
 };
}

import {randomBytes,createHash} from 'node:crypto';
import {createAdminAcceptanceVerifier,type AdminProof} from './adminAcceptanceVerifier';
import {createWebAuthnAssertionAcceptance} from './webauthnAssertionAcceptance';
import {createAdminChallengeAcceptanceStore} from './adminChallengeAcceptanceStore';

type AccountLookup=Parameters<typeof createAdminAcceptanceVerifier>[0]['lookupAdminAccount'];
type Assertion=Parameters<ReturnType<typeof createWebAuthnAssertionAcceptance>>[0];
type Credential=Parameters<typeof createAdminChallengeAcceptanceStore>[0]['credentials'][number];
const digest=(s:string)=>createHash('sha256').update(s,'ascii').digest('hex');
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;

// Isolated, bounded session lifecycle connecting actual ES256 verification
// to the administrator review adapter. Not a persistent production runtime.
// Explicit owner-reviewed fixture keys only; no public credential enrollment.
export function createAdminPasskeySessionAcceptance(input:{
 credentials:readonly Credential[];origin:string;lookupAdminAccount:AccountLookup;now?:()=>number;
},env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_ADMIN_ACCEPTANCE_TEST!=='1')throw Error('Administrator passkey sessions are test-only');
 const clock=input.now??Date.now;
 const challenges=createAdminChallengeAcceptanceStore({credentials:input.credentials,now:clock},env);
 const verifyAssertion=createWebAuthnAssertionAcceptance({origin:input.origin,rpId:'localhost',consumeChallenge:challenges.consumeChallenge,now:clock},env);
 const sessions=new Map<string,{proof:AdminProof;credentialId:string}>();
 const activeCredentials=new Map(input.credentials.map(c=>[c.credentialId,c.uid]));
 // Authority changes are explicit revocation events in this acceptance store.
 // A real multi-process runtime needs transactional persistent revocation.
 const epochs=new Map<string,number>();
 const epoch=(uid:string)=>epochs.get(uid)??0;
 let lastTime=-1;
 const time=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0||n<lastTime){sessions.clear();throw Error('Invalid session clock');}lastTime=n;return n;};
 function sweep(now:number){for(const [k,s] of sessions)if(s.proof.expiresAt<=now)sessions.delete(k);}
 function revokePrincipal(uid:string){if(![...activeCredentials.values()].includes(uid))return;epochs.set(uid,epoch(uid)+1);for(const [k,s] of sessions)if(s.proof.uid===uid)sessions.delete(k);}
 const verifyIdentity=createAdminAcceptanceVerifier({
  now:time,lookupAdminAccount:input.lookupAdminAccount,
  verifyAdminProof:async token=>{
   const now=time();sweep(now);
   if(!tokenPattern.test(token))return {status:'denied'};
   const s=sessions.get(digest(token));
   return s?{status:'verified',proof:{...s.proof}}:{status:'denied'};
  }
 },env);
 return Object.freeze({
  issueChallenge:challenges.issue,
  async authenticate(assertion:Assertion){
   try{
    const uid=activeCredentials.get(assertion.credentialId);if(!uid)return {status:'denied' as const};
    const before=epoch(uid);
    const verified=await verifyAssertion(assertion);
    if(verified.status!=='verified')return {status:verified.status};
    if(verified.uid!==uid)return {status:'denied' as const};
    const account=await input.lookupAdminAccount(uid);
    if(account.status!=='verified')return {status:account.status};
    const a=account.account,now=time();sweep(now);
    if(a.uid!==uid||a.role!=='super_admin'||a.enabled!==true||a.adminAuthorized!==true||
       typeof a.email!=='string'||!a.email.trim()||a.email.length>320||
       activeCredentials.get(assertion.credentialId)!==uid||before!==epoch(uid)||
       now<verified.authenticatedAt||now-verified.authenticatedAt>=300000)return {status:'denied' as const};
    // One active session per credential; do not evict another admin silently.
    for(const [k,s] of sessions)if(s.credentialId===assertion.credentialId)sessions.delete(k);
    if(sessions.size>=32)return {status:'unavailable' as const};
    const token=randomBytes(32).toString('base64url'),key=digest(token);
    if(sessions.has(key))return {status:'unavailable' as const};
    const expiresAt=verified.authenticatedAt+300000;
    sessions.set(key,{credentialId:assertion.credentialId,proof:{uid,audience:'nexustalent-admin',method:'webauthn',userVerified:true,authenticatedAt:verified.authenticatedAt,expiresAt}});
    return {status:'verified' as const,token,expiresAt};
   }catch{return {status:'unavailable' as const};}
  },
  async verify(token:string){
   const key=typeof token==='string'&&tokenPattern.test(token)?digest(token):'';
   const original=sessions.get(key);
   const result=await verifyIdentity(token);
   if(result.status==='denied')sessions.delete(key);
   if(result.status==='verified'&&(!original||sessions.get(key)!==original))return {status:'denied' as const};
   return result;
  },
  revokeSession(token:string){if(typeof token==='string'&&tokenPattern.test(token))sessions.delete(digest(token));},
  revokePrincipal,
  revokeCredential(credentialId:string){
   const uid=activeCredentials.get(credentialId);if(uid)revokePrincipal(uid);
   activeCredentials.delete(credentialId);challenges.revokeCredential(credentialId);
  }
 });
}

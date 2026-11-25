import {createHash,createPublicKey,verify} from 'node:crypto';

// Narrow ES256 WebAuthn assertion acceptance experiment. Registration, trusted
// credential storage, browser ceremony, session issuance and production review
// remain separate gates. The challenge consumer MUST be atomic and single use.
type Challenge={uid:string;credentialId:string;challenge:string;publicKeyPem:string;issuedAt:number;expiresAt:number};
type Assertion={credentialId:string;clientDataJSON:string;authenticatorData:string;signature:string};
type Result={status:'verified';uid:string;authenticatedAt:number}|{status:'denied'|'unavailable'};
const decode=(value:unknown,max:number)=>{
 if(typeof value!=='string'||!value||value.length>Math.ceil(max*4/3)||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid encoding');
 const b=Buffer.from(value,'base64url');if(b.length>max||b.toString('base64url')!==value)throw Error('Invalid encoding');return b;
};
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest();
export function createWebAuthnAssertionAcceptance(input:{
 origin:string;rpId:string;
 consumeChallenge:(challenge:string,credentialId:string)=>Promise<Challenge|null>;
 now?:()=>number;
},env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_ADMIN_ACCEPTANCE_TEST!=='1')throw Error('WebAuthn acceptance is test-only');
 const origin=new URL(input.origin);
 if(origin.protocol!=='https:'||origin.hostname!=='localhost'||origin.origin!==input.origin||input.rpId!=='localhost')throw Error('Local WebAuthn acceptance origin required');
 return async(assertion:Assertion):Promise<Result>=>{
  let client:Buffer,auth:Buffer,signature:Buffer,challenge:string;
  try{
   decode(assertion.credentialId,1024);
   client=decode(assertion.clientDataJSON,4096);auth=decode(assertion.authenticatorData,37);signature=decode(assertion.signature,80);
   const data=JSON.parse(client.toString('utf8'));
   if(data.type!=='webauthn.get'||data.origin!==input.origin||data.crossOrigin!==false||typeof data.challenge!=='string'||decode(data.challenge,32).length!==32)return {status:'denied'};
   challenge=data.challenge;
   // Exactly 37 bytes: no attested credential data or extension output.
   // Require UP and UV, reject reserved bits and inconsistent backup flags.
   if(auth.length!==37||!auth.subarray(0,32).equals(sha(input.rpId)))return {status:'denied'};
   const flags=auth[32];
   if((flags&5)!==5||(flags&0xe2)!==0||((flags&0x10)!==0&&(flags&8)===0))return {status:'denied'};
  }catch{return {status:'denied'};}
  try{
   const c=await input.consumeChallenge(challenge,assertion.credentialId);
   const now=(input.now??Date.now)();
   if(!c||c.challenge!==challenge||c.credentialId!==assertion.credentialId||typeof c.uid!=='string'||!c.uid||c.uid.length>200||c.uid.includes('/')||
      !Number.isSafeInteger(now)||!Number.isSafeInteger(c.issuedAt)||!Number.isSafeInteger(c.expiresAt)||c.issuedAt>now||c.expiresAt<=now||c.expiresAt-c.issuedAt>120000)return {status:'denied'};
   const key=createPublicKey(c.publicKeyPem);
   if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')return {status:'denied'};
   const valid=verify('sha256',Buffer.concat([auth,sha(client)]),key,signature);
   return valid?{status:'verified',uid:c.uid,authenticatedAt:now}:{status:'denied'};
  }catch{return {status:'unavailable'};}
 };
}

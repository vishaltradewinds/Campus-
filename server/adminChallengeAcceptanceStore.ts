import {randomBytes,createHash,createPublicKey} from 'node:crypto';
type Credential={uid:string;credentialId:string;publicKeyPem:string};
type Challenge=Credential & {challenge:string;issuedAt:number;expiresAt:number};
const digest=(value:string)=>createHash('sha256').update(value,'ascii').digest('hex');
const canonical=(value:string,max:number)=>typeof value==='string'&&value.length>0&&value.length<=Math.ceil(max*4/3)&&/^[A-Za-z0-9_-]+$/.test(value)&&Buffer.from(value,'base64url').toString('base64url')===value;

// Single-process, bounded, synthetic credential registry and atomic challenge
// consumer for loopback tests. Not persistent and NOT a production key store.
// No public registration, no passwords, no network or external services.
export function createAdminChallengeAcceptanceStore(input:{credentials:readonly Credential[];now?:()=>number;maxPending?:number},env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_ADMIN_ACCEPTANCE_TEST!=='1')throw Error('Administrator challenge store is test-only');
 const max=input.maxPending??32;
 if(!Number.isSafeInteger(max)||max<1||max>256||!Array.isArray(input.credentials)||input.credentials.length>32)throw Error('Invalid acceptance store bounds');
 const registry=new Map<string,Readonly<Credential>>();
 for(const c of input.credentials){
  if(!c||typeof c.uid!=='string'||!c.uid||c.uid.length>200||c.uid.includes('/')||!canonical(c.credentialId,1024)||registry.has(c.credentialId)||typeof c.publicKeyPem!=='string'||c.publicKeyPem.length>4096||!c.publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----'))throw Error('Invalid fixture credential');
  const key=createPublicKey(c.publicKeyPem);
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('Invalid fixture key');
  registry.set(c.credentialId,Object.freeze({...c}));
 }
 const pending=new Map<string,{credentialId:string;issuedAt:number;expiresAt:number}>();
 const clock=input.now??Date.now;
 let previousTime=-1;
 const time=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0||n<previousTime){pending.clear();throw Error('Invalid challenge clock');}previousTime=n;return n;};
 function sweep(now:number){for(const [k,v] of pending)if(v.expiresAt<=now)pending.delete(k);}
 return Object.freeze({
  issue(credentialId:string){
   const now=time();sweep(now);
   if(!registry.has(credentialId))return null;
   // Supersede older challenges for the same credential, never silently evict
   // another credential's active challenge when the global bound is reached.
   for(const [k,v] of pending)if(v.credentialId===credentialId)pending.delete(k);
   if(pending.size>=max)return null;
   const challenge=randomBytes(32).toString('base64url'),expiresAt=now+120000;
   const key=digest(challenge);
   if(pending.has(key))throw Error('Challenge collision');
   pending.set(key,{credentialId,issuedAt:now,expiresAt});
   return {challenge,credentialId,expiresAt};
  },
  async consumeChallenge(challenge:string,credentialId:string):Promise<Challenge|null>{
   const now=time();sweep(now);
   if(!canonical(challenge,32)||Buffer.from(challenge,'base64url').length!==32||!canonical(credentialId,1024))return null;
   const key=digest(challenge),entry=pending.get(key);
   if(!entry||entry.credentialId!==credentialId)return null;
   // No await between reading and deleting: only one concurrent caller wins.
   pending.delete(key);
   const credential=registry.get(credentialId);
   return credential?{...credential,challenge,issuedAt:entry.issuedAt,expiresAt:entry.expiresAt}:null;
  },
  revokeCredential(credentialId:string){
   registry.delete(credentialId);
   for(const [k,v] of pending)if(v.credentialId===credentialId)pending.delete(k);
  }
 });
}

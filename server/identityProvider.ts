import {lookupFirebaseIdentity} from './firebaseIdentity';
import {verifiedAdminClaim} from './workspaceScope';

export type VerifiedPrincipal={uid:string;email?:string|null;adminClaim:boolean};
export type PrincipalResult={status:'verified';identity:VerifiedPrincipal}|{status:'denied'|'unavailable'};
export type IdentityVerifier=(token:string)=>Promise<PrincipalResult>;

// Explicit provider selection: no fallback or accepting tokens from both providers.
export function createIdentityVerifier(options:{provider?:string;apiKey:string;emulator?:boolean;fetcher?:typeof fetch}):IdentityVerifier{
 const provider=options.provider??'firebase';
 if(provider!=='firebase')throw new Error('Identity provider not enabled');
 return async token=>{
  const r=await lookupFirebaseIdentity({token,apiKey:options.apiKey,emulator:options.emulator,fetcher:options.fetcher});
  if(r.status!=='verified')return r;
  return {status:'verified',identity:{...r.identity,adminClaim:verifiedAdminClaim(token,r.identity.uid)}};
 };
}

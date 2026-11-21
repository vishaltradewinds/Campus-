export type FirebaseIdentity={uid:string;email?:string};
export type IdentityResult={status:'verified';identity:FirebaseIdentity}|{status:'denied'|'unavailable'};

export async function lookupFirebaseIdentity(options:{token:string;apiKey:string;emulator?:boolean;fetcher?:typeof fetch}):Promise<IdentityResult> {
  const {token,apiKey,emulator=false,fetcher=fetch}=options;
  if(!token || !apiKey || token.length>8192)return {status:'denied'};
  try{
    const base=emulator?'http://127.0.0.1:9099/identitytoolkit.googleapis.com':'https://identitytoolkit.googleapis.com';
    const response=await fetcher(base+'/v1/accounts:lookup?key='+encodeURIComponent(apiKey),{method:'POST',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
    if(response.status===400 || response.status===401)return {status:'denied'};
    if(!response.ok)return {status:'unavailable'};
    const data=await response.json() as {users?:Array<{localId?:string;email?:string;disabled?:boolean;validSince?:string}>};
    const record=data.users?.[0];
    if(!record?.localId||record.disabled===true)return {status:'denied'};
    // The Auth service has validated this JWT before its claims are inspected.
    if(record.validSince!==undefined){
      const claims=JSON.parse(Buffer.from(token.split('.')[1]||'','base64url').toString('utf8'));
      const cutoff=Number(record.validSince);
      if(!Number.isFinite(cutoff)||typeof claims.auth_time!=='number'||claims.auth_time<cutoff)return {status:'denied'};
    }
    return {status:'verified',identity:{uid:record.localId,email:record.email}};
  }catch{return {status:'unavailable'};}
}

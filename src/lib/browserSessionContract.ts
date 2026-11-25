// Contract only: no provider activation or browser storage of session credentials.
export type BrowserSessionPrincipal={uid:string;email:string};
export type BrowserSessionState={status:'anonymous'}|{status:'authenticated';principal:BrowserSessionPrincipal}|{status:'unavailable'};
export function parseBrowserSession(body:unknown):BrowserSessionState{
 if(!body||typeof body!=='object')return {status:'unavailable'};
 const b=body as Record<string,unknown>;
 if(b.status==='anonymous'&&Object.keys(b).length===1)return {status:'anonymous'};
 if(b.status!=='authenticated'||Object.keys(b).some(k=>!['status','principal'].includes(k)))return {status:'unavailable'};
 const p=b.principal as Record<string,unknown>|null;
 if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['uid','email'].includes(k))||typeof p.uid!=='string'||!p.uid||p.uid.length>200||p.uid.includes('/')||typeof p.email!=='string'||p.email.length>320||p.email.length<3)return {status:'unavailable'};
 return {status:'authenticated',principal:{uid:p.uid,email:p.email}};
}
export function createBrowserSessionReader(fetcher:typeof fetch=fetch){
 return async():Promise<BrowserSessionState>=>{
  try{
   const r=await fetcher('/api/auth/session',{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
   if(r.status===401)return {status:'anonymous'};
   if(!r.ok)return {status:'unavailable'};
   return parseBrowserSession(await r.json());
  }catch{return {status:'unavailable'};}
 };
}

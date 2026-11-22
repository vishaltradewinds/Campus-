import {createBrowserSessionReader,type BrowserSessionPrincipal} from './browserSessionContract';
// Unmounted client transport; cookie credentials are never exposed to JavaScript.
export function createCookieSessionTransport(fetcher:typeof fetch=fetch){
 const read=createBrowserSessionReader(fetcher);
 let current:BrowserSessionPrincipal|null=null;
 let generation=0;
 async function refresh(){
  const run=++generation;
  current=null;
  const state=await read();
  if(run!==generation)throw Error('Session changed');
  if(state.status==='unavailable')throw Error('Session unavailable');
  current=state.status==='authenticated'?state.principal:null;
  return current;
 }
 async function request(path:string,init:RequestInit={}){
  if(!/^\/api\/(?!auth\/)[a-zA-Z0-9/_-]+$/.test(path))throw Error('Invalid API path');
  if(!current)throw Error('Authentication required');
  const run=generation;
  const headers=new Headers(init.headers);
  if(headers.has('authorization')||headers.has('cookie'))throw Error('Explicit credentials prohibited');
  const response=await fetcher(path,{...init,headers,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
  if(run!==generation)throw Error('Session changed');
  if(response.status===401){generation++;current=null;throw Error('Authentication required');}
  return response;
 }
 return {refresh,request,current:()=>current,invalidate(){generation++;current=null;}};
}

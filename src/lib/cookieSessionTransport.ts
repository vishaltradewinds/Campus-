import {createBrowserSessionReader,type BrowserSessionPrincipal} from './browserSessionContract';
// Only two explicitly supported GET endpoints may carry a query string.
// No user-supplied authority, role, arbitrary filter, origin or fragment.
function validApiRequest(path:string,method:string){
 if(/^\/api\/(?!auth\/)[a-zA-Z0-9/_-]+$/.test(path))return true;
 if(method.toUpperCase()!=='GET'||path.length>1600||path.includes('#'))return false;
 const i=path.indexOf('?');if(i<0)return false;
 const pathname=path.slice(0,i),query=path.slice(i+1);
 if(!['/api/account/registration-institutions','/api/workspace/page'].includes(pathname))return false;
 const params=new URLSearchParams(query),keys=[...params.keys()];
 if(new Set(keys).size!==keys.length)return false;
 const after=params.get('after');
 if(after!==null&&(after.length>200||after.includes('/')||after.includes(String.fromCharCode(0))||['.','..'].includes(after)))return false;
 if(pathname==='/api/account/registration-institutions')return params.get('page')==='1'&&keys.every(k=>['page','after'].includes(k));
 return ['employers','institutions','students','requirements','campaigns','calls','opportunities','users'].includes(params.get('collection')??'')&&keys.every(k=>['collection','after'].includes(k));
}
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
  if(!validApiRequest(path,init.method??'GET'))throw Error('Invalid API path');
  if(!current)throw Error('Authentication required');
  const run=generation;
  const headers=new Headers(init.headers);
  if(headers.has('authorization')||headers.has('cookie'))throw Error('Explicit credentials prohibited');
  const timeout=AbortSignal.timeout(30000);
  const signal=init.signal?AbortSignal.any([init.signal,timeout]):timeout;
  const response=await fetcher(path,{...init,headers,credentials:'same-origin',cache:'no-store',redirect:'error',signal});
  if(run!==generation)throw Error('Session changed');
  if(response.status===401){generation++;current=null;throw Error('Authentication required');}
  return bindResponse(response,run);
 }
 // The authenticated API exposes JSON responses. Guard decoding as well as
 // headers, including cloned responses; a changed identity must not consume
 // a response from its predecessor. No raw streaming API is exposed.
 function bindResponse(response:Response,run:number):Response{
  function check(){if(run!==generation||!current)throw Error('Session changed');}
  return new Proxy(response,{
   get(target,key){
    if(key==='body')throw Error('Raw response streams are not supported');
    if(key==='clone')return ()=>{check();return bindResponse(target.clone(),run);};
    if(typeof key==='string'&&['json','text','blob','arrayBuffer','formData','bytes'].includes(key)){
     const read=Reflect.get(target,key,target);
     if(typeof read!=='function')return undefined;
     return async()=>{check();const value=await read.call(target);check();return value;};
    }
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
   }
  });
 }
 return {refresh,request,current:()=>current,invalidate(){generation++;current=null;}};
}

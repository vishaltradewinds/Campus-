import {createCookieSessionTransport} from './cookieSessionTransport';
import type {BrowserSessionPrincipal} from './browserSessionContract';
type State={status:'anonymous'|'busy'|'unavailable'}|{status:'authenticated';principal:BrowserSessionPrincipal};
export function createCookieIdentityLifecycle(fetcher:typeof fetch=fetch){
 const transport=createCookieSessionTransport(fetcher);
 let state:State={status:'anonymous'},busy=false;
 const listeners=new Set<(state:State)=>void>();
 function publish(next:State){state=next;for(const listener of listeners)listener(next);}
 async function operate(work:()=>Promise<BrowserSessionPrincipal|null>){
  if(busy)throw Error('Authentication operation in progress');
  busy=true;transport.invalidate();publish({status:'busy'});
  try{const principal=await work();publish(principal?{status:'authenticated',principal}:{status:'anonymous'});return principal;}
  catch(error){transport.invalidate();publish({status:'unavailable'});throw error;}
  finally{busy=false;}
 }
 async function post(path:'/api/auth/login'|'/api/auth/logout',body?:unknown){
  return fetcher(path,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 }
 return {
  current:()=>state,
  subscribe(listener:(state:State)=>void){listeners.add(listener);listener(state);return ()=>{listeners.delete(listener);};},
  restore:()=>operate(transport.refresh),
  signIn:(login:string,password:string)=>operate(async()=>{const r=await post('/api/auth/login',{login,password});if(r.status===401)return null;if(r.status!==204)throw Error('Sign-in unavailable');const principal=await transport.refresh();if(!principal)throw Error('Session not confirmed');return principal;}),
  signOut:()=>operate(async()=>{const r=await post('/api/auth/logout');if(r.status!==204&&r.status!==401)throw Error('Logout not confirmed');return null;}),
  async request(path:string,init?:RequestInit){try{return await transport.request(path,init);}catch(error){if(!busy&&!transport.current()&&state.status==='authenticated')publish({status:'anonymous'});throw error;}}
 };
}

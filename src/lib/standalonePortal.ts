import {createAccountClient} from './accountClient';
import {createCookieIdentityLifecycle} from './cookieIdentityLifecycle';
import type {UserData} from '../context/AuthContext';
// Isolated composition root for the independently authenticated application.
export type PortalState={status:'anonymous'|'loading'|'unavailable'|'unregistered'}|{status:'ready';account:UserData;workspace:Awaited<ReturnType<ReturnType<typeof createAccountClient>['fetchStakeholderWorkspace']>>};
export function createStandalonePortal(fetcher:typeof fetch=fetch){
 const identity=createCookieIdentityLifecycle(fetcher);
 let state:PortalState={status:'anonymous'},generation=0;
 const listeners=new Set<(state:PortalState)=>void>();
 function publish(s:PortalState){state=s;for(const l of listeners)l(s);}
 identity.subscribe(s=>{generation++;publish({status:s.status==='busy'||s.status==='authenticated'?'loading':s.status});});
 async function load(){
  const run=++generation;
  const s=identity.current();if(s.status!=='authenticated')return;
  publish({status:'loading'});
  try{const client=createAccountClient(s.principal.uid,identity.request);const account=await client.fetchOwnAccount();if(run!==generation)return;if(!account){publish({status:'unregistered'});return;}if(!['student','institution','employer'].includes(account.role))throw Error('Unsupported role');const workspace=await client.fetchStakeholderWorkspace(account.role);if(run!==generation)return;if(workspace.status!=='ready')throw Error('Workspace unavailable');publish({status:'ready',account,workspace});}
  catch{if(run===generation)publish({status:'unavailable'});}
 }
 return {current:()=>state,subscribe(l:(state:PortalState)=>void){listeners.add(l);l(state);return()=>{listeners.delete(l);};},async restore(){await identity.restore();await load();},async signIn(login:string,password:string){const p=await identity.signIn(login,password);if(p)await load();return !!p;},signOut:identity.signOut,retry:load};
}

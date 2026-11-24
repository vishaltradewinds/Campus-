import React,{useEffect,useMemo,useState} from 'react';
import {AuthContext,type UserData} from '../context/AuthContext';
import {TalentNetworkProvider,useTalentNetwork} from '../context/TalentNetworkContext';
import {createCookieIdentityLifecycle} from '../lib/cookieIdentityLifecycle';
import {createAccountClient} from '../lib/accountClient';
import {EmployerPortal} from './employer/EmployerPortal';
import {InstitutionPortal} from './institution/InstitutionPortal';
import {StudentPortal} from './student/StudentPortal';
import {WorkspacePageViewer} from './WorkspacePageViewer';
export function StandaloneDashboardAcceptance({identity,initialAccount}:{identity:ReturnType<typeof createCookieIdentityLifecycle>;initialAccount:UserData}){
 const [session,setSession]=useState(identity.current());
 const [record,setRecord]=useState<UserData|null>(initialAccount);
 const [error,setError]=useState(false);
 useEffect(()=>identity.subscribe(setSession),[identity]);
 const principal=useMemo(()=>session.status==='authenticated'?{...session.principal,getIdToken:async()=>{throw Error('Bearer credentials are not available');}}:null,[session]);
 const currentPrincipal=()=>identity.current()===session?principal:null;
 async function refreshUserData(){
  if(!principal)return;
  try{const user=await createAccountClient(principal.uid,identity.request).fetchOwnAccount();if(identity.current()!==session)return;if(!user||!['student','institution','employer'].includes(user.role))throw Error('Stakeholder unavailable');setRecord(user);setError(false);}
  catch{if(identity.current()===session){setRecord(null);setError(true);}}
 }
 // The enclosing session already fetched this account; avoid a second duplicate request.
 useEffect(()=>{setRecord(initialAccount);setError(false);},[initialAccount]);
 const safe=principal&&record?.uid===principal.uid&&identity.current()===session?record:null;
 if(!safe)return <section role="status">{error?'Workspace unavailable':'Waiting for authenticated stakeholder'}{error&&<button onClick={()=>void refreshUserData()}>Retry account</button>}<button onClick={()=>void identity.signOut().catch(()=>setError(true))}>Sign out</button></section>;
 return <AuthContext.Provider value={{user:principal,userData:safe,request:identity.request,currentPrincipal,loading:false,isSuperAdmin:false,signOut:async()=>{await identity.signOut();},refreshUserData}}>
  <TalentNetworkProvider key={safe.uid+':'+safe.role}><Workspace role={safe.role}/></TalentNetworkProvider>
 </AuthContext.Provider>;
}
function Workspace({role}:{role:string}){
 const {workspaceStatus,retryWorkspace}=useTalentNetwork();const {signOut}=React.useContext(AuthContext);
 const [browse,setBrowse]=useState(false);
 if(browse)return <WorkspacePageViewer onClose={()=>setBrowse(false)}/>;
 if(workspaceStatus!=='ready')return <section role="status">Workspace {workspaceStatus}<button onClick={retryWorkspace}>Retry</button>{workspaceStatus==='unavailable'&&<button onClick={()=>setBrowse(true)}>Browse records (read-only)</button>}<button onClick={()=>void signOut()}>Sign out</button></section>;
 return <main><button onClick={()=>void signOut()}>Sign out</button><button onClick={()=>setBrowse(true)}>Browse records (read-only)</button>{role==='student'?<StudentPortal/>:role==='institution'?<InstitutionPortal/>:role==='employer'?<EmployerPortal/>:null}</main>;
}

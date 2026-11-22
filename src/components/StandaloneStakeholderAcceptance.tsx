import React,{useEffect,useMemo,useState} from 'react';
import {createCookieIdentityLifecycle} from '../lib/cookieIdentityLifecycle';
import {createAccountClient} from '../lib/accountClient';
import type {UserData} from '../context/AuthContext';
import {StandaloneRegistration} from './StandaloneRegistration';

// Isolated standalone acceptance screen, NOT imported by the running application.
// Server endpoints remain test-only; do not expose this screen in production.
export function StandaloneStakeholderAcceptance({fetcher,renderDashboard}:{fetcher?:typeof fetch;renderDashboard?:(identity:ReturnType<typeof createCookieIdentityLifecycle>)=>React.ReactNode}){
 const identity=useMemo(()=>createCookieIdentityLifecycle(fetcher),[fetcher]);
 const [state,setState]=useState(identity.current());
 const [account,setAccount]=useState<UserData|null>(null);
 const [missing,setMissing]=useState(false);
 const [workspace,setWorkspace]=useState<{role:string;status:string}|null>(null);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [enrolling,setEnrolling]=useState(false),[invite,setInvite]=useState(''),[notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const unsubscribe=identity.subscribe(setState);
  void identity.restore().catch(()=>setError('Authentication service unavailable'));
  return ()=>{unsubscribe();};
 },[identity]);
 async function load(uid:string){
  const session=identity.current();if(session.status!=='authenticated'||session.principal.uid!==uid)return;
  setMissing(false);
  const client=createAccountClient(uid,identity.request);
  const record=await client.fetchOwnAccount();
  const latest=identity.current();if(latest!==session)return;
  if(!record){setAccount(null);setWorkspace(null);setMissing(true);setError('');return;}
  const view=await client.fetchStakeholderWorkspace(record.role);
  if(view.uid!==uid||view.role!==record.role)throw Error('Workspace identity mismatch');
  const afterWorkspace=identity.current();if(afterWorkspace!==session)return;
  setAccount(record);setWorkspace({role:view.role,status:view.status});
 }
 useEffect(()=>{
  const uid=state.status==='authenticated'?state.principal.uid:null;
  if(!uid){setAccount(null);setWorkspace(null);setMissing(false);return;}
  let cancelled=false;
  void load(uid).catch(()=>{if(!cancelled){setAccount(null);setWorkspace(null);setError('Stakeholder workspace unavailable');}});
  return ()=>{cancelled=true;};
 },[state]);
 async function login(event:React.FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   const principal=await identity.signIn(email.trim(),password);
   setPassword('');
   if(!principal)setError('Invalid credentials');
  }catch{setError('Authentication unavailable');}
  finally{setBusy(false);}
 }
 async function enroll(event:React.FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  try{const accepted=await identity.enroll(invite.trim(),password);if(accepted){setEnrolling(false);setNotice('Invitation redeemed. Sign in using your invited email and chosen password.');}else setError('Invitation invalid or expired. Request a new invitation.');}
  catch{setError('Enrollment service unavailable.');}finally{setInvite('');setPassword('');setBusy(false);}
 }
 async function logout(){if(busy)return;setBusy(true);setError('');
  try{await identity.signOut();setAccount(null);setWorkspace(null);}
  catch{setError('Logout could not be confirmed');}
  finally{setBusy(false);}
 }
 if(renderDashboard&&state.status==='authenticated'&&!busy&&account?.uid===state.principal.uid&&workspace?.status==='ready')return <>{renderDashboard(identity)}</>;
 return <main aria-label="Standalone stakeholder acceptance" className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
  <section className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-sm">
   <h1 className="text-2xl font-bold">NexusTalent</h1>
   <p className="mt-2 text-sm text-slate-600">Independent authentication acceptance interface</p>
   {notice&&<p role="status">{notice}</p>}
   {error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}
   {state.status==='busy'||busy?<p role="status">Verifying session…</p>:state.status==='unavailable'?<p role="alert">Session service unavailable. Do not continue with a stale session.</p>:state.status==='authenticated'?<>
    <p className="mt-6">Signed in as {state.principal.email}</p>
    {missing?<StandaloneRegistration key={state.principal.uid} uid={state.principal.uid} request={identity.request} onRegistered={()=>load(state.principal.uid)}/>:account&&workspace?<section aria-label="Stakeholder workspace" className="mt-4 rounded-xl border p-4"><h2 className="font-semibold">{account.name}</h2><p>Role: {workspace.role}</p><p>Workspace: {workspace.status}</p></section>:<p role="status">Checking authorized workspace…</p>}
    <button type="button" onClick={()=>void logout()} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-white">Sign out</button>
   </>:enrolling?<form onSubmit={e=>void enroll(e)} className="mt-6 flex flex-col gap-4"><label>Invitation code<input autoComplete="off" type="password" required value={invite} onChange={e=>setInvite(e.target.value)} className="block w-full rounded-lg border p-3"/></label><label>Choose password<input type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={password} onChange={e=>setPassword(e.target.value)} className="block w-full rounded-lg border p-3"/></label><button type="submit" className="rounded-lg bg-indigo-700 p-3 text-white">Redeem invitation</button><button type="button" onClick={()=>{setEnrolling(false);setInvite('');setPassword('');setError('');}}>Return to sign in</button></form>:<form onSubmit={e=>void login(e)} className="mt-6 flex flex-col gap-4">
    <label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} className="block w-full rounded-lg border p-3"/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="block w-full rounded-lg border p-3"/></label>
    <button type="submit" className="rounded-lg bg-indigo-700 px-4 py-3 text-white">Sign in</button>
    <button type="button" onClick={()=>{setEnrolling(true);setPassword('');setError('');setNotice('');}}>Use an invitation</button>
    <p className="text-sm text-slate-600">Access is limited to pre-authorized accounts. Public registration is not active.</p>
   </form>}
  </section>
 </main>;
}

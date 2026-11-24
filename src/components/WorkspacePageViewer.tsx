import React,{useEffect,useState,useRef} from 'react';
import {useAuth} from '../context/AuthContext';
import {createAccountClient} from '../lib/accountClient';
import {createRecruitmentClient} from '../lib/recruitmentTransport';
const views:Record<string,string[]>={student:['opportunities'],employer:['institutions','employers','requirements','campaigns','calls','opportunities'],institution:['students','institutions','employers','campaigns','calls','opportunities'],super_admin:['employers','institutions','requirements','campaigns','calls','opportunities','users']};
const labels:Record<string,string>={students:'Students',employers:'Employers',institutions:'Institutions',requirements:'Hiring requirements',campaigns:'Campaigns',calls:'Calls for talent',opportunities:'Opportunities',users:'Accounts'};
function display(row:Record<string,any>){
 const value=[row.title,row.name,row.role,row.requirement?.role,row.id,row.uid,row.employerName,row.institutionName].find(v=>typeof v==='string'&&v.trim());
 return typeof value==='string'?value:'Record';
}
// Individual student actions use the same trusted server transactions as the
// full workspace. Partial pages never enter matching or aggregate calculations.
export function WorkspacePageViewer({onClose}:{onClose:()=>void}){
 const {user,userData,request,currentPrincipal}=useAuth();const uid=user?.uid??'',role=userData?.role??'';
 const available=views[role]??[];
 const [collection,setCollection]=useState(available[0]??''),[cursor,setCursor]=useState(''),[history,setHistory]=useState<string[]>([]),[retry,setRetry]=useState(0);
 const [records,setRecords]=useState<Record<string,any>[]>([]),[next,setNext]=useState<string|null>(null),[status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading');
 const [pending,setPending]=useState(false),[notice,setNotice]=useState(''),[actionError,setActionError]=useState('');
 const lock=useRef(false),alive=useRef(true),attempt=useRef<{key:string;requestId:string}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[uid,role]);
 async function act(row:Record<string,any>,action:'accept'|'apply'|'decline'){
  if(lock.current||currentPrincipal()?.uid!==uid||role!=='student'||collection!=='opportunities'||status!=='ready'||row.studentId!==uid||!records.includes(row))return;
  const offer=row.offerSummary;
  const offered=row.stage==='offered'&&offer?.id===row.offerRecordId&&offer?.currency==='INR'&&typeof offer.salaryLPA==='number'&&Number.isFinite(offer.salaryLPA)&&offer.salaryLPA>=0&&typeof offer.terms==='string'&&offer.terms.trim()&&typeof offer.joiningWindow==='string';
  if(action==='accept'?!offered:!['invited','declined','assessment_pending'].includes(row.stage))return;
  const prompt=action==='accept'?'Accept the displayed job offer? Joining remains a separate step.':action==='apply'?'Apply using your existing employer-specific consent?':'Decline this application?';
  if(!window.confirm(prompt))return;
  const key=JSON.stringify([uid,row.id,action,row.stage,action==='accept'?offer.id:null]);
  if(attempt.current?.key!==key)attempt.current={key,requestId:crypto.randomUUID()};
  const requestId=attempt.current.requestId;
  lock.current=true;setPending(true);setNotice('');setActionError('');
  try{
   const client=createRecruitmentClient(request,()=>window.dispatchEvent(new Event('nexustalent:workspace-changed')));
   if(action==='accept')await client.executeTrustedRecruitmentTransition('ADVANCE_CANDIDATE_STAGE',{opportunityId:row.id,nextStage:'accepted'},requestId);
   else await client.executeTrustedRecruitmentTransition('SUBMIT_CONSENT',{opportunityId:row.id,consented:action==='apply'},requestId);
   attempt.current=null;if(alive.current&&currentPrincipal()?.uid===uid)setNotice('Action confirmed. Refreshing current records.');
  }catch{if(alive.current&&currentPrincipal()?.uid===uid)setActionError('Action not confirmed. Review the refreshed record before retrying. Application requires current employer-specific consent.');}
  finally{lock.current=false;if(alive.current&&currentPrincipal()?.uid===uid){setPending(false);setStatus('loading');setRetry(x=>x+1);}}
 }
 useEffect(()=>{
  let active=true;setStatus('loading');setRecords([]);setNext(null);
  if(!uid||!available.includes(collection)){setStatus('unavailable');return;}
  void createAccountClient(uid,request).fetchWorkspacePage(role,collection,cursor).then(page=>{if(active){setRecords(page.records);setNext(page.nextCursor);setStatus('ready');}}).catch(()=>{if(active)setStatus('unavailable');});
  return()=>{active=false;};
 },[uid,role,request,collection,cursor,retry]);
 return <section className="max-w-3xl mx-auto p-4 space-y-4" aria-label="Paged workspace records">
 <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-xl">Browse workspace records</h2><button type="button" disabled={pending} className="border rounded p-2" onClick={onClose}>Back to workspace</button></div>
 <p className="text-sm text-slate-600">Each page is independently retrieved; records may change between pages. Student application and offer actions use the verified record; full dashboard totals, matching and other workflow actions are unavailable here.</p>
 <label className="block">Record type<select className="block border rounded p-2 w-full" value={collection} disabled={pending} onChange={e=>{setCollection(e.target.value);setCursor('');setHistory([]);setRecords([]);setNext(null);setStatus('loading');}}>{available.map(v=><option key={v} value={v}>{labels[v]}</option>)}</select></label>
 {notice&&<p role="status">{notice}</p>}{actionError&&<p role="alert">{actionError}</p>}
 {status==='loading'?<p role="status">Loading records…</p>:status==='unavailable'?<div role="alert">Records unavailable. <button type="button" onClick={()=>setRetry(x=>x+1)}>Retry</button></div>:<><p role="status">Page {history.length+1} · {records.length} records on this page</p><ul className="divide-y border rounded">{records.map(r=><li className="p-3" key={collection==='users'?r.uid:r.id}><div className="font-medium">{display(r)}</div>{typeof (r.stage??r.status??r.empanelmentStatus??r.verificationStatus)==='string'&&<p className="text-sm text-slate-600">{r.stage??r.status??r.empanelmentStatus??r.verificationStatus}</p>}
 {role==='student'&&collection==='opportunities'&&r.studentId===uid&&<div className="mt-2 space-y-2">
 {['invited','declined','assessment_pending'].includes(r.stage)&&<div className="flex flex-wrap gap-2">{r.stage!=='assessment_pending'&&<button type="button" disabled={pending} className="border rounded p-2" onClick={()=>void act(r,'apply')}>Apply using existing consent</button>}{r.stage!=='declined'&&<button type="button" disabled={pending} className="border rounded p-2" onClick={()=>void act(r,'decline')}>Decline application</button>}</div>}
 {r.stage==='offered'&&(r.offerSummary?.id===r.offerRecordId&&r.offerSummary?.currency==='INR'&&typeof r.offerSummary.salaryLPA==='number'&&Number.isFinite(r.offerSummary.salaryLPA)&&r.offerSummary.salaryLPA>=0&&typeof r.offerSummary.terms==='string'&&r.offerSummary.terms.trim()&&typeof r.offerSummary.joiningWindow==='string'?<section aria-label="Paged issued offer terms" className="border rounded p-3"><p>Annual compensation: ₹{r.offerSummary.salaryLPA} LPA</p><p>Joining period: {r.offerSummary.joiningWindow}</p><p className="whitespace-pre-wrap break-words">{r.offerSummary.terms}</p><button type="button" disabled={pending} className="bg-indigo-700 text-white rounded p-2 mt-2" onClick={()=>void act(r,'accept')}>Accept displayed offer</button></section>:<p role="status">Offer terms unavailable; request reconciliation.</p>)}
 </div>}</li>)}</ul>{!records.length&&<p>No records on this page.</p>}</>}
 <div className="flex gap-3"><button type="button" disabled={pending||status!=='ready'||!history.length} className="border rounded p-2 disabled:opacity-50" onClick={()=>{setStatus('loading');setCursor(history[history.length-1]);setHistory(h=>h.slice(0,-1));}}>Previous page</button><button type="button" disabled={pending||status!=='ready'||next===null} className="border rounded p-2 disabled:opacity-50" onClick={()=>{if(next!==null){setStatus('loading');setHistory(h=>[...h,cursor]);setCursor(next);}}}>Next page</button></div>
 </section>;
}

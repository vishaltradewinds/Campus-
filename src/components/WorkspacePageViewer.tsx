import React,{useEffect,useState,useRef} from 'react';
import {useAuth} from '../context/AuthContext';
import {createAccountClient} from '../lib/accountClient';
import {createRecruitmentClient} from '../lib/recruitmentTransport';
const views:Record<string,string[]>={student:['opportunities'],employer:['institutions','employers','requirements','campaigns','calls','opportunities'],institution:['students','institutions','employers','campaigns','calls','opportunities'],super_admin:['employers','institutions','requirements','campaigns','calls','opportunities','users']};
const labels:Record<string,string>={students:'Students',employers:'Employers',institutions:'Institutions',requirements:'Hiring requirements',campaigns:'Campaigns',calls:'Calls for talent',opportunities:'Opportunities',users:'Accounts'};
function RecordContext({row,collection}:{row:Record<string,any>;collection:string}){
 const fields:Array<[string,unknown]>=collection==='calls'?[['Employer',row.employerName],['Hiring role',row.role],['Vacancies requested',row.vacanciesRequested],['Advertised compensation',row.salaryLPA],['Response deadline',row.deadline],['Joining window',row.joiningWindow],['Invitation reference',row.id]]:collection==='opportunities'?[['Employer',row.employerName],['Hiring role',row.role],['Institution',row.institutionName],['Advertised minimum (LPA)',row.salaryLPA],['Joining window',row.joiningWindow]]:[];
 if(!fields.length)return null;
 return <dl className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">{fields.map(([label,value])=><div key={label}><dt className="text-slate-600">{label}</dt><dd className="break-words">{typeof value==='string'&&value.trim()?value:typeof value==='number'&&Number.isFinite(value)?String(value):'Not recorded'}</dd></div>)}</dl>;
}
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
 async function runTransition(action:Parameters<ReturnType<typeof createRecruitmentClient>['executeTrustedRecruitmentTransition']>[0],payload:Record<string,any>,confirmation:string){
  if(lock.current||currentPrincipal()?.uid!==uid||status!=='ready'||!window.confirm(confirmation))return;
  const key=JSON.stringify([uid,action,payload]);
  if(attempt.current?.key!==key)attempt.current={key,requestId:crypto.randomUUID()};
  const requestId=attempt.current.requestId;
  lock.current=true;setPending(true);setNotice('');setActionError('');
  try{
   const client=createRecruitmentClient(request,()=>window.dispatchEvent(new Event('nexustalent:workspace-changed')));
   await client.executeTrustedRecruitmentTransition(action,payload,requestId);
   attempt.current=null;if(alive.current&&currentPrincipal()?.uid===uid)setNotice('Action confirmed. Refreshing current records.');
  }catch{if(alive.current&&currentPrincipal()?.uid===uid)setActionError('Action not confirmed. Review the refreshed record before retrying. The server must verify current authority, consent and workflow state.');}
  finally{lock.current=false;if(alive.current&&currentPrincipal()?.uid===uid){setPending(false);setStatus('loading');setRetry(x=>x+1);}}
 }
 async function act(row:Record<string,any>,action:'accept'|'apply'|'decline'){
  if(role!=='student'||collection!=='opportunities'||row.studentId!==uid||!records.includes(row))return;
  const offer=row.offerSummary;
  const offered=row.stage==='offered'&&offer?.id===row.offerRecordId&&offer?.currency==='INR'&&typeof offer.salaryLPA==='number'&&Number.isFinite(offer.salaryLPA)&&offer.salaryLPA>=0&&typeof offer.terms==='string'&&offer.terms.trim()&&typeof offer.joiningWindow==='string';
  if(action==='accept'?!offered:!['invited','declined','assessment_pending'].includes(row.stage))return;
  if(action==='accept')await runTransition('ADVANCE_CANDIDATE_STAGE',{opportunityId:row.id,nextStage:'accepted'},'Accept the displayed job offer? Joining remains a separate step.');
  else await runTransition('SUBMIT_CONSENT',{opportunityId:row.id,consented:action==='apply'},action==='apply'?'Apply using your existing employer-specific consent?':'Decline this application?');
 }
 async function respond(row:Record<string,any>,e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(role!=='institution'||collection!=='calls'||row.institutionId!==uid||row.status!=='pending'||!records.includes(row))return;
  const form=new FormData(e.currentTarget),choice=String(form.get('responseStatus')),notes=String(form.get('notes')??'').trim(),count=Number(form.get('candidateCount'));
  if(!['accepted','partial','declined'].includes(choice)||!notes||notes.length>2000||(choice!=='declined'&&(!Number.isSafeInteger(count)||count<1||count>100000))){setActionError('Provide a response note and a valid committed candidate count.');return;}
  await runTransition('RESPOND_CALL',{callId:row.id,status:choice,responseNotes:notes,offeredCandidatesCount:choice==='declined'?0:count},'Submit this institutional response and committed candidate count?');
 }
 async function startInterview(row:Record<string,any>,e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(role!=='employer'||collection!=='opportunities'||row.employerId!==uid||row.stage!=='shortlisted'||!records.includes(row))return;
  const notes=String(new FormData(e.currentTarget).get('interviewNotes')??'').trim();
  if(!notes||notes.length>2000){setActionError('Record a brief interview coordination note.');return;}
  await runTransition('ADVANCE_CANDIDATE_STAGE',{opportunityId:row.id,nextStage:'interviewing',meta:{interviewFeedback:notes}},'Confirm the human-reviewed shortlisted candidate is entering the interview stage?');
 }

 useEffect(()=>{
  let active=true;setStatus('loading');setRecords([]);setNext(null);
  if(!uid||!available.includes(collection)){setStatus('unavailable');return;}
  void createAccountClient(uid,request).fetchWorkspacePage(role,collection,cursor).then(page=>{if(active){setRecords(page.records);setNext(page.nextCursor);setStatus('ready');}}).catch(()=>{if(active)setStatus('unavailable');});
  return()=>{active=false;};
 },[uid,role,request,collection,cursor,retry]);
 return <section className="max-w-3xl mx-auto p-4 space-y-4" aria-label="Paged workspace records">
 <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-xl">Browse workspace records</h2><button type="button" disabled={pending} className="border rounded p-2" onClick={onClose}>Back to workspace</button></div>
 <p className="text-sm text-slate-600">Each page is independently retrieved; records may change between pages. Selected student, institution and employer actions use trusted server transactions. Full dashboard totals, matching and other workflow actions remain unavailable here.</p>
 <label className="block">Record type<select className="block border rounded p-2 w-full" value={collection} disabled={pending} onChange={e=>{setCollection(e.target.value);setCursor('');setHistory([]);setRecords([]);setNext(null);setNotice('');setActionError('');setStatus('loading');}}>{available.map(v=><option key={v} value={v}>{labels[v]}</option>)}</select></label>
 {notice&&<p role="status">{notice}</p>}{actionError&&<p role="alert">{actionError}</p>}
 {status==='loading'?<p role="status">Loading records…</p>:status==='unavailable'?<div role="alert">Records unavailable. <button type="button" onClick={()=>setRetry(x=>x+1)}>Retry</button></div>:<><p role="status">Page {history.length+1} · {records.length} records on this page</p><ul className="divide-y border rounded">{records.map(r=><li className="p-3" key={collection==='users'?r.uid:r.id}><div className="font-medium">{display(r)}</div>{typeof (r.stage??r.status??r.empanelmentStatus??r.verificationStatus)==='string'&&<p className="text-sm text-slate-600">{r.stage??r.status??r.empanelmentStatus??r.verificationStatus}</p>}
 <RecordContext row={r} collection={collection}/>
 {role==='student'&&collection==='opportunities'&&r.studentId===uid&&<div className="mt-2 space-y-2">
 {['invited','declined','assessment_pending'].includes(r.stage)&&<div className="flex flex-wrap gap-2">{r.stage!=='assessment_pending'&&<button type="button" disabled={pending} className="border rounded p-2" onClick={()=>void act(r,'apply')}>Apply using existing consent</button>}{r.stage!=='declined'&&<button type="button" disabled={pending} className="border rounded p-2" onClick={()=>void act(r,'decline')}>Decline application</button>}</div>}
 {r.stage==='offered'&&(r.offerSummary?.id===r.offerRecordId&&r.offerSummary?.currency==='INR'&&typeof r.offerSummary.salaryLPA==='number'&&Number.isFinite(r.offerSummary.salaryLPA)&&r.offerSummary.salaryLPA>=0&&typeof r.offerSummary.terms==='string'&&r.offerSummary.terms.trim()&&typeof r.offerSummary.joiningWindow==='string'?<section aria-label="Paged issued offer terms" className="border rounded p-3"><p>Annual compensation: ₹{r.offerSummary.salaryLPA} LPA</p><p>Joining period: {r.offerSummary.joiningWindow}</p><p className="whitespace-pre-wrap break-words">{r.offerSummary.terms}</p><button type="button" disabled={pending} className="bg-indigo-700 text-white rounded p-2 mt-2" onClick={()=>void act(r,'accept')}>Accept displayed offer</button></section>:<p role="status">Offer terms unavailable; request reconciliation.</p>)}
 </div>}
 {role==='institution'&&collection==='calls'&&r.institutionId===uid&&r.status==='pending'&&<form onSubmit={e=>void respond(r,e)} className="mt-3 space-y-2 border rounded p-3" aria-label="Institution call response"><fieldset disabled={pending} className="space-y-2"><legend className="font-medium">Respond to invitation</legend><label className="block">Response<select name="responseStatus" className="block border rounded p-2"><option value="accepted">Accept</option><option value="partial">Partially accept</option><option value="declined">Decline</option></select></label><label className="block">Committed candidates (0 when declining)<input name="candidateCount" type="number" min="0" max="100000" step="1" required defaultValue="0" className="block border rounded p-2"/></label><label className="block">Response notes<textarea name="notes" maxLength={2000} required className="block w-full border rounded p-2"/></label><button type="submit" className="bg-indigo-700 text-white rounded p-2">Submit institutional response</button></fieldset></form>}
 {role==='employer'&&collection==='opportunities'&&r.employerId===uid&&r.stage==='shortlisted'&&<form onSubmit={e=>void startInterview(r,e)} aria-label="Interview stage confirmation" className="mt-3 border rounded p-3 space-y-2"><fieldset disabled={pending}><legend className="font-medium">Previously shortlisted candidate</legend><p className="text-sm">Opportunity reference: {r.id}</p><label className="block">Interview coordination note<textarea name="interviewNotes" required maxLength={2000} className="block w-full border rounded p-2"/></label><button type="submit" className="bg-indigo-700 text-white rounded p-2 mt-2">Confirm interview stage</button></fieldset></form>}
 </li>)}</ul>{!records.length&&<p>No records on this page.</p>}</>}
 <div className="flex gap-3"><button type="button" disabled={pending||status!=='ready'||!history.length} className="border rounded p-2 disabled:opacity-50" onClick={()=>{setStatus('loading');setCursor(history[history.length-1]);setHistory(h=>h.slice(0,-1));}}>Previous page</button><button type="button" disabled={pending||status!=='ready'||next===null} className="border rounded p-2 disabled:opacity-50" onClick={()=>{if(next!==null){setStatus('loading');setHistory(h=>[...h,cursor]);setCursor(next);}}}>Next page</button></div>
 </section>;
}

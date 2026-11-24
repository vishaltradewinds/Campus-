import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {createAccountClient} from '../lib/accountClient';
const views:Record<string,string[]>={student:['opportunities'],employer:['institutions','employers','requirements','campaigns','calls','opportunities'],institution:['students','institutions','employers','campaigns','calls','opportunities'],super_admin:['employers','institutions','requirements','campaigns','calls','opportunities','users']};
const labels:Record<string,string>={students:'Students',employers:'Employers',institutions:'Institutions',requirements:'Hiring requirements',campaigns:'Campaigns',calls:'Calls for talent',opportunities:'Opportunities',users:'Accounts'};
function display(row:Record<string,any>){
 const value=[row.title,row.name,row.role,row.requirement?.role,row.employerName,row.institutionName,row.id,row.uid].find(v=>typeof v==='string'&&v.trim());
 return typeof value==='string'?value:'Record';
}
// Read-only fallback: never feeds a partial page into matching, dashboards,
// aggregate metrics or any mutation context. All authorization is server-side.
export function WorkspacePageViewer({onClose}:{onClose:()=>void}){
 const {user,userData,request}=useAuth();const uid=user?.uid??'',role=userData?.role??'';
 const available=views[role]??[];
 const [collection,setCollection]=useState(available[0]??''),[cursor,setCursor]=useState(''),[history,setHistory]=useState<string[]>([]),[retry,setRetry]=useState(0);
 const [records,setRecords]=useState<Record<string,any>[]>([]),[next,setNext]=useState<string|null>(null),[status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading');
 useEffect(()=>{
  let active=true;setStatus('loading');setRecords([]);setNext(null);
  if(!uid||!available.includes(collection)){setStatus('unavailable');return;}
  void createAccountClient(uid,request).fetchWorkspacePage(role,collection,cursor).then(page=>{if(active){setRecords(page.records);setNext(page.nextCursor);setStatus('ready');}}).catch(()=>{if(active)setStatus('unavailable');});
  return()=>{active=false;};
 },[uid,role,request,collection,cursor,retry]);
 return <section className="max-w-3xl mx-auto p-4 space-y-4" aria-label="Read-only workspace records">
 <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-xl">Browse workspace records</h2><button type="button" className="border rounded p-2" onClick={onClose}>Back to workspace</button></div>
 <p className="text-sm text-slate-600">Read-only view. Each page is independently retrieved; records may change between pages. Dashboard totals, matching and workflow actions are not available in this view.</p>
 <label className="block">Record type<select className="block border rounded p-2 w-full" value={collection} onChange={e=>{setCollection(e.target.value);setCursor('');setHistory([]);setRecords([]);setNext(null);setStatus('loading');}}>{available.map(v=><option key={v} value={v}>{labels[v]}</option>)}</select></label>
 {status==='loading'?<p role="status">Loading records…</p>:status==='unavailable'?<div role="alert">Records unavailable. <button type="button" onClick={()=>setRetry(x=>x+1)}>Retry</button></div>:<><p role="status">Page {history.length+1} · {records.length} records on this page</p><ul className="divide-y border rounded">{records.map(r=><li className="p-3" key={collection==='users'?r.uid:r.id}><div className="font-medium">{display(r)}</div>{typeof (r.stage??r.status??r.empanelmentStatus??r.verificationStatus)==='string'&&<p className="text-sm text-slate-600">{r.stage??r.status??r.empanelmentStatus??r.verificationStatus}</p>}</li>)}</ul>{!records.length&&<p>No records on this page.</p>}</>}
 <div className="flex gap-3"><button type="button" disabled={status!=='ready'||!history.length} className="border rounded p-2 disabled:opacity-50" onClick={()=>{setStatus('loading');setCursor(history[history.length-1]);setHistory(h=>h.slice(0,-1));}}>Previous page</button><button type="button" disabled={status!=='ready'||next===null} className="border rounded p-2 disabled:opacity-50" onClick={()=>{if(next!==null){setStatus('loading');setHistory(h=>[...h,cursor]);setCursor(next);}}}>Next page</button></div>
 </section>;
}

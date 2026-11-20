import React,{useState} from 'react';
import type {StudentCareerPassport} from '../../types';
import {executeTrustedProfileMutation} from '../../lib/trustedRecruitmentClient';

const fields=[['program','Degree / programme'],['branch','Discipline'],['graduationYear','Graduation year'],['cgpa','CGPA'],['rollNumber','Roll number']] as const;
export function AcademicCorrectionPanel({student}:{student:StudentCareerPassport}){
  const [proposed,setProposed]=useState<Record<string,string>>({});
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const correction=student.academicCorrection;
  const submit=async()=>{
    if(busy)return;
    setBusy(true);setMessage('');
    try{
      const values=Object.fromEntries(Object.entries(proposed).filter(([,v])=>v.trim()).map(([k,v])=>[k,k==='cgpa'||k==='graduationYear'?Number(v):v.trim()]));
      await executeTrustedProfileMutation('REQUEST_ACADEMIC_CORRECTION',{proposed:values,reason});
      setMessage('Correction submitted for review. Current academic details remain unchanged.');
      setProposed({});setReason('');
    }catch(e){setMessage(e instanceof Error?e.message:'Correction submission unavailable');}
    finally{setBusy(false);}
  };
  return <section className="bg-white border border-slate-300 p-4 space-y-3 min-w-0">
    <h3 className="font-bold text-sm">Academic record correction</h3>
    <p className="text-xs text-slate-600">Request changes to incorrect academic details. A reviewer must approve them, and approval resets verification and existing campaign consent. Do not enter identity-document numbers or confidential documents here.</p>
    {correction&&<div className="text-xs border border-slate-200 p-2 break-words"><strong>Status: {correction.status}</strong>{Object.entries(correction.proposed).map(([k,v])=><p key={k}>{fields.find(f=>f[0]===k)?.[1]||k}: {String(correction.before[k]??'Not recorded')} → {String(v)}</p>)}{correction.reviewNote&&<p>Reviewer note: {correction.reviewNote}</p>}</div>}
    {correction?.status!=='pending'&&<><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{fields.map(([key,label])=><label key={key} className="text-xs min-w-0">{label} (current: {String(student[key]??'Not recorded')})<input value={proposed[key]||''} onChange={e=>setProposed({...proposed,[key]:e.target.value})} placeholder="Leave unchanged" className="block w-full border border-slate-300 p-2 mt-1"/></label>)}</div><label className="text-xs block">Reason<textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className="w-full border border-slate-300 p-2"/></label><button type="button" disabled={busy||!reason.trim()||!Object.values(proposed).some(v=>v.trim())} onClick={submit} className="bg-indigo-700 text-white px-3 py-2 text-xs disabled:opacity-50">Submit correction request</button></>}
    {message&&<p role="status" className="text-xs break-words">{message}</p>}
  </section>;
}
export function AcademicCorrectionReview({student}:{student:StudentCareerPassport}){
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const correction=student.academicCorrection;
  if(!correction||correction.status!=='pending')return null;
  const review=async(decision:'approved'|'rejected')=>{
    if(busy||!note.trim())return;
    setBusy(true);setMessage('');
    try{await executeTrustedProfileMutation('REVIEW_ACADEMIC_CORRECTION',{studentId:student.id,correctionId:correction.id,decision,note});setMessage('Academic correction reviewed.');}
    catch(e){setMessage(e instanceof Error?e.message:'Review unavailable');}
    finally{setBusy(false);}
  };
  return <section className="w-full border border-slate-300 p-3 space-y-2 text-xs break-words">
    <strong>Pending academic correction</strong>
    {Object.entries(correction.proposed).map(([k,v])=><p key={k}>{k}: {String(correction.before[k]??'Not recorded')} → {String(v)}</p>)}
    <p>Student reason: {correction.reason}</p>
    <label className="block">Evidence review or rejection reason<textarea maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} className="block w-full border border-slate-300 p-2"/></label>
    <div className="flex flex-wrap gap-2"><button disabled={busy||!note.trim()} onClick={()=>review('approved')} className="bg-indigo-700 text-white px-3 py-2 disabled:opacity-50">Approve correction</button><button disabled={busy||!note.trim()} onClick={()=>review('rejected')} className="border border-slate-400 px-3 py-2 disabled:opacity-50">Reject correction</button></div>
    <p>Approval requires fresh academic verification and campaign consent.</p>{message&&<p role="status">{message}</p>}
  </section>;
}

import React,{useEffect,useState} from 'react';
import {createAccountClient,type AccountRequest} from '../lib/accountClient';
type Role='student'|'institution'|'employer';
type Institution={id:string;name:string;code:string};
// Independent, authenticated stakeholder registration, using only the cookie transport.
// The backend assigns identity, verifies affiliation, and rejects existing registrations.
export function StandaloneRegistration({uid,request,onRegistered}:{uid:string;request:AccountRequest;onRegistered:()=>Promise<void>;key?:string}){
 const [role,setRole]=useState<Role>('student');
 const [kind,setKind]=useState<'independent'|'empanelled'>('independent');
 const [directory,setDirectory]=useState<Institution[]>([]);
 const [directoryReady,setDirectoryReady]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;setDirectory([]);setDirectoryReady(false);
  if(role==='student'&&kind==='empanelled')void createAccountClient(uid,request).fetchRegistrationInstitutions().then(rows=>{if(active){setDirectory(rows);setDirectoryReady(true);}}).catch(()=>{if(active)setError('Institution directory unavailable. Please retry.');});
  return()=>{active=false;};
 },[uid,request,role,kind]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  const form=new FormData(e.currentTarget),value=(key:string)=>String(form.get(key)||'').trim(),number=(key:string)=>Number(value(key));
  const name=value('name');
  const input=role==='student'?{role,name,registrationType:kind,institutionId:kind==='empanelled'?value('institutionId'):'',customCollegeName:kind==='independent'?value('college'):'',state:value('state'),program:value('program'),branch:value('branch'),graduationYear:number('year'),cgpa:number('cgpa'),rollNumber:value('roll'),minSalaryLPA:number('salary')}:role==='institution'?{role,name,code:value('code'),type:value('type'),state:value('state'),city:value('city'),accreditation:value('accreditation'),placementOfficerName:value('officer'),phone:value('phone'),totalStudentSupply:number('supply')}:{role,name,companyName:value('company'),industry:value('industry'),headquarters:value('city'),businessRegNumber:value('registration'),websiteUrl:value('website')};
  try{if(role==='student'&&kind==='empanelled'&&(!directoryReady||!directory.some(i=>i.id===input.institutionId)))throw Error('Select a listed institution');await createAccountClient(uid,request).registerOwnAccount(input);await onRegistered();}
  catch(e){setError(e instanceof Error?e.message:'Registration unavailable');}finally{setBusy(false);}
 }
 const field=(name:string,label:string,required=false,type='text',min?:number,max?:number,step?:number)=><label key={name} className="block">{label}<input name={name} type={type} required={required} min={min} max={max} step={step} className="block w-full border rounded p-2"/></label>;
 return <section aria-label="Stakeholder registration" className="mt-4 space-y-3">
  <h2 className="text-xl font-bold">Create stakeholder profile</h2><p className="text-sm">Your sign-in is confirmed. Choose your stakeholder role. Verification remains pending where required.</p>
  {error&&<p role="alert">{error}</p>}
  <form onSubmit={e=>void submit(e)} className="space-y-3">
   <fieldset disabled={busy} className="space-y-3">
    <label>Stakeholder role<select aria-label="Stakeholder role" value={role} onChange={e=>{setRole(e.target.value as Role);setError('');}} className="block w-full border rounded p-2"><option value="student">Student</option><option value="institution">Institution</option><option value="employer">Employer</option></select></label>
    {field('name','Full name',true)}
    {role==='student'?<>
     <label>Registration type<select aria-label="Registration type" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setError('');}}><option value="independent">Independent</option><option value="empanelled">Empanelled institution</option></select></label>
     {kind==='empanelled'?<label>Institution<select name="institutionId" required disabled={!directoryReady}><option value="">Select institution</option>{directory.map(i=><option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}</select></label>:field('college','College or university')}
     {field('state','State')}{field('program','Degree or programme')}{field('branch','Discipline')}{field('year','Graduation year',true,'number',1950,2100,1)}{field('cgpa','CGPA',true,'number',0,10,0.01)}{field('roll','Roll number')}{field('salary','Minimum salary (LPA)',false,'number',0,100000,0.01)}
    </>:role==='institution'?<>
     {field('code','Institution code')}<label>Institution type<select name="type">{['Central University','State Engineering College','Institute of Technology','Autonomous College','Private University'].map(t=><option key={t}>{t}</option>)}</select></label>{field('state','State')}{field('city','City')}{field('accreditation','Accreditation')}{field('officer','Placement officer')}{field('phone','Contact phone')}{field('supply','Student supply',false,'number',0,1000000,1)}
    </>:<>{field('company','Company name',true)}{field('industry','Industry')}{field('city','Headquarters')}{field('registration','Business registration number')}{field('website','Website')}</>}
    <button type="submit" disabled={role==='student'&&kind==='empanelled'&&!directoryReady} className="bg-indigo-700 text-white p-3 rounded">{busy?'Saving profile…':'Create profile'}</button>
   </fieldset>
  </form>
 </section>;
}

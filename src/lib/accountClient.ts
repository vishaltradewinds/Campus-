import type { User } from 'firebase/auth';
import type { UserData } from '../context/AuthContext';
export async function fetchOwnAccount(user:Pick<User,'uid'|'getIdToken'>):Promise<UserData|null>{
 const token=await user.getIdToken();
 const response=await fetch('/api/account/me',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('Account service temporarily unavailable');
 const body=await response.json();
 if(body.account===null)return null;
 const a=body.account;
 if(!a||a.uid!==user.uid||!['student','institution','employer','super_admin','simulation'].includes(a.role)||typeof a.name!=='string'||typeof a.email!=='string')throw new Error('Invalid account response');
 return {uid:a.uid,role:a.role,name:a.name,email:a.email};
}
export async function registerOwnAccount(user:Pick<User,'getIdToken'>,input:unknown):Promise<void>{
 const token=await user.getIdToken();
 const response=await fetch('/api/account/register',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store',signal:AbortSignal.timeout(25000)});
 const result=await response.json();
 if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'Registration temporarily unavailable');
 if(typeof result.replayed!=='boolean')throw new Error('Invalid registration response');
}
export async function fetchRegistrationInstitutions(user:Pick<User,'getIdToken'>):Promise<Array<{id:string;name:string;code:string}>>{
 const response=await fetch('/api/account/registration-institutions',{headers:{Authorization:'Bearer '+await user.getIdToken()},cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('Institution directory temporarily unavailable');
 const body=await response.json();
 if(!Array.isArray(body.institutions)||body.institutions.length>100||body.institutions.some((r:any)=>!r||typeof r.id!=='string'||typeof r.name!=='string'||typeof r.code!=='string'))throw new Error('Invalid institution directory');
 return body.institutions.map((r:any)=>({id:r.id,name:r.name,code:r.code}));
}
export async function fetchStakeholderWorkspace(user:Pick<User,'uid'|'getIdToken'>,role:string){
 const response=await fetch('/api/workspace',{headers:{Authorization:'Bearer '+await user.getIdToken()},cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('Workspace temporarily unavailable');
 const b=await response.json();
 if(b.uid!==user.uid||b.role!==role||!['ready','missing'].includes(b.status)||!b.collections||!(b.profile===null||b.profile?.id===user.uid))throw new Error('Invalid workspace response');
 const limits={employers:100,institutions:100,students:500,requirements:200,campaigns:200,calls:200,opportunities:200,users:500};
 for(const [key,max] of Object.entries(limits))if(!Array.isArray(b.collections[key])||b.collections[key].length>max)throw new Error('Invalid workspace response');
 return b;
}
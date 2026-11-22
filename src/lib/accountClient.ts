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
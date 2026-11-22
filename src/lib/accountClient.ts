import type { UserData } from '../context/AuthContext';
type User={uid:string;getIdToken:()=>Promise<string>};
export type AccountRequest=(path:string,init?:RequestInit)=>Promise<Response>;
export function createAccountClient(uid:string,request:AccountRequest){
async function fetchOwnAccount():Promise<UserData|null>{
 const response=await request('/api/account/me',{cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('Account service temporarily unavailable');
 const body=await response.json();
 if(body.account===null)return null;
 const a=body.account;
 if(!a||a.uid!==uid||!['student','institution','employer','super_admin','simulation'].includes(a.role)||typeof a.name!=='string'||typeof a.email!=='string')throw new Error('Invalid account response');
 return {uid:a.uid,role:a.role,name:a.name,email:a.email};
}
async function registerOwnAccount(input:unknown):Promise<void>{
 const response=await request('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store',signal:AbortSignal.timeout(25000)});
 const result=await response.json();
 if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'Registration temporarily unavailable');
 if(typeof result.replayed!=='boolean')throw new Error('Invalid registration response');
}
async function fetchRegistrationInstitutions():Promise<Array<{id:string;name:string;code:string}>>{
 const response=await request('/api/account/registration-institutions',{cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('Institution directory temporarily unavailable');
 const body=await response.json();
 if(!Array.isArray(body.institutions)||body.institutions.length>100||body.institutions.some((r:any)=>!r||typeof r.id!=='string'||typeof r.name!=='string'||typeof r.code!=='string'))throw new Error('Invalid institution directory');
 return body.institutions.map((r:any)=>({id:r.id,name:r.name,code:r.code}));
}
async function fetchStakeholderWorkspace(role:string){
 const response=await request('/api/workspace',{cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('Workspace temporarily unavailable');
 const b=await response.json();
 if(b.uid!==uid||b.role!==role||!['ready','missing'].includes(b.status)||!b.collections||!(b.profile===null||b.profile?.id===uid))throw new Error('Invalid workspace response');
 const limits={employers:100,institutions:100,students:500,requirements:200,campaigns:200,calls:200,opportunities:200,users:500};
 for(const [key,max] of Object.entries(limits))if(!Array.isArray(b.collections[key])||b.collections[key].length>max)throw new Error('Invalid workspace response');
 return b;
}
 return {fetchOwnAccount,registerOwnAccount,fetchRegistrationInstitutions,fetchStakeholderWorkspace};
}
function legacy(user:Pick<User,'getIdToken'>,uid=''){return createAccountClient(uid,async(path,init)=>{const headers=new Headers(init?.headers);headers.set('Authorization','Bearer '+await user.getIdToken());return fetch(path,{...init,headers});});}
export const fetchOwnAccount=(user:User)=>legacy(user,user.uid).fetchOwnAccount();
export const registerOwnAccount=(user:Pick<User,'getIdToken'>,input:unknown)=>legacy(user).registerOwnAccount(input);
export const fetchRegistrationInstitutions=(user:Pick<User,'getIdToken'>)=>legacy(user).fetchRegistrationInstitutions();
export const fetchStakeholderWorkspace=(user:User,role:string)=>legacy(user,user.uid).fetchStakeholderWorkspace(role);

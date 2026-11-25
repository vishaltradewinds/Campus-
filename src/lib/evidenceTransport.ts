import type {AccountRequest} from './accountClient';
import type {CareerPassportEvidence} from '../types';
export async function requestCareerEvidence(request:AccountRequest,current:()=>{uid:string}|null):Promise<CareerPassportEvidence[]>{
 const principal=current();if(!principal)throw new Error('Authentication required');
 const response=await request('/api/career-evidence',{cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('Evidence records unavailable');
 const body=await response.json();
 if(current()!==principal||!Array.isArray(body.evidence)||body.evidence.length>200||body.evidence.some((r:any)=>!r||typeof r.id!=='string'))throw new Error('Invalid evidence response');
 return body.evidence;
}
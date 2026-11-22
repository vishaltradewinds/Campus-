import { clientIdentity } from './activeClientIdentity';
import type {CareerPassportEvidence} from '../types';
export async function fetchCareerEvidence():Promise<CareerPassportEvidence[]>{
 const principal=clientIdentity.current();if(!principal)throw new Error('Authentication required');
 const response=await fetch('/api/career-evidence',{headers:{Authorization:'Bearer '+await principal.getIdToken()},cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('Evidence records unavailable');
 const body=await response.json();
 if(clientIdentity.current()?.uid!==principal.uid||!Array.isArray(body.evidence)||body.evidence.length>200||body.evidence.some((r:any)=>!r||typeof r.id!=='string'))throw new Error('Invalid evidence response');
 return body.evidence;
}
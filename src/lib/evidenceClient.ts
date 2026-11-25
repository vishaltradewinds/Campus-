import {clientIdentity} from './activeClientIdentity';
import {requestCareerEvidence} from './evidenceTransport';
export function fetchCareerEvidence(){return requestCareerEvidence(async(path,init)=>{const headers=new Headers(init?.headers);headers.set('Authorization','Bearer '+await clientIdentity.requireToken());return fetch(path,{...init,headers});},clientIdentity.current);}

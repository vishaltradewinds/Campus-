export type WorkspaceCollection='employers'|'institutions'|'students'|'requirements'|'campaigns'|'calls'|'opportunities'|'users'|'careerEvidence';
export type WorkspaceQuery={collection:WorkspaceCollection;limit:number;filter?:{field:'verificationStatus'|'empanelmentStatus'|'employerId'|'institutionId'|'studentId'|'targetedInstitutionIds'|'status';value:string;op:'eq'|'contains'}};
export class WorkspaceDenied extends Error {constructor(){super('Workspace access denied');}}
export const workspaceCollections:WorkspaceCollection[]=['employers','institutions','students','requirements','campaigns','calls','opportunities','users'];
export function workspaceQueries(role:string,uid:string,adminClaim:boolean):WorkspaceQuery[]{
 const q=(collection:WorkspaceCollection,limit:number,field?:NonNullable<WorkspaceQuery['filter']>['field'],value=uid,op:'eq'|'contains'='eq'):WorkspaceQuery=>({collection,limit,...(field?{filter:{field,value,op}}:{})});
 const directories=[q('employers',100,'verificationStatus','verified'),q('institutions',100,'empanelmentStatus','empanelled')];
 switch(role){
  case 'employer':return [...directories,q('requirements',200,'employerId'),q('campaigns',200,'employerId'),q('calls',200,'employerId'),q('opportunities',200,'employerId')];
  case 'institution':return [...directories,q('students',500,'institutionId'),q('campaigns',200,'targetedInstitutionIds',uid,'contains'),q('calls',200,'institutionId'),q('opportunities',200,'institutionId')];
  case 'student':return [q('opportunities',200,'studentId')];
  case 'super_admin':if(!adminClaim)throw new WorkspaceDenied();return [q('employers',100),q('institutions',100),q('requirements',200),q('campaigns',200),q('calls',200),q('opportunities',200),q('users',500)];
  case 'simulation':return [];
  default:throw new WorkspaceDenied();
 }
}
export function matchesWorkspaceQuery(q:WorkspaceQuery,row:Record<string,any>){
 if(!q.filter)return true;
 const value=row[q.filter.field];
 return q.filter.op==='contains'?Array.isArray(value)&&value.includes(q.filter.value):value===q.filter.value;
}
/** Invoke only after the identity provider has validated this exact token. */
export function verifiedAdminClaim(token:string,uid:string){
 try{const claim=JSON.parse(Buffer.from(token.split('.')[1]||'','base64url').toString('utf8'));return claim.sub===uid&&claim.role==='super_admin';}catch{return false;}
}
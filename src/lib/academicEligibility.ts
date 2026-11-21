type AcademicRequirement={graduationYears?:number[];education?:string[];branches?:string[]};
const matches=(choices:string[]|undefined,value:unknown)=>{
  if(!choices?.length)return true;
  if(typeof value!=='string'||!value.trim())return false;
  const normalize=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
  return choices.some(choice=>normalize(choice)===normalize(value));
};
// Empty explicit criteria mean unrestricted. Exact normalized comparison avoids
// treating unrelated disciplines as eligible because of substring overlap.
export function academicEligibility(req:AcademicRequirement,student:{graduationYear?:number;program?:string;branch?:string}){
  return (!req.graduationYears?.length||req.graduationYears.includes(student.graduationYear??0))&&matches(req.education,student.program)&&matches(req.branches,student.branch);
}

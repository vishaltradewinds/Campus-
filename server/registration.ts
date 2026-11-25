import {z} from 'zod';
const text=(max=200)=>z.string().trim().max(max);
const required=text().min(1);
const nonnegative=(max:number)=>z.number().finite().min(0).max(max);
export const registrationSchema=z.discriminatedUnion('role',[
 z.object({role:z.literal('employer'),name:required,companyName:required,industry:text(),headquarters:text(),businessRegNumber:text(),websiteUrl:text(500)}).strict(),
 z.object({role:z.literal('institution'),name:required,code:text(),type:z.enum(['Central University','State Engineering College','Institute of Technology','Autonomous College','Private University']),state:text(),city:text(),accreditation:text(),placementOfficerName:text(),phone:text(40),totalStudentSupply:nonnegative(1000000).int()}).strict(),
 z.object({role:z.literal('student'),name:required,registrationType:z.enum(['independent','empanelled']),institutionId:text(),customCollegeName:text(),state:text(),program:text(),branch:text(),graduationYear:z.union([z.literal(0),z.number().int().min(1950).max(2100)]),cgpa:nonnegative(10),rollNumber:text(),minSalaryLPA:nonnegative(100000)}).strict()
]).superRefine((data,ctx)=>{
 if(data.role==='student'&&data.registrationType==='empanelled'&&!data.institutionId)ctx.addIssue({code:'custom',message:'Select an empanelled institution'});
 if(data.role==='student'&&data.registrationType==='independent'&&data.institutionId)ctx.addIssue({code:'custom',message:'Independent candidates cannot select an institutional affiliation'});
});
export type RegistrationInput=z.infer<typeof registrationSchema>;
export class RegistrationConflict extends Error {constructor(){super('Existing or unavailable stakeholder registration. No record was overwritten.');}}
export function registrationProfile(uid:string,email:string,input:RegistrationInput,institution?:Record<string,any>|null){
 switch(input.role){
 case 'employer':return {id:uid,name:input.companyName,industry:input.industry||'Industry not yet specified',headquarters:input.headquarters,verified:false,verificationStatus:'pending',contactEmail:email,businessRegNumber:input.businessRegNumber,gstinOrCin:input.businessRegNumber,websiteUrl:input.websiteUrl,openRequirementsCount:0,totalHiresCount:0,reputationScore:0};
 case 'institution':return {id:uid,name:input.name,code:input.code,type:input.type,state:input.state,city:input.city,empanelmentStatus:'pending_empanelment',accreditation:input.accreditation,placementOfficerName:input.placementOfficerName,placementOfficerEmail:email,placementOfficerPhone:input.phone,totalStudentSupply:input.totalStudentSupply,responseRatePercent:0,historicalOfferRatePercent:0,historicalJoiningRatePercent:0,overallRating:0,specializations:[],batches:[]};
 case 'student':{
  const independent=input.registrationType==='independent';
  if(!independent&&(!institution||institution.id!==input.institutionId||institution.empanelmentStatus!=='empanelled'||typeof institution.name!=='string'||typeof institution.code!=='string'))throw new RegistrationConflict();
  return {id:uid,name:input.name,email,avatar:'',candidateType:independent?'independent_direct':'empanelled_campus',isEmpanelledCampus:!independent,institutionId:independent?'':input.institutionId,institutionName:independent?(input.customCollegeName?input.customCollegeName+' (Direct)':'Direct Independent Candidate'):institution!.name,institutionCode:independent?'DIRECT-IND':institution!.code,state:input.state,program:input.program,branch:input.branch,graduationYear:input.graduationYear,cgpa:input.cgpa,rollNumber:input.rollNumber,institutionVerificationStatus:independent?'not_applicable':'pending',platformVerificationStatus:'pending',placementStatus:'in_process',availability:'actively_seeking',skills:[],projects:[],internships:[],assessments:[],preferences:{targetRoles:[],preferredLocations:[],minSalaryLPA:input.minSalaryLPA,expectedSalaryMinLPA:input.minSalaryLPA,employmentTypes:['Full-Time']},globalDataPrivacy:{allowUnsolicitedPings:false,anonymizeProfileUntilConsent:true,shareVerifiedBadgesGlobally:false,autoDeclineBelowMinSalary:false}};
 }
 }
}
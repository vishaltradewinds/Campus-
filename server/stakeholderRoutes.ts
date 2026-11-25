import type {Express,RequestHandler} from 'express';
import type {VerifiedPrincipal as VerifiedIdentity} from './identityProvider';
import { WorkspaceDenied } from "./workspaceScope";
import { quoteHiringCampaign } from "../src/lib/commercial";
import { z } from "zod";
import { DatastoreUnavailable, readCareerEvidenceQueue, readEmployerAssessment, readStakeholderWorkspace, readStakeholderWorkspacePage, listRegistrationInstitutions, registerOwnStakeholder, readOwnAccount, checkTrustedRecruitmentRead, provisionCandidateProjection, executeRecruitmentTransition, executeTrustedProfileMutation, submitCareerEvidence, authorizeCommercialCampaign, type RecruitmentTransitionAction, type TrustedProfileMutationAction } from "./trustedBackend";
import { registrationSchema, RegistrationConflict } from "./registration";

/** One HTTP contract for the legacy and standalone acceptance entrypoints. Identity and rate limiting are injected at the trust boundary. */
export function mountStakeholderRoutes(app:Express,rateLimit:RequestHandler,verifyIdentity:RequestHandler,aiRateLimit:RequestHandler){
 app.get('/api/account/me',rateLimit,verifyIdentity,async (req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(Object.keys(req.query).length)return res.status(400).json({error:'Account scope is determined by authentication'});
  const identity=res.locals.identity as VerifiedIdentity;
  try{return res.json({account:await readOwnAccount(identity.uid)});}
  catch{return res.status(503).json({error:'Account service temporarily unavailable'});}
 });
 app.get('/api/account/registration-institutions',rateLimit,verifyIdentity,async (req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const keys=Object.keys(req.query);
  const page=req.query.page==='1',after=req.query.after;
  if(keys.length&&(!page||keys.some(k=>!['page','after'].includes(k))||(after!==undefined&&(typeof after!=='string'||after.length>200||after.includes('/')||after.includes(String.fromCharCode(0))||['.','..'].includes(after)))))return res.status(400).json({error:'Invalid directory page'});
  try{
   if(!page)return res.json({institutions:await listRegistrationInstitutions()});
   const records=await listRegistrationInstitutions(typeof after==='string'?after:'');
   const institutions=records.slice(0,100);
   return res.json({institutions,nextCursor:records.length>100?institutions[99].id:null});
  }
  catch{return res.status(503).json({error:'Institution directory temporarily unavailable'});}
 });
 app.get('/api/workspace',rateLimit,verifyIdentity,async (req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(Object.keys(req.query).length)return res.status(400).json({error:'Workspace scope is determined by authentication'});
  const identity=res.locals.identity as VerifiedIdentity;
  try{return res.json(await readStakeholderWorkspace(identity.uid,identity.adminClaim));}
  catch(error){if(error instanceof WorkspaceDenied)return res.status(403).json({error:'Workspace access denied'});return res.status(503).json({error:'Workspace temporarily unavailable or exceeds current bounded view'});}
 });
 app.get('/api/workspace/page',rateLimit,verifyIdentity,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const parsed=z.object({collection:z.enum(['employers','institutions','students','requirements','campaigns','calls','opportunities','users']),after:z.string().max(200).refine(s=>!s.includes('/')&&!s.includes(String.fromCharCode(0))&&!['.','..'].includes(s)).optional()}).strict().safeParse(req.query);
  if(!parsed.success)return res.status(400).json({error:'Invalid workspace page'});
  const identity=res.locals.identity as VerifiedIdentity;
  try{return res.json(await readStakeholderWorkspacePage(identity.uid,identity.adminClaim,parsed.data.collection,parsed.data.after??''));}
  catch(error){if(error instanceof WorkspaceDenied)return res.status(403).json({error:'Workspace page access denied'});return res.status(503).json({error:'Workspace page temporarily unavailable'});}
 });
 app.post('/api/account/register',rateLimit,verifyIdentity,async (req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const input=registrationSchema.safeParse(req.body);
  if(!input.success)return res.status(400).json({error:'Invalid registration details'});
  const identity=res.locals.identity as VerifiedIdentity;
  if(!identity.email)return res.status(403).json({error:'Authenticated email is required'});
  try{const result=await registerOwnStakeholder(identity.uid,identity.email,input.data);return res.status(result.replayed?200:201).json(result);}
  catch(error){if(error instanceof RegistrationConflict)return res.status(409).json({error:error.message});return res.status(503).json({error:'Registration temporarily unavailable. Retry with the same account.'});}
 });
 // Manual authenticated diagnostic only; not a hosting health check or keepalive.
 app.get('/api/recruitment/connectivity',rateLimit,verifyIdentity,async (_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const identity=res.locals.identity as VerifiedIdentity;
  const connected=await checkTrustedRecruitmentRead(identity.uid);
  return res.status(connected?200:503).json({status:connected?'connected':'unavailable',scope:'trusted_read_only',writeVerified:false});
 });
 // Merchant activation is a separate controlled release. Never create provider
// orders while reconciliation, pricing authority and idempotency are unapproved.
app.post("/api/commercial/razorpay/order", rateLimit, verifyIdentity, (_req,res) =>
 res.status(503).json({error:'Payment orders are on hold pending commercial approval',code:'COMMERCIAL_HOLD'}));
app.post("/api/commercial/campaign-quote", rateLimit, verifyIdentity, async (req,res)=>{
 res.setHeader("Cache-Control","no-store");
 const parsed=z.object({campaignId:z.string().min(1).max(200)}).strict().safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Only campaignId is required'});
 const identity=res.locals.identity as VerifiedIdentity;
 try{
  const scope=await authorizeCommercialCampaign(identity.uid,parsed.data.campaignId,res.locals.firebaseIdToken as string);
  const quote=quoteHiringCampaign({institutions:scope.institutions,vacancies:scope.vacancies,currency:'INR'});
  return res.json({scope,quote,paymentStatus:'COMMERCIAL_HOLD',quoteStatus:'INDICATIVE_NOT_PAYABLE'});
 }catch(error){
  const message=String(error);
  if(error instanceof DatastoreUnavailable)return res.status(503).json({error:'Datastore temporarily unavailable'});
  if(message.includes('not authorized')||message.includes('Only an employer'))return res.status(403).json({error:'Campaign access denied'});
  if(message.includes('not found'))return res.status(404).json({error:'Campaign not found'});
  if(message.includes('Invalid campaign')||message.includes('target institution'))return res.status(409).json({error:message});
  return res.status(500).json({error:'Campaign quote unavailable'});
 }
});
// Fail closed during commercial hold, even if a provider secret happens to be configured.
// Do not acknowledge an event as processed; any historical event requires reconciliation.
app.post("/api/commercial/razorpay/webhook", (_req,res) =>
 res.status(503).json({error:'Payment processing is on hold pending commercial approval',code:'COMMERCIAL_HOLD'}));

app.post("/api/candidate-projections", rateLimit, verifyIdentity, async (req, res) => { res.setHeader("Cache-Control","no-store"); const schema = z.object({ campaignId: z.string().min(1).max(200), studentId: z.string().min(1).max(200), requestId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/), view: z.literal(true).optional() }).strict(); const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "campaignId, studentId and a valid requestId are required" }); const identity = res.locals.identity as VerifiedIdentity; try { const result = await provisionCandidateProjection({ actorUid: identity.uid, firebaseIdToken: res.locals.firebaseIdToken as string, ...parsed.data, includeEmployerProfile: parsed.data.view === true }); return res.status(result.replayed ? 200 : 201).json({ success: true, ...result }); } catch (error) { const message = String(error); if (error instanceof WorkspaceDenied || message.includes("not authorized") || message.includes("consent is required") || message.includes("Only employers")) return res.status(403).json({ error: message }); if (message.includes("not found")) return res.status(404).json({ error: message }); if(error instanceof DatastoreUnavailable)return res.status(503).json({error:'Datastore temporarily unavailable. Retry using the same request ID.'}); console.error("Candidate projection provisioning failed", error); return res.status(500).json({ error: "Candidate projection could not be provisioned" }); } });
app.get('/api/assessment-evidence/:submissionId',rateLimit,verifyIdentity,async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(Object.keys(req.query).length||! /^[A-Za-z0-9._:-]{8,128}$/.test(req.params.submissionId))return res.status(400).json({error:'Invalid assessment reference'});
 try{return res.json(await readEmployerAssessment((res.locals.identity as VerifiedIdentity).uid,req.params.submissionId));}
 catch(error){if(error instanceof WorkspaceDenied)return res.status(403).json({error:'Current authorized sharing is required'});return res.status(503).json({error:'Assessment evidence temporarily unavailable'});}
});
app.get('/api/career-evidence',rateLimit,verifyIdentity,async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(Object.keys(req.query).length)return res.status(400).json({error:'Evidence scope is determined by authentication'});
 const identity=res.locals.identity as VerifiedIdentity;
 try{return res.json({evidence:await readCareerEvidenceQueue(identity.uid,identity.adminClaim)});}
 catch(error){if(error instanceof WorkspaceDenied)return res.status(403).json({error:'Evidence access denied'});return res.status(503).json({error:'Evidence records temporarily unavailable or exceed current bounded view'});}
});
app.post("/api/career-evidence", rateLimit, verifyIdentity, async (req, res) => {
 const schema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
  evidenceId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
  studentId: z.string().min(1),
  claimType: z.enum(['identity','institution','education','skill','project','internship','assessment','employment_outcome']),
  claimKey: z.string().min(1).max(200),
  claimValue: z.string().min(1).max(4000),
  sourceType: z.enum(['student_submission','institution','employer','assessment_provider','platform']),
  sourceId: z.string().max(200).optional(),
  evidenceUri: z.string().max(2000).optional(),
  expiresAt: z.string().max(100).optional()
 });
 const parsed=schema.safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Invalid Career Passport evidence submission"});
 const identity=res.locals.identity as VerifiedIdentity;
 try {
  const result=await submitCareerEvidence({actorUid:identity.uid,firebaseIdToken:res.locals.firebaseIdToken as string,...parsed.data});
  return res.status(result.replayed?200:201).json({success:true,...result});
 } catch(error) {
  const message=String(error);
  if(message.includes("Only the student")||message.includes("Unsupported evidence")||message.includes("not found"))return res.status(403).json({error:message});
  if(message.includes("Invalid")||message.includes("required"))return res.status(409).json({error:message});
  if(error instanceof DatastoreUnavailable)return res.status(503).json({error:'Datastore temporarily unavailable. Retry using the same request ID.'}); console.error("Career evidence submission failed",error); return res.status(500).json({error:"Career Passport evidence could not be submitted"});
} });
app.post("/api/recruitment/transitions", rateLimit, verifyIdentity, async (req, res) => { const schema = z.object({ action: z.enum(['CREATE_REQUIREMENT_CAMPAIGN','SEND_CALLS','RESPOND_CALL','ACTIVATE_STUDENTS','SUBMIT_CONSENT','UPDATE_CONSENT_SCOPE','GLOBAL_CONSENT','ADVANCE_CANDIDATE_STAGE']), requestId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/), payload: z.record(z.string(), z.any()) }); const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "action, requestId and payload are required" }); const identity = res.locals.identity as VerifiedIdentity; try { const result = await executeRecruitmentTransition({ actorUid: identity.uid, firebaseIdToken: res.locals.firebaseIdToken as string, action: parsed.data.action as RecruitmentTransitionAction, requestId: parsed.data.requestId, payload: parsed.data.payload }); return res.status(result.replayed ? 200 : 201).json({ success: true, ...result }); } catch (error) { const message = String(error); if (message.includes("not authorized") || message.includes("not authorized") || message.includes("not authorized") || message.includes("Role ") || message.includes("consent")) return res.status(403).json({ error: message }); if (message.includes("was not found") || message.includes("does not exist")) return res.status(404).json({ error: message }); if (message.includes("already") || message.includes("Invalid") || message.includes("required")) return res.status(409).json({ error: message }); if(error instanceof DatastoreUnavailable)return res.status(503).json({error:'Datastore temporarily unavailable. Retry using the same request ID.'}); console.error("Recruitment transition failed", error); return res.status(500).json({ error: "Recruitment transition could not be completed" }); } });
app.post("/api/profile/mutations", rateLimit, verifyIdentity, async (req, res) => {
 const schema = z.object({
  action: z.enum(['REQUEST_ACADEMIC_CORRECTION','REVIEW_ACADEMIC_CORRECTION','UPDATE_GLOBAL_PRIVACY','PUBLISH_INSTITUTION_AVAILABILITY','UPDATE_STUDENT_AVAILABILITY','ADD_VERIFIED_SKILL','UPDATE_EMPLOYER_VERIFICATION','UPDATE_INSTITUTION_EMPANELMENT','UPDATE_STUDENT_INSTITUTION_VERIFICATION','UPDATE_STUDENT_PLATFORM_VERIFICATION','REGISTER_INDEPENDENT_CANDIDATE','PROVISION_USER_ROLE','REVIEW_CAREER_EVIDENCE','DISPUTE_CAREER_EVIDENCE','RESOLVE_CAREER_EVIDENCE_DISPUTE']),
  requestId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
  payload: z.record(z.string(), z.any())
 });
 const parsed=schema.safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"action, requestId and payload are required"});
 const identity=res.locals.identity as VerifiedIdentity;
 try {
  const result=await executeTrustedProfileMutation({actorUid:identity.uid,adminClaim:identity.adminClaim,firebaseIdToken:res.locals.firebaseIdToken as string,action:parsed.data.action as TrustedProfileMutationAction,requestId:parsed.data.requestId,payload:parsed.data.payload});
  return res.status(result.replayed?200:201).json({success:true,...result});
 } catch(error) {
  const message=String(error);
  if(message.includes("authorization")||message.includes("authorized")||message.includes("Role ")||message.includes("Super admin"))return res.status(403).json({error:message});
  if(message.includes("not found"))return res.status(404).json({error:message});
  if(message.includes("already")||message.includes("Invalid")||message.includes("Required")||message.includes("required"))return res.status(409).json({error:message});
  if(error instanceof DatastoreUnavailable)return res.status(503).json({error:'Datastore temporarily unavailable. Retry using the same request ID.'}); console.error("Trusted profile mutation failed",error); return res.status(500).json({error:"Profile mutation could not be completed"});
} });

// Free-text demand parsing cannot safely establish that submitted content is
// nonpersonal or approved for provider processing. Preserve the manual workflow.
app.post("/api/gemini/parse-demand", rateLimit, verifyIdentity, (_req, res) =>
  res.status(503).json({ error: "AI demand parsing is on hold pending provider and privacy approval. Enter actual job criteria manually.", code: "AI_DEMAND_UNAVAILABLE" }));
// A Firebase identity alone does not establish campaign-specific consent or authority
// to disclose candidate data to a model. Do not read or transmit caller-supplied profiles.
app.post("/api/gemini/match-insights", rateLimit, aiRateLimit, verifyIdentity, (_req, res) =>
  res.status(503).json({ error: "AI match insights are on hold pending consent-bound evidence and provider approval. Review authorized job-related evidence manually.", code: "AI_MATCH_CONSENT_HOLD" }));

}

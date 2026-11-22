// Load local environment before imported backend modules capture their configuration.
import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { quoteHiringCampaign } from "./src/lib/commercial";
import { razorpayWebhookDigest, verifyRazorpayWebhookSignature } from "./src/lib/paymentSecurity";
import { z } from "zod";
import { DatastoreUnavailable, readOwnAccount, checkTrustedRecruitmentRead, provisionCandidateProjection, executeRecruitmentTransition, executeTrustedProfileMutation, submitCareerEvidence, authorizeCommercialCampaign, recordRazorpayWebhook, type RecruitmentTransitionAction, type TrustedProfileMutationAction } from "./server/trustedBackend";
import { applyBaselineSecurityHeaders } from "./server/securityHeaders";
import { lookupFirebaseIdentity } from './server/firebaseIdentity';
import { apiNotFound } from "./server/apiNotFound";
import { createInMemoryRateLimiter } from "./server/inMemoryRateLimiter";

const emulatorTest = process.env.NEXUSTALENT_EMULATOR_TEST === '1';
if (emulatorTest && (process.env.NODE_ENV === 'production' || process.env.FIREBASE_PROJECT_ID !== 'demo-nexustalent-acceptance' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')) throw new Error('Unsafe acceptance-test environment');
const app = express();
const PORT = Number(process.env.PORT || 3000);
// Render terminates external TLS at one ingress proxy. Override only after validating
// the actual proxy chain; do not derive this from an untrusted request header.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "1");
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) {
  throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 5");
}
app.set("trust proxy", trustProxyHops);
app.disable("x-powered-by");
app.use(applyBaselineSecurityHeaders);
app.use(express.json({ limit: "64kb", verify: (req, _res, buf) => { (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf); } }));
const rateWindowMs = 60_000;
// Multiple synthetic actors share one loopback IP during the expanded acceptance suite.
// Production remains at 20; emulatorTest has already been validated against the demo project and loopback-only hosts.
const rateLimitMax = emulatorTest ? 100 : 20;
const requestRateLimiter = createInMemoryRateLimiter({
  windowMs: rateWindowMs,
  maxRequests: rateLimitMax,
  maxBuckets: 10_000,
});
function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const decision = requestRateLimiter(`${req.ip}:${req.path}`);
  if (!decision.allowed) return res.status(429).json({ error: "Too many requests. Try again later." });
  return next();
}
interface VerifiedIdentity { uid: string; email?: string | null }
async function verifyFirebaseIdToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authorization=req.header("authorization");
  const token=authorization?.startsWith("Bearer ")?authorization.slice(7).trim():"";
  const apiKey=process.env.FIREBASE_WEB_API_KEY||process.env.VITE_FIREBASE_API_KEY||"";
  const result=await lookupFirebaseIdentity({token,apiKey,emulator:emulatorTest});
  if(result.status==='denied')return res.status(401).json({error:"Authentication required or invalid"});
  if(result.status!=='verified')return res.status(503).json({error:"Authentication service unavailable"});
  res.locals.identity=result.identity;
  res.locals.firebaseIdToken=token;
  return next();
}
const aiRequestRateLimiter = createInMemoryRateLimiter({
  windowMs: rateWindowMs,
  maxRequests: 5,
  maxBuckets: 10_000,
});
function aiRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const decision = aiRequestRateLimiter(`${req.ip}:ai`);
  if (!decision.allowed) return res.status(429).json({ error: "AI request limit reached. Try again later." });
  return next();
}
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
 app.get('/api/account/me',rateLimit,verifyFirebaseIdToken,async (req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(Object.keys(req.query).length)return res.status(400).json({error:'Account scope is determined by authentication'});
  const identity=res.locals.identity as VerifiedIdentity;
  try{return res.json({account:await readOwnAccount(identity.uid)});}
  catch{return res.status(503).json({error:'Account service temporarily unavailable'});}
 });
 // Manual authenticated diagnostic only; not a hosting health check or keepalive.
 app.get('/api/recruitment/connectivity',rateLimit,verifyFirebaseIdToken,async (_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const identity=res.locals.identity as VerifiedIdentity;
  const connected=await checkTrustedRecruitmentRead(identity.uid);
  return res.status(connected?200:503).json({status:connected?'connected':'unavailable',scope:'trusted_read_only',writeVerified:false});
 });
 // Merchant activation is a separate controlled release. Never create provider
// orders while reconciliation, pricing authority and idempotency are unapproved.
app.post("/api/commercial/razorpay/order", rateLimit, verifyFirebaseIdToken, (_req,res) =>
 res.status(503).json({error:'Payment orders are on hold pending commercial approval',code:'COMMERCIAL_HOLD'}));
app.post("/api/commercial/campaign-quote", rateLimit, verifyFirebaseIdToken, async (req,res)=>{
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
app.post("/api/commercial/razorpay/webhook", async (req, res) => {
 const secret=process.env.RAZORPAY_WEBHOOK_SECRET; if(!secret)return res.status(503).send("Webhook secret not configured");
 const raw=(req as express.Request & {rawBody?:Buffer}).rawBody || (Buffer.isBuffer(req.body)?req.body:Buffer.from(JSON.stringify(req.body||{})));
 const signature=req.header("x-razorpay-signature")||''; if(!verifyRazorpayWebhookSignature(raw,signature,secret))return res.status(401).send("Invalid signature");
 try{
  const body=JSON.parse(raw.toString('utf8')) as any; const eventId=req.header("x-razorpay-event-id")||razorpayWebhookDigest(raw,secret);
  const payment=body?.payload?.payment?.entity; const order=body?.payload?.order?.entity;
  await recordRazorpayWebhook({eventId,eventType:String(body?.event||'unknown'),orderId:order?.id||payment?.order_id,paymentId:payment?.id,status:payment?.status||body?.event||'received',amountMinor:Number(payment?.amount||order?.amount||0),currency:payment?.currency||order?.currency||'INR',invoiceId:order?.notes?.invoiceId||payment?.notes?.invoiceId});
  return res.status(200).json({received:true});
 }catch(error){console.error('Razorpay webhook processing failed',error);return res.status(500).json({error:"Webhook processing failed"});}
});

app.post("/api/candidate-projections", rateLimit, verifyFirebaseIdToken, async (req, res) => { const schema = z.object({ campaignId: z.string().min(1).max(200), studentId: z.string().min(1).max(200), requestId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/) }); const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "campaignId, studentId and a valid requestId are required" }); const identity = res.locals.identity as VerifiedIdentity; try { const result = await provisionCandidateProjection({ actorUid: identity.uid, firebaseIdToken: res.locals.firebaseIdToken as string, ...parsed.data }); return res.status(result.replayed ? 200 : 201).json({ success: true, ...result }); } catch (error) { const message = String(error); if (message.includes("not authorized") || message.includes("consent is required") || message.includes("Only employers")) return res.status(403).json({ error: message }); if (message.includes("not found")) return res.status(404).json({ error: message }); if(error instanceof DatastoreUnavailable)return res.status(503).json({error:'Datastore temporarily unavailable. Retry using the same request ID.'}); console.error("Candidate projection provisioning failed", error); return res.status(500).json({ error: "Candidate projection could not be provisioned" }); } });
app.post("/api/career-evidence", rateLimit, verifyFirebaseIdToken, async (req, res) => {
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
app.post("/api/recruitment/transitions", rateLimit, verifyFirebaseIdToken, async (req, res) => { const schema = z.object({ action: z.enum(['CREATE_REQUIREMENT_CAMPAIGN','SEND_CALLS','RESPOND_CALL','ACTIVATE_STUDENTS','SUBMIT_CONSENT','UPDATE_CONSENT_SCOPE','GLOBAL_CONSENT','ADVANCE_CANDIDATE_STAGE']), requestId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/), payload: z.record(z.string(), z.any()) }); const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "action, requestId and payload are required" }); const identity = res.locals.identity as VerifiedIdentity; try { const result = await executeRecruitmentTransition({ actorUid: identity.uid, firebaseIdToken: res.locals.firebaseIdToken as string, action: parsed.data.action as RecruitmentTransitionAction, requestId: parsed.data.requestId, payload: parsed.data.payload }); return res.status(result.replayed ? 200 : 201).json({ success: true, ...result }); } catch (error) { const message = String(error); if (message.includes("not authorized") || message.includes("not authorized") || message.includes("not authorized") || message.includes("Role ") || message.includes("consent")) return res.status(403).json({ error: message }); if (message.includes("was not found") || message.includes("does not exist")) return res.status(404).json({ error: message }); if (message.includes("already") || message.includes("Invalid") || message.includes("required")) return res.status(409).json({ error: message }); if(error instanceof DatastoreUnavailable)return res.status(503).json({error:'Datastore temporarily unavailable. Retry using the same request ID.'}); console.error("Recruitment transition failed", error); return res.status(500).json({ error: "Recruitment transition could not be completed" }); } });
app.post("/api/profile/mutations", rateLimit, verifyFirebaseIdToken, async (req, res) => {
 const schema = z.object({
  action: z.enum(['REQUEST_ACADEMIC_CORRECTION','REVIEW_ACADEMIC_CORRECTION','UPDATE_GLOBAL_PRIVACY','PUBLISH_INSTITUTION_AVAILABILITY','UPDATE_STUDENT_AVAILABILITY','ADD_VERIFIED_SKILL','UPDATE_EMPLOYER_VERIFICATION','UPDATE_INSTITUTION_EMPANELMENT','UPDATE_STUDENT_INSTITUTION_VERIFICATION','UPDATE_STUDENT_PLATFORM_VERIFICATION','REGISTER_INDEPENDENT_CANDIDATE','PROVISION_USER_ROLE','REVIEW_CAREER_EVIDENCE','DISPUTE_CAREER_EVIDENCE','RESOLVE_CAREER_EVIDENCE_DISPUTE']),
  requestId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
  payload: z.record(z.string(), z.any())
 });
 const parsed=schema.safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"action, requestId and payload are required"});
 const identity=res.locals.identity as VerifiedIdentity;
 try {
  const result=await executeTrustedProfileMutation({actorUid:identity.uid,firebaseIdToken:res.locals.firebaseIdToken as string,action:parsed.data.action as TrustedProfileMutationAction,requestId:parsed.data.requestId,payload:parsed.data.payload});
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
app.post("/api/gemini/parse-demand", rateLimit, verifyFirebaseIdToken, (_req, res) =>
  res.status(503).json({ error: "AI demand parsing is on hold pending provider and privacy approval. Enter actual job criteria manually.", code: "AI_DEMAND_UNAVAILABLE" }));
// A Firebase identity alone does not establish campaign-specific consent or authority
// to disclose candidate data to a model. Do not read or transmit caller-supplied profiles.
app.post("/api/gemini/match-insights", rateLimit, aiRateLimit, verifyFirebaseIdToken, (_req, res) =>
  res.status(503).json({ error: "AI match insights are on hold pending consent-bound evidence and provider approval. Review authorized job-related evidence manually.", code: "AI_MATCH_CONSENT_HOLD" }));
app.use("/api", apiNotFound);

async function startServer() { if (process.env.NODE_ENV !== "production") { const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" }); app.use(vite.middlewares); } else { const distPath = path.join(process.cwd(), "dist"); app.use(express.static(distPath)); app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html"))); } app.listen(PORT, emulatorTest ? "127.0.0.1" : "0.0.0.0", () => console.log(`Campus Talent Exchange OS server running on http://0.0.0.0:${PORT}`)); }
startServer();

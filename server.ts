// Load local environment before imported backend modules capture their configuration.
import "dotenv/config";
import {mountStakeholderRoutes} from "./server/stakeholderRoutes";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { applyBaselineSecurityHeaders } from "./server/securityHeaders";
import { createIdentityVerifier, type VerifiedPrincipal } from './server/identityProvider';
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
type VerifiedIdentity=VerifiedPrincipal;
const identityVerifier=createIdentityVerifier({provider:process.env.NEXUSTALENT_IDENTITY_PROVIDER,apiKey:process.env.FIREBASE_WEB_API_KEY||process.env.VITE_FIREBASE_API_KEY||'',emulator:emulatorTest});
async function verifyFirebaseIdToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authorization=req.header("authorization");
  const token=authorization?.startsWith("Bearer ")?authorization.slice(7).trim():"";
  const result=await identityVerifier(token);
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
mountStakeholderRoutes(app,rateLimit,verifyFirebaseIdToken,aiRateLimit);
app.use("/api", apiNotFound);

async function startServer() { if (process.env.NODE_ENV !== "production") { const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" }); app.use(vite.middlewares); } else { const distPath = path.join(process.cwd(), "dist"); app.use(express.static(distPath)); app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html"))); } app.listen(PORT, emulatorTest ? "127.0.0.1" : "0.0.0.0", () => console.log(`Campus Talent Exchange OS server running on http://0.0.0.0:${PORT}`)); }
startServer();

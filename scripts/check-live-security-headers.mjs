import { isValidHsts } from "./hsts-header-validator.mjs";

const target = process.env.TARGET_URL;

if (!target) {
  console.error("TARGET_URL is required.");
  process.exit(2);
}

let url;
try {
  url = new URL(target);
} catch {
  console.error("TARGET_URL must be an absolute URL.");
  process.exit(2);
}

const allowedHosts = new Set([
  "campus-coral-one.vercel.app",
  "campus-git-security-baseline-response-headers-rupay-kg.vercel.app",
  "campus-git-security-live-vercel-gate-clean-rupay-kg.vercel.app",
  "campus-git-security-vercel-edge-hsts-20261018-rupay-kg.vercel.app",
]);

if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.port ||
  !allowedHosts.has(url.hostname) ||
  url.search ||
  url.hash
) {
  console.error("TARGET_URL must be a credential-free HTTPS URL on an explicitly approved NexusTalent host, without a custom port, query, or fragment.");
  process.exit(2);
}

let response;
try {
  response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
    headers: { "user-agent": "NexusTalent-Live-Security-Gate/1.1" },
  });
} catch (error) {
  console.error(`Live endpoint request failed: ${error instanceof Error ? error.message : "unknown network error"}`);
  process.exit(1);
}

// Never follow redirects: a protected Vercel preview may redirect to an authentication
// page, and following it would test the login page rather than the deployed application.
if (response.status >= 300 && response.status < 400) {
  console.error(`Live endpoint redirected (HTTP ${response.status}); refusing to follow it. Verify the exact public application URL or use an authorized authenticated test.`);
  process.exit(1);
}

if (!response.ok) {
  console.error(`Live endpoint returned HTTP ${response.status}.`);
  process.exit(1);
}

const required = [
  ["x-content-type-options", value => value.toLowerCase() === "nosniff"],
  ["referrer-policy", value => value.toLowerCase() === "strict-origin-when-cross-origin"],
  ["x-frame-options", value => value.toLowerCase() === "deny"],
  ["strict-transport-security", isValidHsts],
];

let failed = false;
console.log(`Live endpoint: ${url.origin}`);
console.log(`HTTP status: ${response.status}`);

for (const [name, validate] of required) {
  const value = response.headers.get(name);
  const pass = value !== null && validate(value);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${value ? `: ${value}` : ": missing"}`);
  if (!pass) failed = true;
}

if (failed) {
  console.error("Live Vercel security-header gate failed. Do not certify or promote this deployment.");
  process.exit(1);
}

console.log("Live Vercel security-header gate passed.");

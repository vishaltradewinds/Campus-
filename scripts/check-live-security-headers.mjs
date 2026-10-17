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

if (url.protocol !== "https:" || url.username || url.password) {
  console.error("TARGET_URL must use HTTPS and must not contain credentials.");
  process.exit(2);
}

const response = await fetch(url, {
  method: "GET",
  redirect: "follow",
  signal: AbortSignal.timeout(20000),
  headers: { "user-agent": "NexusTalent-Live-Security-Gate/1.0" },
});

const finalUrl = new URL(response.url);
if (finalUrl.hostname !== url.hostname) {
  console.error(`Refusing redirected response from a different host: ${finalUrl.hostname}`);
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
  ["strict-transport-security", value => /(?:^|;)\\s*max-age=(\\d+)/i.test(value) && Number(value.match(/(?:^|;)\\s*max-age=(\\d+)/i)?.[1]) >= 31536000],
];

let failed = false;
console.log(`Live endpoint: ${url.origin}`);
console.log(`Final URL: ${response.url}`);
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

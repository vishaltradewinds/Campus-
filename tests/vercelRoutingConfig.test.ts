import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel API rewrite is restricted to the approved production alias", () => {
  const config = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  ) as {
    rewrites?: Array<{
      source?: string;
      has?: Array<{ type?: string; value?: string }>;
      destination?: string;
    }>;
  };

  assert.equal(config.rewrites?.length, 1, "only the intended API rewrite is expected");
  assert.deepEqual(config.rewrites?.[0], {
    source: "/api/:path*",
    has: [{ type: "host", value: "campus-coral-one.vercel.app" }],
    destination: "https://nexustalent-zero-cost-v2.onrender.com/api/:path*",
  });
});

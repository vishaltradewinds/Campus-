import test from "node:test";
import assert from "node:assert/strict";
import { parseMatchInsightsJson } from "../src/lib/matchInsights";

test("match insights parser accepts a valid, bounded decision-support response", () => {
  const result = parseMatchInsightsJson(JSON.stringify({
    score: 78,
    topMatchingStrengths: ["Required skill evidence"],
    areasForRampUp: ["Role-specific training"],
    recommendation: "Discuss the evidence with a human reviewer before any decision.",
  }));
  assert.ok(result);
  assert.equal(result.score, 78);
});

test("match insights parser rejects malformed provider JSON", () => {
  assert.equal(parseMatchInsightsJson("{not-json"), null);
});

test("match insights parser rejects out-of-range scores and missing fields", () => {
  assert.equal(parseMatchInsightsJson(JSON.stringify({ score: 101, topMatchingStrengths: [], areasForRampUp: [], recommendation: "Review" })), null);
  assert.equal(parseMatchInsightsJson(JSON.stringify({ score: 55 })), null);
});

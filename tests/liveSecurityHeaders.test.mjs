import test from "node:test";
import assert from "node:assert/strict";
import { isValidHsts } from "../scripts/hsts-header-validator.mjs";

test("accepts the exact minimum HSTS max-age", () => {
  assert.equal(isValidHsts("max-age=31536000"), true);
});

test("accepts a higher max-age and additional directives", () => {
  assert.equal(isValidHsts("max-age=63072000; includeSubDomains; preload"), true);
  assert.equal(isValidHsts("includeSubDomains; max-age=31536000; preload"), true);
});

test("rejects a max-age below the required minimum", () => {
  assert.equal(isValidHsts("max-age=31535999"), false);
});

test("rejects missing or malformed max-age values", () => {
  assert.equal(isValidHsts("includeSubDomains; preload"), false);
  assert.equal(isValidHsts("max-age=abc"), false);
  assert.equal(isValidHsts("max-age=31536000junk"), false);
  assert.equal(isValidHsts(null), false);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Request, Response } from "express";
import { apiNotFound } from "../server/apiFallback";

test("unmatched API requests return JSON 404", () => {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  apiNotFound({} as Request, response as unknown as Response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: "API route not found" });
});

test("API fallback is registered after API routes and before SPA fallback", () => {
  const source = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
  const lastApiRoute = source.lastIndexOf('app.post("/api/gemini/match-insights"');
  const apiFallback = source.indexOf('app.use("/api", apiNotFound);');
  const serverStart = source.indexOf("async function startServer()");

  assert.ok(lastApiRoute >= 0, "expected final API route declaration");
  assert.ok(apiFallback > lastApiRoute, "fallback must not shadow known API routes");
  assert.ok(serverStart > apiFallback, "fallback must run before Vite/SPA fallback");
});

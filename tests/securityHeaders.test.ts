import test from "node:test";
import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";
import { applyBaselineSecurityHeaders } from "../server/securityHeaders";

function invokeMiddleware(options: { secure?: boolean; forwardedProto?: string } = {}) {
  const headers: Record<string, string> = {};
  let nextCalled = false;
  const req = {
    secure: options.secure ?? false,
    get: (name: string) => name.toLowerCase() === "x-forwarded-proto" ? options.forwardedProto : undefined,
  } as unknown as Request;
  const res = {
    setHeader: (name: string, value: string) => { headers[name] = value; },
  } as unknown as Response;
  applyBaselineSecurityHeaders(req, res, (() => { nextCalled = true; }) as NextFunction);
  return { headers, nextCalled };
}

test("baseline browser security headers are applied and middleware continues", () => {
  const { headers, nextCalled } = invokeMiddleware();
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Strict-Transport-Security"], undefined);
  assert.equal(nextCalled, true);
});

test("HSTS is added when the request is HTTPS behind the hosting proxy", () => {
  const { headers } = invokeMiddleware({ forwardedProto: "https, http" });
  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000");
});

test("HSTS is added for a directly secure request", () => {
  const { headers } = invokeMiddleware({ secure: true });
  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000");
});

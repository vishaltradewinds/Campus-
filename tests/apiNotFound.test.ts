import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { apiNotFound } from "../server/apiNotFound";

test("known API routes stay reachable and unknown API routes return JSON 404 before SPA fallback", async () => {
  const app = express();
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", apiNotFound);
  app.get("*", (_req, res) => res.type("html").send("<main>SPA</main>"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const missingApi = await fetch(`${base}/api/does-not-exist`);
    assert.equal(missingApi.status, 404);
    assert.match(missingApi.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await missingApi.json(), { error: "API endpoint not found" });

    const clientRoute = await fetch(`${base}/institutions/demo`);
    assert.equal(clientRoute.status, 200);
    assert.match(clientRoute.headers.get("content-type") ?? "", /text\/html/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      if (!server.listening) return resolve();
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

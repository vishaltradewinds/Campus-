import type { RequestHandler } from "express";

/** Return a stable JSON 404 for unknown API paths before the SPA fallback. */
export const apiNotFound: RequestHandler = (_req, res) =>
  res.status(404).json({ error: "API endpoint not found" });

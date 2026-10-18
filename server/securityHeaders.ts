import type { NextFunction, Request, Response } from "express";

/**
 * Baseline response headers for browser-facing routes.
 * Keep CSP separate until runtime origins are inventoried and browser-tested.
 */
export function applyBaselineSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");

  // Respect the HTTPS scheme reported by the hosting reverse proxy without
  // forcing HTTPS for local development.
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (req.secure || forwardedProto === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
}

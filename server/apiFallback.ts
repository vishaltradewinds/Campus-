import type { Request, Response } from "express";

export function apiNotFound(_req: Request, res: Response): Response {
  return res.status(404).json({ error: "API route not found" });
}

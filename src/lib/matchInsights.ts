import { z } from "zod";

export const matchInsightsSchema = z.object({
  score: z.number().min(0).max(100),
  topMatchingStrengths: z.array(z.string()),
  areasForRampUp: z.array(z.string()),
  recommendation: z.string(),
});

/** Parse provider output without allowing malformed or out-of-range AI data through. */
export function parseMatchInsightsJson(text: string) {
  try {
    return matchInsightsSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

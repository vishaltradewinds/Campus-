# AI Hiring Decision-Support Policy

NexusTalent AI features are decision-support tools only.

1. AI scores and recommendations are advisory and cannot be the sole basis for hiring, rejection, compensation, or other employment decisions.
2. Inputs must be limited to job-relevant information that the candidate has authorized for the relevant recruitment campaign.
3. Do not infer or use protected or sensitive personal characteristics.
4. Human reviewers remain accountable for recruitment decisions and must be able to inspect the underlying evidence.
5. AI failures, unavailable models, malformed responses, and fallback states must never be represented as positive candidate evidence.
6. Production deployments should retain sufficient audit information to reconstruct how AI-assisted recommendations were generated, subject to applicable privacy and retention requirements.

## Controlled activation boundary

The demand endpoint is held (503, AI_DEMAND_UNAVAILABLE) for every authenticated caller. The free-text Gemini/Ollama forwarding path has been removed from the active server and the demand form now offers manual input only. Zero-cost acknowledgement and authentication alone are not provider or privacy approval. Reopening requires a documented approved processing boundary, verified employer authority, job-only minimization and human review. Do not submit candidate or sensitive personal data in job requirements.

The candidate match-insights API is intentionally on HOLD (503), including for authenticated users: accepting arbitrary profile JSON is not evidence of employer-specific permission. Reactivation requires trusted campaign and invitation binding, current scoped consent, job-related minimization, approved provider/data processing, auditability and independent privacy review. Manual authorized candidate review remains available. No provider, cloud identity or production settings are changed by this hold. The npm manifest and canonical npm lockfile exclude the unused external model SDK; no AI provider configuration is part of the supported deployment example.

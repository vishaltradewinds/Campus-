-- Defense in depth: one currently PUBLISHED consent policy per purpose in each tenant schema.
-- The administrative transaction retires the previous policy before publishing the next one.
CREATE UNIQUE INDEX "application_consent_policies_one_published_per_purpose_key"
  ON "application_consent_policies" ("purpose")
  WHERE "status" = 'PUBLISHED';

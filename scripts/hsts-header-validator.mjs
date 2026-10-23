export function isValidHsts(value) {
  if (typeof value !== "string") return false;

  const directives = value
    .split(";")
    .map(directive => directive.trim())
    .filter(Boolean);
  const maxAgeDirectives = directives.filter(directive => /^max-age\s*=/i.test(directive));

  // Duplicate max-age directives are ambiguous: browsers may honor a different
  // occurrence than the one that satisfies the minimum-duration check.
  if (maxAgeDirectives.length !== 1) return false;

  const match = maxAgeDirectives[0].match(/^max-age\s*=\s*(\d+)$/i);
  return match !== null && Number(match[1]) >= 31536000;
}

export function isValidHsts(value) {
  if (typeof value !== "string") return false;
  const match = value.match(/(?:^|;)\s*max-age=(\d+)\s*(?:;|$)/i);
  return match !== null && Number(match[1]) >= 31536000;
}

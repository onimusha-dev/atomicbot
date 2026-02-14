/** Parse a comma/newline/semicolon-separated string into a deduplicated list. */
export function parseList(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/g)
    .map((v) => v.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const next: string[] = [];
  for (const entry of parts) {
    const key = entry.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(entry);
  }
  return next;
}

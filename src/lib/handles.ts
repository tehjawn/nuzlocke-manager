/** Sanitize and uniqueness helpers for trainer nicknames (handles). */

export function sanitizeHandle(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 24);
  return cleaned || "Trainer";
}

export async function allocateUniqueHandle(
  challengeId: string,
  preferred: string,
  findTaken: (handle: string) => Promise<boolean>,
): Promise<string> {
  const base = sanitizeHandle(preferred);
  if (!(await findTaken(base))) return base;

  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 20)} ${i}`;
    if (!(await findTaken(candidate))) return candidate;
  }

  return `${base.slice(0, 16)}-${Date.now().toString(36).slice(-4)}`;
}

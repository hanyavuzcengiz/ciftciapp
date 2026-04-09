export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const decoded = Number(Buffer.from(cursor, "base64").toString("utf8"));
    return Number.isFinite(decoded) ? decoded : 0;
  } catch {
    return 0;
  }
}

export function encodeCursor(index: number): string {
  return Buffer.from(String(index), "utf8").toString("base64");
}

export function sameParticipantSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

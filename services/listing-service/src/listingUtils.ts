export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const decoded = Number(Buffer.from(cursor, "base64").toString("utf8"));
    return Number.isFinite(decoded) ? decoded : 0;
  } catch {
    return 0;
  }
}

export function encodeCursor(value: number): string {
  return Buffer.from(String(value), "utf8").toString("base64");
}

export function isPubliclyVisible(status: string): boolean {
  return status !== "draft" && status !== "banned";
}

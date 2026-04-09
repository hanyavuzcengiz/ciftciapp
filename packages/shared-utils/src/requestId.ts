/** HTTP x-request-id (Edge, RN Hermes, Node 18+ crypto.randomUUID) */
export function newRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function ensureRequestIdHeader(headers: Record<string, string>): void {
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === "x-request-id" && headers[k]?.trim()) return;
  }
  headers["x-request-id"] = newRequestId();
}

const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9._:-]+$/;

export type IdempotencyKeyValidationResult =
  | { ok: true; key: string | null }
  | { ok: false; message: string };

export function parseIdempotencyKeyHeader(
  headerValue: string | undefined,
  maxLength: number
): IdempotencyKeyValidationResult {
  const raw = String(headerValue ?? "").trim();
  if (!raw) return { ok: true, key: null };
  if (raw.length > maxLength) {
    return { ok: false, message: `x-idempotency-key exceeds max length (${maxLength})` };
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(raw)) {
    return { ok: false, message: "x-idempotency-key has invalid characters" };
  }
  return { ok: true, key: raw };
}

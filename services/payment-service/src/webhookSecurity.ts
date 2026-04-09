import crypto from "node:crypto";

export function resolveWebhookSecret(nodeEnv: string | undefined, rawSecret: string | undefined): string {
  const secret = rawSecret?.trim();
  const isProd = nodeEnv === "production";
  if (isProd) {
    if (!secret || secret === "dev-secret") {
      throw new Error("[payment-service] Production mode requires secure REQUEST_SIGNING_SECRET");
    }
    return secret;
  }
  return secret || "dev-secret";
}

export function buildSignedPayload(timestamp: string, body: unknown): string {
  return `${timestamp}.${JSON.stringify(body ?? {})}`;
}

export function computeWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function isWebhookTimestampFresh(
  timestampHeader: string,
  nowMs: number,
  toleranceSeconds: number
): boolean {
  const raw = Number(timestampHeader.trim());
  if (!Number.isFinite(raw) || raw <= 0) return false;
  // Accept both unix seconds and unix milliseconds.
  const tsMs = raw > 1e12 ? raw : raw * 1000;
  const skew = Math.abs(nowMs - tsMs);
  return skew <= toleranceSeconds * 1000;
}

export function verifyWebhookSignature(
  signatureHeader: string,
  timestampHeader: string,
  body: unknown,
  secret: string
): boolean {
  const expected = computeWebhookSignature(buildSignedPayload(timestampHeader, body), secret);
  const actual = signatureHeader.trim();
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

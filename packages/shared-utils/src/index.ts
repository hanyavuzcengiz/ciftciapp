export { ensureRequestIdHeader, newRequestId } from "./requestId";

export function maskPhone(phone: string): string {
  const p = phone.trim();
  if (p.length < 4) return p;
  return `${p.slice(0, 3)}** *** ** ${p.slice(-2)}`;
}

export function calculateTrustScore(input: {
  verificationLevel: number;
  avgRating: number;
  completionRate: number;
  responseRate: number;
  accountAgeMonths: number;
}): number {
  const score =
    input.verificationLevel * 0.3 +
    input.avgRating * 0.25 +
    input.completionRate * 0.2 +
    input.responseRate * 0.15 +
    input.accountAgeMonths * 0.1;
  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}

import type { PaymentProvider, PaymentStatus } from "./pspAdapter";

export type ReconciliationLocalRecord = {
  intentId: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  status: PaymentStatus;
};

export type ReconciliationProviderRecord = {
  provider: PaymentProvider;
  paymentId: string;
  status: PaymentStatus;
};

export type ReconciliationMismatch = {
  provider: PaymentProvider;
  paymentId: string;
  localIntentId: string | null;
  localStatus: PaymentStatus | null;
  providerStatus: PaymentStatus;
  reason: "missing_local_intent" | "status_mismatch";
};

export type ReconciliationReport = {
  comparedCount: number;
  mismatchCount: number;
  mismatchRatio: number;
  mismatches: ReconciliationMismatch[];
};

export type ReconciliationAlertEvent = {
  ts: string;
  svc: "payment-service";
  level: "error";
  event: "reconciliation_mismatch_alert";
  comparedCount: number;
  mismatchCount: number;
  mismatchRatio: number;
  alertRatioThreshold: number;
};

export function buildReconciliationReport(
  locals: ReconciliationLocalRecord[],
  providers: ReconciliationProviderRecord[]
): ReconciliationReport {
  const localByProviderPaymentId = new Map<string, ReconciliationLocalRecord>();
  for (const local of locals) {
    localByProviderPaymentId.set(`${local.provider}:${local.providerPaymentId}`, local);
  }

  const mismatches: ReconciliationMismatch[] = [];
  for (const providerRec of providers) {
    const key = `${providerRec.provider}:${providerRec.paymentId}`;
    const local = localByProviderPaymentId.get(key);
    if (!local) {
      mismatches.push({
        provider: providerRec.provider,
        paymentId: providerRec.paymentId,
        localIntentId: null,
        localStatus: null,
        providerStatus: providerRec.status,
        reason: "missing_local_intent"
      });
      continue;
    }
    if (local.status !== providerRec.status) {
      mismatches.push({
        provider: providerRec.provider,
        paymentId: providerRec.paymentId,
        localIntentId: local.intentId,
        localStatus: local.status,
        providerStatus: providerRec.status,
        reason: "status_mismatch"
      });
    }
  }

  const comparedCount = providers.length;
  const mismatchCount = mismatches.length;
  const mismatchRatio = comparedCount > 0 ? mismatchCount / comparedCount : 0;
  return { comparedCount, mismatchCount, mismatchRatio, mismatches };
}

export function shouldRaiseReconciliationAlert(report: ReconciliationReport, threshold: number): boolean {
  return report.comparedCount > 0 && report.mismatchRatio >= threshold;
}

export function buildReconciliationAlertEvent(
  report: ReconciliationReport,
  threshold: number
): ReconciliationAlertEvent {
  return {
    ts: new Date().toISOString(),
    svc: "payment-service",
    level: "error",
    event: "reconciliation_mismatch_alert",
    comparedCount: report.comparedCount,
    mismatchCount: report.mismatchCount,
    mismatchRatio: report.mismatchRatio,
    alertRatioThreshold: threshold
  };
}

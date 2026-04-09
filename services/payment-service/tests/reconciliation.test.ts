import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReconciliationAlertEvent,
  buildReconciliationReport,
  shouldRaiseReconciliationAlert
} from "../src/reconciliation";

test("reconciliation report has no mismatches when statuses match", () => {
  const report = buildReconciliationReport(
    [
      { intentId: "pay_1", provider: "iyzico", providerPaymentId: "pi_1", status: "paid" },
      { intentId: "pay_2", provider: "stripe", providerPaymentId: "ch_2", status: "pending" }
    ],
    [
      { provider: "iyzico", paymentId: "pi_1", status: "paid" },
      { provider: "stripe", paymentId: "ch_2", status: "pending" }
    ]
  );

  assert.equal(report.comparedCount, 2);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.mismatchRatio, 0);
});

test("reconciliation report flags status mismatch", () => {
  const report = buildReconciliationReport(
    [{ intentId: "pay_1", provider: "iyzico", providerPaymentId: "pi_1", status: "pending" }],
    [{ provider: "iyzico", paymentId: "pi_1", status: "paid" }]
  );

  assert.equal(report.mismatchCount, 1);
  assert.equal(report.mismatches[0]?.reason, "status_mismatch");
  assert.equal(report.mismatches[0]?.localIntentId, "pay_1");
});

test("reconciliation report flags missing local payment", () => {
  const report = buildReconciliationReport([], [{ provider: "stripe", paymentId: "ch_404", status: "failed" }]);

  assert.equal(report.mismatchCount, 1);
  assert.equal(report.mismatches[0]?.reason, "missing_local_intent");
  assert.equal(report.mismatches[0]?.localIntentId, null);
});

test("reconciliation alert threshold decision works", () => {
  const report = buildReconciliationReport(
    [{ intentId: "pay_1", provider: "iyzico", providerPaymentId: "pi_1", status: "pending" }],
    [{ provider: "iyzico", paymentId: "pi_1", status: "paid" }]
  );
  assert.equal(shouldRaiseReconciliationAlert(report, 0.5), true);
  assert.equal(shouldRaiseReconciliationAlert(report, 1), true);
});

test("reconciliation alert event includes threshold", () => {
  const report = buildReconciliationReport(
    [{ intentId: "pay_1", provider: "iyzico", providerPaymentId: "pi_1", status: "pending" }],
    [{ provider: "iyzico", paymentId: "pi_1", status: "paid" }]
  );
  const event = buildReconciliationAlertEvent(report, 0.2);
  assert.equal(event.event, "reconciliation_mismatch_alert");
  assert.equal(event.alertRatioThreshold, 0.2);
  assert.equal(event.mismatchCount, 1);
});

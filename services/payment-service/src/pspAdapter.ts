export type PaymentProvider = "iyzico" | "stripe";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type CreateIntentInput = {
  orderId: string;
  userId: string;
  provider: PaymentProvider;
  amount: number;
};

export type ProviderWebhookEvent = {
  paymentId: string;
  status: PaymentStatus;
  rawEventName: string;
};

export interface PaymentProviderAdapter {
  createIntent(input: CreateIntentInput): Promise<{ providerPaymentId: string }>;
  confirm(provider: PaymentProvider, providerPaymentId: string): Promise<{ status: PaymentStatus }>;
  refund(provider: PaymentProvider, providerPaymentId: string): Promise<{ status: PaymentStatus }>;
  mapWebhookEvent(provider: PaymentProvider, payload: unknown): ProviderWebhookEvent | null;
}

function mapCanonicalEvent(name: string): PaymentStatus | null {
  if (name === "payment.paid" || name === "charge.succeeded") return "paid";
  if (name === "payment.failed" || name === "charge.failed") return "failed";
  if (name === "payment.refunded" || name === "charge.refunded") return "refunded";
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export class MockPaymentProviderAdapter implements PaymentProviderAdapter {
  async createIntent(input: CreateIntentInput): Promise<{ providerPaymentId: string }> {
    return { providerPaymentId: `${input.provider}_pi_${Math.random().toString(36).slice(2, 10)}` };
  }

  async confirm(_provider: PaymentProvider, _providerPaymentId: string): Promise<{ status: PaymentStatus }> {
    return { status: "paid" };
  }

  async refund(_provider: PaymentProvider, _providerPaymentId: string): Promise<{ status: PaymentStatus }> {
    return { status: "refunded" };
  }

  mapWebhookEvent(provider: PaymentProvider, payload: unknown): ProviderWebhookEvent | null {
    const obj = asRecord(payload);
    if (!obj) return null;

    if (provider === "iyzico") {
      const eventName = typeof obj.event === "string" ? obj.event : "";
      const paymentId = typeof obj.payment_id === "string" ? obj.payment_id : "";
      const mapped = mapCanonicalEvent(eventName);
      if (!paymentId || !mapped) return null;
      return { paymentId, status: mapped, rawEventName: eventName };
    }

    if (provider === "stripe") {
      const eventName = typeof obj.type === "string" ? obj.type : "";
      const dataObj = asRecord(obj.data);
      const objectObj = dataObj ? asRecord(dataObj.object) : null;
      const paymentId = objectObj && typeof objectObj.id === "string" ? objectObj.id : "";
      const mapped = mapCanonicalEvent(eventName);
      if (!paymentId || !mapped) return null;
      return { paymentId, status: mapped, rawEventName: eventName };
    }

    return null;
  }
}

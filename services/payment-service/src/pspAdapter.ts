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

type ProviderHttpConfig = {
  baseUrl: string;
  apiKey: string;
};

export type PaymentAdapterConfig = {
  iyzico?: ProviderHttpConfig;
  stripe?: ProviderHttpConfig;
  requestTimeoutMs: number;
};

function mapCanonicalEvent(name: string): PaymentStatus | null {
  if (name === "payment.paid" || name === "charge.succeeded") return "paid";
  if (name === "payment.failed" || name === "charge.failed") return "failed";
  if (name === "payment.refunded" || name === "charge.refunded") return "refunded";
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function asStatus(value: unknown): PaymentStatus | null {
  return value === "pending" || value === "paid" || value === "failed" || value === "refunded" ? value : null;
}

function readString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  return typeof value === "string" ? value : "";
}

function readNestedString(obj: Record<string, unknown>, path: string[]): string {
  let cursor: unknown = obj;
  for (const key of path) {
    const asObj = asRecord(cursor);
    if (!asObj) return "";
    cursor = asObj[key];
  }
  return typeof cursor === "string" ? cursor : "";
}

const IYZICO_STATUS_MAP: Record<string, PaymentStatus> = {
  success: "paid",
  failure: "failed",
  pending: "pending",
  refunded: "refunded"
};

const STRIPE_STATUS_MAP: Record<string, PaymentStatus> = {
  succeeded: "paid",
  failed: "failed",
  pending: "pending",
  canceled: "failed",
  refunded: "refunded"
};

export function parseProviderIntentId(provider: PaymentProvider, body: Record<string, unknown>): string {
  if (provider === "iyzico") {
    return (
      readString(body, "provider_payment_id") ||
      readString(body, "paymentId") ||
      readString(body, "payment_id")
    );
  }

  return (
    readString(body, "provider_payment_id") ||
    readString(body, "id") ||
    readNestedString(body, ["payment_intent", "id"])
  );
}

export function parseProviderStatus(provider: PaymentProvider, body: Record<string, unknown>): PaymentStatus | null {
  const direct = asStatus(body.status);
  if (direct) return direct;

  if (provider === "iyzico") {
    const raw = (readString(body, "paymentStatus") || readString(body, "status")).toLowerCase();
    return IYZICO_STATUS_MAP[raw] ?? null;
  }

  const raw =
    (readString(body, "payment_status") || readString(body, "status") || readNestedString(body, ["charge", "status"]))
      .toLowerCase();
  return STRIPE_STATUS_MAP[raw] ?? null;
}

async function parseResponseBody(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json()) as unknown;
  const obj = asRecord(body);
  if (!obj) throw new Error("Unexpected provider response body");
  return obj;
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

export class HttpPaymentProviderAdapter implements PaymentProviderAdapter {
  constructor(private readonly cfg: PaymentAdapterConfig) {}

  private providerConfig(provider: PaymentProvider): ProviderHttpConfig {
    const selected = provider === "iyzico" ? this.cfg.iyzico : this.cfg.stripe;
    if (!selected) {
      throw new Error(`Provider config missing for ${provider}`);
    }
    return selected;
  }

  private async post(provider: PaymentProvider, path: string, payload: unknown): Promise<Record<string, unknown>> {
    const cfg = this.providerConfig(provider);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.requestTimeoutMs);
    try {
      const res = await fetch(`${cfg.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!res.ok) {
        throw new Error(`Provider ${provider} request failed with status ${res.status}`);
      }
      return await parseResponseBody(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  async createIntent(input: CreateIntentInput): Promise<{ providerPaymentId: string }> {
    const body = await this.post(input.provider, "/payments/intent", {
      order_id: input.orderId,
      user_id: input.userId,
      amount: input.amount
    });
    const providerPaymentId = parseProviderIntentId(input.provider, body);
    if (!providerPaymentId) throw new Error(`Provider ${input.provider} did not return provider_payment_id`);
    return { providerPaymentId };
  }

  async confirm(provider: PaymentProvider, providerPaymentId: string): Promise<{ status: PaymentStatus }> {
    const body = await this.post(provider, `/payments/${providerPaymentId}/confirm`, {});
    const status = parseProviderStatus(provider, body);
    if (!status) throw new Error(`Provider ${provider} did not return valid status on confirm`);
    return { status };
  }

  async refund(provider: PaymentProvider, providerPaymentId: string): Promise<{ status: PaymentStatus }> {
    const body = await this.post(provider, `/payments/${providerPaymentId}/refund`, {});
    const status = parseProviderStatus(provider, body);
    if (!status) throw new Error(`Provider ${provider} did not return valid status on refund`);
    return { status };
  }

  mapWebhookEvent(provider: PaymentProvider, payload: unknown): ProviderWebhookEvent | null {
    return new MockPaymentProviderAdapter().mapWebhookEvent(provider, payload);
  }
}

export function resolvePaymentAdapterConfig(env: NodeJS.ProcessEnv): PaymentAdapterConfig {
  const timeout = Math.max(1_000, Number(env.PAYMENT_PSP_TIMEOUT_MS ?? 8_000) || 8_000);
  const iyzicoBaseUrl = String(env.PAYMENT_IYZICO_BASE_URL ?? "").trim();
  const iyzicoApiKey = String(env.PAYMENT_IYZICO_API_KEY ?? "").trim();
  const stripeBaseUrl = String(env.PAYMENT_STRIPE_BASE_URL ?? "").trim();
  const stripeApiKey = String(env.PAYMENT_STRIPE_API_KEY ?? "").trim();

  return {
    requestTimeoutMs: timeout,
    iyzico:
      iyzicoBaseUrl && iyzicoApiKey
        ? { baseUrl: normalizeBaseUrl(iyzicoBaseUrl), apiKey: iyzicoApiKey }
        : undefined,
    stripe:
      stripeBaseUrl && stripeApiKey
        ? { baseUrl: normalizeBaseUrl(stripeBaseUrl), apiKey: stripeApiKey }
        : undefined
  };
}

export function createPaymentProviderAdapter(env: NodeJS.ProcessEnv): PaymentProviderAdapter {
  const providerMode = String(env.PAYMENT_PROVIDER_MODE ?? "mock").trim().toLowerCase();
  if (providerMode !== "live") {
    return new MockPaymentProviderAdapter();
  }
  const cfg = resolvePaymentAdapterConfig(env);
  return new HttpPaymentProviderAdapter(cfg);
}

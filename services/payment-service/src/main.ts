import crypto from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { parseIdempotencyKeyHeader } from "./idempotencyKey";
import { InMemoryIdempotencyReplayStore, InMemoryIdempotencyStore } from "./idempotencyStore";
import { createPaymentProviderAdapter, type PaymentStatus } from "./pspAdapter";
import { validatePaymentRuntime } from "./runtimeConfig";
import { isWebhookTimestampFresh, resolveWebhookSecret, verifyWebhookSignature } from "./webhookSecurity";

type PaymentIntent = {
  id: string;
  providerPaymentId: string;
  orderId: string;
  userId: string;
  provider: "iyzico" | "stripe";
  amount: number;
  status: PaymentStatus;
  createdAt: string;
};

type HttpRequestWithId = Request & { serviceRequestId: string };

const app = express();
app.use(helmet());
app.use(cors({ origin: ["exp://localhost:8081"] }));
app.use(express.json({ limit: "1mb" }));

function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id")?.trim();
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  (req as HttpRequestWithId).serviceRequestId = id;
  res.setHeader("x-request-id", id);
  next();
}

function structuredAccessLog(req: Request, res: Response, next: NextFunction): void {
  if (String(process.env.PAYMENT_SERVICE_STRUCTURED_ACCESS_LOG ?? "").trim() !== "1") {
    next();
    return;
  }
  const requestId = (req as HttpRequestWithId).serviceRequestId;
  const pathOnly = req.originalUrl.split("?")[0];
  const t0 = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        svc: "payment-service",
        level: "info",
        event: "http_access",
        requestId,
        method: req.method,
        path: pathOnly,
        status: res.statusCode,
        durationMs: Date.now() - t0
      })
    );
  });
  next();
}
app.use(attachRequestId);
app.use(structuredAccessLog);

app.use(rateLimit({ windowMs: 60 * 1000, limit: 100 }));

const isProd = process.env.NODE_ENV === "production";
const allowInMemory = process.env.PAYMENT_ALLOW_INMEMORY === "true";
validatePaymentRuntime(process.env.NODE_ENV, allowInMemory);
const webhookSecret = resolveWebhookSecret(process.env.NODE_ENV, process.env.REQUEST_SIGNING_SECRET);
const webhookToleranceSeconds = Math.max(30, Number(process.env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS ?? 300) || 300);
const idempotencyKeyMaxLength = Math.max(32, Number(process.env.PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH ?? 128) || 128);
const providerMode = String(process.env.PAYMENT_PROVIDER_MODE ?? "mock").trim().toLowerCase();

const createIntentSchema = z.object({
  order_id: z.string().min(1),
  provider: z.enum(["iyzico", "stripe"]),
  amount: z.number().positive()
});
let seq = 1;
const intents = new Map<string, PaymentIntent>();
const intentByProviderPaymentId = new Map<string, string>();
const idempotency = new InMemoryIdempotencyStore();
const requestIdempotency = new InMemoryIdempotencyReplayStore();
const adapter = createPaymentProviderAdapter(process.env);

function readIdempotencyKey(req: Request, res: Response): string | null | undefined {
  const parsed = parseIdempotencyKeyHeader(req.header("x-idempotency-key"), idempotencyKeyMaxLength);
  if (!parsed.ok) {
    res.status(400).json({ message: parsed.message });
    return undefined;
  }
  return parsed.key;
}

function stableFingerprint(input: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "payment-service",
    inMemory: allowInMemory && !isProd,
    persistentBackendRequired: isProd,
    providerMode
  });
});

app.post("/payments/intent", async (req: Request, res: Response) => {
  const parsed = createIntentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  const userId = String(req.header("x-user-id") ?? "anonymous");
  const idempotencyKey = readIdempotencyKey(req, res);
  if (typeof idempotencyKey === "undefined") return;
  const intentFingerprint = stableFingerprint({
    orderId: parsed.data.order_id,
    userId,
    provider: parsed.data.provider,
    amount: parsed.data.amount
  });

  if (idempotencyKey) {
    const replayKey = `intent:${userId}:${idempotencyKey}`;
    const probe = requestIdempotency.probe(replayKey, intentFingerprint);
    if (probe.kind === "replay") {
      return res.status(probe.record.statusCode).json(probe.record.body);
    }
    if (probe.kind === "conflict") {
      return res.status(409).json({ message: "Idempotency key already used with different request payload" });
    }
  }

  const providerIntent = await adapter.createIntent({
    orderId: parsed.data.order_id,
    userId,
    provider: parsed.data.provider,
    amount: parsed.data.amount
  });
  const intent: PaymentIntent = {
    id: `pay_${seq++}`,
    providerPaymentId: providerIntent.providerPaymentId,
    orderId: parsed.data.order_id,
    userId,
    provider: parsed.data.provider,
    amount: parsed.data.amount,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  intents.set(intent.id, intent);
  intentByProviderPaymentId.set(intent.providerPaymentId, intent.id);
  if (idempotencyKey) {
    requestIdempotency.remember(`intent:${userId}:${idempotencyKey}`, {
      fingerprint: intentFingerprint,
      statusCode: 201,
      body: intent
    });
  }
  return res.status(201).json(intent);
});

app.post("/payments/:id/confirm", async (req: Request, res: Response) => {
  const intent = intents.get(req.params.id);
  if (!intent) return res.status(404).json({ message: "Payment intent not found" });
  const idempotencyKey = readIdempotencyKey(req, res);
  if (typeof idempotencyKey === "undefined") return;
  const confirmFingerprint = stableFingerprint({ id: req.params.id, operation: "confirm" });

  if (idempotencyKey) {
    const replayKey = `confirm:${req.params.id}:${idempotencyKey}`;
    const probe = requestIdempotency.probe(replayKey, confirmFingerprint);
    if (probe.kind === "replay") {
      return res.status(probe.record.statusCode).json(probe.record.body);
    }
    if (probe.kind === "conflict") {
      return res.status(409).json({ message: "Idempotency key already used with different request payload" });
    }
  }

  const next = await adapter.confirm(intent.provider, intent.providerPaymentId);
  intent.status = next.status;
  const responseBody = { id: intent.id, status: intent.status };
  if (idempotencyKey) {
    requestIdempotency.remember(`confirm:${req.params.id}:${idempotencyKey}`, {
      fingerprint: confirmFingerprint,
      statusCode: 200,
      body: responseBody
    });
  }
  return res.json(responseBody);
});

app.post("/payments/:id/refund", async (req: Request, res: Response) => {
  const intent = intents.get(req.params.id);
  if (!intent) return res.status(404).json({ message: "Payment intent not found" });
  const idempotencyKey = readIdempotencyKey(req, res);
  if (typeof idempotencyKey === "undefined") return;
  const refundFingerprint = stableFingerprint({ id: req.params.id, operation: "refund" });

  if (idempotencyKey) {
    const replayKey = `refund:${req.params.id}:${idempotencyKey}`;
    const probe = requestIdempotency.probe(replayKey, refundFingerprint);
    if (probe.kind === "replay") {
      return res.status(probe.record.statusCode).json(probe.record.body);
    }
    if (probe.kind === "conflict") {
      return res.status(409).json({ message: "Idempotency key already used with different request payload" });
    }
  }

  const next = await adapter.refund(intent.provider, intent.providerPaymentId);
  intent.status = next.status;
  const responseBody = { id: intent.id, status: intent.status };
  if (idempotencyKey) {
    requestIdempotency.remember(`refund:${req.params.id}:${idempotencyKey}`, {
      fingerprint: refundFingerprint,
      statusCode: 200,
      body: responseBody
    });
  }
  return res.json(responseBody);
});

app.post("/payments/webhook/:provider", (req: Request, res: Response) => {
  const provider = req.params.provider;
  if (provider !== "iyzico" && provider !== "stripe") {
    return res.status(404).json({ message: "Unknown provider" });
  }

  const webhookId = String(req.header("x-webhook-id") ?? "").trim();
  const signature = String(req.header("x-signature") ?? "").trim();
  const timestamp = String(req.header("x-timestamp") ?? "").trim();
  if (!webhookId || !signature || !timestamp) {
    return res.status(401).json({ message: "Missing webhook signature headers" });
  }
  if (!isWebhookTimestampFresh(timestamp, Date.now(), webhookToleranceSeconds)) {
    return res.status(401).json({ message: "Webhook timestamp outside tolerance window" });
  }

  if (!verifyWebhookSignature(signature, timestamp, req.body, webhookSecret)) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  if (!idempotency.remember(`webhook:${provider}:${webhookId}`)) {
    return res.json({ ok: true, duplicate: true });
  }

  const mapped = adapter.mapWebhookEvent(provider, req.body);
  if (!mapped) return res.status(400).json({ message: "Unsupported webhook payload" });

  const localId = intentByProviderPaymentId.get(mapped.paymentId);
  const intent = localId ? intents.get(localId) : null;
  if (!intent) {
    return res.status(202).json({ ok: true, applied: false, reason: "payment intent not found" });
  }

  intent.status = mapped.status;
  return res.json({ ok: true, applied: true, id: intent.id, status: intent.status });
});

app.listen(3007, () => {
  console.log("payment-service listening on 3007");
});

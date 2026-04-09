import crypto from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { validatePaymentRuntime } from "./runtimeConfig";
import { resolveWebhookSecret, verifyWebhookSignature } from "./webhookSecurity";

type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
type PaymentIntent = {
  id: string;
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

const createIntentSchema = z.object({
  order_id: z.string().min(1),
  provider: z.enum(["iyzico", "stripe"]),
  amount: z.number().positive()
});
const webhookSchema = z.object({
  event: z.enum(["payment.paid", "payment.failed", "payment.refunded"]),
  payment_id: z.string().min(1),
  order_id: z.string().min(1).optional(),
  amount: z.number().positive().optional()
});

let seq = 1;
const intents = new Map<string, PaymentIntent>();
const seenWebhookIds = new Set<string>();

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "payment-service",
    inMemory: allowInMemory && !isProd,
    persistentBackendRequired: isProd
  });
});

app.post("/payments/intent", (req: Request, res: Response) => {
  const parsed = createIntentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  const userId = String(req.header("x-user-id") ?? "anonymous");
  const intent: PaymentIntent = {
    id: `pay_${seq++}`,
    orderId: parsed.data.order_id,
    userId,
    provider: parsed.data.provider,
    amount: parsed.data.amount,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  intents.set(intent.id, intent);
  return res.status(201).json(intent);
});

app.post("/payments/:id/confirm", (req: Request, res: Response) => {
  const intent = intents.get(req.params.id);
  if (!intent) return res.status(404).json({ message: "Payment intent not found" });
  intent.status = "paid";
  return res.json({ id: intent.id, status: intent.status });
});

app.post("/payments/:id/refund", (req: Request, res: Response) => {
  const intent = intents.get(req.params.id);
  if (!intent) return res.status(404).json({ message: "Payment intent not found" });
  intent.status = "refunded";
  return res.json({ id: intent.id, status: intent.status });
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

  if (!verifyWebhookSignature(signature, timestamp, req.body, webhookSecret)) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  if (seenWebhookIds.has(webhookId)) {
    return res.json({ ok: true, duplicate: true });
  }
  seenWebhookIds.add(webhookId);

  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid webhook body", errors: parsed.error.flatten() });

  const intent = intents.get(parsed.data.payment_id);
  if (!intent) {
    return res.status(202).json({ ok: true, applied: false, reason: "payment intent not found" });
  }

  if (parsed.data.event === "payment.paid") intent.status = "paid";
  if (parsed.data.event === "payment.failed") intent.status = "failed";
  if (parsed.data.event === "payment.refunded") intent.status = "refunded";
  return res.json({ ok: true, applied: true, id: intent.id, status: intent.status });
});

app.listen(3007, () => {
  console.log("payment-service listening on 3007");
});

import "dotenv/config";
import crypto from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import {
  isOffersDatabaseConfigured,
  pgAccept,
  pgCounter,
  pgCounterTx,
  pgCreateOffer,
  pgGetById,
  pgListForBuyer,
  pgListForSeller,
  pgReject,
  pgAcceptTx,
  toStatusTr,
  type OfferApi,
  type OfferApiStatus
} from "./offerDb";
import { validateOfferRuntime } from "./runtimeConfig";

type Offer = OfferApi;

type HttpRequestWithId = Request & { serviceRequestId: string };

const app = express();
app.use(helmet());
app.use(cors({ origin: ["exp://localhost:8081"] }));
app.use(express.json({ limit: "2mb" }));

function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id")?.trim();
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  (req as HttpRequestWithId).serviceRequestId = id;
  res.setHeader("x-request-id", id);
  next();
}

function structuredAccessLog(req: Request, res: Response, next: NextFunction): void {
  if (String(process.env.OFFER_SERVICE_STRUCTURED_ACCESS_LOG ?? "").trim() !== "1") {
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
        svc: "offer-service",
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

const offers = new Map<string, Offer>();
let seq = 1;

const createOfferSchema = z.object({
  listing_id: z.string().min(1),
  seller_id: z.string().min(1),
  offered_price: z.number().min(0),
  offered_quantity: z.number().positive().optional(),
  message: z.string().max(1000).optional()
});

const counterSchema = z.object({
  counter_price: z.number().min(0),
  counter_message: z.string().max(1000).optional()
});

function userId(req: Request): string {
  return String(req.header("x-user-id") ?? "anonymous");
}

function usePg(): boolean {
  return isOffersDatabaseConfigured();
}

validateOfferRuntime(process.env.NODE_ENV, usePg());

type NotifyMeta = { listing_id?: string; conversation_id?: string };
const MESSAGING_SERVICE_URL = (process.env.MESSAGING_SERVICE_URL ?? "http://127.0.0.1:3004").replace(/\/$/, "");

async function pushNotification(
  userPhone: string,
  title: string,
  body: string,
  category: "new_offer" | "new_message" | "listing_approval" | "review",
  meta?: NotifyMeta
): Promise<void> {
  const base = (process.env.NOTIFICATION_SERVICE_URL ?? "http://127.0.0.1:3005").replace(/\/$/, "");
  try {
    await fetch(`${base}/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userPhone,
        channel: "push",
        category,
        title,
        body,
        ...(meta?.listing_id ? { listing_id: meta.listing_id } : {}),
        ...(meta?.conversation_id ? { conversation_id: meta.conversation_id } : {})
      })
    });
  } catch {
    /* bildirim servisi isteğe bağlı */
  }
}

async function ensureConversationForOffer(row: Offer): Promise<string | null> {
  try {
    const r = await fetch(`${MESSAGING_SERVICE_URL}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": row.sellerId },
      body: JSON.stringify({ participants: [row.sellerId, row.buyerId], listing_id: row.listingId })
    });
    if (!r.ok) return null;
    const json = (await r.json()) as { id?: string };
    return typeof json.id === "string" && json.id.trim() ? json.id.trim() : null;
  } catch {
    return null;
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "offer-service", persistence: usePg() ? "postgres" : "memory" });
});

app.post("/api/v1/offers", async (req: Request, res: Response) => {
  const parsed = createOfferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  const me = userId(req);
  if (parsed.data.seller_id === me) return res.status(400).json({ message: "Kendi ilanina teklif verilemez" });

  if (usePg()) {
    try {
      const row = await pgCreateOffer(
        parsed.data.listing_id,
        me,
        parsed.data.seller_id,
        parsed.data.offered_price,
        parsed.data.offered_quantity,
        parsed.data.message
      );
      void pushNotification(parsed.data.seller_id, "Yeni teklif", `${me} ilaniniza teklif gonderdi.`, "new_offer", {
        listing_id: parsed.data.listing_id
      });
      return res.status(201).json({ ...row, statusTr: toStatusTr(row.status) });
    } catch (e) {
      console.warn("offer-service: pg create failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }

  const id = `ofr_${seq++}`;
  const now = new Date().toISOString();
  const row: Offer = {
    id,
    listingId: parsed.data.listing_id,
    buyerId: me,
    sellerId: parsed.data.seller_id,
    offeredPrice: parsed.data.offered_price,
    offeredQuantity: parsed.data.offered_quantity,
    message: parsed.data.message,
    status: "pending",
    createdAt: now,
    updatedAt: now
  };
  offers.set(id, row);
  void pushNotification(parsed.data.seller_id, "Yeni teklif", `${me} ilaniniza teklif gonderdi.`, "new_offer", {
    listing_id: parsed.data.listing_id
  });
  return res.status(201).json({ ...row, statusTr: toStatusTr(row.status) });
});

app.get("/api/v1/offers/received", async (_req: Request, res: Response) => {
  const me = userId(_req);
  if (usePg()) {
    try {
      const data = await pgListForSeller(me);
      return res.json({ data: data.map((d) => ({ ...d, statusTr: toStatusTr(d.status) })) });
    } catch (e) {
      console.warn("offer-service: pg list received failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }
  const data = [...offers.values()].filter((item) => item.sellerId === me);
  return res.json({ data });
});

app.get("/api/v1/offers/sent", async (_req: Request, res: Response) => {
  const me = userId(_req);
  if (usePg()) {
    try {
      const data = await pgListForBuyer(me);
      return res.json({ data: data.map((d) => ({ ...d, statusTr: toStatusTr(d.status) })) });
    } catch (e) {
      console.warn("offer-service: pg list sent failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }
  const data = [...offers.values()].filter((item) => item.buyerId === me);
  return res.json({ data });
});

app.get("/api/v1/offers/:id", async (req: Request, res: Response) => {
  const me = userId(req);
  if (usePg()) {
    try {
      const row = await pgGetById(req.params.id);
      if (!row) return res.status(404).json({ message: "Offer not found" });
      if (![row.buyerId, row.sellerId].includes(me)) return res.status(403).json({ message: "Forbidden" });
      return res.json({ ...row, statusTr: toStatusTr(row.status) });
    } catch (e) {
      console.warn("offer-service: pg get failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }
  const row = offers.get(req.params.id);
  if (!row) return res.status(404).json({ message: "Offer not found" });
  if (![row.buyerId, row.sellerId].includes(me)) return res.status(403).json({ message: "Forbidden" });
  return res.json(row);
});

async function mutOffer(
  req: Request,
  res: Response,
  op: "accept" | "reject" | "counter",
  counter?: { price: number; message?: string }
): Promise<Response> {
  const me = userId(req);
  const id = req.params.id;
  if (usePg()) {
    try {
      if (op === "accept") {
        const tx = await pgAcceptTx(id, me);
        if (!tx.ok || !tx.row) return res.status(404).json({ message: "Offer not found" });
        const row = tx.row;
        const conversationId = await ensureConversationForOffer(row);
        if (row)
          void pushNotification(row.buyerId, "Teklif kabul edildi", "Satici teklifinizi kabul etti.", "new_offer", {
            listing_id: row.listingId,
            ...(conversationId ? { conversation_id: conversationId } : {})
          });
        return res.json({
          status: "accepted" satisfies OfferApiStatus,
          statusTr: toStatusTr("accepted"),
          conversationId
        });
      }
      if (op === "reject") {
        const ok = await pgReject(id, me);
        if (!ok) return res.status(404).json({ message: "Offer not found" });
        const row = await pgGetById(id);
        if (row)
          void pushNotification(row.buyerId, "Teklif reddedildi", "Satici teklifinizi reddetti.", "new_offer", {
            listing_id: row.listingId
          });
        return res.json({ status: "rejected" satisfies OfferApiStatus, statusTr: toStatusTr("rejected") });
      }
      if (counter) {
        const tx = await pgCounterTx(id, me, counter.price, counter.message);
        if (!tx.ok || !tx.row) return res.status(404).json({ message: "Offer not found" });
        const row = tx.row;
        const conversationId = await ensureConversationForOffer(row);
        if (row)
          void pushNotification(row.buyerId, "Karsi teklif", `Satici yeni fiyat: ${counter.price}`, "new_offer", {
            listing_id: row.listingId,
            ...(conversationId ? { conversation_id: conversationId } : {})
          });
        return res.json({
          status: "countered" satisfies OfferApiStatus,
          statusTr: toStatusTr("countered"),
          counterPrice: counter.price,
          conversationId
        });
      }
    } catch (e) {
      console.warn("offer-service: pg mut failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }
  const row = offers.get(id);
  if (!row) return res.status(404).json({ message: "Offer not found" });
  if (op === "accept") {
    if (row.sellerId !== me) return res.status(403).json({ message: "Sadece satici kabul edebilir" });
    row.status = "accepted";
    row.updatedAt = new Date().toISOString();
    void pushNotification(row.buyerId, "Teklif kabul edildi", "Satici teklifinizi kabul etti.", "new_offer", {
      listing_id: row.listingId
    });
    return res.json({ status: row.status });
  }
  if (op === "reject") {
    if (row.sellerId !== me) return res.status(403).json({ message: "Sadece satici reddedebilir" });
    row.status = "rejected";
    row.updatedAt = new Date().toISOString();
    void pushNotification(row.buyerId, "Teklif reddedildi", "Satici teklifinizi reddetti.", "new_offer", {
      listing_id: row.listingId
    });
    return res.json({ status: row.status });
  }
  if (counter && op === "counter") {
    if (row.sellerId !== me) return res.status(403).json({ message: "Sadece satici karsi teklif verebilir" });
    row.status = "countered";
    row.counterPrice = counter.price;
    row.counterMessage = counter.message;
    row.updatedAt = new Date().toISOString();
    void pushNotification(row.buyerId, "Karsi teklif", `Satici yeni fiyat: ${counter.price}`, "new_offer", {
      listing_id: row.listingId
    });
    const conversationId = await ensureConversationForOffer(row);
    return res.json({ status: row.status, statusTr: toStatusTr("countered"), counterPrice: row.counterPrice, conversationId });
  }
  return res.status(400).json({ message: "Invalid" });
}

app.put("/api/v1/offers/:id/accept", (req, res) => void mutOffer(req, res, "accept"));
app.put("/api/v1/offers/:id/reject", (req, res) => void mutOffer(req, res, "reject"));
app.put("/api/v1/offers/:id/counter", (req, res, next) => {
  const parsed = counterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
    return;
  }
  void mutOffer(req, res, "counter", { price: parsed.data.counter_price, message: parsed.data.counter_message });
});

const port = Number(process.env.PORT ?? 3003);
app.listen(port, () => {
  console.log(`offer-service listening on ${port} (${usePg() ? "postgres" : "memory"})`);
});

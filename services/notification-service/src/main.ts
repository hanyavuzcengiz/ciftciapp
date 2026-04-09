import "dotenv/config";
import crypto from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { sendExpoPushMessages } from "./expoPush";
import {
  isNotificationsDatabaseConfigured,
  pgCountPushTokensForUser,
  pgInsert,
  pgList,
  pgListPushTokensForUser,
  pgMarkRead,
  pgUpsertPushToken,
  type NotificationApi
} from "./notificationDb";
import { validateNotificationRuntime } from "./runtimeConfig";

type Notification = NotificationApi;

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
  if (String(process.env.NOTIFICATION_SERVICE_STRUCTURED_ACCESS_LOG ?? "").trim() !== "1") {
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
        svc: "notification-service",
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

const createSchema = z.object({
  user_id: z.string().min(1),
  channel: z.enum(["push", "email", "sms"]),
  category: z.enum(["new_offer", "new_message", "listing_approval", "review"]),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000),
  listing_id: z.string().min(1).optional(),
  conversation_id: z.string().min(1).optional()
});
const registerTokenSchema = z.object({
  user_id: z.string().min(1),
  expo_push_token: z.string().min(8)
});

let seq = 1;
const db = new Map<string, Notification[]>();
const pushTokens = new Map<string, Set<string>>();

function usePg(): boolean {
  return isNotificationsDatabaseConfigured();
}

validateNotificationRuntime(process.env.NODE_ENV, usePg());

function currentUser(req: Request): string | null {
  const u = req.header("x-user-id");
  if (!u || u === "anonymous") return null;
  return u;
}

async function deliverPushIfNeeded(row: Notification, userId: string): Promise<void> {
  if (row.channel !== "push") return;
  const tokens = usePg()
    ? await pgListPushTokensForUser(userId)
    : [...(pushTokens.get(userId) ?? [])];
  if (tokens.length === 0) return;
  const result = await sendExpoPushMessages(
    tokens.map((to) => ({
      to,
      sound: "default" as const,
      title: row.title,
      body: row.body,
      data: {
        listingId: row.listingId ?? undefined,
        conversationId: row.conversationId ?? undefined,
        category: row.category
      }
    }))
  );
  if (!result.ok || result.ticketErrorCount > 0 || result.retryScheduled) {
    console.warn(
      "notification-service: push delivery diagnostic",
      JSON.stringify({
        userId,
        notificationId: row.id,
        tokenCount: tokens.length,
        attempts: result.attempts,
        ok: result.ok,
        httpStatus: result.httpStatus,
        ticketErrorCount: result.ticketErrorCount,
        retryScheduled: result.retryScheduled
      })
    );
  }
}

app.get("/health", (_req: Request, res: Response) =>
  res.json({
    ok: true,
    channels: ["push", "email", "sms"],
    persistence: usePg() ? "postgres" : "memory"
  })
);

app.post("/notifications", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });

  if (usePg()) {
    try {
      const row = await pgInsert(
        parsed.data.user_id,
        parsed.data.channel,
        parsed.data.category,
        parsed.data.title,
        parsed.data.body,
        parsed.data.listing_id,
        parsed.data.conversation_id
      );
      void deliverPushIfNeeded(row, parsed.data.user_id);
      return res.status(201).json(row);
    } catch (e) {
      console.warn("notification-service: pg insert failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }

  const row: Notification = {
    id: `ntf_${seq++}`,
    userId: parsed.data.user_id,
    channel: parsed.data.channel,
    category: parsed.data.category,
    title: parsed.data.title,
    body: parsed.data.body,
    readAt: null,
    createdAt: new Date().toISOString(),
    listingId: parsed.data.listing_id ?? null,
    conversationId: parsed.data.conversation_id ?? null
  };
  const bag = db.get(row.userId) ?? [];
  bag.unshift(row);
  db.set(row.userId, bag);
  void deliverPushIfNeeded(row, row.userId);
  return res.status(201).json(row);
});

app.post("/notifications/register-token", async (req: Request, res: Response) => {
  const parsed = registerTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  const me = currentUser(req);
  if (!me) return res.status(401).json({ message: "x-user-id required" });
  if (me !== parsed.data.user_id) return res.status(403).json({ message: "user_id does not match authenticated user" });

  const token = parsed.data.expo_push_token.trim();
  if (usePg()) {
    try {
      await pgUpsertPushToken(parsed.data.user_id, token);
      const totalTokens = await pgCountPushTokensForUser(parsed.data.user_id);
      return res.status(201).json({ ok: true, totalTokens });
    } catch (e) {
      console.warn("notification-service: pg upsert push token failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }

  const bag = pushTokens.get(parsed.data.user_id) ?? new Set<string>();
  bag.add(token);
  pushTokens.set(parsed.data.user_id, bag);
  return res.status(201).json({ ok: true, totalTokens: bag.size });
});

app.get("/notifications", async (req: Request, res: Response) => {
  const me = currentUser(req);
  if (!me) return res.status(401).json({ message: "x-user-id required" });
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  if (usePg()) {
    try {
      const data = await pgList(me, limit);
      return res.json({ data });
    } catch (e) {
      console.warn("notification-service: pg list failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }

  return res.json({ data: db.get(me) ?? [] });
});

app.patch("/notifications/:id/read", async (req: Request, res: Response) => {
  const me = currentUser(req);
  if (!me) return res.status(401).json({ message: "x-user-id required" });

  if (usePg()) {
    try {
      const ok = await pgMarkRead(req.params.id, me);
      if (!ok) return res.status(404).json({ message: "Not found" });
      return res.json({ ok: true });
    } catch (e) {
      console.warn("notification-service: pg mark read failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }

  const bag = db.get(me);
  const row = bag?.find((n) => n.id === req.params.id);
  if (!row) return res.status(404).json({ message: "Not found" });
  if (!row.readAt) row.readAt = new Date().toISOString();
  return res.json({ ok: true });
});

/** @deprecated Yerine GET /notifications + x-user-id kullanin */
app.get("/notifications/:userId", async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  if (usePg()) {
    try {
      const data = await pgList(req.params.userId, limit);
      return res.json({ data });
    } catch (e) {
      console.warn("notification-service: pg list by path failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }
  return res.json({ data: db.get(req.params.userId) ?? [] });
});

const port = Number(process.env.PORT ?? 3005);
app.listen(port, () => {
  console.log(`notification-service listening on ${port} (${usePg() ? "postgres" : "memory"})`);
});

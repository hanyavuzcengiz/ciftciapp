import "dotenv/config";
import crypto from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import {
  isMessagingDatabaseConfigured,
  pgConversationExists,
  pgConversationNotifyContext,
  pgCreateConversation,
  pgDeleteMessage,
  pgFindConversationByListingAndParticipants,
  pgFindDirectConversationBetweenParticipants,
  pgGetMessages,
  pgListConversations,
  pgPostMessage
} from "./chatDb";
import { decryptText, encryptText } from "./shared/utils/crypto";
import { decodeCursor, encodeCursor, sameParticipantSets } from "./chatUtils";

type Conversation = {
  id: string;
  participants: string[];
  listingId?: string;
  createdAt: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string;
};
type MessageType = "text" | "image" | "voice" | "system";
type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  mediaUrl?: string;
  createdAt: string;
};

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
  if (String(process.env.MESSAGING_SERVICE_STRUCTURED_ACCESS_LOG ?? "").trim() !== "1") {
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
        svc: "messaging-service",
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

const conversations = new Map<string, Conversation>();
const messages = new Map<string, Message[]>();
let convSeq = 1;
let msgSeq = 1;

const createConversationSchema = z.object({
  participants: z.array(z.string().min(1)).min(2),
  listing_id: z.string().optional()
});
const createMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  message_type: z.enum(["text", "image", "voice", "system"]),
  media_url: z.string().url().optional()
});
const messageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20)
});

function currentUser(req: Request): string {
  return String(req.header("x-user-id") ?? "anonymous");
}

function usePg(): boolean {
  return isMessagingDatabaseConfigured();
}

async function notifyNewMessage(conversationId: string, senderPhone: string, plainText: string): Promise<void> {
  const base = (process.env.NOTIFICATION_SERVICE_URL ?? "http://127.0.0.1:3005").replace(/\/$/, "");
  let listingId: string | null = null;
  let recipients: string[] = [];
  if (usePg()) {
    const ctx = await pgConversationNotifyContext(conversationId, senderPhone);
    if (!ctx) return;
    listingId = ctx.listingId;
    recipients = ctx.recipientPhones;
  } else {
    const conv = conversations.get(conversationId);
    if (!conv) return;
    listingId = conv.listingId ?? null;
    recipients = conv.participants.filter((p) => p !== senderPhone);
  }
  const body = plainText.length > 120 ? `${plainText.slice(0, 117)}...` : plainText;
  for (const user_id of recipients) {
    try {
      await fetch(`${base}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          channel: "push",
          category: "new_message",
          title: "Yeni mesaj",
          body,
          ...(listingId ? { listing_id: listingId } : {}),
          conversation_id: conversationId
        })
      });
    } catch {
      /* bildirim servisi isteğe bağlı */
    }
  }
}

app.get("/health", (_req, res) => {
  return res.json({
    ok: true,
    service: "messaging-service",
    persistence: usePg() ? "postgres" : "memory"
  });
});

app.get("/api/v1/conversations", async (req: Request, res: Response) => {
  const me = currentUser(req);
  if (usePg()) {
    try {
      const data = await pgListConversations(me);
      return res.json({ data, nextCursor: null });
    } catch (e) {
      console.warn("messaging-service: pg list failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }
  const data = [...conversations.values()].filter((item) => item.participants.includes(me));
  return res.json({ data, nextCursor: null });
});

app.post("/api/v1/conversations", async (req: Request, res: Response) => {
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  const participants = Array.from(new Set(parsed.data.participants));
  const listingId = parsed.data.listing_id;

  if (usePg()) {
    try {
      if (listingId) {
        const existing = await pgFindConversationByListingAndParticipants(listingId, participants);
        if (existing) {
          return res.status(200).json({ ...existing, existing: true as const });
        }
      } else if (participants.length === 2) {
        const dm = await pgFindDirectConversationBetweenParticipants(participants);
        if (dm) {
          return res.status(200).json({ ...dm, existing: true as const });
        }
      }
      const row = await pgCreateConversation(participants, listingId);
      return res.status(201).json({ ...row, existing: false as const });
    } catch (e) {
      console.warn("messaging-service: pg create conversation failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }

  if (listingId) {
    for (const c of conversations.values()) {
      if (c.listingId === listingId && sameParticipantSets(c.participants, participants)) {
        return res.status(200).json({ ...c, existing: true as const });
      }
    }
  } else if (participants.length === 2) {
    for (const c of conversations.values()) {
      if (!c.listingId && sameParticipantSets(c.participants, participants)) {
        return res.status(200).json({ ...c, existing: true as const });
      }
    }
  }

  const id = `cnv_${convSeq++}`;
  const row: Conversation = {
    id,
    participants,
    listingId,
    createdAt: new Date().toISOString()
  };
  conversations.set(id, row);
  messages.set(id, []);
  return res.status(201).json({ ...row, existing: false as const });
});

app.get("/api/v1/conversations/:id/messages", async (req: Request, res: Response) => {
  const me = currentUser(req);
  const parsed = messageQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid query", errors: parsed.error.flatten() });

  if (usePg()) {
    try {
      const exists = await pgConversationExists(req.params.id, me);
      if (!exists) return res.status(404).json({ message: "Conversation not found" });
      const { data, nextCursor } = await pgGetMessages(req.params.id, me, parsed.data.cursor, parsed.data.limit);
      return res.json({ data, nextCursor });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "FORBIDDEN") return res.status(403).json({ message: "Forbidden" });
      console.warn("messaging-service: pg messages failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }

  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ message: "Conversation not found" });
  if (!conv.participants.includes(me)) return res.status(403).json({ message: "Forbidden" });
  const all = messages.get(req.params.id) ?? [];
  const plain = all.map((msg) => ({ ...msg, content: decryptText(msg.content) }));
  const n = plain.length;
  const limit = parsed.data.limit;
  let endExclusive = n;
  let startInclusive: number;
  if (!parsed.data.cursor?.trim()) {
    startInclusive = Math.max(0, n - limit);
  } else {
    const idx = decodeCursor(parsed.data.cursor);
    endExclusive = Math.min(Math.max(0, idx), n);
    startInclusive = Math.max(0, endExclusive - limit);
  }
  const page = plain.slice(startInclusive, endExclusive);
  const nextCursor = startInclusive > 0 ? encodeCursor(startInclusive) : null;
  return res.json({ data: page, nextCursor });
});

app.post("/api/v1/conversations/:id/messages", async (req: Request, res: Response) => {
  const me = currentUser(req);
  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });

  if (usePg()) {
    try {
      const row = await pgPostMessage(
        req.params.id,
        me,
        parsed.data.content,
        parsed.data.message_type,
        parsed.data.media_url
      );
      void notifyNewMessage(req.params.id, me, parsed.data.content);
      return res.status(201).json(row);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "FORBIDDEN") return res.status(403).json({ message: "Forbidden" });
      console.warn("messaging-service: pg post message failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }

  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ message: "Conversation not found" });
  if (!conv.participants.includes(me)) return res.status(403).json({ message: "Forbidden" });
  const row: Message = {
    id: `msg_${msgSeq++}`,
    conversationId: req.params.id,
    senderId: me,
    content: encryptText(parsed.data.content),
    messageType: parsed.data.message_type,
    mediaUrl: parsed.data.media_url,
    createdAt: new Date().toISOString()
  };
  const bag = messages.get(req.params.id) ?? [];
  bag.push(row);
  messages.set(req.params.id, bag);
  void notifyNewMessage(req.params.id, me, parsed.data.content);
  return res.status(201).json({ ...row, content: parsed.data.content });
});

app.delete("/api/v1/conversations/:id/messages/:msgId", async (req: Request, res: Response) => {
  const me = currentUser(req);
  if (usePg()) {
    try {
      const ok = await pgDeleteMessage(req.params.id, req.params.msgId, me);
      if (!ok) return res.status(404).json({ message: "Message not found or forbidden" });
      return res.status(204).send();
    } catch (e) {
      console.warn("messaging-service: pg delete message failed", e);
      return res.status(500).json({ message: "Database error" });
    }
  }
  const bag = messages.get(req.params.id);
  if (!bag) return res.status(404).json({ message: "Conversation not found" });
  const idx = bag.findIndex((item) => item.id === req.params.msgId && item.senderId === me);
  if (idx < 0) return res.status(404).json({ message: "Message not found or forbidden" });
  bag.splice(idx, 1);
  return res.status(204).send();
});

const port = Number(process.env.PORT ?? 3004);
app.listen(port, () => {
  console.log(`messaging-service listening on ${port} (${usePg() ? "postgres" : "memory"})`);
});

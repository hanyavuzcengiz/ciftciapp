import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  findUserByIdOrPhone,
  findUserByPhone,
  insertPeerReviewRow,
  isDatabaseConfigured,
  listMergedUserReviews,
  updateFormalReviewSellerReply,
  updatePeerReviewSellerReply
} from "../../infrastructure/db/userPg";

const router: Router = Router();

type PeerMem = {
  id: string;
  reviewerId: string;
  reviewedUserId: string;
  listingId?: string;
  rating: number;
  comment?: string;
  sellerReply: string | null;
  createdAt: string;
  updatedAt: string;
};

const peerMemory: PeerMem[] = [];
let peerSeq = 1;

const createPeerSchema = z.object({
  reviewed_user_id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  listing_id: z.string().optional()
});

const replySchema = z.object({
  seller_reply: z.string().max(500)
});

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20)
});

function userId(req: Request): string | undefined {
  const u = req.header("x-user-id");
  return u && u !== "anonymous" ? u : undefined;
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    return Number(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    return 0;
  }
}

function encodeCursor(n: number): string {
  return Buffer.from(String(n), "utf8").toString("base64");
}

router.post("/", async (req: Request, res: Response) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ message: "x-user-id required" });

  const parsed = createPeerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const { reviewed_user_id, rating, comment, listing_id } = parsed.data;
  if (reviewed_user_id === uid) return res.status(400).json({ message: "Kendi kendinizi degerlendiremezsiniz" });

  if (isDatabaseConfigured()) {
    const reviewed = await findUserByIdOrPhone(reviewed_user_id);
    if (!reviewed) return res.status(404).json({ message: "Degerlendirilen kullanici bulunamadi" });
    const reviewer = await findUserByPhone(uid);
    if (reviewer && reviewer.id === reviewed.id) {
      return res.status(400).json({ message: "Kendi kendinizi degerlendiremezsiniz" });
    }
    const ins = await insertPeerReviewRow(uid, reviewed.id, listing_id, rating, comment);
    if (!ins.ok) return res.status(503).json({ message: ins.reason ?? "Kayit basarisiz" });
    const now = new Date().toISOString();
    return res.status(201).json({
      id: ins.id,
      reviewerId: uid,
      reviewedUserId: reviewed.id,
      listingId: listing_id,
      rating,
      comment,
      sellerReply: null,
      isVerifiedPurchase: false,
      createdAt: now,
      updatedAt: now,
      source: "peer"
    });
  }

  const id = `rev_p_${peerSeq++}`;
  const now = new Date().toISOString();
  peerMemory.push({
    id,
    reviewerId: uid,
    reviewedUserId: reviewed_user_id,
    listingId: listing_id,
    rating,
    comment,
    sellerReply: null,
    createdAt: now,
    updatedAt: now
  });
  return res.status(201).json({
    id,
    reviewerId: uid,
    reviewedUserId: reviewed_user_id,
    listingId: listing_id,
    rating,
    comment,
    sellerReply: null,
    isVerifiedPurchase: false,
    createdAt: now,
    updatedAt: now,
    source: "peer"
  });
});

router.get("/user/:userId", async (req: Request, res: Response) => {
  const { userId: target } = req.params;
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  if (isDatabaseConfigured()) {
    const row = await findUserByIdOrPhone(target);
    if (!row) return res.json({ data: [], nextCursor: null });
    const merged = await listMergedUserReviews(row.id, 100);
    const start = decodeCursor(parsed.data.cursor);
    const end = start + parsed.data.limit;
    const data = merged.slice(start, end).map((r) => ({
      id: r.id,
      reviewerId: r.reviewerId,
      reviewerName: r.reviewerName,
      rating: r.rating,
      comment: r.comment,
      sellerReply: r.sellerReply,
      createdAt: r.createdAt,
      source: r.source
    }));
    const nextCursor = end < merged.length ? encodeCursor(end) : null;
    return res.json({ data, nextCursor });
  }

  const resolved = await findUserByIdOrPhone(target);
  const key = resolved?.id ?? target;
  const row = peerMemory.filter((r) => r.reviewedUserId === key).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const start = decodeCursor(parsed.data.cursor);
  const end = start + parsed.data.limit;
  const data = row.slice(start, end).map((r) => ({
    id: r.id,
    reviewerId: r.reviewerId,
    reviewerName: "Üye",
    rating: r.rating,
    comment: r.comment ?? null,
    sellerReply: r.sellerReply,
    createdAt: r.createdAt,
    source: "peer" as const
  }));
  const nextCursor = end < row.length ? encodeCursor(end) : null;
  return res.json({ data, nextCursor });
});

router.put("/:id/reply", async (req: Request, res: Response) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ message: "x-user-id required" });

  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  if (isDatabaseConfigured()) {
    const seller = await findUserByPhone(uid);
    if (!seller) return res.status(404).json({ message: "Kullanici bulunamadi" });
    const peerOk = await updatePeerReviewSellerReply(req.params.id, seller.id, parsed.data.seller_reply);
    if (peerOk) {
      return res.json({
        id: req.params.id,
        sellerReply: parsed.data.seller_reply,
        updatedAt: new Date().toISOString()
      });
    }
    const formalOk = await updateFormalReviewSellerReply(req.params.id, seller.id, parsed.data.seller_reply);
    if (formalOk) {
      return res.json({
        id: req.params.id,
        sellerReply: parsed.data.seller_reply,
        updatedAt: new Date().toISOString()
      });
    }
    return res.status(404).json({ message: "Review not found" });
  }

  const mem = peerMemory.find((r) => r.id === req.params.id);
  if (!mem) return res.status(404).json({ message: "Review not found" });
  const seller = await findUserByPhone(uid);
  const canReply = seller
    ? mem.reviewedUserId === seller.id || mem.reviewedUserId === seller.phone_number
    : mem.reviewedUserId === uid;
  if (!canReply) return res.status(403).json({ message: "Sadece degerlendirilen kullanici yanit verebilir" });
  mem.sellerReply = parsed.data.seller_reply;
  mem.updatedAt = new Date().toISOString();
  return res.json(mem);
});

export default router;

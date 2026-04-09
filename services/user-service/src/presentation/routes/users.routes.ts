import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  followUser,
  findListingsBySellerPhone,
  findUserByIdOrPhone,
  findUserByPhone,
  isFollowingUser,
  isDatabaseConfigured,
  listFollowedUsers,
  listMergedUserReviews,
  getUserDashboardStats,
  unfollowUser,
  updateUserMe,
  toMePayload,
  toPublicProfile
} from "../../infrastructure/db/userPg";

const router: Router = Router();

const updateMeSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  bio: z.string().max(500).optional(),
  businessProfile: z.record(z.string(), z.unknown()).nullable().optional()
});

const followBodySchema = z.object({
  targetUserId: z.string().min(2).max(120)
});

function phoneFromReq(req: Request): string | null {
  const u = req.header("x-user-id");
  if (!u || u === "anonymous") return null;
  return u;
}

router.get("/me", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });

  if (!isDatabaseConfigured()) {
    return res.status(200).json({
      persisted: false,
      phoneNumber: phone,
      message: "DATABASE_URL not configured"
    });
  }

  const row = await findUserByPhone(phone);
  if (!row) {
    return res.status(200).json({
      persisted: false,
      phoneNumber: phone,
      message: "Profile not in database yet"
    });
  }
  return res.json({ persisted: true, ...toMePayload(row) });
});

router.get("/me/dashboard", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  if (!isDatabaseConfigured()) {
    return res.json({
      totalSales: 0,
      activeListings: 0,
      soldListings: 0,
      avgResponseMinutes: 0,
      persisted: false
    });
  }
  const stats = await getUserDashboardStats(phone);
  return res.json({ ...stats, persisted: true });
});

router.put("/me", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });

  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  }

  if (!isDatabaseConfigured()) {
    return res.status(503).json({ message: "Database not configured" });
  }

  const next = await updateUserMe(phone, {
    fullName: parsed.data.fullName,
    bio: parsed.data.bio,
    businessProfile: parsed.data.businessProfile
  });
  if (!next) return res.status(404).json({ message: "User not found" });
  return res.json(toMePayload(next));
});

router.post("/me/photo", (_req, res) => res.status(201).json({ uploaded: true }));

router.get("/me/follows", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  if (!isDatabaseConfigured()) {
    return res.json({ data: [] });
  }
  const rows = await listFollowedUsers(phone, limit);
  return res.json({
    data: rows.map((r) => ({
      targetUserId: r.target_user_ref,
      createdAt: r.created_at.toISOString()
    }))
  });
});

router.get("/me/follows/:targetUserId", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  if (!isDatabaseConfigured()) {
    return res.json({ following: false, persisted: false });
  }
  const target = req.params.targetUserId?.trim();
  if (!target) return res.status(400).json({ message: "targetUserId required" });
  const following = await isFollowingUser(phone, target);
  return res.json({ following, persisted: true });
});

router.post("/me/follows", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  const parsed = followBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  }
  const target = parsed.data.targetUserId.trim();
  if (target === phone) return res.status(400).json({ message: "Cannot follow yourself" });
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ message: "Database not configured" });
  }
  const ok = await followUser(phone, target);
  if (!ok) return res.status(500).json({ message: "Follow failed" });
  return res.status(201).json({ ok: true });
});

router.delete("/me/follows/:targetUserId", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  const target = req.params.targetUserId?.trim();
  if (!target) return res.status(400).json({ message: "targetUserId required" });
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ message: "Database not configured" });
  }
  const ok = await unfollowUser(phone, target);
  if (!ok) return res.status(500).json({ message: "Unfollow failed" });
  return res.json({ ok: true });
});

/** Oturum açmış kullanıcı: DM için karşı tarafın E.164 telefonu (yalnızca kayıtlı kullanıcılar). */
router.get("/:userId/peer-phone", async (req: Request, res: Response) => {
  if (req.params.userId === "me") {
    return res.status(404).json({ message: "User not found" });
  }
  const viewer = phoneFromReq(req);
  if (!viewer) return res.status(401).json({ message: "x-user-id required" });
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ message: "Database not configured" });
  }
  const row = await findUserByIdOrPhone(req.params.userId);
  if (!row) return res.status(404).json({ message: "User not found" });
  if (row.phone_number === viewer) {
    return res.status(400).json({ message: "Cannot message yourself" });
  }
  return res.json({ phoneNumber: row.phone_number });
});

router.get("/:userId", async (req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json({ userId: req.params.userId, persisted: false });
  }
  const row = await findUserByIdOrPhone(req.params.userId);
  if (!row) return res.status(404).json({ message: "User not found" });
  return res.json(toPublicProfile(row));
});

router.get("/:userId/listings", async (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  if (!isDatabaseConfigured()) {
    return res.json({ data: [], nextCursor: null });
  }
  const row = await findUserByIdOrPhone(req.params.userId);
  if (!row) return res.status(404).json({ message: "User not found" });
  const rows = await findListingsBySellerPhone(row.phone_number, limit);
  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    listingType: r.listing_type,
    price: Number.parseFloat(r.price),
    status: r.status,
    createdAt: r.created_at.toISOString()
  }));
  return res.json({ data, nextCursor: null });
});

router.get("/:userId/reviews", async (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  if (!isDatabaseConfigured()) {
    return res.json({ data: [], nextCursor: null });
  }
  const row = await findUserByIdOrPhone(req.params.userId);
  if (!row) return res.status(404).json({ message: "User not found" });
  const rows = await listMergedUserReviews(row.id, limit);
  const data = rows.map((r) => ({
    id: r.id,
    reviewerId: r.reviewerId,
    reviewerName: r.reviewerName,
    rating: r.rating,
    comment: r.comment,
    sellerReply: r.sellerReply,
    createdAt: r.createdAt,
    source: r.source
  }));
  return res.json({ data, nextCursor: null });
});

export default router;

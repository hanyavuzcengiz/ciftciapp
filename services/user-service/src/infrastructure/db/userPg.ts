import pg from "pg";

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) return null;
  pool ??= new pg.Pool({ connectionString: url, max: 5 });
  return pool;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** OTP doğrulandıktan sonra çekirdek users satırı (listing author_uuid FK için). */
export async function upsertUserOnPhoneVerify(phoneNumber: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  const c = await p.connect();
  try {
    await c.query(
      `INSERT INTO users (phone_number, full_name, verification_status, last_login_at)
       VALUES ($1, $2, 'phone_verified', NOW())
       ON CONFLICT (phone_number) DO UPDATE SET
         last_login_at = NOW(),
         verification_status = 'phone_verified',
         updated_at = NOW()`,
      [phoneNumber, "Üye"]
    );
  } finally {
    c.release();
  }
}

const userTypeSql = new Set(["farmer", "breeder", "buyer", "supplier", "service_provider", "cooperative"]);

/** Profil tamamlama: satır yoksa oluşturur (OTP ile DB atlanmış olabilir). */
export async function upsertUserProfile(
  phoneNumber: string,
  fullName: string,
  userType: string
): Promise<{ ok: boolean }> {
  const p = getPool();
  if (!p) return { ok: false };
  if (!userTypeSql.has(userType)) return { ok: false };
  const c = await p.connect();
  try {
    await c.query(
      `INSERT INTO users (phone_number, full_name, user_type, verification_status, last_login_at)
       VALUES ($1, $2, $3::user_type, 'phone_verified', NOW())
       ON CONFLICT (phone_number) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         user_type = EXCLUDED.user_type,
         verification_status = 'phone_verified',
         updated_at = NOW()`,
      [phoneNumber, fullName, userType]
    );
    return { ok: true };
  } finally {
    c.release();
  }
}

export type DbUserRow = {
  id: string;
  phone_number: string;
  full_name: string;
  user_type: string;
  verification_status: string;
  rating_avg: string;
  rating_count: number;
  bio: string | null;
  business_profile_json: unknown | null;
};

function trustFromRatings(avg: number, count: number): number {
  if (count <= 0) return 55;
  const clamped = Math.min(5, Math.max(0, avg));
  return Math.round(45 + clamped * 11);
}

export async function findUserByPhone(phoneNumber: string): Promise<DbUserRow | null> {
  const p = getPool();
  if (!p) return null;
  const c = await p.connect();
  try {
    const r = await c.query<DbUserRow>(
      `SELECT id::text, phone_number, full_name, user_type::text, verification_status::text,
              rating_avg::text, rating_count, bio, business_profile_json
       FROM users WHERE phone_number = $1 LIMIT 1`,
      [phoneNumber]
    );
    return r.rows[0] ?? null;
  } finally {
    c.release();
  }
}

/** `userId` path: UUID veya E.164 telefon */
export async function findUserByIdOrPhone(userId: string): Promise<DbUserRow | null> {
  const p = getPool();
  if (!p) return null;
  const c = await p.connect();
  try {
    const r = await c.query<DbUserRow>(
      `SELECT id::text, phone_number, full_name, user_type::text, verification_status::text,
              rating_avg::text, rating_count, bio, business_profile_json
       FROM users WHERE id::text = $1 OR phone_number = $1 LIMIT 1`,
      [userId]
    );
    return r.rows[0] ?? null;
  } finally {
    c.release();
  }
}

export async function updateUserMe(
  phoneNumber: string,
  patch: { fullName?: string; bio?: string; businessProfile?: Record<string, unknown> | null }
): Promise<DbUserRow | null> {
  const p = getPool();
  if (!p) return null;
  if (
    patch.fullName === undefined &&
    patch.bio === undefined &&
    patch.businessProfile === undefined
  ) {
    return findUserByPhone(phoneNumber);
  }
  const c = await p.connect();
  try {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let n = 1;
    if (patch.fullName !== undefined) {
      sets.push(`full_name = $${n++}`);
      vals.push(patch.fullName);
    }
    if (patch.bio !== undefined) {
      sets.push(`bio = $${n++}`);
      vals.push(patch.bio);
    }
    if (patch.businessProfile !== undefined) {
      sets.push(`business_profile_json = $${n++}::jsonb`);
      vals.push(JSON.stringify(patch.businessProfile));
    }
    if (sets.length === 0) {
      return findUserByPhone(phoneNumber);
    }
    vals.push(phoneNumber);
    await c.query(
      `UPDATE users SET ${sets.join(", ")}, updated_at = NOW() WHERE phone_number = $${n}`,
      vals
    );
    return findUserByPhone(phoneNumber);
  } finally {
    c.release();
  }
}

export type ListingAppRow = {
  id: string;
  title: string;
  listing_type: string;
  price: string;
  status: string;
  created_at: Date;
};

export async function findListingsBySellerPhone(phoneNumber: string, limit: number): Promise<ListingAppRow[]> {
  const p = getPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<ListingAppRow>(
      `SELECT id::text, title, listing_type::text, price::text, status, created_at
       FROM listings_app
       WHERE user_id = $1 AND status NOT IN ('draft','banned')
       ORDER BY created_at DESC
       LIMIT $2`,
      [phoneNumber, limit]
    );
    return r.rows;
  } catch {
    return [];
  } finally {
    c.release();
  }
}

export type DbReviewRow = {
  id: string;
  reviewer_id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  seller_reply: string | null;
  created_at: Date;
};

export async function findReviewsByReviewedUserId(userUuid: string, limit: number): Promise<DbReviewRow[]> {
  const p = getPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<DbReviewRow>(
      `SELECT r.id::text, r.reviewer_id::text, u.full_name AS reviewer_name,
              r.rating, r.comment, r.seller_reply, r.created_at
       FROM reviews r
       LEFT JOIN users u ON u.id = r.reviewer_id
       WHERE r.reviewed_user_id = $1::uuid AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [userUuid, limit]
    );
    return r.rows;
  } catch {
    return [];
  } finally {
    c.release();
  }
}

export type DbPeerReviewRow = {
  id: string;
  reviewer_phone: string;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  seller_reply: string | null;
  created_at: Date;
};

export async function findPeerReviewsByReviewedUuid(userUuid: string, limit: number): Promise<DbPeerReviewRow[]> {
  const p = getPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<DbPeerReviewRow>(
      `SELECT pr.id::text, pr.reviewer_phone, u.full_name AS reviewer_name,
              pr.rating, pr.comment, pr.seller_reply, pr.created_at
       FROM app_peer_reviews pr
       LEFT JOIN users u ON u.phone_number = pr.reviewer_phone
       WHERE pr.reviewed_user_uuid = $1::uuid
       ORDER BY pr.created_at DESC
       LIMIT $2`,
      [userUuid, limit]
    );
    return r.rows;
  } catch {
    return [];
  } finally {
    c.release();
  }
}

export type UnifiedPublicReview = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  sellerReply: string | null;
  createdAt: string;
  source: "order" | "peer";
};

export async function listMergedUserReviews(userUuid: string, limit: number): Promise<UnifiedPublicReview[]> {
  const formal = await findReviewsByReviewedUserId(userUuid, limit);
  const peer = await findPeerReviewsByReviewedUuid(userUuid, limit);
  const merged: UnifiedPublicReview[] = [
    ...formal.map((r) => ({
      id: r.id,
      reviewerId: r.reviewer_id,
      reviewerName: r.reviewer_name ?? "Üye",
      rating: r.rating,
      comment: r.comment,
      sellerReply: r.seller_reply,
      createdAt: r.created_at.toISOString(),
      source: "order" as const
    })),
    ...peer.map((r) => ({
      id: r.id,
      reviewerId: r.reviewer_phone,
      reviewerName: r.reviewer_name ?? "Üye",
      rating: r.rating,
      comment: r.comment,
      sellerReply: r.seller_reply,
      createdAt: r.created_at.toISOString(),
      source: "peer" as const
    }))
  ];
  merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return merged.slice(0, limit);
}

export async function insertPeerReviewRow(
  reviewerPhone: string,
  reviewedUuid: string,
  listingId: string | undefined,
  rating: number,
  comment: string | undefined
): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const p = getPool();
  if (!p) return { ok: false, reason: "no_database" };
  const c = await p.connect();
  try {
    const r = await c.query<{ id: string }>(
      `INSERT INTO app_peer_reviews (reviewer_phone, reviewed_user_uuid, listing_id, rating, comment)
       VALUES ($1, $2::uuid, $3, $4, $5)
       RETURNING id::text`,
      [reviewerPhone, reviewedUuid, listingId ?? null, rating, comment ?? null]
    );
    return { ok: true, id: r.rows[0]?.id };
  } catch {
    return { ok: false, reason: "insert_failed" };
  } finally {
    c.release();
  }
}

export async function updatePeerReviewSellerReply(reviewId: string, sellerUserUuid: string, sellerReply: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    const r = await c.query(
      `UPDATE app_peer_reviews SET seller_reply = $3, updated_at = NOW()
       WHERE id = $1::uuid AND reviewed_user_uuid = $2::uuid`,
      [reviewId, sellerUserUuid, sellerReply]
    );
    return (r.rowCount ?? 0) > 0;
  } finally {
    c.release();
  }
}

export async function updateFormalReviewSellerReply(reviewId: string, sellerUserUuid: string, sellerReply: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    const r = await c.query(
      `UPDATE reviews SET seller_reply = $3, updated_at = NOW()
       WHERE id = $1::uuid AND reviewed_user_id = $2::uuid AND deleted_at IS NULL`,
      [reviewId, sellerUserUuid, sellerReply]
    );
    return (r.rowCount ?? 0) > 0;
  } catch {
    return false;
  } finally {
    c.release();
  }
}

export type DbFollowRow = {
  target_user_ref: string;
  created_at: Date;
};

export async function listFollowedUsers(followerPhone: string, limit: number): Promise<DbFollowRow[]> {
  const p = getPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<DbFollowRow>(
      `SELECT target_user_ref, created_at
       FROM app_user_follows
       WHERE follower_phone = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [followerPhone, limit]
    );
    return r.rows;
  } catch {
    return [];
  } finally {
    c.release();
  }
}

export async function isFollowingUser(followerPhone: string, targetUserRef: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    const r = await c.query<{ ok: number }>(
      `SELECT 1 as ok
       FROM app_user_follows
       WHERE follower_phone = $1 AND target_user_ref = $2
       LIMIT 1`,
      [followerPhone, targetUserRef]
    );
    return Boolean(r.rows[0]);
  } catch {
    return false;
  } finally {
    c.release();
  }
}

export async function followUser(followerPhone: string, targetUserRef: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    await c.query(
      `INSERT INTO app_user_follows (follower_phone, target_user_ref)
       VALUES ($1, $2)
       ON CONFLICT (follower_phone, target_user_ref) DO NOTHING`,
      [followerPhone, targetUserRef]
    );
    return true;
  } catch {
    return false;
  } finally {
    c.release();
  }
}

export async function unfollowUser(followerPhone: string, targetUserRef: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    await c.query(
      `DELETE FROM app_user_follows
       WHERE follower_phone = $1 AND target_user_ref = $2`,
      [followerPhone, targetUserRef]
    );
    return true;
  } catch {
    return false;
  } finally {
    c.release();
  }
}

export function toMePayload(row: DbUserRow) {
  const avg = Number.parseFloat(row.rating_avg) || 0;
  const bp =
    row.business_profile_json && typeof row.business_profile_json === "object"
      ? (row.business_profile_json as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    fullName: row.full_name,
    userType: row.user_type,
    verificationStatus: row.verification_status,
    ratingAvg: avg,
    ratingCount: row.rating_count,
    trustScore: trustFromRatings(avg, row.rating_count),
    bio: row.bio,
    businessProfile: bp
  };
}

export function toPublicProfile(row: DbUserRow) {
  const avg = Number.parseFloat(row.rating_avg) || 0;
  return {
    id: row.id,
    fullName: row.full_name,
    userType: row.user_type,
    verificationStatus: row.verification_status,
    ratingAvg: avg,
    ratingCount: row.rating_count,
    trustScore: trustFromRatings(avg, row.rating_count)
  };
}

export async function ensurePhoneVerificationStatus(phoneNumber: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  const c = await p.connect();
  try {
    await c.query(
      `UPDATE users SET verification_status = 'phone_verified', updated_at = NOW() WHERE phone_number = $1`,
      [phoneNumber]
    );
  } finally {
    c.release();
  }
}

export type UserDashboardStats = {
  totalSales: number;
  activeListings: number;
  soldListings: number;
  avgResponseMinutes: number;
};

export async function getUserDashboardStats(phoneNumber: string): Promise<UserDashboardStats> {
  const p = getPool();
  if (!p) {
    return { totalSales: 0, activeListings: 0, soldListings: 0, avgResponseMinutes: 0 };
  }
  const c = await p.connect();
  try {
    const listings = await c.query<{ active_count: string; sold_count: string }>(
      `SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::text AS active_count,
         SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END)::text AS sold_count
       FROM listings_app
       WHERE user_id = $1`,
      [phoneNumber]
    );
    const offers = await c.query<{ total_sales: string }>(
      `SELECT COALESCE(SUM(offered_price), 0)::text AS total_sales
       FROM app_offers
       WHERE seller_phone = $1 AND status = 'accepted'`,
      [phoneNumber]
    );
    const activeListings = Number.parseInt(listings.rows[0]?.active_count ?? "0", 10) || 0;
    const soldListings = Number.parseInt(listings.rows[0]?.sold_count ?? "0", 10) || 0;
    const totalSales = Number.parseFloat(offers.rows[0]?.total_sales ?? "0") || 0;
    const avgResponseMinutes = Math.max(5, Math.round(90 - Math.min(80, soldListings * 3 + activeListings)));
    return { totalSales, activeListings, soldListings, avgResponseMinutes };
  } catch {
    return { totalSales: 0, activeListings: 0, soldListings: 0, avgResponseMinutes: 0 };
  } finally {
    c.release();
  }
}

export type VerificationKind = "national_id" | "tax_number" | "agricultural_registry";

export type VerificationSummary = {
  phone: "approved" | "pending" | "none";
  nationalId: "approved" | "pending" | "rejected" | "none";
  taxNumber: "approved" | "pending" | "rejected" | "none";
  agriculturalId: "approved" | "pending" | "rejected" | "none";
  reapplyCooldownHours?: number;
  nationalIdReapplyAt?: string | null;
  taxNumberReapplyAt?: string | null;
  agriculturalIdReapplyAt?: string | null;
};

function verificationCooldownHours(): number {
  const raw = Number(process.env.VERIFICATION_REAPPLY_COOLDOWN_HOURS || 72);
  if (!Number.isFinite(raw) || raw <= 0) return 72;
  return Math.min(24 * 30, Math.floor(raw));
}

export type PendingVerificationRow = {
  id: string;
  user_id: string;
  phone_number: string;
  full_name: string;
  verification_type: VerificationKind;
  document_url: string | null;
  created_at: Date;
};

export type VerificationHistoryRow = {
  id: string;
  user_id: string;
  phone_number: string;
  full_name: string;
  verification_type: VerificationKind;
  status: "approved" | "rejected";
  document_url: string | null;
  verified_by: string | null;
  verified_at: Date | null;
  created_at: Date;
};

export type VerificationAdminAuditRow = {
  id: string;
  admin_id: string;
  action: string;
  decision: "approved" | "rejected" | null;
  atomic: boolean | null;
  request_id: string | null;
  requested_count: number | null;
  processed_count: number | null;
  failed_count: number | null;
  reason_counts: unknown | null;
  meta: unknown | null;
  created_at: Date;
};

export async function addVerificationRequest(
  phoneNumber: string,
  kind: VerificationKind,
  documentUrl?: string
): Promise<{ ok: boolean; reason?: string }> {
  const p = getPool();
  if (!p) return { ok: false, reason: "no_database" };
  const user = await findUserByPhone(phoneNumber);
  if (!user) return { ok: false, reason: "user_not_found" };
  const c = await p.connect();
  try {
    const cooldownHours = verificationCooldownHours();
    const last = await c.query<{ status: "pending" | "approved" | "rejected"; updated_at: Date }>(
      `SELECT status::text, updated_at
       FROM user_verifications
       WHERE user_id = $1::uuid AND verification_type = $2::verification_type
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, kind]
    );
    const lastRow = last.rows[0];
    if (lastRow?.status === "rejected") {
      const nextAt = new Date(lastRow.updated_at.getTime() + cooldownHours * 60 * 60 * 1000);
      if (nextAt.getTime() > Date.now()) {
        return { ok: false, reason: `cooldown:${nextAt.toISOString()}` };
      }
    }

    await c.query(
      `INSERT INTO user_verifications (user_id, verification_type, document_url, status)
       VALUES ($1::uuid, $2::verification_type, $3, 'pending')`,
      [user.id, kind, documentUrl?.trim() || null]
    );
    return { ok: true };
  } catch {
    return { ok: false, reason: "insert_failed" };
  } finally {
    c.release();
  }
}

export async function getVerificationSummary(phoneNumber: string): Promise<VerificationSummary | null> {
  const p = getPool();
  if (!p) return null;
  const user = await findUserByPhone(phoneNumber);
  if (!user) return null;
  const c = await p.connect();
  try {
    const phoneStatus: VerificationSummary["phone"] =
      user.verification_status === "phone_verified" || user.verification_status === "id_verified" || user.verification_status === "business_verified"
        ? "approved"
        : "none";

    const r = await c.query<{
      verification_type: "national_id" | "tax_number" | "agricultural_registry";
      status: "pending" | "approved" | "rejected";
      updated_at: Date;
    }>(
      `SELECT DISTINCT ON (verification_type)
          verification_type::text, status::text, updated_at
       FROM user_verifications
       WHERE user_id = $1::uuid
       ORDER BY verification_type, created_at DESC`,
      [user.id]
    );
    const out: VerificationSummary = {
      phone: phoneStatus,
      nationalId: "none",
      taxNumber: "none",
      agriculturalId: "none",
      reapplyCooldownHours: verificationCooldownHours(),
      nationalIdReapplyAt: null,
      taxNumberReapplyAt: null,
      agriculturalIdReapplyAt: null
    };
    const cooldownHours = verificationCooldownHours();
    for (const row of r.rows) {
      const reapplyAt =
        row.status === "rejected" ? new Date(row.updated_at.getTime() + cooldownHours * 60 * 60 * 1000).toISOString() : null;
      if (row.verification_type === "national_id") {
        out.nationalId = row.status;
        out.nationalIdReapplyAt = reapplyAt;
      }
      if (row.verification_type === "tax_number") {
        out.taxNumber = row.status;
        out.taxNumberReapplyAt = reapplyAt;
      }
      if (row.verification_type === "agricultural_registry") {
        out.agriculturalId = row.status;
        out.agriculturalIdReapplyAt = reapplyAt;
      }
    }
    return out;
  } catch {
    return null;
  } finally {
    c.release();
  }
}

export async function listPendingVerificationRequests(limit: number, offset = 0): Promise<PendingVerificationRow[]> {
  const p = getPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<PendingVerificationRow>(
      `SELECT uv.id::text, uv.user_id::text, u.phone_number, u.full_name, uv.document_url,
              uv.verification_type::text, uv.created_at
       FROM user_verifications uv
       JOIN users u ON u.id = uv.user_id
       WHERE uv.status = 'pending'
       ORDER BY uv.created_at ASC
       OFFSET $1
       LIMIT $2`,
      [Math.max(0, Math.floor(offset)), limit]
    );
    return r.rows;
  } catch {
    return [];
  } finally {
    c.release();
  }
}

export async function decideVerificationRequest(
  requestId: string,
  decision: "approved" | "rejected",
  reviewerId?: string
): Promise<{ ok: boolean; reason?: string }> {
  const p = getPool();
  if (!p) return { ok: false, reason: "no_database" };
  const c = await p.connect();
  try {
    return await applyVerificationDecisionTx(c, requestId, decision, reviewerId);
  } catch {
    return { ok: false, reason: "update_failed" };
  } finally {
    c.release();
  }
}

async function applyVerificationDecisionTx(
  c: pg.PoolClient,
  requestId: string,
  decision: "approved" | "rejected",
  reviewerId?: string
): Promise<{ ok: boolean; reason?: string }> {
  const cur = await c.query<{
    user_id: string;
    verification_type: VerificationKind;
    status: "pending" | "approved" | "rejected";
  }>(
    `SELECT user_id::text, verification_type::text, status::text
     FROM user_verifications
     WHERE id = $1::uuid
     LIMIT 1`,
    [requestId]
  );
  const row = cur.rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "pending") return { ok: false, reason: "already_decided" };

  await c.query(
    `UPDATE user_verifications
     SET status = $2::verification_decision,
         verified_at = NOW(),
         verified_by = CASE WHEN $3::text IS NULL OR $3::text = '' THEN NULL ELSE $3::uuid END,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [requestId, decision, reviewerId ?? null]
  );

  if (decision === "approved") {
    if (row.verification_type === "national_id") {
      await c.query(
        `UPDATE users
         SET verification_status = 'id_verified', updated_at = NOW()
         WHERE id = $1::uuid
           AND verification_status IN ('pending','phone_verified')`,
        [row.user_id]
      );
    } else {
      await c.query(
        `UPDATE users
         SET verification_status = 'business_verified', updated_at = NOW()
         WHERE id = $1::uuid
           AND verification_status IN ('pending','phone_verified','id_verified')`,
        [row.user_id]
      );
    }
  }
  return { ok: true };
}

export async function decideVerificationRequestsBulk(
  requestIds: string[],
  decision: "approved" | "rejected",
  reviewerId?: string,
  opts?: { atomic?: boolean }
): Promise<{
  ok: boolean;
  processed: number;
  failed: number;
  failedIds: string[];
  reasonCounts: Record<string, number>;
}> {
  const p = getPool();
  if (!p) return { ok: false, processed: 0, failed: requestIds.length, failedIds: [...requestIds], reasonCounts: { no_database: requestIds.length } };
  const ids = Array.from(new Set(requestIds.map((x) => x.trim()).filter(Boolean)));
  if (ids.length === 0) return { ok: true, processed: 0, failed: 0, failedIds: [], reasonCounts: {} };
  const atomic = Boolean(opts?.atomic);
  const c = await p.connect();
  let processed = 0;
  const failedIds: string[] = [];
  const reasonCounts: Record<string, number> = {};
  try {
    if (atomic) await c.query("BEGIN");
    for (const requestId of ids) {
      const out = await applyVerificationDecisionTx(c, requestId, decision, reviewerId);
      if (out.ok) processed += 1;
      else {
        failedIds.push(requestId);
        const reason = out.reason || "unknown";
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        if (atomic) {
          await c.query("ROLLBACK");
          return { ok: false, processed: 0, failed: ids.length, failedIds: ids, reasonCounts: { atomic_rollback: ids.length } };
        }
      }
    }
    if (atomic) await c.query("COMMIT");
  } catch {
    if (atomic) {
      try {
        await c.query("ROLLBACK");
      } catch {
        /* ignore */
      }
    }
    return { ok: false, processed, failed: ids.length, failedIds: ids, reasonCounts: { update_failed: ids.length } };
  } finally {
    c.release();
  }
  return { ok: failedIds.length === 0, processed, failed: failedIds.length, failedIds, reasonCounts };
}

export async function listRecentVerificationDecisions(
  limit: number,
  offset = 0,
  filters?: {
    decision?: "approved" | "rejected";
    verificationType?: VerificationKind;
    withinHours?: number;
  }
): Promise<VerificationHistoryRow[]> {
  const p = getPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const wheres: string[] = ["uv.status IN ('approved','rejected')"];
    const values: Array<string | number> = [];

    if (filters?.decision === "approved" || filters?.decision === "rejected") {
      values.push(filters.decision);
      wheres.push(`uv.status = $${values.length}::verification_decision`);
    }
    if (
      filters?.verificationType === "national_id" ||
      filters?.verificationType === "tax_number" ||
      filters?.verificationType === "agricultural_registry"
    ) {
      values.push(filters.verificationType);
      wheres.push(`uv.verification_type = $${values.length}::verification_type`);
    }
    if (typeof filters?.withinHours === "number" && Number.isFinite(filters.withinHours) && filters.withinHours > 0) {
      values.push(Math.floor(filters.withinHours));
      wheres.push(`uv.verified_at >= NOW() - (($${values.length}::int || ' hours')::interval)`);
    }

    values.push(Math.max(0, Math.floor(offset)));
    const offsetIdx = values.length;
    values.push(limit);
    const limitIdx = values.length;
    const r = await c.query<VerificationHistoryRow>(
      `SELECT uv.id::text, uv.user_id::text, u.phone_number, u.full_name,
              uv.verification_type::text, uv.status::text, uv.document_url,
              CASE WHEN uv.verified_by IS NULL THEN NULL ELSE uv.verified_by::text END AS verified_by,
              uv.verified_at, uv.created_at
       FROM user_verifications uv
       JOIN users u ON u.id = uv.user_id
       WHERE ${wheres.join(" AND ")}
       ORDER BY uv.verified_at DESC NULLS LAST, uv.updated_at DESC
       OFFSET $${offsetIdx}
       LIMIT $${limitIdx}`,
      values
    );
    return r.rows;
  } catch {
    return [];
  } finally {
    c.release();
  }
}

export async function insertVerificationAdminAuditLog(input: {
  adminId: string;
  action: "decision_single" | "decision_bulk";
  decision?: "approved" | "rejected";
  atomic?: boolean;
  requestId?: string;
  requestedCount?: number;
  processedCount?: number;
  failedCount?: number;
  reasonCounts?: Record<string, number>;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const p = getPool();
  if (!p) return;
  const c = await p.connect();
  try {
    await c.query(
      `INSERT INTO verification_admin_audit_logs
       (admin_id, action, decision, atomic, request_id, requested_count, processed_count, failed_count, reason_counts, meta)
       VALUES ($1, $2, $3::verification_decision, $4, $5::uuid, $6, $7, $8, $9::jsonb, $10::jsonb)`,
      [
        input.adminId,
        input.action,
        input.decision ?? null,
        input.atomic ?? null,
        input.requestId ?? null,
        input.requestedCount ?? null,
        input.processedCount ?? null,
        input.failedCount ?? null,
        input.reasonCounts ? JSON.stringify(input.reasonCounts) : null,
        input.meta ? JSON.stringify(input.meta) : null
      ]
    );
  } catch {
    /* best effort */
  } finally {
    c.release();
  }
}

export async function listVerificationAdminAuditLogs(
  limit: number,
  offset = 0,
  filters?: {
    action?: "decision_single" | "decision_bulk";
    decision?: "approved" | "rejected";
    adminId?: string;
    withinHours?: number;
  }
): Promise<VerificationAdminAuditRow[]> {
  const p = getPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const wheres: string[] = ["1=1"];
    const values: Array<string | number> = [];
    if (filters?.action === "decision_single" || filters?.action === "decision_bulk") {
      values.push(filters.action);
      wheres.push(`action = $${values.length}`);
    }
    if (filters?.decision === "approved" || filters?.decision === "rejected") {
      values.push(filters.decision);
      wheres.push(`decision = $${values.length}::verification_decision`);
    }
    if (filters?.adminId?.trim()) {
      values.push(filters.adminId.trim());
      wheres.push(`admin_id = $${values.length}`);
    }
    if (typeof filters?.withinHours === "number" && Number.isFinite(filters.withinHours) && filters.withinHours > 0) {
      values.push(Math.floor(filters.withinHours));
      wheres.push(`created_at >= NOW() - (($${values.length}::int || ' hours')::interval)`);
    }
    values.push(Math.max(0, Math.floor(offset)));
    const offsetIdx = values.length;
    values.push(limit);
    const limitIdx = values.length;
    const r = await c.query<VerificationAdminAuditRow>(
      `SELECT id::text, admin_id, action, decision::text, atomic, request_id::text,
              requested_count, processed_count, failed_count, reason_counts, meta, created_at
       FROM verification_admin_audit_logs
       WHERE ${wheres.join(" AND ")}
       ORDER BY created_at DESC
       OFFSET $${offsetIdx}
       LIMIT $${limitIdx}`,
      values
    );
    return r.rows;
  } catch {
    return [];
  } finally {
    c.release();
  }
}

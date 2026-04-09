import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  addVerificationRequest,
  decideVerificationRequest,
  decideVerificationRequestsBulk,
  ensurePhoneVerificationStatus,
  getVerificationSummary,
  insertVerificationAdminAuditLog,
  isDatabaseConfigured,
  listVerificationAdminAuditLogs,
  listRecentVerificationDecisions,
  listPendingVerificationRequests
} from "../../infrastructure/db/userPg";
import { saveVerificationInlineDocument } from "../../infrastructure/storage/verificationDocuments";

const router: Router = Router();
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.ADMIN_VERIFICATION_RATE_LIMIT || 120),
  standardHeaders: true,
  legacyHeaders: false
});

function phoneFromReq(req: Request): string | null {
  const u = req.header("x-user-id");
  if (!u || u === "anonymous") return null;
  return u;
}

function adminFromReq(req: Request): string | null {
  const allowlistRaw = process.env.ADMIN_IP_ALLOWLIST?.trim();
  if (allowlistRaw) {
    const allowlist = allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const forwarded = String(req.header("x-forwarded-for") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const remote = req.socket.remoteAddress?.trim();
    const candidates = [...forwarded, ...(remote ? [remote] : [])];
    const pass = candidates.some((ip) => allowlist.includes(ip));
    if (!pass) return null;
  }

  const auth = req.header("authorization");
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (auth?.startsWith("Bearer ") && jwtSecret) {
    try {
      const issuer = process.env.ADMIN_JWT_ISSUER?.trim() || undefined;
      const audience = process.env.ADMIN_JWT_AUDIENCE?.trim() || undefined;
      const payload = jwt.verify(auth.slice("Bearer ".length).trim(), jwtSecret, {
        issuer,
        audience
      }) as jwt.JwtPayload;
      const requiredRole = (process.env.ADMIN_JWT_ROLE || "admin").trim();
      const role = typeof payload.role === "string" ? payload.role.trim() : "";
      if (role && role === requiredRole) {
        const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
        return sub || "admin-jwt";
      }
    } catch {
      /* ignore and fallback */
    }
  }

  const legacyEnabled = String(process.env.ADMIN_LEGACY_TOKEN_ENABLED || "1").trim() !== "0";
  if (!legacyEnabled) return null;

  const adminId = req.header("x-admin-id")?.trim() || "";
  const token = req.header("x-admin-token")?.trim() || "";
  const expected = process.env.ADMIN_TOKEN?.trim() || "";
  if (!expected || token !== expected) return null;
  return adminId || "admin";
}

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected"])
});
const bulkDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  atomic: z.boolean().optional()
});
const documentSchema = z.object({
  documentUrl: z.string().url().max(2000)
});
const inlineDocumentSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120).optional(),
  base64: z.string().min(24).max(2_000_000)
});
const ALLOWED_INLINE_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_INLINE_BYTES = 5 * 1024 * 1024;

function cooldownResponse(reason?: string): { message: string; reapplyAt: string } | null {
  if (!reason?.startsWith("cooldown:")) return null;
  const reapplyAt = reason.slice("cooldown:".length);
  const when = new Date(reapplyAt);
  const label = Number.isFinite(when.getTime()) ? when.toISOString() : reapplyAt;
  return { message: `Tekrar basvuru suresi dolmadi. Yeniden basvuru zamani: ${label}`, reapplyAt };
}

function normalizeMime(mt?: string): string {
  return (mt || "").trim().toLowerCase();
}

function estimateBase64Bytes(base64: string): number {
  const clean = base64.replace(/\s+/g, "");
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - pad;
}

router.get("/summary", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  if (!isDatabaseConfigured()) {
    return res.json({
      persisted: false,
      phone: "none",
      nationalId: "none",
      taxNumber: "none",
      agriculturalId: "none"
    });
  }
  const s = await getVerificationSummary(phone);
  if (!s) {
    return res.json({
      persisted: false,
      phone: "none",
      nationalId: "none",
      taxNumber: "none",
      agriculturalId: "none"
    });
  }
  return res.json({ persisted: true, ...s });
});

router.post("/phone", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  if (!isDatabaseConfigured()) {
    return res.status(200).json({ status: "phone_verified", persisted: false });
  }
  await ensurePhoneVerificationStatus(phone);
  return res.status(200).json({ status: "phone_verified", persisted: true });
});

router.post("/national-id", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  if (!isDatabaseConfigured()) {
    return res.status(202).json({ status: "pending", persisted: false });
  }
  const r = await addVerificationRequest(phone, "national_id");
  {
    const cd = cooldownResponse(r.reason);
    if (cd) return res.status(409).json(cd);
  }
  if (r.reason === "user_not_found") return res.status(404).json({ message: "User not found" });
  if (!r.ok) return res.status(503).json({ message: "Verification request failed" });
  return res.status(202).json({ status: "pending", persisted: true });
});

router.post("/tax-number", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  if (!isDatabaseConfigured()) {
    return res.status(202).json({ status: "pending", persisted: false });
  }
  const r = await addVerificationRequest(phone, "tax_number");
  {
    const cd = cooldownResponse(r.reason);
    if (cd) return res.status(409).json(cd);
  }
  if (r.reason === "user_not_found") return res.status(404).json({ message: "User not found" });
  if (!r.ok) return res.status(503).json({ message: "Verification request failed" });
  return res.status(202).json({ status: "pending", persisted: true });
});

router.post("/agricultural-id", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  if (!isDatabaseConfigured()) {
    return res.status(202).json({ status: "pending", persisted: false });
  }
  const r = await addVerificationRequest(phone, "agricultural_registry");
  {
    const cd = cooldownResponse(r.reason);
    if (cd) return res.status(409).json(cd);
  }
  if (r.reason === "user_not_found") return res.status(404).json({ message: "User not found" });
  if (!r.ok) return res.status(503).json({ message: "Verification request failed" });
  return res.status(202).json({ status: "pending", persisted: true });
});

router.post("/:kind/document", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  const k = req.params.kind?.trim();
  const kind =
    k === "national-id" ? "national_id" : k === "tax-number" ? "tax_number" : k === "agricultural-id" ? "agricultural_registry" : null;
  if (!kind) return res.status(400).json({ message: "Invalid verification kind" });
  const parsed = documentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  if (!isDatabaseConfigured()) return res.status(202).json({ status: "pending", persisted: false });
  const r = await addVerificationRequest(phone, kind, parsed.data.documentUrl);
  {
    const cd = cooldownResponse(r.reason);
    if (cd) return res.status(409).json(cd);
  }
  if (r.reason === "user_not_found") return res.status(404).json({ message: "User not found" });
  if (!r.ok) return res.status(503).json({ message: "Verification request failed" });
  return res.status(202).json({ status: "pending", persisted: true, document: "received" });
});

router.post("/:kind/document-inline", async (req: Request, res: Response) => {
  const phone = phoneFromReq(req);
  if (!phone) return res.status(401).json({ message: "x-user-id required" });
  const k = req.params.kind?.trim();
  const kind =
    k === "national-id" ? "national_id" : k === "tax-number" ? "tax_number" : k === "agricultural-id" ? "agricultural_registry" : null;
  if (!kind) return res.status(400).json({ message: "Invalid verification kind" });
  const parsed = inlineDocumentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  if (!isDatabaseConfigured()) return res.status(202).json({ status: "pending", persisted: false });
  const mt = normalizeMime(parsed.data.mimeType);
  if (!ALLOWED_INLINE_MIME.has(mt)) {
    return res.status(400).json({ message: "Unsupported mime type. Allowed: application/pdf, image/png, image/jpeg, image/webp" });
  }
  const base64 = parsed.data.base64.trim();
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) {
    return res.status(400).json({ message: "Invalid base64 payload" });
  }
  const estimated = estimateBase64Bytes(base64);
  if (estimated > MAX_INLINE_BYTES) {
    return res.status(413).json({ message: "Document too large. Max 5MB" });
  }
  const saved = await saveVerificationInlineDocument({ base64, mimeType: mt });
  const r = await addVerificationRequest(phone, kind, saved.relUrl);
  {
    const cd = cooldownResponse(r.reason);
    if (cd) return res.status(409).json(cd);
  }
  if (r.reason === "user_not_found") return res.status(404).json({ message: "User not found" });
  if (!r.ok) return res.status(503).json({ message: "Verification request failed" });
  return res.status(202).json({
    status: "pending",
    persisted: true,
    document: "received",
    fileName: parsed.data.fileName,
    documentUrl: saved.relUrl
  });
});

router.get("/admin/pending", async (req: Request, res: Response) => {
  adminLimiter(req, res, async () => {
  const admin = adminFromReq(req);
  if (!admin) return res.status(401).json({ message: "admin auth required" });
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  if (!isDatabaseConfigured()) return res.json({ data: [], persisted: false });
  const rows = await listPendingVerificationRequests(limit, offset);
  return res.json({
    persisted: true,
    admin,
    pagination: { limit, offset, count: rows.length, hasMore: rows.length === limit },
    data: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      phoneNumber: r.phone_number,
      fullName: r.full_name,
      verificationType: r.verification_type,
      documentUrl: r.document_url ?? null,
      hasDocument: Boolean(r.document_url),
      createdAt: r.created_at.toISOString()
    }))
  });
  });
});

router.post("/admin/:requestId/decision", async (req: Request, res: Response) => {
  adminLimiter(req, res, async () => {
  const admin = adminFromReq(req);
  if (!admin) return res.status(401).json({ message: "admin auth required" });
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  if (!isDatabaseConfigured()) return res.status(503).json({ message: "Database not configured" });
  const out = await decideVerificationRequest(req.params.requestId, parsed.data.decision, admin);
  if (out.reason === "not_found") return res.status(404).json({ message: "Request not found" });
  if (out.reason === "already_decided") return res.status(409).json({ message: "Request already decided" });
  if (!out.ok) return res.status(503).json({ message: "Decision could not be saved" });
  await insertVerificationAdminAuditLog({
    adminId: admin,
    action: "decision_single",
    decision: parsed.data.decision,
    requestId: req.params.requestId,
    requestedCount: 1,
    processedCount: 1,
    failedCount: 0
  });
  console.log(
    JSON.stringify({
      event: "verification_admin_decision",
      admin,
      decision: parsed.data.decision,
      requestId: req.params.requestId,
      ok: true,
      at: new Date().toISOString()
    })
  );
  return res.json({ ok: true, by: admin, decision: parsed.data.decision });
  });
});

router.post("/admin/decisions-bulk", async (req: Request, res: Response) => {
  adminLimiter(req, res, async () => {
  const admin = adminFromReq(req);
  if (!admin) return res.status(401).json({ message: "admin auth required" });
  const parsed = bulkDecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  if (!isDatabaseConfigured()) return res.status(503).json({ message: "Database not configured" });
  const atomic = Boolean(parsed.data.atomic);
  const out = await decideVerificationRequestsBulk(parsed.data.ids, parsed.data.decision, admin, { atomic });
  await insertVerificationAdminAuditLog({
    adminId: admin,
    action: "decision_bulk",
    decision: parsed.data.decision,
    atomic,
    requestedCount: parsed.data.ids.length,
    processedCount: out.processed,
    failedCount: out.failed,
    reasonCounts: out.reasonCounts
  });
  console.log(
    JSON.stringify({
      event: "verification_admin_bulk_decision",
      admin,
      decision: parsed.data.decision,
      atomic,
      requested: parsed.data.ids.length,
      processed: out.processed,
      failed: out.failed,
      reasonCounts: out.reasonCounts,
      at: new Date().toISOString()
    })
  );
  return res.json({
    ok: out.ok,
    by: admin,
    decision: parsed.data.decision,
    atomic,
    processed: out.processed,
    failed: out.failed,
    failedIds: out.failedIds,
    reasonCounts: out.reasonCounts
  });
  });
});

router.get("/admin/audit-logs", async (req: Request, res: Response) => {
  adminLimiter(req, res, async () => {
    const admin = adminFromReq(req);
    if (!admin) return res.status(401).json({ message: "admin auth required" });
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const actionRaw = String(req.query.action || "").trim();
    const action = actionRaw === "decision_single" || actionRaw === "decision_bulk" ? actionRaw : undefined;
    const decisionRaw = String(req.query.decision || "").trim();
    const decision = decisionRaw === "approved" || decisionRaw === "rejected" ? decisionRaw : undefined;
    const adminId = String(req.query.adminId || "").trim() || undefined;
    const withinHoursNum = Number(req.query.withinHours);
    const withinHours =
      Number.isFinite(withinHoursNum) && withinHoursNum > 0 ? Math.min(24 * 30, Math.floor(withinHoursNum)) : undefined;
    if (!isDatabaseConfigured()) return res.json({ data: [], persisted: false });
    const rows = await listVerificationAdminAuditLogs(limit, offset, { action, decision, adminId, withinHours });
    return res.json({
      persisted: true,
      admin,
      pagination: { limit, offset, count: rows.length, hasMore: rows.length === limit },
      filters: {
        action: action ?? null,
        decision: decision ?? null,
        adminId: adminId ?? null,
        withinHours: withinHours ?? null
      },
      data: rows.map((r) => ({
        id: r.id,
        adminId: r.admin_id,
        action: r.action,
        decision: r.decision ?? null,
        atomic: r.atomic ?? null,
        requestId: r.request_id ?? null,
        requestedCount: r.requested_count ?? null,
        processedCount: r.processed_count ?? null,
        failedCount: r.failed_count ?? null,
        reasonCounts: r.reason_counts ?? null,
        meta: r.meta ?? null,
        createdAt: r.created_at.toISOString()
      }))
    });
  });
});

router.get("/admin/history", async (req: Request, res: Response) => {
  adminLimiter(req, res, async () => {
  const admin = adminFromReq(req);
  if (!admin) return res.status(401).json({ message: "admin auth required" });
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const decisionRaw = String(req.query.decision || "").trim();
  const decision = decisionRaw === "approved" || decisionRaw === "rejected" ? decisionRaw : undefined;
  const typeRaw = String(req.query.verificationType || "").trim();
  const verificationType =
    typeRaw === "national_id" || typeRaw === "tax_number" || typeRaw === "agricultural_registry" ? typeRaw : undefined;
  const withinHoursNum = Number(req.query.withinHours);
  const withinHours =
    Number.isFinite(withinHoursNum) && withinHoursNum > 0 ? Math.min(24 * 30, Math.floor(withinHoursNum)) : undefined;
  if (!isDatabaseConfigured()) return res.json({ data: [], persisted: false });
  const rows = await listRecentVerificationDecisions(limit, offset, { decision, verificationType, withinHours });
  return res.json({
    persisted: true,
    admin,
    pagination: { limit, offset, count: rows.length, hasMore: rows.length === limit },
    filters: { decision: decision ?? null, verificationType: verificationType ?? null, withinHours: withinHours ?? null },
    data: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      phoneNumber: r.phone_number,
      fullName: r.full_name,
      verificationType: r.verification_type,
      decision: r.status,
      verifiedBy: r.verified_by ?? null,
      verifiedAt: r.verified_at ? r.verified_at.toISOString() : null,
      documentUrl: r.document_url ?? null,
      hasDocument: Boolean(r.document_url),
      createdAt: r.created_at.toISOString()
    }))
  });
  });
});

export default router;

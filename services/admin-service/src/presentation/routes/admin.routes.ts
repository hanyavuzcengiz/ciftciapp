import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";

const router: Router = Router();

type AuditEntry = { id: string; action: string; actor: string; payload: Record<string, unknown>; createdAt: string };
const auditLog: AuditEntry[] = [];
let auditSeq = 1;

type ReportRow = { id: string; type: string; contentId: string; status: "pending" | "reviewed" | "resolved"; createdAt: string };
const reports: ReportRow[] = [
  { id: "rep_1", type: "listing", contentId: "lst_demo", status: "pending", createdAt: new Date().toISOString() }
];
let repSeq = 2;

type DisputeRow = { id: string; orderId: string; status: "open" | "resolved"; createdAt: string };
const disputes: DisputeRow[] = [];
let dispSeq = 1;

const bannedUsers = new Set<string>();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_API_KEY ?? "dev-admin-key";
  if (req.header("x-admin-key") !== expected) {
    res.status(403).json({ message: "Invalid admin key" });
    return;
  }
  next();
}

router.use(requireAdmin);

router.get("/stats", (_req: Request, res: Response) => {
  res.json({
    pendingReports: reports.filter((r) => r.status === "pending").length,
    openDisputes: disputes.filter((d) => d.status === "open").length,
    bannedUsers: bannedUsers.size,
    auditEntries: auditLog.length
  });
});

router.get("/reports", (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  let rows = reports;
  if (status) rows = rows.filter((r) => r.status === status);
  res.json({ data: rows });
});

const resolveSchema = z.object({ status: z.enum(["reviewed", "resolved"]) });

router.put("/reports/:id", (req: Request, res: Response) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const row = reports.find((r) => r.id === req.params.id);
  if (!row) return res.status(404).json({ message: "Not found" });
  row.status = parsed.data.status;
  auditLog.unshift({
    id: `aud_${auditSeq++}`,
    action: "report_status",
    actor: "admin",
    payload: { reportId: row.id, status: row.status },
    createdAt: new Date().toISOString()
  });
  res.json(row);
});

router.get("/audit-logs", (_req: Request, res: Response) => {
  res.json({ immutable: true, data: auditLog.slice(0, 500) });
});

const banSchema = z.object({ reason: z.string().optional() });

router.post("/users/:id/ban", (req: Request, res: Response) => {
  banSchema.safeParse(req.body);
  bannedUsers.add(req.params.id);
  auditLog.unshift({
    id: `aud_${auditSeq++}`,
    action: "user_ban",
    actor: "admin",
    payload: { userId: req.params.id },
    createdAt: new Date().toISOString()
  });
  res.status(201).json({ userId: req.params.id, banned: true });
});

router.post("/users/:id/unban", (req: Request, res: Response) => {
  bannedUsers.delete(req.params.id);
  auditLog.unshift({
    id: `aud_${auditSeq++}`,
    action: "user_unban",
    actor: "admin",
    payload: { userId: req.params.id },
    createdAt: new Date().toISOString()
  });
  res.json({ userId: req.params.id, banned: false });
});

const disputeSchema = z.object({ order_id: z.string().min(1) });

router.post("/disputes", (req: Request, res: Response) => {
  const parsed = disputeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const row: DisputeRow = {
    id: `dsp_${dispSeq++}`,
    orderId: parsed.data.order_id,
    status: "open",
    createdAt: new Date().toISOString()
  };
  disputes.push(row);
  res.status(201).json(row);
});

router.put("/disputes/:id/resolve", (req: Request, res: Response) => {
  const row = disputes.find((d) => d.id === req.params.id);
  if (!row) return res.status(404).json({ message: "Not found" });
  row.status = "resolved";
  auditLog.unshift({
    id: `aud_${auditSeq++}`,
    action: "dispute_resolved",
    actor: "admin",
    payload: { disputeId: row.id },
    createdAt: new Date().toISOString()
  });
  res.json(row);
});

export default router;

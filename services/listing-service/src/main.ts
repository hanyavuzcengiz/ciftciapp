import "dotenv/config";
import crypto from "node:crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import compression from "compression";
import cors from "cors";
import type { CorsOptions } from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { Listing as DbListing } from "@prisma/client";
import { scheduleListingSearchSync } from "./elasticsearch";
import { resolveAuthorUuidByPhone } from "./resolveAuthor";
import { decodeCursor, encodeCursor, isPubliclyVisible } from "./listingUtils";

type ListingStatus = "draft" | "active" | "paused" | "sold" | "expired" | "banned";
type ListingType = "sell" | "buy" | "rent" | "service";
type Listing = {
  id: string;
  userId: string;
  authorUuid: string | null;
  title: string;
  description: string;
  listingType: ListingType;
  price: number;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
  categorySlug?: "traktor" | "tohum" | "gubre" | "hayvancilik";
  condition?: "new" | "second_hand" | "organic";
  city?: string;
  district?: string;
  lat?: number;
  lng?: number;
  images?: string[];
  attributes?: Record<string, string | number | boolean>;
};

type ListingMeta = {
  categorySlug?: "traktor" | "tohum" | "gubre" | "hayvancilik";
  condition?: "new" | "second_hand" | "organic";
  city?: string;
  district?: string;
  lat?: number;
  lng?: number;
  images: string[];
  attributes: Record<string, string | number | boolean>;
};
type CategorySpecField = {
  key: string;
  label: string;
  type: "text" | "number";
  required: boolean;
};

function corsOrigin(): CorsOptions["origin"] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw === "*") return true;
  const list = raw?.split(",").map((s) => s.trim()).filter(Boolean);
  if (list?.length) return list;
  return ["exp://localhost:8081", "http://localhost:8081"];
}

function toApi(row: DbListing): Listing {
  const meta = listingMetaStore.get(row.id);
  return {
    id: row.id,
    userId: row.userId,
    authorUuid: row.authorUuid ?? null,
    title: row.title,
    description: row.description,
    listingType: row.listingType as ListingType,
    price: Number(row.price),
    status: row.status as ListingStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    categorySlug: meta?.categorySlug,
    condition: meta?.condition,
    city: meta?.city,
    district: meta?.district,
    lat: meta?.lat,
    lng: meta?.lng,
    images: meta?.images ?? [],
    attributes: (row.attributesJson as Record<string, string | number | boolean> | null) ?? meta?.attributes ?? {}
  };
}

function canViewListing(row: DbListing, viewer: string): boolean {
  if (!isPubliclyVisible(row.status)) return row.status === "draft" && row.userId === viewer;
  return true;
}

type HttpRequestWithId = Request & { serviceRequestId: string };

const app = express();
app.use(helmet());
app.use(compression());
app.use(cors({ origin: corsOrigin() }));
app.use(express.json({ limit: "2mb" }));

function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id")?.trim();
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  (req as HttpRequestWithId).serviceRequestId = id;
  res.setHeader("x-request-id", id);
  next();
}

function structuredAccessLog(req: Request, res: Response, next: NextFunction): void {
  if (String(process.env.LISTING_SERVICE_STRUCTURED_ACCESS_LOG ?? "").trim() !== "1") {
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
        svc: "listing-service",
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

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 100 }));

const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10 });
const listingMetaStore = new Map<string, ListingMeta>();

const conditionSchema = z.enum(["new", "second_hand", "organic"]).optional();
const categorySlugSchema = z.enum(["traktor", "tohum", "gubre", "hayvancilik"]).optional();
const imagesSchema = z.array(z.string().min(6)).min(3).max(10);
const locationSchema = z.object({
  city: z.string().min(2).max(80),
  district: z.string().min(2).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});
const attributesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
const mediaUploadSchema = z.object({
  fileName: z.string().min(1).max(180),
  mimeType: z.string().min(3).max(120),
  base64: z.string().min(24).max(2_000_000)
});
const ALLOWED_MEDIA_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_MEDIA_BYTES = 1_500_000;

function extFromMime(mt: string): string {
  const m = mt.toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("webp")) return ".webp";
  return ".bin";
}

function estimateBase64Bytes(base64: string): number {
  const clean = base64.replace(/\s+/g, "");
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - pad;
}

const createListingSchema = z.object({
  category_id: z.string().uuid().optional(),
  title: z.string().min(5).max(150),
  description: z.string().min(10).max(2000),
  listing_type: z.enum(["sell", "buy", "rent", "service"]),
  price: z.number().min(0),
  price_unit: z.enum(["TL", "USD", "kg", "ton", "adet", "hektar", "saat"]),
  category_slug: categorySlugSchema,
  condition: conditionSchema,
  location: locationSchema,
  images: imagesSchema,
  attributes: attributesSchema.default({})
});

const updateListingSchema = createListingSchema.partial();
const listQuerySchema = z.object({
  listing_type: z.enum(["sell", "buy", "rent", "service"]).optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20)
});

function getUserId(req: Request): string {
  return String(req.header("x-user-id") ?? "anonymous");
}

function categorySpecFor(slug: "traktor" | "tohum" | "gubre" | "hayvancilik"): CategorySpecField[] {
  const specs: Record<string, CategorySpecField[]> = {
    traktor: [
      { key: "hp", label: "Motor Gucu (HP)", type: "number", required: true },
      { key: "modelYear", label: "Model Yili", type: "number", required: true },
      { key: "workingHours", label: "Calisma Saati", type: "number", required: true }
    ],
    tohum: [
      { key: "certificateNo", label: "Sertifika No", type: "text", required: true },
      { key: "certificateType", label: "Sertifika Turu", type: "text", required: true }
    ],
    gubre: [
      { key: "nutrientRatio", label: "Besin Orani", type: "text", required: true },
      { key: "organicCert", label: "Organik Belge No", type: "text", required: false }
    ],
    hayvancilik: [
      { key: "animalType", label: "Hayvan Turu", type: "text", required: true },
      { key: "animalAge", label: "Yas (Ay)", type: "number", required: false }
    ]
  };
  return specs[slug] ?? [];
}

function validateCategoryAttributes(
  categorySlug: "traktor" | "tohum" | "gubre" | "hayvancilik" | undefined,
  attrs: Record<string, string | number | boolean>
): string[] {
  if (!categorySlug) return [];
  const requiredByCategory: Record<string, string[]> = {
    traktor: ["modelYear", "workingHours"],
    tohum: ["certificateType"],
    gubre: ["nutrientRatio"],
    hayvancilik: ["animalType"]
  };
  const requiredFields = requiredByCategory[categorySlug] ?? [];
  return requiredFields.filter((field) => attrs[field] == null || String(attrs[field]).trim() === "");
}

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      ok: true,
      service: "listing-service",
      database: true,
      elasticsearch: Boolean(process.env.ELASTICSEARCH_URL)
    });
  } catch {
    return res.status(503).json({ ok: false, service: "listing-service", database: false });
  }
});

app.get("/api/v1/listings", async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid query", errors: parsed.error.flatten() });

  const q = parsed.data;
  const where: Prisma.ListingWhereInput = {
    status: { notIn: ["draft", "banned"] }
  };
  if (q.listing_type) where.listingType = q.listing_type;
  const priceFilter: Prisma.DecimalFilter = {};
  if (typeof q.min_price === "number") priceFilter.gte = q.min_price;
  if (typeof q.max_price === "number") priceFilter.lte = q.max_price;
  if (Object.keys(priceFilter).length) where.price = priceFilter;

  const all = await prisma.listing.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  const start = decodeCursor(q.cursor);
  const end = start + q.limit;
  const slice = all.slice(start, end);
  const data = slice.map(toApi);
  const nextCursor = end < all.length ? encodeCursor(end) : null;
  const payload = { data, nextCursor };
  const etag = crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
  if (req.header("if-none-match") === etag) return res.status(304).send();
  res.setHeader("ETag", etag);
  return res.json(payload);
});

app.get("/api/v1/listing-categories/:slug/spec", (req: Request, res: Response) => {
  const parsed = z.enum(["traktor", "tohum", "gubre", "hayvancilik"]).safeParse(req.params.slug);
  if (!parsed.success) return res.status(400).json({ message: "Invalid category slug" });
  return res.json({
    slug: parsed.data,
    fields: categorySpecFor(parsed.data)
  });
});

app.post("/api/v1/listings/media/upload-inline", createLimiter, async (req: Request, res: Response) => {
  const parsed = mediaUploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
  const mime = parsed.data.mimeType.trim().toLowerCase();
  if (!ALLOWED_MEDIA_MIME.has(mime)) {
    return res.status(400).json({ message: "Unsupported mime type. Allowed: image/png, image/jpeg, image/webp" });
  }
  const b64 = parsed.data.base64.trim();
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(b64)) return res.status(400).json({ message: "Invalid base64 payload" });
  const estimated = estimateBase64Bytes(b64);
  if (estimated > MAX_MEDIA_BYTES) return res.status(413).json({ message: "Image too large. Max 1.5MB" });

  const file = `${Date.now()}-${crypto.randomUUID()}${extFromMime(mime)}`;
  const dir = path.join(process.cwd(), "uploads", "listings");
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, file);
  await writeFile(abs, Buffer.from(b64, "base64"));
  return res.status(201).json({ url: `/uploads/listings/${file}`, mimeType: mime });
});

app.post("/api/v1/listings", createLimiter, async (req: Request, res: Response) => {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });

  const missingFields = validateCategoryAttributes(parsed.data.category_slug, parsed.data.attributes);
  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Dynamic attributes missing",
      errors: { fields: Object.fromEntries(missingFields.map((name) => [name, ["Required for selected category"]])) }
    });
  }

  const userId = getUserId(req);
  const authorUuid = await resolveAuthorUuidByPhone(userId);
  const row = await prisma.listing.create({
    data: {
      userId,
      authorUuid,
      categoryId: parsed.data.category_id ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
      listingType: parsed.data.listing_type,
      price: parsed.data.price,
      priceUnit: parsed.data.price_unit,
      attributesJson: parsed.data.attributes,
      locationJson: parsed.data.location,
      status: "draft"
    }
  });
  listingMetaStore.set(row.id, {
    categorySlug: parsed.data.category_slug,
    condition: parsed.data.condition,
    city: parsed.data.location.city,
    district: parsed.data.location.district,
    lat: parsed.data.location.lat,
    lng: parsed.data.location.lng,
    images: parsed.data.images,
    attributes: parsed.data.attributes
  });
  return res.status(201).json(toApi(row));
});

app.get("/api/v1/listings/:id", async (req: Request, res: Response) => {
  const row = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ message: "Listing not found" });
  const viewer = getUserId(req);
  if (!canViewListing(row, viewer)) return res.status(404).json({ message: "Listing not found" });
  return res.json(toApi(row));
});

app.put("/api/v1/listings/:id", async (req: Request, res: Response) => {
  const row = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ message: "Listing not found" });
  if (row.userId !== getUserId(req)) return res.status(403).json({ message: "Ownership check failed" });

  const parsed = updateListingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });

  const updated = await prisma.listing.update({
    where: { id: row.id },
    data: {
      ...(typeof parsed.data.title === "string" ? { title: parsed.data.title } : {}),
      ...(typeof parsed.data.description === "string" ? { description: parsed.data.description } : {}),
      ...(typeof parsed.data.price === "number" ? { price: parsed.data.price } : {}),
      ...(typeof parsed.data.listing_type === "string" ? { listingType: parsed.data.listing_type } : {}),
      ...(typeof parsed.data.price_unit === "string" ? { priceUnit: parsed.data.price_unit } : {}),
      ...(parsed.data.attributes ? { attributesJson: parsed.data.attributes } : {}),
      ...(parsed.data.location ? { locationJson: parsed.data.location } : {}),
      ...(parsed.data.category_id ? { categoryId: parsed.data.category_id } : {})
    }
  });
  if (parsed.data.category_slug || parsed.data.condition || parsed.data.location || parsed.data.images || parsed.data.attributes) {
    const prev = listingMetaStore.get(updated.id) ?? { images: [], attributes: {} };
    listingMetaStore.set(updated.id, {
      categorySlug: parsed.data.category_slug ?? prev.categorySlug,
      condition: parsed.data.condition ?? prev.condition,
      city: parsed.data.location?.city ?? prev.city,
      district: parsed.data.location?.district ?? prev.district,
      lat: parsed.data.location?.lat ?? prev.lat,
      lng: parsed.data.location?.lng ?? prev.lng,
      images: parsed.data.images ?? prev.images,
      attributes: parsed.data.attributes ?? prev.attributes
    });
  }
  scheduleListingSearchSync(updated);
  return res.json(toApi(updated));
});

app.delete("/api/v1/listings/:id", async (req: Request, res: Response) => {
  const row = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ message: "Listing not found" });
  if (row.userId !== getUserId(req)) return res.status(403).json({ message: "Ownership check failed" });
  const expired = await prisma.listing.update({
    where: { id: row.id },
    data: { status: "expired" }
  });
  scheduleListingSearchSync(expired);
  return res.status(204).send();
});

app.post("/api/v1/listings/:id/publish", async (req: Request, res: Response) => {
  const row = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ message: "Listing not found" });
  if (row.userId !== getUserId(req)) return res.status(403).json({ message: "Ownership check failed" });
  const resolved = row.authorUuid ?? (await resolveAuthorUuidByPhone(row.userId));
  const next = await prisma.listing.update({
    where: { id: row.id },
    data: {
      status: "active",
      ...(resolved ? { authorUuid: resolved } : {})
    }
  });
  scheduleListingSearchSync(next);
  return res.json({ id: next.id, status: next.status });
});

app.post("/api/v1/listings/:id/media", (_req: Request, res: Response) => {
  return res.status(201).json({ uploaded: true, mediaId: crypto.randomUUID() });
});

app.delete("/api/v1/listings/:id/media/:mediaId", (_req: Request, res: Response) => {
  return res.status(204).send();
});

app.post("/api/v1/listings/:id/favorite", async (req: Request, res: Response) => {
  const listingId = req.params.id;
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  const userId = getUserId(req);

  const existing = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId, listingId } }
  });
  if (existing) {
    await prisma.favorite.delete({ where: { userId_listingId: { userId, listingId } } });
    return res.json({ favorite: false });
  }
  await prisma.favorite.create({ data: { userId, listingId } });
  return res.json({ favorite: true });
});

app.post("/api/v1/listings/:id/report", (_req: Request, res: Response) => {
  return res.status(201).json({ reported: true });
});

const port = Number(process.env.PORT ?? 3002);
app.listen(port, () => {
  console.log(`listing-service listening on ${port}`);
});

import crypto from "node:crypto";
import compression from "compression";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { validateSearchRuntime } from "./runtimeConfig";

type HttpRequestWithId = Request & { serviceRequestId: string };

const app = express();
app.use(helmet());
app.use(compression());
app.use(cors({ origin: ["exp://localhost:8081"] }));

function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id")?.trim();
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  (req as HttpRequestWithId).serviceRequestId = id;
  res.setHeader("x-request-id", id);
  next();
}

function structuredAccessLog(req: Request, res: Response, next: NextFunction): void {
  if (String(process.env.SEARCH_SERVICE_STRUCTURED_ACCESS_LOG ?? "").trim() !== "1") {
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
        svc: "search-service",
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

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100
});
app.use(generalLimiter);

const isProd = process.env.NODE_ENV === "production";
const allowMemoryFallback = process.env.SEARCH_ALLOW_MEMORY_FALLBACK === "true";
validateSearchRuntime(process.env.NODE_ENV, process.env.ELASTICSEARCH_URL, allowMemoryFallback);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "search-service",
    elasticsearch: Boolean(process.env.ELASTICSEARCH_URL),
    listingServiceUrl: process.env.LISTING_SERVICE_URL ?? "http://127.0.0.1:3002"
  });
});

const searchSchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  category_slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
  listing_type: z.enum(["sell", "buy", "rent", "service"]).optional(),
  city: z.string().min(2).max(80).optional(),
  district: z.string().min(2).max(80).optional(),
  condition: z.enum(["new", "second_hand", "organic"]).optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius_km: z.coerce.number().min(1).max(500).optional(),
  sort_by: z.enum(["relevance", "price_asc", "price_desc", "newest", "trust_score"]).default("relevance"),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20)
});

type SearchQuery = z.infer<typeof searchSchema>;

type Listing = {
  id: string;
  title: string;
  price: number;
  listingType: "sell" | "buy" | "rent" | "service";
  categoryId?: string;
  categorySlug?: string;
  city?: string;
  district?: string;
  condition?: "new" | "second_hand" | "organic";
  locationLabel?: string;
  sellerRating?: number;
  trustScore: number;
  createdAt: string;
  authorUuid?: string | null;
  userId?: string;
};

type SearchSource = "elasticsearch" | "listing-service" | "memory";

const listings: Listing[] = [
  {
    id: "1",
    title: "Sertifikali bugday",
    price: 12500,
    listingType: "sell",
    trustScore: 86,
    createdAt: "2026-04-01T10:00:00Z",
    categorySlug: "tohum",
    city: "Konya",
    district: "Karatay",
    condition: "organic",
    locationLabel: "Konya / Karatay",
    sellerRating: 4.7
  },
  {
    id: "2",
    title: "Misir silaji",
    price: 9400,
    listingType: "sell",
    trustScore: 74,
    createdAt: "2026-04-02T10:00:00Z",
    categorySlug: "hayvancilik",
    city: "Bursa",
    district: "Nilufer",
    condition: "second_hand",
    locationLabel: "Bursa / Nilufer",
    sellerRating: 4.3
  },
  {
    id: "3",
    title: "Nakliye hizmeti",
    price: 1800,
    listingType: "service",
    trustScore: 91,
    createdAt: "2026-04-03T10:00:00Z",
    categorySlug: "traktor",
    city: "Ankara",
    district: "Polatli",
    condition: "new",
    locationLabel: "Ankara / Polatli",
    sellerRating: 4.9
  },
  {
    id: "4",
    title: "Buyukbas dana",
    price: 28000,
    listingType: "sell",
    trustScore: 79,
    createdAt: "2026-04-04T10:00:00Z",
    categorySlug: "hayvancilik",
    city: "Balikesir",
    district: "Bandirma",
    condition: "new",
    locationLabel: "Balikesir / Bandirma",
    sellerRating: 4.4
  }
];

function trustScoreFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return 55 + (Math.abs(h) % 35);
}

type ListingServiceRow = {
  id: string;
  title: string;
  listingType: string;
  price: number;
  createdAt: string;
  categoryId?: string | null;
  city?: string | null;
  district?: string | null;
  condition?: "new" | "second_hand" | "organic" | null;
  authorUuid?: string | null;
  userId?: string;
};

async function loadListingsFromListingService(limit: number): Promise<Listing[] | null> {
  const base = (process.env.LISTING_SERVICE_URL ?? "http://127.0.0.1:3002").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/v1/listings?limit=${encodeURIComponent(String(limit))}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: ListingServiceRow[] };
    const rows = json.data ?? [];
    if (!rows.length) return null;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      price: r.price,
      listingType: (r.listingType === "buy" || r.listingType === "rent" || r.listingType === "service" || r.listingType === "sell"
        ? r.listingType
        : "sell") as Listing["listingType"],
      categoryId: r.categoryId ?? undefined,
      trustScore: trustScoreFromId(r.id),
      city: r.city ?? undefined,
      district: r.district ?? undefined,
      condition: r.condition ?? undefined,
      locationLabel: r.city && r.district ? `${r.city} / ${r.district}` : r.city ?? r.district ?? undefined,
      sellerRating: Number((4 + (trustScoreFromId(r.id) % 10) / 10).toFixed(1)),
      createdAt: r.createdAt,
      authorUuid: r.authorUuid ?? null,
      userId: r.userId
    }));
  } catch {
    return null;
  }
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    return Number(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    return 0;
  }
}

function encodeCursor(nextIndex: number): string {
  return Buffer.from(String(nextIndex), "utf8").toString("base64");
}

async function searchElasticsearch(query: SearchQuery): Promise<Listing[] | null> {
  const base = process.env.ELASTICSEARCH_URL;
  if (!base) return null;
  try {
    const url = `${base.replace(/\/$/, "")}/listings/_search`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size: query.limit,
        query: query.q
          ? { multi_match: { query: query.q, fields: ["title", "description"], fuzziness: "AUTO" } }
          : { match_all: {} }
      })
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      hits?: { hits?: Array<{ _id: string; _source: Record<string, unknown> }> };
    };
    const hits = json.hits?.hits ?? [];
    if (!hits.length) return null;
    return hits.map((h) => ({
      id: h._id,
      title: String(h._source.title ?? h._id),
      price: Number(h._source.price) || 0,
      listingType: (String(h._source.listingType ?? "sell") as Listing["listingType"]) || "sell",
      categoryId: typeof h._source.categoryId === "string" ? h._source.categoryId : undefined,
      categorySlug: typeof h._source.categorySlug === "string" ? h._source.categorySlug : undefined,
      city: typeof h._source.city === "string" ? h._source.city : undefined,
      district: typeof h._source.district === "string" ? h._source.district : undefined,
      condition:
        h._source.condition === "new" || h._source.condition === "second_hand" || h._source.condition === "organic"
          ? h._source.condition
          : undefined,
      locationLabel: typeof h._source.locationLabel === "string" ? h._source.locationLabel : undefined,
      sellerRating: Number(h._source.sellerRating) || undefined,
      trustScore: Number(h._source.trustScore) || 50,
      createdAt: String(h._source.createdAt ?? new Date().toISOString()),
      authorUuid: (typeof h._source.authorUuid === "string" ? h._source.authorUuid : null) ?? null,
      userId: typeof h._source.userId === "string" ? h._source.userId : undefined
    }));
  } catch {
    return null;
  }
}

app.get("/api/v1/search/listings", async (req: Request, res: Response) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params", errors: parsed.error.flatten() });
  }

  const query = parsed.data;
  if (typeof query.min_price === "number" && typeof query.max_price === "number" && query.min_price > query.max_price) {
    return res.status(400).json({ message: "min_price cannot be greater than max_price" });
  }
  const fromEs = await searchElasticsearch(query);
  let filtered: Listing[];
  let source: SearchSource;
  if (fromEs) {
    filtered = fromEs;
    source = "elasticsearch";
  } else {
    const fromListing = await loadListingsFromListingService(80);
    if (fromListing) {
      filtered = fromListing;
      source = "listing-service";
    } else {
      if (isProd && !allowMemoryFallback) {
        return res.status(503).json({ message: "Search backend unavailable" });
      }
      filtered = listings;
      source = "memory";
    }
  }

  const category = query.category_id ?? query.category;
  filtered = filtered.filter((item) => !category || item.categoryId === category);
  filtered = filtered.filter((item) => !query.category_slug || item.categorySlug === query.category_slug);
  filtered = filtered.filter((item) => !query.city || item.city?.toLocaleLowerCase("tr-TR") === query.city.toLocaleLowerCase("tr-TR"));
  filtered = filtered.filter(
    (item) => !query.district || item.district?.toLocaleLowerCase("tr-TR") === query.district.toLocaleLowerCase("tr-TR")
  );
  filtered = filtered.filter((item) => !query.condition || item.condition === query.condition);
  filtered = filtered.filter((item) => !query.listing_type || item.listingType === query.listing_type);
  if (typeof query.min_price === "number") filtered = filtered.filter((item) => item.price >= query.min_price!);
  if (typeof query.max_price === "number") filtered = filtered.filter((item) => item.price <= query.max_price!);

  if (query.sort_by === "price_asc") filtered.sort((a, b) => a.price - b.price);
  if (query.sort_by === "price_desc") filtered.sort((a, b) => b.price - a.price);
  if (query.sort_by === "newest") filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (query.sort_by === "trust_score") filtered.sort((a, b) => b.trustScore - a.trustScore);

  const start = decodeCursor(query.cursor);
  const end = start + query.limit;
  const data = filtered.slice(start, end);
  const nextCursor = end < filtered.length ? encodeCursor(end) : null;

  const payload = { data, nextCursor, total: filtered.length, source };
  const etag = crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).send();
  }
  res.setHeader("ETag", etag);
  return res.json(payload);
});

app.listen(3006, () => {
  console.log("search-service listening on 3006");
});

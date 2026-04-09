import pg from "pg";

let pool: pg.Pool | null = null;

export function getOffersPool(): pg.Pool | null {
  const url = process.env.OFFERS_DATABASE_URL?.trim();
  if (!url) return null;
  pool ??= new pg.Pool({ connectionString: url, max: 8 });
  return pool;
}

export function isOffersDatabaseConfigured(): boolean {
  return Boolean(process.env.OFFERS_DATABASE_URL?.trim());
}

export type OfferApi = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  offeredPrice: number;
  offeredQuantity?: number;
  message?: string;
  status: OfferApiStatus;
  counterPrice?: number;
  counterMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type OfferApiStatus = "pending" | "accepted" | "rejected" | "countered" | "expired" | "cancelled";
export type OfferApiStatusTr = "BEKLEMEDE" | "KABUL_EDILDI" | "REDDEDILDI" | "KARSI_TEKLIF" | "SURESI_DOLDU" | "IPTAL";

type DbRow = {
  id: string;
  listing_id: string;
  buyer_phone: string;
  seller_phone: string;
  offered_price: string;
  offered_quantity: string | null;
  message: string | null;
  status: string;
  counter_price: string | null;
  counter_message: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapRow(r: DbRow): OfferApi {
  const row: OfferApi = {
    id: r.id,
    listingId: r.listing_id,
    buyerId: r.buyer_phone,
    sellerId: r.seller_phone,
    offeredPrice: Number.parseFloat(r.offered_price),
    status: r.status as OfferApiStatus,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString()
  };
  if (r.offered_quantity != null) row.offeredQuantity = Number.parseFloat(r.offered_quantity);
  if (r.message) row.message = r.message;
  if (r.counter_price != null) row.counterPrice = Number.parseFloat(r.counter_price);
  if (r.counter_message) row.counterMessage = r.counter_message;
  return row;
}

export function toStatusTr(status: OfferApiStatus): OfferApiStatusTr {
  if (status === "pending") return "BEKLEMEDE";
  if (status === "accepted") return "KABUL_EDILDI";
  if (status === "rejected") return "REDDEDILDI";
  if (status === "countered") return "KARSI_TEKLIF";
  if (status === "expired") return "SURESI_DOLDU";
  return "IPTAL";
}

export async function pgCreateOffer(
  listingId: string,
  buyerPhone: string,
  sellerPhone: string,
  offeredPrice: number,
  offeredQuantity: number | undefined,
  message: string | undefined
): Promise<OfferApi> {
  const p = getOffersPool();
  if (!p) throw new Error("no_database");
  const c = await p.connect();
  try {
    const r = await c.query<DbRow>(
      `INSERT INTO app_offers (listing_id, buyer_phone, seller_phone, offered_price, offered_quantity, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id::text, listing_id, buyer_phone, seller_phone, offered_price::text, offered_quantity::text,
                 message, status, counter_price::text, counter_message, created_at, updated_at`,
      [listingId, buyerPhone, sellerPhone, offeredPrice, offeredQuantity ?? null, message ?? null]
    );
    return mapRow(r.rows[0]!);
  } finally {
    c.release();
  }
}

export async function pgListForSeller(sellerPhone: string): Promise<OfferApi[]> {
  const p = getOffersPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<DbRow>(
      `SELECT id::text, listing_id, buyer_phone, seller_phone, offered_price::text, offered_quantity::text,
              message, status, counter_price::text, counter_message, created_at, updated_at
       FROM app_offers WHERE seller_phone = $1 ORDER BY created_at DESC`,
      [sellerPhone]
    );
    return r.rows.map(mapRow);
  } finally {
    c.release();
  }
}

export async function pgListForBuyer(buyerPhone: string): Promise<OfferApi[]> {
  const p = getOffersPool();
  if (!p) return [];
  const c = await p.connect();
  try {
    const r = await c.query<DbRow>(
      `SELECT id::text, listing_id, buyer_phone, seller_phone, offered_price::text, offered_quantity::text,
              message, status, counter_price::text, counter_message, created_at, updated_at
       FROM app_offers WHERE buyer_phone = $1 ORDER BY created_at DESC`,
      [buyerPhone]
    );
    return r.rows.map(mapRow);
  } finally {
    c.release();
  }
}

export async function pgGetById(id: string): Promise<OfferApi | null> {
  const p = getOffersPool();
  if (!p) return null;
  const c = await p.connect();
  try {
    const r = await c.query<DbRow>(
      `SELECT id::text, listing_id, buyer_phone, seller_phone, offered_price::text, offered_quantity::text,
              message, status, counter_price::text, counter_message, created_at, updated_at
       FROM app_offers WHERE id = $1::uuid LIMIT 1`,
      [id]
    );
    const row = r.rows[0];
    return row ? mapRow(row) : null;
  } finally {
    c.release();
  }
}

export async function pgAccept(id: string, sellerPhone: string): Promise<boolean> {
  const p = getOffersPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    const r = await c.query(
      `UPDATE app_offers SET status = 'accepted', updated_at = NOW()
       WHERE id = $1::uuid AND seller_phone = $2 AND status = 'pending'`,
      [id, sellerPhone]
    );
    return (r.rowCount ?? 0) > 0;
  } finally {
    c.release();
  }
}

export async function pgAcceptTx(
  id: string,
  sellerPhone: string
): Promise<{ ok: boolean; row: OfferApi | null }> {
  const p = getOffersPool();
  if (!p) return { ok: false, row: null };
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    const u = await c.query(
      `UPDATE app_offers SET status = 'accepted', updated_at = NOW()
       WHERE id = $1::uuid AND seller_phone = $2 AND status IN ('pending','countered')
       RETURNING id::text`,
      [id, sellerPhone]
    );
    if ((u.rowCount ?? 0) === 0) {
      await c.query("ROLLBACK");
      return { ok: false, row: null };
    }
    const r = await c.query<DbRow>(
      `SELECT id::text, listing_id, buyer_phone, seller_phone, offered_price::text, offered_quantity::text,
              message, status, counter_price::text, counter_message, created_at, updated_at
       FROM app_offers WHERE id = $1::uuid LIMIT 1`,
      [id]
    );
    await c.query("COMMIT");
    return { ok: true, row: r.rows[0] ? mapRow(r.rows[0]) : null };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export async function pgReject(id: string, sellerPhone: string): Promise<boolean> {
  const p = getOffersPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    const r = await c.query(
      `UPDATE app_offers SET status = 'rejected', updated_at = NOW()
       WHERE id = $1::uuid AND seller_phone = $2 AND status IN ('pending','countered')`,
      [id, sellerPhone]
    );
    return (r.rowCount ?? 0) > 0;
  } finally {
    c.release();
  }
}

export async function pgCounter(
  id: string,
  sellerPhone: string,
  counterPrice: number,
  counterMessage: string | undefined
): Promise<boolean> {
  const p = getOffersPool();
  if (!p) return false;
  const c = await p.connect();
  try {
    const r = await c.query(
      `UPDATE app_offers SET status = 'countered', counter_price = $3, counter_message = $4, updated_at = NOW()
       WHERE id = $1::uuid AND seller_phone = $2 AND status = 'pending'`,
      [id, sellerPhone, counterPrice, counterMessage ?? null]
    );
    return (r.rowCount ?? 0) > 0;
  } finally {
    c.release();
  }
}

export async function pgCounterTx(
  id: string,
  sellerPhone: string,
  counterPrice: number,
  counterMessage: string | undefined
): Promise<{ ok: boolean; row: OfferApi | null }> {
  const p = getOffersPool();
  if (!p) return { ok: false, row: null };
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    const u = await c.query(
      `UPDATE app_offers SET status = 'countered', counter_price = $3, counter_message = $4, updated_at = NOW()
       WHERE id = $1::uuid AND seller_phone = $2 AND status IN ('pending','countered')
       RETURNING id::text`,
      [id, sellerPhone, counterPrice, counterMessage ?? null]
    );
    if ((u.rowCount ?? 0) === 0) {
      await c.query("ROLLBACK");
      return { ok: false, row: null };
    }
    const r = await c.query<DbRow>(
      `SELECT id::text, listing_id, buyer_phone, seller_phone, offered_price::text, offered_quantity::text,
              message, status, counter_price::text, counter_message, created_at, updated_at
       FROM app_offers WHERE id = $1::uuid LIMIT 1`,
      [id]
    );
    await c.query("COMMIT");
    return { ok: true, row: r.rows[0] ? mapRow(r.rows[0]) : null };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

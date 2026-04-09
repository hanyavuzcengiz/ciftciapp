function trustScoreFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return 55 + (Math.abs(h) % 35);
}

type ListingEsDoc = {
  id: string;
  title: string;
  description: string;
  listingType: string;
  price: number;
  createdAt: string;
  userId: string;
  authorUuid: string | null;
  status: string;
};

export async function upsertListingSearchIndex(doc: ListingEsDoc): Promise<void> {
  const base = process.env.ELASTICSEARCH_URL?.replace(/\/$/, "");
  if (!base || doc.status !== "active") return;

  const url = `${base}/listings/_doc/${encodeURIComponent(doc.id)}`;
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: doc.title,
        description: doc.description,
        listingType: doc.listingType,
        price: doc.price,
        trustScore: trustScoreFromId(doc.id),
        createdAt: doc.createdAt,
        userId: doc.userId,
        authorUuid: doc.authorUuid
      })
    });
    if (!res.ok) {
      console.warn("listing-service: ES index failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn("listing-service: ES index error", e);
  }
}

/** Yalnızca aktif ilanlar indekste kalır; diğer durumlarda doküman silinir (idempotent). */
export function scheduleListingSearchSync(row: {
  id: string;
  title: string;
  description: string;
  listingType: string;
  price: { toNumber(): number } | number;
  createdAt: Date;
  userId: string;
  authorUuid: string | null;
  status: string;
}): void {
  const priceNum = typeof row.price === "number" ? row.price : row.price.toNumber();
  if (row.status === "active") {
    void upsertListingSearchIndex({
      id: row.id,
      title: row.title,
      description: row.description,
      listingType: row.listingType,
      price: priceNum,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      authorUuid: row.authorUuid,
      status: row.status
    });
    return;
  }
  void removeListingSearchIndex(row.id);
}

export async function removeListingSearchIndex(listingId: string): Promise<void> {
  const base = process.env.ELASTICSEARCH_URL?.replace(/\/$/, "");
  if (!base) return;
  try {
    const res = await fetch(`${base}/listings/_doc/${encodeURIComponent(listingId)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      console.warn("listing-service: ES delete failed", res.status);
    }
  } catch (e) {
    console.warn("listing-service: ES delete error", e);
  }
}

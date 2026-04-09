import { newRequestId } from "@agromarket/shared-utils";
import { MOCK_CATEGORY_SPECS, MOCK_OFFERS, MOCK_STATS, MOCK_TICKERS, MOCK_WALLET } from "./mock";
import { getClientAuth } from "./auth-client";
import { CategorySpec, MarketTicker, OfferRow, SellerStat, WalletRow } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function buildHeaders(contentType = true): HeadersInit {
  const auth = getClientAuth();
  return {
    "x-request-id": newRequestId(),
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    ...(auth?.userId ? { "x-user-id": auth.userId } : {}),
    ...(auth?.accessToken ? { Authorization: auth.accessToken.startsWith("Bearer ") ? auth.accessToken : `Bearer ${auth.accessToken}` } : {})
  };
}

async function safeJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", headers: buildHeaders(false) });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getMarketTickers(): Promise<MarketTicker[]> {
  try {
    return await safeJson<MarketTicker[]>(`${API_BASE}/api/v1/market/tickers`);
  } catch {
    return MOCK_TICKERS;
  }
}

export async function getCategorySpec(slug: string): Promise<CategorySpec> {
  try {
    return await safeJson<CategorySpec>(`${API_BASE}/api/v1/listing-categories/${slug}/spec`);
  } catch {
    return MOCK_CATEGORY_SPECS[slug] ?? MOCK_CATEGORY_SPECS.traktor;
  }
}

export type CreateListingInput = {
  title: string;
  description: string;
  price: number;
  categorySlug: string;
  location: { city: string; district: string; lat: number; lng: number };
  attributes: Record<string, string | number | boolean>;
  images: string[];
  mediaFiles?: Array<{ name: string; size: number; type: string }>;
};

export async function createAndPublishListing(input: CreateListingInput): Promise<{ id: string }> {
  const created = await postJson<{ id: string }>(`${API_BASE}/api/v1/listings`, {
    title: input.title,
    description: input.description,
    listing_type: "sell",
    price: input.price,
    price_unit: "TL",
    category_slug: input.categorySlug,
    condition: "second_hand",
    location: input.location,
    images: input.images,
    attributes: input.attributes
  });
  if (input.mediaFiles?.length) {
    await Promise.all(
      input.mediaFiles.map((file) =>
        postJson<{ uploaded: boolean; mediaId: string }>(`${API_BASE}/api/v1/listings/${created.id}/media`, {
          filename: file.name,
          contentType: file.type,
          size: file.size
        })
      )
    );
  }
  await postJson<{ id: string; status: string }>(`${API_BASE}/api/v1/listings/${created.id}/publish`, {});
  return created;
}

export async function getOffers(): Promise<OfferRow[]> {
  try {
    const sent = await safeJson<{ data: OfferRow[] }>(`${API_BASE}/api/v1/offers/sent`);
    return sent.data;
  } catch {
    return MOCK_OFFERS;
  }
}

export async function getWallet(): Promise<WalletRow[]> {
  return MOCK_WALLET;
}

export async function getSellerStats(): Promise<SellerStat[]> {
  return MOCK_STATS;
}

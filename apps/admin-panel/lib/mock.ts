import { CategorySpec, MarketTicker, OfferRow, SellerStat, WalletRow } from "./types";

export const MOCK_TICKERS: MarketTicker[] = [
  {
    key: "usd",
    title: "Dolar",
    unit: "TL",
    changePct: 0.8,
    series: [
      { label: "Pzt", value: 38.01 },
      { label: "Sal", value: 38.08 },
      { label: "Car", value: 38.13 },
      { label: "Per", value: 38.19 },
      { label: "Cum", value: 38.27 }
    ]
  },
  {
    key: "diesel",
    title: "Mazot",
    unit: "TL/L",
    changePct: -1.1,
    series: [
      { label: "Pzt", value: 44.5 },
      { label: "Sal", value: 44.3 },
      { label: "Car", value: 44.1 },
      { label: "Per", value: 44.0 },
      { label: "Cum", value: 43.9 }
    ]
  },
  {
    key: "wheat",
    title: "Bugday",
    unit: "TL/Ton",
    changePct: 2.4,
    series: [
      { label: "Pzt", value: 10950 },
      { label: "Sal", value: 11010 },
      { label: "Car", value: 11120 },
      { label: "Per", value: 11190 },
      { label: "Cum", value: 11230 }
    ]
  }
];

export const MOCK_CATEGORY_SPECS: Record<string, CategorySpec> = {
  traktor: {
    slug: "traktor",
    title: "Traktor",
    fields: [
      { key: "hp", label: "Motor Gucu (HP)", type: "number", required: true },
      { key: "year", label: "Model Yili", type: "number", required: true },
      { key: "workingHours", label: "Calisma Saati", type: "number", required: true }
    ]
  },
  tohum: {
    slug: "tohum",
    title: "Tohum",
    fields: [
      { key: "certificateNo", label: "Sertifika No", type: "text", required: true },
      { key: "germination", label: "Cimlenme Orani (%)", type: "number", required: true }
    ]
  }
};

export const MOCK_OFFERS: OfferRow[] = [
  { id: "ofr-102", listing: "2022 Case IH Traktor", amount: 1920000, status: "Karsi Teklif", createdAt: "2026-04-02" },
  { id: "ofr-111", listing: "Organik Gubre", amount: 3800, status: "Beklemede", createdAt: "2026-04-04" }
];

export const MOCK_WALLET: WalletRow[] = [
  { id: "txn-9", title: "Satis Tahsilati", amount: 125000, direction: "in", createdAt: "2026-04-01" },
  { id: "txn-10", title: "Komisyon Kesintisi", amount: 2400, direction: "out", createdAt: "2026-04-01" }
];

export const MOCK_STATS: SellerStat[] = [
  { month: "Oca", views: 2500, favorites: 120 },
  { month: "Sub", views: 3120, favorites: 180 },
  { month: "Mar", views: 4280, favorites: 265 },
  { month: "Nis", views: 5100, favorites: 320 }
];

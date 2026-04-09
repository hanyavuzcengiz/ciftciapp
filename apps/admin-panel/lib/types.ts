export type MarketPoint = { label: string; value: number };

export type MarketTicker = {
  key: string;
  title: string;
  unit: string;
  changePct: number;
  series: MarketPoint[];
};

export type CategoryField = {
  key: string;
  label: string;
  type: "text" | "number";
  required: boolean;
};

export type CategorySpec = {
  slug: string;
  title: string;
  fields: CategoryField[];
};

export type SellerStat = {
  month: string;
  views: number;
  favorites: number;
};

export type OfferRow = {
  id: string;
  listing: string;
  amount: number;
  status: "Beklemede" | "Kabul" | "Red" | "Karsi Teklif";
  createdAt: string;
};

export type WalletRow = {
  id: string;
  title: string;
  amount: number;
  direction: "in" | "out";
  createdAt: string;
};

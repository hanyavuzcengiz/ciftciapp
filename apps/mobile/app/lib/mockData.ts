type ListingLike = {
  id: string;
  title?: string;
  price?: number;
  listingType?: string;
  city?: string;
  district?: string;
  sellerRating?: number;
  imageUrl?: string;
  userId?: string;
  authorUuid?: string | null;
};

type OfferLike = {
  id: string;
  listingId?: string;
  offeredPrice?: number;
  status?: string;
  statusTr?: string;
  counterPrice?: number;
  conversationId?: string;
  createdAt?: string;
};

type NotificationLike = {
  id: string;
  title?: string;
  body?: string;
  category?: string;
  createdAt?: string;
  readAt?: string | null;
  listingId?: string | null;
  conversationId?: string | null;
};

type ConversationLike = {
  id: string;
  participants?: string[];
  listingId?: string;
  createdAt?: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string;
};

type MessageLike = { id: string; senderId?: string; content?: string; createdAt?: string };

type UserListingLike = {
  id: string;
  title?: string;
  listingType?: string;
  price?: number;
  status?: string;
  createdAt?: string;
};

type UserReviewLike = {
  id: string;
  reviewerName?: string;
  rating?: number;
  comment?: string | null;
  sellerReply?: string | null;
  createdAt?: string;
};

export const SAMPLE_FEED: ListingLike[] = [
  { id: "sample-1", title: "2022 Case IH Traktor - 145 HP", price: 2450000, listingType: "Satis", city: "Konya", district: "Selcuklu", sellerRating: 4.8, imageUrl: "https://placehold.co/600x400?text=Case+IH+Traktor", userId: "+905551112233" },
  { id: "sample-2", title: "Sertifikali Ekmeklik Bugday Tohumu", price: 17.5, listingType: "Satis", city: "Ankara", district: "Polatli", sellerRating: 4.6, imageUrl: "https://placehold.co/600x400?text=Bugday+Tohumu", userId: "+905558889900" },
  { id: "sample-3", title: "Organik Buyukbas Hayvan Gubresi", price: 4200, listingType: "Satis", city: "Bursa", district: "Karacabey", sellerRating: 4.7, imageUrl: "https://placehold.co/600x400?text=Organik+Gubre", userId: "+905554445566" },
  { id: "sample-4", title: "Drone ile Ilaclama Hizmeti", price: 1350, listingType: "Hizmet", city: "Adana", district: "Ceyhan", sellerRating: 4.9, imageUrl: "https://placehold.co/600x400?text=Drone+Ilaclama", userId: "+905550009988" },
  { id: "sample-5", title: "John Deere 6120M Traktor", price: 2780000, listingType: "Satis", city: "Kayseri", district: "Kocasinan", sellerRating: 4.5, imageUrl: "https://placehold.co/600x400?text=John+Deere", userId: "+905553334455" },
  { id: "sample-6", title: "Silajlik Misir Tohumu 50kg", price: 12900, listingType: "Satis", city: "Tekirdag", district: "Hayrabolu", sellerRating: 4.4, imageUrl: "https://placehold.co/600x400?text=Misir+Tohumu", userId: "+905552223344" },
  { id: "sample-7", title: "Damla Sulama Borusu 1000m", price: 28500, listingType: "Satis", city: "Antalya", district: "Serik", sellerRating: 4.2, imageUrl: "https://placehold.co/600x400?text=Damla+Sulama", userId: "+905556667788" },
  { id: "sample-8", title: "Besilik Dana - 15 Adet", price: 32500, listingType: "Satis", city: "Balikesir", district: "Bandirma", sellerRating: 4.8, imageUrl: "https://placehold.co/600x400?text=Besilik+Dana", userId: "+905559990011" },
  { id: "sample-9", title: "Tarla Surum Hizmeti (Donum Basi)", price: 750, listingType: "Hizmet", city: "Edirne", district: "Kesan", sellerRating: 4.3, imageUrl: "https://placehold.co/600x400?text=Tarla+Surum", userId: "+905551234567" },
  { id: "sample-10", title: "Sera Isitma Cihazi Kiralik", price: 6200, listingType: "Kiralama", city: "Mersin", district: "Tarsus", sellerRating: 4.1, imageUrl: "https://placehold.co/600x400?text=Sera+Isitma", userId: "+905550009988" }
];

export const SAMPLE_SEARCH_RESULTS: ListingLike[] = [
  { id: "search-sample-1", title: "Sertifikali bugday tohumu 500 kg", price: 7400, listingType: "sell", userId: "+905553331122" },
  { id: "search-sample-2", title: "Traktor kiralama - saatlik", price: 1200, listingType: "rent", userId: "+905557771144" },
  { id: "search-sample-3", title: "Organik gubre tedarik (NPK dengeli)", price: 6400, listingType: "buy", userId: "+905559991133" },
  { id: "search-sample-4", title: "Bicerdöver hizmeti - donum basi", price: 850, listingType: "service", userId: "+905552227733" }
];

export const SAMPLE_CONVERSATIONS: ConversationLike[] = [
  {
    id: "conv-sample-1",
    participants: ["+905551111111", "+905552222222"],
    listingId: "listing-sample-1",
    createdAt: "2026-04-07T07:58:00.000Z",
    lastMessagePreview: "Merhaba, urunun son fiyati nedir?"
  },
  {
    id: "conv-sample-2",
    participants: ["+905551111111", "+905553333333"],
    listingId: "listing-sample-2",
    createdAt: "2026-04-07T06:41:00.000Z",
    lastMessagePreview: "Nakliye dahil teslimat yapabiliyor musunuz?"
  }
];

export const SAMPLE_OFFERS: OfferLike[] = [
  {
    id: "offer-sample-1",
    listingId: "listing-sample-1",
    offeredPrice: 17800,
    status: "pending",
    counterPrice: 18250,
    createdAt: "2026-04-07T07:45:00.000Z"
  },
  {
    id: "offer-sample-2",
    listingId: "listing-sample-2",
    offeredPrice: 9600,
    status: "accepted",
    createdAt: "2026-04-06T15:10:00.000Z"
  },
  {
    id: "offer-sample-3",
    listingId: "listing-sample-3",
    offeredPrice: 24100,
    status: "rejected",
    createdAt: "2026-04-05T10:30:00.000Z"
  }
];

export const SAMPLE_NOTIFICATIONS: NotificationLike[] = [
  {
    id: "notif-sample-1",
    title: "Yeni teklif geldi",
    body: "A kalite domates ilaniniza 17.800 TL teklif verildi.",
    category: "Teklif",
    createdAt: "2026-04-07T09:05:00.000Z",
    listingId: "listing-sample-1"
  },
  {
    id: "notif-sample-2",
    title: "Sohbette yeni mesaj",
    body: "Nakliye detaylari icin yeni bir mesaj aldin.",
    category: "Mesaj",
    createdAt: "2026-04-07T08:42:00.000Z",
    conversationId: "conv-sample-2",
    listingId: "listing-sample-2"
  },
  {
    id: "notif-sample-3",
    title: "Ilan gorunurlugu artti",
    body: "Ilaniniz bugun 186 goruntulenme aldi. Fiyat guncelleyerek daha fazla teklif toplayabilirsiniz.",
    category: "Performans",
    createdAt: "2026-04-06T18:20:00.000Z"
  }
];

export const SAMPLE_USER_LISTINGS: UserListingLike[] = [
  { id: "user-listing-sample-1", title: "Sanliurfa isot biberi - 350 kg", listingType: "Satis", price: 22500, status: "active" },
  { id: "user-listing-sample-2", title: "Sut sogutma tanki kiralik", listingType: "Kiralama", price: 4800, status: "active" },
  { id: "user-listing-sample-3", title: "2020 model traktor — satildi", listingType: "Satis", price: 1180000, status: "sold" }
];

export const SAMPLE_USER_REVIEWS: UserReviewLike[] = [
  {
    id: "user-review-sample-1",
    reviewerName: "Mehmet K.",
    rating: 5,
    comment: "Urun anlatildigi gibiydi, zamaninda teslim edildi.",
    sellerReply: "Guzel geri bildiriminiz icin tesekkurler."
  },
  {
    id: "user-review-sample-2",
    reviewerName: "Ayse T.",
    rating: 4,
    comment: "Iletisim hizliydi, tekrar calisabiliriz."
  }
];

export const SAMPLE_PROFILE_HIGHLIGHTS = [
  "Bu sezon 12 aktif ilan",
  "Ortalama teklif donus suresi: 18 dk",
  "Guven skoru ornegi: 82/100"
];

export const SAMPLE_MARKET_NOTES = [
  "Bolgede son 7 gunde benzer ilanlarda fiyat araligi: 17.500 - 19.200 TL",
  "Ortalama teslimat suresi: 1-3 is gunu",
  "Toplu alimlarda nakliye pazarliga dahildir"
];

export function buildSampleMessages(me?: string | null): MessageLike[] {
  const mine = me?.trim() || "+905550000000";
  const peer = "+905553214578";
  return [
    {
      id: "msg-sample-1",
      senderId: peer,
      content: "Merhaba, 2 ton domates icin son fiyatiniz nedir?",
      createdAt: "2026-04-07T08:14:00.000Z"
    },
    {
      id: "msg-sample-2",
      senderId: mine,
      content: "Merhaba, pesin alimda 18.250 TL teklif verebilirim.",
      createdAt: "2026-04-07T08:16:00.000Z"
    },
    {
      id: "msg-sample-3",
      senderId: peer,
      content: "Nakliyeyi siz ustlenirseniz 18.000 TL olarak anlasabiliriz.",
      createdAt: "2026-04-07T08:18:00.000Z"
    }
  ];
}

export function isMockDataEnabled(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const allowProdRaw = env?.EXPO_PUBLIC_ALLOW_MOCK_IN_PROD;
  const allowProd =
    typeof allowProdRaw === "string" &&
    ["1", "true", "yes", "on"].includes(allowProdRaw.trim().toLowerCase());
  if (!__DEV__ && !allowProd) return false;

  const raw = env
    ?.EXPO_PUBLIC_ENABLE_MOCK_DATA;
  if (!raw) return true;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

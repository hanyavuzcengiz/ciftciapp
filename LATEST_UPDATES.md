# Son Gelismeler - Nisan 2026

Bu dosya son teslimde yapilan urun ve teknik gelismeleri tek yerden gormek icin eklendi.

## Mobil UX / UI

- Profil, Ilan Ver ve Mesaj ekranlari sade bir tasarima guncellendi.
- 8px grid, tek yesil palet ve 3 seviye tipografi standardi getirildi.
- Ortak UI bilesenleri eklendi: `AppButton`, `Card`, `ScreenHeader`, `Avatar`, `TrustScoreVisual`.
- Durum bilesenleri standardize edildi: `StateCard`, `StateNotice`, `StateSkeleton`.

## Akis Iyilestirmeleri

- Ilan Ver ekrani 6 adimli akisa cevrildi:
  1) Kategori
  2) Baslik
  3) Aciklama
  4) Fiyat
  5) Konum
  6) Fotograf
- Mesaj listesi WhatsApp benzeri sade satir tasarimina gecti.
- Sohbet ekraninda teklif/fiyat icerikleri belirginlestirildi.
- Profilde guven skoru daha gorunur hale getirildi.

## Test / Demo Gorunurlugu

- Profil ekraninda test gunlugu paneli korunup sadeleştirildi.
- Mock/fallback akislarina event log kayitlari eklendi.
- Yardim ekranina "Son Gelismeler" bolumu eklendi.

## Backend / Ops

- API gateway proxy route/rewrite iyilestirmeleri yapildi:
  - `/api/v1/listings`
  - `/api/v1/listing-categories`
  - `/api/v1/search`
- Listing-service DB fallback ve calisma ortami guvenligi guclendirildi.
- Listing icin ayri veritabani yolu sabitlendi:
  - `.env` -> `LISTING_DATABASE_URL=postgresql://agromarket:agromarket@localhost:5432/agromarket_listing`

## Son Dogrulama

- `pnpm --filter @agromarket/mobile typecheck` ✅
- `pnpm smoke:prod:json` ✅ (`ok: true`, `failedCount: 0`)

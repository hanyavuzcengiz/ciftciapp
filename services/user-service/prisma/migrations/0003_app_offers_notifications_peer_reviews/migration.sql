-- Uygulama katmanı: listing-service UUID ilanları ile uyumlu (listing_id TEXT).
-- offers / notification-service / peer değerlendirmeleri aynı Postgres örneğinde.

CREATE TABLE app_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id TEXT NOT NULL,
  buyer_phone VARCHAR(20) NOT NULL,
  seller_phone VARCHAR(20) NOT NULL,
  offered_price NUMERIC(12,2) NOT NULL CHECK (offered_price >= 0),
  offered_quantity NUMERIC(14,4),
  message VARCHAR(1000),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','countered','expired','cancelled')),
  counter_price NUMERIC(12,2),
  counter_message VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_offers_buyer ON app_offers(buyer_phone);
CREATE INDEX idx_app_offers_seller ON app_offers(seller_phone);
CREATE INDEX idx_app_offers_listing ON app_offers(listing_id);

CREATE TABLE app_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_phone VARCHAR(20) NOT NULL,
  channel VARCHAR(16) NOT NULL,
  category VARCHAR(32) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_notifications_user ON app_notifications(user_phone, created_at DESC);

-- Sipariş tablosu olmadan kullanıcı↔kullanıcı değerlendirme (sipariş bazlı reviews tablosundan ayrı)
CREATE TABLE app_peer_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewer_phone VARCHAR(20) NOT NULL,
  reviewed_user_uuid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment VARCHAR(500),
  seller_reply VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_peer_reviews_reviewed ON app_peer_reviews(reviewed_user_uuid, created_at DESC);

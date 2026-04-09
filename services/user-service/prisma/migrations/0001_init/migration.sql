CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TYPE user_type AS ENUM ('farmer','breeder','supplier','service_provider','buyer','cooperative');
CREATE TYPE verification_status AS ENUM ('pending','phone_verified','id_verified','business_verified');
CREATE TYPE verification_type AS ENUM ('phone','national_id','tax_number','agricultural_registry');
CREATE TYPE verification_decision AS ENUM ('pending','approved','rejected');
CREATE TYPE listing_type AS ENUM ('sell','buy','rent','service');
CREATE TYPE listing_status AS ENUM ('draft','active','paused','sold','expired','banned');
CREATE TYPE media_type AS ENUM ('image','video');
CREATE TYPE offer_status AS ENUM ('pending','accepted','rejected','countered','expired','cancelled');
CREATE TYPE payment_status AS ENUM ('pending','paid','failed','refunded');
CREATE TYPE delivery_type AS ENUM ('seller_delivery','buyer_pickup','third_party');
CREATE TYPE order_status AS ENUM ('confirmed','in_progress','completed','disputed','cancelled');
CREATE TYPE report_content_type AS ENUM ('listing','user','message');
CREATE TYPE report_reason AS ENUM ('spam','fake','inappropriate','fraud','other');
CREATE TYPE report_status AS ENUM ('pending','reviewed','resolved');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(20) UNIQUE NOT NULL CHECK (phone_number ~ '^\+[1-9]\d{7,14}$'),
  email VARCHAR(255) UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  profile_photo_url TEXT,
  bio VARCHAR(500),
  location GEOGRAPHY(POINT, 4326),
  user_type user_type NOT NULL DEFAULT 'buyer',
  verification_status verification_status NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason TEXT,
  rating_avg NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE user_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  verification_type verification_type NOT NULL,
  document_url TEXT,
  status verification_decision NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES categories(id),
  name_tr VARCHAR(120) NOT NULL,
  name_en VARCHAR(120),
  slug VARCHAR(120) UNIQUE NOT NULL,
  icon_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  title VARCHAR(150) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  listing_type listing_type NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  price_unit VARCHAR(20) NOT NULL,
  price_negotiable BOOLEAN NOT NULL DEFAULT FALSE,
  quantity NUMERIC(12,2),
  quantity_unit VARCHAR(30),
  location GEOGRAPHY(POINT, 4326),
  location_text VARCHAR(255),
  status listing_status NOT NULL DEFAULT 'draft',
  view_count INTEGER NOT NULL DEFAULT 0,
  favorite_count INTEGER NOT NULL DEFAULT 0,
  offer_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  ai_moderation_score NUMERIC(5,2),
  ai_suggested_price NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE listing_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  media_type media_type NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  file_size_kb INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE listing_attributes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  attribute_key VARCHAR(100) NOT NULL,
  attribute_value VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  offered_price NUMERIC(12,2) NOT NULL CHECK (offered_price >= 0),
  offered_quantity NUMERIC(12,2),
  message VARCHAR(1000),
  status offer_status NOT NULL DEFAULT 'pending',
  counter_price NUMERIC(12,2),
  counter_message VARCHAR(1000),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES offers(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  payment_status payment_status NOT NULL DEFAULT 'pending',
  delivery_type delivery_type NOT NULL,
  delivery_address TEXT,
  delivery_notes TEXT,
  status order_status NOT NULL DEFAULT 'confirmed',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewed_user_id UUID NOT NULL REFERENCES users(id),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment VARCHAR(500),
  seller_reply VARCHAR(500),
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  content_type report_content_type NOT NULL,
  content_id UUID NOT NULL,
  reason report_reason NOT NULL,
  description VARCHAR(1000),
  status report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_verification_status ON users(verification_status);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_listings_user_status ON listings(user_id, status);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_location ON listings USING GIST(location);
CREATE INDEX idx_offers_listing ON offers(listing_id);
CREATE INDEX idx_orders_offer ON orders(offer_id);
CREATE INDEX idx_reviews_reviewed_user ON reviews(reviewed_user_id);
CREATE INDEX idx_reports_content ON reports(content_type, content_id);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER user_verifications_set_updated_at BEFORE UPDATE ON user_verifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER listings_set_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER listing_media_set_updated_at BEFORE UPDATE ON listing_media FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER listing_attributes_set_updated_at BEFORE UPDATE ON listing_attributes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER offers_set_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

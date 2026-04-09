-- İşletme profili alanları (mobil taslakların sunucu senkronu için JSONB).
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_profile_json JSONB;

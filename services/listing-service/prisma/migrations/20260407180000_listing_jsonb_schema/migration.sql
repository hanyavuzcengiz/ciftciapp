ALTER TABLE "listings_app"
ADD COLUMN IF NOT EXISTS "attributes_json" JSONB,
ADD COLUMN IF NOT EXISTS "location_json" JSONB;

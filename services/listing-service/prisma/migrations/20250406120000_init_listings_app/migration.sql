-- İlan servisi için ayrı tablolar (user-service migration’daki `listings` tablosundan bağımsız).
-- JWT sub / x-user-id = E.164 telefon saklanır.

CREATE TABLE "listings_app" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(20) NOT NULL,
    "category_id" UUID,
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "listing_type" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "price_unit" VARCHAR(20) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listings_app_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "listing_favorites" (
    "user_id" VARCHAR(20) NOT NULL,
    "listing_id" UUID NOT NULL,

    CONSTRAINT "listing_favorites_pkey" PRIMARY KEY ("user_id","listing_id"),
    CONSTRAINT "listing_favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings_app"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "listings_app_user_id_idx" ON "listings_app"("user_id");
CREATE INDEX "listings_app_status_created_idx" ON "listings_app"("status", "created_at");

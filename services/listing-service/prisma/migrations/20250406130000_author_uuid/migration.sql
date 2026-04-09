-- Çekirdek şemadaki users(id) ile eşleme (telefon users.phone_number ile bulunur).
ALTER TABLE "listings_app" ADD COLUMN "author_uuid" UUID;

ALTER TABLE "listings_app"
ADD CONSTRAINT "listings_app_author_uuid_fkey"
FOREIGN KEY ("author_uuid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "listings_app_author_uuid_idx" ON "listings_app"("author_uuid");

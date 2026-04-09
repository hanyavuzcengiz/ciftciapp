-- Bildirim satırından ilan / sohbet ekranına yönlendirme (mobil).
ALTER TABLE app_notifications
  ADD COLUMN IF NOT EXISTS listing_id TEXT,
  ADD COLUMN IF NOT EXISTS conversation_id TEXT;

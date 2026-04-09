-- cihaz Expo push token kayitlari (notification-service ile paylasilan DB)
CREATE TABLE IF NOT EXISTS app_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone VARCHAR(20) NOT NULL,
  expo_push_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_push_tokens_expo ON app_push_tokens (expo_push_token);
CREATE INDEX IF NOT EXISTS idx_app_push_tokens_user ON app_push_tokens (user_phone, last_seen_at DESC);

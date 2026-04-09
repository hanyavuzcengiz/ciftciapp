CREATE TABLE IF NOT EXISTS app_user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_phone VARCHAR(20) NOT NULL,
  target_user_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_phone, target_user_ref)
);

CREATE INDEX IF NOT EXISTS idx_app_user_follows_follower_phone
  ON app_user_follows (follower_phone, created_at DESC);

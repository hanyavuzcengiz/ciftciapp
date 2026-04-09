CREATE TABLE IF NOT EXISTS verification_admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  decision verification_decision NULL,
  atomic BOOLEAN NULL,
  request_id UUID NULL,
  requested_count INT NULL,
  processed_count INT NULL,
  failed_count INT NULL,
  reason_counts JSONB NULL,
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_admin_audit_logs_created_at
  ON verification_admin_audit_logs (created_at DESC);


-- Migration: Add idempotency_keys table for edge function deduplication
-- Purpose: Prevent duplicate inventory items from network retries
-- Date: December 17, 2025

-- Create idempotency_keys table
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Index for efficient cleanup query
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- Add pg_cron job to clean up expired keys (daily at 4am UTC)
SELECT cron.schedule(
  'cleanup-expired-idempotency-keys',
  '0 4 * * *',  -- Daily at 4am UTC
  $$
    DELETE FROM idempotency_keys
    WHERE expires_at < NOW()
  $$
);

-- Enable RLS (not needed for service_role access, but good practice)
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Comment
COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys for edge functions to prevent duplicate operations. Keys expire after 24 hours.';
COMMENT ON COLUMN idempotency_keys.key IS 'Client-generated UUID for request deduplication';
COMMENT ON COLUMN idempotency_keys.response_data IS 'Cached response to return if key is reused';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Automatic expiration timestamp (24 hours from creation)';

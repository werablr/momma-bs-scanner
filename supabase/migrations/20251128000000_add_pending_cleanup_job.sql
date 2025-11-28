-- Migration: Add pg_cron job to cleanup stuck pending items
-- Priority: P0 - Critical
-- Issue: Items stuck in 'pending' status corrupt inventory counts
-- Fix: Automatically delete items stuck in pending for >24 hours

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cleanup job that runs daily at 2am
SELECT cron.schedule(
  'cleanup-stuck-pending-items',
  '0 2 * * *',  -- Daily at 2am UTC
  $$
    DELETE FROM inventory_items
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '24 hours'
  $$
);

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Scheduled cleanup jobs for data integrity';

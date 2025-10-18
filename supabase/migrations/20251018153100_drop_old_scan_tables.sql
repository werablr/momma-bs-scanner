-- Migration: Drop old scan tables (scans, scan_history)
-- Purpose: Clean up redundant tables now that we have inventory_items/inventory_history

-- Drop old tables if they exist
DROP TABLE IF EXISTS public.scans CASCADE;
DROP TABLE IF EXISTS public.scan_history CASCADE;

-- Drop the old trigger function if it exists (may be orphaned)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

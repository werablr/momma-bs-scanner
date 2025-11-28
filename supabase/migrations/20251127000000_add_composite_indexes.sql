-- Migration: Add Composite Indexes for Query Optimization
-- Date: November 27, 2025
-- Purpose: Improve performance of common query patterns with composite indexes
-- Issue: Database P0 - Missing composite indexes (slow queries)

-- ============================================================================
-- ANALYSIS OF CURRENT STATE
-- ============================================================================
-- Existing indexes (single-column):
--   - idx_inventory_items_household (household_id)
--   - idx_inventory_items_status (status)
--   - idx_inventory_items_barcode (barcode)
--   - idx_inventory_items_storage (storage_location_id)
--
-- Problem: Queries filtering by household_id AND status require two index scans
-- Solution: Composite indexes for common query patterns

-- ============================================================================
-- COMPOSITE INDEXES
-- ============================================================================

-- Index 1: Household + Status (most common pattern in Pantry app)
-- Optimizes: WHERE household_id = ? AND status = 'active'
CREATE INDEX IF NOT EXISTS idx_inventory_household_status
  ON inventory_items(household_id, status);

-- Index 2: Household + Storage Location (filter by location)
-- Optimizes: WHERE household_id = ? AND storage_location_id = ?
CREATE INDEX IF NOT EXISTS idx_inventory_household_location
  ON inventory_items(household_id, storage_location_id);

-- Index 3: Household + Barcode (item lookup)
-- Optimizes: WHERE household_id = ? AND barcode = ?
CREATE INDEX IF NOT EXISTS idx_inventory_household_barcode
  ON inventory_items(household_id, barcode);

-- Index 4: Partial index for pending item cleanup
-- Optimizes: WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'
-- Note: Partial index only indexes rows where status = 'pending' (smaller, faster)
CREATE INDEX IF NOT EXISTS idx_inventory_pending_created
  ON inventory_items(status, created_at)
  WHERE status = 'pending';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check that indexes were created
DO $$
BEGIN
  RAISE NOTICE '=== Composite Indexes Created ===';
  RAISE NOTICE 'idx_inventory_household_status: %',
    (SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_inventory_household_status');
  RAISE NOTICE 'idx_inventory_household_location: %',
    (SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_inventory_household_location');
  RAISE NOTICE 'idx_inventory_household_barcode: %',
    (SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_inventory_household_barcode');
  RAISE NOTICE 'idx_inventory_pending_created: %',
    (SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_inventory_pending_created');
END $$;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON INDEX idx_inventory_household_status IS
  'Composite index for household + status queries (Pantry inventory list)';

COMMENT ON INDEX idx_inventory_household_location IS
  'Composite index for household + storage location filtering';

COMMENT ON INDEX idx_inventory_household_barcode IS
  'Composite index for household + barcode lookups (RLS-aware)';

COMMENT ON INDEX idx_inventory_pending_created IS
  'Partial index for pending item cleanup queries (status=pending only)';

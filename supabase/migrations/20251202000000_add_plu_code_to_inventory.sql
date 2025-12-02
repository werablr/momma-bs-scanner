-- Migration: Add plu_code column to inventory_items
-- Date: December 2, 2025
-- Purpose: Support PLU code tracking for produce items
-- Phase: PLU Workflow Phase 3 (Database Foundation)

-- ============================================================================
-- ADD PLU_CODE COLUMN
-- ============================================================================

ALTER TABLE public.inventory_items
ADD COLUMN plu_code TEXT;

-- Add index for PLU code lookups
CREATE INDEX idx_inventory_plu_code ON public.inventory_items(plu_code)
WHERE plu_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.inventory_items.plu_code IS 'Price Look-Up code from produce sticker (4-5 digits). Only populated for items scanned via PLU workflow. Null for barcode/photo/manual items.';

-- ============================================================================
-- VALIDATION
-- ============================================================================

-- Verify column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_items'
        AND column_name = 'plu_code'
    ) THEN
        RAISE EXCEPTION 'Migration failed: plu_code column not created';
    END IF;
END $$;

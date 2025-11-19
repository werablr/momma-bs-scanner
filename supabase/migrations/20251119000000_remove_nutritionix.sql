-- ============================================================
-- REMOVE NUTRITIONIX REFERENCES FROM SUPABASE DATABASE
-- ============================================================
-- Migration: 20251119000000_remove_nutritionix
-- Date: November 19, 2025
-- Purpose: Remove all Nutritionix API references and data
-- Reason: Subscription expired, migrated to free APIs (OFF, UPC, USDA, OpenAI)
-- ============================================================

-- 1. Update table comments to remove Nutritionix references
COMMENT ON COLUMN public.inventory_items.data_sources IS 'Tracks which APIs provided data: {openfoodfacts: true, upcitemdb: true, usda: true, openai_vision: true}';

COMMENT ON COLUMN public.product_catalog.data_sources IS 'Tracks which APIs provided data: {openfoodfacts: true, upcitemdb: true, usda: true, openai_vision: true}';

-- 2. Drop the deprecated nutritionix_data column from product_catalog
-- (This will permanently delete any cached Nutritionix API responses)
ALTER TABLE public.product_catalog
DROP COLUMN IF EXISTS nutritionix_data;

-- 3. Drop nix_item_id and nix_brand_id columns (Nutritionix identifiers)
ALTER TABLE public.product_catalog
DROP COLUMN IF EXISTS nix_item_id,
DROP COLUMN IF EXISTS nix_brand_id;

-- 4. Update data_sources JSONB to remove nutritionix keys from existing records
UPDATE public.product_catalog
SET data_sources = data_sources - 'nutritionix'
WHERE data_sources ? 'nutritionix';

UPDATE public.inventory_items
SET data_sources = data_sources - 'nutritionix'
WHERE data_sources ? 'nutritionix';

-- 5. Verify cleanup (these should return 0)
DO $$
DECLARE
    nutritionix_count_catalog INTEGER;
    nutritionix_count_inventory INTEGER;
BEGIN
    SELECT COUNT(*) INTO nutritionix_count_catalog
    FROM public.product_catalog
    WHERE data_sources ? 'nutritionix';

    SELECT COUNT(*) INTO nutritionix_count_inventory
    FROM public.inventory_items
    WHERE data_sources ? 'nutritionix';

    RAISE NOTICE 'Remaining nutritionix references in product_catalog: %', nutritionix_count_catalog;
    RAISE NOTICE 'Remaining nutritionix references in inventory_items: %', nutritionix_count_inventory;

    IF nutritionix_count_catalog > 0 OR nutritionix_count_inventory > 0 THEN
        RAISE WARNING 'Some nutritionix references remain in data_sources fields';
    ELSE
        RAISE NOTICE 'All nutritionix references successfully removed';
    END IF;
END $$;

-- ============================================================
-- EXPECTED RESULTS:
-- - Comments updated to reflect current API sources
-- - nutritionix_data column dropped from product_catalog
-- - nix_item_id and nix_brand_id columns dropped
-- - All data_sources JSONB fields cleaned
-- - Notice messages should show 0 remaining references
-- ============================================================

-- Migration complete

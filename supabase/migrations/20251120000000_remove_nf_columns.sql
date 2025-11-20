-- ============================================================
-- REMOVE NF_* COLUMNS - COMPLETE NUTRITIONIX ELIMINATION
-- ============================================================
-- Migration: 20251120000000_remove_nf_columns
-- Date: November 20, 2025
-- Purpose: Remove all nf_* (Nutritionix) columns from database
-- Reason: Multi-source philosophy - display logic uses COALESCE(user_*, usda_*, off_*, upc_*)
-- Impact: No stored computed columns. Pantry app queries calculate best value at runtime.
-- ============================================================

-- ============================================================================
-- STEP 1: DROP NF_* COLUMNS FROM INVENTORY_ITEMS
-- ============================================================================

ALTER TABLE public.inventory_items
DROP COLUMN IF EXISTS nf_calories,
DROP COLUMN IF EXISTS nf_total_fat,
DROP COLUMN IF EXISTS nf_saturated_fat,
DROP COLUMN IF EXISTS nf_cholesterol,
DROP COLUMN IF EXISTS nf_sodium,
DROP COLUMN IF EXISTS nf_total_carbohydrate,
DROP COLUMN IF EXISTS nf_dietary_fiber,
DROP COLUMN IF EXISTS nf_sugars,
DROP COLUMN IF EXISTS nf_protein,
DROP COLUMN IF EXISTS nf_potassium;

-- ============================================================================
-- STEP 2: DROP NF_* COLUMNS FROM INVENTORY_HISTORY
-- ============================================================================

ALTER TABLE public.inventory_history
DROP COLUMN IF EXISTS nf_calories,
DROP COLUMN IF EXISTS nf_total_fat,
DROP COLUMN IF EXISTS nf_saturated_fat,
DROP COLUMN IF EXISTS nf_cholesterol,
DROP COLUMN IF EXISTS nf_sodium,
DROP COLUMN IF EXISTS nf_total_carbohydrate,
DROP COLUMN IF EXISTS nf_dietary_fiber,
DROP COLUMN IF EXISTS nf_sugars,
DROP COLUMN IF EXISTS nf_protein,
DROP COLUMN IF EXISTS nf_potassium;

-- ============================================================================
-- STEP 3: UPDATE TABLE COMMENTS TO REFLECT NEW PHILOSOPHY
-- ============================================================================

COMMENT ON TABLE public.inventory_items IS
'Active household inventory with complete multi-source data provenance.
Display logic: COALESCE(user_*, usda_*, off_*, upc_*) - no stored computed columns.';

COMMENT ON TABLE public.inventory_history IS
'Archived/consumed items with complete multi-source data provenance for analytics.
Display logic: COALESCE(user_*, usda_*, off_*, upc_*) - no stored computed columns.';

-- ============================================================================
-- STEP 4: UPDATE COLUMN COMMENTS FOR MULTI-SOURCE FIELDS
-- ============================================================================

COMMENT ON COLUMN public.inventory_items.user_calories IS
'User manually entered/corrected value - SINGLE SOURCE OF TRUTH (highest priority)';

COMMENT ON COLUMN public.inventory_items.usda_calories IS
'USDA FoodData Central value (government source, 150+ nutrients available)';

COMMENT ON COLUMN public.inventory_items.off_calories IS
'Open Food Facts value (community source, includes health scores)';

COMMENT ON COLUMN public.inventory_items.upc_calories IS
'UPCitemdb value (commercial source)';

COMMENT ON COLUMN public.inventory_items.data_sources IS
'Tracks which APIs provided data: {openfoodfacts: true, upcitemdb: true, usda: true, openai_vision: true}
Display queries use: COALESCE(user_field, usda_field, off_field, upc_field) AS field';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    inventory_nf_columns TEXT[];
    history_nf_columns TEXT[];
BEGIN
    -- Check for any remaining nf_* columns in inventory_items
    SELECT array_agg(column_name) INTO inventory_nf_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'inventory_items'
    AND column_name LIKE 'nf_%';

    -- Check for any remaining nf_* columns in inventory_history
    SELECT array_agg(column_name) INTO history_nf_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'inventory_history'
    AND column_name LIKE 'nf_%';

    IF inventory_nf_columns IS NOT NULL THEN
        RAISE WARNING 'Remaining nf_* columns in inventory_items: %', array_to_string(inventory_nf_columns, ', ');
    ELSE
        RAISE NOTICE '✓ All nf_* columns removed from inventory_items';
    END IF;

    IF history_nf_columns IS NOT NULL THEN
        RAISE WARNING 'Remaining nf_* columns in inventory_history: %', array_to_string(history_nf_columns, ', ');
    ELSE
        RAISE NOTICE '✓ All nf_* columns removed from inventory_history';
    END IF;

    IF inventory_nf_columns IS NULL AND history_nf_columns IS NULL THEN
        RAISE NOTICE '✓ NUTRITIONIX ELIMINATION COMPLETE - No nf_* columns remain in database';
    END IF;
END $$;

-- ============================================================
-- EXPECTED RESULTS:
-- - All nf_* columns dropped from inventory_items
-- - All nf_* columns dropped from inventory_history
-- - Table and column comments updated
-- - Verification should show "NUTRITIONIX ELIMINATION COMPLETE"
-- ============================================================

-- NEXT STEPS:
-- 1. Update Edge Functions to stop populating nf_* fields
-- 2. Update Pantry app to use COALESCE(user_*, usda_*, off_*, upc_*) in queries
-- 3. Update Scanner app to remove nf_* references from components
-- 4. Remove diagnostic SQL files with nf_* references

-- Migration complete

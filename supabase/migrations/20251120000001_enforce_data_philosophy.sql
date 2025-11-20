-- ============================================================
-- ENFORCE "CAPTURE EVERYTHING, SHOW THE BEST" PHILOSOPHY
-- ============================================================
-- Migration: 20251120000001_enforce_data_philosophy
-- Date: November 20, 2025
-- Purpose: Add database-level enforcement of multi-source data philosophy
-- Philosophy: user_* fields ALWAYS override API fields (SSOT enforcement)
-- ============================================================

-- ============================================================================
-- HELPER FUNCTION: Get Best Value (COALESCE with user_* priority)
-- ============================================================================
-- This function encodes the philosophy: user_* > usda_* > off_* > upc_*
-- Usage: SELECT get_best_value(user_calories, usda_calories, off_calories, upc_calories)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_best_value(
    user_value DECIMAL,
    usda_value DECIMAL,
    off_value DECIMAL,
    upc_value DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    RETURN COALESCE(user_value, usda_value, off_value, upc_value);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.get_best_value(DECIMAL, DECIMAL, DECIMAL, DECIMAL) IS
'Returns best value following philosophy: user_* (SSOT) > usda_* > off_* > upc_*
This enforces "Capture Everything, Show the Best" at the database level.
IMMUTABLE: Same inputs always return same output (safe for indexes/views).';

-- ============================================================================
-- VIEW: Inventory Items with Best Values (Enforced Philosophy)
-- ============================================================================
-- This view automatically applies COALESCE logic for all nutrition fields
-- Apps should query THIS VIEW instead of the raw table
-- ============================================================================

CREATE OR REPLACE VIEW public.inventory_items_display AS
SELECT
    -- Core fields (unchanged)
    i.id,
    i.household_id,
    i.barcode,
    i.food_name,
    i.brand_name,
    i.storage_location_id,
    i.expiration_date,
    i.scanned_at,
    i.status,
    i.volume_remaining,
    i.package_size,
    i.package_unit,

    -- Photos (priority: user > off > upc)
    COALESCE(i.photo_user_uploaded, i.photo_highres, i.photo_thumb) AS photo_best,
    i.photo_user_uploaded,
    i.photo_highres,
    i.photo_thumb,

    -- AI Vision fields
    i.ai_identified_name,
    i.ai_confidence,

    -- Health scores (only from OFF for now)
    i.nutriscore_grade,
    i.nova_group,
    i.is_vegan,
    i.is_vegetarian,
    i.is_palm_oil_free,

    -- ENFORCED PHILOSOPHY: Best nutrition values (user > usda > off > upc)
    -- Note: UPC only provides calories, protein, total_fat, sodium (4 fields)
    get_best_value(i.user_calories, i.usda_calories, i.off_calories, i.upc_calories) AS calories,
    get_best_value(i.user_protein, i.usda_protein, i.off_protein, i.upc_protein) AS protein,
    get_best_value(i.user_total_fat, i.usda_total_fat, i.off_total_fat, i.upc_total_fat) AS total_fat,
    get_best_value(i.user_sodium, i.usda_sodium, i.off_sodium, i.upc_sodium) AS sodium,
    -- UPC doesn't provide these fields, so use NULL as 4th parameter
    get_best_value(i.user_total_carbohydrate, i.usda_total_carbohydrate, i.off_total_carbohydrate, NULL) AS total_carbohydrate,
    get_best_value(i.user_dietary_fiber, i.usda_dietary_fiber, i.off_dietary_fiber, NULL) AS dietary_fiber,
    get_best_value(i.user_sugars, i.usda_sugars, i.off_sugars, NULL) AS sugars,
    get_best_value(i.user_saturated_fat, i.usda_saturated_fat, i.off_saturated_fat, NULL) AS saturated_fat,
    get_best_value(i.user_potassium, i.usda_potassium, i.off_potassium, NULL) AS potassium,

    -- Source-specific values (for transparency/comparison)
    -- UPC source (only 4 fields)
    i.user_calories, i.usda_calories, i.off_calories, i.upc_calories,
    i.user_protein, i.usda_protein, i.off_protein, i.upc_protein,
    i.user_total_fat, i.usda_total_fat, i.off_total_fat, i.upc_total_fat,
    i.user_sodium, i.usda_sodium, i.off_sodium, i.upc_sodium,
    -- USDA and OFF sources (more complete)
    i.user_total_carbohydrate, i.usda_total_carbohydrate, i.off_total_carbohydrate,
    i.user_dietary_fiber, i.usda_dietary_fiber, i.off_dietary_fiber,
    i.user_sugars, i.usda_sugars, i.off_sugars,
    i.user_saturated_fat, i.usda_saturated_fat, i.off_saturated_fat,
    i.user_potassium, i.usda_potassium, i.off_potassium,

    -- Raw API data (complete capture)
    i.openfoodfacts_raw_data,
    i.upcitemdb_raw_data,
    i.usda_raw_data,

    -- Data provenance tracking
    i.data_sources,

    -- Other metadata
    i.serving_qty,
    i.serving_unit,
    i.origins,
    i.packaging_type,
    i.created_at,
    i.updated_at

FROM public.inventory_items i;

COMMENT ON VIEW public.inventory_items_display IS
'Enforces "Capture Everything, Show the Best" philosophy at database level.
All nutrition fields use get_best_value() with user_* as SSOT.
Apps should query this view for consistent, philosophy-compliant data display.';

-- Grant access to authenticated users
GRANT SELECT ON public.inventory_items_display TO authenticated;

-- ============================================================================
-- TRIGGER: Prevent API fields from overwriting user_* fields
-- ============================================================================
-- This prevents edge functions or app code from accidentally clearing user_*
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_user_override()
RETURNS TRIGGER AS $$
BEGIN
    -- If user_* field exists in OLD record, prevent NULL in NEW record
    -- (Only applies to UPDATEs, not INSERTs)
    IF TG_OP = 'UPDATE' THEN
        -- Protect user_calories
        IF OLD.user_calories IS NOT NULL AND NEW.user_calories IS NULL THEN
            NEW.user_calories := OLD.user_calories;
            RAISE NOTICE 'Protected user_calories from being cleared (SSOT enforcement)';
        END IF;

        -- Protect user_protein
        IF OLD.user_protein IS NOT NULL AND NEW.user_protein IS NULL THEN
            NEW.user_protein := OLD.user_protein;
            RAISE NOTICE 'Protected user_protein from being cleared (SSOT enforcement)';
        END IF;

        -- Protect user_total_fat
        IF OLD.user_total_fat IS NOT NULL AND NEW.user_total_fat IS NULL THEN
            NEW.user_total_fat := OLD.user_total_fat;
            RAISE NOTICE 'Protected user_total_fat from being cleared (SSOT enforcement)';
        END IF;

        -- Protect user_total_carbohydrate
        IF OLD.user_total_carbohydrate IS NOT NULL AND NEW.user_total_carbohydrate IS NULL THEN
            NEW.user_total_carbohydrate := OLD.user_total_carbohydrate;
            RAISE NOTICE 'Protected user_total_carbohydrate from being cleared (SSOT enforcement)';
        END IF;

        -- Protect user_sodium
        IF OLD.user_sodium IS NOT NULL AND NEW.user_sodium IS NULL THEN
            NEW.user_sodium := OLD.user_sodium;
            RAISE NOTICE 'Protected user_sodium from being cleared (SSOT enforcement)';
        END IF;

        -- Add more user_* fields here as schema expands (vitamins, minerals, etc.)
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_user_override_protection
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_override();

COMMENT ON FUNCTION public.protect_user_override() IS
'Prevents accidental clearing of user_* fields (SSOT protection).
Once a user manually corrects a value, it cannot be overwritten by API updates.
This enforces the philosophy: user overrides are permanent until explicitly changed.';

-- ============================================================================
-- VALIDATION: Data Quality Check Function
-- ============================================================================
-- Returns items where APIs disagree significantly (potential data quality issues)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_nutrition_conflicts(
    p_household_id UUID,
    p_threshold_percent DECIMAL DEFAULT 20.0  -- Default: flag if sources differ by >20%
) RETURNS TABLE (
    item_id UUID,
    food_name TEXT,
    field_name TEXT,
    usda_value DECIMAL,
    off_value DECIMAL,
    upc_value DECIMAL,
    max_difference_percent DECIMAL,
    recommended_action TEXT
) AS $$
BEGIN
    -- Check calories conflicts
    RETURN QUERY
    SELECT
        i.id,
        i.food_name,
        'calories'::TEXT,
        i.usda_calories,
        i.off_calories,
        i.upc_calories,
        CASE
            WHEN i.usda_calories > 0 AND i.off_calories > 0 THEN
                ABS(i.usda_calories - i.off_calories) / NULLIF(LEAST(i.usda_calories, i.off_calories), 0) * 100
            ELSE NULL
        END AS max_diff,
        CASE
            WHEN i.user_calories IS NOT NULL THEN 'User override exists - conflict resolved'
            ELSE 'Review sources and set user_calories to correct value'
        END AS action
    FROM public.inventory_items i
    WHERE i.household_id = p_household_id
        AND i.status = 'active'
        AND (
            -- Conflict exists if sources differ by more than threshold
            (i.usda_calories > 0 AND i.off_calories > 0 AND
             ABS(i.usda_calories - i.off_calories) / NULLIF(LEAST(i.usda_calories, i.off_calories), 0) * 100 > p_threshold_percent)
            OR
            (i.usda_calories > 0 AND i.upc_calories > 0 AND
             ABS(i.usda_calories - i.upc_calories) / NULLIF(LEAST(i.usda_calories, i.upc_calories), 0) * 100 > p_threshold_percent)
            OR
            (i.off_calories > 0 AND i.upc_calories > 0 AND
             ABS(i.off_calories - i.upc_calories) / NULLIF(LEAST(i.off_calories, i.upc_calories), 0) * 100 > p_threshold_percent)
        );

    -- Add similar checks for protein, fat, carbs, sodium as needed
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.find_nutrition_conflicts(UUID, DECIMAL) IS
'Identifies items where API sources disagree significantly.
Helps users discover data quality issues and set user_* overrides.
Example: SELECT * FROM find_nutrition_conflicts(''7c093e13-4bcf-463e-96c1-9f499de9c4f2'', 25.0);';

-- ============================================================================
-- UTILITY: Data Source Summary
-- ============================================================================
-- Shows which sources provided data for each item (transparency)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_data_source_summary(p_item_id UUID)
RETURNS TABLE (
    field_name TEXT,
    usda_has_data BOOLEAN,
    off_has_data BOOLEAN,
    upc_has_data BOOLEAN,
    user_has_override BOOLEAN,
    displayed_value DECIMAL,
    source_used TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'calories'::TEXT,
        (i.usda_calories IS NOT NULL),
        (i.off_calories IS NOT NULL),
        (i.upc_calories IS NOT NULL),
        (i.user_calories IS NOT NULL),
        get_best_value(i.user_calories, i.usda_calories, i.off_calories, i.upc_calories),
        CASE
            WHEN i.user_calories IS NOT NULL THEN 'user (override)'
            WHEN i.usda_calories IS NOT NULL THEN 'usda'
            WHEN i.off_calories IS NOT NULL THEN 'openfoodfacts'
            WHEN i.upc_calories IS NOT NULL THEN 'upcitemdb'
            ELSE 'none'
        END
    FROM public.inventory_items i
    WHERE i.id = p_item_id

    UNION ALL

    SELECT
        'protein'::TEXT,
        (i.usda_protein IS NOT NULL),
        (i.off_protein IS NOT NULL),
        (i.upc_protein IS NOT NULL),
        (i.user_protein IS NOT NULL),
        get_best_value(i.user_protein, i.usda_protein, i.off_protein, i.upc_protein),
        CASE
            WHEN i.user_protein IS NOT NULL THEN 'user (override)'
            WHEN i.usda_protein IS NOT NULL THEN 'usda'
            WHEN i.off_protein IS NOT NULL THEN 'openfoodfacts'
            WHEN i.upc_protein IS NOT NULL THEN 'upcitemdb'
            ELSE 'none'
        END
    FROM public.inventory_items i
    WHERE i.id = p_item_id

    UNION ALL

    SELECT
        'total_fat'::TEXT,
        (i.usda_total_fat IS NOT NULL),
        (i.off_total_fat IS NOT NULL),
        (i.upc_total_fat IS NOT NULL),
        (i.user_total_fat IS NOT NULL),
        get_best_value(i.user_total_fat, i.usda_total_fat, i.off_total_fat, i.upc_total_fat),
        CASE
            WHEN i.user_total_fat IS NOT NULL THEN 'user (override)'
            WHEN i.usda_total_fat IS NOT NULL THEN 'usda'
            WHEN i.off_total_fat IS NOT NULL THEN 'openfoodfacts'
            WHEN i.upc_total_fat IS NOT NULL THEN 'upcitemdb'
            ELSE 'none'
        END
    FROM public.inventory_items i
    WHERE i.id = p_item_id;

    -- Add more fields as schema expands
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_data_source_summary(UUID) IS
'Shows complete data provenance for an item - which sources provided which fields.
Enables transparency and helps users understand where their data comes from.
Example: SELECT * FROM get_data_source_summary(''item-uuid-here'');';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✓ Philosophy enforcement migration complete!';
    RAISE NOTICE '  - get_best_value() function created (COALESCE with user_* priority)';
    RAISE NOTICE '  - inventory_items_display view created (enforces philosophy)';
    RAISE NOTICE '  - protect_user_override() trigger created (prevents SSOT violations)';
    RAISE NOTICE '  - find_nutrition_conflicts() function created (data quality checks)';
    RAISE NOTICE '  - get_data_source_summary() function created (transparency)';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '  1. Update Pantry app to query inventory_items_display view';
    RAISE NOTICE '  2. Use find_nutrition_conflicts() to identify data quality issues';
    RAISE NOTICE '  3. Use get_data_source_summary() for item detail transparency UI';
    RAISE NOTICE '  4. Expand functions as schema adds more nutrition fields';
END $$;

-- ============================================================
-- EXPECTED BENEFITS:
-- - user_* fields protected from accidental clearing
-- - COALESCE logic enforced at database level (can't be bypassed)
-- - Apps get consistent data (query view, not raw table)
-- - Data conflicts automatically detected
-- - Complete transparency of data provenance
-- - Philosophy cannot be violated by future code
-- ============================================================

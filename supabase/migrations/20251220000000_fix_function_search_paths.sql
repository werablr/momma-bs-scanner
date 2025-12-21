-- ============================================================================
-- Fix Function Search Path Warnings
-- ============================================================================
-- Add explicit search_path to functions to prevent implicit schema assumptions
-- This fixes security warnings without changing function behavior
-- ============================================================================

-- Fix get_best_value function
CREATE OR REPLACE FUNCTION public.get_best_value(
    user_value DECIMAL,
    usda_value DECIMAL,
    off_value DECIMAL,
    upc_value DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    RETURN COALESCE(user_value, usda_value, off_value, upc_value);
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = public;

COMMENT ON FUNCTION public.get_best_value(DECIMAL, DECIMAL, DECIMAL, DECIMAL) IS
'Returns best value following philosophy: user_* (SSOT) > usda_* > off_* > upc_*
This enforces "Capture Everything, Show the Best" at the database level.
IMMUTABLE: Same inputs always return same output (safe for indexes/views).';

-- Fix protect_user_override trigger function
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

        -- Protect user_sodium
        IF OLD.user_sodium IS NOT NULL AND NEW.user_sodium IS NULL THEN
            NEW.user_sodium := OLD.user_sodium;
            RAISE NOTICE 'Protected user_sodium from being cleared (SSOT enforcement)';
        END IF;

        -- Protect user_total_carbohydrate
        IF OLD.user_total_carbohydrate IS NOT NULL AND NEW.user_total_carbohydrate IS NULL THEN
            NEW.user_total_carbohydrate := OLD.user_total_carbohydrate;
            RAISE NOTICE 'Protected user_total_carbohydrate from being cleared (SSOT enforcement)';
        END IF;

        -- Protect user_dietary_fiber
        IF OLD.user_dietary_fiber IS NOT NULL AND NEW.user_dietary_fiber IS NULL THEN
            NEW.user_dietary_fiber := OLD.user_dietary_fiber;
            RAISE NOTICE 'Protected user_dietary_fiber from being cleared (SSOT enforcement)';
        END IF;

        -- Protect user_sugars
        IF OLD.user_sugars IS NOT NULL AND NEW.user_sugars IS NULL THEN
            NEW.user_sugars := OLD.user_sugars;
            RAISE NOTICE 'Protected user_sugars from being cleared (SSOT enforcement)';
        END IF;

        -- Protect user_saturated_fat
        IF OLD.user_saturated_fat IS NOT NULL AND NEW.user_saturated_fat IS NULL THEN
            NEW.user_saturated_fat := OLD.user_saturated_fat;
            RAISE NOTICE 'Protected user_saturated_fat from being cleared (SSOT enforcement)';
        END IF;

        -- Protect user_potassium
        IF OLD.user_potassium IS NOT NULL AND NEW.user_potassium IS NULL THEN
            NEW.user_potassium := OLD.user_potassium;
            RAISE NOTICE 'Protected user_potassium from being cleared (SSOT enforcement)';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix find_nutrition_conflicts function
CREATE OR REPLACE FUNCTION public.find_nutrition_conflicts(item_id UUID)
RETURNS TABLE (
    field TEXT,
    user_val DECIMAL,
    usda_val DECIMAL,
    off_val DECIMAL,
    upc_val DECIMAL,
    conflict_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (
        SELECT
            'calories'::TEXT as field,
            i.user_calories as user_val,
            i.usda_calories as usda_val,
            i.off_calories as off_val,
            i.upc_calories as upc_val,
            CASE
                WHEN i.user_calories IS NOT NULL AND
                     (i.usda_calories IS NOT NULL OR i.off_calories IS NOT NULL OR i.upc_calories IS NOT NULL) AND
                     i.user_calories <> COALESCE(i.usda_calories, i.off_calories, i.upc_calories)
                THEN 'user_override'
                WHEN i.usda_calories IS NOT NULL AND i.off_calories IS NOT NULL AND
                     abs(i.usda_calories - i.off_calories) > 10
                THEN 'source_mismatch'
                ELSE 'no_conflict'
            END as conflict_type
        FROM public.inventory_items i
        WHERE i.id = item_id

        UNION ALL

        SELECT
            'protein'::TEXT,
            i.user_protein,
            i.usda_protein,
            i.off_protein,
            i.upc_protein,
            CASE
                WHEN i.user_protein IS NOT NULL AND
                     (i.usda_protein IS NOT NULL OR i.off_protein IS NOT NULL OR i.upc_protein IS NOT NULL) AND
                     i.user_protein <> COALESCE(i.usda_protein, i.off_protein, i.upc_protein)
                THEN 'user_override'
                WHEN i.usda_protein IS NOT NULL AND i.off_protein IS NOT NULL AND
                     abs(i.usda_protein - i.off_protein) > 5
                THEN 'source_mismatch'
                ELSE 'no_conflict'
            END
        FROM public.inventory_items i
        WHERE i.id = item_id
    ) conflicts
    WHERE conflict_type <> 'no_conflict';
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = public;

COMMENT ON FUNCTION public.find_nutrition_conflicts(UUID) IS
'Identifies conflicts between user overrides and API data.
Returns rows only where conflicts exist (user_override or source_mismatch).
Useful for validation and data quality monitoring.';

-- Fix get_data_source_summary function
-- Must drop first because return type signature is different
DROP FUNCTION IF EXISTS public.get_data_source_summary(UUID);

CREATE FUNCTION public.get_data_source_summary(p_item_id UUID)
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
$$ LANGUAGE plpgsql STABLE
SET search_path = public;

COMMENT ON FUNCTION public.get_data_source_summary(UUID) IS
'Shows complete data provenance for an item - which sources provided which fields.
Enables transparency and helps users understand where their data comes from.
Example: SELECT * FROM get_data_source_summary(''item-uuid-here'');';

-- Fix cleanup_orphaned_photos function
-- Must drop first because return type signature is different
DROP FUNCTION IF EXISTS public.cleanup_orphaned_photos();

CREATE FUNCTION public.cleanup_orphaned_photos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete photos from storage that are not referenced in inventory_items
  DELETE FROM storage.objects
  WHERE bucket_id = 'user-food-photos'
    AND name NOT IN (
      SELECT photo_thumb FROM inventory_items WHERE photo_thumb IS NOT NULL
      UNION
      SELECT photo_highres FROM inventory_items WHERE photo_highres IS NOT NULL
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup operation
  INSERT INTO edge_function_logs (function_name, log_level, message, metadata)
  VALUES (
    'cleanup_orphaned_photos',
    'info',
    'Cleaned up orphaned photos',
    jsonb_build_object('deleted_count', deleted_count)
  );

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_orphaned_photos() IS
'Identifies and cleans up photos in storage that are not referenced by any inventory items.
Runs via pg_cron job at 3am UTC daily.
Returns count of deleted photos.';

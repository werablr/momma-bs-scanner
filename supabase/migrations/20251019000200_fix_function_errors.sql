-- Migration: Fix function errors from previous migration
-- Purpose: Fix variable scope error in archive_inventory_item and unused variable in upsert_product_catalog

-- ============================================================================
-- Fix archive_inventory_item - Variable Scope Error
-- ============================================================================

DROP FUNCTION IF EXISTS archive_inventory_item(UUID, DATE, TEXT, TEXT);

CREATE OR REPLACE FUNCTION archive_inventory_item(
    p_item_id UUID,
    p_consumed_date DATE DEFAULT CURRENT_DATE,
    p_waste_reason TEXT DEFAULT 'consumed',
    p_usage_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_history_id UUID;
    v_days_in_inventory INTEGER;
BEGIN
    -- Get the inventory item
    SELECT * INTO v_item
    FROM public.inventory_items
    WHERE id = p_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory item not found: %', p_item_id;
    END IF;

    -- Calculate days in inventory (use scanned_at or created_at as start date)
    v_days_in_inventory := p_consumed_date - COALESCE(v_item.scanned_at::DATE, v_item.created_at::DATE);

    -- Copy to inventory_history
    INSERT INTO public.inventory_history
    SELECT
        id, created_at, updated_at, household_id, barcode, scanned_at,
        food_name, brand_name, nix_brand_id, nix_item_id,
        serving_qty, serving_unit, serving_weight_grams,
        nf_calories, nf_total_fat, nf_saturated_fat, nf_cholesterol,
        nf_sodium, nf_total_carbohydrate, nf_dietary_fiber, nf_sugars,
        nf_protein, nf_potassium, photo_thumb, photo_highres,
        ndb_no, source, full_nutrients, alt_measures, tags,
        storage_location_id, expiration_date, ocr_text, ocr_confidence,
        ocr_processing_time_ms, purchase_date, price, location_purchased,
        volume_purchased, volume_unit, volume_remaining, status, notes,
        now() as archived_at,
        p_consumed_date as consumed_date,
        v_days_in_inventory as days_in_inventory,
        p_waste_reason as waste_reason,
        p_usage_notes as usage_notes
    FROM public.inventory_items
    WHERE id = p_item_id
    RETURNING id INTO v_history_id;

    -- Delete from inventory_items
    DELETE FROM public.inventory_items WHERE id = p_item_id;

    RETURN v_history_id;
END;
$$;

-- ============================================================================
-- Fix upsert_product_catalog - Remove Unused Variable
-- ============================================================================

DROP FUNCTION IF EXISTS upsert_product_catalog(TEXT, DECIMAL, TEXT, BOOLEAN, TEXT, JSONB, TEXT, TEXT, JSONB, JSONB, JSONB);

CREATE OR REPLACE FUNCTION upsert_product_catalog(
    p_barcode TEXT,
    p_package_size DECIMAL DEFAULT NULL,
    p_package_unit TEXT DEFAULT NULL,
    p_verified_by_user BOOLEAN DEFAULT false,
    p_source_priority TEXT DEFAULT NULL,
    p_data_sources JSONB DEFAULT NULL,
    p_product_name TEXT DEFAULT NULL,
    p_brand_name TEXT DEFAULT NULL,
    p_nutritionix_data JSONB DEFAULT NULL,
    p_upcitemdb_data JSONB DEFAULT NULL,
    p_openfoodfacts_data JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if product exists
    SELECT EXISTS(
        SELECT 1 FROM public.product_catalog WHERE barcode = p_barcode
    ) INTO v_exists;

    IF v_exists THEN
        -- Update existing record
        UPDATE public.product_catalog
        SET
            package_size = COALESCE(p_package_size, package_size),
            package_unit = COALESCE(p_package_unit, package_unit),
            verified_by_user = CASE WHEN p_verified_by_user THEN true ELSE verified_by_user END,
            verification_count = CASE WHEN p_verified_by_user THEN verification_count + 1 ELSE verification_count END,
            verified_at = CASE WHEN p_verified_by_user THEN now() ELSE verified_at END,
            last_seen = now(),
            updated_at = now(),
            source_priority = COALESCE(p_source_priority, source_priority),
            data_sources = COALESCE(p_data_sources, data_sources),
            product_name = COALESCE(p_product_name, product_name),
            brand_name = COALESCE(p_brand_name, brand_name),
            nutritionix_data = COALESCE(p_nutritionix_data, nutritionix_data),
            upcitemdb_data = COALESCE(p_upcitemdb_data, upcitemdb_data),
            openfoodfacts_data = COALESCE(p_openfoodfacts_data, openfoodfacts_data)
        WHERE barcode = p_barcode;
    ELSE
        -- Insert new record
        INSERT INTO public.product_catalog (
            barcode, package_size, package_unit, verified_by_user, source_priority,
            data_sources, product_name, brand_name, nutritionix_data,
            upcitemdb_data, openfoodfacts_data
        ) VALUES (
            p_barcode, p_package_size, p_package_unit, p_verified_by_user, p_source_priority,
            p_data_sources, p_product_name, p_brand_name, p_nutritionix_data,
            p_upcitemdb_data, p_openfoodfacts_data
        );
    END IF;

    RETURN p_barcode;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION archive_inventory_item IS 'Move inventory item to history table (FIXED: variable scope)';
COMMENT ON FUNCTION upsert_product_catalog IS 'Insert or update product catalog entry (FIXED: unused variable)';

-- Migration: Fix function search_path security warnings
-- Purpose: Add SET search_path = public to all functions to prevent SQL injection
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- Fix get_household_health_score
-- ============================================================================
CREATE OR REPLACE FUNCTION get_household_health_score(p_household_id UUID)
RETURNS TABLE (
    avg_nutriscore_value DECIMAL,
    avg_nova_group DECIMAL,
    pct_vegan DECIMAL,
    pct_vegetarian DECIMAL,
    total_items INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        AVG(CASE nutriscore_grade
            WHEN 'a' THEN 5
            WHEN 'b' THEN 4
            WHEN 'c' THEN 3
            WHEN 'd' THEN 2
            WHEN 'e' THEN 1
            ELSE 0
        END)::DECIMAL,
        AVG(nova_group)::DECIMAL,
        (COUNT(*) FILTER (WHERE is_vegan = true) * 100.0 / NULLIF(COUNT(*), 0))::DECIMAL,
        (COUNT(*) FILTER (WHERE is_vegetarian = true) * 100.0 / NULLIF(COUNT(*), 0))::DECIMAL,
        COUNT(*)::INTEGER
    FROM public.inventory_items
    WHERE household_id = p_household_id
      AND status = 'active';
END;
$$;

-- ============================================================================
-- Fix get_price_trends
-- ============================================================================
CREATE OR REPLACE FUNCTION get_price_trends(p_barcode TEXT)
RETURNS TABLE (
    current_price DECIMAL,
    lowest_price DECIMAL,
    highest_price DECIMAL,
    avg_price DECIMAL,
    price_variance DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.current_price,
        i.lowest_recorded_price,
        i.highest_recorded_price,
        AVG(i.current_price) OVER (PARTITION BY i.barcode)::DECIMAL,
        STDDEV(i.current_price) OVER (PARTITION BY i.barcode)::DECIMAL
    FROM public.inventory_items i
    WHERE i.barcode = p_barcode
    LIMIT 1;
END;
$$;

-- ============================================================================
-- Fix upsert_product_catalog
-- ============================================================================

-- Drop the existing function first (return type changed from UUID to TEXT)
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
-- Fix get_product_from_catalog
-- ============================================================================
CREATE OR REPLACE FUNCTION get_product_from_catalog(p_barcode TEXT)
RETURNS TABLE (
    barcode TEXT,
    package_size DECIMAL,
    package_unit TEXT,
    servings_per_container DECIMAL,
    verified_by_user BOOLEAN,
    source_priority TEXT,
    data_sources JSONB,
    product_name TEXT,
    brand_name TEXT,
    nutritionix_data JSONB,
    upcitemdb_data JSONB,
    openfoodfacts_data JSONB,
    last_seen TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update last_seen timestamp
    UPDATE public.product_catalog
    SET last_seen = now()
    WHERE product_catalog.barcode = p_barcode;

    -- Return product data
    RETURN QUERY
    SELECT
        pc.barcode,
        pc.package_size,
        pc.package_unit,
        pc.servings_per_container,
        pc.verified_by_user,
        pc.source_priority,
        pc.data_sources,
        pc.product_name,
        pc.brand_name,
        pc.nutritionix_data,
        pc.upcitemdb_data,
        pc.openfoodfacts_data,
        pc.last_seen
    FROM public.product_catalog pc
    WHERE pc.barcode = p_barcode;
END;
$$;

-- ============================================================================
-- Fix archive_inventory_item (from previous migrations)
-- ============================================================================

-- Drop existing function first (return type changed from VOID to UUID)
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
-- Fix update_updated_at_column
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION get_household_health_score IS 'Calculate health metrics for a household inventory (SECURITY: search_path set to public)';
COMMENT ON FUNCTION get_price_trends IS 'Analyze price trends for a specific product (SECURITY: search_path set to public)';
COMMENT ON FUNCTION upsert_product_catalog IS 'Insert or update product catalog entry with user verification tracking (SECURITY: search_path set to public)';
COMMENT ON FUNCTION get_product_from_catalog IS 'Get product from catalog and update last_seen timestamp (SECURITY: search_path set to public)';
COMMENT ON FUNCTION archive_inventory_item IS 'Move inventory item to history table (SECURITY: search_path set to public)';
COMMENT ON FUNCTION update_updated_at_column IS 'Trigger function to auto-update updated_at timestamp (SECURITY: search_path set to public)';

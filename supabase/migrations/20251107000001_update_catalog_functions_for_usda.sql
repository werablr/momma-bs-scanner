-- Migration: Update product_catalog functions to support USDA data
-- Date: November 7, 2025
-- Purpose: Add usda_data parameter to RPC functions for USDA API integration

-- Update upsert_product_catalog function to accept usda_data
CREATE OR REPLACE FUNCTION upsert_product_catalog(
    p_barcode TEXT,
    p_package_size DECIMAL DEFAULT NULL,
    p_package_unit TEXT DEFAULT NULL,
    p_verified_by_user BOOLEAN DEFAULT false,
    p_source_priority TEXT DEFAULT NULL,
    p_data_sources JSONB DEFAULT NULL,
    p_product_name TEXT DEFAULT NULL,
    p_brand_name TEXT DEFAULT NULL,
    p_nutritionix_data JSONB DEFAULT NULL,  -- DEPRECATED but kept for backward compatibility
    p_upcitemdb_data JSONB DEFAULT NULL,
    p_openfoodfacts_data JSONB DEFAULT NULL,
    p_usda_data JSONB DEFAULT NULL,  -- NEW: USDA FoodData Central API response
    p_usda_fdc_id INTEGER DEFAULT NULL  -- NEW: USDA Food Data Central ID
)
RETURNS UUID AS $$
DECLARE
    existing_record RECORD;
BEGIN
    -- Check if product exists
    SELECT * INTO existing_record
    FROM public.product_catalog
    WHERE barcode = p_barcode;

    IF FOUND THEN
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
            openfoodfacts_data = COALESCE(p_openfoodfacts_data, openfoodfacts_data),
            usda_data = COALESCE(p_usda_data, usda_data),
            usda_fdc_id = COALESCE(p_usda_fdc_id, usda_fdc_id)
        WHERE barcode = p_barcode;
    ELSE
        -- Insert new record
        INSERT INTO public.product_catalog (
            barcode, package_size, package_unit, verified_by_user, source_priority,
            data_sources, product_name, brand_name, nutritionix_data,
            upcitemdb_data, openfoodfacts_data, usda_data, usda_fdc_id
        ) VALUES (
            p_barcode, p_package_size, p_package_unit, p_verified_by_user, p_source_priority,
            p_data_sources, p_product_name, p_brand_name, p_nutritionix_data,
            p_upcitemdb_data, p_openfoodfacts_data, p_usda_data, p_usda_fdc_id
        );
    END IF;

    RETURN (SELECT barcode FROM public.product_catalog WHERE barcode = p_barcode);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_product_from_catalog function to return usda_data
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
    nutritionix_data JSONB,  -- DEPRECATED
    upcitemdb_data JSONB,
    openfoodfacts_data JSONB,
    usda_data JSONB,  -- NEW
    usda_fdc_id INTEGER,  -- NEW
    last_seen TIMESTAMP WITH TIME ZONE
) AS $$
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
        pc.usda_data,
        pc.usda_fdc_id,
        pc.last_seen
    FROM public.product_catalog pc
    WHERE pc.barcode = p_barcode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments
COMMENT ON COLUMN public.product_catalog.nutritionix_data IS 'DEPRECATED: Nutritionix subscription expired Nov 2025. Full cached Nutritionix API response (kept for historical data)';
COMMENT ON COLUMN public.product_catalog.usda_data IS 'Full cached USDA FoodData Central API response';
COMMENT ON COLUMN public.product_catalog.usda_fdc_id IS 'USDA Food Data Central ID for direct lookups';

COMMENT ON FUNCTION upsert_product_catalog IS 'Insert or update product catalog entry with multi-source API data (USDA, UPC, OFF) and user verification tracking';
COMMENT ON FUNCTION get_product_from_catalog IS 'Get product from catalog including all API sources and update last_seen timestamp';

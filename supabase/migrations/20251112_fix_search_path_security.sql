-- Fix search_path security warnings for SECURITY DEFINER functions
-- Date: November 12, 2025
-- Issue: Functions with SECURITY DEFINER must have explicit search_path set

-- Drop and recreate functions with SET search_path

DROP FUNCTION IF EXISTS upsert_product_catalog(TEXT, DECIMAL, TEXT, BOOLEAN, TEXT, JSONB, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, INTEGER);
DROP FUNCTION IF EXISTS get_product_from_catalog(TEXT);

-- Recreate upsert_product_catalog with search_path
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
    p_openfoodfacts_data JSONB DEFAULT NULL,
    p_usda_data JSONB DEFAULT NULL,
    p_usda_fdc_id INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    existing_record RECORD;
BEGIN
    -- Check if product exists
    SELECT * INTO existing_record
    FROM product_catalog
    WHERE barcode = p_barcode;

    IF FOUND THEN
        -- Update existing record
        UPDATE product_catalog
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
        INSERT INTO product_catalog (
            barcode, package_size, package_unit, verified_by_user, source_priority,
            data_sources, product_name, brand_name, nutritionix_data,
            upcitemdb_data, openfoodfacts_data, usda_data, usda_fdc_id
        ) VALUES (
            p_barcode, p_package_size, p_package_unit, p_verified_by_user, p_source_priority,
            p_data_sources, p_product_name, p_brand_name, p_nutritionix_data,
            p_upcitemdb_data, p_openfoodfacts_data, p_usda_data, p_usda_fdc_id
        );
    END IF;

    RETURN (SELECT barcode FROM product_catalog WHERE barcode = p_barcode);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Recreate get_product_from_catalog with search_path
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
    usda_data JSONB,
    usda_fdc_id INTEGER,
    last_seen TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Update last_seen timestamp
    UPDATE product_catalog
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
    FROM product_catalog pc
    WHERE pc.barcode = p_barcode;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Update comments
COMMENT ON FUNCTION upsert_product_catalog IS 'Insert or update product catalog entry with multi-source API data (SECURITY: search_path = public)';
COMMENT ON FUNCTION get_product_from_catalog IS 'Get product from catalog including all API sources (SECURITY: search_path = public)';

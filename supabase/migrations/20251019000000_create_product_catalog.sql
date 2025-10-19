-- Migration: Create product_catalog table for caching and rate limit management
-- Purpose: Store user-verified package sizes and API data to avoid re-calling APIs
-- Benefits: Solves UPCitemdb 100/day rate limit, faster scans, user-verified accuracy

-- ============================================================================
-- PRODUCT_CATALOG: User-Verified Product Database
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_catalog (
    -- Primary key
    barcode TEXT PRIMARY KEY,

    -- Package information (user-verified or parsed from APIs)
    package_size DECIMAL,
    package_unit TEXT,  -- oz, g, lb, ml, L, etc.
    package_weight TEXT,  -- From UPCitemdb (e.g., "3 Pounds")
    package_dimensions TEXT,  -- From UPCitemdb (e.g., "10 X 4 X 5 inches")
    servings_per_container DECIMAL,  -- Calculated or user-entered

    -- Product identifiers
    asin TEXT,  -- Amazon Standard Identification Number
    model_number TEXT,
    nix_item_id TEXT,  -- Nutritionix item ID
    nix_brand_id TEXT,  -- Nutritionix brand ID

    -- Pricing (latest known)
    current_price DECIMAL(10, 2),
    lowest_recorded_price DECIMAL(10, 2),
    highest_recorded_price DECIMAL(10, 2),

    -- Health scores (from Open Food Facts)
    nutriscore_grade TEXT CHECK (nutriscore_grade IN ('a', 'b', 'c', 'd', 'e', 'unknown')),
    nova_group INTEGER CHECK (nova_group BETWEEN 1 AND 4),
    ecoscore_grade TEXT CHECK (ecoscore_grade IN ('a', 'b', 'c', 'd', 'e', 'unknown')),

    -- Dietary flags
    is_vegan BOOLEAN,
    is_vegetarian BOOLEAN,
    is_palm_oil_free BOOLEAN,
    allergens TEXT,

    -- Product metadata
    product_name TEXT,
    brand_name TEXT,
    category_path TEXT,

    -- Verification tracking
    verified_by_user BOOLEAN DEFAULT true,  -- True if user confirmed/corrected
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    verification_count INTEGER DEFAULT 1,  -- How many times users verified this
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),  -- Last time scanned

    -- Data source tracking
    data_sources JSONB,  -- {nutritionix: true, upcitemdb: true, openfoodfacts: true}
    source_priority TEXT,  -- Where package_size came from: "user_verified", "catalog", "open_food_facts", "title_parsed", "manual"

    -- Full API responses (cached for future reference)
    nutritionix_data JSONB,
    upcitemdb_data JSONB,
    openfoodfacts_data JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- INDEXES for Fast Lookups
-- ============================================================================

-- Primary lookup by barcode (already indexed as PRIMARY KEY)

-- Verification status for admin/analytics
CREATE INDEX IF NOT EXISTS product_catalog_verified_idx
    ON public.product_catalog(verified_by_user);

-- Find unverified products needing user confirmation
CREATE INDEX IF NOT EXISTS product_catalog_needs_verification_idx
    ON public.product_catalog(verified_by_user)
    WHERE verified_by_user = false;

-- Last seen for cache freshness
CREATE INDEX IF NOT EXISTS product_catalog_last_seen_idx
    ON public.product_catalog(last_seen DESC);

-- Brand search
CREATE INDEX IF NOT EXISTS product_catalog_brand_idx
    ON public.product_catalog(brand_name);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read product catalog
-- (This is a shared database - any user can benefit from cached products)
CREATE POLICY "Allow authenticated read access"
    ON public.product_catalog
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow service role full access (for edge function)
CREATE POLICY "Allow service role full access"
    ON public.product_catalog
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Allow anon read access (for initial scans before auth)
CREATE POLICY "Allow anon read access"
    ON public.product_catalog
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update or insert product catalog entry
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

    RETURN (SELECT barcode FROM public.product_catalog WHERE barcode = p_barcode);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get product from catalog
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
        pc.last_seen
    FROM public.product_catalog pc
    WHERE pc.barcode = p_barcode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.product_catalog IS 'Cached product data to avoid re-calling APIs and store user-verified information';
COMMENT ON COLUMN public.product_catalog.barcode IS 'UPC/EAN barcode (primary key)';
COMMENT ON COLUMN public.product_catalog.package_size IS 'Package size number (e.g., 15 from "15 oz")';
COMMENT ON COLUMN public.product_catalog.package_unit IS 'Package size unit (oz, g, lb, ml, L, etc.)';
COMMENT ON COLUMN public.product_catalog.verified_by_user IS 'True if user confirmed or corrected this data';
COMMENT ON COLUMN public.product_catalog.verification_count IS 'Number of times users have verified this product';
COMMENT ON COLUMN public.product_catalog.source_priority IS 'Where package_size came from: user_verified, catalog, open_food_facts, title_parsed, manual';
COMMENT ON COLUMN public.product_catalog.data_sources IS 'Tracks which APIs provided data: {nutritionix: true, upcitemdb: true, openfoodfacts: true}';
COMMENT ON COLUMN public.product_catalog.nutritionix_data IS 'Full cached Nutritionix API response';
COMMENT ON COLUMN public.product_catalog.upcitemdb_data IS 'Full cached UPCitemdb API response';
COMMENT ON COLUMN public.product_catalog.openfoodfacts_data IS 'Full cached Open Food Facts API response';

COMMENT ON FUNCTION upsert_product_catalog IS 'Insert or update product catalog entry with user verification tracking';
COMMENT ON FUNCTION get_product_from_catalog IS 'Get product from catalog and update last_seen timestamp';

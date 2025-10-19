-- Migration: Add extended product fields from triple API strategy
-- Purpose: Capture package, pricing, health, and environmental data
-- Sources: UPCitemdb (pricing/package) + Open Food Facts (health/environment) + Nutritionix (nutrition)

-- ============================================================================
-- INVENTORY_ITEMS: Add Extended Fields
-- ============================================================================

ALTER TABLE public.inventory_items

-- Package Information (UPCitemdb)
ADD COLUMN IF NOT EXISTS package_size DECIMAL,
ADD COLUMN IF NOT EXISTS package_unit TEXT,
ADD COLUMN IF NOT EXISTS package_weight TEXT,
ADD COLUMN IF NOT EXISTS package_dimensions TEXT,
ADD COLUMN IF NOT EXISTS asin TEXT,
ADD COLUMN IF NOT EXISTS model_number TEXT,

-- Pricing Data (UPCitemdb)
ADD COLUMN IF NOT EXISTS current_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS lowest_recorded_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS highest_recorded_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS price_history JSONB,
ADD COLUMN IF NOT EXISTS price_retailers JSONB,

-- Health Scores (Open Food Facts)
ADD COLUMN IF NOT EXISTS nutriscore_grade TEXT CHECK (nutriscore_grade IN ('a', 'b', 'c', 'd', 'e', 'unknown')),
ADD COLUMN IF NOT EXISTS nova_group INTEGER CHECK (nova_group BETWEEN 1 AND 4),
ADD COLUMN IF NOT EXISTS ecoscore_grade TEXT CHECK (ecoscore_grade IN ('a', 'b', 'c', 'd', 'e', 'unknown')),
ADD COLUMN IF NOT EXISTS nutrient_levels JSONB,

-- Dietary Information (Open Food Facts)
ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN,
ADD COLUMN IF NOT EXISTS is_vegetarian BOOLEAN,
ADD COLUMN IF NOT EXISTS is_palm_oil_free BOOLEAN,
ADD COLUMN IF NOT EXISTS allergens TEXT,
ADD COLUMN IF NOT EXISTS traces TEXT,

-- Labels & Certifications (Open Food Facts)
ADD COLUMN IF NOT EXISTS labels TEXT,
ADD COLUMN IF NOT EXISTS labels_tags JSONB,

-- Environmental Data (Open Food Facts)
ADD COLUMN IF NOT EXISTS packaging_type TEXT,
ADD COLUMN IF NOT EXISTS packaging_tags JSONB,
ADD COLUMN IF NOT EXISTS manufacturing_places TEXT,
ADD COLUMN IF NOT EXISTS origins TEXT,
ADD COLUMN IF NOT EXISTS countries TEXT,

-- Product Categorization (UPCitemdb - more detailed than Nutritionix)
ADD COLUMN IF NOT EXISTS category_path TEXT,
ADD COLUMN IF NOT EXISTS product_color TEXT,

-- API Source Tracking
ADD COLUMN IF NOT EXISTS data_sources JSONB;

-- Add comments for documentation
COMMENT ON COLUMN public.inventory_items.package_size IS 'Parsed package size (e.g., 15 from "15 oz")';
COMMENT ON COLUMN public.inventory_items.package_unit IS 'Package unit (oz, g, lb, ml, L, etc.)';
COMMENT ON COLUMN public.inventory_items.package_weight IS 'Total package weight from UPCitemdb';
COMMENT ON COLUMN public.inventory_items.package_dimensions IS 'Physical dimensions (e.g., "10 X 4 X 5 inches")';
COMMENT ON COLUMN public.inventory_items.nutriscore_grade IS 'Nutri-Score health rating (A=best, E=worst)';
COMMENT ON COLUMN public.inventory_items.nova_group IS 'NOVA food processing level (1=unprocessed, 4=ultra-processed)';
COMMENT ON COLUMN public.inventory_items.ecoscore_grade IS 'Environmental impact score (A=best, E=worst)';
COMMENT ON COLUMN public.inventory_items.nutrient_levels IS 'Nutrient level indicators: {fat: "low", salt: "moderate", sugars: "low"}';
COMMENT ON COLUMN public.inventory_items.price_history IS 'Historical pricing data from UPCitemdb offers';
COMMENT ON COLUMN public.inventory_items.data_sources IS 'Tracks which APIs provided data: {nutritionix: true, upcitemdb: true, openfoodfacts: true}';

-- ============================================================================
-- INVENTORY_HISTORY: Add Same Extended Fields
-- ============================================================================

ALTER TABLE public.inventory_history

-- Package Information
ADD COLUMN IF NOT EXISTS package_size DECIMAL,
ADD COLUMN IF NOT EXISTS package_unit TEXT,
ADD COLUMN IF NOT EXISTS package_weight TEXT,
ADD COLUMN IF NOT EXISTS package_dimensions TEXT,
ADD COLUMN IF NOT EXISTS asin TEXT,
ADD COLUMN IF NOT EXISTS model_number TEXT,

-- Pricing Data
ADD COLUMN IF NOT EXISTS current_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS lowest_recorded_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS highest_recorded_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS price_history JSONB,
ADD COLUMN IF NOT EXISTS price_retailers JSONB,

-- Health Scores
ADD COLUMN IF NOT EXISTS nutriscore_grade TEXT CHECK (nutriscore_grade IN ('a', 'b', 'c', 'd', 'e', 'unknown')),
ADD COLUMN IF NOT EXISTS nova_group INTEGER CHECK (nova_group BETWEEN 1 AND 4),
ADD COLUMN IF NOT EXISTS ecoscore_grade TEXT CHECK (ecoscore_grade IN ('a', 'b', 'c', 'd', 'e', 'unknown')),
ADD COLUMN IF NOT EXISTS nutrient_levels JSONB,

-- Dietary Information
ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN,
ADD COLUMN IF NOT EXISTS is_vegetarian BOOLEAN,
ADD COLUMN IF NOT EXISTS is_palm_oil_free BOOLEAN,
ADD COLUMN IF NOT EXISTS allergens TEXT,
ADD COLUMN IF NOT EXISTS traces TEXT,

-- Labels & Certifications
ADD COLUMN IF NOT EXISTS labels TEXT,
ADD COLUMN IF NOT EXISTS labels_tags JSONB,

-- Environmental Data
ADD COLUMN IF NOT EXISTS packaging_type TEXT,
ADD COLUMN IF NOT EXISTS packaging_tags JSONB,
ADD COLUMN IF NOT EXISTS manufacturing_places TEXT,
ADD COLUMN IF NOT EXISTS origins TEXT,
ADD COLUMN IF NOT EXISTS countries TEXT,

-- Product Categorization
ADD COLUMN IF NOT EXISTS category_path TEXT,
ADD COLUMN IF NOT EXISTS product_color TEXT,

-- API Source Tracking
ADD COLUMN IF NOT EXISTS data_sources JSONB;

-- ============================================================================
-- INDEXES for Analytics Queries
-- ============================================================================

-- Health & Quality Indexes
CREATE INDEX IF NOT EXISTS inventory_items_nutriscore_idx ON public.inventory_items(nutriscore_grade);
CREATE INDEX IF NOT EXISTS inventory_items_nova_group_idx ON public.inventory_items(nova_group);
CREATE INDEX IF NOT EXISTS inventory_items_ecoscore_idx ON public.inventory_items(ecoscore_grade);

-- Dietary Indexes
CREATE INDEX IF NOT EXISTS inventory_items_vegan_idx ON public.inventory_items(is_vegan) WHERE is_vegan = true;
CREATE INDEX IF NOT EXISTS inventory_items_vegetarian_idx ON public.inventory_items(is_vegetarian) WHERE is_vegetarian = true;

-- Pricing Indexes
CREATE INDEX IF NOT EXISTS inventory_items_price_idx ON public.inventory_items(current_price);

-- Origin & Environmental Indexes
CREATE INDEX IF NOT EXISTS inventory_items_origins_idx ON public.inventory_items(origins);
CREATE INDEX IF NOT EXISTS inventory_items_packaging_idx ON public.inventory_items(packaging_type);

-- History table indexes for analytics
CREATE INDEX IF NOT EXISTS inventory_history_nutriscore_idx ON public.inventory_history(nutriscore_grade);
CREATE INDEX IF NOT EXISTS inventory_history_nova_group_idx ON public.inventory_history(nova_group);
CREATE INDEX IF NOT EXISTS inventory_history_price_idx ON public.inventory_history(current_price);

-- ============================================================================
-- Helper Functions for Analytics
-- ============================================================================

-- Function to calculate average Nutri-Score for household
CREATE OR REPLACE FUNCTION get_household_health_score(p_household_id UUID)
RETURNS TABLE (
    avg_nutriscore_value DECIMAL,
    avg_nova_group DECIMAL,
    pct_vegan DECIMAL,
    pct_vegetarian DECIMAL,
    total_items INTEGER
) AS $$
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
$$ LANGUAGE plpgsql;

-- Function to get price trends
CREATE OR REPLACE FUNCTION get_price_trends(p_barcode TEXT)
RETURNS TABLE (
    current_price DECIMAL,
    lowest_price DECIMAL,
    highest_price DECIMAL,
    avg_price DECIMAL,
    price_variance DECIMAL
) AS $$
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_household_health_score IS 'Calculate health metrics for a household inventory';
COMMENT ON FUNCTION get_price_trends IS 'Analyze price trends for a specific product';

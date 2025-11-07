-- Migration: Recreate inventory tables with multi-source data provenance
-- Date: November 7, 2025
-- Purpose: Fresh start with clean schema - USDA + OFF + UPC + USER sources
-- Note: This drops existing tables (22 test items will be lost - acceptable)

-- ============================================================================
-- DROP EXISTING TABLES (Fresh Start)
-- ============================================================================

DROP TABLE IF EXISTS public.inventory_history CASCADE;
DROP TABLE IF EXISTS public.inventory_items CASCADE;

-- ============================================================================
-- INVENTORY_ITEMS TABLE (Active Inventory)
-- ============================================================================

CREATE TABLE public.inventory_items (
    -- Primary identifiers
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Household tracking
    household_id UUID NOT NULL,

    -- Barcode scan data
    barcode TEXT NOT NULL,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Basic product info
    food_name TEXT,
    brand_name TEXT,

    -- Serving information
    serving_qty DECIMAL,
    serving_unit TEXT,
    serving_weight_grams DECIMAL,

    -- ========================================================================
    -- MULTI-SOURCE NUTRITION DATA (Data Provenance)
    -- ========================================================================

    -- USER INPUT (highest priority when present)
    user_calories DECIMAL,
    user_protein DECIMAL,
    user_total_fat DECIMAL,
    user_saturated_fat DECIMAL,
    user_trans_fat DECIMAL,
    user_cholesterol DECIMAL,
    user_sodium DECIMAL,
    user_total_carbohydrate DECIMAL,
    user_dietary_fiber DECIMAL,
    user_sugars DECIMAL,
    user_potassium DECIMAL,
    user_verified_at TIMESTAMP WITH TIME ZONE,
    user_notes TEXT,

    -- USDA FoodData Central (government source)
    usda_calories DECIMAL,
    usda_protein DECIMAL,
    usda_total_fat DECIMAL,
    usda_saturated_fat DECIMAL,
    usda_trans_fat DECIMAL,
    usda_cholesterol DECIMAL,
    usda_sodium DECIMAL,
    usda_total_carbohydrate DECIMAL,
    usda_dietary_fiber DECIMAL,
    usda_sugars DECIMAL,
    usda_added_sugars DECIMAL,
    usda_potassium DECIMAL,
    usda_vitamin_d DECIMAL,
    usda_calcium DECIMAL,
    usda_iron DECIMAL,
    usda_fdc_id INTEGER,
    usda_raw_data JSONB,

    -- Open Food Facts (community source)
    off_calories DECIMAL,
    off_protein DECIMAL,
    off_total_fat DECIMAL,
    off_saturated_fat DECIMAL,
    off_trans_fat DECIMAL,
    off_sodium DECIMAL,
    off_total_carbohydrate DECIMAL,
    off_dietary_fiber DECIMAL,
    off_sugars DECIMAL,
    off_potassium DECIMAL,

    -- UPCitemdb (commercial source)
    upc_calories DECIMAL,
    upc_protein DECIMAL,
    upc_total_fat DECIMAL,
    upc_sodium DECIMAL,

    -- ========================================================================
    -- SINGLE SOURCE OF TRUTH (Displayed Values)
    -- ========================================================================
    -- Auto-selected: USER > USDA > OFF > UPC (temporary logic)

    nf_calories DECIMAL,
    nf_total_fat DECIMAL,
    nf_saturated_fat DECIMAL,
    nf_cholesterol DECIMAL,
    nf_sodium DECIMAL,
    nf_total_carbohydrate DECIMAL,
    nf_dietary_fiber DECIMAL,
    nf_sugars DECIMAL,
    nf_protein DECIMAL,
    nf_potassium DECIMAL,

    -- ========================================================================
    -- PHOTOS & MEDIA
    -- ========================================================================

    photo_thumb TEXT,
    photo_highres TEXT,

    -- ========================================================================
    -- PACKAGE INFORMATION
    -- ========================================================================

    package_size DECIMAL,
    package_unit TEXT,

    -- ========================================================================
    -- HEALTH SCORES (from Open Food Facts)
    -- ========================================================================

    nutriscore_grade TEXT CHECK (nutriscore_grade IN ('a', 'b', 'c', 'd', 'e')),
    nova_group INTEGER CHECK (nova_group BETWEEN 1 AND 4),
    ecoscore_grade TEXT CHECK (ecoscore_grade IN ('a', 'b', 'c', 'd', 'e')),
    nutrient_levels JSONB,

    -- ========================================================================
    -- DIETARY INFORMATION (from Open Food Facts)
    -- ========================================================================

    is_vegan BOOLEAN,
    is_vegetarian BOOLEAN,
    is_palm_oil_free BOOLEAN,
    allergens TEXT,
    traces TEXT,

    -- ========================================================================
    -- LABELS & CERTIFICATIONS (from Open Food Facts)
    -- ========================================================================

    labels TEXT,
    labels_tags JSONB,

    -- ========================================================================
    -- ENVIRONMENTAL DATA (from Open Food Facts)
    -- ========================================================================

    packaging_type TEXT,
    packaging_tags JSONB,
    manufacturing_places TEXT,
    origins TEXT,
    countries TEXT,

    -- ========================================================================
    -- RAW API RESPONSES (for debugging)
    -- ========================================================================

    openfoodfacts_raw_data JSONB,
    upcitemdb_raw_data JSONB,

    -- ========================================================================
    -- STORAGE & EXPIRATION
    -- ========================================================================

    storage_location_id UUID REFERENCES public.storage_locations(id),
    expiration_date DATE,

    -- OCR data for expiration date capture
    ocr_text TEXT,
    ocr_confidence DECIMAL,
    ocr_processing_time_ms INTEGER,

    -- ========================================================================
    -- PURCHASE TRACKING (from receipts)
    -- ========================================================================

    purchase_date DATE,
    price DECIMAL(10, 2),
    location_purchased TEXT,
    receipt_id UUID,

    -- ========================================================================
    -- VOLUME TRACKING
    -- ========================================================================

    volume_remaining DECIMAL CHECK (volume_remaining IN (0, 25, 50, 75, 100)),

    -- ========================================================================
    -- DATA SOURCES TRACKING
    -- ========================================================================

    data_sources JSONB,

    -- ========================================================================
    -- STATUS & NOTES
    -- ========================================================================

    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'low', 'expired', 'consumed')),
    notes TEXT
);

-- ============================================================================
-- INVENTORY_HISTORY TABLE (Consumed/Archived Items)
-- ============================================================================

CREATE TABLE public.inventory_history (
    -- Same structure as inventory_items
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    household_id UUID NOT NULL,
    barcode TEXT NOT NULL,
    scanned_at TIMESTAMP WITH TIME ZONE NOT NULL,

    food_name TEXT,
    brand_name TEXT,
    serving_qty DECIMAL,
    serving_unit TEXT,
    serving_weight_grams DECIMAL,

    -- Multi-source nutrition data
    user_calories DECIMAL,
    user_protein DECIMAL,
    user_total_fat DECIMAL,
    user_saturated_fat DECIMAL,
    user_trans_fat DECIMAL,
    user_cholesterol DECIMAL,
    user_sodium DECIMAL,
    user_total_carbohydrate DECIMAL,
    user_dietary_fiber DECIMAL,
    user_sugars DECIMAL,
    user_potassium DECIMAL,
    user_verified_at TIMESTAMP WITH TIME ZONE,
    user_notes TEXT,

    usda_calories DECIMAL,
    usda_protein DECIMAL,
    usda_total_fat DECIMAL,
    usda_saturated_fat DECIMAL,
    usda_trans_fat DECIMAL,
    usda_cholesterol DECIMAL,
    usda_sodium DECIMAL,
    usda_total_carbohydrate DECIMAL,
    usda_dietary_fiber DECIMAL,
    usda_sugars DECIMAL,
    usda_added_sugars DECIMAL,
    usda_potassium DECIMAL,
    usda_vitamin_d DECIMAL,
    usda_calcium DECIMAL,
    usda_iron DECIMAL,
    usda_fdc_id INTEGER,
    usda_raw_data JSONB,

    off_calories DECIMAL,
    off_protein DECIMAL,
    off_total_fat DECIMAL,
    off_saturated_fat DECIMAL,
    off_trans_fat DECIMAL,
    off_sodium DECIMAL,
    off_total_carbohydrate DECIMAL,
    off_dietary_fiber DECIMAL,
    off_sugars DECIMAL,
    off_potassium DECIMAL,

    upc_calories DECIMAL,
    upc_protein DECIMAL,
    upc_total_fat DECIMAL,
    upc_sodium DECIMAL,

    -- Single source of truth
    nf_calories DECIMAL,
    nf_total_fat DECIMAL,
    nf_saturated_fat DECIMAL,
    nf_cholesterol DECIMAL,
    nf_sodium DECIMAL,
    nf_total_carbohydrate DECIMAL,
    nf_dietary_fiber DECIMAL,
    nf_sugars DECIMAL,
    nf_protein DECIMAL,
    nf_potassium DECIMAL,

    photo_thumb TEXT,
    photo_highres TEXT,
    package_size DECIMAL,
    package_unit TEXT,

    nutriscore_grade TEXT,
    nova_group INTEGER,
    ecoscore_grade TEXT,
    nutrient_levels JSONB,

    is_vegan BOOLEAN,
    is_vegetarian BOOLEAN,
    is_palm_oil_free BOOLEAN,
    allergens TEXT,
    traces TEXT,

    labels TEXT,
    labels_tags JSONB,

    packaging_type TEXT,
    packaging_tags JSONB,
    manufacturing_places TEXT,
    origins TEXT,
    countries TEXT,

    openfoodfacts_raw_data JSONB,
    upcitemdb_raw_data JSONB,

    storage_location_id UUID,
    expiration_date DATE,
    ocr_text TEXT,
    ocr_confidence DECIMAL,
    ocr_processing_time_ms INTEGER,

    purchase_date DATE,
    price DECIMAL(10, 2),
    location_purchased TEXT,
    receipt_id UUID,

    volume_remaining DECIMAL,
    data_sources JSONB,
    status TEXT,
    notes TEXT,

    -- Archive-specific fields
    consumed_date DATE,
    waste_reason TEXT CHECK (waste_reason IN ('consumed', 'expired', 'no_longer_fresh', 'spoiled', 'other')),
    usage_notes TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookups
CREATE INDEX idx_inventory_items_household ON inventory_items(household_id);
CREATE INDEX idx_inventory_items_barcode ON inventory_items(barcode);
CREATE INDEX idx_inventory_items_status ON inventory_items(status);
CREATE INDEX idx_inventory_items_storage ON inventory_items(storage_location_id);
CREATE INDEX idx_inventory_items_expiration ON inventory_items(expiration_date);
CREATE INDEX idx_inventory_items_usda_fdc_id ON inventory_items(usda_fdc_id);

CREATE INDEX idx_inventory_history_household ON inventory_history(household_id);
CREATE INDEX idx_inventory_history_consumed_date ON inventory_history(consumed_date);
CREATE INDEX idx_inventory_history_waste_reason ON inventory_history(waste_reason);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;

-- Policies for inventory_items
CREATE POLICY "Users can view their household inventory"
    ON inventory_items FOR SELECT
    TO authenticated
    USING (household_id = (SELECT household_id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert into their household inventory"
    ON inventory_items FOR INSERT
    TO authenticated
    WITH CHECK (household_id = (SELECT household_id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their household inventory"
    ON inventory_items FOR UPDATE
    TO authenticated
    USING (household_id = (SELECT household_id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Service role has full access to inventory_items"
    ON inventory_items FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policies for inventory_history
CREATE POLICY "Users can view their household history"
    ON inventory_history FOR SELECT
    TO authenticated
    USING (household_id = (SELECT household_id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Service role has full access to inventory_history"
    ON inventory_history FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE inventory_items IS 'Active household inventory with multi-source data provenance (USER, USDA, OFF, UPC)';
COMMENT ON TABLE inventory_history IS 'Archived/consumed items for analytics and history';

-- Multi-source columns
COMMENT ON COLUMN inventory_items.user_calories IS 'User manually entered/corrected value (HIGHEST priority)';
COMMENT ON COLUMN inventory_items.usda_calories IS 'USDA FoodData Central (government source)';
COMMENT ON COLUMN inventory_items.off_calories IS 'Open Food Facts (community source)';
COMMENT ON COLUMN inventory_items.upc_calories IS 'UPCitemdb (commercial source)';
COMMENT ON COLUMN inventory_items.nf_calories IS 'Single Source of Truth: Auto-selected from USER > USDA > OFF > UPC';

COMMENT ON COLUMN inventory_items.user_verified_at IS 'Timestamp when user last verified/corrected nutrition data';
COMMENT ON COLUMN inventory_items.user_notes IS 'User notes about manual corrections';

COMMENT ON COLUMN inventory_items.usda_fdc_id IS 'USDA Food Data Central ID for direct API lookups';
COMMENT ON COLUMN inventory_items.usda_raw_data IS 'Complete USDA API response for debugging';
COMMENT ON COLUMN inventory_items.openfoodfacts_raw_data IS 'Complete Open Food Facts API response';
COMMENT ON COLUMN inventory_items.upcitemdb_raw_data IS 'Complete UPCitemdb API response';

COMMENT ON COLUMN inventory_items.data_sources IS 'Tracks which APIs provided data: {usda: true, upcitemdb: true, openfoodfacts: true}';

-- Migration: Create inventory_items and inventory_history tables
-- Purpose: Single source of truth for active inventory with full Nutritionix data
--          Plus historical tracking for analytics

-- ============================================================================
-- INVENTORY_ITEMS TABLE (Active Inventory)
-- ============================================================================

-- Drop the existing inventory_items table if it exists (clean slate)
DROP TABLE IF EXISTS public.inventory_items CASCADE;

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

    -- Basic product info from Nutritionix
    food_name TEXT,
    brand_name TEXT,
    nix_brand_id TEXT,
    nix_item_id TEXT,

    -- Serving information
    serving_qty DECIMAL,
    serving_unit TEXT,
    serving_weight_grams DECIMAL,

    -- Core nutrition facts (per serving)
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

    -- Additional Nutritionix metadata
    photo_thumb TEXT,
    photo_highres TEXT,
    ndb_no TEXT,
    source INTEGER,

    -- Full nutrients array (stored as JSONB for flexibility)
    full_nutrients JSONB,
    alt_measures JSONB,
    tags JSONB,

    -- Storage and expiration
    storage_location_id UUID REFERENCES public.storage_locations(id),
    expiration_date DATE,

    -- OCR data for expiration date capture
    ocr_text TEXT,
    ocr_confidence DECIMAL,
    ocr_processing_time_ms INTEGER,

    -- Future: Purchase tracking (nullable for now)
    purchase_date DATE,
    price DECIMAL(10, 2),
    location_purchased TEXT,

    -- Future: Volume tracking (nullable for now)
    volume_purchased DECIMAL,
    volume_unit TEXT,
    volume_remaining DECIMAL,

    -- Status tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'low', 'expired', 'consumed')),

    -- User notes
    notes TEXT
);

-- ============================================================================
-- INVENTORY_HISTORY TABLE (Consumed/Used Items for Analytics)
-- ============================================================================

DROP TABLE IF EXISTS public.inventory_history CASCADE;

CREATE TABLE public.inventory_history (
    -- Copy all fields from inventory_items
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Household tracking
    household_id UUID NOT NULL,

    -- Barcode scan data
    barcode TEXT NOT NULL,
    scanned_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Basic product info from Nutritionix
    food_name TEXT,
    brand_name TEXT,
    nix_brand_id TEXT,
    nix_item_id TEXT,

    -- Serving information
    serving_qty DECIMAL,
    serving_unit TEXT,
    serving_weight_grams DECIMAL,

    -- Core nutrition facts
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

    -- Additional Nutritionix metadata
    photo_thumb TEXT,
    photo_highres TEXT,
    ndb_no TEXT,
    source INTEGER,
    full_nutrients JSONB,
    alt_measures JSONB,
    tags JSONB,

    -- Storage and expiration
    storage_location_id UUID REFERENCES public.storage_locations(id),
    expiration_date DATE,

    -- OCR data
    ocr_text TEXT,
    ocr_confidence DECIMAL,
    ocr_processing_time_ms INTEGER,

    -- Purchase tracking
    purchase_date DATE,
    price DECIMAL(10, 2),
    location_purchased TEXT,

    -- Volume tracking
    volume_purchased DECIMAL,
    volume_unit TEXT,
    volume_remaining DECIMAL,

    -- Status at time of archival
    status TEXT,
    notes TEXT,

    -- HISTORY-SPECIFIC FIELDS
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    consumed_date DATE,
    days_in_inventory INTEGER,
    waste_reason TEXT CHECK (waste_reason IN ('consumed', 'expired', 'spoiled', 'discarded', 'other')),
    usage_notes TEXT
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- inventory_items indexes
CREATE INDEX IF NOT EXISTS inventory_items_household_id_idx ON public.inventory_items(household_id);
CREATE INDEX IF NOT EXISTS inventory_items_barcode_idx ON public.inventory_items(barcode);
CREATE INDEX IF NOT EXISTS inventory_items_storage_location_id_idx ON public.inventory_items(storage_location_id);
CREATE INDEX IF NOT EXISTS inventory_items_expiration_date_idx ON public.inventory_items(expiration_date);
CREATE INDEX IF NOT EXISTS inventory_items_status_idx ON public.inventory_items(status);
CREATE INDEX IF NOT EXISTS inventory_items_created_at_idx ON public.inventory_items(created_at DESC);

-- inventory_history indexes (for analytics)
CREATE INDEX IF NOT EXISTS inventory_history_household_id_idx ON public.inventory_history(household_id);
CREATE INDEX IF NOT EXISTS inventory_history_barcode_idx ON public.inventory_history(barcode);
CREATE INDEX IF NOT EXISTS inventory_history_archived_at_idx ON public.inventory_history(archived_at DESC);
CREATE INDEX IF NOT EXISTS inventory_history_consumed_date_idx ON public.inventory_history(consumed_date);
CREATE INDEX IF NOT EXISTS inventory_history_waste_reason_idx ON public.inventory_history(waste_reason);
CREATE INDEX IF NOT EXISTS inventory_history_location_purchased_idx ON public.inventory_history(location_purchased);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;

-- inventory_items policies
CREATE POLICY "Allow anonymous insert on inventory_items"
    ON public.inventory_items
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous select on inventory_items"
    ON public.inventory_items
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "Allow anonymous update on inventory_items"
    ON public.inventory_items
    FOR UPDATE TO anon
    USING (true);

CREATE POLICY "Allow anonymous delete on inventory_items"
    ON public.inventory_items
    FOR DELETE TO anon
    USING (true);

-- inventory_history policies
CREATE POLICY "Allow anonymous insert on inventory_history"
    ON public.inventory_history
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous select on inventory_history"
    ON public.inventory_history
    FOR SELECT TO anon
    USING (true);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT ALL ON public.inventory_items TO anon;
GRANT ALL ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

GRANT ALL ON public.inventory_history TO anon;
GRANT ALL ON public.inventory_history TO authenticated;
GRANT ALL ON public.inventory_history TO service_role;

-- ============================================================================
-- HELPER FUNCTION: Move item to history
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_inventory_item(
    item_id UUID,
    p_consumed_date DATE DEFAULT CURRENT_DATE,
    p_waste_reason TEXT DEFAULT 'consumed',
    p_usage_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_item RECORD;
    v_days_in_inventory INTEGER;
BEGIN
    -- Get the item
    SELECT * INTO v_item FROM public.inventory_items WHERE id = item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found: %', item_id;
    END IF;

    -- Calculate days in inventory
    v_days_in_inventory := p_consumed_date - COALESCE(v_item.purchase_date, v_item.scanned_at::date);

    -- Insert into history
    INSERT INTO public.inventory_history (
        id, created_at, updated_at, household_id, barcode, scanned_at,
        food_name, brand_name, nix_brand_id, nix_item_id,
        serving_qty, serving_unit, serving_weight_grams,
        nf_calories, nf_total_fat, nf_saturated_fat, nf_cholesterol, nf_sodium,
        nf_total_carbohydrate, nf_dietary_fiber, nf_sugars, nf_protein, nf_potassium,
        photo_thumb, photo_highres, ndb_no, source, full_nutrients, alt_measures, tags,
        storage_location_id, expiration_date,
        ocr_text, ocr_confidence, ocr_processing_time_ms,
        purchase_date, price, location_purchased,
        volume_purchased, volume_unit, volume_remaining,
        status, notes,
        consumed_date, days_in_inventory, waste_reason, usage_notes
    ) VALUES (
        v_item.id, v_item.created_at, v_item.updated_at, v_item.household_id,
        v_item.barcode, v_item.scanned_at,
        v_item.food_name, v_item.brand_name, v_item.nix_brand_id, v_item.nix_item_id,
        v_item.serving_qty, v_item.serving_unit, v_item.serving_weight_grams,
        v_item.nf_calories, v_item.nf_total_fat, v_item.nf_saturated_fat,
        v_item.nf_cholesterol, v_item.nf_sodium,
        v_item.nf_total_carbohydrate, v_item.nf_dietary_fiber, v_item.nf_sugars,
        v_item.nf_protein, v_item.nf_potassium,
        v_item.photo_thumb, v_item.photo_highres, v_item.ndb_no, v_item.source,
        v_item.full_nutrients, v_item.alt_measures, v_item.tags,
        v_item.storage_location_id, v_item.expiration_date,
        v_item.ocr_text, v_item.ocr_confidence, v_item.ocr_processing_time_ms,
        v_item.purchase_date, v_item.price, v_item.location_purchased,
        v_item.volume_purchased, v_item.volume_unit, v_item.volume_remaining,
        v_item.status, v_item.notes,
        p_consumed_date, v_days_in_inventory, p_waste_reason, p_usage_notes
    );

    -- Delete from active inventory
    DELETE FROM public.inventory_items WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;

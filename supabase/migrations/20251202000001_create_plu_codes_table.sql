-- Migration: Create plu_codes table with complete IFPS data
-- Date: December 2, 2025
-- Purpose: Store IFPS PLU codes with USDA FoodData Central mappings
-- Philosophy: CAPTURE EVERYTHING - All 20 IFPS columns + our USDA mappings
-- Source: IFPS PLU Codes Database (1,547 produce codes as of Dec 1, 2025)

-- ============================================================================
-- CREATE PLU_CODES TABLE
-- ============================================================================

CREATE TABLE public.plu_codes (
    -- Primary identifier (serial, NOT plu_code - duplicates exist)
    id SERIAL PRIMARY KEY,

    -- IFPS source data (all 20 columns from CSV)
    ifps_id INTEGER NOT NULL,
    plu_code TEXT NOT NULL,  -- NOT UNIQUE - duplicates exist (same PLU, different restrictions/sizes)
    type TEXT,
    ifps_category TEXT,  -- Renamed to avoid conflict with our category
    commodity TEXT NOT NULL,
    variety TEXT,
    size TEXT,
    measures_na TEXT,
    measures_row TEXT,
    restrictions TEXT,  -- WHY DUPLICATES EXIST (organic vs conventional, size variants)
    botanical TEXT,
    aka TEXT,
    status TEXT,
    link TEXT,
    notes TEXT,
    ifps_updated_by TEXT,
    ifps_updated_at TIMESTAMP WITH TIME ZONE,
    ifps_created_at TIMESTAMP WITH TIME ZONE,
    ifps_deleted_at TIMESTAMP WITH TIME ZONE,
    language TEXT,

    -- Our additions (USDA mapping from commodity_fdc_LOCAL_VERIFIED.csv)
    usda_fdc_id INTEGER,
    usda_description TEXT,
    category TEXT CHECK (category IN ('fruit', 'vegetable', 'nut', 'herb')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for PLU code lookups (NOT UNIQUE)
CREATE INDEX idx_plu_codes_plu_code ON public.plu_codes(plu_code);

-- Index for IFPS ID
CREATE INDEX idx_plu_codes_ifps_id ON public.plu_codes(ifps_id);

-- Index for commodity search (case-insensitive full-text)
CREATE INDEX idx_plu_codes_commodity ON public.plu_codes
USING GIN (to_tsvector('english', commodity));

-- Index for category filtering
CREATE INDEX idx_plu_codes_category ON public.plu_codes(category)
WHERE category IS NOT NULL;

-- Index for FDC ID lookups
CREATE INDEX idx_plu_codes_fdc_id ON public.plu_codes(usda_fdc_id)
WHERE usda_fdc_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.plu_codes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (public reference data)
CREATE POLICY "PLU codes are readable by authenticated users"
ON public.plu_codes
FOR SELECT
TO authenticated
USING (true);

-- Only service role can modify (reference data, migration-only)
CREATE POLICY "PLU codes are writable by service role only"
ON public.plu_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.plu_codes IS 'IFPS PLU codes with USDA mappings. Captures ALL 20 IFPS columns per "capture everything" philosophy. PLU codes are NOT unique - duplicates exist for size/restriction variants.';
COMMENT ON COLUMN public.plu_codes.id IS 'Serial primary key (not plu_code - duplicates allowed)';
COMMENT ON COLUMN public.plu_codes.ifps_id IS 'IFPS database ID (original source)';
COMMENT ON COLUMN public.plu_codes.plu_code IS '4-5 digit PLU code (NOT UNIQUE - duplicates for size/organic variants)';
COMMENT ON COLUMN public.plu_codes.restrictions IS 'Why duplicates exist: organic vs conventional, regional variants';
COMMENT ON COLUMN public.plu_codes.usda_fdc_id IS 'USDA FDC ID from commodity mapping. NULL if not in SR Legacy.';
COMMENT ON COLUMN public.plu_codes.category IS 'Our culinary category (fruit/vegetable/nut/herb) from commodity_fdc_LOCAL_VERIFIED.csv';

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'plu_codes'
    ) THEN
        RAISE EXCEPTION 'Migration failed: plu_codes table not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'plu_codes'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'Migration failed: RLS not enabled';
    END IF;
END $$;

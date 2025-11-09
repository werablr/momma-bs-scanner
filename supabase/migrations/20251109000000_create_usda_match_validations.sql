-- Migration: Create USDA Match Validations Table
-- Date: November 9, 2025
-- Purpose: Track user acceptance/rejection of USDA fuzzy matches for learning system

-- ============================================================================
-- USDA MATCH VALIDATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usda_match_validations (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Matching relationship
    scanned_upc TEXT NOT NULL,           -- The barcode user actually scanned
    usda_fdc_id INTEGER NOT NULL,        -- USDA Food Data Central ID
    usda_upc TEXT,                       -- USDA's barcode (might differ from scanned)

    -- Validation result
    validated BOOLEAN NOT NULL,          -- TRUE = accepted, FALSE = rejected
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    validated_by TEXT,                   -- User identifier who validated

    -- Metadata
    match_confidence DECIMAL,            -- Original confidence score when matched
    product_name_scanned TEXT,           -- Product name when scanned
    product_name_usda TEXT,              -- USDA product description

    -- Prevent duplicate validations for same scanned UPC + USDA FDC ID
    UNIQUE(scanned_upc, usda_fdc_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup by scanned UPC (most common query during scanning)
CREATE INDEX idx_usda_validations_scanned
    ON public.usda_match_validations(scanned_upc);

-- Fast lookup by USDA FDC ID (for analytics)
CREATE INDEX idx_usda_validations_fdc_id
    ON public.usda_match_validations(usda_fdc_id);

-- Combined index for validation status queries
CREATE INDEX idx_usda_validations_scanned_validated
    ON public.usda_match_validations(scanned_upc, validated);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.usda_match_validations ENABLE ROW LEVEL SECURITY;

-- Allow service role (edge functions) full access
CREATE POLICY "Service role has full access to usda_match_validations"
    ON public.usda_match_validations FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to view all validations (for analytics)
CREATE POLICY "Authenticated users can view usda_match_validations"
    ON public.usda_match_validations FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert validations
CREATE POLICY "Authenticated users can insert usda_match_validations"
    ON public.usda_match_validations FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update their own validations
CREATE POLICY "Authenticated users can update usda_match_validations"
    ON public.usda_match_validations FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.usda_match_validations IS
'Tracks user acceptance/rejection of USDA fuzzy matches. Used to filter rejected matches and boost accepted matches in future scans. Learning system improves accuracy over time.';

COMMENT ON COLUMN public.usda_match_validations.scanned_upc IS
'The barcode that was scanned by the user (primary lookup key)';

COMMENT ON COLUMN public.usda_match_validations.usda_fdc_id IS
'USDA Food Data Central ID of the matched product';

COMMENT ON COLUMN public.usda_match_validations.usda_upc IS
'USDA database UPC/barcode (may differ from scanned_upc due to variants)';

COMMENT ON COLUMN public.usda_match_validations.validated IS
'TRUE = User accepted this match (use this data), FALSE = User rejected this match (never show again for this scanned UPC)';

COMMENT ON COLUMN public.usda_match_validations.match_confidence IS
'String similarity confidence score at time of original match (0-100)';

COMMENT ON COLUMN public.usda_match_validations.product_name_scanned IS
'Product name from OFF/UPC at time of scan (for user reference)';

COMMENT ON COLUMN public.usda_match_validations.product_name_usda IS
'USDA product description at time of match (for user reference)';

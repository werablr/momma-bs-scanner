-- Migration: Add USDA Fuzzy Match Fields to Inventory Tables
-- Date: November 9, 2025
-- Purpose: Store top 3 USDA fuzzy matches with metadata for user validation

-- ============================================================================
-- ADD COLUMNS TO INVENTORY_ITEMS
-- ============================================================================

ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS usda_fuzzy_matches JSONB;

ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS usda_fuzzy_match_count INTEGER DEFAULT 0;

ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS requires_usda_validation BOOLEAN DEFAULT false;

-- ============================================================================
-- ADD COLUMNS TO INVENTORY_HISTORY
-- ============================================================================

ALTER TABLE public.inventory_history
ADD COLUMN IF NOT EXISTS usda_fuzzy_matches JSONB;

ALTER TABLE public.inventory_history
ADD COLUMN IF NOT EXISTS usda_fuzzy_match_count INTEGER DEFAULT 0;

ALTER TABLE public.inventory_history
ADD COLUMN IF NOT EXISTS requires_usda_validation BOOLEAN DEFAULT false;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for finding items that need validation
CREATE INDEX IF NOT EXISTS idx_inventory_items_requires_usda_validation
    ON public.inventory_items(requires_usda_validation)
    WHERE requires_usda_validation = true;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON COLUMN public.inventory_items.usda_fuzzy_matches IS
'Array of top 3 USDA fuzzy matches with metadata. Structure: [{fdc_id, confidence, product_name, nutrition_data, previously_validated}]';

COMMENT ON COLUMN public.inventory_items.usda_fuzzy_match_count IS
'Number of USDA fuzzy matches stored (0-3). Used for quick filtering without parsing JSONB.';

COMMENT ON COLUMN public.inventory_items.requires_usda_validation IS
'TRUE if this item has unvalidated USDA fuzzy matches that need user review in Desktop Pantry app.';

COMMENT ON COLUMN public.inventory_history.usda_fuzzy_matches IS
'Historical snapshot of USDA fuzzy matches at time of archival.';

COMMENT ON COLUMN public.inventory_history.usda_fuzzy_match_count IS
'Historical snapshot of match count at time of archival.';

COMMENT ON COLUMN public.inventory_history.requires_usda_validation IS
'Historical snapshot of validation requirement at time of archival.';

-- ============================================================================
-- EXAMPLE DATA STRUCTURE
-- ============================================================================

/*
Example usda_fuzzy_matches JSONB structure:

[
  {
    "fdc_id": 12345,
    "usda_upc": "00039400018803",
    "confidence": 95.2,
    "product_name": "Bush's Black Beans, 15 oz",
    "previously_validated": false,
    "nutrition_data": {
      "calories": 120,
      "protein": 8,
      "total_fat": 0.5,
      "carbohydrate": 22,
      "sodium": 140,
      "calcium": 38,
      "iron": 1.46,
      "potassium": 423
    }
  },
  {
    "fdc_id": 67890,
    "usda_upc": "00039400018827",
    "confidence": 92.1,
    "product_name": "Bush's Black Beans, 26.5 oz",
    "previously_validated": false,
    "nutrition_data": {
      "calories": 110,
      "protein": 7,
      "total_fat": 0.5,
      "carbohydrate": 20,
      "sodium": 130,
      "calcium": 35,
      "iron": 1.4,
      "potassium": 410
    }
  },
  {
    "fdc_id": 11111,
    "usda_upc": null,
    "confidence": 91.8,
    "product_name": "Black Beans, Bush's Best",
    "previously_validated": true,
    "nutrition_data": {
      "calories": 120,
      "protein": 8,
      "total_fat": 0.5,
      "carbohydrate": 22,
      "sodium": 140,
      "calcium": 40,
      "iron": 1.5,
      "potassium": 420
    }
  }
]

Fields:
- fdc_id: USDA Food Data Central ID (required)
- usda_upc: USDA's barcode if available (optional)
- confidence: String similarity score 0-100 (required)
- product_name: USDA product description (required)
- previously_validated: Whether this match was validated in past scan (required)
- nutrition_data: USDA nutrition facts object (required)
*/

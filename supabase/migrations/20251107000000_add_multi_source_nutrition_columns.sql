-- Migration: Add multi-source nutrition columns for data provenance
-- Date: November 7, 2025
-- Purpose: Support USDA + Open Food Facts + UPCitemdb with complete transparency

-- Add USDA-specific columns to inventory_items
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS usda_calories DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_protein DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_total_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_saturated_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_trans_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_cholesterol DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_sodium DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_total_carbohydrate DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_dietary_fiber DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_sugars DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_added_sugars DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_potassium DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_vitamin_d DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_calcium DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_iron DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_fdc_id INTEGER,
  ADD COLUMN IF NOT EXISTS usda_raw_data JSONB;

-- Add Open Food Facts-specific nutrition columns to inventory_items
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS off_calories DECIMAL,
  ADD COLUMN IF NOT EXISTS off_protein DECIMAL,
  ADD COLUMN IF NOT EXISTS off_total_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS off_saturated_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS off_trans_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS off_cholesterol DECIMAL,
  ADD COLUMN IF NOT EXISTS off_sodium DECIMAL,
  ADD COLUMN IF NOT EXISTS off_total_carbohydrate DECIMAL,
  ADD COLUMN IF NOT EXISTS off_dietary_fiber DECIMAL,
  ADD COLUMN IF NOT EXISTS off_sugars DECIMAL,
  ADD COLUMN IF NOT EXISTS off_potassium DECIMAL;

-- Add UPCitemdb-specific nutrition columns (usually doesn't have nutrition, but keep for completeness)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS upc_calories DECIMAL,
  ADD COLUMN IF NOT EXISTS upc_protein DECIMAL,
  ADD COLUMN IF NOT EXISTS upc_total_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS upc_sodium DECIMAL;

-- Add user-input nutrition columns (user manually entered or corrected values)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS user_calories DECIMAL,
  ADD COLUMN IF NOT EXISTS user_protein DECIMAL,
  ADD COLUMN IF NOT EXISTS user_total_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS user_saturated_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS user_trans_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS user_cholesterol DECIMAL,
  ADD COLUMN IF NOT EXISTS user_sodium DECIMAL,
  ADD COLUMN IF NOT EXISTS user_total_carbohydrate DECIMAL,
  ADD COLUMN IF NOT EXISTS user_dietary_fiber DECIMAL,
  ADD COLUMN IF NOT EXISTS user_sugars DECIMAL,
  ADD COLUMN IF NOT EXISTS user_potassium DECIMAL,
  ADD COLUMN IF NOT EXISTS user_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS user_notes TEXT;

-- Add same columns to inventory_history for consistency
ALTER TABLE inventory_history
  ADD COLUMN IF NOT EXISTS usda_calories DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_protein DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_total_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_saturated_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_trans_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_cholesterol DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_sodium DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_total_carbohydrate DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_dietary_fiber DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_sugars DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_added_sugars DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_potassium DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_vitamin_d DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_calcium DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_iron DECIMAL,
  ADD COLUMN IF NOT EXISTS usda_fdc_id INTEGER,
  ADD COLUMN IF NOT EXISTS usda_raw_data JSONB,
  ADD COLUMN IF NOT EXISTS off_calories DECIMAL,
  ADD COLUMN IF NOT EXISTS off_protein DECIMAL,
  ADD COLUMN IF NOT EXISTS off_total_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS off_saturated_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS off_trans_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS off_cholesterol DECIMAL,
  ADD COLUMN IF NOT EXISTS off_sodium DECIMAL,
  ADD COLUMN IF NOT EXISTS off_total_carbohydrate DECIMAL,
  ADD COLUMN IF NOT EXISTS off_dietary_fiber DECIMAL,
  ADD COLUMN IF NOT EXISTS off_sugars DECIMAL,
  ADD COLUMN IF NOT EXISTS off_potassium DECIMAL,
  ADD COLUMN IF NOT EXISTS upc_calories DECIMAL,
  ADD COLUMN IF NOT EXISTS upc_protein DECIMAL,
  ADD COLUMN IF NOT EXISTS upc_total_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS upc_sodium DECIMAL,
  ADD COLUMN IF NOT EXISTS user_calories DECIMAL,
  ADD COLUMN IF NOT EXISTS user_protein DECIMAL,
  ADD COLUMN IF NOT EXISTS user_total_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS user_saturated_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS user_trans_fat DECIMAL,
  ADD COLUMN IF NOT EXISTS user_cholesterol DECIMAL,
  ADD COLUMN IF NOT EXISTS user_sodium DECIMAL,
  ADD COLUMN IF NOT EXISTS user_total_carbohydrate DECIMAL,
  ADD COLUMN IF NOT EXISTS user_dietary_fiber DECIMAL,
  ADD COLUMN IF NOT EXISTS user_sugars DECIMAL,
  ADD COLUMN IF NOT EXISTS user_potassium DECIMAL,
  ADD COLUMN IF NOT EXISTS user_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS user_notes TEXT;

-- Add comment explaining the strategy
COMMENT ON COLUMN inventory_items.usda_calories IS 'Calories from USDA FoodData Central (government source)';
COMMENT ON COLUMN inventory_items.off_calories IS 'Calories from Open Food Facts (community source)';
COMMENT ON COLUMN inventory_items.upc_calories IS 'Calories from UPCitemdb (commercial source)';
COMMENT ON COLUMN inventory_items.user_calories IS 'Calories manually entered or corrected by user (highest priority when present)';
COMMENT ON COLUMN inventory_items.nf_calories IS 'Single Source of Truth: Auto-selected best value from USER > USDA > OFF > UPC';
COMMENT ON COLUMN inventory_items.user_verified_at IS 'Timestamp when user last verified/corrected nutrition data';
COMMENT ON COLUMN inventory_items.user_notes IS 'User notes about manual corrections or data source preferences';

COMMENT ON COLUMN inventory_items.usda_raw_data IS 'Complete USDA API response for debugging and future extraction';
COMMENT ON COLUMN inventory_items.openfoodfacts_raw_data IS 'Complete Open Food Facts API response for debugging';
COMMENT ON COLUMN inventory_items.upcitemdb_raw_data IS 'Complete UPCitemdb API response for debugging';

-- Create index for USDA FDC ID lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_usda_fdc_id ON inventory_items(usda_fdc_id);

-- Update product_catalog to store USDA data
ALTER TABLE product_catalog
  ADD COLUMN IF NOT EXISTS usda_data JSONB,
  ADD COLUMN IF NOT EXISTS usda_fdc_id INTEGER;

COMMENT ON COLUMN product_catalog.usda_data IS 'Cached USDA API response';
COMMENT ON COLUMN product_catalog.nutritionix_data IS 'DEPRECATED: Nutritionix subscription expired Nov 2025';

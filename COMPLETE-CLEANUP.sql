-- ============================================================================
-- COMPLETE CLEANUP - Delete ALL and start fresh
-- Run this ENTIRE script in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Step 1: DELETE EVERYTHING (all 18 rows)
DELETE FROM storage_locations WHERE household_id = '7c093e13-4bcf-463e-96c1-9f499de9c4f2';
DELETE FROM storage_locations WHERE household_id = '1f01c17b-beab-4155-890e-255ea09fe72d';

-- Step 2: Verify deletion (should return 0)
SELECT COUNT(*) as total_remaining FROM storage_locations;

-- Step 3: Insert ONLY the 8 locations you actually want
INSERT INTO storage_locations (household_id, name, type, description)
VALUES
  ('7c093e13-4bcf-463e-96c1-9f499de9c4f2', 'Pantry', 'pantry', 'Dry goods, shelf-stable items'),
  ('7c093e13-4bcf-463e-96c1-9f499de9c4f2', 'Refrigerator', 'fridge', 'Cold storage'),
  ('7c093e13-4bcf-463e-96c1-9f499de9c4f2', 'Liquor Cabinet', 'pantry', 'Alcoholic beverages'),
  ('7c093e13-4bcf-463e-96c1-9f499de9c4f2', 'Freezer', 'freezer', 'Frozen storage'),
  ('7c093e13-4bcf-463e-96c1-9f499de9c4f2', 'Above Air Fryer', 'pantry', 'Upper cabinet above air fryer'),
  ('7c093e13-4bcf-463e-96c1-9f499de9c4f2', 'Above Freezer', 'pantry', 'Upper cabinet above freezer'),
  ('7c093e13-4bcf-463e-96c1-9f499de9c4f2', 'Basket', 'counter', 'Fruit basket, frequently accessed items'),
  ('7c093e13-4bcf-463e-96c1-9f499de9c4f2', 'Dining Table', 'counter', 'Items on dining table');

-- Step 4: Final verification - should show exactly 8 rows
SELECT id, household_id, name, type, description
FROM storage_locations
ORDER BY name;

-- Expected result: Exactly 8 rows
-- 1. Above Air Fryer
-- 2. Above Freezer
-- 3. Basket
-- 4. Dining Table
-- 5. Freezer
-- 6. Liquor Cabinet
-- 7. Pantry
-- 8. Refrigerator

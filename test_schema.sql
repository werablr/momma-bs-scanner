-- Quick test to verify extended schema deployment
-- Check if new columns exist in inventory_items

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inventory_items'
  AND column_name IN ('package_size', 'nutriscore_grade', 'nova_group', 'is_vegan', 'current_price', 'data_sources')
ORDER BY column_name;

-- Check if existing items are still there
SELECT id, food_name, brand_name, barcode, status, created_at
FROM inventory_items
ORDER BY created_at DESC
LIMIT 5;

-- Test that analytics functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_household_health_score', 'get_price_trends');

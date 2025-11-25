-- Add provenance ID columns for USDA data traceability
ALTER TABLE inventory_items
ADD COLUMN ndb_number text,
ADD COLUMN food_code text,
ADD COLUMN gtin_upc text;

-- Add comments explaining each
COMMENT ON COLUMN inventory_items.ndb_number IS 'Legacy USDA NDB number (SR Legacy database)';
COMMENT ON COLUMN inventory_items.food_code IS 'USDA food code (Survey/FNDDS database)';
COMMENT ON COLUMN inventory_items.gtin_upc IS 'GTIN/UPC barcode (Branded Foods database)';

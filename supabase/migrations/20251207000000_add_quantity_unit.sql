-- Add quantity_unit column to inventory_items
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS quantity_unit TEXT DEFAULT 'each';

COMMENT ON COLUMN inventory_items.quantity_unit IS 'Unit for quantity: each, lb, oz';

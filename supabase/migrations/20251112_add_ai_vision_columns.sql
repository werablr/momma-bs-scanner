-- Add AI Vision columns to inventory_items table
-- Note: Storage bucket must be created via Supabase Dashboard (Storage section)
-- to avoid RLS violations in migrations

-- Add photo_user_uploaded column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items'
    AND column_name = 'photo_user_uploaded'
  ) THEN
    ALTER TABLE inventory_items
    ADD COLUMN photo_user_uploaded TEXT;

    COMMENT ON COLUMN inventory_items.photo_user_uploaded IS
    'User-uploaded photo URL from Supabase Storage. Priority: user > OFF > UPC';
  END IF;
END $$;

-- Add ai_identified_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items'
    AND column_name = 'ai_identified_name'
  ) THEN
    ALTER TABLE inventory_items
    ADD COLUMN ai_identified_name TEXT;

    COMMENT ON COLUMN inventory_items.ai_identified_name IS
    'Product name identified by OpenAI GPT-4 Vision (for AI scan workflow)';
  END IF;
END $$;

-- Add ai_confidence column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items'
    AND column_name = 'ai_confidence'
  ) THEN
    ALTER TABLE inventory_items
    ADD COLUMN ai_confidence DECIMAL(3,2);

    COMMENT ON COLUMN inventory_items.ai_confidence IS
    'Confidence score from AI Vision (0.00 to 1.00)';
  END IF;
END $$;

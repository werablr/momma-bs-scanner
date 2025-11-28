-- Migration: Add cleanup function for orphaned photos
-- Priority: P0 - Critical
-- Issue: Photos upload to storage but if DB insert fails, files are orphaned
-- Impact: Storage costs grow unbounded
-- Fix: Scheduled cleanup of unreferenced photos

-- Create function to cleanup orphaned photos
CREATE OR REPLACE FUNCTION cleanup_orphaned_photos()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete photos from storage that are not referenced in inventory_items
  DELETE FROM storage.objects
  WHERE bucket_id = 'user-food-photos'
    AND name NOT IN (
      SELECT photo_thumb FROM inventory_items WHERE photo_thumb IS NOT NULL
      UNION
      SELECT photo_highres FROM inventory_items WHERE photo_highres IS NOT NULL
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup operation
  INSERT INTO edge_function_logs (function_name, log_level, message, metadata)
  VALUES (
    'cleanup_orphaned_photos',
    'info',
    'Cleaned up orphaned photos',
    jsonb_build_object('deleted_count', deleted_count)
  );

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION cleanup_orphaned_photos() IS
  'Removes photos from storage that are not referenced in inventory_items. Returns count of deleted files.';

-- Schedule daily cleanup at 3am UTC (after pending items cleanup)
SELECT cron.schedule(
  'cleanup-orphaned-photos',
  '0 3 * * *',  -- Daily at 3am UTC
  'SELECT cleanup_orphaned_photos();'
);

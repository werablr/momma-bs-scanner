-- Row Level Security Policies for Scanner App
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STORAGE LOCATIONS TABLE
-- ============================================================================

-- Policy 1: Allow anonymous users to READ storage_locations
-- This is safe because storage locations are not sensitive data
CREATE POLICY IF NOT EXISTS "Allow anonymous read access to storage_locations"
ON storage_locations
FOR SELECT
TO anon
USING (true);

-- Policy 2: Allow authenticated users to READ their household's storage_locations
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read their household storage_locations"
ON storage_locations
FOR SELECT
TO authenticated
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy 3: Allow authenticated users to INSERT storage_locations for their household
CREATE POLICY IF NOT EXISTS "Allow authenticated users to insert storage_locations for their household"
ON storage_locations
FOR INSERT
TO authenticated
WITH CHECK (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy 4: Allow authenticated users to UPDATE their household's storage_locations
CREATE POLICY IF NOT EXISTS "Allow authenticated users to update their household storage_locations"
ON storage_locations
FOR UPDATE
TO authenticated
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
)
WITH CHECK (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy 5: Allow authenticated users to DELETE their household's storage_locations
CREATE POLICY IF NOT EXISTS "Allow authenticated users to delete their household storage_locations"
ON storage_locations
FOR DELETE
TO authenticated
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- ============================================================================
-- Verify RLS is enabled and policies are active
-- ============================================================================

-- Check if RLS is enabled on storage_locations
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'storage_locations';

-- List all policies on storage_locations
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'storage_locations';

-- ============================================================================
-- NOTES
-- ============================================================================

-- The anonymous read policy allows the mobile app to load storage locations
-- without requiring authentication first. This is safe because:
-- 1. Storage location names (Fridge, Pantry, etc.) are not sensitive
-- 2. The actual inventory data is protected by separate RLS policies
-- 3. Anonymous users can only READ, not modify storage locations

-- For production, consider adding more restrictive policies based on your needs.

-- Check if the RLS policy exists and is configured correctly
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Check if RLS is enabled on the table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'storage_locations';
-- Expected: rowsecurity should be TRUE

-- 2. List all policies on storage_locations
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'storage_locations';
-- Expected: Should see "Allow anonymous read access to storage_locations" policy

-- 3. Test query as anon user would see it
SELECT id, household_id, name, type
FROM storage_locations
ORDER BY name;
-- This runs as your admin user, so you should see all 8 rows
-- But the app (using anon key) sees 0 rows - meaning the policy isn't working

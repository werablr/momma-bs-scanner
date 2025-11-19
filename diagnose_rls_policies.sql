-- ============================================================
-- DIAGNOSE RLS POLICIES - ROOT CAUSE IDENTIFICATION
-- ============================================================
-- Purpose: Identify what RLS policies currently exist vs what should exist
-- Date: November 19, 2025
-- ============================================================

-- 1. List ALL existing policies on inventory_items
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'inventory_items'
ORDER BY policyname;

-- 2. List ALL existing policies on inventory_history
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'inventory_history'
ORDER BY policyname;

-- 3. List ALL existing policies on households
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'households'
ORDER BY policyname;

-- 4. List ALL existing policies on user_households
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_households'
ORDER BY policyname;

-- 5. Check which migrations have been applied
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;

-- 6. Check if tables exist
SELECT
    table_schema,
    table_name,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.table_name) as policy_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_name IN ('inventory_items', 'inventory_history', 'households', 'user_households')
ORDER BY table_name;

-- 7. Check RLS is enabled on tables
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('inventory_items', 'inventory_history', 'households', 'user_households')
ORDER BY tablename;

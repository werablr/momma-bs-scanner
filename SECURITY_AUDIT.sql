-- ============================================================
-- MOMMA B'S SECURITY AUDIT
-- Run this in Supabase SQL Editor to identify issues
-- Date: November 21, 2025
-- ============================================================

-- ============================================================
-- SECTION 1: RLS STATUS CHECK
-- ============================================================

-- 1.1 Check RLS enabled on all tables
SELECT
    '1.1 RLS STATUS' as section,
    tablename,
    CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '🔴 DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;

-- ============================================================
-- SECTION 2: RLS POLICIES AUDIT
-- ============================================================

-- 2.1 List all RLS policies
SELECT
    '2.1 ALL POLICIES' as section,
    tablename,
    policyname,
    cmd as operation,
    roles::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- 2.2 Check for ANONYMOUS access policies (SECURITY RISK)
SELECT
    '2.2 ANON POLICIES' as section,
    tablename,
    policyname,
    cmd,
    '🔴 ANONYMOUS ACCESS' as risk_level
FROM pg_policies
WHERE schemaname = 'public'
AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[]);

-- 2.3 Tables WITHOUT any policies (if RLS enabled, blocks all access)
SELECT
    '2.3 TABLES WITHOUT POLICIES' as section,
    t.tablename,
    CASE WHEN t.rowsecurity THEN '🟡 RLS on but no policies = BLOCKED'
         ELSE '🔴 RLS off = OPEN ACCESS' END as status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
AND p.policyname IS NULL;

-- ============================================================
-- SECTION 3: AUTH & HOUSEHOLD CHECK
-- ============================================================

-- 3.1 Check user_households table exists
SELECT
    '3.1 AUTH TABLES' as section,
    table_name,
    '✅ Exists' as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('households', 'user_households');

-- 3.2 Count users per household
SELECT
    '3.2 HOUSEHOLD MEMBERSHIP' as section,
    h.name as household_name,
    COUNT(uh.user_id) as user_count
FROM households h
LEFT JOIN user_households uh ON h.id = uh.household_id
GROUP BY h.id, h.name;

-- 3.3 Check for orphaned data (items without valid household)
SELECT
    '3.3 ORPHANED INVENTORY' as section,
    i.household_id,
    COUNT(*) as orphaned_items,
    '🔴 NO MATCHING HOUSEHOLD' as status
FROM inventory_items i
LEFT JOIN households h ON i.household_id = h.id
WHERE h.id IS NULL
GROUP BY i.household_id;

-- ============================================================
-- SECTION 4: FUNCTION SECURITY
-- ============================================================

-- 4.1 Functions with SECURITY DEFINER (run as owner, not caller)
SELECT
    '4.1 SECURITY DEFINER FUNCTIONS' as section,
    p.proname as function_name,
    CASE WHEN p.prosecdef THEN '⚠️ SECURITY DEFINER' ELSE '✅ SECURITY INVOKER' END as security_mode,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f';

-- 4.2 Check archive_inventory_item function specifically
SELECT
    '4.2 ARCHIVE FUNCTION' as section,
    proname,
    prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'archive_inventory_item';

-- ============================================================
-- SECTION 5: STORAGE SECURITY
-- ============================================================

-- 5.1 Check storage buckets
SELECT
    '5.1 STORAGE BUCKETS' as section,
    id as bucket_name,
    CASE WHEN public THEN '🔴 PUBLIC' ELSE '✅ Private' END as access,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets;

-- 5.2 Storage policies (via pg_policies on storage schema)
SELECT
    '5.2 STORAGE POLICIES' as section,
    tablename,
    policyname,
    cmd as operation,
    roles::text
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, cmd;

-- ============================================================
-- SECTION 6: DATA INTEGRITY
-- ============================================================

-- 6.1 Items per household
SELECT
    '6.1 INVENTORY DISTRIBUTION' as section,
    h.name as household_name,
    COUNT(i.id) as item_count
FROM households h
LEFT JOIN inventory_items i ON h.id = i.household_id
GROUP BY h.id, h.name;

-- 6.2 Check for NULL household_id (should never happen)
SELECT
    '6.2 NULL HOUSEHOLD CHECK' as section,
    COUNT(*) as items_with_null_household,
    CASE WHEN COUNT(*) > 0 THEN '🔴 CRITICAL' ELSE '✅ OK' END as status
FROM inventory_items
WHERE household_id IS NULL;

-- ============================================================
-- SECTION 7: EDGE FUNCTION AUDIT
-- ============================================================

-- 7.1 Check edge_function_logs table
SELECT
    '7.1 EDGE FUNCTION LOGS' as section,
    function_name,
    COUNT(*) as call_count,
    COUNT(*) FILTER (WHERE log_level = 'error') as error_count
FROM edge_function_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY function_name;

-- ============================================================
-- SECTION 8: RECOMMENDED FIXES
-- ============================================================

-- This section identifies specific issues and suggests fixes

-- 8.1 Generate fix statements for tables without RLS
SELECT
    '8.1 FIX: Enable RLS' as section,
    'ALTER TABLE public.' || tablename || ' ENABLE ROW LEVEL SECURITY;' as fix_sql
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false;

-- 8.2 Check if product_catalog has RLS (shared data, might be intentionally open)
SELECT
    '8.2 PRODUCT_CATALOG STATUS' as section,
    tablename,
    rowsecurity as rls_enabled,
    CASE
        WHEN rowsecurity = false THEN '⚠️ Intentionally open for caching? Or needs RLS?'
        ELSE '✅ Protected'
    END as note
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'product_catalog';

-- ============================================================
-- SUMMARY
-- ============================================================

SELECT '=== SECURITY AUDIT COMPLETE ===' as summary,
       'Review each section for 🔴 issues' as action;

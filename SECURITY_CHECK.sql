-- Single query security check - copy/paste into Supabase SQL Editor

SELECT
    'RLS_STATUS' as check_type,
    tablename as item,
    CASE WHEN rowsecurity THEN 'OK' ELSE 'DISABLED' END as status
FROM pg_tables WHERE schemaname = 'public'

UNION ALL

SELECT
    'ANON_POLICY',
    tablename || '.' || policyname,
    'ANONYMOUS ACCESS'
FROM pg_policies
WHERE schemaname = 'public'
AND roles @> ARRAY['anon']::name[]

UNION ALL

SELECT
    'NO_POLICIES',
    t.tablename,
    CASE WHEN t.rowsecurity THEN 'BLOCKED' ELSE 'OPEN' END
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public' AND p.policyname IS NULL

UNION ALL

SELECT
    'PUBLIC_BUCKET',
    id,
    CASE WHEN public THEN 'PUBLIC' ELSE 'PRIVATE' END
FROM storage.buckets

UNION ALL

SELECT
    'HOUSEHOLD_USERS',
    h.name,
    COUNT(uh.user_id)::text
FROM households h
LEFT JOIN user_households uh ON h.id = uh.household_id
GROUP BY h.id, h.name

UNION ALL

SELECT
    'INVENTORY_COUNT',
    'Total items',
    COUNT(*)::text
FROM inventory_items

ORDER BY check_type, item;

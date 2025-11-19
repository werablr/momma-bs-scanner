-- ============================================================
-- FIX RLS POLICIES FOR INVENTORY TABLES
-- ============================================================
-- Migration: 20251119000001_fix_rls_policies
-- Date: November 19, 2025
-- Purpose: Fix RLS policies that incorrectly reference auth.users.household_id
-- Root Cause: auth.users table does not have household_id column
-- Solution: Use user_households junction table to lookup household_id
-- Security: Maintains same security model - users can only access their own household data
-- ============================================================

-- Drop existing policies that have the incorrect auth.users reference
DROP POLICY IF EXISTS "Users can view their household inventory" ON inventory_items;
DROP POLICY IF EXISTS "Users can insert into their household inventory" ON inventory_items;
DROP POLICY IF EXISTS "Users can update their household inventory" ON inventory_items;
DROP POLICY IF EXISTS "Users can view their household history" ON inventory_history;

-- ============================================================
-- INVENTORY_ITEMS POLICIES
-- ============================================================

-- SELECT: Users can view inventory items from their household(s)
CREATE POLICY "Users can view their household inventory"
    ON inventory_items FOR SELECT
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id
            FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Users can insert inventory items into their household(s)
CREATE POLICY "Users can insert into their household inventory"
    ON inventory_items FOR INSERT
    TO authenticated
    WITH CHECK (
        household_id IN (
            SELECT household_id
            FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- UPDATE: Users can update inventory items in their household(s)
CREATE POLICY "Users can update their household inventory"
    ON inventory_items FOR UPDATE
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id
            FROM user_households
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        household_id IN (
            SELECT household_id
            FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Users can delete inventory items from their household(s)
-- (Adding this for completeness, though archival is preferred)
CREATE POLICY "Users can delete their household inventory"
    ON inventory_items FOR DELETE
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id
            FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- INVENTORY_HISTORY POLICIES
-- ============================================================

-- SELECT: Users can view inventory history from their household(s)
CREATE POLICY "Users can view their household history"
    ON inventory_history FOR SELECT
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id
            FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Users can archive items to history in their household(s)
-- (This happens via archive_inventory_item() function, but policy allows direct inserts if needed)
CREATE POLICY "Users can insert into their household history"
    ON inventory_history FOR INSERT
    TO authenticated
    WITH CHECK (
        household_id IN (
            SELECT household_id
            FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- VERIFICATION
-- ============================================================

-- List all policies for inventory tables
DO $$
BEGIN
    RAISE NOTICE 'RLS Policies updated successfully';
    RAISE NOTICE 'Inventory Items Policies:';
END $$;

SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'inventory_items'
ORDER BY policyname;

-- Verify user_households table exists and is accessible
DO $$
DECLARE
    table_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_households'
    ) INTO table_exists;

    IF table_exists THEN
        RAISE NOTICE 'user_households table exists and is accessible';
    ELSE
        RAISE WARNING 'user_households table does not exist - migration may fail';
    END IF;
END $$;

-- ============================================================
-- SECURITY NOTES
-- ============================================================
-- 1. Users can only access data from households they belong to
-- 2. user_households junction table controls membership
-- 3. Service role still has full access (for system operations)
-- 4. Anonymous policies remain unchanged (for backward compatibility)
-- 5. All policies use IN (SELECT...) to support users in multiple households
-- ============================================================

-- Migration complete

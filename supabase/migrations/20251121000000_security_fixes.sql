-- ============================================================
-- SECURITY FIXES MIGRATION
-- Date: November 21, 2025
-- Purpose: Fix RLS policies for blocked tables, secure storage bucket
-- ============================================================

-- ============================================================
-- 1. DROP LEGACY ANONYMOUS POLICIES (if they still exist)
-- ============================================================

-- These were created in early migrations but should be removed
DROP POLICY IF EXISTS "Allow anonymous insert on inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Allow anonymous select on inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Allow anonymous update on inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Allow anonymous delete on inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Allow anonymous insert on inventory_history" ON inventory_history;
DROP POLICY IF EXISTS "Allow anonymous select on inventory_history" ON inventory_history;

-- Revoke anon grants on inventory tables
REVOKE ALL ON public.inventory_items FROM anon;
REVOKE ALL ON public.inventory_history FROM anon;

-- ============================================================
-- 2. USERS TABLE POLICIES
-- ============================================================

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================================
-- 3. RECIPES TABLE POLICIES
-- ============================================================

-- Check if household_id column exists, if not these are orphaned tables
-- For now, assume they have household_id based on project architecture

DROP POLICY IF EXISTS "Users can view household recipes" ON recipes;
CREATE POLICY "Users can view household recipes"
    ON recipes FOR SELECT
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert household recipes" ON recipes;
CREATE POLICY "Users can insert household recipes"
    ON recipes FOR INSERT
    TO authenticated
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update household recipes" ON recipes;
CREATE POLICY "Users can update household recipes"
    ON recipes FOR UPDATE
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete household recipes" ON recipes;
CREATE POLICY "Users can delete household recipes"
    ON recipes FOR DELETE
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- Service role access for recipes
DROP POLICY IF EXISTS "Service role full access to recipes" ON recipes;
CREATE POLICY "Service role full access to recipes"
    ON recipes FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 4. RECIPE_INGREDIENTS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Users can view recipe ingredients"
    ON recipe_ingredients FOR SELECT
    TO authenticated
    USING (
        recipe_id IN (
            SELECT id FROM recipes WHERE household_id IN (
                SELECT household_id FROM user_households
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can manage recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Users can manage recipe ingredients"
    ON recipe_ingredients FOR ALL
    TO authenticated
    USING (
        recipe_id IN (
            SELECT id FROM recipes WHERE household_id IN (
                SELECT household_id FROM user_households
                WHERE user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        recipe_id IN (
            SELECT id FROM recipes WHERE household_id IN (
                SELECT household_id FROM user_households
                WHERE user_id = auth.uid()
            )
        )
    );

-- Service role access
DROP POLICY IF EXISTS "Service role full access to recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "Service role full access to recipe_ingredients"
    ON recipe_ingredients FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 5. RECIPE_INSTRUCTIONS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view recipe instructions" ON recipe_instructions;
CREATE POLICY "Users can view recipe instructions"
    ON recipe_instructions FOR SELECT
    TO authenticated
    USING (
        recipe_id IN (
            SELECT id FROM recipes WHERE household_id IN (
                SELECT household_id FROM user_households
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can manage recipe instructions" ON recipe_instructions;
CREATE POLICY "Users can manage recipe instructions"
    ON recipe_instructions FOR ALL
    TO authenticated
    USING (
        recipe_id IN (
            SELECT id FROM recipes WHERE household_id IN (
                SELECT household_id FROM user_households
                WHERE user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        recipe_id IN (
            SELECT id FROM recipes WHERE household_id IN (
                SELECT household_id FROM user_households
                WHERE user_id = auth.uid()
            )
        )
    );

-- Service role access
DROP POLICY IF EXISTS "Service role full access to recipe_instructions" ON recipe_instructions;
CREATE POLICY "Service role full access to recipe_instructions"
    ON recipe_instructions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 6. HOUSEHOLD_EVENTS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view household events" ON household_events;
CREATE POLICY "Users can view household events"
    ON household_events FOR SELECT
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage household events" ON household_events;
CREATE POLICY "Users can manage household events"
    ON household_events FOR ALL
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- Service role access
DROP POLICY IF EXISTS "Service role full access to household_events" ON household_events;
CREATE POLICY "Service role full access to household_events"
    ON household_events FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 7. INVENTORY_CATEGORIES TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view inventory categories" ON inventory_categories;
CREATE POLICY "Users can view inventory categories"
    ON inventory_categories FOR SELECT
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage inventory categories" ON inventory_categories;
CREATE POLICY "Users can manage inventory categories"
    ON inventory_categories FOR ALL
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- Service role access
DROP POLICY IF EXISTS "Service role full access to inventory_categories" ON inventory_categories;
CREATE POLICY "Service role full access to inventory_categories"
    ON inventory_categories FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 8. KIOSK_STATUS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view kiosk status" ON kiosk_status;
CREATE POLICY "Users can view kiosk status"
    ON kiosk_status FOR SELECT
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage kiosk status" ON kiosk_status;
CREATE POLICY "Users can manage kiosk status"
    ON kiosk_status FOR ALL
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- Service role access
DROP POLICY IF EXISTS "Service role full access to kiosk_status" ON kiosk_status;
CREATE POLICY "Service role full access to kiosk_status"
    ON kiosk_status FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 9. MEAL_FEEDBACK TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view meal feedback" ON meal_feedback;
CREATE POLICY "Users can view meal feedback"
    ON meal_feedback FOR SELECT
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage meal feedback" ON meal_feedback;
CREATE POLICY "Users can manage meal feedback"
    ON meal_feedback FOR ALL
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM user_households
            WHERE user_id = auth.uid()
        )
    );

-- Service role access
DROP POLICY IF EXISTS "Service role full access to meal_feedback" ON meal_feedback;
CREATE POLICY "Service role full access to meal_feedback"
    ON meal_feedback FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 10. SCHEMA_VERSIONS - Keep blocked (admin only)
-- ============================================================

-- Service role only access (for migrations)
DROP POLICY IF EXISTS "Service role full access to schema_versions" ON schema_versions;
CREATE POLICY "Service role full access to schema_versions"
    ON schema_versions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 11. STORAGE BUCKET: Make private and add policies
-- ============================================================

-- Make the bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'user-food-photos';

-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own photos" ON storage.objects;

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'user-food-photos');

-- Allow authenticated users to view photos (they need to be logged in)
CREATE POLICY "Authenticated users can view photos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'user-food-photos');

-- Allow authenticated users to update their photos
CREATE POLICY "Authenticated users can update photos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'user-food-photos');

-- Allow authenticated users to delete photos
CREATE POLICY "Authenticated users can delete photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'user-food-photos');

-- Service role has full access to storage
CREATE POLICY "Service role full access to storage"
    ON storage.objects FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 12. OPTIONAL: Remove anon read from product_catalog
-- ============================================================

-- Uncomment if you want to require auth for product catalog
-- DROP POLICY IF EXISTS "Allow anon read access" ON product_catalog;

-- ============================================================
-- 13. VERIFICATION QUERY
-- ============================================================

-- Run this after migration to verify:
-- SELECT
--     t.tablename,
--     t.rowsecurity as rls_enabled,
--     COUNT(p.policyname) as policy_count,
--     string_agg(p.policyname, ', ') as policies
-- FROM pg_tables t
-- LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
-- WHERE t.schemaname = 'public'
-- GROUP BY t.tablename, t.rowsecurity
-- ORDER BY policy_count ASC;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

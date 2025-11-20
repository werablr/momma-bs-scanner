-- Migration: Set up authentication and RLS for single household
-- Date: November 13, 2025
-- Purpose: Secure data with proper authentication

-- ============================================================================
-- CREATE HOUSEHOLDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the existing household
INSERT INTO public.households (id, name, created_at)
VALUES ('7c093e13-4bcf-463e-96c1-9f499de9c4f2', 'Momma B''s Household', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CREATE USER_HOUSEHOLDS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_households (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'owner',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, household_id)
);

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR HOUSEHOLDS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their households" ON public.households;

CREATE POLICY "Users can view their households"
ON public.households FOR SELECT
USING (
    id IN (
        SELECT household_id FROM public.user_households
        WHERE user_id = auth.uid()
    )
);

-- ============================================================================
-- RLS POLICIES FOR USER_HOUSEHOLDS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their household memberships" ON public.user_households;

CREATE POLICY "Users can view their household memberships"
ON public.user_households FOR SELECT
USING (user_id = auth.uid());

-- ============================================================================
-- RLS POLICIES FOR INVENTORY_ITEMS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their household inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can insert to their household inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can update their household inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can delete from their household inventory" ON public.inventory_items;

CREATE POLICY "Users can view their household inventory"
ON public.inventory_items FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM public.user_households
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert to their household inventory"
ON public.inventory_items FOR INSERT
WITH CHECK (
    household_id IN (
        SELECT household_id FROM public.user_households
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their household inventory"
ON public.inventory_items FOR UPDATE
USING (
    household_id IN (
        SELECT household_id FROM public.user_households
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete from their household inventory"
ON public.inventory_items FOR DELETE
USING (
    household_id IN (
        SELECT household_id FROM public.user_households
        WHERE user_id = auth.uid()
    )
);

-- ============================================================================
-- RLS POLICIES FOR INVENTORY_HISTORY
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their household history" ON public.inventory_history;
DROP POLICY IF EXISTS "Users can insert to their household history" ON public.inventory_history;

CREATE POLICY "Users can view their household history"
ON public.inventory_history FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM public.user_households
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert to their household history"
ON public.inventory_history FOR INSERT
WITH CHECK (
    household_id IN (
        SELECT household_id FROM public.user_households
        WHERE user_id = auth.uid()
    )
);

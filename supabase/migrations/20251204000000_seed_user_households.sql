-- Migration: Seed user_households with Brian's account
-- Date: December 4, 2025
-- Purpose: Ensure user-household relationship survives db push
-- Root Cause: user_households was never in version control, only manually inserted

-- Insert Brian's user-household relationship
-- Uses ON CONFLICT to be idempotent (safe to run multiple times)
INSERT INTO public.user_households (user_id, household_id, role, joined_at)
VALUES (
  'a4e98888-9537-442e-add6-e25815c01495',  -- Brian (werablr@gmail.com)
  '7c093e13-4bcf-463e-96c1-9f499de9c4f2',  -- Momma B's Household
  'owner',
  NOW()
)
ON CONFLICT (user_id, household_id) DO NOTHING;

-- Log the seed for debugging
DO $$
BEGIN
  RAISE NOTICE 'Seeded user_households: Brian -> Momma B''s Household';
END $$;

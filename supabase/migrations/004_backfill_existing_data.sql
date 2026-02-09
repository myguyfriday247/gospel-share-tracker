-- Migration: Backfill existing data
-- Created: 2026-02-04
-- Purpose: Link existing profiles and entries to people records

-- Step 0: Add person_id to profiles table if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES public.people(id) ON DELETE SET NULL;

-- Step 1: Create people for existing users who don't have linked people
INSERT INTO public.people (email, full_name)
SELECT 
    p.email,
    COALESCE(p.display_name, p.email) as full_name
FROM public.profiles p
LEFT JOIN public.people pe ON p.email = pe.email
WHERE p.person_id IS NULL
AND NOT EXISTS (
    SELECT 1 FROM public.people pe2 
    WHERE pe2.email = p.email
);

-- Step 2: Update profiles with person_id for users who now have people records
UPDATE public.profiles p
SET person_id = (
    SELECT id FROM public.people 
    WHERE email = p.email 
    LIMIT 1
)
WHERE p.person_id IS NULL;

-- Step 3: Create people for entries that don't have linked people
-- This handles entries entered before user accounts existed
INSERT INTO public.people (email, full_name)
SELECT DISTINCT 
    p.email,
    COALESCE(p.display_name, p.email) as full_name
FROM public.gospel_share_entries e
LEFT JOIN public.profiles p ON e.user_id = p.id
LEFT JOIN public.people pe ON p.email = pe.email
WHERE e.person_id IS NULL
AND p.email IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM public.people pe2 
    WHERE pe2.email = p.email
);

-- Step 4: Link entries to people
UPDATE public.gospel_share_entries e
SET person_id = (
    SELECT id FROM public.people 
    WHERE email = (
        SELECT email FROM public.profiles WHERE id = e.user_id
    )
    LIMIT 1
)
WHERE e.person_id IS NULL
AND e.user_id IS NOT NULL;

-- Step 5: Create anonymous people for entries with no user_id
-- These are entries that were created without authentication
INSERT INTO public.people (email, full_name)
SELECT 
    'anonymous-' || e.id::TEXT || '@gospel-share.local' as email,
    'Anonymous User' as full_name
FROM public.gospel_share_entries e
WHERE e.person_id IS NULL
AND e.user_id IS NULL
AND NOT EXISTS (
    SELECT 1 FROM public.people pe 
    WHERE pe.email LIKE 'anonymous-' || e.id::TEXT || '@gospel-share.local'
);

-- Step 6: Link anonymous entries to their new people
UPDATE public.gospel_share_entries e
SET person_id = (
    SELECT id FROM public.people 
    WHERE email = 'anonymous-' || e.id::TEXT || '@gospel-share.local'
    LIMIT 1
)
WHERE e.person_id IS NULL
AND e.user_id IS NULL;

-- Verification query (run this to check migration success)
-- SELECT 
--     COUNT(*) as total_entries,
--     COUNT(CASE WHEN person_id IS NOT NULL THEN 1 END) as linked_entries,
--     COUNT(CASE WHEN person_id IS NULL THEN 1 END) as orphaned_entries
-- FROM public.gospel_share_entries;

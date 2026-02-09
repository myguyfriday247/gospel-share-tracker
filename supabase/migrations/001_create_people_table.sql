-- Migration: Create people table
-- Created: 2026-02-04
-- Purpose: Persistent identity table for gospel share tracking

-- Create people table
CREATE TABLE IF NOT EXISTS public.people (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT people_email_unique_case_insensitive EXCLUDE (
        lower(email) WITH =
    )
);

-- Enable Row Level Security
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read people (for looking up by email during signup)
CREATE POLICY "People are viewable by everyone"
    ON public.people FOR SELECT
    USING (true);

-- Only admins can insert/update/delete people
-- Note: Admin role checking is done via a separate user_roles table
-- For now, allow authenticated users to manage people
CREATE POLICY "Authenticated users can manage people"
    ON public.people FOR ALL
    USING (auth.role() = 'authenticated');

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_people_email
    ON public.people(email);

-- Create index on full_name for searches
CREATE INDEX IF NOT EXISTS idx_people_full_name
    ON public.people(full_name);

-- Migration: Add person_id to gospel_share_entries
-- Created: 2026-02-04
-- Purpose: Link gospel shares to people records

-- Add person_id column to gospel_share_entries
ALTER TABLE public.gospel_share_entries
ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES public.people(id) ON DELETE SET NULL;

-- Create index on person_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_gospel_share_entries_person_id
    ON public.gospel_share_entries(person_id);

-- Enable Row Level Security on gospel_share_entries
ALTER TABLE public.gospel_share_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gospel_share_entries

-- Note: Admin policies reference auth.users.role and raw_user_meta_data
-- Admin role must be set in Supabase Dashboard > Authentication > Users > Edit user

-- Anyone can view shares (for team transparency)
CREATE POLICY "Anyone can view shares"
    ON public.gospel_share_entries FOR SELECT
    USING (true);

-- Authenticated users can insert their own shares
CREATE POLICY "Users can create their own shares"
    ON public.gospel_share_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own shares
CREATE POLICY "Users can update their own shares"
    ON public.gospel_share_entries FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins (with admin role) can manage all shares
CREATE POLICY "Admins can manage all shares"
    ON public.gospel_share_entries FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = auth.users.id
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

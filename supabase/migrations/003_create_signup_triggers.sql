-- Migration: Create triggers for signup flow
-- Created: 2026-02-04
-- Purpose: Auto-create or link people when users sign up

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    matched_person_id UUID;
    new_person_id UUID;
BEGIN
    -- Check if a person with this email already exists
    SELECT id INTO matched_person_id
    FROM public.people
    WHERE email = NEW.email
    LIMIT 1;
    
    IF matched_person_id IS NOT NULL THEN
        -- Person exists - link profile to existing person
        UPDATE public.profiles
        SET person_id = matched_person_id
        WHERE id = NEW.id;
        
        RETURN NEW;
    ELSE
        -- No person exists - create new person
        INSERT INTO public.people (email, full_name)
        VALUES (NEW.email, NEW.raw_user_meta_data->>'full_name')
        RETURNING id INTO new_person_id;
        
        -- Link profile to new person
        UPDATE public.profiles
        SET person_id = new_person_id
        WHERE id = NEW.id;
        
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to normalize full_name on insert/update
CREATE OR REPLACE FUNCTION public.normalize_full_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.full_name := TRIM(LOWER(NEW.full_name));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to normalize names
DROP TRIGGER IF EXISTS normalize_person_name ON public.people;
CREATE TRIGGER normalize_person_name
    BEFORE INSERT OR UPDATE ON public.people
    FOR EACH ROW EXECUTE FUNCTION public.normalize_full_name();

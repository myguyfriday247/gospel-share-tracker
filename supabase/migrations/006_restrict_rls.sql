-- Migration: Restrict RLS to owner + admin
-- Created: 2026-08-17
-- Purpose: Close anonymous read access to all people and entries, and remove the
--          privilege-escalation paths that let a user grant themselves admin.
--
-- BACKGROUND — what is wrong today:
--   1. `people` and `gospel_share_entries` both carry a `USING (true)` SELECT policy with no
--      role restriction, so the `anon` role can read them. Because the Supabase anon key ships
--      in the public JS bundle, every person row (name + email) and every entry (including
--      `notes`) is readable by anyone on the internet, with no login.
--   2. `people` carries `FOR ALL USING (auth.role() = 'authenticated')`, so any logged-in user
--      can update or delete ANY person row — including setting their own `role` to 'admin'.
--   3. The admin policy on entries trusts `raw_user_meta_data->>'role'`, which users can write
--      themselves via supabase.auth.updateUser(). Admin is decided by `people.role` instead.
--
-- ROLLBACK: see the bottom of this file.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Admin test. SECURITY DEFINER so it bypasses RLS on `people` — a policy ON people that
-- SELECTs FROM people would otherwise recurse infinitely.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.people
    WHERE (people.id = auth.uid() OR lower(people.email) = lower(auth.email()))
      AND people.role = 'admin'
  );
$$;

-- The person row(s) belonging to the caller.
--
-- Matching on email as well as id is REQUIRED, not defensive: people imported via the admin
-- CSV importer get a random `people.id`, and app/login/page.tsx re-keys that row to the auth
-- id the first time they sign up. During that re-key the rows still carry the OLD id, so an
-- id-only predicate would block the very migration step that adopts their history.
CREATE OR REPLACE FUNCTION public.current_person_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.people
  WHERE id = auth.uid() OR lower(email) = lower(auth.email());
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
REVOKE ALL ON FUNCTION public.current_person_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_person_ids() TO authenticated;

-- ---------------------------------------------------------------------------
-- people
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "People are viewable by everyone" ON public.people;
DROP POLICY IF EXISTS "Authenticated users can manage people" ON public.people;

-- Read: your own row, or everything if admin.
CREATE POLICY "people_select_own_or_admin"
  ON public.people FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR lower(email) = lower(auth.email())
    OR public.is_admin()
  );

-- Insert: only a row keyed to yourself, and only as a plain user. Admins may insert anyone
-- (the CSV importer relies on this).
CREATE POLICY "people_insert_self_or_admin"
  ON public.people FOR INSERT TO authenticated
  WITH CHECK (
    (id = auth.uid() AND coalesce(role, 'user') = 'user')
    OR public.is_admin()
  );

-- Update: your own row (this is what the signup re-key needs), or anyone if admin.
-- Role changes are blocked separately by the trigger below.
CREATE POLICY "people_update_own_or_admin"
  ON public.people FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR lower(email) = lower(auth.email())
    OR public.is_admin()
  )
  WITH CHECK (
    id = auth.uid()
    OR lower(email) = lower(auth.email())
    OR public.is_admin()
  );

-- Delete: admins only.
CREATE POLICY "people_delete_admin_only"
  ON public.people FOR DELETE TO authenticated
  USING (public.is_admin());

-- The UPDATE policy above necessarily lets a user write their own row, which would still let
-- them set role='admin'. RLS cannot restrict individual columns, so guard it with a trigger.
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change a role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_guard_role ON public.people;
CREATE TRIGGER people_guard_role
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- ---------------------------------------------------------------------------
-- gospel_share_entries
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view shares" ON public.gospel_share_entries;
DROP POLICY IF EXISTS "Users can create their own shares" ON public.gospel_share_entries;
DROP POLICY IF EXISTS "Users can update their own shares" ON public.gospel_share_entries;
DROP POLICY IF EXISTS "Admins can manage all shares" ON public.gospel_share_entries;

-- Note: the old INSERT/UPDATE policies gated on `auth.uid() = user_id`, but the application
-- only ever writes `person_id` — `user_id` is a legacy column the app never populates. These
-- replacements key off `person_id`, which is what the code actually uses.

CREATE POLICY "entries_select_own_or_admin"
  ON public.gospel_share_entries FOR SELECT TO authenticated
  USING (
    person_id IN (SELECT public.current_person_ids())
    OR public.is_admin()
  );

CREATE POLICY "entries_insert_own_or_admin"
  ON public.gospel_share_entries FOR INSERT TO authenticated
  WITH CHECK (
    person_id IN (SELECT public.current_person_ids())
    OR public.is_admin()
  );

CREATE POLICY "entries_update_own_or_admin"
  ON public.gospel_share_entries FOR UPDATE TO authenticated
  USING (
    person_id IN (SELECT public.current_person_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    person_id IN (SELECT public.current_person_ids())
    OR public.is_admin()
  );

CREATE POLICY "entries_delete_own_or_admin"
  ON public.gospel_share_entries FOR DELETE TO authenticated
  USING (
    person_id IN (SELECT public.current_person_ids())
    OR public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- ROLLBACK (restores the previous, permissive behaviour)
-- ---------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS people_guard_role ON public.people;
-- DROP FUNCTION IF EXISTS public.prevent_role_self_escalation();
-- DROP POLICY IF EXISTS "people_select_own_or_admin"   ON public.people;
-- DROP POLICY IF EXISTS "people_insert_self_or_admin"  ON public.people;
-- DROP POLICY IF EXISTS "people_update_own_or_admin"   ON public.people;
-- DROP POLICY IF EXISTS "people_delete_admin_only"     ON public.people;
-- DROP POLICY IF EXISTS "entries_select_own_or_admin"  ON public.gospel_share_entries;
-- DROP POLICY IF EXISTS "entries_insert_own_or_admin"  ON public.gospel_share_entries;
-- DROP POLICY IF EXISTS "entries_update_own_or_admin"  ON public.gospel_share_entries;
-- DROP POLICY IF EXISTS "entries_delete_own_or_admin"  ON public.gospel_share_entries;
-- DROP FUNCTION IF EXISTS public.current_person_ids();
-- DROP FUNCTION IF EXISTS public.is_admin();
-- CREATE POLICY "People are viewable by everyone" ON public.people FOR SELECT USING (true);
-- CREATE POLICY "Authenticated users can manage people" ON public.people FOR ALL
--   USING (auth.role() = 'authenticated');
-- CREATE POLICY "Anyone can view shares" ON public.gospel_share_entries FOR SELECT USING (true);

-- Migration: atomic adoption of an imported person record at signup
-- Created: 2026-08-18
-- Purpose: fix a regression introduced by migration 006, and make the re-key crash-safe.
--
-- BACKGROUND
--
-- People imported by CSV get a random people.id. They are joined to a login the first time
-- they sign up, when the app re-keys people.id to their auth id and repoints their entries.
-- Only 3 of 131 people have made that transition; the other 128 have not signed in yet.
--
-- Migration 006 made that re-key impossible from the client. entries_update_own_or_admin has
--   WITH CHECK (person_id IN (SELECT gst_current_person_ids()) OR gst_is_admin())
-- and gst_current_person_ids() resolves an un-re-keyed user to their OLD people.id, via the
-- email branch. So:
--
--   * repoint entries first  -> the new person_id (auth.uid()) is not yet one of the caller's
--                               ids, so WITH CHECK rejects the update
--   * update people first    -> gst_current_person_ids() now returns only auth.uid(), so the
--                               entries USING clause no longer matches the old id and zero
--                               rows are repointed, orphaning the history
--
-- Neither order works, so an imported member signing up would silently fail to inherit their
-- entries. The client also ran the two writes without a transaction and without checking
-- either error.
--
-- This function does both writes atomically, server-side, in one statement pair.
--
-- SECURITY DEFINER is required: mid-adoption the caller cannot satisfy the entries policy, by
-- exactly the argument above. The safety property is that it only ever claims a row whose
-- email equals the caller's own verified auth.email() from the JWT — a caller cannot name a
-- target. It is also strictly tighter than the code it replaces, which keyed off the address
-- typed into the signup form rather than the authenticated one.
--
-- NOTE: this inherits the project's email-confirmation setting. If Supabase is configured to
-- issue a session before the address is confirmed, someone could sign up as another person's
-- email and adopt their record. That was equally true before this migration; confirm that
-- "Confirm email" is enabled under Authentication -> Providers.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.gst_claim_person_on_signup();

CREATE OR REPLACE FUNCTION public.gst_claim_person_on_signup()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $gst_claim$
DECLARE
  v_uid      uuid := auth.uid();
  v_email    text := auth.email();
  v_existing uuid;
BEGIN
  IF v_uid IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Already keyed to this login: nothing to adopt.
  PERFORM 1 FROM public.people WHERE id = v_uid;
  IF FOUND THEN
    RETURN v_uid;
  END IF;

  -- A pre-existing record for THIS caller's verified address.
  SELECT id INTO v_existing
  FROM public.people
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_existing IS NULL THEN
    RETURN NULL;  -- caller creates a fresh person row
  END IF;

  -- Both or neither: a failure here rolls the pair back rather than leaving entries
  -- pointing at an id no person row holds.
  UPDATE public.gospel_share_entries SET person_id = v_uid WHERE person_id = v_existing;
  UPDATE public.people SET id = v_uid WHERE id = v_existing;

  RETURN v_uid;
END;
$gst_claim$;

REVOKE ALL ON FUNCTION public.gst_claim_person_on_signup() FROM public;
GRANT EXECUTE ON FUNCTION public.gst_claim_person_on_signup() TO authenticated;

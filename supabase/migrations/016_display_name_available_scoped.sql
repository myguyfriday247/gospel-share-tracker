-- Migration: scope the signup display-name check to the signing-up address
-- Created: 2026-09-03
-- Purpose: unblock CSV-imported members who cannot create a login.
--
-- BACKGROUND
--
-- display_name_available() (migration 005) returned false if ANY people row held the name:
--
--   RETURN NOT EXISTS (SELECT 1 FROM people WHERE LOWER(full_name) = LOWER(p_name));
--
-- The signup handler treated that as "this person already has an account" and diverted them
-- to the forgot-password form. But an imported member's own people row already holds their
-- name — that is the entire premise of gst_claim_person_on_signup(), which adopts the row and
-- repoints their entries. So the check rejected exactly the people it was supposed to let in.
--
-- The reset form then did nothing, because an imported person has no auth.users row and
-- resetPasswordForEmail() no-ops for unknown addresses to prevent email enumeration. Neither
-- end reported an error, so the member was stuck in a silent loop. This affected all 118
-- unclaimed imported people, not just the one who reported it.
--
-- THE CHANGE
--
-- A name is only "taken" when it belongs to a DIFFERENT address. Matching on email is what
-- gst_claim_person_on_signup() already keys off, so the two agree about who owns a row.
--
-- p_email defaults to NULL (= the old all-rows behaviour) so any caller still passing one
-- argument keeps working rather than failing to resolve.
--
-- The old single-argument function must be dropped: leaving it beside a two-argument version
-- with a default makes a one-argument call ambiguous, which errors at the call site.
--
-- Grants are made explicit here. anon needs EXECUTE because the check runs on the signup form
-- before the visitor has a session; previously that worked only via Postgres's implicit
-- PUBLIC grant on new functions.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.display_name_available(text, text);
--   -- then re-run migration 005 to restore the single-argument version.

DROP FUNCTION IF EXISTS public.display_name_available(text);
DROP FUNCTION IF EXISTS public.display_name_available(text, text);

CREATE FUNCTION public.display_name_available(p_name text, p_email text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $display_name_available$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.people
    WHERE lower(full_name) = lower(btrim(p_name))
      AND (
        p_email IS NULL
        OR email IS NULL
        OR lower(email) IS DISTINCT FROM lower(btrim(p_email))
      )
  );
$display_name_available$;

REVOKE ALL ON FUNCTION public.display_name_available(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.display_name_available(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.display_name_available(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.display_name_available(text, text) TO service_role;

COMMENT ON FUNCTION public.display_name_available(text, text) IS
'Signup display-name check. Returns false only when the name belongs to a person row with a
different email, so an imported member can claim their own record (see
gst_claim_person_on_signup, which likewise matches on email). Called by anon from the signup
form. Omitting p_email restores the pre-016 all-rows behaviour.';

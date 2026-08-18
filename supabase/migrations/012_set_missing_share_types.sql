-- Migration: set the share type on three entries that record none
-- Created: 2026-08-18
--
-- Three of the seven flagless entries appear in entries-completed.csv with
-- gospel_presentation = TRUE. The rest of each row (person, date, number reached, notes)
-- matches what is stored, so the source file is the same encounter with the type filled in.
-- Importing that file would have added duplicates rather than correcting these, because the
-- importer only appends; this sets the flag on the existing rows instead.
--
-- The other four flagless entries are left alone: no source names their share type, and
-- guessing would be inventing a record of what someone did.
--
-- Each UPDATE re-checks that the row is still flagless, so this is a no-op on a second run
-- and will not overwrite a type set by hand in the meantime.
--
-- ROLLBACK: set gospel_presentation = false for these three ids.

BEGIN;

UPDATE public.gospel_share_entries SET gospel_presentation = true
  WHERE id = '8c73c071-03cd-4d1b-bad4-f0cbf496b323'
    AND NOT church_invite AND NOT spiritual_conversation
    AND NOT story_share AND NOT gospel_presentation;

UPDATE public.gospel_share_entries SET gospel_presentation = true
  WHERE id = 'a5181c2b-cb96-4b70-bb4c-9bd4903038fc'
    AND NOT church_invite AND NOT spiritual_conversation
    AND NOT story_share AND NOT gospel_presentation;

UPDATE public.gospel_share_entries SET gospel_presentation = true
  WHERE id = '1a46c6b3-b827-4496-a307-4d6163d12002'
    AND NOT church_invite AND NOT spiritual_conversation
    AND NOT story_share AND NOT gospel_presentation;

COMMIT;

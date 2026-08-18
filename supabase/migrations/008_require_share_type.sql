-- Migration: require at least one share type on an entry
-- Created: 2026-08-18
-- Purpose: an entry that records no share type describes nothing. The add form has always
--          rejected these, but the edit dialog and both CSV importers did not, so they could
--          still be created. This makes the rule impossible to bypass.
--
-- NOT VALID is deliberate. Seven existing rows (2025-01-18 to 2026-01-18) have no share type
-- set. A plain CHECK would refuse to attach while they exist, and the alternative — editing
-- historical entries to satisfy a new rule — would be inventing data that was never recorded.
-- NOT VALID enforces the constraint on every INSERT and UPDATE from now on while leaving those
-- seven untouched, which matches the intent: correct going forward, don't rewrite the past.
--
-- Note that an UPDATE to one of those seven rows will now be rejected unless it also sets a
-- share type. That is the desired behaviour: editing a flagless entry should require saying
-- what actually happened.
--
-- To review them:
--   SELECT id, person_id, entry_date, number_reached, notes
--   FROM public.gospel_share_entries
--   WHERE NOT church_invite AND NOT spiritual_conversation
--     AND NOT story_share AND NOT gospel_presentation;
--
-- If they are ever corrected, the constraint can be promoted to fully validated with:
--   ALTER TABLE public.gospel_share_entries VALIDATE CONSTRAINT gospel_share_entries_has_share_type;
--
-- ROLLBACK:
--   ALTER TABLE public.gospel_share_entries
--     DROP CONSTRAINT IF EXISTS gospel_share_entries_has_share_type;

ALTER TABLE public.gospel_share_entries
  DROP CONSTRAINT IF EXISTS gospel_share_entries_has_share_type;

ALTER TABLE public.gospel_share_entries
  ADD CONSTRAINT gospel_share_entries_has_share_type
  CHECK (
    church_invite
    OR spiritual_conversation
    OR story_share
    OR gospel_presentation
  )
  NOT VALID;

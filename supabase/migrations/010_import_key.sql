-- Migration: make CSV imports repeatable
-- Created: 2026-08-18
-- Purpose: re-running an import file inserted everything a second time. Nothing prevented it —
--          the table has only a primary key on a generated id.
--
-- Each imported row carries a deterministic fingerprint of its own content plus its occurrence
-- number within the file. Re-importing the same file produces the same fingerprints, and the
-- unique index below turns those inserts into skips instead of duplicates.
--
-- The occurrence number matters. A real file has 18 rows that repeat identically, 37 extra
-- copies in total — someone logging two indistinguishable conversations on the same day. A
-- plain content hash would collapse those into one and silently drop real records. Numbering
-- them means copy 1 and copy 2 both import, while a second run of the same file skips both.
--
-- The index is PARTIAL, on import_key IS NOT NULL. That is deliberate: entries created through
-- the app never carry a key and are therefore never constrained. Members can still log two
-- identical encounters on the same day, which happens 58 times in the existing data — a
-- constraint on the natural key would have blocked that.
--
-- SCOPE: this protects imports made from now on. The 674 rows already loaded have no key, so a
-- file whose rows predate this migration will still import as duplicates. Check for overlap
-- before loading historical files.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS gospel_share_entries_import_key_uniq;
--   ALTER TABLE public.gospel_share_entries DROP COLUMN IF EXISTS import_key;

ALTER TABLE public.gospel_share_entries
  ADD COLUMN IF NOT EXISTS import_key text;

COMMENT ON COLUMN public.gospel_share_entries.import_key IS
  'SHA-256 of the source CSV row plus its occurrence number in that file. NULL for entries created in the app. Unique when present, so re-importing a file skips rather than duplicates.';

CREATE UNIQUE INDEX IF NOT EXISTS gospel_share_entries_import_key_uniq
  ON public.gospel_share_entries (import_key)
  WHERE import_key IS NOT NULL;

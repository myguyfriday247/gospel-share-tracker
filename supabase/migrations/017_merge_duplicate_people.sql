-- Migration: merge four duplicate person records
-- Created: 2026-09-03
-- Purpose: consolidate split history and clear the last name collisions blocking signup.
--
-- BACKGROUND
--
-- Four members were each imported under two email addresses, leaving two people rows with the
-- same full_name and their entries split across both. Even after migration 016 scoped the
-- signup name check to the signing-up address, these eight stayed blocked: the name genuinely
-- did belong to another address, so display_name_available() correctly returned false for both
-- halves of every pair. None of the eight has ever had an auth account.
--
--   kimberly talbot   ktalbot968@yahoo.com    ->  ktalbot9168@yahoo.com    (one dropped digit)
--   mary johnson      johnsonma@ecu.edu       ->  johnsonma71@gmail.com    (school -> personal)
--   poala millan      rpmillan@aol.com        ->  pgmillan24@gmail.com     (household -> personal)
--   quanita drake     netdrake@yahoo.com      ->  quanitadrake@yahoo.com   (second address)
--
-- SURVIVING ADDRESS
--
-- Chris chose these, and the choice is not cosmetic. gst_claim_person_on_signup() matches on
-- email, so the surviving row must carry the address the member will actually sign up with —
-- otherwise the claim finds nothing, they get a fresh empty row, and the merged history sits
-- orphaned on a row nobody can reach. For johnson and millan the surviving row is therefore the
-- one with FEWER entries; the larger set is repointed onto it. That is intended.
--
-- ORDER OF OPERATIONS
--
-- gospel_share_entries.person_id is ON DELETE SET NULL (migration 002). Deleting a person row
-- before repointing would silently null out their entries, stranding them where no policy can
-- see them. Entries are repointed first, then the now-empty row is deleted.
--
-- import_key is untouched, and its unique index is partial on IS NOT NULL (migration 010), so
-- repointing cannot collide.
--
-- The surviving row inherits the earlier created_at of the pair, so "member since" stays true.
--
-- SAFETY
--
-- Each merge is guarded: both rows must exist and their names must still match, or the pair is
-- skipped with a notice rather than half-applied. Re-running is a no-op once the loser row is
-- gone, so this is idempotent.
--
-- ROLLBACK
--
-- The merge itself is not reversible from the live tables: a deleted person row cannot be
-- reconstructed, and an entry does not record the person_id it was moved off. So this migration
-- snapshots both first, into a `backup` schema rather than a file — the data is member PII and
-- belongs in the database, not on someone's disk.
--
-- `backup` is deliberately NOT one of PostgREST's exposed schemas (only `public` is), so these
-- tables are unreachable through the API even before the explicit REVOKE below.
--
-- To restore:
--   INSERT INTO public.people SELECT * FROM backup.people_pre_017
--     ON CONFLICT (id) DO NOTHING;
--   UPDATE public.gospel_share_entries e
--      SET person_id = b.person_id
--     FROM backup.entries_pre_017 b
--    WHERE e.id = b.id;
--
-- Drop the snapshot once the merge has been confirmed good:
--   DROP SCHEMA backup CASCADE;

-- ---------------------------------------------------------------------------
-- Snapshot, before anything is touched
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS backup.people_pre_017 AS
  SELECT * FROM public.people
   WHERE lower(email) IN (
     'ktalbot968@yahoo.com','ktalbot9168@yahoo.com',
     'johnsonma@ecu.edu','johnsonma71@gmail.com',
     'rpmillan@aol.com','pgmillan24@gmail.com',
     'netdrake@yahoo.com','quanitadrake@yahoo.com'
   );

CREATE TABLE IF NOT EXISTS backup.entries_pre_017 AS
  SELECT * FROM public.gospel_share_entries
   WHERE person_id IN (SELECT id FROM backup.people_pre_017);

REVOKE ALL ON ALL TABLES IN SCHEMA backup FROM anon, authenticated;

-- Belt and braces. The schema is already unreachable through the API — PostgREST exposes only
-- `public` — and the grants above are revoked. RLS with no policies makes the tables deny-by-
-- default on their own, so the guarantee does not depend on the API's exposed-schema setting
-- staying as it is. Nothing needs to read these through the API; a restore runs here in the SQL
-- editor, and both postgres and service_role bypass RLS.
ALTER TABLE backup.people_pre_017  ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup.entries_pre_017 ENABLE ROW LEVEL SECURITY;

-- Expect 8 people and 39 entries. If the people count is not 8, stop and investigate before
-- running the merge below — the pairs no longer look the way they did when this was written.
DO $check_snapshot$
DECLARE
  v_people  integer;
  v_entries integer;
BEGIN
  SELECT count(*) INTO v_people  FROM backup.people_pre_017;
  SELECT count(*) INTO v_entries FROM backup.entries_pre_017;
  RAISE NOTICE 'snapshot: % people, % entries', v_people, v_entries;
  IF v_people <> 8 THEN
    RAISE EXCEPTION 'expected 8 person rows in snapshot, found % — aborting', v_people;
  END IF;
END;
$check_snapshot$;

-- ---------------------------------------------------------------------------
-- Merge
-- ---------------------------------------------------------------------------

DO $merge_people$
DECLARE
  v_pairs   text[][] := ARRAY[
    ['ktalbot968@yahoo.com',  'ktalbot9168@yahoo.com'],
    ['johnsonma@ecu.edu',     'johnsonma71@gmail.com'],
    ['rpmillan@aol.com',      'pgmillan24@gmail.com'],
    ['netdrake@yahoo.com',    'quanitadrake@yahoo.com']
  ];
  v_loser_email  text;
  v_winner_email text;
  v_loser        public.people%ROWTYPE;
  v_winner       public.people%ROWTYPE;
  v_moved        integer;
  i              integer;
BEGIN
  FOR i IN 1 .. array_length(v_pairs, 1) LOOP
    v_loser_email  := v_pairs[i][1];
    v_winner_email := v_pairs[i][2];

    SELECT * INTO v_loser  FROM public.people WHERE lower(email) = lower(v_loser_email);
    SELECT * INTO v_winner FROM public.people WHERE lower(email) = lower(v_winner_email);

    IF v_loser.id IS NULL THEN
      RAISE NOTICE 'skip %: already merged (no row for that address)', v_loser_email;
      CONTINUE;
    END IF;

    IF v_winner.id IS NULL THEN
      RAISE WARNING 'skip %: surviving row % not found — NOT deleting anything',
        v_loser_email, v_winner_email;
      CONTINUE;
    END IF;

    IF lower(btrim(v_loser.full_name)) IS DISTINCT FROM lower(btrim(v_winner.full_name)) THEN
      RAISE WARNING 'skip %: names no longer match (% vs %) — NOT merging',
        v_loser_email, v_loser.full_name, v_winner.full_name;
      CONTINUE;
    END IF;

    UPDATE public.gospel_share_entries
       SET person_id = v_winner.id
     WHERE person_id = v_loser.id;
    GET DIAGNOSTICS v_moved = ROW_COUNT;

    UPDATE public.people
       SET created_at = least(created_at, v_loser.created_at)
     WHERE id = v_winner.id;

    DELETE FROM public.people WHERE id = v_loser.id;

    RAISE NOTICE 'merged % -> % (% entries moved)', v_loser_email, v_winner_email, v_moved;
  END LOOP;
END;
$merge_people$;

-- Verification — expect zero rows (no full_name held by more than one person):
--   SELECT lower(full_name), count(*) FROM public.people
--   GROUP BY 1 HAVING count(*) > 1;
--
-- And expect zero orphaned entries:
--   SELECT count(*) FROM public.gospel_share_entries WHERE person_id IS NULL;

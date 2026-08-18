-- Migration: repair the final mojibake note
-- Created: 2026-08-18
--
-- Migration 011 repaired 101 of 102 corrupted notes. This one belonged to an entry that still
-- recorded no share type, and migration 008's CHECK -- NOT VALID, so it tolerates such a row
-- but rejects any UPDATE to it -- blocked the repair. Migration 013 classified that entry, so
-- the last one can now be fixed.
--
-- Same inverse as 011: re-encode Mac Roman, decode UTF-8, written out literally.
--
-- ROLLBACK: backups/notes-before-011-*.json holds the original.

BEGIN;

UPDATE public.gospel_share_entries SET notes = $mojibake$Today I had a phone call from a patient who needed to cancel her appointment because her checking account and savings account have been hacked and she had no money to reach us since she lived an hour and a half away as we begin to talk I begin to explain to her That she needs to put her trust in Jesus and not put her trust in man. We talked about her condition and how being stressed out with only worse at her condition so she needed to put her trust and someone who could help and that would be Jesus Christ. We talked about her faith, and I expressed to her that when she goes to the bank, if she would just stop, take a deep breath. Pray wait a minute and allow God‘s Holy Spirit to comfort her to calm her and to give her clarity and she could face any battle. The patient thanked me And told me those words of encouragement, reminding her of her faith and reminding her that Jesus Christ is the answer was what she needed on a day like today she blessed me and she hung up.$mojibake$
  WHERE id = 'e3882387-3be8-4ba5-9f7a-907c9af2f40f' AND notes = $mojibake$Today I had a phone call from a patient who needed to cancel her appointment because her checking account and savings account have been hacked and she had no money to reach us since she lived an hour and a half away as we begin to talk I begin to explain to her That she needs to put her trust in Jesus and not put her trust in man. We talked about her condition and how being stressed out with only worse at her condition so she needed to put her trust and someone who could help and that would be Jesus Christ. We talked about her faith, and I expressed to her that when she goes to the bank, if she would just stop, take a deep breath. Pray wait a minute and allow God‚Äòs Holy Spirit to comfort her to calm her and to give her clarity and she could face any battle. The patient thanked me And told me those words of encouragement, reminding her of her faith and reminding her that Jesus Christ is the answer was what she needed on a day like today she blessed me and she hung up.$mojibake$;

COMMIT;

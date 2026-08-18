-- Migration: classify the last four entries that recorded no share type
-- Created: 2026-08-18
--
-- These four predate the requirement and no import file names their type, so each was decided
-- by Chris against how the same member classified their own near-identical entries:
--
--   Reggie Dillahunt, 2025-02-09 and 2025-03-14 -> gospel_presentation
--     Both are prison altar calls. His 2025-09-08 entry, "Gave the altar call at the Craven
--     Correctional Facility", is already gospel_presentation, as is his 2025-01-12 service
--     there. Same person, venue and activity.
--
--   Camille Best, 2025-01-18 -> gospel_presentation
--     "I led him in a confession and surrender prayer." She uses gospel_presentation for
--     sharing the gospel (2025-03-01) and spiritual_conversation for discussion (2025-02-23).
--
--   Patricia Andrews, 2025-03-27 -> spiritual_conversation + gospel_presentation
--     A phone call where she explained trusting Jesus and discussed the patient's faith,
--     recording one response. Matches her 2025-02-28 entry, where explaining the gospel to
--     co-workers carries both flags.
--
-- Each UPDATE re-checks the row is still flagless, so a second run is a no-op.
--
-- Once this lands, the last mojibake note (Patricia's, blocked until now by migration 008's
-- CHECK rejecting updates to a flagless row) can finally be repaired -- see 014.
--
-- ROLLBACK: set the flags back to false for these four ids.

BEGIN;

-- Reggie Dillahunt, altar call at Craven County Correctional Facility
UPDATE public.gospel_share_entries SET gospel_presentation = true
  WHERE id = '04147318-717e-4ac7-95cf-fd372e622066'
    AND NOT church_invite AND NOT spiritual_conversation
    AND NOT story_share AND NOT gospel_presentation;

-- Reggie Dillahunt, altar call, 3 of 10 responded
UPDATE public.gospel_share_entries SET gospel_presentation = true
  WHERE id = '8023ac53-7991-4dd5-ac63-2a0b33c0ef5b'
    AND NOT church_invite AND NOT spiritual_conversation
    AND NOT story_share AND NOT gospel_presentation;

-- Camille Best, led her son in a confession and surrender prayer
UPDATE public.gospel_share_entries SET gospel_presentation = true
  WHERE id = 'f8d18b2c-81c8-4358-ac2f-4df931d494bc'
    AND NOT church_invite AND NOT spiritual_conversation
    AND NOT story_share AND NOT gospel_presentation;

-- Patricia Andrews, phone call with a patient about trusting Jesus
UPDATE public.gospel_share_entries
   SET spiritual_conversation = true, gospel_presentation = true
  WHERE id = 'e3882387-3be8-4ba5-9f7a-907c9af2f40f'
    AND NOT church_invite AND NOT spiritual_conversation
    AND NOT story_share AND NOT gospel_presentation;

COMMIT;

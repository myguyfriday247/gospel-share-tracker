-- Migration: server-side aggregates for the admin dashboard
-- Created: 2026-08-18
-- Purpose: stop downloading the whole entries table into the browser to compute community
--          totals (REVIEW.md #18).
--
-- The admin dashboard fetched every matching row and reduced it in JavaScript. That is one
-- large transfer that grows with the data, and it is why the page needed pagination just to
-- stay correct past PostgREST's row ceiling. These three functions do the same arithmetic in
-- Postgres and return a handful of rows instead.
--
-- They lean on the GENERATED columns already on the table --
--   invites_reached       = CASE WHEN church_invite          THEN number_reached  ELSE 0 END
--   conversations_reached = CASE WHEN spiritual_conversation THEN number_reached  ELSE 0 END
--   story_share_reached   = CASE WHEN story_share            THEN number_reached  ELSE 0 END
--   gospel_share_reached  = CASE WHEN gospel_presentation    THEN number_reached  ELSE 0 END
--   responses_count       = CASE WHEN gospel_response        THEN number_response ELSE 0 END
-- so the per-type sums are a plain SUM of a column Postgres already maintains.
--
-- SECURITY INVOKER (the default) is deliberate: these run with the caller's own permissions,
-- so migration 006's RLS still applies. An admin aggregates over everything; a non-admin
-- calling them would aggregate over their own rows only. No SECURITY DEFINER bypass.
--
-- NOTE ON `total_responses`: this uses `responses_count`, i.e. number_response counted only
-- when gospel_response is true. The personal dashboard already uses that rule; the admin
-- dashboard summed number_response unconditionally. Both produce 414 today because no row has
-- number_response > 0 with gospel_response false, so this changes no displayed figure — it
-- just settles which rule is correct.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.gst_entry_totals(date, date);
--   DROP FUNCTION IF EXISTS public.gst_entries_by_date(date, date);
--   DROP FUNCTION IF EXISTS public.gst_entries_by_person(date, date);

-- ---------------------------------------------------------------------------
-- Overall totals
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gst_entry_totals(
  p_start date DEFAULT NULL,
  p_end   date DEFAULT NULL
)
RETURNS TABLE (
  unique_people   bigint,
  entry_count     bigint,
  total_reached   bigint,
  total_responses bigint,
  invites         bigint,
  conversations   bigint,
  stories         bigint,
  gospel          bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $gst_totals$
  SELECT
    count(DISTINCT e.person_id),
    count(*),
    coalesce(sum(e.number_reached), 0),
    coalesce(sum(e.responses_count), 0),
    coalesce(sum(e.invites_reached), 0),
    coalesce(sum(e.conversations_reached), 0),
    coalesce(sum(e.story_share_reached), 0),
    coalesce(sum(e.gospel_share_reached), 0)
  FROM public.gospel_share_entries e
  WHERE (p_start IS NULL OR e.entry_date >= p_start)
    AND (p_end   IS NULL OR e.entry_date <= p_end);
$gst_totals$;

-- ---------------------------------------------------------------------------
-- Time series for the chart
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gst_entries_by_date(
  p_start date DEFAULT NULL,
  p_end   date DEFAULT NULL
)
RETURNS TABLE (
  entry_day date,
  reached   bigint,
  responses bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $gst_by_date$
  SELECT
    e.entry_date,
    coalesce(sum(e.number_reached), 0),
    coalesce(sum(e.responses_count), 0)
  FROM public.gospel_share_entries e
  WHERE (p_start IS NULL OR e.entry_date >= p_start)
    AND (p_end   IS NULL OR e.entry_date <= p_end)
  GROUP BY e.entry_date
  ORDER BY e.entry_date;
$gst_by_date$;

-- ---------------------------------------------------------------------------
-- Per-person leaderboard
-- ---------------------------------------------------------------------------
-- LEFT JOIN, not JOIN: person_id is nullable (people.id is ON DELETE SET NULL), so an entry
-- whose person was removed would otherwise vanish from the totals rather than showing up
-- unattributed. There are none today, but the aggregate should not silently drop rows.
CREATE OR REPLACE FUNCTION public.gst_entries_by_person(
  p_start date DEFAULT NULL,
  p_end   date DEFAULT NULL
)
RETURNS TABLE (
  person_key      uuid,
  display_name    text,
  entry_count     bigint,
  total_reached   bigint,
  total_responses bigint,
  invites         bigint,
  conversations   bigint,
  stories         bigint,
  gospel          bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $gst_by_person$
  SELECT
    e.person_id,
    coalesce(p.full_name, 'Anonymous'),
    count(*),
    coalesce(sum(e.number_reached), 0),
    coalesce(sum(e.responses_count), 0),
    coalesce(sum(e.invites_reached), 0),
    coalesce(sum(e.conversations_reached), 0),
    coalesce(sum(e.story_share_reached), 0),
    coalesce(sum(e.gospel_share_reached), 0)
  FROM public.gospel_share_entries e
  LEFT JOIN public.people p ON p.id = e.person_id
  WHERE (p_start IS NULL OR e.entry_date >= p_start)
    AND (p_end   IS NULL OR e.entry_date <= p_end)
  GROUP BY e.person_id, p.full_name
  ORDER BY 4 DESC;
$gst_by_person$;

REVOKE ALL ON FUNCTION public.gst_entry_totals(date, date)      FROM public;
REVOKE ALL ON FUNCTION public.gst_entries_by_date(date, date)   FROM public;
REVOKE ALL ON FUNCTION public.gst_entries_by_person(date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.gst_entry_totals(date, date)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.gst_entries_by_date(date, date)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.gst_entries_by_person(date, date) TO authenticated;

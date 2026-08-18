-- Migration: promote the share-type CHECK to fully validated
-- Created: 2026-08-18
--
-- Migration 008 added gospel_share_entries_has_share_type as NOT VALID because seven rows
-- recorded no share type and rewriting them to satisfy a new rule would have invented data.
-- Migrations 012 and 013 classified all seven from evidence, so zero rows violate it and the
-- constraint can now be validated in full.
--
-- Beyond tidiness this matters: while NOT VALID, the planner cannot rely on the constraint, and
-- the asymmetry was a live trap -- the constraint tolerated a flagless row but rejected any
-- UPDATE to it, which is what blocked repairing one corrupted note in migration 011.
--
-- ROLLBACK: there is no "un-validate". Drop and re-add as NOT VALID if ever needed:
--   ALTER TABLE public.gospel_share_entries
--     DROP CONSTRAINT gospel_share_entries_has_share_type;
--   (then re-run 008)

ALTER TABLE public.gospel_share_entries
  VALIDATE CONSTRAINT gospel_share_entries_has_share_type;

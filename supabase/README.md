# Supabase Setup for Gospel Share Tracker

## Migration Order

Run these migrations in order in your Supabase SQL Editor:

1. `001_create_people_table.sql` - Creates the people table
2. `002_add_person_id_to_entries.sql` - Adds person_id to gospel_share_entries
3. `003_create_signup_triggers.sql` - Creates triggers for signup flow
4. `004_backfill_existing_data.sql` - Links existing data to people
5. `005_display_name_available.sql` - Creates the `display_name_available` RPC function used by signup

This folder is the single source of truth for schema history — a duplicate root-level
`migrations/` folder (holding only what's now 005) existed until this was reconciled; don't
recreate it.

## Migration Status

| Migration | Status | Description |
|-----------|--------|-------------|
| 001 | Ready | Creates `people` table |
| 002 | Ready | Adds `person_id` FK to entries |
| 003 | Ready | Creates signup triggers |
| 004 | Ready | Backfills existing data |
| 005 | Confirmed live | Creates `display_name_available` RPC function |

**2026-08-17:** Verified directly against the live project — the `people` table is reachable and
`display_name_available` returns correctly, so migration 005 is confirmed applied. (Earlier the
same day, DNS briefly failed to resolve for this project across three resolvers; it recovered on
its own — likely a transient pause/wake blip. No action needed, but if it recurs, check the
[Supabase dashboard](https://supabase.com/dashboard/project/xomgejazpgwvadmglwtd) before assuming
the app itself is broken.)

## Running Migrations

### Option 1: Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project: `xomgejazpgwvadmglwtd`
3. Go to **SQL Editor**
4. Open each migration file and run in order

### Option 2: Supabase CLI

```bash
cd supabase
supabase db push
```

## Verification

After running migrations, verify with:

```sql
-- Check people table
SELECT COUNT(*) FROM public.people;

-- Check entries have person_id
SELECT 
    COUNT(*) as total_entries,
    COUNT(CASE WHEN person_id IS NOT NULL THEN 1 END) as linked
FROM public.gospel_share_entries;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('people', 'gospel_share_entries');
```

## Rollback (if needed)

To rollback, run these in reverse order:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS normalize_person_name ON public.people;
DROP FUNCTION IF EXISTS public.normalize_full_name();
ALTER TABLE public.gospel_share_entries DROP COLUMN IF EXISTS person_id;
DROP TABLE IF EXISTS public.people CASCADE;
```

## Next Steps After Migrations

1. Update dashboard queries to join with `people` table
2. Test signup flow to verify person creation
3. Verify existing users see their historical data

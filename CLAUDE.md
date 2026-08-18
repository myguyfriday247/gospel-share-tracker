# Gospel Share Tracker — Claude Code Context

Personal-evangelism tracking app. Users log gospel-sharing encounters (invites, conversations,
story shares, gospel presentations); admins see community-wide analytics. **Live beta with real
users** — treat schema/RLS changes and deploys with caution.

> **RLS was overhauled on 2026-08-18 (migration 006).** Before it, both tables were readable by
> the `anon` role — i.e. by anyone with the public key from the JS bundle. Now:
> reads and writes require authentication, entries and people are scoped to owner-or-admin,
> admin comes from `people.role` only (never `user_metadata`, which users can write), and a
> trigger blocks non-admins from changing any role. Helper functions are `gst_is_admin()` and
> `gst_current_person_ids()` — the latter matches on **id or email**, which is load-bearing:
> CSV-imported people keep a random `people.id` until first login re-keys it, so an id-only
> check would lock them out of their own history.
>
> `is_admin(uuid)` also exists and backs policies on the legacy, app-unreferenced `profiles` and
> `user_roles` tables. Don't confuse the two.

## Stack
- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Database:** Supabase (PostgreSQL) + Supabase Auth, project ref `xomgejazpgwvadmglwtd`
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix primitives) + `components.json`
- **Charts:** Recharts
- **Deployment:** Vercel project `gospel-share-tracker-3dtj`, production at `https://gst.reimagechurch.com`
  (note the `-3dtj` suffix — a plain `vercel link` search creates/matches a *different*, empty
  project literally named `gospel-share-tracker`; always link with
  `vercel link --project gospel-share-tracker-3dtj`)

## Required env vars (`.env.local`, never commit)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # server-only, bypasses RLS — never expose client-side
                            # not currently set in Vercel; createAdminClient() in
                            # lib/supabaseClient.ts is defined but unused, so this isn't blocking
```
Pull with `vercel env pull .env.local` (after `vercel link --project gospel-share-tracker-3dtj`),
or get values from the Supabase dashboard: Project Settings → API
(https://supabase.com/dashboard/project/xomgejazpgwvadmglwtd/settings/api).

Vercel also injects `ESEND_API_KEY` into this project's env — unreferenced anywhere in the current
codebase, likely leftover from an unbuilt email feature. Harmless to ignore.

## Data model
- **`people`** — `id` (matches `auth.users.id`), `email`, `full_name`, `role` (`admin`/`user`), `created_at`
- **`gospel_share_entries`** — `person_id` FK, `entry_date`, `number_reached`, four boolean share-type
  flags (`church_invite`, `spiritual_conversation`, `story_share`, `gospel_presentation`),
  `gospel_response`, `number_response`, `notes`, `created_at`

## Known technical debt (see `REVIEW.md` for the current audit; `CODE_REVIEW.md` is the older pass)
- `user_id` on `gospel_share_entries` is a dead legacy column — all 675 rows are NULL and no code
  writes it. Policies key off `person_id`. Safe to drop once confirmed.
- The live schema still has five columns in no migration and no type: `invites_reached`,
  `conversations_reached`, `story_share_reached`, `gospel_share_reached`, `responses_count`.
- Every entry must record at least one share type — enforced on the add form, the edit dialog,
  both importers, and by a validated CHECK constraint (migrations 008/015).
- Imported rows carry `import_key`, a fingerprint of the row plus its occurrence in the file, so
  re-running an import skips rather than duplicates (migration 010). Entries created in the app
  have no key and are deliberately unconstrained — members do log identical same-day encounters.
- Notes from the February 2026 import were mojibake (UTF-8 read as Mac Roman); repaired in
  migrations 011/014. If notes ever look like `God‚Äôs`, that is the same fault recurring.

## Conventions
- Components: `components/` (app-specific) or `components/ui/` (shadcn primitives — don't hand-edit)
- Routes: `app/dashboard/*` (personal), `app/admin/*` (admin-only — people, portal, export, import)
- Supabase client: `lib/supabaseClient.ts` — `supabase` for client-side (RLS-respecting) reads,
  `createAdminClient()` for server-side RLS bypass only
- Shared types: `lib/types.ts`; date helpers: `lib/date.ts`
- Share entry fields (date, share types, number reached, gospel response, notes) live in
  `components/forms/ShareFormFields.tsx` — a controlled presentational component shared by
  `ShareForm.tsx` (add, owns its own state + Supabase insert) and `EditEntryFormContent.tsx`
  (edit, controlled by `EntryRecord.tsx`'s parent state). Add a field here, not in either consumer.

## Applying schema changes
This app is **live with real users** — schema and RLS changes go against a production database
with no separate staging environment set up yet. Before running any migration:
1. Confirm the target: Supabase dashboard → SQL Editor, project `xomgejazpgwvadmglwtd`.
2. Write idempotent SQL (`DROP ... IF EXISTS`, `CREATE TABLE IF NOT EXISTS`).
3. Add the migration file to `supabase/migrations/` — the single source of truth (a duplicate
   root-level `migrations/` folder existed until 2026-08-17; don't recreate it).
4. Confirm with Chris before running anything destructive or altering RLS policies.

# Gospel Share Tracker — Claude Code Context

Personal-evangelism tracking app. Users log gospel-sharing encounters (invites, conversations,
story shares, gospel presentations); admins see community-wide analytics. **Live beta with real
users** — treat schema/RLS changes and deploys with caution.

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

## Known technical debt (see `CODE_REVIEW.md` for original notes)
- **Two migration locations**: `supabase/migrations/` (001–004, the real history) and a stray
  root-level `migrations/` folder with one more-recent file
  (`2026-02-09-display-name-available.sql`) that was never consolidated in. Reconcile these before
  making further schema changes — don't add a third location.
- `EntryRecord.tsx` has an inline `EditEntryFormContent` component that duplicates edit-form logic
  — candidate for extraction, not yet done.
- Error handling is inconsistent — some flows use `alert()`, others inline error messages.
- Some `any` types remain in admin chart data.

## Conventions
- Components: `components/` (app-specific) or `components/ui/` (shadcn primitives — don't hand-edit)
- Routes: `app/dashboard/*` (personal), `app/admin/*` (admin-only — people, portal, export, import)
- Supabase client: `lib/supabaseClient.ts` — `supabase` for client-side (RLS-respecting) reads,
  `createAdminClient()` for server-side RLS bypass only
- Shared types: `lib/types.ts`; date helpers: `lib/date.ts`

## Applying schema changes
This app is **live with real users** — schema and RLS changes go against a production database
with no separate staging environment set up yet. Before running any migration:
1. Confirm the target: Supabase dashboard → SQL Editor, project `xomgejazpgwvadmglwtd`.
2. Write idempotent SQL (`DROP ... IF EXISTS`, `CREATE TABLE IF NOT EXISTS`).
3. Add the migration file to `supabase/migrations/` (not the stray root `migrations/` folder).
4. Confirm with Chris before running anything destructive or altering RLS policies.

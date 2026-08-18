# Gospel Share Tracker — Code Review

**Date:** 2026-08-17 · **Scope:** functionality, correctness, security, efficiency (design excluded)
**Reviewed:** 22 files / ~5,000 lines (`app/`, `components/`, `lib/`, `supabase/`), excluding
`components/ui/` shadcn primitives.

**Status:** migration `006_restrict_rls.sql` was applied to production on 2026-08-18 and verified,
including a **non-admin member session** — they see only their own person row and their own 14
entries, cannot read anyone else's, can create/edit/delete their own, and are blocked from
self-promoting (`Only admins can change a role`). That member's `people.id` does not match their
auth id, so they resolve through the email fallback: an id-only policy would have shown them
nothing. See the progress table below for what remains.

Findings marked **[verified]** were reproduced against the running app or live database.
Findings marked **[inferred]** are read from code and still need confirmation.

### Progress

| # | Finding | Status |
|---|---|---|
| 0 | **Editing any entry failed for everyone (HTTP 403)** | **Fixed** — 006 applied 2026-08-18, verified |
| 1 | Database readable by anyone | **Fixed** — anon reads now return empty |
| 1b | Any member could delete every entry in the system | **Fixed** |
| 2 | Any user could edit/delete any person | **Fixed** |
| 3 | Admin decided by user-writable metadata | **Fixed** — app and DB both use `people.role` |
| 4 | `?person=` exposes other dashboards | **Fixed at the data layer** — non-admins now get no rows; an app-layer check is still worth adding |
| 5 | Debug ids on Access Denied screen | **Fixed** — a fourth line (`isOwnProfile`) was missed on the first pass and removed 2026-08-18 |
| 6 | Entry dates one day early | **Fixed** |
| 7 | CSV export corrupt | **Fixed** |
| 8 | Second broken CSV exporter | **Fixed** |
| 9 | Dashboard totals/chart go stale | **Fixed** |
| 10 | Race creating duplicate person rows | **Fixed** |
| 11 | Errors discarded | **Fixed** — all pages; the 10 `alert()`s are gone |
| 12–14 | Schema drift, dual key, stale types | **Partial** — types now match the live table; the five extra columns turned out to be GENERATED (see below); `user_id` confirmed dead (0/674); baseline migration still to do |
| 15–18 | Efficiency | **Fixed** — #18 moved to Postgres (migration 007): admin payload 159KB → 40KB, whole-table download gone |
| P4 | Maintainability | **Partial** — all `any` types gone; portal still 700+ lines |

A related bug found while fixing #6: `ShareForm` defaulted its date from `toISOString()` (UTC), so
after ~8pm Eastern it pre-filled *tomorrow* and silently misdated evening entries. Also fixed.

### The five "undocumented" columns are GENERATED, not abandoned **[verified]**

`invites_reached`, `conversations_reached`, `story_share_reached`, `gospel_share_reached` and
`responses_count` are `GENERATED ALWAYS` columns — Postgres derives each from the raw fields
(e.g. `gospel_share_reached = CASE WHEN gospel_presentation THEN number_reached ELSE 0 END`).
They cannot be written and cannot drift. They appear in no migration, which is why they looked
like orphans.

I initially recorded them as unused and then as inconsistent; both were wrong. The apparent
"gospel 2870 vs 2868" gap came from misreading a number off a screenshot rather than querying —
SQL confirms stored and computed are both 2870, with zero mismatched rows.

`user_id` is separately confirmed dead: 0 of 674 rows populated.

Practical consequence: the admin dashboard recomputes these figures in the browser from raw
rows. Selecting the generated columns instead pushes that work to the database and is the
natural first step for #18.

### Finding #0 — entry editing is broken in production **[verified]**

Reading the live `pg_policies` (rather than the migration files) turned up three things the files
do not show. The live `gospel_share_entries` table carries **11** policies, not the 4 in `002`:

- `Allow authenticated inserts…` (`WITH CHECK true`) and `Allow authenticated deletes…`
  (`USING true`) let **any authenticated member delete every entry in the database**.
- Every policy keyed on `auth.uid() = user_id` is dead — **all 675 entries have
  `user_id IS NULL`**, because the app only ever writes `person_id`.
- So the only UPDATE policy left standing is `Admins can manage all shares`, which runs
  `SELECT 1 FROM auth.users` — a table the `authenticated` role cannot read.

The result, reproduced against production: **every attempt to edit an entry fails** with
`42501: permission denied for table users`. Insert and delete only work because of the two
`true` catch-alls. Migration 006 fixes this as a side effect of keying policies on `person_id`.

---

## P0 — Security (live, affects real user data)

### 1. The entire database is readable by anyone on the internet **[verified]**
`supabase/migrations/001…sql:22`, `002…sql:22`

Both tables carry `USING (true)` SELECT policies with no role restriction, so the `anon` role can
read them. The Supabase anon key ships in the public JS bundle (confirmed present in
`/_next/static/chunks/6efbd2a8de6346b2.js` on production), so the key is not a secret and cannot be
one.

Confirmed with no user session, anon key only:

| Exposed | Count |
|---|---|
| `people` rows (name + email) | **131** |
| `gospel_share_entries` rows | **674** |
| entries with personal `notes` | **330** |

The notes are members' accounts of spiritual conversations involving named third parties — the most
sensitive data in the app. **Fix drafted in `006_restrict_rls.sql`, awaiting approval.**

### 2. Any logged-in user can edit or delete any person, and make themselves admin **[inferred]**
`001_create_people_table.sql:29`

`FOR ALL USING (auth.role() = 'authenticated')` grants every authenticated user write access to
every row in `people` — including setting their own `role` to `admin`, or deleting members.
Not tested against production, because proving it would mean mutating real data.

### 3. Admin status is decided by user-writable data **[inferred]**
`app/admin/layout.tsx:57`, `app/dashboard/page.tsx:173`, `002…sql:44`

Both the app and the database admin policy trust `user_metadata.role` / `raw_user_meta_data->>'role'`.
Users can write their own metadata via `supabase.auth.updateUser()`, so this is an escalation path
at the database level, not merely a UI gate. Admin should derive from `people.role` only.

### 4. Any user can view any other user's dashboard **[inferred]**
`app/dashboard/page.tsx:109-130`

`?person=<uuid>` is read straight from the URL and used as the query key with no authorization
check — exposing another member's totals, chart, and recent entries including notes. Migration 006
neutralizes this at the data layer, but the app-layer check should exist too (defense in depth).

### 5. Debug identifiers rendered on the Access Denied screen **[inferred]**
`app/admin/layout.tsx:89-92`

Renders `userId`, `profileId`, and `isAdmin` to the blocked user. Should be removed.

---

## P1 — Correctness bugs (user-visible, in production now)

### 6. Every entry displays one day earlier than it is **[verified]**
`components/EntryRecord.tsx:115`, `:263`, `app/admin/people/[id]/page.tsx:364`

`new Date("2026-08-18")` parses as **UTC** midnight; `.toLocaleDateString()` then renders it in
local time. In Eastern time that is 8pm on the 17th:

```
stored entry_date      : 2026-08-18
new Date(d).toLocale.. : Aug 17     ← what users see
correct (local parse)  : Aug 18
```

Seen live during this session: the same entry rendered as **"Aug 17"** on its card while the chart
axis (which uses the raw string) read **"2026-08-18"**. Every logged share is currently shown on
the wrong day to every user in the US.

Note `lib/date.ts` is *correct* — it deliberately avoids `toISOString()`. Only the display sites are wrong.

### 7. CSV export produces structurally corrupt files **[verified]**
`app/admin/export/page.tsx:37`

Values are quote-*escaped* (`"` → `""`) but never quote-*wrapped*, so any value containing a comma
splits into extra columns and any newline splits the row. Measured against live data:

| Notes containing | Count | Effect |
|---|---|---|
| comma | **160** | row splits into wrong columns |
| newline | **33** | row breaks into multiple rows |
| double-quote | 1 | escaping actively corrupts, since nothing wraps it |

**~29% of the 674 entries export incorrectly.** If exports have been used for reporting, past
exports were wrong.

### 8. A second, differently-broken CSV exporter **[verified]**
`app/admin/portal/page.tsx:278-286`

Independent implementation with the inverse bug: it wraps on comma but never escapes embedded
quotes, and also ignores newlines. Two exporters, two bugs, neither correct — they should be one
tested helper.

### 9. Dashboard totals and chart go stale after any edit **[verified]**
`app/dashboard/page.tsx:226-235`

`refreshEntries()` re-queries only the 3 recent entries, not `allEntries`, which feeds every summary
card and the chart. Observed live: after deleting the only entry, Recent Shares correctly showed
"No entries yet" while the chart still plotted the deleted entry. Numbers stay wrong until a full
reload.

### 10. Two components race to create the same person row **[inferred]**
`components/Header.tsx:66-79` vs `app/dashboard/page.tsx:86-97`

On the dashboard both `Header.init()` and `DashboardContent.load()` run concurrently, and both do
find-by-id → find-by-email → **insert**. For a user with no `people` row, both can insert, and the
loser violates the case-insensitive email constraint. Neither checks the insert's error (see #11),
so the failure is silent.

### 11. 22 Supabase calls discard their error **[verified]**
Pattern `const { data: x } = await supabase…` appears **22 times** — the `error` field is never
destructured, so failed queries are indistinguishable from empty results. This is why an RLS
change could silently blank the app rather than showing an error, and it is the single biggest
obstacle to safely applying migration 006.

Related: 10 `alert()` calls remain (`portal` ×8, `people/[id]` ×1, `EntryRecord` ×1).

---

## P2 — Schema and data integrity

### 12. Migrations do not reproduce the live database **[verified]**
`people.role` — which the entire admin system depends on — appears in **no migration file**. The
live `gospel_share_entries` table also has five columns present in no migration and no TypeScript
type:

`invites_reached`, `conversations_reached`, `story_share_reached`, `gospel_share_reached`, `responses_count`

A fresh environment built from `supabase/migrations/` would be broken. These need reconciling
before any further schema work, and it should be established whether those five columns hold real
data or are abandoned.

### 13. Legacy `user_id` / `person_id` dual key **[verified]**
The app writes **only** `person_id`; `user_id` is never populated by any code path. Yet the old RLS
policies gated writes on `auth.uid() = user_id`, and `app/admin/page.tsx:130,154` still carries
`e.user_id || e.person_id || "anonymous"` fallbacks that distort the unique-user count. Pick one
key, backfill, drop the other.

### 14. `lib/types.ts` no longer matches the table **[verified]**
`Entry` omits `user_id` and the five columns above, while 14 call sites use `select("*")` — so
runtime objects carry fields the types deny.

---

## P3 — Efficiency

### 15. The admin dashboard fetches every entry twice per load **[verified]**
`app/admin/page.tsx:198`

The aggregation effect lists `nameMap` in its dependency array, and `nameMap` is populated by a
second effect — so the full unbounded entry fetch runs once, then again when names arrive.

### 16. Unbounded queries with a silent 1,000-row ceiling **[inferred]**
14 `select("*")` calls have no `.limit()` (`export:17`, `portal:196,255,262`, `people/[id]` ×6,
`dashboard` ×3, `people:63`). PostgREST caps results (`supabase/config.toml` sets `max_rows = 1000`).
At 674 entries this is invisible; crossing 1,000 will **silently truncate** exports and skew every
admin total with no error. This is a deadline, not a preference.

### 17. Identity resolution is implemented four times and runs twice per page **[verified]**
The find-by-id → fall-back-to-email → create-if-missing block is duplicated in
`app/admin/layout.tsx:37-62`, `app/dashboard/page.tsx:65-104`, `components/Header.tsx:46-79`, and
`app/login/page.tsx:154-163`. Because `Header` renders on every page alongside the page's own copy,
each navigation resolves identity twice — 2-6 sequential round trips before anything renders.
One `useCurrentPerson()` hook would fix the duplication, the waterfall, and race #10 together.

### 18. Aggregation happens in the browser
`app/admin/page.tsx:138-176` pulls every entry and reduces it client-side. Correct today; a
Postgres view or RPC returning pre-aggregated rows removes both the transfer and the 1,000-row cliff.

---

## P4 — Maintainability

- **`app/admin/portal/page.tsx` is 748 lines** and holds people management, export, and import.
  It contains 8 of the 10 `alert()`s and 4 of the 5 `any`s. Prime split candidate.
- **Dead code:** `isAdmin` in `dashboard/page.tsx` is set (via an extra query at :167-171) but never
  read — the query can go entirely; `currentPersonId` and `loggedInPersonId` are set, never read;
  `refreshEntries` in `EntryRecord.tsx:100` is unused (already an ESLint warning).
- **`any` types:** `portal:252,296,381,666`, `import:197`.
- **`formatName` is redefined** in `dashboard/page.tsx:219` despite `formatDisplayName` existing in
  `lib/types.ts:81`.
- **Missing effect dependency:** `dashboard/page.tsx:180` omits `searchParams`, so `?person=` changes
  may not refetch.

---

## What's already good

Worth preserving: `lib/date.ts` correctly avoids the `toISOString()` timezone trap; RLS is enabled
on both tables (the policies are wrong, but the mechanism is on); pagination exists on all admin
tables; the recent `ShareFormFields` extraction removed the add/edit duplication; and
`display_name_available` is properly `SECURITY DEFINER`.

---

## Suggested order

1. **Apply 006** (after reconciling live policy names) — closes #1–#4. Highest stakes, and #11 makes
   it risky, so verify the five flows listed in the migration's header immediately after.
2. **#6 date display and #7/#8 CSV** — small, self-contained, high user impact, no schema risk.
3. **#11 error handling**, then **#9 stale dashboard** and **#10 race** via the `useCurrentPerson()`
   hook from #17.
4. **#12/#13 schema reconciliation** — needed before the 1,000-row ceiling in #16 arrives.
5. **P4 cleanup** last.

Items 2 and 3 are independent of the database and can proceed while migration 006 is still under review.

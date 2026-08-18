# CSV import templates

Two headers-only files to fill in. Import from **Admin Portal → Import Data**, or `/admin/import`.

## entries-template.csv

| Column | Required | Notes |
|---|---|---|
| `email` | yes | Identifies the person. Matched case-insensitively; an unknown address creates a new person record. |
| `full_name` | no | Only used when the address is new. Existing people keep the name already on file. Omit it and a new person is named from the part before the `@`. |
| `entry_date` | yes | `YYYY-MM-DD`, or `M/D/YYYY` / `M/D/YY` as spreadsheets export. **Slash dates are read month-first**, so `9/5/25` is 5 September 2025. Two-digit years pivot at 70. |
| `number_reached` | yes | Whole number. |
| `church_invite` | see below | `true`/`false`, any case |
| `spiritual_conversation` | see below | `true`/`false`, any case |
| `story_share` | see below | `true`/`false`, any case |
| `gospel_presentation` | see below | `true`/`false`, any case |
| `gospel_response` | no | `true`/`false`, any case; defaults to false |
| `number_response` | no | Whole number; only counted when `gospel_response` is true |
| `notes` | no | Free text. Commas, quotes and line breaks are fine — quote the field. |

**At least one of the four share types must be `true`**, or the row is rejected with its row
number. This is enforced by the database, not just the form.

Booleans accept `true`, `TRUE`, `True`, `t`, `yes`, `y`, `1` or `x`. Anything else, including
blank, counts as false.

## people-template.csv

| Column | Required | Notes |
|---|---|---|
| `email` | yes | Existing address updates that person's name; a new one creates a record. |
| `full_name` | yes | |

Use this only to load or rename people without entries — the entries file creates people on
its own.

## Worth knowing

- **Re-running a file is safe.** Each imported row is fingerprinted, so a second run of the
  same file reports "already imported, skipped" instead of duplicating. Rows that repeat
  identically *within* one file are still all imported — they are numbered, so two identical
  encounters on the same day both land.
- **This only covers imports made after 2026-08-18.** Rows loaded before that carry no
  fingerprint, so a file of older data can still duplicate what is already there. Check for
  overlap when loading historical files.
- **This creates records, not logins.** Imported people cannot sign in until they register
  themselves with the same address, at which point their imported history is adopted
  automatically.
- **A failed row does not stop the import.** Each is reported with its row number, and
  `/admin/import` offers the failures back as a CSV to correct and re-run.

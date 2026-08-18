# CSV import templates

Two headers-only files to fill in. Import from **Admin Portal → Import Data**, or `/admin/import`.

## entries-template.csv

| Column | Required | Notes |
|---|---|---|
| `email` | yes | Identifies the person. Matched case-insensitively; an unknown address creates a new person record. |
| `full_name` | no | Only used when the address is new. Existing people keep the name already on file. Omit it and a new person is named from the part before the `@`. |
| `entry_date` | yes | `YYYY-MM-DD`. |
| `number_reached` | yes | Whole number. |
| `church_invite` | see below | `true` or `false` |
| `spiritual_conversation` | see below | `true` or `false` |
| `story_share` | see below | `true` or `false` |
| `gospel_presentation` | see below | `true` or `false` |
| `gospel_response` | no | `true` or `false`; defaults to false |
| `number_response` | no | Whole number; only counted when `gospel_response` is true |
| `notes` | no | Free text. Commas, quotes and line breaks are fine — quote the field. |

**At least one of the four share types must be `true`**, or the row is rejected with its row
number. This is enforced by the database, not just the form.

Booleans must be the literal lowercase string `true`. Anything else — `TRUE`, `1`, `yes`,
blank — counts as false.

## people-template.csv

| Column | Required | Notes |
|---|---|---|
| `email` | yes | Existing address updates that person's name; a new one creates a record. |
| `full_name` | yes | |

Use this only to load or rename people without entries — the entries file creates people on
its own.

## Worth knowing

- **Imports are not idempotent.** Running the same file twice inserts everything twice; there
  is no constraint preventing it. Check for overlap with what is already loaded.
- **This creates records, not logins.** Imported people cannot sign in until they register
  themselves with the same address, at which point their imported history is adopted
  automatically.
- **A failed row does not stop the import.** Each is reported with its row number, and
  `/admin/import` offers the failures back as a CSV to correct and re-run.

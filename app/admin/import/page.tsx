"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { parseCSVToObjects, toCSV, downloadCSV, parseCsvBoolean } from "@/lib/csv";
import { errorMessage, reportError, isUniqueViolation } from "@/lib/errors";
import { importKey, canonicalRow, createOccurrenceCounter } from "@/lib/importKey";
import { normalizeEmail } from "@/lib/email";
import { findOrCreatePersonByEmail } from "@/lib/people";
import { toYMD, parseFlexibleDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Upload, FileSpreadsheet, Loader2 } from "lucide-react";

type CSVRow = {
  [key: string]: string;
};

type ImportPreview = {
  headers: string[];
  rows: CSVRow[];
  totalRows: number;
};

type ImportResult = {
  success: boolean;
  imported: number;
  /** People created because an entry referenced an email with no existing record. */
  createdPeople?: number;
  /** Rows already present from a previous run of the same file. */
  skipped?: number;
  errors: string[];
  failedRows: CSVRow[];
};

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"people" | "entries">("people");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Parse CSV file (preview shows the first 10 rows; totalRows counts them all)
  const parseCSV = useCallback(async (f: File): Promise<ImportPreview> => {
    const all = parseCSVToObjects(await f.text());
    const headers = all.length > 0 ? Object.keys(all[0]) : [];
    return { headers, rows: all.slice(0, 10), totalRows: all.length };
  }, []);

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      const parsed = await parseCSV(f);
      setPreview(parsed);
    }
  };

  // Validate row
  const validatePersonRow = (row: CSVRow): string | null => {
    if (!row.email) return "Missing email";
    if (!row.full_name) return "Missing full_name";
    return null;
  };

  const validateEntryRow = (row: CSVRow): string | null => {
    // Email is how an entry finds its person; without it the lookup ran with undefined and
    // failed later as a misleading "Person not found".
    if (!row.email) return "Missing email";
    if (!row.entry_date) return "Missing entry_date";
    if (!parseFlexibleDate(row.entry_date))
      return `entry_date "${row.entry_date}" is not a date the importer recognises (use YYYY-MM-DD or M/D/YYYY)`;
    if (!row.number_reached) return "Missing number_reached";
    // At least one share type, matching the add and edit forms.
    if (
      !parseCsvBoolean(row.church_invite) &&
      !parseCsvBoolean(row.spiritual_conversation) &&
      !parseCsvBoolean(row.story_share) &&
      !parseCsvBoolean(row.gospel_presentation)
    ) {
      return "Needs at least one share type set to true (church_invite, spiritual_conversation, story_share or gospel_presentation)";
    }
    return null;
  };

  // Import people
  const importPeople = async (rows: CSVRow[]): Promise<ImportResult> => {
    const errors: string[] = [];
    const failedRows: CSVRow[] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const error = validatePersonRow(row);
      
      if (error) {
        errors.push(`Row ${i + 1}: ${error}`);
        failedRows.push(row);
        continue;
      }

      const { error: insertError } = await supabase.from("people").upsert(
        {
          // Normalised: the upsert conflict target is the exact-case UNIQUE(email) index, so
          // an unnormalised "Bob@x.com" would miss an existing "bob@x.com", attempt an
          // insert, and then be rejected by the case-insensitive EXCLUDE constraint.
          email: normalizeEmail(row.email),
          full_name: row.full_name,
        },
        { onConflict: "email" }
      );

      if (insertError) {
        errors.push(`Row ${i + 1}: ${insertError.message}`);
        failedRows.push(row);
      } else {
        imported++;
      }
    }

    return { success: errors.length === 0, imported, errors, failedRows };
  };

  // Import entries
  const importEntries = async (rows: CSVRow[]): Promise<ImportResult> => {
    const errors: string[] = [];
    const failedRows: CSVRow[] = [];
    let imported = 0;
    let createdPeople = 0;
    let skipped = 0;
    const occurrenceOf = createOccurrenceCounter();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const error = validateEntryRow(row);
      
      if (error) {
        errors.push(`Row ${i + 1}: ${error}`);
        failedRows.push(row);
        continue;
      }

      // Attach to the existing person, or create one. Previously an unknown email failed the
      // row, so entries could only be loaded after a separate people import.
      const person = await findOrCreatePersonByEmail(row.email, row.full_name);

      if (person.error || !person.id) {
        errors.push(
          `Row ${i + 1}: could not resolve "${row.email}"` +
            (person.error ? ` — ${person.error.message}` : "")
        );
        failedRows.push(row);
        continue;
      }
      if (person.created) createdPeople++;

      const fields = {
        email: row.email,
        entryDate: parseFlexibleDate(row.entry_date) ?? "",
        numberReached: parseInt(row.number_reached) || 0,
        churchInvite: parseCsvBoolean(row.church_invite),
        spiritualConversation: parseCsvBoolean(row.spiritual_conversation),
        storyShare: parseCsvBoolean(row.story_share),
        gospelPresentation: parseCsvBoolean(row.gospel_presentation),
        gospelResponse: parseCsvBoolean(row.gospel_response),
        numberResponse: parseInt(row.number_response) || 0,
        notes: row.notes || "",
      };

      const entry = {
        person_id: person.id,
        entry_date: fields.entryDate,
        number_reached: fields.numberReached,
        church_invite: fields.churchInvite,
        spiritual_conversation: fields.spiritualConversation,
        story_share: fields.storyShare,
        gospel_presentation: fields.gospelPresentation,
        gospel_response: fields.gospelResponse,
        number_response: fields.numberResponse,
        notes: fields.notes,
        import_key: await importKey(fields, occurrenceOf(canonicalRow(fields))),
      };

      const { error: insertError } = await supabase.from("gospel_share_entries").insert(entry);

      if (insertError) {
        // Same file, already loaded: the unique index on import_key rejects the repeat.
        if (isUniqueViolation(insertError)) {
          skipped++;
        } else {
          errors.push(`Row ${i + 1}: ${insertError.message}`);
          failedRows.push(row);
        }
      } else {
        imported++;
      }
    }

    return { success: errors.length === 0, imported, createdPeople, skipped, errors, failedRows };
  };

  // Handle import
  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const rows: CSVRow[] = parseCSVToObjects(await file.text());

      const importResult = importType === "people" 
        ? await importPeople(rows) 
        : await importEntries(rows);

      setResult(importResult);
    } catch (err) {
      reportError("import: parse or import", err);
      setResult({
        success: false,
        imported: 0,
        errors: [errorMessage(err)],
        failedRows: [],
      });
    }

    setImporting(false);
  };

  // Download failed rows
  const downloadFailedRows = () => {
    if (!result?.failedRows.length) return;

    // Uses the shared writer: this had its own quoting that wrapped on comma but never
    // escaped embedded quotes, so a failed row containing one produced a broken file.
    const headers = preview?.headers || [];
    downloadCSV(
      `failed_import_${toYMD(new Date())}.csv`,
      toCSV(result.failedRows, headers.length ? headers : undefined)
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Import Data</h2>

      {/* Import Type Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1. Select Import Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importType"
                value="people"
                checked={importType === "people"}
                onChange={() => setImportType("people")}
              />
              <span>Import People</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importType"
                value="entries"
                checked={importType === "entries"}
                onChange={() => setImportType("entries")}
              />
              <span>Import Entries</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>2. Upload CSV</CardTitle>
          <CardDescription>
            {importType === "people" 
              ? "CSV must have headers: email, full_name"
              : "CSV must have headers: email, entry_date, number_reached, and at least one of church_invite, spiritual_conversation, story_share or gospel_presentation set to true (plus optional: full_name, gospel_response, number_response, notes). An email with no existing record creates a new person — include full_name to name them, otherwise the part before the @ is used."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>3. Preview ({preview.totalRows} rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    {preview.headers.map((header) => (
                      <th key={header} className="border p-2 text-left bg-gray-50">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr key={index} className="border">
                      {preview.headers.map((header) => (
                        <td key={header} className="border p-2">
                          {row[header] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Button */}
      {preview && (
        <div className="mb-6">
          <Button onClick={handleImport} disabled={importing} className="flex items-center gap-2">
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Import {preview.totalRows} Rows
              </>
            )}
          </Button>
        </div>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              Import {result.success ? "Complete" : "Completed with Errors"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              <strong>{result.imported}</strong> rows imported successfully
              {result.skipped ? (
                <>
                  {" · "}
                  <strong>{result.skipped}</strong> already imported, skipped
                </>
              ) : null}
              {result.createdPeople ? (
                <>
                  {" · "}
                  <strong>{result.createdPeople}</strong> new{" "}
                  {result.createdPeople === 1 ? "person" : "people"} created
                </>
              ) : null}
              {result.errors.length > 0 && (
                <>; <strong>{result.errors.length}</strong> errors</>
              )}
            </p>

            {result.errors.length > 0 && (
              <div className="mb-4">
                <Button variant="outline" onClick={downloadFailedRows} className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Download Failed Rows
                </Button>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.slice(0, 20).map((error, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2 text-red-600">{error}</td>
                      </tr>
                    ))}
                    {result.errors.length > 20 && (
                      <tr>
                        <td className="p-2 text-gray-500">
                          ...and {result.errors.length - 20} more errors
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

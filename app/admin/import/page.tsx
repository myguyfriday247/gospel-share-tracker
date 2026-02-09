"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
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
  errors: string[];
  failedRows: CSVRow[];
};

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"people" | "entries">("people");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Parse CSV file
  const parseCSV = useCallback(async (f: File): Promise<ImportPreview> => {
    const text = await f.text();
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    
    const rows: CSVRow[] = [];
    for (let i = 1; i < Math.min(lines.length, 11); i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }

    return { headers, rows, totalRows: lines.length - 1 };
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
    if (!row.entry_date) return "Missing entry_date";
    if (!row.number_reached) return "Missing number_reached";
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
          email: row.email,
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

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const error = validateEntryRow(row);
      
      if (error) {
        errors.push(`Row ${i + 1}: ${error}`);
        failedRows.push(row);
        continue;
      }

      // Look up person_id by email (case-insensitive)
      const { data: people, error: lookupError } = await supabase
        .from("people")
        .select("id")
        .ilike("email", row.email)
        .single();

      if (lookupError || !people) {
        errors.push(`Row ${i + 1}: Person not found for email "${row.email}"`);
        failedRows.push(row);
        continue;
      }

      const entry = {
        person_id: people.id,
        entry_date: row.entry_date,
        number_reached: parseInt(row.number_reached) || 0,
        church_invite: row.church_invite === "true",
        spiritual_conversation: row.spiritual_conversation === "true",
        story_share: row.story_share === "true",
        gospel_presentation: row.gospel_presentation === "true",
        gospel_response: row.gospel_response === "true",
        number_response: parseInt(row.number_response) || 0,
        notes: row.notes || "",
      };

      const { error: insertError } = await supabase.from("gospel_share_entries").insert(entry);

      if (insertError) {
        errors.push(`Row ${i + 1}: ${insertError.message}`);
        failedRows.push(row);
      } else {
        imported++;
      }
    }

    return { success: errors.length === 0, imported, errors, failedRows };
  };

  // Handle import
  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const rows: CSVRow[] = [];
      
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: CSVRow = {};
        if (preview && preview.headers) {
          preview.headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });
        }
        rows.push(row);
      }

      const importResult = importType === "people" 
        ? await importPeople(rows) 
        : await importEntries(rows);

      setResult(importResult);
    } catch (error: any) {
      setResult({
        success: false,
        imported: 0,
        errors: [error.message],
        failedRows: [],
      });
    }

    setImporting(false);
  };

  // Download failed rows
  const downloadFailedRows = () => {
    if (!result?.failedRows.length) return;

    const headers = preview?.headers || [];
    const csvContent = [
      headers.join(","),
      ...result.failedRows.map((row) =>
        headers.map((h) => {
          const value = row[h] || "";
          return value.includes(",") ? `"${value}"` : value;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `failed_import_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
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
              : "CSV must have headers: email, entry_date, number_reached (plus optional: church_invite, spiritual_conversation, story_share, gospel_presentation, gospel_response, number_response, notes)"}
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

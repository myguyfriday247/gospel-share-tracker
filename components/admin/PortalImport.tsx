// ==========================================
// PORTAL / IMPORT - CSV import of people and entries
// ==========================================
//
// Split out of app/admin/portal/page.tsx. Per-row results are counted rather than assumed;
// see handleImport.

"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { errorMessage, reportError, isUniqueViolation } from "@/lib/errors";
import { importKey, canonicalRow, createOccurrenceCounter } from "@/lib/importKey";
import { normalizeEmail } from "@/lib/email";
import { findOrCreatePersonByEmail } from "@/lib/people";
import { parseCSVToObjects, parseCsvBoolean } from "@/lib/csv";
import { parseFlexibleDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";

interface PortalImportProps {
  /** Lets the people list refresh after rows are imported. */
  onImported?: () => void;
}

export function PortalImport({ onImported }: PortalImportProps) {
  const [importLoading, setImportLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, string>[]>([]);
  const [importType, setImportType] = useState<"people" | "entries">("entries");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The outcome renders above the form, so after clicking Import at the bottom it can be
  // scrolled out of view. Bring it back into sight.
  const outcomeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice || error) outcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [notice, error]);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = parseCSVToObjects(event.target?.result as string);
      if (rows.length === 0) {
        setError("That file has no readable rows. Expected a CSV with a header row.");
        setImportPreview([]);
        return;
      }
      setError(null);
      setImportPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importFile) {
      setError("Choose a file first.");
      return;
    }

    setImportLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = parseCSVToObjects(await importFile.text());
      
      // Every row's result is checked. This previously ignored each row's error and then
      // reported `Successfully imported ${data.length} records` unconditionally — so an
      // import where every row failed still claimed success.
      let imported = 0;
      let createdPeople = 0;
      let skipped = 0;
      const occurrenceOf = createOccurrenceCounter();
      const failures: string[] = [];

      if (importType === "people") {
        for (const [i, row] of data.entries()) {
          if (!row.email) {
            failures.push(`Row ${i + 2}: missing email`);
            continue;
          }
          const { error: upsertError } = await supabase.from("people").upsert({
            email: normalizeEmail(row.email),
            full_name: row.full_name || row.name || "",
          }, { onConflict: "email" });

          if (upsertError) {
            reportError("portal: import person", upsertError);
            failures.push(`Row ${i + 2} (${row.email}): ${upsertError.message}`);
          } else {
            imported++;
          }
        }
      } else if (importType === "entries") {
        for (const [i, row] of data.entries()) {
          if (!row.email) {
            failures.push(`Row ${i + 2}: missing email`);
            continue;
          }
          // Attach to the existing person, or create one — so a single entries file can
          // cover both people already on file and people who are not yet.
          const person = await findOrCreatePersonByEmail(row.email, row.full_name);

          if (person.error || !person.id) {
            if (person.error) reportError("portal: resolve person", person.error);
            failures.push(
              `Row ${i + 2}: could not resolve ${row.email}` +
                (person.error ? ` — ${person.error.message}` : "")
            );
            continue;
          }
          if (person.created) createdPeople++;

          // At least one share type, matching the add and edit forms.
          if (
            !parseCsvBoolean(row.church_invite) &&
            !parseCsvBoolean(row.spiritual_conversation) &&
            !parseCsvBoolean(row.story_share) &&
            !parseCsvBoolean(row.gospel_presentation)
          ) {
            failures.push(`Row ${i + 2} (${row.email}): needs at least one share type`);
            continue;
          }

          const entryDate = parseFlexibleDate(row.entry_date ?? "");
          if (!entryDate) {
            failures.push(`Row ${i + 2} (${row.email}): entry_date "${row.entry_date}" is not a recognised date`);
            continue;
          }

          const fields = {
            email: row.email,
            entryDate,
            numberReached: parseInt(row.number_reached) || 0,
            churchInvite: parseCsvBoolean(row.church_invite),
            spiritualConversation: parseCsvBoolean(row.spiritual_conversation),
            storyShare: parseCsvBoolean(row.story_share),
            gospelPresentation: parseCsvBoolean(row.gospel_presentation),
            gospelResponse: parseCsvBoolean(row.gospel_response),
            numberResponse: parseInt(row.number_response) || 0,
            notes: row.notes || "",
          };

          const { error: insertError } = await supabase.from("gospel_share_entries").insert({
            person_id: person.id,
            entry_date: fields.entryDate,
            number_reached: fields.numberReached,
            church_invite: fields.churchInvite,
            spiritual_conversation: fields.spiritualConversation,
            story_share: fields.storyShare,
            gospel_presentation: fields.gospelPresentation,
            gospel_response: fields.gospelResponse,
            number_response: fields.numberResponse,
            notes: row.notes || null,
            import_key: await importKey(fields, occurrenceOf(canonicalRow(fields))),
          });

          if (insertError) {
            // Same file, already loaded: the unique index on import_key rejects the repeat.
            if (isUniqueViolation(insertError)) {
              skipped++;
            } else {
              reportError("portal: import entry", insertError);
              failures.push(`Row ${i + 2} (${row.email}): ${insertError.message}`);
            }
          } else {
            imported++;
          }
        }
      }

      setNotice(
        `Imported ${imported} of ${data.length} rows.` +
          (skipped > 0 ? ` Skipped ${skipped} already imported.` : "") +
          (createdPeople > 0 ? ` Created ${createdPeople} new ${createdPeople === 1 ? "person" : "people"}.` : "")
      );
      if (failures.length > 0) {
        setError(
          `${failures.length} row(s) failed:\n` +
          failures.slice(0, 10).join("\n") +
          (failures.length > 10 ? `\n…and ${failures.length - 10} more.` : "")
        );
      }
      setImportFile(null);
      setImportPreview([]);
      onImported?.();
    } catch (err) {
      reportError("portal: import", err);
      setError(errorMessage(err));
    }
    setImportLoading(false);
  };

  return (
    <div className="space-y-4">
      <div ref={outcomeRef} />
      {notice && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {notice}
        </div>
      )}
      <ErrorBanner message={error} title="Import didn&apos;t complete." />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Import Type</Label>
              <Select value={importType} onValueChange={(v: "people" | "entries") => setImportType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entries">Entries (CSV with email column)</SelectItem>
                  <SelectItem value="people">People (CSV with email and full_name)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Select CSV File</Label>
              <Input type="file" accept=".csv" onChange={handleImportFile} />
            </div>
            
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview (first 5 rows)</Label>
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(importPreview[0]).map(h => (
                          <th key={h} className="px-3 py-2 font-medium text-gray-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, i) => (
                        <tr key={i} className="border-t">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-3 py-2">{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <Button onClick={handleImport} disabled={importLoading || !importFile} className="flex items-center gap-2">
              {importLoading ? "Importing..." : <><Upload className="h-4 w-4" /> Import Data</>}
            </Button>
          </CardContent>
        </Card>
    </div>
  );
}

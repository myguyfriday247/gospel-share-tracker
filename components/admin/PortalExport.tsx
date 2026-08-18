// ==========================================
// PORTAL / EXPORT - CSV export of people and entries
// ==========================================
//
// Split out of app/admin/portal/page.tsx, which had grown to ~790 lines covering three
// unrelated jobs. Each section owns its own state and surfaces its own failures, so nothing
// is threaded through the parent.

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { errorMessage, reportError } from "@/lib/errors";
import { toCSV, downloadCSV } from "@/lib/csv";
import { fetchAllRows } from "@/lib/fetchAll";
import { toYMD } from "@/lib/date";
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
import { Download } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";

export function PortalExport() {
  const [exportLoading, setExportLoading] = useState(false);
  const [exportType, setExportType] = useState<"people" | "entries" | "all">("all");
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ==================== EXPORT FUNCTIONS ====================
  const handleExport = async () => {
    setExportLoading(true);
    setError(null);
    setNotice(null);
    try {
      let data: Record<string, unknown>[] = [];

      // Both reads are paginated — a bare select() stops at PostgREST's max-rows and would
      // silently write a partial export once a table outgrows it.
      if (exportType === "people" || exportType === "all") {
        const { data: peopleData, error: peopleError, truncated } =
          await fetchAllRows<Record<string, unknown>>((from, to) =>
            supabase.from("people").select("*", { count: "exact" })
              .order("created_at", { ascending: false }).range(from, to));
        if (peopleError) throw peopleError;
        if (truncated) throw new Error("Could not read all people; export stopped rather than writing a partial file.");
        data = exportType === "all"
          ? [...data, ...peopleData.map(p => ({ ...p, _table: "people" }))]
          : peopleData;
      }

      if (exportType === "entries" || exportType === "all") {
        const { data: entriesData, error: entriesError, truncated } =
          await fetchAllRows<Record<string, unknown>>((from, to) => {
            let q = supabase.from("gospel_share_entries").select("*", { count: "exact" })
              .order("entry_date", { ascending: false });
            if (exportDateFrom) q = q.gte("entry_date", exportDateFrom);
            if (exportDateTo) q = q.lte("entry_date", exportDateTo);
            return q.range(from, to);
          });
        if (entriesError) throw entriesError;
        if (truncated) throw new Error("Could not read all entries; export stopped rather than writing a partial file.");
        data = exportType === "all"
          ? [...data, ...entriesData.map(e => ({ ...e, _table: "entries" }))]
          : entriesData;
      }

      if (data.length === 0) {
        setNotice("No data to export for this selection.");
        setExportLoading(false);
        return;
      }

      // Union across all rows: an "all" export mixes people and entries, which have
      // different columns. Reading headers off data[0] alone dropped the other table's fields.
      const headers = [...new Set(data.flatMap((r) => Object.keys(r)))].filter(k => k !== "_table");
      downloadCSV(
        `gospel-share-${exportType}-${toYMD(new Date())}.csv`,
        toCSV(data, headers)
      );
      setNotice(`Exported ${data.length} rows.`);
    } catch (err) {
      reportError("portal: export", err);
      setError(errorMessage(err));
    }
    setExportLoading(false);
  };


  return (
    <div className="space-y-4">
      {notice && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {notice}
        </div>
      )}
      <ErrorBanner message={error} title="Export didn&apos;t complete." />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" /> Export Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Export Type</Label>
                <Select value={exportType} onValueChange={(v: "people" | "entries" | "all") => setExportType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Data</SelectItem>
                    <SelectItem value="people">People Only</SelectItem>
                    <SelectItem value="entries">Entries Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Date From</Label>
                <Input type="date" value={exportDateFrom} onChange={(e) => setExportDateFrom(e.target.value)} />
              </div>
              
              <div className="space-y-2">
                <Label>Date To</Label>
                <Input type="date" value={exportDateTo} onChange={(e) => setExportDateTo(e.target.value)} />
              </div>
            </div>
            
            <Button onClick={handleExport} disabled={exportLoading} className="flex items-center gap-2">
              {exportLoading ? "Exporting..." : <><Download className="h-4 w-4" /> Export to CSV</>}
            </Button>
          </CardContent>
        </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminExportPage() {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const exportToCSV = async (tableName: string, filename: string) => {
    setExporting(true);
    setMessage("");

    try {
      const { data, error } = await supabase.from(tableName).select("*");

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessage(`No data found in ${tableName}`);
        setExporting(false);
        return;
      }

      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header];
              if (value === null) return "";
              if (typeof value === "object") return JSON.stringify(value);
              return String(value).replace(/"/g, '""');
            })
            .join(",")
        ),
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();

      setMessage(`Exported ${data.length} rows to ${filename}.csv`);
    } catch (error) {
      console.error("Export error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(`Error exporting: ${errorMessage}`);
    }

    setExporting(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Export Data</h2>

      <div className="grid gap-6 md:grid-cols-2">
        {/* People Export */}
        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Export all people records including names, emails, and creation
              dates.
            </p>
            <Button
              onClick={() => exportToCSV("people", "people")}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export People CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* Entries Export */}
        <Card>
          <CardHeader>
            <CardTitle>Gospel Share Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Export all gospel share entries with person links and metrics.
            </p>
            <Button
              onClick={() => exportToCSV("gospel_share_entries", "entries")}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export Entries CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* Combined Export */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Full Export</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Export all data including people and entries. The entries export
              will include person details merged in.
            </p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => exportToCSV("people", "all_people")}
                disabled={exporting}
              >
                Export All People
              </Button>
              <Button
                variant="outline"
                onClick={() => exportToCSV("gospel_share_entries", "all_entries")}
                disabled={exporting}
              >
                Export All Entries
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {message && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          {message}
        </div>
      )}
    </div>
  );
}

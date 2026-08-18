// ==========================================
// CSV — RFC 4180 reader/writer
// ==========================================
//
// This replaces four separate hand-rolled implementations (two writers, two parsers), each
// broken in a different way:
//   - admin/export escaped quotes but never wrapped, so any value with a comma split into
//     extra columns (160 of 330 notes) and any newline broke the row (33 notes).
//   - admin/portal wrapped on comma but never escaped embedded quotes, and also ignored newlines.
//   - Both importers used split("\n") + split(",") and stripped every quote, so they could not
//     read a correctly quoted file at all.
//
// Use these helpers for all CSV work so export -> import round-trips cleanly.

/** Quote a single value per RFC 4180: wrap only when needed, escape `"` by doubling it. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize rows to CSV text. Columns default to the keys of the first row. */
export function toCSV(
  rows: Record<string, unknown>[],
  headers?: string[]
): string {
  if (rows.length === 0) return "";
  const cols = headers ?? Object.keys(rows[0]);
  return [
    cols.map(csvCell).join(","),
    ...rows.map((row) => cols.map((c) => csvCell(row[c])).join(",")),
  ].join("\r\n");
}

/**
 * Parse CSV text into rows of raw cells.
 *
 * Handles quoted fields, doubled `""` escapes, embedded commas and newlines, CRLF or LF
 * endings, and a leading UTF-8 BOM.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; // skip BOM

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c; // newlines and commas are literal inside quotes
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else if (c === "\r") {
      i++; // part of CRLF; the \n terminates the row
    } else {
      field += c;
      i++;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse CSV text into objects keyed by header. Blank lines are dropped and values are
 * trimmed, matching how the app already trims notes on save.
 */
export function parseCSVToObjects(text: string): Record<string, string>[] {
  const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

/**
 * Trigger a CSV download. The BOM makes Excel read the file as UTF-8, so accented
 * characters and smart quotes from phone keyboards survive.
 */
export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

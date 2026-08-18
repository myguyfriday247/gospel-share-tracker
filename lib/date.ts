// ==========================================
// DATE UTILITIES - Shared date handling
// ==========================================

import { RangeKey, DateRange } from "./types";

// Pad number to 2 digits
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Convert Date to YYYY-MM-DD
export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Parse a YYYY-MM-DD string as a LOCAL date.
//
// `new Date("2026-08-18")` is parsed as UTC midnight, so rendering it with
// toLocaleDateString() in any timezone behind UTC shows the *previous* day — in Eastern
// time, "Aug 17". Building the Date from its parts keeps it local. Always use this for
// `entry_date`, which is a bare date column with no time or zone.
//
// Values that aren't a bare YYYY-MM-DD (e.g. a full `created_at` timestamp) are passed
// through to the normal Date parser, which handles them correctly already.
export function parseYMD(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Format a YYYY-MM-DD string for display, without the UTC off-by-one.
export function formatYMD(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  return parseYMD(value).toLocaleDateString("en-US", options);
}

// Get start of day (midnight)
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Get Sunday of the week containing the date
export function getSundayStart(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

// Get Saturday (end of week)
export function getSaturdayEnd(date: Date): Date {
  const s = getSundayStart(date);
  const sat = new Date(s);
  sat.setDate(sat.getDate() + 6);
  return new Date(sat.getFullYear(), sat.getMonth(), sat.getDate(), 23, 59, 59);
}

// Get date range for a RangeKey
export function getDateRange(key: RangeKey): DateRange {
  const now = new Date();

  if (key === "all") return { label: "All Time" };

  if (key === "this_week") {
    const start = getSundayStart(now);
    const end = getSaturdayEnd(now);
    return { label: "This Week", start: toYMD(start), end: toYMD(end) };
  }

  if (key === "last_week") {
    const startThis = getSundayStart(now);
    const start = new Date(startThis);
    start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { label: "Last Week", start: toYMD(start), end: toYMD(end) };
  }

  if (key === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { label: "This Month", start: toYMD(start), end: toYMD(end) };
  }

  if (key === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { label: "Last Month", start: toYMD(start), end: toYMD(end) };
  }

  // this_year
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { label: "This Year", start: toYMD(start), end: toYMD(end) };
}

// Parse a date cell from an imported CSV into YYYY-MM-DD, or null if it isn't a date.
//
// Accepts the ISO form the app writes, and the M/D/YY or M/D/YYYY form spreadsheets produce
// (Excel and Google Sheets both export US-style by default on a US locale). Separators may be
// / - or . — but the ISO branch is tried first, so 2026-08-18 is never read as a US date.
//
// DELIBERATELY month-first: "9/5/25" is 5 September 2025, not 9 May. A day-first file would be
// silently misread, which is why the import help text states the assumption. Two-digit years
// pivot at 70, so 25 -> 2025 and 95 -> 1995.
export function parseFlexibleDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (iso) return isoIfReal(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const us = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v);
  if (us) {
    const raw = Number(us[3]);
    const year = us[3].length === 2 ? (raw < 70 ? 2000 + raw : 1900 + raw) : raw;
    return isoIfReal(year, Number(us[1]), Number(us[2]));
  }

  return null;
}

// Rejects impossible dates such as 2/30 rather than letting Date roll them forward.
function isoIfReal(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

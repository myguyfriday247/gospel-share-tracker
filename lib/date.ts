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

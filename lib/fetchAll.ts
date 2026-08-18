// ==========================================
// FETCH ALL - paginate past PostgREST's row ceiling
// ==========================================
//
// PostgREST caps every response at `max-rows` (1000 by default; `supabase/config.toml` sets
// the same locally). A plain `.select("*")` with no range therefore returns *at most* that
// many rows and says nothing about it — no error, no warning. At 674 entries the app is under
// the cap, so exports and admin totals happen to be right today; crossing it would silently
// truncate CSV exports and skew every community-wide number.
//
// Callers pass a function that applies a range to their query. It must also request
// `{ count: "exact" }` so we can tell "that's everything" from "the server capped us".

import type { PostgrestError } from "@supabase/supabase-js";

export interface PagedResult<T> {
  data: T[];
  error: PostgrestError | null;
  /** True when the loop gave up before reaching the reported total. */
  truncated: boolean;
}

interface PageResponse<T> {
  data: T[] | null;
  error: PostgrestError | null;
  count: number | null;
}

/**
 * Read every row a query matches, one page at a time.
 *
 * Progress is measured against the server's exact `count`, not against whether a page came
 * back short. That matters: if the server's cap is smaller than `pageSize`, every page looks
 * "short", and a length-based loop would stop after the first one and silently drop the rest.
 *
 * @param page      applies `.range(from, to)` to the caller's query
 * @param pageSize  rows to request per round trip
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResponse<T>>,
  pageSize = 1000
): Promise<PagedResult<T>> {
  const all: T[] = [];
  let total: number | null = null;

  // Bounded so a misbehaving endpoint can't spin forever.
  const MAX_PAGES = 500;

  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error, count } = await page(all.length, all.length + pageSize - 1);

    if (error) return { data: all, error, truncated: true };
    if (total === null) total = count;

    const batch = data ?? [];
    all.push(...batch);

    // No progress: either we have everything, or the server refuses to return more.
    if (batch.length === 0) break;
    if (total !== null && all.length >= total) break;
  }

  return {
    data: all,
    error: null,
    truncated: total !== null && all.length < total,
  };
}

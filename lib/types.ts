// ==========================================
// SHARED TYPES - Single source of truth
// ==========================================

export type RangeKey = 
  | "all" 
  | "this_week" 
  | "last_week" 
  | "this_month" 
  | "last_month" 
  | "this_year";

export interface DateRange {
  label: string;
  start?: string;
  end?: string;
}

export interface Person {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role?: string;
}

export interface Entry {
  id: string;
  person_id: string;
  entry_date: string;
  number_reached: number;
  church_invite: boolean;
  spiritual_conversation: boolean;
  story_share: boolean;
  gospel_presentation: boolean;
  gospel_response: boolean;
  number_response: number;
  notes: string | null;
  created_at?: string;

  // ---- Columns present in the live table that the app never reads or writes ----
  //
  // These were absent from this interface even though 14 call sites use `select("*")`, so
  // runtime rows carried fields the types denied. Declared optional so those results
  // type-check.

  /**
   * Dead legacy key. All 674 rows are NULL and no code path sets it; RLS and every query key
   * off `person_id`. This one really is safe to drop.
   */
  user_id?: string | null;

  /**
   * GENERATED ALWAYS columns — Postgres computes each from the fields above, so they cannot be
   * inserted, updated, or drift:
   *
   *   invites_reached       = CASE WHEN church_invite          THEN number_reached ELSE 0 END
   *   conversations_reached = CASE WHEN spiritual_conversation THEN number_reached ELSE 0 END
   *   story_share_reached   = CASE WHEN story_share            THEN number_reached ELSE 0 END
   *   gospel_share_reached  = CASE WHEN gospel_presentation    THEN number_reached ELSE 0 END
   *   responses_count       = CASE WHEN gospel_response        THEN number_response ELSE 0 END
   *
   * They appear in no migration file, which is why they looked mysterious. Read-only: never
   * include them in an insert or update payload — Postgres rejects that.
   *
   * The admin dashboard re-derives these same figures in the browser from the raw columns.
   * Selecting them directly instead would let the database do that work, and is the obvious
   * route to a SQL-side aggregate (REVIEW.md #18).
   */
  invites_reached?: number | null;
  conversations_reached?: number | null;
  story_share_reached?: number | null;
  gospel_share_reached?: number | null;
  responses_count?: number | null;
}

export interface UserAgg {
  user_id: string;
  display_name: string;
  entries: number;
  total_reached: number;
  total_responses: number;
  invites_reached: number;
  conversations_reached: number;
  story_share_reached: number;
  gospel_share_reached: number;
}

export interface OverallAgg {
  unique_users: number;
  entries: number;
  total_reached: number;
  total_responses: number;
  invites_reached: number;
  conversations_reached: number;
  story_share_reached: number;
  gospel_share_reached: number;
}

export interface Totals {
  totalReached: number;
  gospelResponses: number;
  invitesReached: number;
  conversationsReached: number;
  storyShareReached: number;
  gospelShareReached: number;
}

export interface ChartDataPoint {
  date: string;
  reached: number;
  responses: number;
}

// Helper function to format display name
export function formatDisplayName(id: string, nameMap: Record<string, string>): string {
  if (id === "anonymous" || !id) return "Anonymous";
  const name = nameMap[id] || id.slice(0, 8);
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

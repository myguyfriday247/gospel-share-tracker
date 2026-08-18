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
   * Per-share-type totals, populated on all 674 rows — NOT abandoned, despite appearing in no
   * migration and no application code. Their sums line up with what the admin dashboard
   * computes from `number_reached` + the boolean flags:
   *
   *   invites 749 = 749 · conversations 2864 = 2864 · story 891 = 891 · responses 414 = 414
   *   gospel  2870 ≠ 2868  ← the stored column and the computed value disagree by 2
   *
   * Since nothing in this codebase writes them, something else must (most likely a database
   * trigger, or a one-off backfill). Do not drop these, and do not treat them as authoritative
   * until that discrepancy is explained — one of the two numbers is wrong.
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

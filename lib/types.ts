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

  // ---- Columns that exist in the live table but nothing in the app writes ----
  //
  // These were previously absent from this interface even though 14 call sites use
  // `select("*")`, so runtime rows carried fields the types denied. They are declared
  // optional so `select("*")` results type-check, and marked here so no one mistakes them
  // for live data.
  //
  // `user_id` is a dead legacy key: all rows are NULL and no code path sets it. RLS keys off
  // `person_id`. The other five appear in no migration and no code — presumably an abandoned
  // per-share-type breakdown, since the app derives those numbers by summing `number_reached`
  // filtered by the boolean flags. Confirm they hold no data before dropping any of them.
  /** @deprecated legacy — always NULL; use person_id */
  user_id?: string | null;
  /** @deprecated unused — not written or read anywhere in the app */
  invites_reached?: number | null;
  /** @deprecated unused */
  conversations_reached?: number | null;
  /** @deprecated unused */
  story_share_reached?: number | null;
  /** @deprecated unused */
  gospel_share_reached?: number | null;
  /** @deprecated unused */
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

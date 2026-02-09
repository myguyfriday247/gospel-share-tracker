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

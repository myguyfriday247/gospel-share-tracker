// ==========================================
// PEOPLE - resolve or create a person by email
// ==========================================

import { supabase } from "@/lib/supabaseClient";
import { emailMatchPattern, normalizeEmail } from "@/lib/email";
import { isUniqueViolation } from "@/lib/errors";
import type { PostgrestError } from "@supabase/supabase-js";

export interface ResolvedPerson {
  id: string | null;
  /** True when this call inserted the person rather than finding an existing one. */
  created: boolean;
  error: PostgrestError | null;
}

/**
 * Find the person for an email, creating one if no record exists.
 *
 * Entry imports previously rejected any row whose email was unknown, so loading entries for
 * someone not already in `people` meant importing a people file first. Creating the record
 * here lets a single entries file cover both cases: attach to whoever exists, create whoever
 * doesn't.
 *
 * The new row gets a generated id and the default role of 'user' — deliberately the same
 * shape as a CSV-imported person. It is a record, not a login: that person still signs up
 * themselves, at which point gst_claim_person_on_signup() adopts this row and its entries.
 *
 * @param email     address from the CSV; normalised before use
 * @param fullName  name from the CSV if it carries one; falls back to the local-part, matching
 *                  what signup does when a display name is unavailable
 */
export async function findOrCreatePersonByEmail(
  email: string,
  fullName?: string
): Promise<ResolvedPerson> {
  const normalized = normalizeEmail(email);

  const existing = await supabase
    .from("people")
    .select("id")
    .ilike("email", emailMatchPattern(normalized))
    .maybeSingle();

  if (existing.error) return { id: null, created: false, error: existing.error };
  if (existing.data) return { id: existing.data.id, created: false, error: null };

  const name = fullName?.trim() || normalized.split("@")[0];
  const inserted = await supabase
    .from("people")
    .insert({ email: normalized, full_name: name })
    .select("id")
    .maybeSingle();

  if (inserted.error) {
    // Another row in the same file (or a concurrent import) got there first — adopt it
    // rather than failing the entry.
    if (isUniqueViolation(inserted.error)) {
      const retry = await supabase
        .from("people")
        .select("id")
        .ilike("email", emailMatchPattern(normalized))
        .maybeSingle();
      if (retry.data) return { id: retry.data.id, created: false, error: null };
    }
    return { id: null, created: false, error: inserted.error };
  }

  return { id: inserted.data?.id ?? null, created: true, error: null };
}

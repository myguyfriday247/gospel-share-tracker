// ==========================================
// ERRORS - consistent handling for Supabase failures
// ==========================================
//
// The app previously discarded the `error` half of ~25 Supabase responses
// (`const { data } = await supabase…`), so a failed query was indistinguishable from an empty
// result: RLS denials, network errors and genuine "no rows" all rendered as zeros. Capture the
// error and run it through here so failures are visible instead of silent.

/** Readable message for any thrown value or Supabase error. */
export function errorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * PostgREST's "no rows returned" code. This is an expected outcome for a lookup that may
 * legitimately miss, not a failure — worth distinguishing so real errors still surface.
 */
export function isNoRows(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "PGRST116"
  );
}

/** Postgres unique-violation, raised when two clients insert the same row concurrently. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

/**
 * Log a failure with the operation that caused it. `context` should name the operation
 * ("load dashboard entries"), so console output identifies the call site.
 */
export function reportError(context: string, error: unknown): void {
  if (!error) return;
  console.error(`[gospel-share-tracker] ${context}:`, error);
}

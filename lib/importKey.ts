// ==========================================
// IMPORT KEY - makes a CSV import repeatable
// ==========================================
//
// Re-running an import file used to insert everything again. Each imported row now carries a
// fingerprint of its own content plus how many times that exact content has already appeared
// in the same file; a unique index on the column (migration 010) turns a second run into skips.
//
// The occurrence number is what makes this safe. Files legitimately contain repeated identical
// rows - someone logging two indistinguishable conversations the same day - and hashing content
// alone would collapse them and drop real records.

/** Fields that define a row's identity. Order is fixed: changing it invalidates existing keys. */
export interface ImportKeyFields {
  email: string;
  entryDate: string;
  numberReached: number;
  churchInvite: boolean;
  spiritualConversation: boolean;
  storyShare: boolean;
  gospelPresentation: boolean;
  gospelResponse: boolean;
  numberResponse: number;
  notes: string;
}

/**
 * Counts how many times each row's content has been seen, so repeated rows in one file get
 * distinct keys. Create one per import run.
 */
export function createOccurrenceCounter() {
  const seen = new Map<string, number>();
  return (canonical: string): number => {
    const next = (seen.get(canonical) ?? 0) + 1;
    seen.set(canonical, next);
    return next;
  };
}

/** Canonical form of a row - unit separator between fields so content cannot blur boundaries. */
export function canonicalRow(f: ImportKeyFields): string {
  return [
    f.email.trim().toLowerCase(),
    f.entryDate,
    f.numberReached,
    f.churchInvite,
    f.spiritualConversation,
    f.storyShare,
    f.gospelPresentation,
    f.gospelResponse,
    f.numberResponse,
    f.notes.replace(/\s+/g, " ").trim(),
  ].join("\u001f");
}

/**
 * Deterministic key for one imported row. Same file, same rows, same keys - so the second run
 * collides with the first and is skipped.
 */
export async function importKey(
  fields: ImportKeyFields,
  occurrence: number
): Promise<string> {
  const canonical = `${canonicalRow(fields)}#${occurrence}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

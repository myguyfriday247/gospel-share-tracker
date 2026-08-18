// ==========================================
// EMAIL - normalisation and safe matching
// ==========================================
//
// `people` carries two constraints: UNIQUE (email) on the exact string, and an EXCLUDE on
// lower(email). So `Bob@x.com` and `bob@x.com` cannot coexist, but an upsert keyed on the
// exact-case index will not see them as the same row either — it attempts an insert, which
// the case-insensitive constraint then rejects. Normalising every write removes that whole
// class of failure.

/** Lowercase and trim, so every write stores the same canonical form. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Escape LIKE/ILIKE metacharacters so a value matches literally.
 *
 * `_` matches any single character in LIKE, and 7 of the stored addresses contain one — so an
 * unescaped `.ilike("email", "a_b@x.com")` would also match `axb@x.com` and could attach an
 * imported entry to the wrong person. Escaping keeps ILIKE's case-insensitivity without its
 * wildcards.
 */
export function likeEscape(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

/** Canonical form for a case-insensitive exact-match lookup on an email column. */
export function emailMatchPattern(value: string): string {
  return likeEscape(normalizeEmail(value));
}

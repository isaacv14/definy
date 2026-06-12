/**
 * Blocklist of terms that should never trigger AI definition generation.
 * This includes offensive terms, spam patterns, and other undesirable content.
 *
 * Usage:
 *   if (BLOCKLIST.has(normalizedTerm)) {
 *     return { error: "blocked_term", message: "This term cannot be looked up" };
 *   }
 */

const BLOCKED_TERMS = [
  // Offensive/explicit content
  "fuck",
  "shit",
  "ass",
  "bitch",
  "damn",
  "crap",

  // Racist/discriminatory slurs (non-exhaustive, just placeholder examples)
  // These are listed by category to signal intent, but real implementation
  // would need comprehensive list from content team
  "racial slurs placeholder",
  "ethnic slurs placeholder",
  "homophobic slurs placeholder",

  // Spam/nonsense patterns
  "aaaa",
  "zzzz",
  "xxxx",
  "test123",
  "asdfgh",
  "qwerty",

  // Adult/NSFW content markers
  "porn",
  "xxx",
  "nsfw",
  "adult",

  // SQL injection/code injection attempts (defensive)
  "select",
  "insert",
  "delete",
  "drop",
  "union",

  // Command injection attempts
  "bash",
  "shell",
  "cmd",
  "exec",

  // Empty or whitespace-only (caught by normalization, but good to have)
  "",
];

/**
 * Set for O(1) lookup performance
 */
export const BLOCKLIST = new Set<string>(BLOCKED_TERMS);

/**
 * Check if a normalized term is blocklisted.
 * Case-insensitive matching already handled by normalizeSearchTerm()
 * which lowercases input.
 *
 * @param normalizedTerm - The term to check (should already be normalized)
 * @returns true if the term is blocklisted
 */
export function isBlocklisted(normalizedTerm: string): boolean {
  return BLOCKLIST.has(normalizedTerm);
}

/**
 * Add a term to the blocklist (for dynamic updates if needed).
 * @param term - The term to block (should be lowercase/normalized)
 */
export function blockTerm(term: string): void {
  BLOCKLIST.add(term);
}

/**
 * Remove a term from the blocklist (for management purposes).
 * @param term - The term to unblock
 */
export function unblockTerm(term: string): void {
  BLOCKLIST.delete(term);
}

/**
 * Get the current size of the blocklist (for monitoring).
 * @returns Number of blocked terms
 */
export function getBlocklistSize(): number {
  return BLOCKLIST.size;
}

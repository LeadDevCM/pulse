/**
 * Normalize a raw phone string to E.164 format (+1XXXXXXXXXX).
 * Handles formats like:
 *   435.592.6407
 *   (435) 704-8987
 *   435) 590-6429  (missing opening paren)
 *   +1 702-308-2041
 * Returns null if the input cannot produce a valid 10-digit US number.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  // Strip everything except digits and leading +
  const digits = raw.replace(/[^\d]/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
}

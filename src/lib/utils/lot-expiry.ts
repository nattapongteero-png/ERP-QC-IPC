/**
 * Is a lot past its expiry date?
 *
 * One place, because "expired" must mean the same thing to sales, production
 * and material withdrawal. UAT had expired stock issued through all three
 * (1 sales delivery, 1 work order, 1 withdrawal) precisely because each path
 * checked lot status and quantity but nobody checked the date.
 *
 * Compared by whole days, not by timestamp: a lot expiring "2026-06-25" is
 * good for the whole of the 25th. Comparing raw Date objects would make the
 * same lot pass at 09:00 and fail at 14:00 on its last day, which nobody in a
 * warehouse would accept as an explanation.
 */

/** Start of day, local — the warehouse works in local days, not UTC. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Parse a DB date value, or null if it is not a real date.
 *
 * Deliberately NOT toDateSafe() from date-utils: that helper falls back to
 * *today* on an unparseable value, which is sensible for rendering a label but
 * dangerous here — a corrupt expiry date would silently read as "expires
 * today", i.e. still usable, and the guard would wave it through. For a safety
 * rule an unreadable date has to surface as unknown, never as fine.
 */
function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Whole days from today until the lot expires.
 *
 * Negative = already expired, 0 = expires today (still usable).
 * Returns null when there is no expiry date: that is "unknown", not "fine",
 * and the caller has to decide what to do about it.
 */
export function daysUntilExpiry(
  expiryDate: Date | string | null | undefined,
  asOf?: Date,
): number | null {
  const exp = parseDate(expiryDate);
  if (!exp) return null;

  const today = startOfDay(asOf ?? new Date());
  return Math.round((startOfDay(exp).getTime() - today.getTime()) / 86_400_000);
}

/**
 * True only when the lot is genuinely past its date.
 *
 * A missing expiry date returns FALSE — it does not block the issue. Some
 * lots legitimately have no expiry, and refusing everything undated would
 * stop the factory over a data-entry gap rather than a safety problem. The
 * gap is worth reporting, but not by halting the line.
 */
export function isLotExpired(
  expiryDate: Date | string | null | undefined,
  asOf?: Date,
): boolean {
  const days = daysUntilExpiry(expiryDate, asOf);
  return days !== null && days < 0;
}

/** Expires within `withinDays` but has not expired yet. */
export function isLotExpiringSoon(
  expiryDate: Date | string | null | undefined,
  withinDays = 30,
  asOf?: Date,
): boolean {
  const days = daysUntilExpiry(expiryDate, asOf);
  return days !== null && days >= 0 && days <= withinDays;
}

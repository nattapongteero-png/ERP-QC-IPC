/**
 * Database Date Utilities
 *
 * Provides database-agnostic date handling for the dual-database pattern
 * (MySQL production, SQLite testing).
 *
 * MySQL datetime columns require Date objects, while SQLite works with
 * ISO 8601 strings. These utilities ensure correct formatting for both.
 */

import { isSqlite } from './index';

/**
 * Get current datetime in the correct format for the database.
 * SQLite: ISO 8601 string format (e.g., "2024-12-23T10:30:00.000Z")
 * MySQL: Date object (Drizzle handles conversion)
 */
export function getNow(): Date | string {
  return isSqlite() ? new Date().toISOString() : new Date();
}

/**
 * Convert a date value to the correct format for the database.
 * SQLite: Returns ISO string format (YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DD)
 * MySQL: Converts to Date object
 *
 * @param value - Date object or date string in any format parseable by Date constructor
 */
export function toDbDate(value: Date | string): Date | string {
  if (isSqlite()) {
    // For SQLite, ensure we return a string
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }
  // For MySQL, ensure we return a Date object
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

/**
 * Get today's date as YYYY-MM-DD string in local timezone.
 * Uses local date components to avoid UTC timezone shift.
 */
export function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Finished-goods expiry date = manufacturing date + product shelf life.
 *
 * Single source of truth so the expiry PROJECTED on the work-order screen
 * before production and the expiry actually STAMPED on the FG lot at output
 * are computed the same way — otherwise the operator sees one date up front and
 * the lot carries another.
 *
 * @param manufacturingDate  MFD as YYYY-MM-DD (or null)
 * @param shelfLifeDays      product.shelfLifeDays (or null)
 * @returns expiry as YYYY-MM-DD, or null when either input is missing
 */
export function calculateExpiryDate(
  manufacturingDate: string | null | undefined,
  shelfLifeDays: number | null | undefined,
): string | null {
  if (!manufacturingDate || !shelfLifeDays) return null;
  const mfd = new Date(manufacturingDate);
  if (isNaN(mfd.getTime())) return null;
  mfd.setDate(mfd.getDate() + shelfLifeDays);
  return mfd.toISOString().split('T')[0];
}

/**
 * Convert a date string to database format, with fallback to today.
 * Useful for optional date fields that should default to today.
 *
 * @param dateStr - Optional date string
 */
export function toDbDateOrToday(dateStr?: string): Date | string {
  return toDbDate(dateStr || getTodayStr());
}

/**
 * Safely convert a database date value to a Date object.
 * Handles both Date objects (MySQL) and strings (SQLite).
 *
 * @param value - Date object, ISO string, or date string from database
 * @returns Date object
 */
export function toDateSafe(value: Date | string | null | undefined): Date {
  if (!value) {
    return new Date();
  }

  // Handle Date objects
  if (value instanceof Date) {
    const time = value.getTime();
    if (!isNaN(time)) {
      return new Date(time);
    }
    // Invalid date, fall through to string handling
  }

  // Parse string
  const parsed = new Date(String(value));
  if (isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

/**
 * Format a database date value to YYYY-MM-DD string.
 * Handles both Date objects (MySQL) and strings (SQLite).
 *
 * @param value - Date object or string from database
 * @returns YYYY-MM-DD formatted string
 */
export function formatDateFromDb(value: Date | string | null | undefined): string {
  // Handle null/undefined
  if (!value) {
    return getTodayStr();
  }

  // Handle Date objects — use local components to avoid UTC timezone shift
  if (value instanceof Date) {
    const time = value.getTime();
    if (!isNaN(time)) {
      const d = new Date(time);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    // Invalid date, fall through to string handling
  }

  // Convert to string if not already
  const strValue = String(value);

  // If it's already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
    return strValue;
  }

  // Parse and format ISO string or other formats — use local components
  const parsed = new Date(strValue);
  if (isNaN(parsed.getTime())) {
    // Invalid date, return today
    return getTodayStr();
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

/**
 * Format a database date value to YYYY-MM month string.
 * Handles both Date objects (MySQL) and strings (SQLite).
 *
 * @param value - Date object or string from database
 * @returns YYYY-MM formatted string
 */
export function formatMonthFromDb(value: Date | string): string {
  const date = toDateSafe(value);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

/**
 * Convert a date value to the correct format for Drizzle query conditions.
 * Use this when passing dates to gte(), lte(), eq(), etc. operators.
 *
 * MySQL: Returns Date object (Drizzle calls toISOString internally)
 * SQLite: Returns string (text comparison)
 *
 * @param value - Date object, date string, or null/undefined
 * @returns Date object for MySQL, string for SQLite
 */
export function toQueryDate(value: Date | string | null | undefined): Date | string {
  if (!value) {
    return isSqlite() ? getTodayStr() : new Date();
  }

  if (value instanceof Date) {
    return isSqlite() ? value.toISOString().split('T')[0] : value;
  }

  // String input
  if (isSqlite()) {
    // For SQLite, ensure YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    return new Date(value).toISOString().split('T')[0];
  }

  // For MySQL, convert string to Date
  return new Date(value);
}

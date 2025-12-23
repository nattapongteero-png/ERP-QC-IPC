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
 * Convert a date string to the correct format for the database.
 * SQLite: Returns the string as-is
 * MySQL: Converts to Date object
 *
 * @param dateStr - Date string in any format parseable by Date constructor
 */
export function toDbDate(dateStr: string): Date | string {
  return isSqlite() ? dateStr : new Date(dateStr);
}

/**
 * Get today's date as YYYY-MM-DD string.
 * Useful for date-only fields or as input to toDbDate().
 */
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
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

  // Handle Date objects (including cross-realm Date objects)
  if (value instanceof Date || (typeof value === 'object' && value.constructor?.name === 'Date')) {
    try {
      const time = (value as Date).getTime();
      if (!isNaN(time)) {
        return new Date(time);
      }
    } catch {
      // Fall through to string handling
    }
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
    return new Date().toISOString().split('T')[0];
  }

  // Handle Date objects (including cross-realm Date objects)
  if (value instanceof Date || (typeof value === 'object' && value.constructor?.name === 'Date')) {
    try {
      // Try to get time value first to check if it's a valid date
      const time = (value as Date).getTime();
      if (!isNaN(time)) {
        return new Date(time).toISOString().split('T')[0];
      }
    } catch {
      // Fall through to string handling
    }
  }

  // Convert to string if not already
  const strValue = String(value);

  // If it's already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
    return strValue;
  }

  // Parse and format ISO string or other formats
  const parsed = new Date(strValue);
  if (isNaN(parsed.getTime())) {
    // Invalid date, return today
    return new Date().toISOString().split('T')[0];
  }
  return parsed.toISOString().split('T')[0];
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

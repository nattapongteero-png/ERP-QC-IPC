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
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

/**
 * Format a database date value to YYYY-MM-DD string.
 * Handles both Date objects (MySQL) and strings (SQLite).
 *
 * @param value - Date object or string from database
 * @returns YYYY-MM-DD formatted string
 */
export function formatDateFromDb(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  // If it's already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  // Parse and format ISO string or other formats
  return new Date(value).toISOString().split('T')[0];
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

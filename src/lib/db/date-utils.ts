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

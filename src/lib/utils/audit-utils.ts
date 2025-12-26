/**
 * Audit Log Utilities
 *
 * Client-safe utilities for parsing and displaying audit log data.
 * These functions can be used in both client and server components.
 */

import type { FieldChange } from '@/types/audit-log';

/**
 * Parse field-level changes between old and new values
 */
export function parseFieldChanges(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  fieldLabels: Record<string, string> = {}
): FieldChange[] {
  const changes: FieldChange[] = [];

  if (!oldValue && !newValue) {
    return changes;
  }

  // For CREATE action (no oldValue)
  if (!oldValue && newValue) {
    Object.entries(newValue).forEach(([key, value]) => {
      if (shouldIncludeField(key, value)) {
        changes.push({
          fieldName: key,
          fieldLabel: fieldLabels[key] || formatFieldLabel(key),
          oldValue: null,
          newValue: value,
        });
      }
    });
    return changes;
  }

  // For DELETE action (no newValue)
  if (oldValue && !newValue) {
    Object.entries(oldValue).forEach(([key, value]) => {
      if (shouldIncludeField(key, value)) {
        changes.push({
          fieldName: key,
          fieldLabel: fieldLabels[key] || formatFieldLabel(key),
          oldValue: value,
          newValue: null,
        });
      }
    });
    return changes;
  }

  // For UPDATE action - compare fields
  if (oldValue && newValue) {
    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);

    allKeys.forEach((key) => {
      const oldVal = oldValue[key];
      const newVal = newValue[key];

      // Skip if values are the same
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
        return;
      }

      // Skip internal fields
      if (!shouldIncludeField(key, newVal)) {
        return;
      }

      changes.push({
        fieldName: key,
        fieldLabel: fieldLabels[key] || formatFieldLabel(key),
        oldValue: oldVal ?? null,
        newValue: newVal ?? null,
      });
    });
  }

  return changes;
}

/**
 * Check if a field should be included in change display
 */
function shouldIncludeField(key: string, value: unknown): boolean {
  // Skip common internal fields
  const skipFields = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'password', 'passwordHash'];
  if (skipFields.includes(key)) {
    return false;
  }

  // Skip null/undefined values
  if (value === null || value === undefined) {
    return false;
  }

  return true;
}

/**
 * Format field name to readable label
 */
function formatFieldLabel(fieldName: string): string {
  // Convert camelCase to Title Case with spaces
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

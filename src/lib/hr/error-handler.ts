/**
 * HR Module Error Handling Utilities
 *
 * Provides consistent error handling and notification display
 * using DevExtreme notify() for the HR module.
 */

import notify from 'devextreme/ui/notify';

/**
 * API error structure from backend responses
 */
export interface ApiError {
  error?: string;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Validation error structure for form fields
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Handles API errors and shows an error notification
 *
 * @param error - The error object (can be Error, string, or unknown)
 * @param defaultMessage - Default message to show if error type is unknown
 *
 * @example
 * ```typescript
 * try {
 *   await saveData();
 * } catch (error) {
 *   handleApiError(error, 'Failed to save data');
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string = 'เกิดข้อผิดพลาด'
): void {
  if (error instanceof Error) {
    notify(error.message, 'error', 5000);
  } else if (typeof error === 'string') {
    notify(error, 'error', 5000);
  } else {
    notify(defaultMessage, 'error', 5000);
  }
}

/**
 * Handles validation errors and shows them with field information
 *
 * @param errors - Array of validation errors with field and message
 *
 * @example
 * ```typescript
 * const errors = [
 *   { field: 'code', message: 'Required' },
 *   { field: 'name', message: 'Must be at least 3 characters' }
 * ];
 * handleValidationErrors(errors);
 * ```
 */
export function handleValidationErrors(
  errors: Array<{ field: string; message: string }>
): void {
  const errorMessages = errors.map((e) => `${e.field}: ${e.message}`).join('\n');
  notify(`ข้อมูลไม่ถูกต้อง:\n${errorMessages}`, 'error', 5000);
}

/**
 * Shows a success notification
 *
 * @param message - The success message to display
 *
 * @example
 * ```typescript
 * showSuccess('บันทึกสำเร็จ');
 * ```
 */
export function showSuccess(message: string): void {
  notify(message, 'success', 3000);
}

/**
 * Shows a warning notification
 *
 * @param message - The warning message to display
 *
 * @example
 * ```typescript
 * showWarning('กรุณาระบุข้อมูลให้ครบถ้วน');
 * ```
 */
export function showWarning(message: string): void {
  notify(message, 'warning', 3000);
}

/**
 * Shows an info notification
 *
 * @param message - The info message to display
 *
 * @example
 * ```typescript
 * showInfo('กำลังโหลดข้อมูล...');
 * ```
 */
export function showInfo(message: string): void {
  notify(message, 'info', 3000);
}

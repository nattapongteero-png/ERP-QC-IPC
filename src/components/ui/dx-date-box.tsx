"use client";

import { useMemo } from 'react';
import DateBox from 'devextreme-react/date-box';
import Validator, { RequiredRule, RangeRule } from 'devextreme-react/validator';
import type { DateBoxTypes } from 'devextreme-react/date-box';
// Custom format type for DevExtreme DateBox displayFormat
interface CustomDateFormat {
  formatter: (value: number | Date) => string;
  parser: (text: string) => Date | null;
}

export type DxDateBoxType = 'date' | 'time' | 'datetime';

export interface DxDateBoxProps {
  /** Current value (string in ISO format YYYY-MM-DD) */
  value?: string;
  /** Default value (uncontrolled) */
  defaultValue?: Date | string;
  /** Change handler - returns ISO date string (YYYY-MM-DD) or empty string */
  onValueChange?: (value: string) => void;
  /** Change handler with event (returns Date object) */
  onValueChanged?: (e: DateBoxTypes.ValueChangedEvent) => void;
  /** Type of picker */
  type?: DxDateBoxType;
  /** Placeholder text */
  placeholder?: string;
  /** Label text */
  label?: string;
  /** Label mode */
  labelMode?: 'static' | 'floating' | 'hidden' | 'outside';
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Required field */
  required?: boolean;
  /** Required message */
  requiredMessage?: string;
  /** Minimum date */
  min?: Date | string;
  /** Maximum date */
  max?: Date | string;
  /** Date format display - if provided, overrides Buddhist Era format */
  displayFormat?: string;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Show clear button */
  showClearButton?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Name attribute */
  name?: string;
  /** Validation group name */
  validationGroup?: string;
  /** Picker type */
  pickerType?: 'calendar' | 'list' | 'native' | 'rollers';
  /** Show dropdown button */
  showDropDownButton?: boolean;
  /** Open calendar on field click */
  openOnFieldClick?: boolean;
  /** Accept custom value (typed) */
  acceptCustomValue?: boolean;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

/**
 * Buddhist Era date formatter (DD/MM/YYYY+543)
 * Exported for testing purposes
 */
export const buddhistDateFormat: CustomDateFormat = {
  formatter: (value: number | Date): string => {
    if (value === null || value === undefined) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (!date || isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const buddhistYear = date.getFullYear() + 543;
    return `${day}/${month}/${buddhistYear}`;
  },
  parser: (text: string): Date | null => {
    if (!text) return null;
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const gregorianYear = parseInt(year, 10) - 543;
    return new Date(gregorianYear, parseInt(month, 10) - 1, parseInt(day, 10));
  },
};

/**
 * Buddhist Era datetime formatter (DD/MM/YYYY+543 HH:mm)
 * Exported for testing purposes
 */
export const buddhistDateTimeFormat: CustomDateFormat = {
  formatter: (value: number | Date): string => {
    if (value === null || value === undefined) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (!date || isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const buddhistYear = date.getFullYear() + 543;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${buddhistYear} ${hours}:${minutes}`;
  },
  parser: (text: string): Date | null => {
    if (!text) return null;
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;
    const [, day, month, year, hours, minutes] = match;
    const gregorianYear = parseInt(year, 10) - 543;
    return new Date(gregorianYear, parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10));
  },
};

/**
 * Convert string value (YYYY-MM-DD) to Date object
 * Exported for testing purposes
 */
export function parseStringToDate(value: string | undefined): Date | null {
  if (!value) return null;
  // Handle ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * DevExtreme DateBox wrapper with Thai locale support
 *
 * @example
 * ```tsx
 * // Basic date picker
 * <DxDateBox
 *   label="วันที่"
 *   value={date}
 *   onValueChange={setDate}
 *   required
 * />
 *
 * // Date with range
 * <DxDateBox
 *   label="วันหมดอายุ"
 *   type="date"
 *   value={expiryDate}
 *   onValueChange={setExpiryDate}
 *   min={new Date()}
 *   displayFormat="dd/MM/yyyy"
 * />
 *
 * // DateTime picker
 * <DxDateBox
 *   label="วันที่และเวลา"
 *   type="datetime"
 *   value={datetime}
 *   onValueChange={setDatetime}
 *   displayFormat="dd/MM/yyyy HH:mm"
 * />
 * ```
 */
export function DxDateBox({
  value,
  defaultValue,
  onValueChange,
  onValueChanged,
  type = 'date',
  placeholder,
  label,
  labelMode = 'floating',
  disabled = false,
  readOnly = false,
  required = false,
  requiredMessage = 'กรุณาเลือกวันที่',
  min,
  max,
  displayFormat,
  width,
  height,
  showClearButton = false,
  className,
  name,
  validationGroup,
  pickerType = 'calendar',
  showDropDownButton = true,
  openOnFieldClick = true,
  acceptCustomValue = false,
  'data-testid': testId,
}: DxDateBoxProps) {
  const hasValidation = required || min || max;

  // Convert string value to Date object for DevExtreme
  const dateValue = useMemo(() => parseStringToDate(value), [value]);

  const handleValueChanged = (e: DateBoxTypes.ValueChangedEvent) => {
    const newDateValue = e.value as Date | null;

    if (onValueChange) {
      // Always convert Date to ISO string (YYYY-MM-DD) for consistent string-based state
      onValueChange(newDateValue ? newDateValue.toISOString().split('T')[0] : '');
    }
    if (onValueChanged) {
      onValueChanged(e);
    }
  };

  // Use Buddhist Era formatter based on type
  // DevExtreme accepts { formatter, parser } object for custom date formatting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buddhistFormat: any = useMemo(() => {
    if (displayFormat) return displayFormat; // Allow override with explicit format string
    if (type === 'time') return 'HH:mm';
    if (type === 'datetime') return buddhistDateTimeFormat;
    return buddhistDateFormat;
  }, [type, displayFormat]);

  return (
    <DateBox
      value={dateValue}
      defaultValue={defaultValue}
      onValueChanged={handleValueChanged}
      type={type}
      placeholder={placeholder}
      label={label}
      labelMode={labelMode}
      disabled={disabled}
      readOnly={readOnly}
      min={min}
      max={max}
      displayFormat={buddhistFormat}
      width={width}
      height={height}
      showClearButton={showClearButton}
      className={className}
      name={name}
      pickerType={pickerType}
      showDropDownButton={showDropDownButton}
      openOnFieldClick={openOnFieldClick}
      acceptCustomValue={acceptCustomValue}
      elementAttr={testId ? { 'data-testid': testId } : undefined}
      calendarOptions={{
        firstDayOfWeek: 0, // Sunday
      }}
    >
      {hasValidation && (
        <Validator validationGroup={validationGroup}>
          {required && (
            <RequiredRule message={requiredMessage} />
          )}
          {(min || max) && (
            <RangeRule
              min={min}
              max={max}
              message={min && max
                ? `วันที่ต้องอยู่ระหว่าง ${min} ถึง ${max}`
                : min
                ? `วันที่ต้องไม่ก่อน ${min}`
                : `วันที่ต้องไม่หลัง ${max}`
              }
            />
          )}
        </Validator>
      )}
    </DateBox>
  );
}

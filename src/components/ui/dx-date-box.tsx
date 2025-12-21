"use client";

import { useMemo } from 'react';
import DateBox from 'devextreme-react/date-box';
import Validator, { RequiredRule, RangeRule } from 'devextreme-react/validator';
import type { DateBoxTypes } from 'devextreme-react/date-box';

export type DxDateBoxType = 'date' | 'time' | 'datetime';

/**
 * Create a Buddhist Era formatter object for DevExtreme
 * Buddhist Era = Gregorian year + 543
 */
function createBuddhistFormatter(type: DxDateBoxType) {
  return {
    formatter: (date: Date | null): string => {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const buddhistYear = date.getFullYear() + 543;

      if (type === 'time') {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }

      if (type === 'datetime') {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${buddhistYear} ${hours}:${minutes}`;
      }

      return `${day}/${month}/${buddhistYear}`;
    },
    parser: (text: string): Date | null => {
      if (!text) return null;

      // Parse dd/MM/yyyy or dd/MM/yyyy HH:mm format with Buddhist year
      const dateTimeMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
      const dateMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const timeMatch = text.match(/^(\d{2}):(\d{2})$/);

      if (dateTimeMatch) {
        const [, day, month, buddhistYear, hours, minutes] = dateTimeMatch;
        const gregorianYear = parseInt(buddhistYear, 10) - 543;
        return new Date(gregorianYear, parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10));
      }

      if (dateMatch) {
        const [, day, month, buddhistYear] = dateMatch;
        const gregorianYear = parseInt(buddhistYear, 10) - 543;
        return new Date(gregorianYear, parseInt(month, 10) - 1, parseInt(day, 10));
      }

      if (timeMatch && type === 'time') {
        const [, hours, minutes] = timeMatch;
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours, 10), parseInt(minutes, 10));
      }

      return null;
    },
  };
}

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
  /** Date format display */
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
}: DxDateBoxProps) {
  const hasValidation = required || min || max;

  // Create Buddhist Era formatter
  const buddhistFormatter = useMemo(() => createBuddhistFormatter(type), [type]);

  const handleValueChanged = (e: DateBoxTypes.ValueChangedEvent) => {
    if (onValueChange) {
      const dateValue = e.value as Date | null;
      // Always convert Date to ISO string (YYYY-MM-DD) for consistent string-based state
      onValueChange(dateValue ? dateValue.toISOString().split('T')[0] : '');
    }
    if (onValueChanged) {
      onValueChanged(e);
    }
  };

  // Use custom Buddhist format if no displayFormat provided
  // DevExtreme accepts formatter object with { formatter, parser } for custom formatting
  const effectiveDisplayFormat = displayFormat || buddhistFormatter;

  return (
    <DateBox
      value={value}
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
      displayFormat={effectiveDisplayFormat}
      width={width}
      height={height}
      showClearButton={showClearButton}
      className={className}
      name={name}
      pickerType={pickerType}
      showDropDownButton={showDropDownButton}
      openOnFieldClick={openOnFieldClick}
      acceptCustomValue={acceptCustomValue}
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

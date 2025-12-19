"use client";

import DateBox from 'devextreme-react/date-box';
import Validator, { RequiredRule, RangeRule } from 'devextreme-react/validator';
import type { DateBoxTypes } from 'devextreme-react/date-box';

export type DxDateBoxType = 'date' | 'time' | 'datetime';

export interface DxDateBoxProps {
  /** Current value */
  value?: Date | string | null;
  /** Default value (uncontrolled) */
  defaultValue?: Date | string;
  /** Change handler */
  onValueChange?: (value: Date | null) => void;
  /** Change handler with event */
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

  // Default display format based on type
  const defaultDisplayFormat = type === 'datetime'
    ? 'dd/MM/yyyy HH:mm'
    : type === 'time'
    ? 'HH:mm'
    : 'dd/MM/yyyy';

  const handleValueChanged = (e: DateBoxTypes.ValueChangedEvent) => {
    if (onValueChange) {
      onValueChange(e.value as Date | null);
    }
    if (onValueChanged) {
      onValueChanged(e);
    }
  };

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
      displayFormat={displayFormat || defaultDisplayFormat}
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

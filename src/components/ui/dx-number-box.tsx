"use client";

import NumberBox from 'devextreme-react/number-box';
import Validator, { RequiredRule, RangeRule } from 'devextreme-react/validator';
import type { NumberBoxTypes } from 'devextreme-react/number-box';

export interface DxNumberBoxProps {
  /** Current value */
  value?: number | null;
  /** Default value (uncontrolled) */
  defaultValue?: number;
  /** Change handler */
  onValueChange?: (value: number | null) => void;
  /** Change handler with event */
  onValueChanged?: (e: NumberBoxTypes.ValueChangedEvent) => void;
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
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step value */
  step?: number;
  /** Number format */
  format?: string;
  /** Show spin buttons */
  showSpinButtons?: boolean;
  /** Show clear button */
  showClearButton?: boolean;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Additional CSS class */
  className?: string;
  /** Name attribute */
  name?: string;
  /** Validation group name */
  validationGroup?: string;
  /** Mode */
  mode?: 'number' | 'text';
}

/**
 * DevExtreme NumberBox wrapper for numeric input
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DxNumberBox
 *   label="จำนวน"
 *   value={quantity}
 *   onValueChange={setQuantity}
 *   min={0}
 *   required
 * />
 *
 * // With format
 * <DxNumberBox
 *   label="ราคา"
 *   value={price}
 *   onValueChange={setPrice}
 *   format="#,##0.00"
 *   min={0}
 * />
 *
 * // With spin buttons
 * <DxNumberBox
 *   label="จำนวน"
 *   value={qty}
 *   onValueChange={setQty}
 *   showSpinButtons
 *   step={1}
 *   min={1}
 *   max={100}
 * />
 * ```
 */
export function DxNumberBox({
  value,
  defaultValue,
  onValueChange,
  onValueChanged,
  placeholder,
  label,
  labelMode = 'floating',
  disabled = false,
  readOnly = false,
  required = false,
  requiredMessage = 'กรุณากรอกข้อมูล',
  min,
  max,
  step = 1,
  format,
  showSpinButtons = false,
  showClearButton = false,
  width,
  height,
  className,
  name,
  validationGroup,
  mode = 'number',
}: DxNumberBoxProps) {
  const hasValidation = required || min !== undefined || max !== undefined;

  const handleValueChanged = (e: NumberBoxTypes.ValueChangedEvent) => {
    if (onValueChange) {
      onValueChange(e.value as number | null);
    }
    if (onValueChanged) {
      onValueChanged(e);
    }
  };

  return (
    <NumberBox
      value={value ?? undefined}
      defaultValue={defaultValue}
      onValueChanged={handleValueChanged}
      placeholder={placeholder}
      label={label}
      labelMode={labelMode}
      disabled={disabled}
      readOnly={readOnly}
      min={min}
      max={max}
      step={step}
      format={format}
      showSpinButtons={showSpinButtons}
      showClearButton={showClearButton}
      width={width}
      height={height}
      className={className}
      name={name}
      mode={mode}
    >
      {hasValidation && (
        <Validator validationGroup={validationGroup}>
          {required && (
            <RequiredRule message={requiredMessage} />
          )}
          {(min !== undefined || max !== undefined) && (
            <RangeRule
              min={min}
              max={max}
              message={min !== undefined && max !== undefined
                ? `ค่าต้องอยู่ระหว่าง ${min} ถึง ${max}`
                : min !== undefined
                ? `ค่าต้องไม่น้อยกว่า ${min}`
                : `ค่าต้องไม่มากกว่า ${max}`
              }
            />
          )}
        </Validator>
      )}
    </NumberBox>
  );
}

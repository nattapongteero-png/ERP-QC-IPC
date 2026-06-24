"use client";

import TextArea from 'devextreme-react/text-area';
import Validator, { RequiredRule, StringLengthRule } from 'devextreme-react/validator';
import type { TextAreaTypes } from 'devextreme-react/text-area';

export interface DxTextAreaProps {
  /** Current value */
  value?: string;
  /** Default value (uncontrolled) */
  defaultValue?: string;
  /** Change handler */
  onValueChange?: (value: string) => void;
  /** Change handler with event */
  onValueChanged?: (e: TextAreaTypes.ValueChangedEvent) => void;
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
  /** Minimum length */
  minLength?: number;
  /** Maximum length */
  maxLength?: number;
  /** Number of rows */
  height?: number | string;
  /** Width */
  width?: number | string;
  /** Auto resize height */
  autoResizeEnabled?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Name attribute */
  name?: string;
  /** Validation group name */
  validationGroup?: string;
  /** Spellcheck */
  spellcheck?: boolean;
  /** Native input attributes (e.g. autoComplete, name, data-* for autofill suppression) */
  inputAttr?: Record<string, unknown>;
}

/**
 * DevExtreme TextArea wrapper for multi-line text input
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DxTextArea
 *   label="หมายเหตุ"
 *   value={notes}
 *   onValueChange={setNotes}
 *   placeholder="กรอกหมายเหตุ..."
 * />
 *
 * // With validation
 * <DxTextArea
 *   label="คำอธิบาย"
 *   value={description}
 *   onValueChange={setDescription}
 *   required
 *   minLength={10}
 *   maxLength={500}
 *   height={120}
 * />
 *
 * // Auto resize
 * <DxTextArea
 *   label="รายละเอียด"
 *   value={details}
 *   onValueChange={setDetails}
 *   autoResizeEnabled
 * />
 * ```
 */
export function DxTextArea({
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
  minLength,
  maxLength,
  height = 90,
  width,
  autoResizeEnabled = false,
  className,
  name,
  validationGroup,
  spellcheck = false,
  inputAttr,
}: DxTextAreaProps) {
  const hasValidation = required || minLength !== undefined || maxLength !== undefined;

  const handleValueChanged = (e: TextAreaTypes.ValueChangedEvent) => {
    if (onValueChange) {
      onValueChange(e.value || '');
    }
    if (onValueChanged) {
      onValueChanged(e);
    }
  };

  return (
    <TextArea
      value={value}
      defaultValue={defaultValue}
      onValueChanged={handleValueChanged}
      placeholder={placeholder}
      label={label}
      labelMode={labelMode}
      disabled={disabled}
      readOnly={readOnly}
      maxLength={maxLength}
      height={height}
      width={width}
      autoResizeEnabled={autoResizeEnabled}
      className={className}
      name={name}
      spellcheck={spellcheck}
      inputAttr={inputAttr}
    >
      {hasValidation && (
        <Validator validationGroup={validationGroup}>
          {required && (
            <RequiredRule message={requiredMessage} />
          )}
          {(minLength !== undefined || maxLength !== undefined) && (
            <StringLengthRule
              min={minLength}
              max={maxLength}
              message={minLength !== undefined && maxLength !== undefined
                ? `ความยาวต้องอยู่ระหว่าง ${minLength} ถึง ${maxLength} ตัวอักษร`
                : minLength !== undefined
                ? `ความยาวต้องไม่น้อยกว่า ${minLength} ตัวอักษร`
                : `ความยาวต้องไม่เกิน ${maxLength} ตัวอักษร`
              }
            />
          )}
        </Validator>
      )}
    </TextArea>
  );
}

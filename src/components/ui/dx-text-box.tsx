"use client";

import TextBox from 'devextreme-react/text-box';
import Validator, { CustomRule, RequiredRule } from 'devextreme-react/validator';
import type { TextBoxTypes } from 'devextreme-react/text-box';
import type { z } from 'zod';
import { zodValidationCallback } from '@/lib/validation/zod-devextreme-adapter';

export type DxTextBoxMode = 'text' | 'password' | 'email' | 'tel' | 'url' | 'search';

export interface DxTextBoxProps {
  /** Current value */
  value?: string;
  /** Default value (uncontrolled) */
  defaultValue?: string;
  /** Change handler */
  onValueChange?: (value: string) => void;
  /** Change handler with event */
  onValueChanged?: (e: TextBoxTypes.ValueChangedEvent) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Label text */
  label?: string;
  /** Label mode */
  labelMode?: 'static' | 'floating' | 'hidden' | 'outside';
  /** Input mode */
  mode?: DxTextBoxMode;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Required field */
  required?: boolean;
  /** Required message */
  requiredMessage?: string;
  /** Zod schema for validation */
  zodSchema?: z.ZodTypeAny;
  /** Custom validation message for Zod */
  zodMessage?: string;
  /** Max length */
  maxLength?: number;
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
  /** Auto focus */
  autoFocus?: boolean;
  /** Tab index */
  tabIndex?: number;
  /** Validation group name */
  validationGroup?: string;
  /** On key down handler */
  onKeyDown?: (e: TextBoxTypes.KeyDownEvent) => void;
  /** On enter key handler */
  onEnterKey?: (e: TextBoxTypes.EnterKeyEvent) => void;
}

/**
 * DevExtreme TextBox wrapper with Zod validation support
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DxTextBox
 *   label="ชื่อ"
 *   value={name}
 *   onValueChange={setName}
 *   required
 *   requiredMessage="กรุณากรอกชื่อ"
 * />
 *
 * // With Zod validation
 * <DxTextBox
 *   label="อีเมล"
 *   mode="email"
 *   value={email}
 *   onValueChange={setEmail}
 *   zodSchema={z.string().email()}
 *   zodMessage="อีเมลไม่ถูกต้อง"
 * />
 * ```
 */
export function DxTextBox({
  value,
  defaultValue,
  onValueChange,
  onValueChanged,
  placeholder,
  label,
  labelMode = 'floating',
  mode = 'text',
  disabled = false,
  readOnly = false,
  required = false,
  requiredMessage = 'จำเป็นต้องกรอกข้อมูลนี้',
  zodSchema,
  zodMessage,
  maxLength,
  width,
  height,
  showClearButton = false,
  className,
  name,
  autoFocus = false,
  tabIndex,
  validationGroup,
  onKeyDown,
  onEnterKey,
}: DxTextBoxProps) {
  const hasValidation = required || zodSchema;

  const handleValueChanged = (e: TextBoxTypes.ValueChangedEvent) => {
    if (onValueChange) {
      onValueChange(e.value || '');
    }
    if (onValueChanged) {
      onValueChanged(e);
    }
  };

  return (
    <TextBox
      value={value}
      defaultValue={defaultValue}
      onValueChanged={handleValueChanged}
      valueChangeEvent="input"
      placeholder={placeholder}
      label={label}
      labelMode={labelMode}
      mode={mode}
      disabled={disabled}
      readOnly={readOnly}
      maxLength={maxLength}
      width={width}
      height={height}
      showClearButton={showClearButton}
      className={className}
      name={name}
      focusStateEnabled={!disabled}
      inputAttr={{ autoFocus, tabIndex }}
      onKeyDown={onKeyDown}
      onEnterKey={onEnterKey}
    >
      {hasValidation && (
        <Validator validationGroup={validationGroup}>
          {required && (
            <RequiredRule message={requiredMessage} />
          )}
          {zodSchema && (
            <CustomRule
              validationCallback={zodValidationCallback(zodSchema, { customMessage: zodMessage })}
            />
          )}
        </Validator>
      )}
    </TextBox>
  );
}

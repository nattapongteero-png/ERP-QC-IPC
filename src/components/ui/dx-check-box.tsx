"use client";

import CheckBox from 'devextreme-react/check-box';
import type { CheckBoxTypes } from 'devextreme-react/check-box';

export interface DxCheckBoxProps {
  /** Current value */
  value?: boolean;
  /** Default value (uncontrolled) */
  defaultValue?: boolean;
  /** Change handler */
  onValueChange?: (value: boolean) => void;
  /** Change handler with event */
  onValueChanged?: (e: CheckBoxTypes.ValueChangedEvent) => void;
  /** Text label */
  text?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Width */
  width?: number | string;
  /** Additional CSS class */
  className?: string;
  /** Name attribute */
  name?: string;
  /** Element ID */
  elementAttr?: Record<string, string>;
  /** Icon size (small, medium, large) */
  iconSize?: 'small' | 'medium' | 'large';
}

/**
 * DevExtreme CheckBox wrapper
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DxCheckBox
 *   text="ผู้ขายที่ได้รับการอนุมัติ"
 *   value={isApproved}
 *   onValueChange={setIsApproved}
 * />
 * ```
 */
export function DxCheckBox({
  value,
  defaultValue,
  onValueChange,
  onValueChanged,
  text,
  disabled = false,
  readOnly = false,
  width,
  className,
  name,
  elementAttr,
  iconSize = 'medium',
}: DxCheckBoxProps) {
  const handleValueChanged = (e: CheckBoxTypes.ValueChangedEvent) => {
    if (onValueChange) {
      onValueChange(e.value ?? false);
    }
    if (onValueChanged) {
      onValueChanged(e);
    }
  };

  // Map icon size to DevExtreme dimensions
  const sizeMap = {
    small: 18,
    medium: 22,
    large: 26,
  };

  return (
    <CheckBox
      value={value}
      defaultValue={defaultValue}
      onValueChanged={handleValueChanged}
      text={text}
      disabled={disabled}
      readOnly={readOnly}
      width={width}
      className={className}
      name={name}
      elementAttr={elementAttr}
      iconSize={sizeMap[iconSize]}
    />
  );
}

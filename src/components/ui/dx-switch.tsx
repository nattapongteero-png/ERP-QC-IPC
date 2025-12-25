"use client";

import Switch from 'devextreme-react/switch';
import type { SwitchTypes } from 'devextreme-react/switch';

export interface DxSwitchProps {
  /** Current value */
  value?: boolean;
  /** Default value (uncontrolled) */
  defaultValue?: boolean;
  /** Change handler */
  onValueChange?: (value: boolean) => void;
  /** Change handler with event */
  onValueChanged?: (e: SwitchTypes.ValueChangedEvent) => void;
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
  /** Hint */
  hint?: string;
  /** Switched on text */
  switchedOnText?: string;
  /** Switched off text */
  switchedOffText?: string;
}

/**
 * DevExtreme Switch wrapper
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DxSwitch
 *   value={isActive}
 *   onValueChange={setIsActive}
 * />
 * ```
 */
export function DxSwitch({
  value,
  defaultValue,
  onValueChange,
  onValueChanged,
  disabled = false,
  readOnly = false,
  width,
  className,
  name,
  elementAttr,
  hint,
  switchedOnText = 'ON',
  switchedOffText = 'OFF',
}: DxSwitchProps) {
  const handleValueChanged = (e: SwitchTypes.ValueChangedEvent) => {
    if (onValueChange) {
      onValueChange(e.value ?? false);
    }
    if (onValueChanged) {
      onValueChanged(e);
    }
  };

  return (
    <Switch
      value={value}
      defaultValue={defaultValue}
      onValueChanged={handleValueChanged}
      disabled={disabled}
      readOnly={readOnly}
      width={width}
      className={className}
      name={name}
      elementAttr={elementAttr}
      hint={hint}
      switchedOnText={switchedOnText}
      switchedOffText={switchedOffText}
    />
  );
}

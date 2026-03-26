"use client";

import { useCallback, useRef } from 'react';
import SelectBox from 'devextreme-react/select-box';
import Validator, { RequiredRule } from 'devextreme-react/validator';
import type { SelectBoxTypes } from 'devextreme-react/select-box';

export interface DxSelectBoxOption<T = string> {
  /** Value field (use 'value' by default, or any field with valueExpr) */
  value?: T;
  /** Optional id field (use with valueExpr="id") */
  id?: T extends number ? number : T;
  /** Display text (use 'label' or 'text' based on displayExpr) */
  label?: string;
  /** Display text (alternative to label, use with displayExpr="text") */
  text?: string;
  disabled?: boolean;
  /** Allow additional properties for custom displayExpr/valueExpr */
  [key: string]: unknown;
}

export interface DxSelectBoxProps<T = string> {
  /** Current value */
  value?: T;
  /** Default value (uncontrolled) */
  defaultValue?: T;
  /** Change handler */
  onValueChange?: (value: T) => void;
  /** Change handler with event */
  onValueChanged?: (e: SelectBoxTypes.ValueChangedEvent) => void;
  /** Options array */
  items?: DxSelectBoxOption<T>[];
  /** Data source (alternative to items) - accepts any array of objects */
  dataSource?: T[] | DxSelectBoxOption<T>[] | Record<string, unknown>[];
  /** Display expression (field name for display text) */
  displayExpr?: string | ((item: DxSelectBoxOption<T> | Record<string, unknown>) => string);
  /** Value expression (field name for value) */
  valueExpr?: string;
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
  /** Enable search filtering */
  searchEnabled?: boolean;
  /** Search expression (field to search in) */
  searchExpr?: string | string[];
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
  /** Dropdown width */
  dropDownOptions?: { width?: number | string; height?: number | string };
  /** No data text */
  noDataText?: string;
}

/**
 * DevExtreme SelectBox wrapper with search filtering
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DxSelectBox
 *   label="ประเภท"
 *   value={type}
 *   onValueChange={setType}
 *   items={[
 *     { value: 'raw', label: 'วัตถุดิบ' },
 *     { value: 'finished', label: 'สินค้าสำเร็จรูป' },
 *   ]}
 *   required
 * />
 *
 * // With search
 * <DxSelectBox
 *   label="ลูกค้า"
 *   value={customerId}
 *   onValueChange={setCustomerId}
 *   dataSource={customers}
 *   displayExpr="name"
 *   valueExpr="id"
 *   searchEnabled
 *   searchExpr="name"
 * />
 * ```
 */
export function DxSelectBox<T = string>({
  value,
  defaultValue,
  onValueChange,
  onValueChanged,
  items,
  dataSource,
  displayExpr = 'label',
  valueExpr = 'value',
  placeholder,
  label,
  labelMode = 'floating',
  disabled = false,
  readOnly = false,
  required = false,
  requiredMessage = 'กรุณาเลือกข้อมูล',
  searchEnabled = false,
  searchExpr,
  showClearButton = false,
  width,
  height,
  className,
  name,
  validationGroup,
  dropDownOptions,
  noDataText = 'ไม่พบข้อมูล',
}: DxSelectBoxProps<T>) {
  // Use refs to store latest callbacks to avoid infinite re-renders
  // DevExtreme-React can trigger re-renders when callback references change
  const onValueChangeRef = useRef(onValueChange);
  const onValueChangedRef = useRef(onValueChanged);
  onValueChangeRef.current = onValueChange;
  onValueChangedRef.current = onValueChanged;

  // Stable callback that never changes reference
  // Only trigger if value actually changed to prevent infinite loops
  const handleValueChanged = useCallback((e: SelectBoxTypes.ValueChangedEvent) => {
    if (e.previousValue === e.value) return;
    if (onValueChangeRef.current) {
      onValueChangeRef.current(e.value as T);
    }
    if (onValueChangedRef.current) {
      onValueChangedRef.current(e);
    }
  }, []);

  // Render dropdown popup at document.body to avoid positioning issues
  // caused by CSS transform on ancestor elements (e.g., mobile sidebar translateX)
  const mergedDropDownOptions = {
    container: 'body' as const,
    ...dropDownOptions,
  };

  return (
    <SelectBox
      value={value}
      defaultValue={defaultValue}
      onValueChanged={handleValueChanged}
      items={items}
      dataSource={dataSource}
      displayExpr={displayExpr}
      valueExpr={valueExpr}
      placeholder={placeholder}
      label={label}
      labelMode={labelMode}
      disabled={disabled}
      readOnly={readOnly}
      searchEnabled={searchEnabled}
      searchExpr={searchExpr || (typeof displayExpr === 'string' ? displayExpr : undefined)}
      showClearButton={showClearButton}
      width={width}
      height={height}
      className={className}
      name={name}
      dropDownOptions={mergedDropDownOptions}
      noDataText={noDataText}
    >
      {required && (
        <Validator validationGroup={validationGroup}>
          <RequiredRule message={requiredMessage} />
        </Validator>
      )}
    </SelectBox>
  );
}

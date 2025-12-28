"use client";

import TagBox from 'devextreme-react/tag-box';
import type { TagBoxTypes } from 'devextreme-react/tag-box';

export interface DxTagBoxProps {
  /** Data source for items */
  dataSource?: unknown[];
  /** Items (alias for dataSource) */
  items?: unknown[];
  /** Display expression */
  displayExpr?: string | ((item: unknown) => string);
  /** Value expression */
  valueExpr?: string;
  /** Current value */
  value?: unknown[];
  /** Default value */
  defaultValue?: unknown[];
  /** Value change handler */
  onValueChanged?: (e: TagBoxTypes.ValueChangedEvent) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Label text */
  label?: string;
  /** Label mode */
  labelMode?: 'static' | 'floating' | 'hidden' | 'outside';
  /** Show clear button */
  showClearButton?: boolean;
  /** Searchable */
  searchEnabled?: boolean;
  /** Search expression */
  searchExpr?: string | string[];
  /** Disabled state */
  disabled?: boolean;
  /** Read only state */
  readOnly?: boolean;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Max displayed tags */
  maxDisplayedTags?: number;
  /** Show selection controls */
  showSelectionControls?: boolean;
  /** Apply value mode */
  applyValueMode?: 'instantly' | 'useButtons';
  /** Custom CSS class */
  className?: string;
  /** Styling mode */
  stylingMode?: 'outlined' | 'underlined' | 'filled';
  /** Accept custom value */
  acceptCustomValue?: boolean;
  /** Is required */
  isRequired?: boolean;
}

/**
 * DevExtreme TagBox wrapper for multi-select dropdowns
 *
 * @example
 * ```tsx
 * <DxTagBox
 *   dataSource={items}
 *   displayExpr="name"
 *   valueExpr="id"
 *   value={selectedIds}
 *   onValueChanged={(e) => setSelectedIds(e.value)}
 *   placeholder="Select items..."
 *   searchEnabled
 *   showClearButton
 * />
 * ```
 */
export function DxTagBox({
  dataSource,
  items,
  displayExpr,
  valueExpr,
  value,
  defaultValue,
  onValueChanged,
  placeholder,
  label,
  labelMode = 'floating',
  showClearButton = true,
  searchEnabled = true,
  searchExpr,
  disabled = false,
  readOnly = false,
  width,
  height,
  maxDisplayedTags,
  showSelectionControls = true,
  applyValueMode = 'instantly',
  className,
  stylingMode = 'outlined',
  acceptCustomValue = false,
  isRequired = false,
}: DxTagBoxProps) {
  return (
    <TagBox
      dataSource={dataSource || items}
      displayExpr={displayExpr}
      valueExpr={valueExpr}
      value={value}
      defaultValue={defaultValue}
      onValueChanged={onValueChanged}
      placeholder={placeholder}
      label={label}
      labelMode={labelMode}
      showClearButton={showClearButton}
      searchEnabled={searchEnabled}
      searchExpr={searchExpr}
      disabled={disabled}
      readOnly={readOnly}
      width={width}
      height={height}
      maxDisplayedTags={maxDisplayedTags}
      showSelectionControls={showSelectionControls}
      applyValueMode={applyValueMode}
      className={className}
      stylingMode={stylingMode}
      acceptCustomValue={acceptCustomValue}
      isValid={!isRequired || (value && value.length > 0)}
    />
  );
}

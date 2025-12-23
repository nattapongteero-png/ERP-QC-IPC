"use client";

import * as React from 'react';
import TagBox from 'devextreme-react/tag-box';
import type { TagBoxTypes } from 'devextreme-react/tag-box';
import { forwardRef, useMemo, type ForwardedRef } from 'react';

export interface DxTagBoxProps {
  /** Data source for the tag box */
  dataSource?: unknown[];
  /** Items array (alternative to dataSource) */
  items?: unknown[];
  /** Display expression (field name or function) */
  displayExpr?: string | ((item: unknown) => string);
  /** Value expression (field name) */
  valueExpr?: string;
  /** Current value (array of selected values) */
  value?: unknown[];
  /** Default value */
  defaultValue?: unknown[];
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Show clear button */
  showClearButton?: boolean;
  /** Search enabled */
  searchEnabled?: boolean;
  /** Search expression */
  searchExpr?: string | string[];
  /** Search mode */
  searchMode?: 'contains' | 'startswith';
  /** Search timeout */
  searchTimeout?: number;
  /** Accept custom values */
  acceptCustomValue?: boolean;
  /** Max displayed tags */
  maxDisplayedTags?: number;
  /** Show multiTag only mode */
  showMultiTagOnly?: boolean;
  /** Show selection controls (select all / deselect all) */
  showSelectionControls?: boolean;
  /** How values are applied */
  applyValueMode?: 'instantly' | 'useButtons';
  /** On value changed callback */
  onValueChanged?: (e: TagBoxTypes.ValueChangedEvent) => void;
  /** On selection changed callback */
  onSelectionChanged?: (e: TagBoxTypes.SelectionChangedEvent) => void;
  /** Custom item render */
  itemRender?: (item: unknown) => React.ReactNode;
  /** Tag render */
  tagRender?: (tagData: { value: unknown; text: string }) => React.ReactNode;
  /** CSS class */
  className?: string;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Label */
  label?: string;
  /** Label mode */
  labelMode?: 'static' | 'floating' | 'hidden' | 'outside';
  /** Styling mode */
  stylingMode?: 'outlined' | 'underlined' | 'filled';
  /** Is valid */
  isValid?: boolean;
  /** Validation error message */
  validationError?: { message: string };
  /** Validation status */
  validationStatus?: 'valid' | 'invalid' | 'pending';
}

export const DxTagBox = forwardRef(
  function DxTagBox(props: DxTagBoxProps, ref: ForwardedRef<unknown>) {
    const {
      dataSource,
      items,
      displayExpr,
      valueExpr,
      value,
      defaultValue,
      placeholder,
      disabled,
      readOnly,
      showClearButton = true,
      searchEnabled = true,
      searchExpr,
      searchMode,
      searchTimeout,
      acceptCustomValue,
      maxDisplayedTags,
      showMultiTagOnly,
      showSelectionControls,
      applyValueMode,
      onValueChanged,
      onSelectionChanged,
      itemRender,
      tagRender,
      className,
      width,
      height,
      label,
      labelMode,
      stylingMode = 'outlined',
      isValid,
      validationError,
      validationStatus,
    } = props;

    // Filter out items with null/undefined display values to prevent DevExtreme errors
    // when searchEnabled is true (it calls toLowerCase() on displayExpr field)
    const safeDataSource = useMemo(() => {
      const source = dataSource || items;
      if (!source || !Array.isArray(source)) {
        return source;
      }
      if (!displayExpr || typeof displayExpr !== 'string') {
        // Still filter out null/undefined items
        return source.filter((item) => item != null);
      }
      return source.filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const value = (item as Record<string, unknown>)[displayExpr];
        return value != null && value !== '';
      });
    }, [dataSource, items, displayExpr]);

    return (
      <TagBox
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={ref as any}
        dataSource={safeDataSource}
        displayExpr={displayExpr}
        valueExpr={valueExpr}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        showClearButton={showClearButton}
        searchEnabled={searchEnabled}
        searchExpr={searchExpr}
        searchMode={searchMode}
        searchTimeout={searchTimeout}
        acceptCustomValue={acceptCustomValue}
        maxDisplayedTags={maxDisplayedTags}
        showMultiTagOnly={showMultiTagOnly}
        showSelectionControls={showSelectionControls}
        applyValueMode={applyValueMode}
        onValueChanged={onValueChanged}
        onSelectionChanged={onSelectionChanged}
        itemRender={itemRender}
        tagRender={tagRender}
        className={className}
        width={width}
        height={height}
        label={label}
        labelMode={labelMode}
        stylingMode={stylingMode}
        isValid={isValid}
        validationError={validationError}
        validationStatus={validationStatus}
      />
    );
  }
);

export default DxTagBox;

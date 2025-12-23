"use client";

import * as React from 'react';
import TagBox from 'devextreme-react/tag-box';
import type { TagBoxTypes } from 'devextreme-react/tag-box';
import { forwardRef, useMemo, useCallback, useRef, type ForwardedRef } from 'react';

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
      searchMode = 'contains',  // Default to prevent toLowerCase on undefined
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

    // Sanitize DataSource - ensure display field is never null/undefined
    // This prevents toLowerCase() errors in DevExtreme's internal code
    const safeDataSource = useMemo(() => {
      const source = dataSource || items;
      if (!source || !Array.isArray(source)) return [];

      // If displayExpr is not a string, we can't easily sanitize field values
      if (typeof displayExpr !== 'string') return source;

      const fieldName = displayExpr;
      return source.map((item) => {
        if (!item || typeof item !== 'object') return item;

        const val = (item as Record<string, unknown>)[fieldName];
        // If null/undefined, force it to empty string so .toLowerCase() won't crash
        if (val === null || val === undefined) {
          return { ...item, [fieldName]: '' };
        }
        // Ensure it's a string
        if (typeof val !== 'string') {
          return { ...item, [fieldName]: String(val) };
        }
        return item;
      });
    }, [dataSource, items, displayExpr]);

    // Sanitize Value - filter out null/undefined values
    const safeValue = useMemo(() => {
      if (!Array.isArray(value)) return value;
      return value.filter((v) => v !== null && v !== undefined);
    }, [value]);

    // Compute searchExpr - use displayExpr if not explicitly provided
    const finalSearchExpr = searchExpr || (typeof displayExpr === 'string' ? displayExpr : undefined);

    // Use refs to store latest callbacks to avoid infinite re-renders
    // DevExtreme-React can trigger re-renders when callback references change
    const onValueChangedRef = useRef(onValueChanged);
    const onSelectionChangedRef = useRef(onSelectionChanged);
    onValueChangedRef.current = onValueChanged;
    onSelectionChangedRef.current = onSelectionChanged;

    // Helper to compare arrays for equality
    const arraysEqual = useCallback((a: unknown[] | undefined, b: unknown[] | undefined): boolean => {
      if (a === b) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      return a.every((val, idx) => val === b[idx]);
    }, []);

    // Stable callback that never changes reference
    // Only trigger if value actually changed to prevent infinite loops
    const handleValueChanged = useCallback((e: TagBoxTypes.ValueChangedEvent) => {
      // Compare arrays to prevent unnecessary updates
      if (arraysEqual(e.previousValue as unknown[], e.value as unknown[])) return;
      if (onValueChangedRef.current) {
        onValueChangedRef.current(e);
      }
    }, [arraysEqual]);

    // Stable callback for selection changed
    const handleSelectionChanged = useCallback((e: TagBoxTypes.SelectionChangedEvent) => {
      if (onSelectionChangedRef.current) {
        onSelectionChangedRef.current(e);
      }
    }, []);

    return (
      <TagBox
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={ref as any}
        dataSource={safeDataSource}
        displayExpr={displayExpr}
        valueExpr={valueExpr}
        value={safeValue}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        showClearButton={showClearButton}
        searchEnabled={searchEnabled}
        searchExpr={finalSearchExpr}
        searchMode={searchMode}
        searchTimeout={searchTimeout}
        acceptCustomValue={acceptCustomValue}
        maxDisplayedTags={maxDisplayedTags}
        showMultiTagOnly={showMultiTagOnly}
        showSelectionControls={showSelectionControls}
        applyValueMode={applyValueMode}
        onValueChanged={handleValueChanged}
        onSelectionChanged={handleSelectionChanged}
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

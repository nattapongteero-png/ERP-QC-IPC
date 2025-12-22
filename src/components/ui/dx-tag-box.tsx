"use client";

import TagBox from 'devextreme-react/tag-box';
import type { TagBoxTypes } from 'devextreme-react/tag-box';
import { forwardRef } from 'react';

export interface DxTagBoxProps {
  /** Data source for the tag box */
  dataSource?: unknown[];
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

export const DxTagBox = forwardRef<TagBox, DxTagBoxProps>(
  function DxTagBox(props, ref) {
    const {
      dataSource,
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

    return (
      <TagBox
        ref={ref}
        dataSource={dataSource}
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

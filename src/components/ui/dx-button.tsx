"use client";

import Button from 'devextreme-react/button';
import type { ButtonTypes } from 'devextreme-react/button';

export type DxButtonType = 'default' | 'success' | 'normal' | 'danger';
export type DxButtonStylingMode = 'contained' | 'outlined' | 'text';

export interface DxButtonProps {
  /** Button text */
  text?: string;
  /** Button icon (DevExtreme icon name or custom) */
  icon?: string;
  /** Button type determines color */
  type?: DxButtonType;
  /** Styling mode */
  stylingMode?: DxButtonStylingMode;
  /** Disabled state */
  disabled?: boolean;
  /** Click handler */
  onClick?: (e: ButtonTypes.ClickEvent) => void;
  /** Submit type for forms */
  useSubmitBehavior?: boolean;
  /** Loading state - shows spinner */
  loading?: boolean;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Additional CSS class */
  className?: string;
  /** ARIA label for accessibility */
  accessKey?: string;
  /** Tab index */
  tabIndex?: number;
  /** Hint on hover */
  hint?: string;
  /** Children (for icon buttons) */
  children?: React.ReactNode;
}

/**
 * DevExtreme Button wrapper with consistent styling
 *
 * @example
 * ```tsx
 * <DxButton text="บันทึก" type="success" onClick={handleSave} />
 * <DxButton text="ยกเลิก" stylingMode="outlined" onClick={handleCancel} />
 * <DxButton icon="trash" type="danger" hint="ลบ" />
 * ```
 */
export function DxButton({
  text,
  icon,
  type = 'default',
  stylingMode = 'contained',
  disabled = false,
  onClick,
  useSubmitBehavior = false,
  loading = false,
  width,
  height,
  className,
  accessKey,
  tabIndex,
  hint,
  children,
}: DxButtonProps) {
  return (
    <Button
      text={text}
      icon={loading ? 'spindown' : icon}
      type={type}
      stylingMode={stylingMode}
      disabled={disabled || loading}
      onClick={onClick}
      useSubmitBehavior={useSubmitBehavior}
      width={width}
      height={height}
      className={className}
      accessKey={accessKey}
      tabIndex={tabIndex}
      hint={hint}
    >
      {children}
    </Button>
  );
}

// Convenience exports for common button variants
export function DxPrimaryButton(props: Omit<DxButtonProps, 'type' | 'stylingMode'>) {
  return <DxButton {...props} type="success" stylingMode="contained" />;
}

export function DxSecondaryButton(props: Omit<DxButtonProps, 'type' | 'stylingMode'>) {
  return <DxButton {...props} type="normal" stylingMode="outlined" />;
}

export function DxDangerButton(props: Omit<DxButtonProps, 'type' | 'stylingMode'>) {
  return <DxButton {...props} type="danger" stylingMode="contained" />;
}

export function DxTextButton(props: Omit<DxButtonProps, 'stylingMode'>) {
  return <DxButton {...props} stylingMode="text" />;
}

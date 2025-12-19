"use client";

import Popup from 'devextreme-react/popup';
import type { PopupTypes } from 'devextreme-react/popup';

export interface DxPopupProps {
  /** Visibility state */
  visible: boolean;
  /** Visibility change handler */
  onVisibleChange?: (visible: boolean) => void;
  /** Hiding event handler (alias for onVisibleChange(false)) */
  onHiding?: () => void;
  /** Hidden event handler */
  onHidden?: (e: PopupTypes.HiddenEvent) => void;
  /** Shown event handler */
  onShown?: (e: PopupTypes.ShownEvent) => void;
  /** Title text */
  title?: string;
  /** Title render function */
  titleRender?: () => React.ReactNode;
  /** Show title */
  showTitle?: boolean;
  /** Show close button */
  showCloseButton?: boolean;
  /** Close on outside click */
  closeOnOutsideClick?: boolean;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Max width */
  maxWidth?: number | string;
  /** Max height */
  maxHeight?: number | string;
  /** Min width */
  minWidth?: number | string;
  /** Min height */
  minHeight?: number | string;
  /** Draggable */
  dragEnabled?: boolean;
  /** Resizable */
  resizeEnabled?: boolean;
  /** Full screen */
  fullScreen?: boolean;
  /** Animation config */
  animation?: PopupTypes.Properties['animation'];
  /** Position config */
  position?: PopupTypes.Properties['position'];
  /** Shading (overlay) */
  shading?: boolean;
  /** Shading color */
  shadingColor?: string;
  /** Container to render popup in */
  container?: string | Element;
  /** Wrapper attributes */
  wrapperAttr?: Record<string, string>;
  /** Additional CSS class */
  className?: string;
  /** Content */
  children: React.ReactNode;
  /** Toolbar items */
  toolbarItems?: Array<{
    widget?: 'dxButton';
    location?: 'before' | 'after';
    toolbar?: 'top' | 'bottom';
    options?: {
      text?: string;
      icon?: string;
      type?: 'default' | 'success' | 'danger' | 'normal';
      stylingMode?: 'contained' | 'outlined' | 'text';
      onClick?: () => void;
    };
  }>;
}

/**
 * DevExtreme Popup wrapper for dialogs and modals
 *
 * @example
 * ```tsx
 * // Basic dialog
 * <DxPopup
 *   visible={isOpen}
 *   onVisibleChange={setIsOpen}
 *   title="ยืนยันการลบ"
 *   width={400}
 *   height="auto"
 * >
 *   <p>คุณต้องการลบรายการนี้หรือไม่?</p>
 * </DxPopup>
 *
 * // With toolbar buttons
 * <DxPopup
 *   visible={isOpen}
 *   onVisibleChange={setIsOpen}
 *   title="แก้ไขข้อมูล"
 *   width={600}
 *   toolbarItems={[
 *     { widget: 'dxButton', toolbar: 'bottom', location: 'after', options: { text: 'บันทึก', type: 'success', onClick: handleSave } },
 *     { widget: 'dxButton', toolbar: 'bottom', location: 'after', options: { text: 'ยกเลิก', onClick: handleClose } },
 *   ]}
 * >
 *   <form>...</form>
 * </DxPopup>
 * ```
 */
export function DxPopup({
  visible,
  onVisibleChange,
  onHiding,
  onHidden,
  onShown,
  title,
  titleRender,
  showTitle = true,
  showCloseButton = true,
  closeOnOutsideClick = false,
  width = 'auto',
  height = 'auto',
  maxWidth,
  maxHeight,
  minWidth = 300,
  minHeight,
  dragEnabled = true,
  resizeEnabled = false,
  fullScreen = false,
  animation,
  position = 'center' as PopupTypes.Properties['position'],
  shading = true,
  shadingColor = 'rgba(0, 0, 0, 0.5)',
  container,
  wrapperAttr,
  className,
  children,
  toolbarItems,
}: DxPopupProps) {
  const handleHiding = () => {
    if (onHiding) {
      onHiding();
    }
    if (onVisibleChange) {
      onVisibleChange(false);
    }
  };

  return (
    <Popup
      visible={visible}
      onHiding={handleHiding}
      onHidden={onHidden}
      onShown={onShown}
      title={title}
      titleRender={titleRender}
      showTitle={showTitle}
      showCloseButton={showCloseButton}
      hideOnOutsideClick={closeOnOutsideClick}
      width={width}
      height={height}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      minWidth={minWidth}
      minHeight={minHeight}
      dragEnabled={dragEnabled}
      resizeEnabled={resizeEnabled}
      fullScreen={fullScreen}
      animation={animation}
      position={position}
      shading={shading}
      shadingColor={shadingColor}
      container={container}
      wrapperAttr={{ ...wrapperAttr, className }}
      toolbarItems={toolbarItems}
    >
      {children}
    </Popup>
  );
}

// Convenience component for confirm dialogs
export interface DxConfirmDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'success' | 'danger';
}

export function DxConfirmDialog({
  visible,
  onConfirm,
  onCancel,
  title = 'ยืนยัน',
  message,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  confirmType = 'success',
}: DxConfirmDialogProps) {
  return (
    <DxPopup
      visible={visible}
      onVisibleChange={(v) => !v && onCancel()}
      title={title}
      width={400}
      height="auto"
      toolbarItems={[
        {
          widget: 'dxButton',
          toolbar: 'bottom',
          location: 'after',
          options: {
            text: confirmText,
            type: confirmType,
            onClick: onConfirm,
          },
        },
        {
          widget: 'dxButton',
          toolbar: 'bottom',
          location: 'after',
          options: {
            text: cancelText,
            stylingMode: 'outlined',
            onClick: onCancel,
          },
        },
      ]}
    >
      <div style={{ padding: 16 }}>
        <p>{message}</p>
      </div>
    </DxPopup>
  );
}

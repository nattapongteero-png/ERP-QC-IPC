"use client";

import Popup from 'devextreme-react/popup';
import type { PopupTypes } from 'devextreme-react/popup';
import { useMemo } from 'react';
import { useMobile } from '@/hooks/use-mobile';

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
  /** Auto fullscreen on mobile devices (< 768px) */
  fullScreenOnMobile?: boolean;
  /** Auto fullscreen on tablet devices (768px - 1024px) */
  fullScreenOnTablet?: boolean;
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
  /** Content (omit when using contentRender) */
  children?: React.ReactNode;
  /** Render function for the popup body. Preferred over `children` for dynamic
   *  content: DevExtreme portals the returned node into the popup's content
   *  area, avoiding the "blank popup / content leaks onto the page" issue that
   *  plain children can hit (see DevExpress T1064246). */
  contentRender?: () => React.ReactNode;
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
  /** Defer rendering of children until first show. Default true. Set
   *  false when children read state set in the same call as visible=true
   *  (deferred rendering can cache the empty initial render). */
  deferRendering?: boolean;
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
  // Default cap so a tall dialog never grows past the viewport and hides its
  // bottom toolbar (save/cancel) off-screen — DevExtreme then scrolls the
  // content area and keeps the toolbar pinned. Callers can override.
  maxHeight = '90vh',
  minWidth = 300,
  minHeight,
  dragEnabled = true,
  resizeEnabled = false,
  fullScreen = false,
  fullScreenOnMobile = true,
  fullScreenOnTablet = false,
  animation,
  position = 'center' as PopupTypes.Properties['position'],
  shading = true,
  shadingColor = 'rgba(0, 0, 0, 0.5)',
  container,
  wrapperAttr,
  className,
  children,
  contentRender,
  toolbarItems,
  deferRendering = true,
}: DxPopupProps) {
  // Detect device type for responsive fullscreen
  const { isMobile, isTablet } = useMobile();

  // Calculate effective fullscreen mode
  const effectiveFullScreen = useMemo(() => {
    if (fullScreen) return true;
    if (isMobile && fullScreenOnMobile) return true;
    if (isTablet && fullScreenOnTablet) return true;
    return false;
  }, [fullScreen, isMobile, isTablet, fullScreenOnMobile, fullScreenOnTablet]);

  // Disable dragging on mobile when fullscreen
  const effectiveDragEnabled = useMemo(() => {
    if (effectiveFullScreen) return false;
    return dragEnabled;
  }, [effectiveFullScreen, dragEnabled]);

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
      dragEnabled={effectiveDragEnabled}
      resizeEnabled={resizeEnabled}
      fullScreen={effectiveFullScreen}
      animation={animation}
      position={position}
      shading={shading}
      shadingColor={shadingColor}
      container={container}
      wrapperAttr={{ ...wrapperAttr, className }}
      toolbarItems={toolbarItems}
      deferRendering={deferRendering}
      contentRender={contentRender}
    >
      {contentRender ? undefined : children}
    </Popup>
  );
}

// Convenience component for confirm dialogs
export interface DxConfirmDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'success' | 'danger';
  children?: React.ReactNode;
  width?: number;
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
  children,
  width = 400,
}: DxConfirmDialogProps) {
  return (
    <DxPopup
      visible={visible}
      onVisibleChange={(v) => !v && onCancel()}
      title={title}
      width={width}
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
      {children ? children : (
        <div style={{ padding: 16 }}>
          <p>{message}</p>
        </div>
      )}
    </DxPopup>
  );
}

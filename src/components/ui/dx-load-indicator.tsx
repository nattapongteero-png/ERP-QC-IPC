"use client";

import LoadIndicator from 'devextreme-react/load-indicator';
import LoadPanel from 'devextreme-react/load-panel';
import type { LoadPanelTypes } from 'devextreme-react/load-panel';

export interface DxLoadIndicatorProps {
  /** Show indicator */
  visible?: boolean;
  /** Indicator height */
  height?: number | string;
  /** Indicator width */
  width?: number | string;
  /** Additional CSS class */
  className?: string;
}

/**
 * DevExtreme LoadIndicator wrapper for inline loading states
 *
 * @example
 * ```tsx
 * // Inline loading
 * {isLoading && <DxLoadIndicator />}
 *
 * // Custom size
 * <DxLoadIndicator height={32} width={32} />
 * ```
 */
export function DxLoadIndicator({
  visible = true,
  height = 40,
  width = 40,
  className,
}: DxLoadIndicatorProps) {
  if (!visible) return null;

  return (
    <LoadIndicator
      visible
      height={height}
      width={width}
      className={className}
    />
  );
}

export interface DxLoadPanelProps {
  /** Show panel */
  visible: boolean;
  /** Message text */
  message?: string;
  /** Show indicator */
  showIndicator?: boolean;
  /** Show pane (background) */
  showPane?: boolean;
  /** Shading (overlay) */
  shading?: boolean;
  /** Shading color */
  shadingColor?: string;
  /** Container element to cover */
  container?: string | Element;
  /** Position config */
  position?: LoadPanelTypes.Properties['position'];
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Additional CSS class */
  className?: string;
}

/**
 * DevExtreme LoadPanel wrapper for overlay loading states
 *
 * @example
 * ```tsx
 * // Full page loading
 * <DxLoadPanel
 *   visible={isLoading}
 *   message="กำลังโหลดข้อมูล..."
 * />
 *
 * // Container-specific loading
 * <div id="data-container">
 *   <DxLoadPanel
 *     visible={isLoading}
 *     container="#data-container"
 *     message="กำลังบันทึก..."
 *   />
 *   <DataContent />
 * </div>
 * ```
 */
export function DxLoadPanel({
  visible,
  message = 'กำลังโหลด...',
  showIndicator = true,
  showPane = true,
  shading = true,
  shadingColor = 'rgba(0, 0, 0, 0.4)',
  container,
  position = 'center' as LoadPanelTypes.Properties['position'],
  width = 'auto',
  height = 'auto',
  className,
}: DxLoadPanelProps) {
  return (
    <LoadPanel
      visible={visible}
      message={message}
      showIndicator={showIndicator}
      showPane={showPane}
      shading={shading}
      shadingColor={shadingColor}
      container={container}
      position={position}
      width={width}
      height={height}
      className={className}
    />
  );
}

/**
 * Skeleton loading component using DevExtreme styles
 */
export interface DxSkeletonProps {
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Border radius */
  borderRadius?: number | string;
  /** Additional CSS class */
  className?: string;
  /** Variant */
  variant?: 'text' | 'rectangular' | 'circular';
}

export function DxSkeleton({
  width = '100%',
  height = 20,
  borderRadius,
  className,
  variant = 'rectangular',
}: DxSkeletonProps) {
  const getRadius = () => {
    if (borderRadius !== undefined) return borderRadius;
    switch (variant) {
      case 'circular': return '50%';
      case 'text': return 4;
      default: return 8;
    }
  };

  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: getRadius(),
        backgroundColor: '#e0e0e0',
        animation: 'dx-skeleton-pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

// Add skeleton animation to globals.css if not present
// @keyframes dx-skeleton-pulse {
//   0%, 100% { opacity: 1; }
//   50% { opacity: 0.5; }
// }

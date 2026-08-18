import * as React from 'react';

/**
 * Demo stand-in for DxPopup (DevExtreme Popup).
 *
 * DevExtreme is licensed per developer and must not be redistributed, so the
 * public demo draws the dialog itself. It keeps the parts the screens depend
 * on: a shaded overlay, a title bar with a close button, and a content box
 * that never grows past the viewport.
 */
export function DxPopup({
  visible,
  onHiding,
  title,
  width = 'min(560px, 95vw)',
  children,
  wrapperAttr,
}: {
  visible: boolean;
  onHiding?: () => void;
  onHidden?: () => void;
  title?: string;
  width?: number | string;
  height?: number | string;
  showCloseButton?: boolean;
  children?: React.ReactNode;
  wrapperAttr?: { class?: string };
  [key: string]: unknown;
}) {
  if (!visible) return null;
  return (
    <div
      className={`dx-overlay-wrapper fixed inset-0 z-[1000] flex items-center justify-center bg-black/30 p-4 ${wrapperAttr?.class ?? ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onHiding?.(); }}
    >
      <div
        className="dx-overlay-content flex max-h-[90vh] flex-col overflow-clip bg-white shadow-[0_8px_40px_6px_rgba(0,0,0,0.4)]"
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
      >
        <div className="dx-popup-title flex shrink-0 items-center justify-between border-b border-[#f1f3f5] px-6 py-4">
          <span className="text-base font-semibold text-slate-900">{title}</span>
          <button
            type="button"
            aria-label="close"
            onClick={() => onHiding?.()}
            className="text-slate-400 transition hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        {/* p-6 mirrors the real popup's content padding, which the dialog
            body cancels with -m-6 exactly as it does in the app. */}
        <div className="dx-popup-content p-6">{children}</div>
      </div>
    </div>
  );
}

export default DxPopup;

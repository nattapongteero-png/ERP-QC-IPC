'use client';

/**
 * eBMR In-App Print Preview Overlay
 *
 * Presents the existing #ebmr-content (the exact DOM that prints) as A4 pages
 * on a gray backdrop, with zoom + print controls. This gives users a reliable
 * WYSIWYG preview of the BMR document before printing, instead of relying on
 * the browser's print-preview pager (which is confusing and can't be styled).
 *
 * How it works: on mount we add the `ebmr-preview-active` class to <body>.
 * The print CSS in globals.css uses that class to reuse the @media print
 * layout on screen (white A4 page, document-style tables, no app chrome),
 * scoped under .ebmr-preview-active so it never affects normal screen view.
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, ZoomIn, ZoomOut, Printer } from 'lucide-react';

export function EbmrPrintPreviewOverlay({ onClose }: { onClose: () => void }) {
  const t = useTranslations('production');
  const [zoom, setZoom] = useState(1);

  // Toggle the body class that activates the on-screen A4 preview styling.
  useEffect(() => {
    document.body.classList.add('ebmr-preview-active');
    // Lock background scroll while the overlay is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('ebmr-preview-active');
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Drive the on-screen A4 zoom through a CSS variable read by #ebmr-content
  // (see .ebmr-preview-active #ebmr-content in globals.css).
  useEffect(() => {
    document.body.style.setProperty('--ebmr-preview-zoom', String(zoom));
    return () => {
      document.body.style.removeProperty('--ebmr-preview-zoom');
    };
  }, [zoom]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrint = useCallback(() => {
    // Print uses the real @media print rules; the preview class is irrelevant
    // during the actual print pass.
    window.print();
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)));

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col bg-gray-700/90 no-print"
      data-testid="ebmr-preview-overlay"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white shadow-lg">
        <span className="font-medium text-sm">
          {t('workOrderDetail.ebmr.previewTitle')}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-2 rounded hover:bg-white/10 transition-colors"
            title={t('workOrderDetail.ebmr.zoomOut')}
            data-testid="ebmr-preview-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs tabular-nums w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-2 rounded hover:bg-white/10 transition-colors"
            title={t('workOrderDetail.ebmr.zoomIn')}
            data-testid="ebmr-preview-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-sm font-medium transition-colors"
            data-testid="ebmr-preview-print"
          >
            <Printer className="w-4 h-4" />
            {t('workOrderDetail.header.printEbmr')}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-white/10 transition-colors ml-1"
            title={t('workOrderDetail.ebmr.closePreview')}
            data-testid="ebmr-preview-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* The real #ebmr-content (rendered elsewhere in this page) is pulled
          into view here by the .ebmr-preview-active CSS: it's fixed-positioned
          as a white A4 sheet, centered, scrolling under this toolbar. The
          backdrop below is just the gray fill behind that sheet. */}
      <div className="flex-1 ebmr-preview-scroll" aria-hidden />
    </div>
  );
}

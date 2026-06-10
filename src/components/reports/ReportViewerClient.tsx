'use client';

/**
 * ReportViewerClient
 *
 * Client-only wrapper around DevExpress's `DxReportViewer` widget.
 * The viewer talks to the .NET reporting backend via the
 * Next.js API proxy at `/api/reporting/...`, which forwards to the
 * `DXXRDV` route exposed by `CustomViewerController`.
 *
 * Mirrors the pattern in `ReportDesignerClient.tsx` so both designer
 * and viewer share host config, error handling, and styling.
 */

import { useCallback } from 'react';

// DevExpress Report Viewer styles.
// NOTE: do NOT import a second full DevExtreme base theme (e.g. dx.light.css)
// here — the app already loads dx.material.teal.light globally via
// devextreme-provider. Two full themes define the same .dx-overlay-content /
// .dx-popup / .dx-list rules and fight in the bundled CSS, collapsing dropdown
// option lists on Chrome (the "lookup shows no options" bug). Only the
// analytics/reporting-specific CSS belongs here.
import '@devexpress/analytics-core/dist/css/dx-analytics.common.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.light.css';
import 'devexpress-reporting/dist/css/dx-webdocumentviewer.css';

import DxReportViewer, {
  RequestOptions,
  Callbacks,
} from 'devexpress-reporting-react/dx-report-viewer';

interface ReportViewerClientProps {
  reportUrl: string;
  backendUrl: string;
  parameters?: Record<string, unknown>;
  onReady?: () => void;
  onError?: (error: string) => void;
  onExport?: (format: string) => void;
  onPrint?: () => void;
}

export default function ReportViewerClient({
  reportUrl,
  backendUrl,
  parameters,
  onReady,
  onError,
  onExport,
  onPrint,
}: ReportViewerClientProps) {
  const handleBeforeRender = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (args: any) => {
      console.log('[ReportViewer] BeforeRender — preparing widget');

      // If parameters were passed in, push them into the report so the
      // backend resolves them on first render. Falls back silently if the
      // viewer model API isn't available yet.
      try {
        if (parameters && Object.keys(parameters).length > 0) {
          const reportPreview = args?.reportPreview;
          const previewModel = reportPreview ?? args?.PreviewModel ?? null;
          if (previewModel?.parametersModel?.set) {
            for (const [k, v] of Object.entries(parameters)) {
              try {
                previewModel.parametersModel.set(k, v);
              } catch (e) {
                console.warn(`[ReportViewer] failed to set param ${k}`, e);
              }
            }
          }
        }
      } catch (e) {
        console.warn('[ReportViewer] BeforeRender param push failed', e);
      }
    },
    [parameters]
  );

  const handleDocumentReady = useCallback(() => {
    console.log('[ReportViewer] DocumentReady — first page rendered');
    onReady?.();
  }, [onReady]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOnExport = useCallback((args: any) => {
    const format = (args?.format ?? args?.Format ?? 'unknown') as string;
    console.log('[ReportViewer] OnExport →', format);
    onExport?.(format);
  }, [onExport]);

  // Note: DxReportViewer's Callbacks type does not expose a dedicated OnPrint
  // event — print clicks fire from the toolbar host shell. We keep onPrint in
  // props so the parent can wire its own button if needed.
  void onPrint;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOnServerError = useCallback((args: any) => {
    const message = args?.Error?.message
      || args?.error?.message
      || 'Reporting backend returned an error';
    console.error('[ReportViewer] OnServerError', args);
    onError?.(message);
  }, [onError]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 600 }}>
      <DxReportViewer reportUrl={reportUrl} height="100%" width="100%">
        <RequestOptions host={backendUrl} invokeAction="DXXRDV" />
        <Callbacks
          BeforeRender={handleBeforeRender}
          DocumentReady={handleDocumentReady}
          OnExport={handleOnExport}
          OnServerError={handleOnServerError}
        />
      </DxReportViewer>
    </div>
  );
}

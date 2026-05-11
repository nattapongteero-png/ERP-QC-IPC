'use client';

/**
 * ReportViewer
 *
 * Wraps the dynamic-loaded `ReportViewerClient` (DevExpress
 * `DxReportViewer`) inside an error/loading shell. The actual viewer
 * renders inside a client-only chunk so DevExpress's browser-only code
 * never reaches the SSR pass.
 *
 * Backend wiring: requests go through the Next.js API proxy at
 * `/api/reporting/...`, which forwards to the .NET reporting backend's
 * `DXXRDV` route (see `CustomViewerController` on the server).
 */

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const ReportViewerClient = dynamic(
  () => import('./ReportViewerClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[600px] bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Loading Report Viewer...</p>
        </div>
      </div>
    ),
  }
);

export type ExportFormat = 'pdf' | 'xlsx' | 'docx' | 'csv' | 'rtf' | 'html' | 'image';

interface ReportViewerProps {
  reportUrl: string;
  parameters?: Record<string, unknown>;
  onReportReady?: () => void;
  onError?: (error: Error) => void;
  onExport?: (format: ExportFormat) => void;
  onPrint?: () => void;
  className?: string;
  showToolbar?: boolean;
  enableExport?: boolean;
  enablePrint?: boolean;
  exportFormats?: ExportFormat[];
}

interface ViewerState {
  isMounted: boolean;
  isBackendReady: boolean;
  error: string | null;
}

export default function ReportViewer({
  reportUrl,
  parameters,
  onReportReady,
  onError,
  onExport,
  onPrint,
  className = '',
}: ReportViewerProps) {
  const [state, setState] = useState<ViewerState>({
    isMounted: false,
    isBackendReady: false,
    error: null,
  });

  // Backend URL must end with a trailing slash so DevExpress concatenates
  // the action segment cleanly (`/api/reporting/` + `DXXRDV/...`).
  const BACKEND_URL = '/api/reporting/';

  useEffect(() => {
    setState((prev) => ({ ...prev, isMounted: true }));
  }, []);

  // Backend health check before mounting the viewer widget — same pattern
  // as `ReportDesigner` to give a fast, friendly error if the .NET service
  // is down rather than letting DevExpress surface a cryptic widget error.
  useEffect(() => {
    if (!state.isMounted) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}health`);
        if (!response.ok) {
          throw new Error('Reporting backend is not available');
        }
        if (!cancelled) {
          setState((prev) => ({ ...prev, isBackendReady: true }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect to reporting backend';
        if (!cancelled) {
          setState((prev) => ({ ...prev, error: message }));
          onError?.(new Error(message));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.isMounted, onError]);

  const handleClientReady = useCallback(() => {
    onReportReady?.();
  }, [onReportReady]);

  const handleClientError = useCallback(
    (message: string) => {
      setState((prev) => ({ ...prev, error: message }));
      onError?.(new Error(message));
    },
    [onError]
  );

  const handleClientExport = useCallback(
    (format: string) => {
      onExport?.(format as ExportFormat);
    },
    [onExport]
  );

  if (!state.isMounted) {
    return (
      <div className={`flex items-center justify-center min-h-[600px] bg-gray-50 ${className}`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Initializing Report Viewer...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`flex items-center justify-center min-h-[600px] bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="text-center p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-700 text-lg font-medium mb-2">Report Viewer Error</div>
          <div className="text-red-600 text-sm mb-4">{state.error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!state.isBackendReady) {
    return (
      <div className={`flex items-center justify-center min-h-[600px] bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Connecting to reporting backend...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}
      style={{ minHeight: 600 }}
    >
      <div style={{ height: 'calc(100vh - 200px)', minHeight: 600 }}>
        <ReportViewerClient
          reportUrl={reportUrl}
          backendUrl={BACKEND_URL}
          parameters={parameters}
          onReady={handleClientReady}
          onError={handleClientError}
          onExport={handleClientExport}
          onPrint={onPrint}
        />
      </div>
    </div>
  );
}

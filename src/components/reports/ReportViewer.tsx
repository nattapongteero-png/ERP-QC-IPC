'use client';

import { useEffect, useRef, useState } from 'react';

// Import DevExpress Report Viewer styles
import 'devextreme/dist/css/dx.light.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.common.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.light.css';
import 'devexpress-reporting/dist/css/dx-webdocumentviewer.css';

// Note: The actual DevExpress Report Viewer component requires the DevExpress package
// This is a wrapper that will work once DevExpress.AspNetCore.Reporting is configured
// For now, we provide a placeholder that shows the configuration

interface ReportViewerProps {
  reportUrl: string;
  parameters?: Record<string, unknown>;
  onReportReady?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

export default function ReportViewer({
  reportUrl,
  parameters,
  onReportReady,
  onError,
  className = '',
}: ReportViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_REPORTING_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    const initializeViewer = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if backend is available
        const response = await fetch(`${BACKEND_URL}/health`);
        if (!response.ok) {
          throw new Error('Reporting backend is not available');
        }

        // In a full implementation with DevExpress packages:
        // import { DxReportViewer } from 'devexpress-reporting-react/dx-report-viewer';
        // The component would render the actual DevExpress viewer here

        // For now, we'll show a placeholder until DevExpress is configured
        setIsLoading(false);
        onReportReady?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load report';
        setError(errorMessage);
        setIsLoading(false);
        onError?.(new Error(errorMessage));
      }
    };

    initializeViewer();
  }, [reportUrl, BACKEND_URL, onReportReady, onError]);

  if (error) {
    return (
      <div className={`flex items-center justify-center min-h-[400px] bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="text-center p-6">
          <div className="text-red-600 text-lg font-medium mb-2">Report Error</div>
          <div className="text-red-500 text-sm">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center min-h-[400px] bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading report...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`report-viewer-container min-h-[600px] bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}
    >
      {/* DevExpress Report Viewer Placeholder */}
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">DevExpress Report Viewer</h3>
          <p className="text-blue-600 text-sm mb-4">
            The report viewer requires DevExpress NuGet packages to be configured on the backend.
          </p>
          <div className="bg-white rounded p-4 text-sm font-mono">
            <div className="text-gray-600 mb-2">Report Configuration:</div>
            <div className="text-gray-800">
              <div><span className="text-blue-600">reportUrl:</span> {reportUrl}</div>
              <div><span className="text-blue-600">backendUrl:</span> {BACKEND_URL}</div>
              {parameters && (
                <div><span className="text-blue-600">parameters:</span> {JSON.stringify(parameters)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Viewer Toolbar Mockup */}
        <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
                First
              </button>
              <button className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">Page 1 of 1</span>
              <button className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
                Next
              </button>
              <button className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
                Last
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm" disabled>
                <option>100%</option>
                <option>75%</option>
                <option>50%</option>
                <option>Fit Page</option>
                <option>Fit Width</option>
              </select>
              <button className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
                Search
              </button>
              <button className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50" disabled>
                Print
              </button>
              <button className="px-3 py-1.5 bg-blue-600 text-white border border-blue-600 rounded text-sm hover:bg-blue-700 disabled:opacity-50" disabled>
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Report Content Placeholder */}
        <div className="border border-gray-200 rounded-lg bg-gray-50 min-h-[400px] flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium mb-2">Report Preview Area</p>
            <p className="text-sm">
              Configure DevExpress NuGet packages to enable report rendering
            </p>
          </div>
        </div>
      </div>

      {/* Responsive Styles */}
      <style jsx>{`
        .report-viewer-container {
          width: 100%;
        }

        @media (max-width: 768px) {
          .report-viewer-container {
            min-height: 400px;
          }
        }

        @media (max-width: 480px) {
          .report-viewer-container {
            min-height: 300px;
          }
        }
      `}</style>
    </div>
  );
}

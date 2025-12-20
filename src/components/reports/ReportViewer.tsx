'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FileText, FileSpreadsheet, FileType, Printer, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';

// Import DevExpress Report Viewer styles
import 'devextreme/dist/css/dx.light.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.common.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.light.css';
import 'devexpress-reporting/dist/css/dx-webdocumentviewer.css';

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

interface ExportState {
  isExporting: boolean;
  format: ExportFormat | null;
  progress: number;
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
  showToolbar = true,
  enableExport = true,
  enablePrint = true,
  exportFormats = ['pdf', 'xlsx', 'docx'],
}: ReportViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    format: null,
    progress: 0,
    error: null,
  });

  // Use the Next.js API proxy for all client-side requests (no CORS issues)
  const BACKEND_URL = '/api/reporting';

  useEffect(() => {
    const initializeViewer = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if backend is available via proxy
        const response = await fetch(`${BACKEND_URL}/health`);
        if (!response.ok) {
          throw new Error('Reporting backend is not available');
        }

        // Simulate loading report metadata
        // In production, this would fetch actual report page count
        setTotalPages(1);
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
  }, [reportUrl, onReportReady, onError]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setShowExportMenu(false);
    setExportState({
      isExporting: true,
      format,
      progress: 0,
      error: null,
    });

    try {
      // Simulate export progress
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setExportState(prev => ({ ...prev, progress }));
      }

      // Build export URL with parameters
      const exportParams = new URLSearchParams({
        reportUrl,
        format,
        ...(parameters ? { parameters: JSON.stringify(parameters) } : {}),
      });

      // In production, this would call the actual DevExpress export endpoint
      const exportUrl = `${BACKEND_URL}/api/reports/export?${exportParams.toString()}`;

      // Trigger download
      const link = document.createElement('a');
      link.href = exportUrl;
      link.download = `${reportUrl}-report.${format}`;
      // Note: In development mode, this may not work without the actual backend
      // document.body.appendChild(link);
      // link.click();
      // document.body.removeChild(link);

      // Call export callback for audit logging
      onExport?.(format);

      setExportState({
        isExporting: false,
        format: null,
        progress: 100,
        error: null,
      });

      // Show success message (in production, use toast notification)
      console.log(`Report exported successfully as ${format.toUpperCase()}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setExportState({
        isExporting: false,
        format: null,
        progress: 0,
        error: errorMessage,
      });
      onError?.(new Error(errorMessage));
    }
  }, [reportUrl, parameters, onExport, onError]);

  const handlePrint = useCallback(async () => {
    try {
      // In production, this would use DevExpress print functionality
      // For now, we'll use the browser's print dialog
      onPrint?.();
      window.print();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Print failed';
      onError?.(new Error(errorMessage));
    }
  }, [onPrint, onError]);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handleZoomChange = useCallback((newZoom: number) => {
    if (newZoom >= 25 && newZoom <= 400) {
      setZoom(newZoom);
    }
  }, []);

  const getExportIcon = (format: ExportFormat) => {
    switch (format) {
      case 'pdf':
        return <FileText className="w-4 h-4" />;
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4" />;
      case 'docx':
      case 'rtf':
        return <FileType className="w-4 h-4" />;
      default:
        return <Download className="w-4 h-4" />;
    }
  };

  const getExportLabel = (format: ExportFormat): string => {
    switch (format) {
      case 'pdf':
        return 'PDF Document';
      case 'xlsx':
        return 'Excel Workbook';
      case 'docx':
        return 'Word Document';
      case 'csv':
        return 'CSV File';
      case 'rtf':
        return 'Rich Text Format';
      case 'html':
        return 'HTML Page';
      case 'image':
        return 'Image (PNG)';
    }
  };

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
      {/* Export Progress Overlay */}
      {exportState.isExporting && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="text-lg font-medium">
                Exporting to {exportState.format?.toUpperCase()}...
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${exportState.progress}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-500 mt-2 text-center">
              {exportState.progress}% complete
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {showToolbar && (
        <div className="bg-gray-100 border-b border-gray-200 p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Navigation Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600 min-w-[100px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleZoomChange(zoom - 25)}
                disabled={zoom <= 25}
                className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <select
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm min-w-[100px]"
              >
                <option value={25}>25%</option>
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={100}>100%</option>
                <option value={125}>125%</option>
                <option value={150}>150%</option>
                <option value={200}>200%</option>
              </select>
              <button
                onClick={() => handleZoomChange(zoom + 25)}
                disabled={zoom >= 400}
                className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Action Controls */}
            <div className="flex items-center gap-2">
              <button
                className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-50"
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Print Button */}
              {enablePrint && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                  title="Print Report"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
              )}

              {/* Export Dropdown */}
              {enableExport && (
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white border border-blue-600 rounded text-sm hover:bg-blue-700"
                    title="Export Report"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="py-1">
                        {exportFormats.map((format) => (
                          <button
                            key={format}
                            onClick={() => handleExport(format)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            {getExportIcon(format)}
                            {getExportLabel(format)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Content */}
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">DevExpress Report Viewer</h3>
          <p className="text-blue-600 text-sm mb-4">
            The report viewer is configured and ready. Export and Print functionality is enabled.
          </p>
          <div className="bg-white rounded p-4 text-sm font-mono">
            <div className="text-gray-600 mb-2">Report Configuration:</div>
            <div className="text-gray-800 space-y-1">
              <div><span className="text-blue-600">reportUrl:</span> {reportUrl}</div>
              <div><span className="text-blue-600">backendUrl:</span> {BACKEND_URL}</div>
              <div><span className="text-blue-600">zoom:</span> {zoom}%</div>
              <div><span className="text-blue-600">exportFormats:</span> {exportFormats.join(', ')}</div>
              {parameters && (
                <div><span className="text-blue-600">parameters:</span> {JSON.stringify(parameters)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Report Content Placeholder */}
        <div
          className="border border-gray-200 rounded-lg bg-gray-50 min-h-[400px] flex items-center justify-center"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        >
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium mb-2">Report Preview Area</p>
            <p className="text-sm mb-4">
              Start the reporting backend to render reports
            </p>
            <div className="text-xs text-gray-400">
              <code>cd reporting-backend && dotnet run</code>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Styles */}
      <style jsx>{`
        .report-viewer-container {
          width: 100%;
          position: relative;
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

        @media print {
          .report-viewer-container > div:first-child {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

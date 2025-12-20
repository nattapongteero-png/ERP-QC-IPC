'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import ReportViewer, { type ExportFormat } from '@/components/reports/ReportViewer';
import ReportViewerSkeleton from '@/components/reports/ReportViewerSkeleton';
import ReportErrorBoundary from '@/components/reports/ReportErrorBoundary';
import { PageHeader } from '@/components/ui/page-header';
import { DxButton } from '@/components/ui/dx-button';
import { ArrowLeft } from 'lucide-react';
import type { ReportTemplate } from '@/types/reports';

interface ReportTemplateResponse {
  success: boolean;
  data?: ReportTemplate;
  error?: string;
}

export default function ReportViewPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportReady, setReportReady] = useState(false);
  const viewStartTime = useRef<number>(0);
  const viewLogged = useRef<boolean>(false);

  const fetchTemplate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch report template metadata from API
      const response = await fetch(`/api/reports/templates/${code}`);
      const data: ReportTemplateResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load report template');
      }

      setTemplate(data.data || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load report';
      setError(errorMessage);
      console.error('Report template fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (code) {
      fetchTemplate();
    }
  }, [code, fetchTemplate]);

  // Build report URL for the backend
  const reportUrl = template ? `${code}` : '';

  // Build parameters from query string if any (memoized to avoid dependency issues)
  const reportParameters = useMemo(() => {
    const params: Record<string, unknown> = {};
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.forEach((value, key) => {
        // Try to parse as JSON for complex values
        try {
          params[key] = JSON.parse(value);
        } catch {
          params[key] = value;
        }
      });
    }
    return params;
  }, []);

  // Audit logging helper function
  const logReportAction = useCallback(async (
    action: 'view' | 'export' | 'print',
    status: 'success' | 'error' | 'cancelled',
    exportFormat?: string,
    durationMs?: number,
    errorMessage?: string
  ) => {
    if (!template?.id) return;

    try {
      await fetch('/api/reports/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          action,
          status,
          exportFormat,
          durationMs,
          errorMessage,
          parameters: Object.keys(reportParameters).length > 0 ? reportParameters : undefined,
        }),
      });
    } catch (err) {
      // Log error but don't interrupt user workflow
      console.error('Failed to log report action:', err);
    }
  }, [template?.id, reportParameters]);

  const handleReportReady = useCallback(() => {
    setReportReady(true);
    viewStartTime.current = Date.now();

    // Log view action (only once per page load)
    if (!viewLogged.current && template?.id) {
      viewLogged.current = true;
      logReportAction('view', 'success');
    }
  }, [template?.id, logReportAction]);

  const handleReportError = useCallback((err: Error) => {
    setError(err.message);
    console.error('Report viewer error:', err);

    // Log error if we have a template
    if (template?.id) {
      logReportAction('view', 'error', undefined, undefined, err.message);
    }
  }, [template?.id, logReportAction]);

  const handleExport = useCallback((format: ExportFormat) => {
    const durationMs = viewStartTime.current ? Date.now() - viewStartTime.current : undefined;
    logReportAction('export', 'success', format, durationMs);
    console.log(`Report exported as ${format}`);
  }, [logReportAction]);

  const handlePrint = useCallback(() => {
    const durationMs = viewStartTime.current ? Date.now() - viewStartTime.current : undefined;
    logReportAction('print', 'success', undefined, durationMs);
    console.log('Report printed');
  }, [logReportAction]);

  const handleBack = () => {
    router.push('/reports');
  };

  const handleRetry = () => {
    setError(null);
    setReportReady(false);
    fetchTemplate();
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <PageHeader
            title="Loading Report..."
            description="Please wait while the report is being loaded"
          />
          <ReportViewerSkeleton className="min-h-[600px]" />
        </div>
      </MainLayout>
    );
  }

  if (error && !template) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <PageHeader
            title="Report Error"
            description="Unable to load the requested report"
          />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-red-500\" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800">Report Not Found</h3>
                <p className="text-red-600 mt-1">{error}</p>
                <div className="mt-4 flex gap-3">
                  <DxButton
                    text="Back to Reports"
                    icon="arrowleft"
                    type="normal"
                    stylingMode="outlined"
                    onClick={handleBack}
                  />
                  <DxButton
                    text="Retry"
                    icon="refresh"
                    type="default"
                    onClick={handleRetry}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to reports"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <PageHeader
              title={template?.name || 'Report Viewer'}
              description={template?.description || 'View and export report'}
            />
          </div>
          <div className="flex items-center gap-2">
            {reportReady && (
              <>
                <DxButton
                  text="Print"
                  icon="print"
                  type="normal"
                  stylingMode="outlined"
                  disabled
                  hint="Print functionality available when DevExpress is configured"
                />
                <DxButton
                  text="Export"
                  icon="download"
                  type="default"
                  disabled
                  hint="Export functionality available when DevExpress is configured"
                />
              </>
            )}
          </div>
        </div>

        {/* Report Info Banner */}
        {template && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4 text-sm text-blue-700">
                <span><strong>Code:</strong> {template.code}</span>
                <span><strong>Version:</strong> {template.version}</span>
                <span><strong>Category:</strong> {template.categoryId ? `Category ${template.categoryId}` : 'Uncategorized'}</span>
              </div>
              <div className="text-sm text-blue-600">
                {template.isPublished ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded">
                    Published
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                    Draft
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Report Viewer */}
        <ReportErrorBoundary
          onError={handleReportError}
          fallback={
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-600 mb-4">An error occurred while rendering the report.</p>
              <DxButton
                text="Retry"
                icon="refresh"
                type="default"
                onClick={handleRetry}
              />
            </div>
          }
        >
          <ReportViewer
            reportUrl={reportUrl}
            parameters={Object.keys(reportParameters).length > 0 ? reportParameters : undefined}
            onReportReady={handleReportReady}
            onError={handleReportError}
            onExport={handleExport}
            onPrint={handlePrint}
            enableExport={true}
            enablePrint={true}
            className="min-h-[600px]"
          />
        </ReportErrorBoundary>
      </div>
    </MainLayout>
  );
}

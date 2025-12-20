'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import ReportDesigner, { type ReportSaveData } from '@/components/reports/ReportDesigner';
import { PageHeader } from '@/components/ui/page-header';
import { DxButton } from '@/components/ui/dx-button';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import type { ReportTemplate } from '@/types/reports';

interface ReportTemplateResponse {
  success: boolean;
  data?: ReportTemplate;
  error?: string;
}

export default function ReportDesignPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const isNewReport = code === 'new';

  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(!isNewReport);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designerReady, setDesignerReady] = useState(false);

  const fetchTemplate = useCallback(async () => {
    if (isNewReport) return;

    try {
      setIsLoading(true);
      setError(null);

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
  }, [code, isNewReport]);

  useEffect(() => {
    if (!isNewReport) {
      fetchTemplate();
    }
  }, [isNewReport, fetchTemplate]);

  const handleDesignerReady = useCallback(() => {
    setDesignerReady(true);
  }, []);

  const handleDesignerError = useCallback((err: Error) => {
    setError(err.message);
    console.error('Report designer error:', err);
  }, []);

  const handleSave = useCallback(async (saveData: ReportSaveData) => {
    setIsSaving(true);
    setError(null);

    try {
      const url = isNewReport
        ? '/api/reports/templates'
        : `/api/reports/templates/${code}`;

      const method = isNewReport ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveData.name,
          code: saveData.code,
          definition: saveData.definition,
          version: saveData.version,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save report');
      }

      // Update template with saved data
      if (data.data) {
        setTemplate(data.data);
      }

      // If new report, redirect to the edit page
      if (isNewReport && data.data?.code) {
        router.push(`/reports/design/${data.data.code}`);
      }

      // Show success notification (in production, use toast)
      console.log('Report saved successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save report';
      setError(errorMessage);
      console.error('Report save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [code, isNewReport, router]);

  const handlePreview = useCallback(() => {
    if (template?.code || !isNewReport) {
      // Open preview in new tab
      window.open(`/reports/view/${template?.code || code}`, '_blank');
    }
  }, [template?.code, code, isNewReport]);

  const handleBack = () => {
    router.push('/reports');
  };

  const handleRetry = () => {
    setError(null);
    setDesignerReady(false);
    if (!isNewReport) {
      fetchTemplate();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Loading Report Template...</p>
            <p className="text-gray-400 text-sm mt-2">Please wait while we prepare the designer</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Error state (for template load errors)
  if (error && !designerReady && !isNewReport) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <PageHeader
            title="Report Designer Error"
            description="Unable to load the report template"
          />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800">Template Not Found</h3>
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
      <div className="space-y-4">
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
              title={isNewReport ? 'Create New Report' : `Design: ${template?.name || code}`}
              description={isNewReport ? 'Design a new report template' : 'Edit report template layout and data bindings'}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            {isSaving && (
              <span className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            )}
            {!isNewReport && template && (
              <span className="text-gray-500">Version: {template.version}</span>
            )}
          </div>
        </div>

        {/* Template Info Banner */}
        {!isNewReport && template && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4 text-sm text-blue-700">
                <span><strong>Code:</strong> {template.code}</span>
                <span><strong>Version:</strong> {template.version}</span>
                <span><strong>Category:</strong> {template.categoryId ? `Category ${template.categoryId}` : 'Uncategorized'}</span>
              </div>
              <div className="text-sm">
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

        {/* Error Alert */}
        {error && designerReady && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Report Designer */}
        <ReportDesigner
          reportUrl={isNewReport ? undefined : code}
          onSave={handleSave}
          onPreview={handlePreview}
          onReady={handleDesignerReady}
          onError={handleDesignerError}
          className="min-h-[700px]"
        />
      </div>
    </MainLayout>
  );
}

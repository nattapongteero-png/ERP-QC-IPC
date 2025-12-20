'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { Save, Eye, Loader2, AlertCircle, RotateCcw, X } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import the client-only DevExpress wrapper with no SSR
const ReportDesignerClient = dynamic(
  () => import('./ReportDesignerClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }
);

export interface ReportDesignerProps {
  reportUrl?: string;
  onSave?: (reportData: ReportSaveData) => void;
  onPreview?: () => void;
  onCancel?: () => void;
  onRevert?: () => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
  className?: string;
  showToolbar?: boolean;
  readOnly?: boolean;
}

export interface ReportSaveData {
  name: string;
  code: string;
  definition: string;
  version: number;
}

interface DesignerState {
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  error: string | null;
  isReady: boolean;
  isMounted: boolean;
}

export default function ReportDesigner({
  reportUrl,
  onSave,
  onPreview,
  onCancel,
  onRevert,
  onError,
  onReady,
  className = '',
  showToolbar = true,
  readOnly = false,
}: ReportDesignerProps) {
  const [state, setState] = useState<DesignerState>({
    isLoading: true,
    isSaving: false,
    hasUnsavedChanges: false,
    error: null,
    isReady: false,
    isMounted: false,
  });

  // Use the Next.js API proxy for all client-side requests (no CORS issues)
  // Must have trailing slash for DevExpress URL concatenation
  const BACKEND_URL = '/api/reporting/';

  // Mark as mounted (client-side only)
  useEffect(() => {
    setState(prev => ({ ...prev, isMounted: true }));
  }, []);

  // Check backend availability on mount
  useEffect(() => {
    if (!state.isMounted) return;

    const checkBackend = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/health`);
        if (!response.ok) {
          throw new Error('Reporting backend is not available');
        }
        setState(prev => ({ ...prev, isLoading: false }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect to reporting backend';
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
        onError?.(new Error(errorMessage));
      }
    };
    checkBackend();
  }, [BACKEND_URL, onError, state.isMounted]);

  // Callback handlers for the designer
  const handleReady = useCallback(() => {
    console.log('Report Designer: Ready');
    setState(prev => ({ ...prev, isLoading: false, isReady: true }));
    onReady?.();
  }, [onReady]);

  const handleSaving = useCallback(() => {
    setState(prev => ({ ...prev, isSaving: true }));
  }, []);

  const handleSaved = useCallback(() => {
    setState(prev => ({ ...prev, isSaving: false, hasUnsavedChanges: false }));
    if (onSave) {
      onSave({
        name: reportUrl || 'New Report',
        code: reportUrl || `report-${Date.now()}`,
        definition: '',
        version: 1,
      });
    }
  }, [reportUrl, onSave]);

  const handleDesignerError = useCallback((errorMessage: string) => {
    setState(prev => ({ ...prev, error: errorMessage }));
    onError?.(new Error(errorMessage));
  }, [onError]);

  const handleComponentAdded = useCallback(() => {
    setState(prev => ({ ...prev, hasUnsavedChanges: true }));
  }, []);

  const handlePreview = useCallback(() => {
    onPreview?.();
  }, [onPreview]);

  const handleCancel = useCallback(() => {
    if (state.hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    onCancel?.();
  }, [state.hasUnsavedChanges, onCancel]);

  const handleRevert = useCallback(() => {
    if (!state.hasUnsavedChanges) return;

    const confirmed = window.confirm('Are you sure you want to revert all changes? This cannot be undone.');
    if (!confirmed) return;

    window.location.reload();
  }, [state.hasUnsavedChanges]);

  // Warn about unsaved changes
  useEffect(() => {
    if (!state.isMounted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.hasUnsavedChanges, state.isMounted]);

  // Don't render anything until mounted on client
  if (!state.isMounted) {
    return (
      <div className={`flex items-center justify-center min-h-[600px] bg-gray-50 ${className}`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Initializing Report Designer...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`flex items-center justify-center min-h-[600px] bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="text-center p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-600 text-lg font-medium mb-2">Designer Error</div>
          <div className="text-red-500 text-sm mb-4">{state.error}</div>
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

  return (
    <div className={`flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Custom Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          {/* Left side - Actions */}
          <div className="flex items-center gap-2">
            <button
              disabled={state.isSaving || readOnly || !state.hasUnsavedChanges}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {state.isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </button>
            <button
              onClick={handlePreview}
              disabled={state.isLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
            <div className="h-6 w-px bg-gray-300 mx-2" />
            <button
              onClick={handleRevert}
              disabled={!state.hasUnsavedChanges || readOnly}
              className="p-1.5 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 transition-colors"
              title="Revert to last saved version"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            {onCancel && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-2 py-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                title="Cancel and close"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>

          {/* Right side - Status */}
          <div className="flex items-center gap-3 text-sm text-gray-500">
            {state.hasUnsavedChanges && (
              <span className="text-amber-600">Unsaved changes</span>
            )}
            {reportUrl && (
              <span>Editing: {reportUrl}</span>
            )}
          </div>
        </div>
      )}

      {/* DevExpress Report Designer */}
      <div className="flex-1 relative" style={{ height: 'calc(100vh - 200px)', minHeight: '700px' }}>
        {state.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading Report Designer...</p>
            </div>
          </div>
        )}

        <ReportDesignerClient
          reportUrl={reportUrl || ''}
          backendUrl={BACKEND_URL}
          onReady={handleReady}
          onSaving={handleSaving}
          onSaved={handleSaved}
          onError={handleDesignerError}
          onComponentAdded={handleComponentAdded}
        />
      </div>

      {/* Status Bar */}
      <div className="px-4 py-1.5 bg-gray-100 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>Backend: {BACKEND_URL}</span>
          <span>Report: {reportUrl || 'New'}</span>
        </div>
        <div>
          {state.isLoading ? 'Loading...' : state.isReady ? 'Ready' : 'Initializing...'}
        </div>
      </div>
    </div>
  );
}

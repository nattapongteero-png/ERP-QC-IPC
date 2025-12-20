'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Save, Eye, Undo, Redo, Grid3X3, Type, Table, BarChart3, Image, QrCode, Loader2, AlertCircle, RotateCcw, X } from 'lucide-react';

// Import DevExpress Report Designer styles
import 'devextreme/dist/css/dx.light.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.common.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.light.css';
import 'devexpress-reporting/dist/css/dx-webdocumentviewer.css';
import 'devexpress-reporting/dist/css/dx-reportdesigner.css';

export interface ReportDesignerProps {
  reportUrl?: string; // If provided, load existing report for editing
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
  canUndo: boolean;
  canRedo: boolean;
}

// Toolbox component types available in the designer
const TOOLBOX_COMPONENTS = [
  { id: 'label', name: 'Label', icon: Type, description: 'Text label for static content' },
  { id: 'table', name: 'Table', icon: Table, description: 'Data table with rows and columns' },
  { id: 'chart', name: 'Chart', icon: BarChart3, description: 'Visual chart for data visualization' },
  { id: 'image', name: 'Image', icon: Image, description: 'Static or dynamic image' },
  { id: 'barcode', name: 'Barcode', icon: QrCode, description: 'Barcode or QR code' },
  { id: 'panel', name: 'Panel', icon: Grid3X3, description: 'Container for grouping elements' },
] as const;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DesignerState>({
    isLoading: true,
    isSaving: false,
    hasUnsavedChanges: false,
    error: null,
    canUndo: false,
    canRedo: false,
  });
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // Use the Next.js API proxy for all client-side requests (no CORS issues)
  const BACKEND_URL = '/api/reporting';

  useEffect(() => {
    const initializeDesigner = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Check if backend is available via proxy
        const response = await fetch(`${BACKEND_URL}/health`);
        if (!response.ok) {
          throw new Error('Reporting backend is not available');
        }

        // In production, this would initialize the DevExpress Report Designer
        // For now, we simulate the initialization
        await new Promise(resolve => setTimeout(resolve, 500));

        setState(prev => ({ ...prev, isLoading: false }));
        onReady?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize designer';
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
        onError?.(new Error(errorMessage));
      }
    };

    initializeDesigner();
  }, [reportUrl, BACKEND_URL, onReady, onError]);

  const handleSave = useCallback(async () => {
    if (readOnly) return;

    setState(prev => ({ ...prev, isSaving: true }));

    try {
      // In production, this would serialize the report and call the save callback
      // For now, we simulate the save
      await new Promise(resolve => setTimeout(resolve, 500));

      const saveData: ReportSaveData = {
        name: reportUrl || 'New Report',
        code: reportUrl || `report-${Date.now()}`,
        definition: '<?xml version="1.0" encoding="utf-8"?><XtraReportsLayoutSerializer />',
        version: 1,
      };

      onSave?.(saveData);
      setState(prev => ({ ...prev, isSaving: false, hasUnsavedChanges: false }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save report';
      setState(prev => ({ ...prev, isSaving: false, error: errorMessage }));
      onError?.(new Error(errorMessage));
    }
  }, [reportUrl, readOnly, onSave, onError]);

  const handlePreview = useCallback(() => {
    onPreview?.();
  }, [onPreview]);

  const handleUndo = useCallback(() => {
    // In production, this would call the DevExpress undo command
    console.log('Undo action');
  }, []);

  const handleRedo = useCallback(() => {
    // In production, this would call the DevExpress redo command
    console.log('Redo action');
  }, []);

  const handleToolSelect = useCallback((toolId: string) => {
    setSelectedTool(prev => prev === toolId ? null : toolId);
  }, []);

  const handleDesignerClick = useCallback(() => {
    if (selectedTool) {
      // In production, this would add the selected component to the report
      console.log(`Adding component: ${selectedTool}`);
      setState(prev => ({ ...prev, hasUnsavedChanges: true }));
      setSelectedTool(null);
    }
  }, [selectedTool]);

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

    // In production, this would reload the report from the server
    setState(prev => ({ ...prev, hasUnsavedChanges: false, canUndo: false, canRedo: false }));
    onRevert?.();
    console.log('Reverted to last saved version');
  }, [state.hasUnsavedChanges, onRevert]);

  // Warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.hasUnsavedChanges]);

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
      {/* Designer Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          {/* Left side - Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
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
              onClick={handleUndo}
              disabled={!state.canUndo}
              className="p-1.5 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 transition-colors"
              title="Undo"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!state.canRedo}
              className="p-1.5 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 transition-colors"
              title="Redo"
            >
              <Redo className="h-4 w-4" />
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

      {/* Main Designer Area */}
      <div className="flex flex-1 min-h-[600px]">
        {/* Toolbox Panel */}
        <div className="w-48 bg-gray-50 border-r border-gray-200 p-2 flex-shrink-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
            Components
          </div>
          <div className="space-y-1">
            {TOOLBOX_COMPONENTS.map((tool) => {
              const Icon = tool.icon;
              const isSelected = selectedTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  disabled={readOnly}
                  className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded transition-colors ${
                    isSelected
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'text-gray-700 hover:bg-gray-100'
                  } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={tool.description}
                >
                  <Icon className="h-4 w-4" />
                  {tool.name}
                </button>
              );
            })}
          </div>

          {/* Data Sources Section */}
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              Data Sources
            </div>
            <div className="space-y-1 px-2">
              <div className="text-xs text-gray-500 py-1 border-l-2 border-blue-400 pl-2">
                Inventory Valuation
              </div>
              <div className="text-xs text-gray-500 py-1 border-l-2 border-green-400 pl-2">
                Lot Status
              </div>
              <div className="text-xs text-gray-500 py-1 border-l-2 border-purple-400 pl-2">
                Production Summary
              </div>
            </div>
          </div>
        </div>

        {/* Design Surface */}
        <div
          ref={containerRef}
          className="flex-1 bg-gray-100 p-4 overflow-auto"
          onClick={handleDesignerClick}
        >
          {state.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading Report Designer...</p>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow-lg mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
              {/* Paper representation - A4 size */}
              <div className="p-8">
                {/* Report Header Band */}
                <div className="border-2 border-dashed border-gray-300 p-4 mb-4 bg-gray-50 rounded">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Report Header</div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-700">
                      {reportUrl ? `Report: ${reportUrl}` : 'New Report Template'}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Click on a component in the toolbox, then click here to add it
                    </div>
                  </div>
                </div>

                {/* Detail Band */}
                <div className="border-2 border-dashed border-blue-300 p-4 mb-4 bg-blue-50 rounded min-h-[200px]">
                  <div className="text-xs text-blue-400 uppercase tracking-wide mb-2">Detail Band</div>
                  <div className="text-center text-gray-500 text-sm">
                    {selectedTool ? (
                      <div className="text-blue-600">
                        Click to place: <span className="font-medium">{TOOLBOX_COMPONENTS.find(t => t.id === selectedTool)?.name}</span>
                      </div>
                    ) : (
                      'Select a component from the toolbox to add to this band'
                    )}
                  </div>
                </div>

                {/* Page Footer Band */}
                <div className="border-2 border-dashed border-gray-300 p-4 bg-gray-50 rounded">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Page Footer</div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Page [PageNumber] of [PageCount]</span>
                    <span>Printed: [Date]</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Properties Panel */}
        <div className="w-56 bg-gray-50 border-l border-gray-200 p-2 flex-shrink-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
            Properties
          </div>
          <div className="p-2 text-sm text-gray-500">
            Select an element to view its properties
          </div>

          {/* Quick Properties */}
          <div className="mt-4 px-2 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Page Size</label>
              <select className="w-full text-sm border border-gray-300 rounded px-2 py-1">
                <option value="a4">A4 (210 x 297 mm)</option>
                <option value="letter">Letter (8.5 x 11 in)</option>
                <option value="legal">Legal (8.5 x 14 in)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Orientation</label>
              <select className="w-full text-sm border border-gray-300 rounded px-2 py-1">
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Margins</label>
              <div className="grid grid-cols-2 gap-1">
                <input type="text" placeholder="Top" className="text-xs border border-gray-300 rounded px-2 py-1" defaultValue="20mm" />
                <input type="text" placeholder="Right" className="text-xs border border-gray-300 rounded px-2 py-1" defaultValue="20mm" />
                <input type="text" placeholder="Bottom" className="text-xs border border-gray-300 rounded px-2 py-1" defaultValue="20mm" />
                <input type="text" placeholder="Left" className="text-xs border border-gray-300 rounded px-2 py-1" defaultValue="20mm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-1.5 bg-gray-100 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>Zoom: 100%</span>
          <span>Page: 1 of 1</span>
        </div>
        <div>
          {state.isLoading ? 'Initializing...' : 'Ready'}
        </div>
      </div>
    </div>
  );
}

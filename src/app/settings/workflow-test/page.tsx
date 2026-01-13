/**
 * Workflow Test Page
 *
 * Main page for running end-to-end workflow tests with real-time visualization.
 */

'use client'

import { useState, useCallback } from 'react'
import { Play, Square, RefreshCw, Settings } from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'
import { cn } from '@/lib/utils/cn'
import { WorkflowPathway } from '@/components/workflow-test/WorkflowPathway'
import { WorkflowLogPanel } from '@/components/workflow-test/WorkflowLogPanel'
import { WorkflowStepDetail } from '@/components/workflow-test/WorkflowStepDetail'
import { WorkflowTestConfig } from '@/components/workflow-test/WorkflowTestConfig'
import { useWorkflowTest } from '@/hooks/useWorkflowTest'

export default function WorkflowTestPage() {
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  const {
    session,
    isRunning,
    logs,
    error,
    startTest,
    cancelTest,
    clearSession,
    config,
    setConfig,
  } = useWorkflowTest()

  // Find selected step
  const selectedStep = session?.phases
    .flatMap((p) => p.steps)
    .find((s) => s.id === selectedStepId)

  // Handle step click
  const handleStepClick = useCallback((stepId: number) => {
    setSelectedStepId(stepId)
  }, [])

  // Handle close detail
  const handleCloseDetail = useCallback(() => {
    setSelectedStepId(null)
  }, [])

  // Handle start test
  const handleStartTest = useCallback(() => {
    startTest()
  }, [startTest])

  // Handle cancel test
  const handleCancelTest = useCallback(() => {
    cancelTest()
  }, [cancelTest])

  // Handle clear session
  const handleClearSession = useCallback(() => {
    clearSession()
  }, [clearSession])

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Test</h1>
            <p className="text-gray-500 mt-1">
              End-to-end ERP process testing with real-time visualization
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Config toggle */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={cn(
                'px-3 py-2 rounded-lg border text-sm font-medium',
                'transition-colors flex items-center gap-2',
                showConfig
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Settings className="h-4 w-4" />
              Configure
            </button>

            {/* Clear button - show when test is complete */}
            {(session?.status === 'passed' || session?.status === 'failed' || session?.status === 'cancelled') && (
              <button
                onClick={handleClearSession}
                className={cn(
                  'px-4 py-2 rounded-lg border border-gray-200',
                  'bg-white text-gray-700 hover:bg-gray-50',
                  'transition-colors text-sm font-medium',
                  'flex items-center gap-2'
                )}
              >
                <RefreshCw className="h-4 w-4" />
                Clear
              </button>
            )}

            {/* Cancel button - show when running */}
            {isRunning && (
              <button
                onClick={handleCancelTest}
                className={cn(
                  'px-4 py-2 rounded-lg',
                  'bg-red-50 border border-red-200 text-red-700',
                  'hover:bg-red-100 transition-colors',
                  'text-sm font-medium flex items-center gap-2'
                )}
              >
                <Square className="h-4 w-4" />
                Cancel
              </button>
            )}

            {/* Run button */}
            <button
              onClick={handleStartTest}
              disabled={isRunning}
              className={cn(
                'px-5 py-2.5 rounded-lg',
                'text-white font-medium text-sm',
                'transition-all flex items-center gap-2',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                isRunning
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
              )}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Basic Workflow Test
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Configuration Panel */}
        {showConfig && (
          <WorkflowTestConfig
            config={config}
            onConfigChange={(newConfig) => setConfig(newConfig)}
            disabled={isRunning}
          />
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pathway - 2 columns */}
          <div className="lg:col-span-2">
            <WorkflowPathway
              session={session}
              onStepClick={handleStepClick}
            />
          </div>

          {/* Log Panel - 1 column */}
          <div className="lg:col-span-1">
            <WorkflowLogPanel logs={logs} maxHeight="600px" />
          </div>
        </div>

        {/* Step Detail Dialog */}
        {selectedStepId && (
          <WorkflowStepDetail
            step={selectedStep}
            sessionId={session?.id}
            onClose={handleCloseDetail}
          />
        )}
      </div>
    </MainLayout>
  )
}

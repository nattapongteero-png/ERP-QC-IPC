/**
 * Workflow Test Page
 *
 * Main page for running end-to-end workflow tests with real-time visualization.
 */

'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Play, Square, RefreshCw, Settings, FlaskConical } from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'
import { ResponsivePageHeader } from '@/components/shared'
import { cn } from '@/lib/utils/cn'
import { WorkflowPathway } from '@/components/workflow-test/WorkflowPathway'
import { WorkflowLogPanel } from '@/components/workflow-test/WorkflowLogPanel'
import { WorkflowStepDetail } from '@/components/workflow-test/WorkflowStepDetail'
import { WorkflowTestConfig } from '@/components/workflow-test/WorkflowTestConfig'
import { useWorkflowTest } from '@/hooks/useWorkflowTest'

export default function WorkflowTestPage() {
  const t = useTranslations('settings')
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
      <div className="space-y-4 md:space-y-6 p-4 md:p-0">
        {/* Header */}
        <ResponsivePageHeader
          title={t('workflowTest.title')}
          subtitle={t('workflowTest.subtitle')}
          icon={FlaskConical}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          actions={
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
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
              {t('workflowTest.configure')}
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
                {t('workflowTest.clear')}
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
                {t('workflowTest.cancel')}
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
                  {t('workflowTest.running')}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {t('workflowTest.runBasicTest')}
                </>
              )}
            </button>
            </div>
          }
        />

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

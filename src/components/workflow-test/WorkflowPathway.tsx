/**
 * WorkflowPathway Component
 *
 * Main container showing the visual pathway diagram with all phases and steps.
 */

'use client'

import { memo } from 'react'
import { Route, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { WorkflowPhaseGroup } from './WorkflowPhaseGroup'
import type { WorkflowTestSession } from '@/types/workflow-test'

interface Props {
  session: WorkflowTestSession | null
  onStepClick: (stepId: number) => void
}

const EmptyPathway = memo(function EmptyPathway() {
  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow border border-gray-200',
        'p-12 flex flex-col items-center justify-center text-center'
      )}
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Route className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Workflow Test Ready
      </h3>
      <p className="text-sm text-gray-500 max-w-md">
        Click &quot;Run Basic Workflow Test&quot; to execute 31 automated steps across 8 phases.
        The pathway will show real-time progress as each step completes.
      </p>
    </div>
  )
})

export const WorkflowPathway = memo(function WorkflowPathway({
  session,
  onStepClick,
}: Props) {
  if (!session || session.phases.length === 0) {
    return <EmptyPathway />
  }

  // Calculate summary stats
  const totalSteps = session.phases.reduce((sum, p) => sum + p.stepCount, 0)
  const passedSteps = session.phases.reduce((sum, p) => sum + p.passedCount, 0)
  const failedSteps = session.phases.reduce((sum, p) => sum + p.failedCount, 0)
  const completedSteps = passedSteps + failedSteps

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header with summary */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Route className="h-5 w-5 text-gray-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Workflow Pathway
              </h2>
              <p className="text-sm text-gray-500">
                {session.phases.length} phases, {totalSteps} steps
              </p>
            </div>
          </div>

          {/* Status summary */}
          {session.status !== 'pending' && (
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-green-600 font-medium">{passedSteps}</span>
                <span className="text-gray-400"> / {totalSteps}</span>
                <span className="text-gray-500 ml-1">passed</span>
              </div>

              {failedSteps > 0 && (
                <div className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">{failedSteps} failed</span>
                </div>
              )}

              {session.totalDuration > 0 && (
                <div className="text-sm text-gray-500">
                  {(session.totalDuration / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          )}
        </div>

        {/* Overall progress bar */}
        {completedSteps > 0 && (
          <div className="mt-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div
                  className="bg-green-500 transition-all duration-300"
                  style={{ width: `${(passedSteps / totalSteps) * 100}%` }}
                />
                <div
                  className="bg-red-500 transition-all duration-300"
                  style={{ width: `${(failedSteps / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phases */}
      <div className="p-6 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {session.phases.map((phase, index) => (
            <WorkflowPhaseGroup
              key={phase.id}
              phase={phase}
              isLast={index === session.phases.length - 1}
              currentStepId={session.currentStep}
              onStepClick={onStepClick}
            />
          ))}
        </div>
      </div>

      {/* Completion message */}
      {(session.status === 'passed' || session.status === 'failed') && (
        <div
          className={cn(
            'px-6 py-4 border-t',
            session.status === 'passed'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          )}
        >
          <div className="flex items-center gap-2">
            {session.status === 'passed' ? (
              <>
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-medium text-green-800" data-testid="test-result">
                  Test Passed
                </span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="font-medium text-red-800" data-testid="test-result">
                  Test Failed
                </span>
              </>
            )}
            <span className="text-gray-600 ml-2">
              {passedSteps} of {totalSteps} steps completed successfully
              {session.totalDuration > 0 && ` in ${(session.totalDuration / 1000).toFixed(1)}s`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})

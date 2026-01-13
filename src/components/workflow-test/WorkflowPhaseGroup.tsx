/**
 * WorkflowPhaseGroup Component
 *
 * Groups steps within a phase with header and visual connectors.
 */

'use client'

import { memo } from 'react'
import { ChevronRight, CheckCircle, XCircle, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { WorkflowStepNode } from './WorkflowStepNode'
import type { WorkflowPhase } from '@/types/workflow-test'

interface Props {
  phase: WorkflowPhase
  isLast: boolean
  currentStepId: number | null
  onStepClick: (stepId: number) => void
}

const PhaseStatusIcon = memo(function PhaseStatusIcon({
  status,
}: {
  status: WorkflowPhase['status']
}) {
  switch (status) {
    case 'passed':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    default:
      return <Clock className="h-4 w-4 text-gray-400" />
  }
})

export const WorkflowPhaseGroup = memo(function WorkflowPhaseGroup({
  phase,
  isLast,
  currentStepId,
  onStepClick,
}: Props) {
  const progressPercent =
    phase.stepCount > 0 ? Math.round((phase.completedCount / phase.stepCount) * 100) : 0

  return (
    <div className="flex items-start gap-3">
      {/* Phase card */}
      <div
        className={cn(
          'flex-shrink-0 w-48 rounded-lg border p-4',
          'transition-all duration-200',
          phase.status === 'running' && 'border-blue-300 bg-blue-50 shadow-sm',
          phase.status === 'passed' && 'border-green-300 bg-green-50',
          phase.status === 'failed' && 'border-red-300 bg-red-50',
          phase.status === 'pending' && 'border-gray-200 bg-gray-50'
        )}
      >
        {/* Phase header */}
        <div className="flex items-center gap-2 mb-3">
          <PhaseStatusIcon status={phase.status} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {phase.name}
            </h3>
            <p className="text-xs text-gray-500">
              {phase.stepCount} steps
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{phase.passedCount} passed</span>
            {phase.failedCount > 0 && (
              <span className="text-red-500">{phase.failedCount} failed</span>
            )}
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                phase.failedCount > 0 ? 'bg-red-500' : 'bg-green-500'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Steps grid */}
        <div className="flex flex-wrap gap-2 justify-center">
          {phase.steps.map((step) => (
            <WorkflowStepNode
              key={step.id}
              stepId={step.id}
              stepNumber={step.stepNumber}
              name={step.name}
              status={step.status}
              isActive={step.id === currentStepId}
              activityMessage={step.activityMessage}
              onClick={() => onStepClick(step.id)}
            />
          ))}
        </div>

        {/* Phase duration */}
        {phase.duration > 0 && (
          <div className="mt-3 text-xs text-center text-gray-500">
            {(phase.duration / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      {/* Arrow connector to next phase */}
      {!isLast && (
        <div className="flex-shrink-0 flex items-center self-center h-10">
          <ChevronRight className="h-6 w-6 text-gray-400" />
        </div>
      )}
    </div>
  )
})

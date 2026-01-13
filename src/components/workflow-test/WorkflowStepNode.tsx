/**
 * WorkflowStepNode Component
 *
 * Individual step node in the workflow pathway with status colors and icons.
 */

'use client'

import { memo } from 'react'
import { Check, X, Loader2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { StepStatus } from '@/types/workflow-test'

interface Props {
  stepId: number
  stepNumber: number
  name: string
  status: StepStatus
  isActive: boolean
  activityMessage?: string | null
  onClick: () => void
}

const STATUS_STYLES: Record<StepStatus, { bg: string; text: string; border: string; animation?: string }> = {
  pending: {
    bg: 'bg-gray-200',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
  running: {
    bg: 'bg-blue-500',
    text: 'text-white',
    border: 'border-blue-600',
    animation: 'animate-pulse',
  },
  passed: {
    bg: 'bg-green-500',
    text: 'text-white',
    border: 'border-green-600',
  },
  failed: {
    bg: 'bg-red-500',
    text: 'text-white',
    border: 'border-red-600',
  },
}

const StatusIcon = memo(function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'passed':
      return <Check className="h-4 w-4" />
    case 'failed':
      return <X className="h-4 w-4" />
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin" />
    default:
      return <Circle className="h-3 w-3" />
  }
})

export const WorkflowStepNode = memo(function WorkflowStepNode({
  stepId,
  stepNumber,
  name,
  status,
  isActive,
  activityMessage,
  onClick,
}: Props) {
  const styles = STATUS_STYLES[status]

  return (
    <div className="relative group">
      <button
        data-testid={`step-node-${stepId}`}
        onClick={onClick}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          'border-2 transition-all duration-200',
          'hover:scale-110 hover:shadow-lg cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
          styles.bg,
          styles.text,
          styles.border,
          styles.animation,
          isActive && 'ring-2 ring-blue-400 ring-offset-2'
        )}
        title={name}
      >
        <StatusIcon status={status} />
      </button>

      {/* Step number badge */}
      <span
        className={cn(
          'absolute -bottom-1 -right-1 w-5 h-5 rounded-full',
          'text-[10px] font-bold flex items-center justify-center',
          'bg-white border shadow-sm',
          status === 'running' ? 'border-blue-400 text-blue-600' : 'border-gray-300 text-gray-600'
        )}
      >
        {stepNumber}
      </span>

      {/* Tooltip */}
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 bottom-full mb-2',
          'bg-gray-900 text-white text-xs rounded-lg px-3 py-2',
          'whitespace-nowrap opacity-0 pointer-events-none',
          'group-hover:opacity-100 transition-opacity duration-200',
          'shadow-lg z-10',
          'max-w-[200px] text-center'
        )}
      >
        <div className="font-medium truncate">{name}</div>
        {activityMessage && (
          <div className="text-gray-300 text-[10px] mt-1">{activityMessage}</div>
        )}
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 top-full',
            'border-4 border-transparent border-t-gray-900'
          )}
        />
      </div>
    </div>
  )
})

/**
 * WorkflowLogPanel Component
 *
 * Real-time log display panel showing execution progress.
 */

'use client'

import { memo, useRef, useEffect } from 'react'
import { Terminal, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { LogEntry } from '@/types/workflow-test'

interface Props {
  logs: LogEntry[]
  maxHeight?: string
}

const LogIcon = memo(function LogIcon({ level }: { level: LogEntry['level'] }) {
  switch (level) {
    case 'success':
      return <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
    case 'error':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
    default:
      return <Info className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
  }
})

const LogEntryRow = memo(function LogEntryRow({ log }: { log: LogEntry }) {
  const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div
      className={cn(
        'flex items-start gap-2 py-1 px-2 text-xs font-mono',
        'hover:bg-gray-50 transition-colors',
        log.level === 'error' && 'bg-red-50',
        log.level === 'warning' && 'bg-yellow-50'
      )}
    >
      <span className="text-gray-400 flex-shrink-0">{time}</span>
      <LogIcon level={log.level} />
      <span
        className={cn(
          'flex-1',
          log.level === 'error' && 'text-red-700',
          log.level === 'warning' && 'text-yellow-700',
          log.level === 'success' && 'text-green-700',
          log.level === 'info' && 'text-gray-700'
        )}
      >
        {log.stepId && <span className="text-gray-400">[Step {log.stepId}] </span>}
        {log.phaseId && !log.stepId && (
          <span className="text-gray-400">[Phase {log.phaseId}] </span>
        )}
        {log.message}
      </span>
    </div>
  )
})

export const WorkflowLogPanel = memo(function WorkflowLogPanel({
  logs,
  maxHeight = '400px',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs.length])

  return (
    <div
      data-testid="workflow-log-panel"
      className="bg-white rounded-lg shadow border border-gray-200 flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <Terminal className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-900">Execution Log</h3>
        <span className="text-xs text-gray-400">({logs.length} entries)</span>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight }}
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Terminal className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No log entries yet</p>
            <p className="text-xs text-gray-400">
              Start a test to see execution logs
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log, index) => (
              <LogEntryRow key={index} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Summary footer when test is complete */}
      {logs.length > 0 && logs[logs.length - 1]?.message.includes('Test') && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {logs.filter((l) => l.level === 'success').length} success,{' '}
              {logs.filter((l) => l.level === 'error').length} errors
            </span>
            <span>
              {logs.length} total entries
            </span>
          </div>
        </div>
      )}
    </div>
  )
})

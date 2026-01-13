/**
 * WorkflowStepDetail Component
 *
 * Dialog showing detailed information about a workflow step.
 * For failed steps, provides comprehensive evidence for investigation.
 */

'use client'

import { memo, useState, useCallback } from 'react'
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  Code,
  AlertCircle,
  Copy,
  Check,
  FileText,
  Bug,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { WorkflowTestStep } from '@/types/workflow-test'

interface Props {
  step: WorkflowTestStep | undefined
  sessionId?: string
  onClose: () => void
}

const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: WorkflowTestStep['status']
}) {
  const styles = {
    pending: 'bg-gray-100 text-gray-700 border-gray-200',
    running: 'bg-blue-100 text-blue-700 border-blue-200',
    passed: 'bg-green-100 text-green-700 border-green-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
  }

  const icons = {
    pending: <Clock className="h-3.5 w-3.5" />,
    running: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    passed: <CheckCircle className="h-3.5 w-3.5" />,
    failed: <XCircle className="h-3.5 w-3.5" />,
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'text-xs font-medium border',
        styles[status]
      )}
    >
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
})

/**
 * Generate comprehensive investigation evidence for a failed step
 */
function generateInvestigationEvidence(step: WorkflowTestStep, sessionId?: string): string {
  const separator = '═'.repeat(60)
  const lines: string[] = []

  lines.push(separator)
  lines.push('WORKFLOW TEST FAILURE - INVESTIGATION EVIDENCE')
  lines.push(separator)
  lines.push('')

  // Basic Info
  lines.push('## STEP INFORMATION')
  lines.push(`Step ID: ${step.id}`)
  lines.push(`Step Name: ${step.name}`)
  lines.push(`Description: ${step.description}`)
  lines.push(`Phase ID: ${step.phaseId}`)
  lines.push(`Status: ${step.status.toUpperCase()}`)
  if (sessionId) {
    lines.push(`Session ID: ${sessionId}`)
  }
  lines.push('')

  // Timing Information
  lines.push('## TIMING')
  lines.push(`Started At: ${step.startedAt || 'N/A'}`)
  lines.push(`Completed At: ${step.completedAt || 'N/A'}`)
  lines.push(`Duration: ${step.duration}ms`)
  lines.push('')

  // Error Details (if failed)
  if (step.error) {
    lines.push('## ERROR DETAILS')
    lines.push(`Error Message: ${step.error.message}`)
    lines.push(`Error Code: ${step.error.code || 'N/A'}`)
    lines.push(`Endpoint: ${step.error.endpoint}`)
    lines.push(`HTTP Status: ${step.error.httpStatus}`)
    lines.push(`Timestamp: ${step.error.timestamp}`)
    lines.push('')

    if (step.error.responseBody) {
      lines.push('### Error Response Body:')
      lines.push('```json')
      lines.push(JSON.stringify(step.error.responseBody, null, 2))
      lines.push('```')
      lines.push('')
    }

    if (step.error.stackTrace) {
      lines.push('### Stack Trace:')
      lines.push('```')
      lines.push(step.error.stackTrace)
      lines.push('```')
      lines.push('')
    }
  }

  // API Call Details
  if (step.apiCall) {
    lines.push('## API CALL DETAILS')
    lines.push(`Method: ${step.apiCall.method}`)
    lines.push(`Endpoint: ${step.apiCall.endpoint}`)
    lines.push(`Response Status: ${step.apiCall.responseStatus}`)
    lines.push(`Response Time: ${step.apiCall.responseTime}ms`)
    lines.push('')

    if (step.apiCall.requestHeaders && Object.keys(step.apiCall.requestHeaders).length > 0) {
      lines.push('### Request Headers:')
      lines.push('```json')
      lines.push(JSON.stringify(step.apiCall.requestHeaders, null, 2))
      lines.push('```')
      lines.push('')
    }

    if (step.apiCall.requestPayload) {
      lines.push('### Request Payload:')
      lines.push('```json')
      lines.push(JSON.stringify(step.apiCall.requestPayload, null, 2))
      lines.push('```')
      lines.push('')
    }

    if (step.apiCall.responseBody) {
      lines.push('### Response Body:')
      lines.push('```json')
      lines.push(JSON.stringify(step.apiCall.responseBody, null, 2))
      lines.push('```')
      lines.push('')
    }
  }

  // Created Entities (context for debugging)
  if (step.createdEntities.length > 0) {
    lines.push('## CREATED ENTITIES (Before Failure)')
    step.createdEntities.forEach((entity, idx) => {
      lines.push(`${idx + 1}. ${entity.entityType} #${entity.entityId}: ${entity.entityCode}`)
      lines.push(`   View URL: ${entity.viewUrl}`)
    })
    lines.push('')
  }

  // Raw JSON for programmatic use
  lines.push(separator)
  lines.push('## RAW JSON DATA')
  lines.push(separator)
  lines.push('```json')
  lines.push(JSON.stringify(step, null, 2))
  lines.push('```')
  lines.push('')

  lines.push(separator)
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(separator)

  return lines.join('\n')
}

/**
 * Copy button with feedback
 */
const CopyButton = memo(function CopyButton({
  text,
  label,
  variant = 'default',
}: {
  text: string
  label: string
  variant?: 'default' | 'error'
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        variant === 'error'
          ? copied
            ? 'bg-green-100 text-green-700 focus:ring-green-500'
            : 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500'
          : copied
            ? 'bg-green-100 text-green-700 focus:ring-green-500'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500'
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {label}
        </>
      )}
    </button>
  )
})

export const WorkflowStepDetail = memo(function WorkflowStepDetail({
  step,
  sessionId,
  onClose,
}: Props) {
  if (!step) {
    return null
  }

  const isFailed = step.status === 'failed'
  const investigationEvidence = isFailed ? generateInvestigationEvidence(step, sessionId) : ''

  return (
    <div
      data-testid="step-detail-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative bg-white rounded-xl shadow-2xl',
          'w-full max-w-3xl max-h-[90vh] overflow-hidden',
          'flex flex-col mx-4'
        )}
      >
        {/* Header */}
        <div className={cn(
          'px-6 py-4 border-b flex items-start justify-between',
          isFailed ? 'border-red-200 bg-red-50' : 'border-gray-200'
        )}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm text-gray-500">Step {step.id}</span>
              <StatusBadge status={step.status} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{step.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{step.description}</p>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg text-gray-400 hover:text-gray-600',
              'hover:bg-gray-100 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500'
            )}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Actions - Always show copy buttons */}
          <div className={cn(
            'rounded-lg p-4 border',
            isFailed ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
          )}>
            <div className="flex items-start gap-3">
              {isFailed ? (
                <Bug className="h-5 w-5 text-red-600 mt-0.5" />
              ) : (
                <Copy className="h-5 w-5 text-blue-600 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className={cn(
                  'text-sm font-semibold mb-2',
                  isFailed ? 'text-red-800' : 'text-blue-800'
                )}>
                  {isFailed ? 'Investigation Tools' : 'Copy Step Details'}
                </h3>
                <p className={cn(
                  'text-xs mb-3',
                  isFailed ? 'text-red-600' : 'text-blue-600'
                )}>
                  {isFailed
                    ? 'Copy the complete evidence below to share with your team for debugging.'
                    : 'Copy step details to share or for documentation.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {isFailed && (
                    <CopyButton
                      text={investigationEvidence}
                      label="Copy Full Evidence"
                      variant="error"
                    />
                  )}
                  <CopyButton
                    text={JSON.stringify(step, null, 2)}
                    label="Copy JSON"
                    variant={isFailed ? 'error' : 'default'}
                  />
                  {step.error && (
                    <CopyButton
                      text={step.error.message}
                      label="Copy Error Message"
                      variant="error"
                    />
                  )}
                  {step.apiCall && (
                    <CopyButton
                      text={JSON.stringify(step.apiCall, null, 2)}
                      label="Copy API Details"
                      variant={isFailed ? 'error' : 'default'}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Timing info */}
          {step.duration > 0 && (
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">Duration:</span>
                <span className="ml-2 font-medium">{step.duration}ms</span>
              </div>
              {step.startedAt && (
                <div>
                  <span className="text-gray-500">Started:</span>
                  <span className="ml-2 font-medium">
                    {new Date(step.startedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {step.completedAt && (
                <div>
                  <span className="text-gray-500">Completed:</span>
                  <span className="ml-2 font-medium">
                    {new Date(step.completedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error Details - Enhanced for failed steps */}
          {step.error && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Error Details
                </h3>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
                {/* Error Message - Prominent */}
                <div className="bg-white border border-red-300 rounded-lg p-3">
                  <p className="text-sm text-red-800 font-mono break-all">{step.error.message}</p>
                </div>

                {/* Error Metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white rounded p-2 border border-red-100">
                    <span className="text-red-500 font-medium">Endpoint:</span>
                    <code className="ml-2 text-red-700 break-all">{step.error.endpoint}</code>
                  </div>
                  <div className="bg-white rounded p-2 border border-red-100">
                    <span className="text-red-500 font-medium">HTTP Status:</span>
                    <span className={cn(
                      'ml-2 font-mono font-bold',
                      step.error.httpStatus >= 500 ? 'text-red-700' :
                      step.error.httpStatus >= 400 ? 'text-orange-600' : 'text-gray-700'
                    )}>
                      {step.error.httpStatus}
                    </span>
                  </div>
                  {step.error.code && (
                    <div className="bg-white rounded p-2 border border-red-100">
                      <span className="text-red-500 font-medium">Error Code:</span>
                      <code className="ml-2 text-red-700">{step.error.code}</code>
                    </div>
                  )}
                  <div className="bg-white rounded p-2 border border-red-100">
                    <span className="text-red-500 font-medium">Timestamp:</span>
                    <span className="ml-2 text-red-700 text-xs">
                      {new Date(step.error.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Error Response Body */}
                {step.error.responseBody && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-red-500">Response Body:</span>
                      <CopyButton
                        text={JSON.stringify(step.error.responseBody, null, 2)}
                        label="Copy"
                        variant="error"
                      />
                    </div>
                    <pre className="text-xs bg-white rounded p-3 overflow-x-auto border border-red-200 max-h-48 font-mono">
                      {JSON.stringify(step.error.responseBody, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Stack Trace */}
                {step.error.stackTrace && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-red-500">Stack Trace:</span>
                      <CopyButton
                        text={step.error.stackTrace}
                        label="Copy"
                        variant="error"
                      />
                    </div>
                    <pre className="text-xs bg-white rounded p-3 overflow-x-auto border border-red-200 max-h-48 font-mono whitespace-pre-wrap">
                      {step.error.stackTrace}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* API Call Details */}
          {step.apiCall && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Code className="h-4 w-4 text-gray-400" />
                  API Call Details
                </h3>
                <CopyButton
                  text={JSON.stringify(step.apiCall, null, 2)}
                  label="Copy API Details"
                />
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      step.apiCall.method === 'GET' && 'bg-blue-100 text-blue-700',
                      step.apiCall.method === 'POST' && 'bg-green-100 text-green-700',
                      step.apiCall.method === 'PUT' && 'bg-yellow-100 text-yellow-700',
                      step.apiCall.method === 'PATCH' && 'bg-orange-100 text-orange-700',
                      step.apiCall.method === 'DELETE' && 'bg-red-100 text-red-700'
                    )}
                  >
                    {step.apiCall.method}
                  </span>
                  <code className="text-sm text-gray-700 break-all">{step.apiCall.endpoint}</code>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className={cn(
                    'font-medium',
                    step.apiCall.responseStatus >= 400 ? 'text-red-600' :
                    step.apiCall.responseStatus >= 300 ? 'text-yellow-600' : 'text-green-600'
                  )}>
                    Status: {step.apiCall.responseStatus}
                  </span>
                  <span>Response Time: {step.apiCall.responseTime}ms</span>
                </div>

                {/* Request Headers */}
                {step.apiCall.requestHeaders && Object.keys(step.apiCall.requestHeaders).length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">Request Headers:</span>
                    <pre className="mt-1 text-xs bg-white rounded p-2 overflow-x-auto border max-h-24">
                      {JSON.stringify(step.apiCall.requestHeaders, null, 2)}
                    </pre>
                  </div>
                )}

                {step.apiCall.requestPayload && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">Request Payload:</span>
                    <pre className="mt-1 text-xs bg-white rounded p-2 overflow-x-auto border max-h-40">
                      {JSON.stringify(step.apiCall.requestPayload, null, 2)}
                    </pre>
                  </div>
                )}

                {step.apiCall.responseBody && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">Response Body:</span>
                    <pre className="mt-1 text-xs bg-white rounded p-2 overflow-x-auto border max-h-40">
                      {JSON.stringify(step.apiCall.responseBody, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Created Entities */}
          {step.createdEntities.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900">
                Created Entities ({step.createdEntities.length})
              </h3>
              <div className="space-y-2">
                {step.createdEntities.map((entity, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-between',
                      'bg-gray-50 rounded-lg px-4 py-3'
                    )}
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {entity.entityCode}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({entity.entityType} #{entity.entityId})
                      </span>
                    </div>
                    <a
                      href={entity.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'flex items-center gap-1 text-sm text-blue-600',
                        'hover:text-blue-800 transition-colors'
                      )}
                    >
                      View
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Evidence Section for Failed Steps */}
          {isFailed && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  Full Investigation Evidence
                </h3>
                <CopyButton text={investigationEvidence} label="Copy All" />
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <pre className="text-xs text-gray-300 overflow-x-auto max-h-64 font-mono whitespace-pre-wrap">
                  {investigationEvidence}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          'px-6 py-4 border-t flex justify-between items-center',
          isFailed ? 'border-red-200 bg-red-50' : 'border-gray-200'
        )}>
          <div className="text-xs text-gray-500">
            {isFailed && 'Use "Copy Full Evidence" to share with your team for investigation'}
          </div>
          <button
            data-testid="step-detail-close-button"
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-lg',
              'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'transition-colors font-medium text-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-500'
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
})

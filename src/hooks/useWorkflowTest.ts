/**
 * useWorkflowTest Hook
 *
 * Manages SSE connection for workflow test execution and real-time updates.
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  WorkflowTestSession,
  SSEMessage,
  TestConfiguration,
  LogEntry,
  WorkflowPhase,
  WorkflowTestStep,
  StepStatus,
  PhaseStatus,
} from '@/types/workflow-test'
import { DEFAULT_CONFIG } from '@/types/workflow-test'
import { PHASE_DEFINITIONS, STEP_DEFINITIONS } from '@/lib/services/workflow-test/workflow-steps'

// ============================================================================
// Types
// ============================================================================

interface UseWorkflowTestReturn {
  /** Current session state */
  session: WorkflowTestSession | null
  /** Whether test is currently running */
  isRunning: boolean
  /** Whether connected to SSE stream */
  isConnected: boolean
  /** Real-time log entries */
  logs: LogEntry[]
  /** Error message if any */
  error: string | null
  /** Start the workflow test */
  startTest: (config?: Partial<TestConfiguration>) => void
  /** Cancel the running test */
  cancelTest: () => void
  /** Clear the current session */
  clearSession: () => void
  /** Current configuration */
  config: TestConfiguration
  /** Update configuration */
  setConfig: (config: Partial<TestConfiguration>) => void
}

// ============================================================================
// Initial State Helpers
// ============================================================================

function createInitialSession(): WorkflowTestSession {
  const phases: WorkflowPhase[] = PHASE_DEFINITIONS.map((phaseDef) => {
    const phaseSteps = STEP_DEFINITIONS.filter((s) => s.phaseId === phaseDef.id)

    const steps: WorkflowTestStep[] = phaseSteps.map((stepDef, idx) => ({
      id: stepDef.id,
      phaseId: stepDef.phaseId,
      stepNumber: idx + 1,
      name: stepDef.name,
      description: stepDef.description,
      status: 'pending' as StepStatus,
      startedAt: null,
      completedAt: null,
      duration: 0,
      apiCall: null,
      createdEntities: [],
      error: null,
      activityMessage: null,
    }))

    return {
      id: phaseDef.id,
      name: phaseDef.name,
      description: phaseDef.description,
      status: 'pending' as PhaseStatus,
      steps,
      stepCount: steps.length,
      completedCount: 0,
      passedCount: 0,
      failedCount: 0,
      startedAt: null,
      completedAt: null,
      duration: 0,
    }
  })

  return {
    id: '',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    totalDuration: 0,
    phases,
    currentPhase: null,
    currentStep: null,
    config: DEFAULT_CONFIG,
    cleanup: {
      performed: false,
      startedAt: '',
      completedAt: '',
      duration: 0,
      deletedCounts: {},
      errors: [],
    },
    createdBy: 0,
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWorkflowTest(): UseWorkflowTestReturn {
  // State
  const [session, setSession] = useState<WorkflowTestSession | null>(createInitialSession)
  const [isRunning, setIsRunning] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [config, setConfigState] = useState<TestConfiguration>(DEFAULT_CONFIG)

  // Refs for abort controller and reader
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  // Add log entry
  const addLog = useCallback(
    (level: LogEntry['level'], message: string, stepId?: number, phaseId?: number) => {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          level,
          message,
          stepId,
          phaseId,
        },
      ])
    },
    []
  )

  // Update step in session
  const updateStep = useCallback(
    (stepId: number, updates: Partial<WorkflowTestStep>) => {
      setSession((prev) => {
        if (!prev) return prev

        const newPhases = prev.phases.map((phase) => ({
          ...phase,
          steps: phase.steps.map((step) =>
            step.id === stepId ? { ...step, ...updates } : step
          ),
        }))

        return { ...prev, phases: newPhases }
      })
    },
    []
  )

  // Update phase in session
  const updatePhase = useCallback(
    (phaseId: number, updates: Partial<WorkflowPhase>) => {
      setSession((prev) => {
        if (!prev) return prev

        const newPhases = prev.phases.map((phase) =>
          phase.id === phaseId ? { ...phase, ...updates } : phase
        )

        return { ...prev, phases: newPhases }
      })
    },
    []
  )

  // Handle SSE message
  const handleMessage = useCallback(
    (msg: SSEMessage) => {
      switch (msg.type) {
        case 'connected':
          setIsConnected(true)
          setSession((prev) =>
            prev ? { ...prev, id: msg.sessionId, status: 'running' } : prev
          )
          addLog('info', `Connected to session ${msg.sessionId}`)
          break

        case 'cleanup_start':
          addLog('info', 'Starting test data cleanup...')
          break

        case 'cleanup_complete':
          setSession((prev) => (prev ? { ...prev, cleanup: msg.status } : prev))
          const deletedCount = Object.values(msg.status.deletedCounts).reduce(
            (a, b) => a + b,
            0
          )
          addLog(
            'success',
            `Cleanup complete: ${deletedCount} records deleted in ${msg.status.duration}ms`
          )
          break

        case 'phase_start':
          setSession((prev) =>
            prev ? { ...prev, currentPhase: msg.phaseId } : prev
          )
          updatePhase(msg.phaseId, {
            status: 'running',
            startedAt: new Date().toISOString(),
          })
          addLog('info', `Starting Phase ${msg.phaseId}: ${msg.phaseName}`, undefined, msg.phaseId)
          break

        case 'phase_complete':
          updatePhase(msg.phaseId, {
            status: msg.status,
            completedAt: new Date().toISOString(),
          })
          addLog(
            msg.status === 'passed' ? 'success' : 'error',
            `Phase ${msg.phaseId} ${msg.status}`,
            undefined,
            msg.phaseId
          )
          break

        case 'step_start':
          setSession((prev) =>
            prev ? { ...prev, currentStep: msg.stepId } : prev
          )
          updateStep(msg.stepId, {
            status: 'running',
            startedAt: new Date().toISOString(),
            activityMessage: msg.activityMessage,
          })
          addLog('info', `Step ${msg.stepId}: ${msg.stepName}`, msg.stepId)
          break

        case 'step_activity':
          updateStep(msg.stepId, { activityMessage: msg.message })
          break

        case 'step_complete':
          updateStep(msg.stepId, {
            ...msg.details,
            status: msg.status,
            completedAt: new Date().toISOString(),
          })

          // Update phase counts
          setSession((prev) => {
            if (!prev) return prev
            const step = prev.phases
              .flatMap((p) => p.steps)
              .find((s) => s.id === msg.stepId)
            if (!step) return prev

            return {
              ...prev,
              phases: prev.phases.map((phase) => {
                if (phase.id !== step.phaseId) return phase

                const newCompleted = phase.completedCount + 1
                const newPassed =
                  msg.status === 'passed' ? phase.passedCount + 1 : phase.passedCount
                const newFailed =
                  msg.status === 'failed' ? phase.failedCount + 1 : phase.failedCount

                return {
                  ...phase,
                  completedCount: newCompleted,
                  passedCount: newPassed,
                  failedCount: newFailed,
                }
              }),
            }
          })

          addLog(
            msg.status === 'passed' ? 'success' : 'error',
            `Step ${msg.stepId} ${msg.status}${msg.details.duration ? ` (${msg.details.duration}ms)` : ''}`,
            msg.stepId
          )
          break

        case 'test_complete':
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  status: msg.status,
                  completedAt: new Date().toISOString(),
                  totalDuration: msg.summary.totalDuration,
                }
              : prev
          )
          setIsRunning(false)
          setIsConnected(false)
          addLog(
            msg.status === 'passed' ? 'success' : 'error',
            `Test ${msg.status} in ${msg.summary.totalDuration}ms`
          )
          break

        case 'error':
          if (msg.stepId) {
            updateStep(msg.stepId, { error: msg.error, status: 'failed' })
          }
          setError(msg.error.message)
          addLog('error', `Error: ${msg.error.message}`, msg.stepId)
          break

        case 'heartbeat':
          // Just a keepalive, no action needed
          break
      }
    },
    [addLog, updatePhase, updateStep]
  )

  // Start test
  const startTest = useCallback(
    async (customConfig?: Partial<TestConfiguration>) => {
      // Reset state
      setSession(createInitialSession())
      setLogs([])
      setError(null)
      setIsRunning(true)

      const mergedConfig = { ...config, ...customConfig }

      try {
        // Create abort controller
        abortControllerRef.current = new AbortController()

        addLog('info', 'Starting workflow test...')

        // Make POST request for SSE stream
        const response = await fetch('/api/workflow-test/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mergedConfig),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`Failed to start test: ${response.statusText}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // Read the SSE stream
        const reader = response.body.getReader()
        readerRef.current = reader
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE messages
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                handleMessage(data as SSEMessage)
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          addLog('warning', 'Test cancelled')
          setSession((prev) =>
            prev ? { ...prev, status: 'cancelled' } : prev
          )
        } else {
          const message = (err as Error).message || 'Unknown error'
          setError(message)
          addLog('error', `Error: ${message}`)
          setSession((prev) =>
            prev ? { ...prev, status: 'failed' } : prev
          )
        }
      } finally {
        setIsRunning(false)
        setIsConnected(false)
        readerRef.current = null
        abortControllerRef.current = null
      }
    },
    [config, addLog, handleMessage]
  )

  // Cancel test
  const cancelTest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (readerRef.current) {
      readerRef.current.cancel()
    }
    setIsRunning(false)
    setIsConnected(false)
    addLog('warning', 'Test cancelled by user')
  }, [addLog])

  // Clear session
  const clearSession = useCallback(() => {
    setSession(createInitialSession())
    setLogs([])
    setError(null)
  }, [])

  // Update config
  const setConfig = useCallback((newConfig: Partial<TestConfiguration>) => {
    setConfigState((prev) => ({ ...prev, ...newConfig }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (readerRef.current) {
        readerRef.current.cancel()
      }
    }
  }, [])

  return {
    session,
    isRunning,
    isConnected,
    logs,
    error,
    startTest,
    cancelTest,
    clearSession,
    config,
    setConfig,
  }
}

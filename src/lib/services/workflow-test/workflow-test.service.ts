/**
 * Workflow Test Service
 *
 * Executes the 31-step end-to-end workflow test with SSE streaming.
 */

import type {
  WorkflowTestSession,
  WorkflowPhase,
  WorkflowTestStep,
  TestConfiguration,
  SSEMessage,
  ExecutionContext,
  PhaseStatus,
  StepStatus,
} from '@/types/workflow-test'
import { DEFAULT_CONFIG } from '@/types/workflow-test'
import { PHASE_DEFINITIONS, STEP_DEFINITIONS, TOTAL_STEPS } from './workflow-steps'
import { cleanupTestData } from './test-data-cleanup'

// ============================================================================
// Session Storage (in-memory for now)
// ============================================================================

const sessions = new Map<string, WorkflowTestSession>()

/**
 * Get a session by ID
 */
export function getSession(sessionId: string): WorkflowTestSession | undefined {
  return sessions.get(sessionId)
}

/**
 * Get recent sessions
 */
export function getRecentSessions(limit: number = 10): WorkflowTestSession[] {
  return Array.from(sessions.values())
    .sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0
      return bTime - aTime
    })
    .slice(0, limit)
}

// ============================================================================
// Session Initialization
// ============================================================================

/**
 * Create initial session state
 */
function createSession(
  config: TestConfiguration,
  userId: number
): WorkflowTestSession {
  const sessionId = `wftest-${Date.now()}`

  // Initialize phases with steps
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

  const session: WorkflowTestSession = {
    id: sessionId,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    totalDuration: 0,
    phases,
    currentPhase: null,
    currentStep: null,
    config,
    cleanup: {
      performed: false,
      startedAt: '',
      completedAt: '',
      duration: 0,
      deletedCounts: {},
      errors: [],
    },
    createdBy: userId,
  }

  sessions.set(sessionId, session)
  return session
}

// ============================================================================
// Execution
// ============================================================================

interface ExecuteOptions {
  config?: Partial<TestConfiguration>
  userId: number
  onMessage: (msg: SSEMessage) => void
  baseUrl?: string
  cookies?: string
}

/**
 * Execute the workflow test
 */
export async function executeWorkflowTest(options: ExecuteOptions): Promise<void> {
  const config: TestConfiguration = {
    ...DEFAULT_CONFIG,
    ...options.config,
  }

  const baseUrl = options.baseUrl || ''
  const session = createSession(config, options.userId)
  const sendMessage = options.onMessage

  // Send connected message
  sendMessage({
    type: 'connected',
    sessionId: session.id,
    totalSteps: TOTAL_STEPS,
  })

  // Start session
  session.status = 'running'
  session.startedAt = new Date().toISOString()

  try {
    // Phase 0: Cleanup
    sendMessage({ type: 'cleanup_start' })

    const cleanupResult = await cleanupTestData(config.prefix)
    session.cleanup = cleanupResult

    sendMessage({ type: 'cleanup_complete', status: cleanupResult })

    // Create execution context
    const context: ExecutionContext = {
      config,
      sessionId: session.id,
      userId: options.userId,
      baseUrl,
      cookies: options.cookies || '',
      createdData: {},
      sendMessage,
    }

    // Execute phases sequentially
    for (const phase of session.phases) {
      await executePhase(session, phase, context)

      // Check if phase failed - stop execution
      if (phase.status === 'failed') {
        session.status = 'failed'
        break
      }
    }

    // Determine final status
    if (session.status === 'running') {
      const allPassed = session.phases.every((p) => p.status === 'passed')
      session.status = allPassed ? 'passed' : 'failed'
    }
  } catch (error) {
    session.status = 'failed'
    sendMessage({
      type: 'error',
      error: {
        message: String(error),
        code: null,
        endpoint: 'workflow-test',
        httpStatus: 500,
        responseBody: null,
        stackTrace: null,
        timestamp: new Date().toISOString(),
      },
    })
  }

  // Complete session
  session.completedAt = new Date().toISOString()
  session.totalDuration = session.startedAt
    ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
    : 0

  // Send completion message
  sendMessage({
    type: 'test_complete',
    status: session.status,
    summary: session,
  })

  // Update stored session
  sessions.set(session.id, session)
}

/**
 * Execute a single phase
 */
async function executePhase(
  session: WorkflowTestSession,
  phase: WorkflowPhase,
  context: ExecutionContext
): Promise<void> {
  const { sendMessage } = context

  // Start phase
  phase.status = 'running'
  phase.startedAt = new Date().toISOString()
  session.currentPhase = phase.id

  sendMessage({
    type: 'phase_start',
    phaseId: phase.id,
    phaseName: phase.name,
  })

  // Execute steps sequentially
  for (const step of phase.steps) {
    const stepDef = STEP_DEFINITIONS.find((s) => s.id === step.id)
    if (!stepDef) continue

    await executeStep(session, phase, step, stepDef, context)

    // Update phase counts
    if (step.status === 'passed') {
      phase.passedCount++
      phase.completedCount++
    } else if (step.status === 'failed') {
      phase.failedCount++
      phase.completedCount++

      // Stop phase on first failure
      phase.status = 'failed'
      break
    }
  }

  // Complete phase
  if (phase.status !== 'failed') {
    phase.status = 'passed'
  }
  phase.completedAt = new Date().toISOString()
  phase.duration = phase.startedAt
    ? new Date(phase.completedAt).getTime() - new Date(phase.startedAt).getTime()
    : 0

  sendMessage({
    type: 'phase_complete',
    phaseId: phase.id,
    status: phase.status,
  })
}

/**
 * Execute a single step
 */
async function executeStep(
  session: WorkflowTestSession,
  phase: WorkflowPhase,
  step: WorkflowTestStep,
  stepDef: (typeof STEP_DEFINITIONS)[0],
  context: ExecutionContext
): Promise<void> {
  const { sendMessage } = context

  // Start step
  step.status = 'running'
  step.startedAt = new Date().toISOString()
  step.activityMessage = stepDef.activityMessage
  session.currentStep = step.id

  sendMessage({
    type: 'step_start',
    stepId: step.id,
    stepName: step.name,
    activityMessage: stepDef.activityMessage,
  })

  try {
    // Execute the step
    const result = await stepDef.execute(context)

    // Update step with results
    step.apiCall = result.apiCall
    step.createdEntities = result.createdEntities
    step.status = result.success ? 'passed' : 'failed'

    if (result.error) {
      step.error = result.error
    }

    // Store data for subsequent steps
    if (result.data) {
      Object.assign(context.createdData, result.data)
    }
  } catch (error) {
    step.status = 'failed'
    step.error = {
      message: String(error),
      code: null,
      endpoint: stepDef.endpoint,
      httpStatus: 0,
      responseBody: null,
      stackTrace: null,
      timestamp: new Date().toISOString(),
    }
  }

  // Complete step
  step.completedAt = new Date().toISOString()
  step.duration = step.startedAt
    ? new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()
    : 0
  step.activityMessage = null

  sendMessage({
    type: 'step_complete',
    stepId: step.id,
    status: step.status,
    details: step,
  })

  // Send error message if step failed
  if (step.error) {
    sendMessage({
      type: 'error',
      stepId: step.id,
      error: step.error,
    })
  }
}

/**
 * Cancel a running test
 */
export function cancelTest(sessionId: string): boolean {
  const session = sessions.get(sessionId)
  if (!session || session.status !== 'running') {
    return false
  }

  session.status = 'cancelled'
  session.completedAt = new Date().toISOString()
  session.totalDuration = session.startedAt
    ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
    : 0

  sessions.set(sessionId, session)
  return true
}

/**
 * Get step details from a session
 */
export function getStepDetails(
  sessionId: string,
  stepId: number
): WorkflowTestStep | undefined {
  const session = sessions.get(sessionId)
  if (!session) return undefined

  for (const phase of session.phases) {
    const step = phase.steps.find((s) => s.id === stepId)
    if (step) return step
  }

  return undefined
}

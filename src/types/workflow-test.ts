/**
 * Workflow Test Types
 *
 * Type definitions for the workflow test feature that executes 31 test steps
 * across 8 phases to validate end-to-end ERP processes.
 */

// ============================================================================
// Status Types
// ============================================================================

export type WorkflowStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
export type PhaseStatus = 'pending' | 'running' | 'passed' | 'failed'
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed'

// ============================================================================
// Core Entities
// ============================================================================

/**
 * Represents a complete test execution session
 */
export interface WorkflowTestSession {
  id: string                    // UUID: "wftest-{timestamp}"
  status: WorkflowStatus
  startedAt: string | null      // ISO timestamp
  completedAt: string | null    // ISO timestamp
  totalDuration: number         // milliseconds
  phases: WorkflowPhase[]       // 8 phases
  currentPhase: number | null   // 1-8 or null
  currentStep: number | null    // 1-31 or null
  config: TestConfiguration
  cleanup: CleanupStatus
  createdBy: number             // User ID who started test
}

/**
 * Logical grouping of related test steps
 */
export interface WorkflowPhase {
  id: number                    // 1-8
  name: string                  // e.g., "Master Data Setup"
  description: string           // Brief explanation
  status: PhaseStatus
  steps: WorkflowTestStep[]     // Steps in this phase
  stepCount: number             // Total steps
  completedCount: number        // Passed + Failed
  passedCount: number           // Green checkmarks
  failedCount: number           // Red X marks
  startedAt: string | null
  completedAt: string | null
  duration: number              // milliseconds
}

/**
 * Individual test step with execution details
 */
export interface WorkflowTestStep {
  id: number                    // 1-31 (global)
  phaseId: number               // 1-8
  stepNumber: number            // Position within phase
  name: string                  // e.g., "Setup warehouse and storage locations"
  description: string           // Detailed description
  status: StepStatus
  startedAt: string | null
  completedAt: string | null
  duration: number              // milliseconds

  // API execution details
  apiCall: ApiCallDetails | null

  // Created entity references
  createdEntities: CreatedEntity[]

  // Error details if failed
  error: StepError | null

  // Live activity message
  activityMessage: string | null  // "Creating vendor record..."
}

// ============================================================================
// API Execution Types
// ============================================================================

/**
 * Records the API request/response for each step
 */
export interface ApiCallDetails {
  endpoint: string              // e.g., "/api/warehouses"
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  requestPayload: Record<string, unknown> | null
  requestHeaders: Record<string, string>
  responseStatus: number        // HTTP status code
  responseBody: Record<string, unknown> | null
  responseTime: number          // milliseconds
}

/**
 * Tracks entities created by each step for linking and cleanup
 */
export interface CreatedEntity {
  entityType: string            // e.g., "warehouse", "item", "vendor"
  entityId: number              // Database ID
  entityCode: string            // Code/name for display
  viewUrl: string               // Link to view in ERP
}

/**
 * Detailed error information for failed steps
 */
export interface StepError {
  message: string               // Human-readable error
  code: string | null           // Error code if available
  endpoint: string              // Which API failed
  httpStatus: number            // HTTP status code
  responseBody: Record<string, unknown> | null
  stackTrace: string | null     // Development only
  timestamp: string             // When error occurred
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * User-configurable test parameters
 */
export interface TestConfiguration {
  // Test data prefix for cleanup
  prefix: string                // Default: "WFTEST_"

  // Phase 1: Master Data
  warehouseName: string         // Default: "WFTEST_MAIN"
  itemPrefix: string            // Default: "WFTEST_"

  // Phase 3: Purchasing
  vendorName: string            // Default: "WFTEST_VENDOR"
  purchaseQuantity: number      // Default: 100

  // Phase 4: Production
  productionQuantity: number    // Default: 50

  // Phase 6: Sales
  customerName: string          // Default: "WFTEST_CUSTOMER"
  salesQuantity: number         // Default: 10
}

export const DEFAULT_CONFIG: TestConfiguration = {
  prefix: 'WFTEST_',
  warehouseName: 'WFTEST_MAIN',
  itemPrefix: 'WFTEST_',
  vendorName: 'WFTEST_VENDOR',
  purchaseQuantity: 100,
  productionQuantity: 50,
  customerName: 'WFTEST_CUSTOMER',
  salesQuantity: 10,
}

// ============================================================================
// Cleanup Types
// ============================================================================

/**
 * Result of pre-test data cleanup
 */
export interface CleanupStatus {
  performed: boolean
  startedAt: string
  completedAt: string
  duration: number              // milliseconds
  deletedCounts: Record<string, number>  // { "items": 5, "vendors": 1, ... }
  errors: string[]              // Any cleanup errors
}

// ============================================================================
// SSE Message Types
// ============================================================================

/**
 * Messages streamed during test execution
 */
export type SSEMessage =
  | { type: 'connected'; sessionId: string; totalSteps: number }
  | { type: 'cleanup_start' }
  | { type: 'cleanup_complete'; status: CleanupStatus }
  | { type: 'phase_start'; phaseId: number; phaseName: string }
  | { type: 'phase_complete'; phaseId: number; status: PhaseStatus }
  | { type: 'step_start'; stepId: number; stepName: string; activityMessage: string }
  | { type: 'step_activity'; stepId: number; message: string }
  | { type: 'step_complete'; stepId: number; status: StepStatus; details: WorkflowTestStep }
  | { type: 'test_complete'; status: WorkflowStatus; summary: WorkflowTestSession }
  | { type: 'error'; stepId?: number; error: StepError }
  | { type: 'heartbeat'; timestamp: string }

// ============================================================================
// Summary Types (for history)
// ============================================================================

/**
 * Summary of a test session for history display
 */
export interface WorkflowTestSessionSummary {
  id: string
  status: WorkflowStatus
  startedAt: string
  completedAt: string | null
  totalDuration: number
  passedSteps: number
  failedSteps: number
  createdBy: number
}

// ============================================================================
// Step Definition Types (for service layer)
// ============================================================================

/**
 * Execution context passed to step executors
 */
export interface ExecutionContext {
  config: TestConfiguration
  sessionId: string
  userId: number
  baseUrl: string
  cookies: string
  // Created entities from previous steps (for dependencies)
  createdData: Record<string, Record<string, unknown>>
  // Function to send SSE messages
  sendMessage: (msg: SSEMessage) => void
}

/**
 * Result returned by step executors
 */
export interface StepResult {
  success: boolean
  apiCall: ApiCallDetails
  createdEntities: CreatedEntity[]
  error?: StepError
  // Data to store for subsequent steps
  data?: Record<string, unknown>
}

/**
 * Definition of a single workflow test step
 */
export interface StepDefinition {
  id: number
  phaseId: number
  name: string
  description: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  activityMessage: string
  execute: (context: ExecutionContext) => Promise<StepResult>
}

/**
 * Definition of a workflow phase
 */
export interface PhaseDefinition {
  id: number
  name: string
  description: string
  stepCount: number
}

// ============================================================================
// Log Entry Type (for real-time log display)
// ============================================================================

export interface LogEntry {
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  stepId?: number
  phaseId?: number
  details?: Record<string, unknown>
}

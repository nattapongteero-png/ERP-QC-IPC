/**
 * Workflow Test Validation Schemas
 *
 * Zod schemas for validating workflow test data
 */

import { z } from 'zod'

// ============================================================================
// Status Enums
// ============================================================================

export const workflowStatusSchema = z.enum(['pending', 'running', 'passed', 'failed', 'cancelled'])
export const phaseStatusSchema = z.enum(['pending', 'running', 'passed', 'failed'])
export const stepStatusSchema = z.enum(['pending', 'running', 'passed', 'failed'])

// ============================================================================
// Configuration Schema
// ============================================================================

export const testConfigurationSchema = z.object({
  prefix: z.string().min(1).max(20).default('WFTEST_'),
  warehouseName: z.string().min(1).max(50).default('WFTEST_MAIN'),
  itemPrefix: z.string().min(1).max(20).default('WFTEST_'),
  vendorName: z.string().min(1).max(100).default('WFTEST_VENDOR'),
  purchaseQuantity: z.number().int().positive().max(10000).default(100),
  productionQuantity: z.number().int().positive().max(10000).default(50),
  customerName: z.string().min(1).max(100).default('WFTEST_CUSTOMER'),
  salesQuantity: z.number().int().positive().max(10000).default(10),
})

export type TestConfigurationInput = z.input<typeof testConfigurationSchema>

// ============================================================================
// Cleanup Schema
// ============================================================================

export const cleanupRequestSchema = z.object({
  prefix: z.string().min(1).max(20).default('WFTEST_'),
})

export const cleanupStatusSchema = z.object({
  performed: z.boolean(),
  startedAt: z.string(),
  completedAt: z.string(),
  duration: z.number().int().nonnegative(),
  deletedCounts: z.record(z.string(), z.number().int().nonnegative()),
  errors: z.array(z.string()),
})

// ============================================================================
// API Call Details Schema
// ============================================================================

export const apiCallDetailsSchema = z.object({
  endpoint: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  requestPayload: z.record(z.string(), z.unknown()).nullable(),
  requestHeaders: z.record(z.string(), z.string()),
  responseStatus: z.number().int(),
  responseBody: z.record(z.string(), z.unknown()).nullable(),
  responseTime: z.number().int().nonnegative(),
})

// ============================================================================
// Created Entity Schema
// ============================================================================

export const createdEntitySchema = z.object({
  entityType: z.string(),
  entityId: z.number().int().positive(),
  entityCode: z.string(),
  viewUrl: z.string(),
})

// ============================================================================
// Step Error Schema
// ============================================================================

export const stepErrorSchema = z.object({
  message: z.string(),
  code: z.string().nullable(),
  endpoint: z.string(),
  httpStatus: z.number().int(),
  responseBody: z.record(z.string(), z.unknown()).nullable(),
  stackTrace: z.string().nullable(),
  timestamp: z.string(),
})

// ============================================================================
// Step Schema
// ============================================================================

export const workflowTestStepSchema = z.object({
  id: z.number().int().min(1).max(31),
  phaseId: z.number().int().min(1).max(8),
  stepNumber: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  status: stepStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  duration: z.number().int().nonnegative(),
  apiCall: apiCallDetailsSchema.nullable(),
  createdEntities: z.array(createdEntitySchema),
  error: stepErrorSchema.nullable(),
  activityMessage: z.string().nullable(),
})

// ============================================================================
// Phase Schema
// ============================================================================

export const workflowPhaseSchema = z.object({
  id: z.number().int().min(1).max(8),
  name: z.string(),
  description: z.string(),
  status: phaseStatusSchema,
  steps: z.array(workflowTestStepSchema),
  stepCount: z.number().int().positive(),
  completedCount: z.number().int().nonnegative(),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  duration: z.number().int().nonnegative(),
})

// ============================================================================
// Session Schema
// ============================================================================

export const workflowTestSessionSchema = z.object({
  id: z.string().regex(/^wftest-\d+$/),
  status: workflowStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  totalDuration: z.number().int().nonnegative(),
  phases: z.array(workflowPhaseSchema),
  currentPhase: z.number().int().min(1).max(8).nullable(),
  currentStep: z.number().int().min(1).max(31).nullable(),
  config: testConfigurationSchema,
  cleanup: cleanupStatusSchema,
  createdBy: z.number().int().positive(),
})

// ============================================================================
// Session Summary Schema (for history)
// ============================================================================

export const workflowTestSessionSummarySchema = z.object({
  id: z.string(),
  status: workflowStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  totalDuration: z.number().int().nonnegative(),
  passedSteps: z.number().int().nonnegative(),
  failedSteps: z.number().int().nonnegative(),
  createdBy: z.number().int().positive(),
})

// ============================================================================
// API Request Schemas
// ============================================================================

export const runTestRequestSchema = testConfigurationSchema.partial()

export const getStatusRequestSchema = z.object({
  sessionId: z.string(),
})

export const getStepDetailsRequestSchema = z.object({
  stepId: z.number().int().min(1).max(31),
  sessionId: z.string(),
})

export const getHistoryRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
})

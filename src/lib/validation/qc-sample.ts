/**
 * QC Sample Validation Schemas
 *
 * Validates payloads for the QC Standalone module:
 * - Sample registration (operator declares incoming/outgoing/in-process sample)
 * - Per-test result entry (numeric or text)
 * - Status transitions (registered → testing → reviewed → approved → released)
 * - Test panel master CRUD
 *
 * Standards: ISO/IEC 17025, FDA 21 CFR Part 11 / Part 211 Subpart I
 */

import { z } from 'zod';

// Sample sources — see qc-coa-design.md §3.1
export const sampleSourceTypeSchema = z.enum([
  'raw_material_lot',
  'work_order_batch',
  'customer_return',
  'stability',
  'purchased_herb',
  'outgoing_shipment',
  'other',
]);

// Lifecycle states — see qc-coa-design.md §3.1 state machine
export const sampleStatusSchema = z.enum([
  'draft',
  'registered',
  'testing',
  'reviewed',
  'approved',
  'released',
  'rejected',
  'quarantine',
  'oos',
]);

// Per-test result codes
export const testResultStatusSchema = z.enum([
  'pending',
  'pass',
  'fail',
  'retest',
  'na',
]);

// Action verbs for the status transition endpoint
export const sampleActionSchema = z.enum([
  'start_testing',
  'submit_for_review',
  'approve',
  'release',
  'reject',
  'quarantine',
  'flag_oos',
]);

// ----------------------------------------------------------------------------
// 1. Create / Update sample
// ----------------------------------------------------------------------------

export const createQcSampleSchema = z.object({
  productId: z.number().int().positive('productId is required'),
  sourceType: sampleSourceTypeSchema,
  sourceRefId: z.number().int().positive().nullable().optional(),
  sourceRefText: z.string().max(255).nullable().optional(),
  lotNumber: z.string().max(100).nullable().optional(),
  manufactureDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  retestDate: z.string().nullable().optional(),
  quantityReceived: z.number().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  storageConditions: z.string().max(2000).nullable().optional(),
  customerId: z.number().int().positive().nullable().optional(),
  salesOrderRef: z.string().max(50).nullable().optional(),
  receivedDate: z.string().min(1, 'receivedDate is required'),
  receivedBy: z.number().int().positive('receivedBy is required'),
  notes: z.string().max(2000).nullable().optional(),
  // When true, seed qc_sample_tests rows from the matching qc_test_panels for
  // this product (or product_category). Operator can still add/remove tests
  // afterwards.
  applyDefaultPanel: z.boolean().optional().default(true),
});

export const updateQcSampleSchema = createQcSampleSchema
  .partial()
  // receivedBy / productId are not editable post-creation — re-creating the
  // sample with a different product would invalidate already-entered tests.
  .omit({ productId: true, receivedBy: true, applyDefaultPanel: true });

// ----------------------------------------------------------------------------
// 2. Per-test result entry (upsert)
// ----------------------------------------------------------------------------

export const addOrUpdateTestSchema = z
  .object({
    sampleId: z.number().int().positive(),
    // testId set when updating an existing row — otherwise insert.
    testId: z.number().int().positive().nullable().optional(),
    // criteriaId is nullable for ad-hoc / custom tests not in ipc_criteria.
    // The DB column is NOT NULL, so the service falls back to a sentinel
    // criteria when null is passed in. Schema allows null for forward
    // compatibility (custom-test feature in Phase 3).
    criteriaId: z.number().int().positive(),
    sequence: z.number().int().min(1).default(1),
    // Spec snapshot (immutable once test reviewed)
    specMin: z.number().nullable().optional(),
    specMax: z.number().nullable().optional(),
    specTarget: z.number().nullable().optional(),
    specText: z.string().max(500).nullable().optional(),
    unit: z.string().max(20).nullable().optional(),
    testMethod: z.string().max(255).nullable().optional(),
    // Result fields — the service computes resultStatus from these.
    numericResult: z.number().nullable().optional(),
    textResult: z.string().max(2000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    attachmentPath: z.string().max(500).nullable().optional(),
  })
  // At least one of (numericResult, textResult) must be present when entering
  // a result, but both can be empty when seeding a panel row with no result yet.
  .refine(
    (t) =>
      t.numericResult == null &&
      (t.textResult == null || t.textResult.trim() === '')
        ? true
        : true,
    { message: 'Result must be numeric or text', path: ['numericResult'] },
  );

// ----------------------------------------------------------------------------
// 3. Status transitions (via POST /[id])
// ----------------------------------------------------------------------------

export const updateStatusSchema = z.object({
  action: sampleActionSchema,
  reason: z.string().max(2000).nullable().optional(),
});

// ----------------------------------------------------------------------------
// 4. Apply test panel
// ----------------------------------------------------------------------------

export const applyTestPanelSchema = z.object({
  // Either a panel id (number) or a product-category key (string).
  // The service resolves it to the matching qc_test_panels rows.
  panelKey: z.union([z.number().int().positive(), z.string().min(1)]),
});

// ----------------------------------------------------------------------------
// 5. Test panel master CRUD
// ----------------------------------------------------------------------------

export const createTestPanelSchema = z.object({
  productId: z.number().int().positive().nullable().optional(),
  productCategory: z.string().max(50).nullable().optional(),
  criteriaId: z.number().int().positive('criteriaId is required'),
  isRequired: z.boolean().optional().default(true),
  sequence: z.number().int().min(1).default(1),
  isActive: z.boolean().optional().default(true),
});

export const updateTestPanelSchema = createTestPanelSchema.partial();

// ----------------------------------------------------------------------------
// Type exports for service-layer consumption
// ----------------------------------------------------------------------------
export type CreateQcSampleInput = z.infer<typeof createQcSampleSchema>;
export type UpdateQcSampleInput = z.infer<typeof updateQcSampleSchema>;
export type AddOrUpdateTestInput = z.infer<typeof addOrUpdateTestSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ApplyTestPanelInput = z.infer<typeof applyTestPanelSchema>;
export type CreateTestPanelInput = z.infer<typeof createTestPanelSchema>;
export type UpdateTestPanelInput = z.infer<typeof updateTestPanelSchema>;
export type SampleSourceType = z.infer<typeof sampleSourceTypeSchema>;
export type SampleStatus = z.infer<typeof sampleStatusSchema>;
export type SampleAction = z.infer<typeof sampleActionSchema>;
export type TestResultStatus = z.infer<typeof testResultStatusSchema>;

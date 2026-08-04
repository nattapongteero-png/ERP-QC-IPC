/**
 * QC Sample Service
 *
 * Standalone QC (LIMS-style) sample lifecycle:
 *   1. Operator registers a sample (createQcSample) — generates sample_number
 *      QC-{YYYY}-{6digit}, status='registered', optionally seeds tests from
 *      the matching qc_test_panels for the product / category.
 *   2. Per-test result entry (addOrUpdateTest) — service auto-determines
 *      pass/fail from numericResult vs spec range, blocks edits to reviewed
 *      tests (FDA 21 CFR Part 11 immutability).
 *   3. State machine transitions (updateSampleStatus) — registered → testing
 *      → reviewed → approved → released, plus rejected/quarantine/oos.
 *      Phase 3 will hook the formal 3-tier sign-off into this; for now the
 *      transition is a single explicit call.
 *
 * Test panel master CRUD lives at the bottom — listTestPanels, createTestPanel,
 * etc. — used by /quality/test-panels admin page.
 *
 * Standards covered:
 *   - ISO/IEC 17025                — sample registration, traceability
 *   - FDA 21 CFR Part 11           — audit trail, status immutability, sign-off hooks
 *   - FDA 21 CFR 211 Subpart I     — laboratory controls
 *   - WHO TRS 1010 Annex 4         — COA-driving fields captured at sample time
 */

import { eq, and, desc, asc, gte, lte, like, or, inArray, sql, isNull } from 'drizzle-orm';
import { executeDbOperation, getInsertId, getAffectedRows, getTableRef } from '../db/db-helper';
import { isSqlite } from '../db';
import { getNow, toQueryDate, toDbDate } from '../db/date-utils';
import {
  // SQLite tables
  sqliteQcSamples,
  sqliteQcSampleTests,
  sqliteQcTestPanels,
  sqliteQcOosInvestigations,
  sqliteQcSampleSignatures,
  sqliteQcSampleTestSamples,
  sqliteIPCCriteria,
  sqliteItems,
  sqliteCustomers,
  sqliteUsers,
  sqliteCoaDocuments,
  sqliteDeviations,
  // MySQL tables
  mysqlQcSamples,
  mysqlQcSampleTests,
  mysqlQcTestPanels,
  mysqlQcOosInvestigations,
  mysqlQcSampleSignatures,
  mysqlQcSampleTestSamples,
  mysqlIPCCriteria,
  mysqlItems,
  mysqlCustomers,
  mysqlUsers,
  mysqlCoaDocuments,
  mysqlDeviations,
} from '../db/schema';

import type {
  CreateQcSampleInput,
  UpdateQcSampleInput,
  AddOrUpdateTestInput,
  CreateTestPanelInput,
  UpdateTestPanelInput,
  SampleStatus,
  SampleAction,
  SignatureRole,
  CreateOosInvestigationInput,
  UpdateOosInvestigationInput,
  OosClassification,
} from '../validation/qc-sample';
import { verifyPassword } from '../auth';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** Numeric epsilon for spec-range comparison of operator-entered values. */
const SPEC_EPSILON = 1e-9;

// ----------------------------------------------------------------------------
// Table-ref helper
// ----------------------------------------------------------------------------

function getTables() {
  if (isSqlite()) {
    return {
      samples: sqliteQcSamples,
      tests: sqliteQcSampleTests,
      testSamples: sqliteQcSampleTestSamples,
      panels: sqliteQcTestPanels,
      oos: sqliteQcOosInvestigations,
      signatures: sqliteQcSampleSignatures,
      criteria: sqliteIPCCriteria,
      items: sqliteItems,
      customers: sqliteCustomers,
      users: sqliteUsers,
      coa: sqliteCoaDocuments,
      deviations: sqliteDeviations,
    };
  }
  return {
    samples: mysqlQcSamples,
    tests: mysqlQcSampleTests,
    testSamples: mysqlQcSampleTestSamples,
    panels: mysqlQcTestPanels,
    oos: mysqlQcOosInvestigations,
    signatures: mysqlQcSampleSignatures,
    criteria: mysqlIPCCriteria,
    items: mysqlItems,
    customers: mysqlCustomers,
    users: mysqlUsers,
    coa: mysqlCoaDocuments,
    deviations: mysqlDeviations,
  };
}

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export interface ListQcSamplesFilters {
  status?: string;
  sourceType?: string;
  productId?: number;
  customerId?: number;
  lotNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface QcSampleListRow {
  id: number;
  sampleNumber: string;
  sourceType: string;
  productId: number;
  productCode: string | null;
  productName: string | null;
  lotNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  receivedDate: string | Date;
  receivedBy: number;
  receivedByName: string | null;
  status: string;
  testCounts: {
    total: number;
    pending: number;
    pass: number;
    fail: number;
  };
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface QcSampleListResult {
  items: QcSampleListRow[];
  total: number;
  page: number;
  limit: number;
}

/** Single sample reading inside a recorded test round. */
export interface QcSampleTestSampleRow {
  sampleNumber: number;
  numericValue: number | null;
  textValue: string | null;
  result: 'pass' | 'fail' | null;
}

/** One recording round on a test (Round 1, Round 2 retest, ...). */
export interface QcSampleTestRoundRow {
  roundNumber: number;
  samples: QcSampleTestSampleRow[];
  /** Average of numeric values across the round, when available. */
  avg: number | null;
  /** Aggregate pass/fail computed at the time of recording. */
  result: 'pass' | 'fail' | 'pending';
}

export interface QcSampleTestRow {
  id: number;
  sampleId: number;
  criteriaId: number;
  criteriaCode: string | null;
  criteriaName: string | null;
  criteriaNameTh: string | null;
  /** Master-data settings drive the recording UI (numeric vs checklist, n samples). */
  criteriaType: string | null;
  criteriaSampleSize: number | null;
  criteriaTolerancePercent: number | null;
  criteriaMaxRetestRounds: number | null;
  criteriaAcceptanceStages: string | null;
  criteriaSpecSpecification: string | null;
  sequence: number;
  specMin: number | null;
  specMax: number | null;
  specTarget: number | null;
  specText: string | null;
  unit: string | null;
  testMethod: string | null;
  numericResult: number | null;
  textResult: string | null;
  resultStatus: string;
  testedBy: number | null;
  testedByName: string | null;
  testedAt: string | Date | null;
  reviewedBy: number | null;
  reviewedByName: string | null;
  reviewedAt: string | Date | null;
  notes: string | null;
  attachmentPath: string | null;
  /** Per-round history with individual sample readings. Empty when no rounds recorded yet. */
  rounds: QcSampleTestRoundRow[];
  /** Highest round number recorded so far (0 when no samples saved yet). */
  totalRounds: number;
}

export interface QcSampleSignatureRow {
  id: number;
  role: string;
  userId: number;
  userName: string | null;
  signedAt: string | Date;
  signatureMeaning: string | null;
  notes: string | null;
}

export interface QcSampleOosRow {
  id: number;
  sampleTestId: number;
  initiatedBy: number;
  initiatedByName: string | null;
  initiatedAt: string | Date;
  classification: string | null;
  retestAuthorized: boolean;
  closedAt: string | Date | null;
  conclusion: string | null;
}

export interface QcSampleDetail {
  id: number;
  sampleNumber: string;
  sourceType: string;
  sourceRefId: number | null;
  sourceRefText: string | null;
  productId: number;
  productCode: string | null;
  productName: string | null;
  productNameEn: string | null;
  lotNumber: string | null;
  manufactureDate: string | Date | null;
  expiryDate: string | Date | null;
  retestDate: string | Date | null;
  quantityReceived: number | null;
  unit: string | null;
  storageConditions: string | null;
  customerId: number | null;
  customerName: string | null;
  salesOrderRef: string | null;
  receivedDate: string | Date;
  receivedBy: number;
  receivedByName: string | null;
  status: string;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  tests: QcSampleTestRow[];
  signatures: QcSampleSignatureRow[];
  oosInvestigations: QcSampleOosRow[];
  linkedCoa: { id: number; coaNumber: string; status: string } | null;
}

export interface TestPanelRow {
  id: number;
  productId: number | null;
  productCode: string | null;
  productName: string | null;
  productCategory: string | null;
  criteriaId: number;
  criteriaCode: string | null;
  criteriaName: string | null;
  criteriaNameTh: string | null;
  /** Default n-samples per test from ipc_criteria — drives QC Entry sample-size calc. */
  criteriaSampleSize: number | null;
  isRequired: boolean;
  sequence: number;
  isActive: boolean;
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

/**
 * Generate the next sequential sample number `QC-{YYYY}-{6digit}`.
 * Mirrors the pattern used by material-return.service.generateReturnNumber()
 * and accounting AR/AP — scan for the latest existing prefix, increment.
 */
async function generateSampleNumber(database: any): Promise<string> {
  const tables = getTables();
  const year = new Date().getFullYear();
  const prefix = `QC-${year}-`;

  const existing = await database
    .select({ sampleNumber: tables.samples.sampleNumber })
    .from(tables.samples)
    .where(like(tables.samples.sampleNumber, `${prefix}%`))
    .orderBy(desc(tables.samples.id))
    .limit(1);

  if (existing.length === 0) {
    return `${prefix}000001`;
  }
  const lastNumber = String(existing[0].sampleNumber);
  const seq = parseInt(lastNumber.replace(prefix, ''), 10);
  const nextSeq = (Number.isFinite(seq) ? seq + 1 : 1)
    .toString()
    .padStart(6, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * Determine pass/fail/pending for a test row based on entered results vs
 * spec snapshot. Returns 'pending' when no result entered yet.
 *
 * Logic per design §3.2:
 *   - numericResult given + (specMin or specMax or specTarget) → check range
 *   - numericResult given without spec → 'pass' (operator-judged)
 *   - textResult only → 'pass' (operator-judged unless they explicitly set fail)
 *   - neither → 'pending'
 */
function computeResultStatus(input: {
  numericResult: number | null | undefined;
  textResult: string | null | undefined;
  specMin: number | null | undefined;
  specMax: number | null | undefined;
  specTarget: number | null | undefined;
}): 'pending' | 'pass' | 'fail' {
  const { numericResult, textResult, specMin, specMax } = input;
  const hasNumeric = numericResult != null && Number.isFinite(numericResult);
  const hasText = textResult != null && String(textResult).trim().length > 0;

  if (!hasNumeric && !hasText) return 'pending';

  if (hasNumeric) {
    const v = Number(numericResult);
    if (specMin != null && v + SPEC_EPSILON < Number(specMin)) return 'fail';
    if (specMax != null && v - SPEC_EPSILON > Number(specMax)) return 'fail';
    return 'pass';
  }

  // Text-only — operator's judgement, default to pass. Phase 3 may surface a
  // dedicated dropdown for fail/retest/na from the UI.
  return 'pass';
}

/**
 * Resolve the qc_test_panels rows to seed for a new sample.
 * Looks up by productId first, falls back to product_category match.
 */
async function resolvePanelRows(
  database: any,
  productId: number,
): Promise<Array<{
  criteriaId: number;
  sequence: number;
  isRequired: boolean;
}>> {
  const tables = getTables();

  // 1. Get the product's category for the fallback lookup.
  const [product] = await database
    .select({ category: tables.items.category })
    .from(tables.items)
    .where(eq(tables.items.id, productId))
    .limit(1);
  const productCategory = product?.category as string | null | undefined;

  // 2. Product-specific panel rows.
  const productPanels = await database
    .select({
      criteriaId: tables.panels.criteriaId,
      sequence: tables.panels.sequence,
      isRequired: tables.panels.isRequired,
    })
    .from(tables.panels)
    .where(and(
      eq(tables.panels.productId, productId),
      eq(tables.panels.isActive, true),
    ))
    .orderBy(asc(tables.panels.sequence));

  if (productPanels.length > 0) {
    return productPanels.map((p: any) => ({
      criteriaId: Number(p.criteriaId),
      sequence: Number(p.sequence) || 1,
      isRequired: Boolean(p.isRequired),
    }));
  }

  // 3. Fallback to category-level (productId IS NULL) rules.
  if (productCategory) {
    const catPanels = await database
      .select({
        criteriaId: tables.panels.criteriaId,
        sequence: tables.panels.sequence,
        isRequired: tables.panels.isRequired,
      })
      .from(tables.panels)
      .where(and(
        isNull(tables.panels.productId),
        eq(tables.panels.productCategory, productCategory),
        eq(tables.panels.isActive, true),
      ))
      .orderBy(asc(tables.panels.sequence));
    return catPanels.map((p: any) => ({
      criteriaId: Number(p.criteriaId),
      sequence: Number(p.sequence) || 1,
      isRequired: Boolean(p.isRequired),
    }));
  }

  return [];
}

/**
 * Hydrate spec snapshot fields onto a qc_sample_tests row from the master
 * ipc_criteria record. Used when seeding a panel or when adding a custom
 * test from the UI without explicit spec values.
 */
async function loadCriteriaSnapshot(
  database: any,
  criteriaId: number,
): Promise<{
  specMin: number | null;
  specMax: number | null;
  specTarget: number | null;
  specText: string | null;
  unit: string | null;
  testMethod: string | null;
}> {
  const tables = getTables();
  const [c] = await database
    .select({
      minValue: tables.criteria.minValue,
      maxValue: tables.criteria.maxValue,
      specTarget: tables.criteria.specTarget,
      specification: tables.criteria.specification,
      unit: tables.criteria.unit,
      testMethod: tables.criteria.testMethod,
    })
    .from(tables.criteria)
    .where(eq(tables.criteria.id, criteriaId))
    .limit(1);
  if (!c) {
    return {
      specMin: null,
      specMax: null,
      specTarget: null,
      specText: null,
      unit: null,
      testMethod: null,
    };
  }
  return {
    specMin: c.minValue != null ? Number(c.minValue) : null,
    specMax: c.maxValue != null ? Number(c.maxValue) : null,
    specTarget: c.specTarget != null ? Number(c.specTarget) : null,
    specText: c.specification ?? null,
    unit: c.unit ?? null,
    testMethod: c.testMethod ?? null,
  };
}

// State machine — what transitions are allowed from each status?
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['registered', 'rejected', 'quarantine'],
  registered: ['testing', 'rejected', 'quarantine'],
  testing: ['reviewed', 'rejected', 'quarantine', 'oos'],
  reviewed: ['approved', 'rejected', 'quarantine'],
  approved: ['released', 'rejected', 'quarantine'],
  released: [], // terminal
  rejected: [],
  quarantine: ['testing', 'rejected'], // released-from-quarantine for re-test
  oos: ['rejected', 'testing'],
};

const ACTION_TO_STATUS: Record<SampleAction, SampleStatus> = {
  start_testing: 'testing',
  submit_for_review: 'reviewed',
  approve: 'approved',
  release: 'released',
  reject: 'rejected',
  quarantine: 'quarantine',
  flag_oos: 'oos',
};

// ----------------------------------------------------------------------------
// 1. createQcSample
// ----------------------------------------------------------------------------

export interface CreateQcSampleResult {
  sampleId: number;
  sampleNumber: string;
  status: 'registered';
  testsSeeded: number;
  // Audit QC2/QC3 — populated when sampleQty/retainSampleQty were provided
  sourceLotId?: number | null;
  retainLotId?: number | null;
  retainExpiryDate?: string | null;
}

export async function createQcSample(
  input: CreateQcSampleInput,
): Promise<CreateQcSampleResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Verify product exists.
    const [product] = await db
      .select({ id: tables.items.id })
      .from(tables.items)
      .where(eq(tables.items.id, input.productId))
      .limit(1);
    if (!product) {
      throw new Error(`Product ${input.productId} not found`);
    }

    // 2. Generate sample number.
    const sampleNumber = await generateSampleNumber(db);
    const now = getNow();

    // 3. Insert sample header. Skip 'draft' — go straight to 'registered'
    //    so it appears on the testing queue immediately.
    const insertResult = await db.insert(tables.samples).values({
      sampleNumber,
      sourceType: input.sourceType,
      sourceRefId: input.sourceRefId ?? null,
      sourceRefText: input.sourceRefText ?? null,
      productId: input.productId,
      lotNumber: input.lotNumber ?? null,
      manufactureDate: input.manufactureDate ? toDbDate(input.manufactureDate) : null,
      expiryDate: input.expiryDate ? toDbDate(input.expiryDate) : null,
      retestDate: input.retestDate ? toDbDate(input.retestDate) : null,
      quantityReceived: input.quantityReceived ?? null,
      unit: input.unit ?? null,
      storageConditions: input.storageConditions ?? null,
      customerId: input.customerId ?? null,
      salesOrderRef: input.salesOrderRef ?? null,
      receivedDate: toDbDate(input.receivedDate),
      receivedBy: input.receivedBy,
      requestedBy: input.requestedBy ?? null,
      purpose: input.purpose ?? null,
      status: 'registered',
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
    const sampleId = Number(getInsertId(insertResult));

    // 4. Optionally seed tests from matching panel.
    let testsSeeded = 0;
    if (input.applyDefaultPanel !== false) {
      const panelRows = await resolvePanelRows(db, input.productId);
      for (const p of panelRows) {
        const snap = await loadCriteriaSnapshot(db, p.criteriaId);
        await db.insert(tables.tests).values({
          sampleId,
          criteriaId: p.criteriaId,
          sequence: p.sequence,
          specMin: snap.specMin,
          specMax: snap.specMax,
          specTarget: snap.specTarget,
          specText: snap.specText,
          unit: snap.unit,
          testMethod: snap.testMethod,
          resultStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        });
        testsSeeded++;
      }
    }

    // Audit QC2/QC3 — issue sample qty from source lot + create retain lot.
    // Wrapped in try/catch so a missing source lot is surfaced as a 400 by
    // the API layer but doesn't roll back the sample header (operator can
    // still attach a lot afterwards).
    let issueResult: {
      sourceLotId: number | null;
      retainLotId: number | null;
      retainExpiryDate: string | null;
    } = { sourceLotId: null, retainLotId: null, retainExpiryDate: null };
    if (
      (Number(input.sampleQty) > 0 || Number(input.retainSampleQty) > 0) &&
      (input.sourceLotId || input.lotNumber)
    ) {
      const { issueSampleFromLot } = await import('./qc-sample-issue.service');
      const result = await issueSampleFromLot({
        sampleId,
        sampleNumber,
        productId: input.productId,
        sourceLotId: input.sourceLotId ?? null,
        lotNumber: input.lotNumber ?? null,
        sampleQty: input.sampleQty ?? null,
        retainSampleQty: input.retainSampleQty ?? null,
        userId: input.receivedBy,
      });
      issueResult = result;

      // Persist the lot refs + retain expiry onto qc_samples for the eBMR.
      await db
        .update(tables.samples)
        .set({
          sourceLotId: result.sourceLotId,
          sampleQty: input.sampleQty ?? null,
          retainSampleQty: input.retainSampleQty ?? null,
          retainLotId: result.retainLotId,
          retainExpiryDate: result.retainExpiryDate
            ? toDbDate(result.retainExpiryDate)
            : null,
          updatedAt: getNow(),
        })
        .where(eq(tables.samples.id, sampleId));
    }

    return {
      sampleId,
      sampleNumber,
      status: 'registered' as const,
      testsSeeded,
      sourceLotId: issueResult.sourceLotId,
      retainLotId: issueResult.retainLotId,
      retainExpiryDate: issueResult.retainExpiryDate,
    };
  });
}

// ----------------------------------------------------------------------------
// 2. getQcSampleById
// ----------------------------------------------------------------------------

export async function getQcSampleById(
  id: number,
): Promise<QcSampleDetail | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Header with joins for product + customer + receivedBy.
    const headerRows = await db
      .select({
        id: tables.samples.id,
        sampleNumber: tables.samples.sampleNumber,
        sourceType: tables.samples.sourceType,
        sourceRefId: tables.samples.sourceRefId,
        sourceRefText: tables.samples.sourceRefText,
        // Needed to fall back to the GRN line's mfg/expiry when the sample's own
        // snapshot is empty (see below).
        sourceGrnLineId: tables.samples.sourceGrnLineId,
        productId: tables.samples.productId,
        productCode: tables.items.code,
        productName: tables.items.nameTh,
        productNameEn: tables.items.nameEn,
        lotNumber: tables.samples.lotNumber,
        manufactureDate: tables.samples.manufactureDate,
        expiryDate: tables.samples.expiryDate,
        retestDate: tables.samples.retestDate,
        quantityReceived: tables.samples.quantityReceived,
        unit: tables.samples.unit,
        storageConditions: tables.samples.storageConditions,
        customerId: tables.samples.customerId,
        customerName: tables.customers.name,
        salesOrderRef: tables.samples.salesOrderRef,
        receivedDate: tables.samples.receivedDate,
        receivedBy: tables.samples.receivedBy,
        receivedByName: tables.users.name,
        status: tables.samples.status,
        notes: tables.samples.notes,
        createdAt: tables.samples.createdAt,
        updatedAt: tables.samples.updatedAt,
      })
      .from(tables.samples)
      .leftJoin(tables.items, eq(tables.samples.productId, tables.items.id))
      .leftJoin(tables.customers, eq(tables.samples.customerId, tables.customers.id))
      .leftJoin(tables.users, eq(tables.samples.receivedBy, tables.users.id))
      .where(eq(tables.samples.id, id))
      .limit(1);

    const header = headerRows[0] as any;
    if (!header) return null;

    // Mfg / expiry are snapshotted onto the sample when the receipt checklist is
    // signed. If the receiver had not filled them in yet at that moment (or fills
    // them in afterwards) the snapshot stays NULL and the QC screen showed "—"
    // forever. Fall back to the source GRN line, which is the record of truth for
    // the physical goods, so the dates appear as soon as they exist.
    if ((header.manufactureDate == null || header.expiryDate == null) && header.sourceGrnLineId != null) {
      const grnLines = getTableRef('goodsReceiptLines');
      const lineRows = await db
        .select({
          manufacturingDate: grnLines.manufacturingDate,
          expiryDate: grnLines.expiryDate,
        })
        .from(grnLines)
        .where(eq(grnLines.id, Number(header.sourceGrnLineId)))
        .limit(1);
      if (lineRows[0]) {
        header.manufactureDate = header.manufactureDate ?? lineRows[0].manufacturingDate ?? null;
        header.expiryDate = header.expiryDate ?? lineRows[0].expiryDate ?? null;
      }
    }

    // Tests + criteria join + tested/reviewed user names.
    // Pulls master-data settings (criteriaType, sampleSize, tolerance, retest)
    // so the recording UI can adapt to whatever the criteria defines.
    const testRows = await db
      .select({
        id: tables.tests.id,
        sampleId: tables.tests.sampleId,
        criteriaId: tables.tests.criteriaId,
        criteriaCode: tables.criteria.code,
        criteriaName: tables.criteria.name,
        criteriaNameTh: tables.criteria.nameTh,
        criteriaType: tables.criteria.criteriaType,
        criteriaSampleSize: tables.criteria.sampleSize,
        criteriaTolerancePercent: tables.criteria.tolerancePercent,
        criteriaMaxRetestRounds: tables.criteria.maxRetestRounds,
        criteriaAcceptanceStages: tables.criteria.acceptanceStages,
        criteriaSpecSpecification: tables.criteria.specification,
        sequence: tables.tests.sequence,
        specMin: tables.tests.specMin,
        specMax: tables.tests.specMax,
        specTarget: tables.tests.specTarget,
        specText: tables.tests.specText,
        unit: tables.tests.unit,
        testMethod: tables.tests.testMethod,
        numericResult: tables.tests.numericResult,
        textResult: tables.tests.textResult,
        resultStatus: tables.tests.resultStatus,
        testedBy: tables.tests.testedBy,
        testedAt: tables.tests.testedAt,
        reviewedBy: tables.tests.reviewedBy,
        reviewedAt: tables.tests.reviewedAt,
        notes: tables.tests.notes,
        attachmentPath: tables.tests.attachmentPath,
      })
      .from(tables.tests)
      .leftJoin(tables.criteria, eq(tables.tests.criteriaId, tables.criteria.id))
      .where(eq(tables.tests.sampleId, id))
      .orderBy(asc(tables.tests.sequence), asc(tables.tests.id));

    // Per-test sample readings (rounds + per-sample values). Loaded in one
    // batched query to avoid N+1 against qc_sample_test_samples.
    const sampleTestIdList = (testRows as any[]).map((t) => Number(t.id));
    const sampleRows = sampleTestIdList.length > 0
      ? await db
          .select({
            sampleTestId: tables.testSamples.sampleTestId,
            sampleNumber: tables.testSamples.sampleNumber,
            testRound: tables.testSamples.testRound,
            numericValue: tables.testSamples.numericValue,
            textValue: tables.testSamples.textValue,
            result: tables.testSamples.result,
          })
          .from(tables.testSamples)
          .where(inArray(tables.testSamples.sampleTestId, sampleTestIdList))
          .orderBy(
            asc(tables.testSamples.sampleTestId),
            asc(tables.testSamples.testRound),
            asc(tables.testSamples.sampleNumber),
          )
      : [];

    // Group samples by (testId → roundNumber → sample[]).
    const samplesByTest = new Map<number, Map<number, QcSampleTestSampleRow[]>>();
    for (const r of sampleRows as any[]) {
      const tid = Number(r.sampleTestId);
      const round = Number(r.testRound) || 1;
      let byRound = samplesByTest.get(tid);
      if (!byRound) {
        byRound = new Map();
        samplesByTest.set(tid, byRound);
      }
      let arr = byRound.get(round);
      if (!arr) {
        arr = [];
        byRound.set(round, arr);
      }
      arr.push({
        sampleNumber: Number(r.sampleNumber) || 1,
        numericValue: r.numericValue != null ? Number(r.numericValue) : null,
        textValue: r.textValue ?? null,
        result: (r.result === 'pass' || r.result === 'fail') ? r.result : null,
      });
    }

    // Tested/reviewed names — single-batch lookup.
    const userIds: number[] = [];
    for (const t of testRows as any[]) {
      if (t.testedBy != null) userIds.push(Number(t.testedBy));
      if (t.reviewedBy != null) userIds.push(Number(t.reviewedBy));
    }
    const uniqUserIds = Array.from(new Set(userIds));
    const userMap = new Map<number, string>();
    if (uniqUserIds.length > 0) {
      const userRows = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(inArray(tables.users.id, uniqUserIds));
      for (const u of userRows as any[]) {
        userMap.set(Number(u.id), String(u.name));
      }
    }

    const tests: QcSampleTestRow[] = (testRows as any[]).map((t) => {
      const tid = Number(t.id);
      const tolerance = t.criteriaTolerancePercent != null ? Number(t.criteriaTolerancePercent) : 0;
      const byRound = samplesByTest.get(tid);
      const rounds: QcSampleTestRoundRow[] = [];
      if (byRound) {
        const sortedRoundNums = Array.from(byRound.keys()).sort((a, b) => a - b);
        for (const r of sortedRoundNums) {
          const samples = byRound.get(r)!;
          const numericVals = samples
            .map((s) => s.numericValue)
            .filter((v): v is number => v != null && Number.isFinite(v));
          const avg = numericVals.length > 0
            ? numericVals.reduce((a, b) => a + b, 0) / numericVals.length
            : null;
          rounds.push({
            roundNumber: r,
            samples,
            avg,
            result: computeRoundResult(samples, tolerance),
          });
        }
      }
      return {
        id: tid,
        sampleId: Number(t.sampleId),
        criteriaId: Number(t.criteriaId),
        criteriaCode: t.criteriaCode ?? null,
        criteriaName: t.criteriaName ?? null,
        criteriaNameTh: t.criteriaNameTh ?? null,
        criteriaType: t.criteriaType ?? null,
        criteriaSampleSize: t.criteriaSampleSize != null ? Number(t.criteriaSampleSize) : null,
        criteriaTolerancePercent: t.criteriaTolerancePercent != null ? Number(t.criteriaTolerancePercent) : null,
        criteriaMaxRetestRounds: t.criteriaMaxRetestRounds != null ? Number(t.criteriaMaxRetestRounds) : null,
        criteriaAcceptanceStages: t.criteriaAcceptanceStages ?? null,
        criteriaSpecSpecification: t.criteriaSpecSpecification ?? null,
        sequence: Number(t.sequence) || 1,
        specMin: t.specMin != null ? Number(t.specMin) : null,
        specMax: t.specMax != null ? Number(t.specMax) : null,
        specTarget: t.specTarget != null ? Number(t.specTarget) : null,
        specText: t.specText ?? null,
        unit: t.unit ?? null,
        testMethod: t.testMethod ?? null,
        numericResult: t.numericResult != null ? Number(t.numericResult) : null,
        textResult: t.textResult ?? null,
        resultStatus: String(t.resultStatus || 'pending'),
        testedBy: t.testedBy != null ? Number(t.testedBy) : null,
        testedByName: t.testedBy != null ? userMap.get(Number(t.testedBy)) ?? null : null,
        testedAt: t.testedAt ?? null,
        reviewedBy: t.reviewedBy != null ? Number(t.reviewedBy) : null,
        reviewedByName: t.reviewedBy != null ? userMap.get(Number(t.reviewedBy)) ?? null : null,
        reviewedAt: t.reviewedAt ?? null,
        notes: t.notes ?? null,
        attachmentPath: t.attachmentPath ?? null,
        rounds,
        totalRounds: rounds.length > 0 ? rounds[rounds.length - 1].roundNumber : 0,
      };
    });

    // Signatures
    const sigRows = await db
      .select({
        id: tables.signatures.id,
        role: tables.signatures.role,
        userId: tables.signatures.userId,
        userName: tables.users.name,
        signedAt: tables.signatures.signedAt,
        signatureMeaning: tables.signatures.signatureMeaning,
        notes: tables.signatures.notes,
      })
      .from(tables.signatures)
      .leftJoin(tables.users, eq(tables.signatures.userId, tables.users.id))
      .where(eq(tables.signatures.sampleId, id));

    const signatures: QcSampleSignatureRow[] = (sigRows as any[]).map((s) => ({
      id: Number(s.id),
      role: String(s.role),
      userId: Number(s.userId),
      userName: s.userName ?? null,
      signedAt: s.signedAt,
      signatureMeaning: s.signatureMeaning ?? null,
      notes: s.notes ?? null,
    }));

    // OOS investigations linked via sample tests.
    const testIds = tests.map((t) => t.id);
    let oosRows: any[] = [];
    if (testIds.length > 0) {
      oosRows = await db
        .select({
          id: tables.oos.id,
          sampleTestId: tables.oos.sampleTestId,
          initiatedBy: tables.oos.initiatedBy,
          initiatedByName: tables.users.name,
          initiatedAt: tables.oos.initiatedAt,
          classification: tables.oos.classification,
          retestAuthorized: tables.oos.retestAuthorized,
          closedAt: tables.oos.closedAt,
          conclusion: tables.oos.conclusion,
        })
        .from(tables.oos)
        .leftJoin(tables.users, eq(tables.oos.initiatedBy, tables.users.id))
        .where(inArray(tables.oos.sampleTestId, testIds));
    }
    const oosInvestigations: QcSampleOosRow[] = oosRows.map((o) => ({
      id: Number(o.id),
      sampleTestId: Number(o.sampleTestId),
      initiatedBy: Number(o.initiatedBy),
      initiatedByName: o.initiatedByName ?? null,
      initiatedAt: o.initiatedAt,
      classification: o.classification ?? null,
      retestAuthorized: Boolean(o.retestAuthorized),
      closedAt: o.closedAt ?? null,
      conclusion: o.conclusion ?? null,
    }));

    // Linked COA — most recent (descending) record matching this sampleId.
    const coaRows = await db
      .select({
        id: tables.coa.id,
        coaNumber: tables.coa.coaNumber,
        status: tables.coa.status,
      })
      .from(tables.coa)
      .where(eq(tables.coa.sampleId, id))
      .orderBy(desc(tables.coa.id))
      .limit(1);
    const linkedCoa = coaRows[0]
      ? {
          id: Number(coaRows[0].id),
          coaNumber: String(coaRows[0].coaNumber),
          status: String(coaRows[0].status),
        }
      : null;

    return {
      id: Number(header.id),
      sampleNumber: String(header.sampleNumber),
      sourceType: String(header.sourceType),
      sourceRefId: header.sourceRefId != null ? Number(header.sourceRefId) : null,
      sourceRefText: header.sourceRefText ?? null,
      productId: Number(header.productId),
      productCode: header.productCode ?? null,
      productName: header.productName ?? null,
      productNameEn: header.productNameEn ?? null,
      lotNumber: header.lotNumber ?? null,
      manufactureDate: header.manufactureDate ?? null,
      expiryDate: header.expiryDate ?? null,
      retestDate: header.retestDate ?? null,
      quantityReceived: header.quantityReceived != null ? Number(header.quantityReceived) : null,
      unit: header.unit ?? null,
      storageConditions: header.storageConditions ?? null,
      customerId: header.customerId != null ? Number(header.customerId) : null,
      customerName: header.customerName ?? null,
      salesOrderRef: header.salesOrderRef ?? null,
      receivedDate: header.receivedDate,
      receivedBy: Number(header.receivedBy),
      receivedByName: header.receivedByName ?? null,
      status: String(header.status),
      notes: header.notes ?? null,
      createdAt: header.createdAt,
      updatedAt: header.updatedAt,
      tests,
      signatures,
      oosInvestigations,
      linkedCoa,
    };
  });
}

// ----------------------------------------------------------------------------
// 3. listQcSamples
// ----------------------------------------------------------------------------

export async function listQcSamples(
  filters: ListQcSamplesFilters = {},
): Promise<QcSampleListResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 50;

    const conds: any[] = [];
    if (filters.status) conds.push(eq(tables.samples.status, filters.status));
    if (filters.sourceType) conds.push(eq(tables.samples.sourceType, filters.sourceType));
    if (filters.productId) conds.push(eq(tables.samples.productId, filters.productId));
    if (filters.customerId) conds.push(eq(tables.samples.customerId, filters.customerId));
    if (filters.lotNumber) conds.push(like(tables.samples.lotNumber, `%${filters.lotNumber}%`));
    if (filters.dateFrom) {
      conds.push(gte(tables.samples.receivedDate, toQueryDate(filters.dateFrom) as any));
    }
    if (filters.dateTo) {
      conds.push(lte(tables.samples.receivedDate, toQueryDate(filters.dateTo) as any));
    }
    if (filters.search) {
      const q = `%${filters.search}%`;
      conds.push(
        or(
          like(tables.samples.sampleNumber, q),
          like(tables.samples.lotNumber, q),
          like(tables.samples.sourceRefText, q),
        ),
      );
    }
    const where = conds.length > 0 ? and(...conds) : undefined;

    // Count
    let countQuery = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tables.samples);
    if (where) countQuery = countQuery.where(where);
    const totalRow = await countQuery;
    const total = Number(totalRow[0]?.count ?? 0);

    // Page
    let pageQuery = db
      .select({
        id: tables.samples.id,
        sampleNumber: tables.samples.sampleNumber,
        sourceType: tables.samples.sourceType,
        productId: tables.samples.productId,
        productCode: tables.items.code,
        productName: tables.items.nameTh,
        lotNumber: tables.samples.lotNumber,
        customerId: tables.samples.customerId,
        customerName: tables.customers.name,
        receivedDate: tables.samples.receivedDate,
        receivedBy: tables.samples.receivedBy,
        receivedByName: tables.users.name,
        status: tables.samples.status,
        createdAt: tables.samples.createdAt,
        updatedAt: tables.samples.updatedAt,
      })
      .from(tables.samples)
      .leftJoin(tables.items, eq(tables.samples.productId, tables.items.id))
      .leftJoin(tables.customers, eq(tables.samples.customerId, tables.customers.id))
      .leftJoin(tables.users, eq(tables.samples.receivedBy, tables.users.id));
    if (where) pageQuery = pageQuery.where(where);
    const headers = await pageQuery
      .orderBy(desc(tables.samples.id))
      .limit(limit)
      .offset((page - 1) * limit);

    if (headers.length === 0) {
      return { items: [], total, page, limit };
    }

    // Test counts — single GROUP BY, then merge.
    const sampleIds = (headers as any[]).map((h) => Number(h.id));
    const counts = await db
      .select({
        sampleId: tables.tests.sampleId,
        resultStatus: tables.tests.resultStatus,
        n: sql<number>`COUNT(*)`,
      })
      .from(tables.tests)
      .where(inArray(tables.tests.sampleId, sampleIds))
      .groupBy(tables.tests.sampleId, tables.tests.resultStatus);
    const countMap = new Map<number, { total: number; pending: number; pass: number; fail: number }>();
    for (const id of sampleIds) {
      countMap.set(id, { total: 0, pending: 0, pass: 0, fail: 0 });
    }
    for (const c of counts as any[]) {
      const slot = countMap.get(Number(c.sampleId));
      if (!slot) continue;
      const n = Number(c.n) || 0;
      slot.total += n;
      const status = String(c.resultStatus);
      if (status === 'pending') slot.pending += n;
      else if (status === 'pass') slot.pass += n;
      else if (status === 'fail') slot.fail += n;
    }

    const items: QcSampleListRow[] = (headers as any[]).map((h) => ({
      id: Number(h.id),
      sampleNumber: String(h.sampleNumber),
      sourceType: String(h.sourceType),
      productId: Number(h.productId),
      productCode: h.productCode ?? null,
      productName: h.productName ?? null,
      lotNumber: h.lotNumber ?? null,
      customerId: h.customerId != null ? Number(h.customerId) : null,
      customerName: h.customerName ?? null,
      receivedDate: h.receivedDate,
      receivedBy: Number(h.receivedBy),
      receivedByName: h.receivedByName ?? null,
      status: String(h.status),
      testCounts: countMap.get(Number(h.id)) ?? { total: 0, pending: 0, pass: 0, fail: 0 },
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    }));

    return { items, total, page, limit };
  });
}

// ----------------------------------------------------------------------------
// 4. updateQcSample
// ----------------------------------------------------------------------------

export async function updateQcSample(
  id: number,
  updates: UpdateQcSampleInput,
): Promise<{ updated: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const [existing] = await db
      .select({ id: tables.samples.id, status: tables.samples.status })
      .from(tables.samples)
      .where(eq(tables.samples.id, id))
      .limit(1);
    if (!existing) {
      throw new Error(`Sample ${id} not found`);
    }
    // 21 CFR Part 11: post-release records are immutable.
    if (existing.status === 'approved' || existing.status === 'released') {
      throw new Error(
        `Sample is ${existing.status} — metadata cannot be edited after approval (21 CFR Part 11)`,
      );
    }

    const set: Record<string, any> = {
      updatedAt: getNow(),
    };
    const allowed: (keyof UpdateQcSampleInput)[] = [
      'sourceType',
      'sourceRefId',
      'sourceRefText',
      'lotNumber',
      'manufactureDate',
      'expiryDate',
      'retestDate',
      'quantityReceived',
      'unit',
      'storageConditions',
      'customerId',
      'salesOrderRef',
      'receivedDate',
      'notes',
    ];
    const dateFields = new Set(['manufactureDate', 'expiryDate', 'retestDate', 'receivedDate']);
    for (const k of allowed) {
      if (updates[k] !== undefined) {
        const v = updates[k];
        set[k] = (dateFields.has(k) && v != null && v !== '')
          ? toDbDate(v as string | Date)
          : v;
      }
    }

    await db.update(tables.samples).set(set).where(eq(tables.samples.id, id));
    return { updated: true };
  });
}

// ----------------------------------------------------------------------------
// 5. addOrUpdateTest (upsert)
// ----------------------------------------------------------------------------

export interface AddOrUpdateTestResult {
  testId: number;
  resultStatus: string;
  inserted: boolean;
}

/** Compute round-level pass/fail from per-sample results + tolerance %. */
function computeRoundResult(
  samples: Array<{ result?: 'pass' | 'fail' | null | undefined }>,
  tolerancePercent: number,
): 'pass' | 'fail' | 'pending' {
  const filled = samples.filter((s) => s.result === 'pass' || s.result === 'fail');
  if (filled.length === 0) return 'pending';
  const failCount = filled.filter((s) => s.result === 'fail').length;
  const failPct = (failCount / filled.length) * 100;
  return failPct <= tolerancePercent ? 'pass' : 'fail';
}

/** Evaluate a single numeric reading against the spec range. */
function evaluateSampleResult(
  numericValue: number | null | undefined,
  textValue: string | null | undefined,
  explicitResult: 'pass' | 'fail' | null | undefined,
  specMin: number | null | undefined,
  specMax: number | null | undefined,
): 'pass' | 'fail' | null {
  if (explicitResult === 'pass' || explicitResult === 'fail') return explicitResult;
  if (numericValue == null && (textValue == null || textValue === '')) return null;
  if (numericValue != null && Number.isFinite(numericValue)) {
    if (specMin == null && specMax == null) return null;
    if (specMin != null && numericValue < Number(specMin) - SPEC_EPSILON) return 'fail';
    if (specMax != null && numericValue > Number(specMax) + SPEC_EPSILON) return 'fail';
    return 'pass';
  }
  // Plain text — caller didn't say pass/fail and we can't auto-evaluate.
  return null;
}

export async function addOrUpdateTest(
  input: AddOrUpdateTestInput,
  userId: number,
): Promise<AddOrUpdateTestResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Verify sample is in an editable state.
    const [sample] = await db
      .select({ id: tables.samples.id, status: tables.samples.status })
      .from(tables.samples)
      .where(eq(tables.samples.id, input.sampleId))
      .limit(1);
    if (!sample) {
      throw new Error(`Sample ${input.sampleId} not found`);
    }
    if (sample.status === 'approved' || sample.status === 'released' || sample.status === 'rejected') {
      throw new Error(
        `Sample is ${sample.status} — test results cannot be edited`,
      );
    }

    // 2. Hydrate spec snapshot from criteria when caller didn't supply one.
    const criteriaSnap = await loadCriteriaSnapshot(db, input.criteriaId);
    const specMin = input.specMin ?? criteriaSnap.specMin;
    const specMax = input.specMax ?? criteriaSnap.specMax;
    const specTarget = input.specTarget ?? criteriaSnap.specTarget;
    const specText = input.specText ?? criteriaSnap.specText;
    const unit = input.unit ?? criteriaSnap.unit;
    const testMethod = input.testMethod ?? criteriaSnap.testMethod;

    // Tolerance + retest config from the criteria master record (used when
    // multi-sample input is provided).
    const [criteriaRow] = await db
      .select({
        tolerancePercent: tables.criteria.tolerancePercent,
        maxRetestRounds: tables.criteria.maxRetestRounds,
      })
      .from(tables.criteria)
      .where(eq(tables.criteria.id, input.criteriaId))
      .limit(1);
    const tolerancePercent = Number(criteriaRow?.tolerancePercent ?? 0);
    const maxRetestRounds = Number(criteriaRow?.maxRetestRounds ?? 1);

    const now = getNow();
    const hasSamples = Array.isArray(input.samples) && input.samples.length > 0;

    // When multi-sample readings are supplied, evaluate each sample, derive
    // the round-level pass/fail from tolerance %, and use the average as the
    // canonical numericResult on qc_sample_tests.
    let computedNumericResult: number | null = input.numericResult ?? null;
    const computedTextResult: string | null = input.textResult ?? null;
    let computedResultStatus: string;
    let evaluatedSamples: Array<{
      sampleNumber: number;
      numericValue: number | null;
      textValue: string | null;
      result: 'pass' | 'fail' | null;
    }> = [];

    if (hasSamples) {
      evaluatedSamples = input.samples!.map((s) => ({
        sampleNumber: s.sampleNumber,
        numericValue: s.numericValue ?? null,
        textValue: s.textValue ?? null,
        result: evaluateSampleResult(
          s.numericValue,
          s.textValue,
          s.result ?? null,
          specMin ?? null,
          specMax ?? null,
        ),
      }));
      const numericValues = evaluatedSamples
        .map((s) => s.numericValue)
        .filter((v): v is number => v != null && Number.isFinite(v));
      computedNumericResult =
        numericValues.length > 0
          ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
          : null;
      computedResultStatus = computeRoundResult(evaluatedSamples, tolerancePercent);
    } else {
      computedResultStatus = computeResultStatus({
        numericResult: computedNumericResult,
        textResult: computedTextResult,
        specMin,
        specMax,
        specTarget,
      });
    }

    const hasResult =
      hasSamples ||
      (computedNumericResult != null && Number.isFinite(computedNumericResult)) ||
      (computedTextResult != null && String(computedTextResult).trim().length > 0);

    // 4a. Update existing row.
    if (input.testId) {
      const [existing] = await db
        .select({
          id: tables.tests.id,
          sampleId: tables.tests.sampleId,
          reviewedBy: tables.tests.reviewedBy,
        })
        .from(tables.tests)
        .where(eq(tables.tests.id, input.testId))
        .limit(1);
      if (!existing) {
        throw new Error(`Test ${input.testId} not found`);
      }
      if (Number(existing.sampleId) !== input.sampleId) {
        throw new Error(
          `Test ${input.testId} does not belong to sample ${input.sampleId}`,
        );
      }
      if (existing.reviewedBy != null) {
        throw new Error(
          `Test has been reviewed and cannot be edited (21 CFR Part 11)`,
        );
      }

      // Determine the test round we are recording. When samples are supplied:
      //   - explicit testRound from caller (e.g. editing an existing round) wins
      //   - otherwise default to (max existing round + 1) — but cap by criteria's
      //     maxRetestRounds so operators can't bypass the master-data limit.
      let targetRound = input.testRound ?? null;
      if (hasSamples) {
        if (targetRound == null) {
          const [maxRow] = await db
            .select({
              maxRound: sql<number>`COALESCE(MAX(${tables.testSamples.testRound}), 0)`,
            })
            .from(tables.testSamples)
            .where(eq(tables.testSamples.sampleTestId, input.testId));
          const maxExisting = Number(maxRow?.maxRound ?? 0);
          targetRound = Math.max(1, maxExisting); // edit latest round by default
          if (maxExisting === 0) targetRound = 1;
        }
        // maxRetestRounds = "number of retests allowed" (per ipc_criteria
        // semantics — see resolveMaxRetestRounds in wo-execution.service.ts).
        // Round 1 is the initial test and is always allowed; rounds 2+ are
        // retests, capped by maxRetestRounds.
        if (targetRound > 1 && targetRound > maxRetestRounds + 1) {
          throw new Error(
            `Round ${targetRound} exceeds the allowed retest count (${maxRetestRounds}) defined on the criteria`,
          );
        }
        // Replace any existing samples for this round to keep the per-round
        // history clean (avoid orphaned partial readings).
        await db
          .delete(tables.testSamples)
          .where(
            and(
              eq(tables.testSamples.sampleTestId, input.testId),
              eq(tables.testSamples.testRound, targetRound),
            ),
          );
        for (const s of evaluatedSamples) {
          await db.insert(tables.testSamples).values({
            sampleTestId: input.testId,
            sampleNumber: s.sampleNumber,
            testRound: targetRound,
            numericValue: s.numericValue,
            textValue: s.textValue,
            result: s.result,
            createdAt: now,
          });
        }
      }

      await db
        .update(tables.tests)
        .set({
          criteriaId: input.criteriaId,
          sequence: input.sequence,
          specMin,
          specMax,
          specTarget,
          specText,
          unit,
          testMethod,
          numericResult: computedNumericResult,
          textResult: computedTextResult,
          resultStatus: computedResultStatus,
          testedBy: hasResult ? userId : null,
          testedAt: hasResult ? now : null,
          notes: input.notes ?? null,
          attachmentPath: input.attachmentPath ?? null,
          updatedAt: now,
        })
        .where(eq(tables.tests.id, input.testId));

      return { testId: input.testId, resultStatus: computedResultStatus, inserted: false };
    }

    // 4b. Insert new row.
    const insertResult = await db.insert(tables.tests).values({
      sampleId: input.sampleId,
      criteriaId: input.criteriaId,
      sequence: input.sequence,
      specMin,
      specMax,
      specTarget,
      specText,
      unit,
      testMethod,
      numericResult: computedNumericResult,
      textResult: computedTextResult,
      resultStatus: computedResultStatus,
      testedBy: hasResult ? userId : null,
      testedAt: hasResult ? now : null,
      notes: input.notes ?? null,
      attachmentPath: input.attachmentPath ?? null,
      createdAt: now,
      updatedAt: now,
    });
    const testId = Number(getInsertId(insertResult));

    // When samples were supplied alongside the insert, persist them under
    // round 1 (or the explicit testRound from the caller).
    if (hasSamples) {
      const targetRound = input.testRound ?? 1;
      if (targetRound > maxRetestRounds) {
        throw new Error(
          `Round ${targetRound} exceeds maxRetestRounds (${maxRetestRounds}) defined on the criteria`,
        );
      }
      for (const s of evaluatedSamples) {
        await db.insert(tables.testSamples).values({
          sampleTestId: testId,
          sampleNumber: s.sampleNumber,
          testRound: targetRound,
          numericValue: s.numericValue,
          textValue: s.textValue,
          result: s.result,
          createdAt: now,
        });
      }
    }

    return { testId, resultStatus: computedResultStatus, inserted: true };
  });
}

// ----------------------------------------------------------------------------
// 6. deleteTest
// ----------------------------------------------------------------------------

export async function deleteTest(
  sampleId: number,
  testId: number,
): Promise<{ deleted: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const [test] = await db
      .select({
        id: tables.tests.id,
        sampleId: tables.tests.sampleId,
        reviewedBy: tables.tests.reviewedBy,
      })
      .from(tables.tests)
      .where(eq(tables.tests.id, testId))
      .limit(1);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }
    if (Number(test.sampleId) !== sampleId) {
      throw new Error(`Test ${testId} does not belong to sample ${sampleId}`);
    }
    if (test.reviewedBy != null) {
      throw new Error(
        `Test has been reviewed and cannot be deleted (21 CFR Part 11)`,
      );
    }
    const result = await db
      .delete(tables.tests)
      .where(eq(tables.tests.id, testId));
    return { deleted: getAffectedRows(result) > 0 };
  });
}

// ----------------------------------------------------------------------------
// 7. applyTestPanel
// ----------------------------------------------------------------------------

export interface ApplyTestPanelResult {
  added: number;
  skipped: number;
}

export async function applyTestPanel(
  sampleId: number,
  panelKey: number | string,
): Promise<ApplyTestPanelResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const [sample] = await db
      .select({
        id: tables.samples.id,
        productId: tables.samples.productId,
        status: tables.samples.status,
      })
      .from(tables.samples)
      .where(eq(tables.samples.id, sampleId))
      .limit(1);
    if (!sample) {
      throw new Error(`Sample ${sampleId} not found`);
    }
    if (sample.status === 'approved' || sample.status === 'released' || sample.status === 'rejected') {
      throw new Error(`Sample is ${sample.status} — cannot apply panel`);
    }

    // Resolve panel rows. If panelKey is numeric, match by panel.id (returning
    // the single row). If it's a string, treat it as productCategory.
    let panelRows: Array<{
      criteriaId: number;
      sequence: number;
      isRequired: boolean;
    }>;
    if (typeof panelKey === 'number') {
      const rows = await db
        .select({
          criteriaId: tables.panels.criteriaId,
          sequence: tables.panels.sequence,
          isRequired: tables.panels.isRequired,
        })
        .from(tables.panels)
        .where(and(
          eq(tables.panels.id, panelKey),
          eq(tables.panels.isActive, true),
        ));
      panelRows = rows.map((p: any) => ({
        criteriaId: Number(p.criteriaId),
        sequence: Number(p.sequence) || 1,
        isRequired: Boolean(p.isRequired),
      }));
    } else {
      const rows = await db
        .select({
          criteriaId: tables.panels.criteriaId,
          sequence: tables.panels.sequence,
          isRequired: tables.panels.isRequired,
        })
        .from(tables.panels)
        .where(and(
          eq(tables.panels.productCategory, panelKey),
          eq(tables.panels.isActive, true),
        ))
        .orderBy(asc(tables.panels.sequence));
      panelRows = rows.map((p: any) => ({
        criteriaId: Number(p.criteriaId),
        sequence: Number(p.sequence) || 1,
        isRequired: Boolean(p.isRequired),
      }));
    }

    if (panelRows.length === 0) {
      return { added: 0, skipped: 0 };
    }

    // Skip rows already present (same criteria_id + sequence).
    const existingTests = await db
      .select({
        criteriaId: tables.tests.criteriaId,
        sequence: tables.tests.sequence,
      })
      .from(tables.tests)
      .where(eq(tables.tests.sampleId, sampleId));
    const existingKey = new Set<string>(
      (existingTests as any[]).map(
        (t) => `${Number(t.criteriaId)}::${Number(t.sequence)}`,
      ),
    );

    const now = getNow();
    let added = 0;
    let skipped = 0;
    for (const p of panelRows) {
      const key = `${p.criteriaId}::${p.sequence}`;
      if (existingKey.has(key)) {
        skipped++;
        continue;
      }
      const snap = await loadCriteriaSnapshot(db, p.criteriaId);
      await db.insert(tables.tests).values({
        sampleId,
        criteriaId: p.criteriaId,
        sequence: p.sequence,
        specMin: snap.specMin,
        specMax: snap.specMax,
        specTarget: snap.specTarget,
        specText: snap.specText,
        unit: snap.unit,
        testMethod: snap.testMethod,
        resultStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }

    return { added, skipped };
  });
}

// ----------------------------------------------------------------------------
// 8. updateSampleStatus (state machine)
// ----------------------------------------------------------------------------

export interface UpdateStatusResult {
  sampleId: number;
  fromStatus: string;
  toStatus: string;
}

/**
 * Quality gate (goods-receipt flow item 4): when a QC sample that was created
 * from an incoming GRN line reaches a terminal-quality decision, propagate it
 * back to that goods_receipt_lines row so the warehouse release gate reflects
 * the lab result:
 *   - sample approved/released → line 'qc_pending' → 'qc_approved' (releasable)
 *   - sample rejected          → line              → 'rejected'    (blocked)
 * Best-effort + idempotent: only advances a line still in 'qc_pending', never
 * downgrades a line already released, and never throws into the sample flow.
 */
async function syncGrnLineFromSample(
  db: any,
  sampleId: number,
  toStatus: string,
): Promise<void> {
  const tables = getTables();
  const lines = getTableRef('goodsReceiptLines');

  const target =
    toStatus === 'approved' || toStatus === 'released'
      ? 'qc_approved'
      : toStatus === 'rejected'
        ? 'rejected'
        : null;
  if (!target) return;

  // Resolve the GRN line this sample was drawn from.
  const [sample] = await db
    .select({ grnLineId: tables.samples.sourceGrnLineId })
    .from(tables.samples)
    .where(eq(tables.samples.id, sampleId))
    .limit(1);
  const grnLineId = sample?.grnLineId != null ? Number(sample.grnLineId) : null;
  if (!grnLineId) return; // standalone sample, not from a GRN

  const [line] = await db
    .select({ id: lines.id, status: lines.status })
    .from(lines)
    .where(eq(lines.id, grnLineId))
    .limit(1);
  if (!line) return;
  // Only act while the line is awaiting the lab result. Don't touch lines that
  // are already released/cancelled/rejected.
  if (String(line.status) !== 'qc_pending') return;

  await db
    .update(lines)
    .set({ status: target, updatedAt: getNow() })
    .where(eq(lines.id, grnLineId));
}

export async function updateSampleStatus(
  id: number,
  action: SampleAction,
  userId: number,
  reason?: string | null,
): Promise<UpdateStatusResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [sample] = await db
      .select({ id: tables.samples.id, status: tables.samples.status })
      .from(tables.samples)
      .where(eq(tables.samples.id, id))
      .limit(1);
    if (!sample) {
      throw new Error(`Sample ${id} not found`);
    }

    const fromStatus = String(sample.status);
    const toStatus = ACTION_TO_STATUS[action];
    if (!toStatus) {
      throw new Error(`Unknown action: ${action}`);
    }

    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new Error(
        `Cannot transition from "${fromStatus}" to "${toStatus}" (allowed: ${allowed.join(', ') || 'none'})`,
      );
    }

    if (action === 'reject' && (!reason || reason.trim().length === 0)) {
      throw new Error(`Rejection reason is required`);
    }

    // Phase 3 — guard sign-off-bound transitions. Each tier must have its
    // signature row before the corresponding status change is accepted.
    // Segregation of duties is enforced at signQcSample insert time.
    if (toStatus === 'reviewed') {
      // Basic data-integrity check — at least one test recorded.
      const testedRows = await db
        .select({ id: tables.tests.id })
        .from(tables.tests)
        .where(and(
          eq(tables.tests.sampleId, id),
          sql`${tables.tests.testedBy} IS NOT NULL`,
        ))
        .limit(1);
      if (testedRows.length === 0) {
        throw new Error(
          `At least one test must be recorded (testedBy IS NOT NULL) before submitting for review`,
        );
      }
    }
    if (toStatus === 'approved') {
      // Reviewer signature required, AND reviewer must differ from analyst.
      const sigRows = await db
        .select({
          role: tables.signatures.role,
          userId: tables.signatures.userId,
        })
        .from(tables.signatures)
        .where(eq(tables.signatures.sampleId, id));
      const byRole = new Map<string, number>();
      for (const s of sigRows as any[]) {
        byRole.set(String(s.role), Number(s.userId));
      }
      if (!byRole.has('reviewer')) {
        throw new Error(
          `Reviewer signature is required before approval (21 CFR Part 11)`,
        );
      }
      const analystUser = byRole.get('analyst');
      const reviewerUser = byRole.get('reviewer');
      if (
        analystUser != null &&
        reviewerUser != null &&
        analystUser === reviewerUser
      ) {
        throw new Error(
          `Segregation of duties: analyst and reviewer must be different users`,
        );
      }
    }
    if (toStatus === 'released') {
      // QA release signature required (and approver signature is implied by
      // the previous transition, since the sample reached 'approved').
      const sigRows = await db
        .select({ role: tables.signatures.role })
        .from(tables.signatures)
        .where(eq(tables.signatures.sampleId, id));
      const roles = new Set(
        (sigRows as any[]).map((s) => String(s.role)),
      );
      if (!roles.has('qa_release')) {
        throw new Error(
          `QA release signature is required before releasing the sample (21 CFR Part 11)`,
        );
      }
    }

    const now = getNow();
    const updates: Record<string, any> = {
      status: toStatus,
      updatedAt: now,
    };
    // When rejecting, append the reason to the notes field for an audit-friendly
    // record. Phase 3 will replace this with a dedicated rejection_reason column
    // and 3-tier signature row.
    if (action === 'reject' && reason) {
      const [current] = await db
        .select({ notes: tables.samples.notes })
        .from(tables.samples)
        .where(eq(tables.samples.id, id))
        .limit(1);
      const existingNotes = (current?.notes as string | null) ?? '';
      const stamp = new Date().toISOString();
      const block = `\n[REJECTED ${stamp} by user#${userId}] ${reason}`;
      updates.notes = existingNotes ? `${existingNotes}${block}` : block.trimStart();
    }

    await db.update(tables.samples).set(updates).where(eq(tables.samples.id, id));

    // Quality gate — reflect the lab decision back onto the originating GRN
    // line so the warehouse release gate honours pass/fail (best-effort).
    try {
      await syncGrnLineFromSample(db, id, toStatus);
    } catch (err) {
      console.warn('[qc-sample] GRN line sync failed (non-fatal)', err);
    }

    return { sampleId: id, fromStatus, toStatus };
  });
}

// ----------------------------------------------------------------------------
// 9. deleteQcSample
// ----------------------------------------------------------------------------

export async function deleteQcSample(
  id: number,
): Promise<{ deleted: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [sample] = await db
      .select({ id: tables.samples.id, status: tables.samples.status })
      .from(tables.samples)
      .where(eq(tables.samples.id, id))
      .limit(1);
    if (!sample) {
      throw new Error(`Sample ${id} not found`);
    }
    const status = String(sample.status);
    if (status !== 'draft' && status !== 'registered') {
      throw new Error(
        `Cannot delete sample in status "${status}" — only draft/registered samples can be deleted`,
      );
    }

    // Reject if any test row has a result entered. Pending-only is fine.
    const testRows = await db
      .select({
        id: tables.tests.id,
        resultStatus: tables.tests.resultStatus,
        numericResult: tables.tests.numericResult,
        textResult: tables.tests.textResult,
      })
      .from(tables.tests)
      .where(eq(tables.tests.sampleId, id));
    const hasResults = (testRows as any[]).some(
      (t) =>
        String(t.resultStatus) !== 'pending' ||
        (t.numericResult != null && Number.isFinite(t.numericResult)) ||
        (t.textResult != null && String(t.textResult).trim().length > 0),
    );
    if (hasResults) {
      throw new Error(
        `Cannot delete sample — some tests already have results recorded`,
      );
    }

    // Delete child rows then the parent.
    await db.delete(tables.tests).where(eq(tables.tests.sampleId, id));
    await db.delete(tables.samples).where(eq(tables.samples.id, id));
    return { deleted: true };
  });
}

// ============================================================================
// Test panel master CRUD
// ============================================================================

export interface ListTestPanelsFilters {
  productId?: number;
  productCategory?: string;
  isActive?: boolean;
}

export async function listTestPanels(
  filters: ListTestPanelsFilters = {},
): Promise<TestPanelRow[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const conds: any[] = [];
    if (filters.productId) conds.push(eq(tables.panels.productId, filters.productId));
    if (filters.productCategory) {
      conds.push(eq(tables.panels.productCategory, filters.productCategory));
    }
    if (filters.isActive !== undefined) {
      conds.push(eq(tables.panels.isActive, filters.isActive));
    }
    const where = conds.length > 0 ? and(...conds) : undefined;

    let q = db
      .select({
        id: tables.panels.id,
        productId: tables.panels.productId,
        productCode: tables.items.code,
        productName: tables.items.nameTh,
        productCategory: tables.panels.productCategory,
        criteriaId: tables.panels.criteriaId,
        criteriaCode: tables.criteria.code,
        criteriaName: tables.criteria.name,
        criteriaNameTh: tables.criteria.nameTh,
        criteriaSampleSize: tables.criteria.sampleSize,
        isRequired: tables.panels.isRequired,
        sequence: tables.panels.sequence,
        isActive: tables.panels.isActive,
      })
      .from(tables.panels)
      .leftJoin(tables.items, eq(tables.panels.productId, tables.items.id))
      .leftJoin(tables.criteria, eq(tables.panels.criteriaId, tables.criteria.id));
    if (where) q = q.where(where);
    const rows = await q.orderBy(
      asc(tables.panels.productId),
      asc(tables.panels.sequence),
    );
    return (rows as any[]).map((r) => ({
      id: Number(r.id),
      productId: r.productId != null ? Number(r.productId) : null,
      productCode: r.productCode ?? null,
      productName: r.productName ?? null,
      productCategory: r.productCategory ?? null,
      criteriaId: Number(r.criteriaId),
      criteriaCode: r.criteriaCode ?? null,
      criteriaName: r.criteriaName ?? null,
      criteriaNameTh: r.criteriaNameTh ?? null,
      criteriaSampleSize: r.criteriaSampleSize != null ? Number(r.criteriaSampleSize) : null,
      isRequired: Boolean(r.isRequired),
      sequence: Number(r.sequence) || 1,
      isActive: Boolean(r.isActive),
    }));
  });
}

export async function getTestPanel(id: number): Promise<TestPanelRow | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select({
        id: tables.panels.id,
        productId: tables.panels.productId,
        productCode: tables.items.code,
        productName: tables.items.nameTh,
        productCategory: tables.panels.productCategory,
        criteriaId: tables.panels.criteriaId,
        criteriaCode: tables.criteria.code,
        criteriaName: tables.criteria.name,
        criteriaNameTh: tables.criteria.nameTh,
        criteriaSampleSize: tables.criteria.sampleSize,
        isRequired: tables.panels.isRequired,
        sequence: tables.panels.sequence,
        isActive: tables.panels.isActive,
      })
      .from(tables.panels)
      .leftJoin(tables.items, eq(tables.panels.productId, tables.items.id))
      .leftJoin(tables.criteria, eq(tables.panels.criteriaId, tables.criteria.id))
      .where(eq(tables.panels.id, id))
      .limit(1);
    if (!rows[0]) return null;
    const r: any = rows[0];
    return {
      id: Number(r.id),
      productId: r.productId != null ? Number(r.productId) : null,
      productCode: r.productCode ?? null,
      productName: r.productName ?? null,
      productCategory: r.productCategory ?? null,
      criteriaId: Number(r.criteriaId),
      criteriaCode: r.criteriaCode ?? null,
      criteriaName: r.criteriaName ?? null,
      criteriaNameTh: r.criteriaNameTh ?? null,
      criteriaSampleSize: r.criteriaSampleSize != null ? Number(r.criteriaSampleSize) : null,
      isRequired: Boolean(r.isRequired),
      sequence: Number(r.sequence) || 1,
      isActive: Boolean(r.isActive),
    };
  });
}

export async function createTestPanel(
  input: CreateTestPanelInput,
): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    if (!input.productId && !input.productCategory) {
      throw new Error('productId or productCategory is required');
    }
    const now = getNow();
    const result = await db.insert(tables.panels).values({
      productId: input.productId ?? null,
      productCategory: input.productCategory ?? null,
      criteriaId: input.criteriaId,
      isRequired: input.isRequired ?? true,
      sequence: input.sequence ?? 1,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return { id: Number(getInsertId(result)) };
  });
}

export async function updateTestPanel(
  id: number,
  updates: UpdateTestPanelInput,
): Promise<{ updated: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const set: Record<string, any> = { updatedAt: getNow() };
    if (updates.productId !== undefined) set.productId = updates.productId;
    if (updates.productCategory !== undefined) set.productCategory = updates.productCategory;
    if (updates.criteriaId !== undefined) set.criteriaId = updates.criteriaId;
    if (updates.isRequired !== undefined) set.isRequired = updates.isRequired;
    if (updates.sequence !== undefined) set.sequence = updates.sequence;
    if (updates.isActive !== undefined) set.isActive = updates.isActive;
    await db.update(tables.panels).set(set).where(eq(tables.panels.id, id));
    return { updated: true };
  });
}

export async function deleteTestPanel(
  id: number,
): Promise<{ deleted: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db
      .delete(tables.panels)
      .where(eq(tables.panels.id, id));
    return { deleted: getAffectedRows(result) > 0 };
  });
}

// ============================================================================
// Phase 3 — 3-tier sign-off (21 CFR Part 11)
// ============================================================================

/**
 * Maps a signature role to the status transition it triggers after the
 * signature row is inserted. Each tier advances the sample exactly one step
 * so the NEXT tier's "Sign" button becomes available in the UI:
 *   reviewer   → testing  → reviewed
 *   approver   → reviewed → approved
 *   qa_release → approved → released
 * analyst is captured but does not auto-advance — the sample stays in
 * 'testing' so the reviewer can sign next.
 */
const ROLE_AUTO_TRANSITION: Record<SignatureRole, SampleAction | null> = {
  analyst: null,
  reviewer: 'submit_for_review', // testing → reviewed
  approver: 'approve',           // reviewed → approved
  qa_release: 'release',         // approved → released
};

export interface SignQcSampleParams {
  sampleId: number;
  role: SignatureRole;
  userId: number;
  signatureMeaning: string;
  notes?: string | null;
  ipAddress?: string;
  userAgent?: string;
  /** When provided, server bcrypt-verifies against users.password. */
  passwordReentry?: string;
}

export interface SignQcSampleResult {
  signatureId: number;
  sampleId: number;
  role: SignatureRole;
  userId: number;
  signedAt: string | Date;
  /** Status transition triggered by this signature, if any. */
  transitionedStatus?: { fromStatus: string; toStatus: string };
}

/**
 * Capture an e-signature for a sample at one of the four sign-off tiers.
 *
 * Behaviour:
 *   - Rejects when (sampleId, role) already exists (uniqueness per tier).
 *   - When passwordReentry is provided, bcrypt-verifies against users.password
 *     and rejects with "Invalid password" on mismatch.
 *   - Inserts the signature row with IP + user-agent for the audit trail.
 *   - Auto-triggers the matching status transition (analyst → no-op,
 *     reviewer → testing→reviewed, approver → reviewed→approved,
 *     qa_release → approved→released).
 *   - Segregation-of-duties (analyst != reviewer) is re-checked in
 *     updateSampleStatus when the auto-transition runs.
 */
export async function signQcSample(
  input: SignQcSampleParams,
): Promise<SignQcSampleResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Sample must exist.
    const [sample] = await db
      .select({ id: tables.samples.id, status: tables.samples.status })
      .from(tables.samples)
      .where(eq(tables.samples.id, input.sampleId))
      .limit(1);
    if (!sample) {
      throw new Error(`Sample ${input.sampleId} not found`);
    }

    // 2. Reject duplicate signature for (sampleId, role).
    const existingSigs = await db
      .select({ id: tables.signatures.id })
      .from(tables.signatures)
      .where(and(
        eq(tables.signatures.sampleId, input.sampleId),
        eq(tables.signatures.role, input.role),
      ))
      .limit(1);
    if (existingSigs.length > 0) {
      throw new Error(
        `Signature for role "${input.role}" already exists on this sample`,
      );
    }

    // 3. Password re-entry — REQUIRED (21 CFR Part 11 §11.200(a)(1)(ii)).
    //
    // This was previously skipped whenever the caller sent nothing, so a QA
    // user could release a lot by clicking Sign with the password box empty.
    // §11.200(a)(1) requires an electronic signature to use two distinct
    // identification components; being already logged in supplies one, and the
    // re-entered password is the second. Without it the signature is not a
    // Part 11 signature at all.
    if (input.passwordReentry === undefined || input.passwordReentry === '') {
      const err = new Error(
        'ต้องกรอกรหัสผ่านเพื่อยืนยันการลงนามอิเล็กทรอนิกส์ (21 CFR Part 11)',
      );
      (err as any).statusCode = 401;
      throw err;
    }

    const [user] = await db
      .select({ password: tables.users.password })
      .from(tables.users)
      .where(eq(tables.users.id, input.userId))
      .limit(1);
    if (!user) {
      throw new Error(`User ${input.userId} not found`);
    }
    const userPassword = String(user.password || '');
    // Only bcrypt-hashed credentials are accepted. The previous plaintext
    // fallback for unhashed seed accounts meant a stored password could be
    // compared directly — latent today (all 7 live users are bcrypt-hashed)
    // but it is not a comparison that should exist on a signing path.
    let valid = false;
    if (userPassword.startsWith('$2')) {
      try {
        valid = await verifyPassword(input.passwordReentry, userPassword);
      } catch {
        valid = false;
      }
    }
    if (!valid) {
      const err = new Error('Invalid password — signature rejected');
      (err as any).statusCode = 401;
      throw err;
    }

    // 4. Pre-flight segregation-of-duties for reviewer role.
    if (input.role === 'reviewer') {
      const [analystSig] = await db
        .select({ userId: tables.signatures.userId })
        .from(tables.signatures)
        .where(and(
          eq(tables.signatures.sampleId, input.sampleId),
          eq(tables.signatures.role, 'analyst'),
        ))
        .limit(1);
      if (analystSig && Number(analystSig.userId) === input.userId) {
        throw new Error(
          `Segregation of duties: the reviewer must be a different user from the analyst`,
        );
      }
    }

    // 5. Insert.
    const now = getNow();
    const insertResult = await db.insert(tables.signatures).values({
      sampleId: input.sampleId,
      role: input.role,
      userId: input.userId,
      signedAt: now,
      signatureMeaning: input.signatureMeaning,
      notes: input.notes ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: now,
    });
    const signatureId = Number(getInsertId(insertResult));

    // 6. Trigger the matching state transition (best-effort — failures here
    //    propagate to the caller so the UI can surface the validation error).
    let transitionedStatus: { fromStatus: string; toStatus: string } | undefined;
    const action = ROLE_AUTO_TRANSITION[input.role];
    if (action) {
      // Re-derive current status (may have changed since the SELECT above
      // when concurrent requests are landing).
      const [refreshed] = await db
        .select({ status: tables.samples.status })
        .from(tables.samples)
        .where(eq(tables.samples.id, input.sampleId))
        .limit(1);
      const currentStatus = String(refreshed?.status ?? sample.status);

      // Only trigger when the action's target is reachable from the current
      // status. This makes the auto-transition idempotent: if the sample is
      // already past this stage, we just skip the state-machine call.
      const targetStatus = ACTION_TO_STATUS[action];
      const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
      if (allowed.includes(targetStatus)) {
        const updated = await updateSampleStatus(
          input.sampleId,
          action,
          input.userId,
        );
        transitionedStatus = {
          fromStatus: updated.fromStatus,
          toStatus: updated.toStatus,
        };
      }
    }

    return {
      signatureId,
      sampleId: input.sampleId,
      role: input.role,
      userId: input.userId,
      signedAt: now,
      transitionedStatus,
    };
  });
}

/**
 * Lightweight list of signatures for a sample — used by the dedicated
 * GET /api/quality/qc-samples/[id]/signatures endpoint. The full sample
 * detail already includes signatures via getQcSampleById.
 */
export async function listQcSampleSignatures(
  sampleId: number,
): Promise<QcSampleSignatureRow[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select({
        id: tables.signatures.id,
        role: tables.signatures.role,
        userId: tables.signatures.userId,
        userName: tables.users.name,
        signedAt: tables.signatures.signedAt,
        signatureMeaning: tables.signatures.signatureMeaning,
        notes: tables.signatures.notes,
      })
      .from(tables.signatures)
      .leftJoin(tables.users, eq(tables.signatures.userId, tables.users.id))
      .where(eq(tables.signatures.sampleId, sampleId))
      .orderBy(asc(tables.signatures.signedAt));
    return (rows as any[]).map((s) => ({
      id: Number(s.id),
      role: String(s.role),
      userId: Number(s.userId),
      userName: s.userName ?? null,
      signedAt: s.signedAt,
      signatureMeaning: s.signatureMeaning ?? null,
      notes: s.notes ?? null,
    }));
  });
}

// ============================================================================
// Phase 3 — OOS investigation (FDA 21 CFR 211.192)
// ============================================================================

export interface OosInvestigationDetail {
  id: number;
  sampleTestId: number;
  sampleId: number;
  sampleNumber: string | null;
  initiatedBy: number;
  initiatedByName: string | null;
  initiatedAt: string | Date;
  phase1LabErrorCheck: string | null;
  phase2RootCause: string | null;
  classification: string | null;
  retestAuthorized: boolean;
  closedBy: number | null;
  closedByName: string | null;
  closedAt: string | Date | null;
  conclusion: string | null;
  capaId: number | null;
  linkedDeviation: { id: number; deviationNumber: string } | null;
}

/**
 * Generate a deviation number `DEV-{YYYY}-{4digit}` for OOS-linked deviations.
 * Mirrors the wo-execution.service pattern.
 */
async function generateDeviationNumber(database: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const deviationsTable = getTables().deviations;
  const existing = await database
    .select({ deviationNumber: deviationsTable.deviationNumber })
    .from(deviationsTable)
    .where(like(deviationsTable.deviationNumber, `${prefix}%`))
    .orderBy(desc(deviationsTable.id))
    .limit(1);
  if (existing.length === 0) return `${prefix}0001`;
  const last = String(existing[0].deviationNumber);
  const seq = parseInt(last.replace(prefix, ''), 10);
  const next = (Number.isFinite(seq) ? seq + 1 : 1).toString().padStart(4, '0');
  return `${prefix}${next}`;
}

export interface CreateOosInvestigationResult {
  oosId: number;
  deviationId: number | null;
  deviationNumber: string | null;
}

/**
 * Initiate an OOS investigation per FDA 21 CFR 211.192.
 *
 * Side-effects:
 *   - Marks the parent qc_samples.status = 'oos' (when transition allowed).
 *   - When classification === 'manufacturing_error', auto-creates a Deviation
 *     record (sourceType='qc_oos', sourceId=oosId) and links it via
 *     qc_oos_investigations.capa_id (we reuse capa_id as the cross-reference
 *     until a dedicated deviation_id column is added).
 */
export async function createOosInvestigation(
  input: CreateOosInvestigationInput & { initiatedBy: number },
): Promise<CreateOosInvestigationResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Sample test must exist + resolve parent sample.
    const [testRow] = await db
      .select({
        id: tables.tests.id,
        sampleId: tables.tests.sampleId,
        criteriaId: tables.tests.criteriaId,
        resultStatus: tables.tests.resultStatus,
      })
      .from(tables.tests)
      .where(eq(tables.tests.id, input.sampleTestId))
      .limit(1);
    if (!testRow) {
      throw new Error(`Sample test ${input.sampleTestId} not found`);
    }
    const sampleId = Number(testRow.sampleId);

    // 2. Insert OOS investigation row.
    const now = getNow();
    const insertResult = await db.insert(tables.oos).values({
      sampleTestId: input.sampleTestId,
      initiatedBy: input.initiatedBy,
      initiatedAt: now,
      phase1LabErrorCheck: input.phase1LabErrorCheck ?? null,
      phase2RootCause: input.phase2RootCause ?? null,
      classification: input.classification ?? null,
      retestAuthorized: input.retestAuthorized ?? false,
      conclusion: input.conclusion ?? null,
      createdAt: now,
      updatedAt: now,
    });
    const oosId = Number(getInsertId(insertResult));

    // 3. Flag parent sample as OOS — only when the current status allows
    //    the transition. We deliberately don't call updateSampleStatus()
    //    because flag_oos has its own state-machine guards that aren't
    //    relevant here; we just stamp the column directly.
    const [sample] = await db
      .select({ status: tables.samples.status })
      .from(tables.samples)
      .where(eq(tables.samples.id, sampleId))
      .limit(1);
    const status = String(sample?.status || '');
    if (status && status !== 'oos' && status !== 'released' && status !== 'rejected') {
      await db
        .update(tables.samples)
        .set({ status: 'oos', updatedAt: now })
        .where(eq(tables.samples.id, sampleId));
    }

    // 4. Auto-create deviation when classification = manufacturing_error.
    let deviationId: number | null = null;
    let deviationNumber: string | null = null;
    if (input.classification === 'manufacturing_error') {
      try {
        const deviationsTable = tables.deviations;
        deviationNumber = await generateDeviationNumber(db);
        const description = [
          input.phase2RootCause || input.phase1LabErrorCheck || 'OOS — manufacturing error suspected',
          '',
          `Linked QC OOS investigation #${oosId}, sampleTest #${input.sampleTestId}.`,
        ].join('\n');
        const insRes = await db.insert(deviationsTable).values({
          deviationNumber,
          title: `QC OOS — sample test #${input.sampleTestId}`,
          description,
          type: 'OOS',
          sourceType: 'qc_oos',
          sourceId: oosId,
          severity: 'major',
          status: 'open',
          reportedBy: input.initiatedBy,
          reportedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        deviationId = Number(getInsertId(insRes));
        // 4a. Cross-link via qc_oos_investigations.capa_id (re-purposed until
        //     a dedicated deviation_id column is added — Phase 4 schema).
        await db
          .update(tables.oos)
          .set({ capaId: deviationId, updatedAt: now })
          .where(eq(tables.oos.id, oosId));
      } catch (err) {
        // Don't roll back the OOS record — we still want it persisted.
        console.error('[qc-oos] Failed to auto-create deviation:', err);
      }
    }

    return { oosId, deviationId, deviationNumber };
  });
}

/**
 * Update an in-progress OOS investigation. Closed investigations are immutable.
 */
export async function updateOosInvestigation(
  oosId: number,
  updates: UpdateOosInvestigationInput,
): Promise<{ updated: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const [existing] = await db
      .select({ id: tables.oos.id, closedAt: tables.oos.closedAt })
      .from(tables.oos)
      .where(eq(tables.oos.id, oosId))
      .limit(1);
    if (!existing) {
      throw new Error(`OOS investigation ${oosId} not found`);
    }
    if (existing.closedAt != null) {
      throw new Error(`OOS investigation is closed and cannot be edited`);
    }
    const set: Record<string, any> = { updatedAt: getNow() };
    if (updates.phase1LabErrorCheck !== undefined) set.phase1LabErrorCheck = updates.phase1LabErrorCheck;
    if (updates.phase2RootCause !== undefined) set.phase2RootCause = updates.phase2RootCause;
    if (updates.classification !== undefined) set.classification = updates.classification;
    if (updates.retestAuthorized !== undefined) set.retestAuthorized = updates.retestAuthorized;
    if (updates.conclusion !== undefined) set.conclusion = updates.conclusion;
    await db.update(tables.oos).set(set).where(eq(tables.oos.id, oosId));
    return { updated: true };
  });
}

/**
 * Close an OOS investigation. Caller must supply a non-trivial conclusion.
 * Retest authorization is tracked separately — closure does NOT auto-create
 * a follow-up sample test; the operator clicks "เพิ่มการทดสอบ" with an
 * explicit retest reason.
 */
export async function closeOosInvestigation(
  oosId: number,
  closedBy: number,
  conclusion: string,
): Promise<{ closed: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const [existing] = await db
      .select({ id: tables.oos.id, closedAt: tables.oos.closedAt })
      .from(tables.oos)
      .where(eq(tables.oos.id, oosId))
      .limit(1);
    if (!existing) {
      throw new Error(`OOS investigation ${oosId} not found`);
    }
    if (existing.closedAt != null) {
      throw new Error(`OOS investigation is already closed`);
    }
    const now = getNow();
    await db
      .update(tables.oos)
      .set({
        closedBy,
        closedAt: now,
        conclusion,
        updatedAt: now,
      })
      .where(eq(tables.oos.id, oosId));
    return { closed: true };
  });
}

/**
 * Full OOS investigation detail with related sample + linked deviation.
 */
export async function getOosInvestigation(
  oosId: number,
): Promise<OosInvestigationDetail | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select({
        id: tables.oos.id,
        sampleTestId: tables.oos.sampleTestId,
        sampleId: tables.tests.sampleId,
        sampleNumber: tables.samples.sampleNumber,
        initiatedBy: tables.oos.initiatedBy,
        initiatedByName: tables.users.name,
        initiatedAt: tables.oos.initiatedAt,
        phase1LabErrorCheck: tables.oos.phase1LabErrorCheck,
        phase2RootCause: tables.oos.phase2RootCause,
        classification: tables.oos.classification,
        retestAuthorized: tables.oos.retestAuthorized,
        closedBy: tables.oos.closedBy,
        closedAt: tables.oos.closedAt,
        conclusion: tables.oos.conclusion,
        capaId: tables.oos.capaId,
      })
      .from(tables.oos)
      .leftJoin(tables.tests, eq(tables.oos.sampleTestId, tables.tests.id))
      .leftJoin(tables.samples, eq(tables.tests.sampleId, tables.samples.id))
      .leftJoin(tables.users, eq(tables.oos.initiatedBy, tables.users.id))
      .where(eq(tables.oos.id, oosId))
      .limit(1);
    if (!rows[0]) return null;
    const r: any = rows[0];

    // closedBy → user name
    let closedByName: string | null = null;
    if (r.closedBy != null) {
      const [u] = await db
        .select({ name: tables.users.name })
        .from(tables.users)
        .where(eq(tables.users.id, Number(r.closedBy)))
        .limit(1);
      closedByName = u?.name ?? null;
    }

    // Linked deviation via capa_id (re-purposed in Phase 3 — see createOosInvestigation).
    let linkedDeviation: { id: number; deviationNumber: string } | null = null;
    if (r.capaId != null) {
      try {
        const deviationsTable = tables.deviations;
        const [d] = await db
          .select({
            id: deviationsTable.id,
            deviationNumber: deviationsTable.deviationNumber,
          })
          .from(deviationsTable)
          .where(eq(deviationsTable.id, Number(r.capaId)))
          .limit(1);
        if (d) {
          linkedDeviation = {
            id: Number(d.id),
            deviationNumber: String(d.deviationNumber),
          };
        }
      } catch (err) {
        console.error('[qc-oos] Failed to fetch linked deviation:', err);
      }
    }

    return {
      id: Number(r.id),
      sampleTestId: Number(r.sampleTestId),
      sampleId: r.sampleId != null ? Number(r.sampleId) : 0,
      sampleNumber: r.sampleNumber ?? null,
      initiatedBy: Number(r.initiatedBy),
      initiatedByName: r.initiatedByName ?? null,
      initiatedAt: r.initiatedAt,
      phase1LabErrorCheck: r.phase1LabErrorCheck ?? null,
      phase2RootCause: r.phase2RootCause ?? null,
      classification: r.classification ?? null,
      retestAuthorized: Boolean(r.retestAuthorized),
      closedBy: r.closedBy != null ? Number(r.closedBy) : null,
      closedByName,
      closedAt: r.closedAt ?? null,
      conclusion: r.conclusion ?? null,
      capaId: r.capaId != null ? Number(r.capaId) : null,
      linkedDeviation,
    };
  });
}

/**
 * List OOS investigations for a given sample (joined via sample tests).
 */
export async function listOosInvestigationsBySample(
  sampleId: number,
): Promise<OosInvestigationDetail[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    // Get all test ids for this sample first.
    const testIdRows = await db
      .select({ id: tables.tests.id })
      .from(tables.tests)
      .where(eq(tables.tests.sampleId, sampleId));
    const testIds = (testIdRows as any[]).map((r) => Number(r.id));
    if (testIds.length === 0) return [];

    const oosRows = await db
      .select({ id: tables.oos.id })
      .from(tables.oos)
      .where(inArray(tables.oos.sampleTestId, testIds))
      .orderBy(desc(tables.oos.id));

    const out: OosInvestigationDetail[] = [];
    for (const o of oosRows as any[]) {
      const detail = await getOosInvestigation(Number(o.id));
      if (detail) out.push(detail);
    }
    return out;
  });
}

// Re-export — internal helper exposed for downstream COA service in Phase 4.
export { computeResultStatus, generateSampleNumber };
// Re-export helper types so downstream consumers can satisfy strict mode.
export type { SignatureRole, OosClassification };

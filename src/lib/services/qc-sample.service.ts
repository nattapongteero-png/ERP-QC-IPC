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
import { executeDbOperation, getInsertId, getAffectedRows } from '../db/db-helper';
import { isSqlite } from '../db';
import { getNow, toQueryDate } from '../db/date-utils';
import {
  // SQLite tables
  sqliteQcSamples,
  sqliteQcSampleTests,
  sqliteQcTestPanels,
  sqliteQcOosInvestigations,
  sqliteQcSampleSignatures,
  sqliteIPCCriteria,
  sqliteItems,
  sqliteCustomers,
  sqliteUsers,
  sqliteCoaDocuments,
  // MySQL tables
  mysqlQcSamples,
  mysqlQcSampleTests,
  mysqlQcTestPanels,
  mysqlQcOosInvestigations,
  mysqlQcSampleSignatures,
  mysqlIPCCriteria,
  mysqlItems,
  mysqlCustomers,
  mysqlUsers,
  mysqlCoaDocuments,
} from '../db/schema';

import type {
  CreateQcSampleInput,
  UpdateQcSampleInput,
  AddOrUpdateTestInput,
  CreateTestPanelInput,
  UpdateTestPanelInput,
  SampleStatus,
  SampleAction,
} from '../validation/qc-sample';

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
      panels: sqliteQcTestPanels,
      oos: sqliteQcOosInvestigations,
      signatures: sqliteQcSampleSignatures,
      criteria: sqliteIPCCriteria,
      items: sqliteItems,
      customers: sqliteCustomers,
      users: sqliteUsers,
      coa: sqliteCoaDocuments,
    };
  }
  return {
    samples: mysqlQcSamples,
    tests: mysqlQcSampleTests,
    panels: mysqlQcTestPanels,
    oos: mysqlQcOosInvestigations,
    signatures: mysqlQcSampleSignatures,
    criteria: mysqlIPCCriteria,
    items: mysqlItems,
    customers: mysqlCustomers,
    users: mysqlUsers,
    coa: mysqlCoaDocuments,
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

export interface QcSampleTestRow {
  id: number;
  sampleId: number;
  criteriaId: number;
  criteriaCode: string | null;
  criteriaName: string | null;
  criteriaNameTh: string | null;
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
      manufactureDate: input.manufactureDate || null,
      expiryDate: input.expiryDate || null,
      retestDate: input.retestDate || null,
      quantityReceived: input.quantityReceived ?? null,
      unit: input.unit ?? null,
      storageConditions: input.storageConditions ?? null,
      customerId: input.customerId ?? null,
      salesOrderRef: input.salesOrderRef ?? null,
      receivedDate: input.receivedDate,
      receivedBy: input.receivedBy,
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

    return {
      sampleId,
      sampleNumber,
      status: 'registered' as const,
      testsSeeded,
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

    // Tests + criteria join + tested/reviewed user names.
    const testRows = await db
      .select({
        id: tables.tests.id,
        sampleId: tables.tests.sampleId,
        criteriaId: tables.tests.criteriaId,
        criteriaCode: tables.criteria.code,
        criteriaName: tables.criteria.name,
        criteriaNameTh: tables.criteria.nameTh,
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

    const tests: QcSampleTestRow[] = (testRows as any[]).map((t) => ({
      id: Number(t.id),
      sampleId: Number(t.sampleId),
      criteriaId: Number(t.criteriaId),
      criteriaCode: t.criteriaCode ?? null,
      criteriaName: t.criteriaName ?? null,
      criteriaNameTh: t.criteriaNameTh ?? null,
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
    }));

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
    for (const k of allowed) {
      if (updates[k] !== undefined) {
        set[k] = updates[k];
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

    // 3. Compute pass/fail/pending from numericResult vs spec range.
    const resultStatus = computeResultStatus({
      numericResult: input.numericResult,
      textResult: input.textResult,
      specMin,
      specMax,
      specTarget,
    });

    const now = getNow();
    const hasResult =
      (input.numericResult != null && Number.isFinite(input.numericResult)) ||
      (input.textResult != null && String(input.textResult).trim().length > 0);

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
          numericResult: input.numericResult ?? null,
          textResult: input.textResult ?? null,
          resultStatus,
          testedBy: hasResult ? userId : null,
          testedAt: hasResult ? now : null,
          notes: input.notes ?? null,
          attachmentPath: input.attachmentPath ?? null,
          updatedAt: now,
        })
        .where(eq(tables.tests.id, input.testId));

      return { testId: input.testId, resultStatus, inserted: false };
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
      numericResult: input.numericResult ?? null,
      textResult: input.textResult ?? null,
      resultStatus,
      testedBy: hasResult ? userId : null,
      testedAt: hasResult ? now : null,
      notes: input.notes ?? null,
      attachmentPath: input.attachmentPath ?? null,
      createdAt: now,
      updatedAt: now,
    });
    const testId = Number(getInsertId(insertResult));
    return { testId, resultStatus, inserted: true };
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

// Re-export — internal helper exposed for downstream COA service in Phase 4.
export { computeResultStatus, generateSampleNumber };

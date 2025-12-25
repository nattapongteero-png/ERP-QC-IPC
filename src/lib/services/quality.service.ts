/**
 * Quality Service
 * Real-world quality control with specifications, testing, deviations, and COA generation
 */

import { db, isSqlite } from '../db';
import { toQueryDate } from '../db/date-utils';
import { eq, and, sql, desc, asc, gte, lte, or } from 'drizzle-orm';
import {
  sqliteQualityTests,
  sqliteQualitySpecs,
  sqliteDeviations,
  sqliteInventoryLots,
  sqliteItems,
  sqliteUsers,
  mysqlQualityTests,
  mysqlQualitySpecs,
  mysqlDeviations,
  mysqlInventoryLots,
  mysqlItems,
  mysqlUsers,
} from '../db/schema';
import { createAuditLog } from '../audit';
import { updateLotStatus } from './inventory.service';

// Types
export interface SpecificationResult {
  testType: string;
  specification: string;
  result: string | number;
  status: 'pass' | 'fail' | 'pending';
  unit?: string;
}

export interface QCTestResult {
  testId: number;
  testType: string;
  resultValue?: number;
  resultText?: string;
  status: 'pass' | 'fail';
  testedBy: number;
  testedAt: string;
}

export interface DeviationRecord {
  id: number;
  deviationNumber: string;
  type: string;
  severity: 'critical' | 'major' | 'minor';
  status: string;
  description: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  dueDate?: string;
  closedDate?: string;
}

export interface COADocument {
  documentNumber: string;
  issueDate: string;
  productInfo: {
    name: string;
    code: string;
    lotNumber: string;
    batchNumber?: string;
    manufacturingDate?: string;
    expiryDate?: string;
    quantity: number;
    unit: string;
  };
  testResults: SpecificationResult[];
  conclusion: 'PASS' | 'FAIL';
  approvedBy?: string;
  approvalDate?: string;
}

export interface SamplingPlan {
  lotSize: number;
  inspectionLevel: 'I' | 'II' | 'III';
  aql: number;
  sampleSize: number;
  acceptNumber: number;
  rejectNumber: number;
}

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      tests: sqliteQualityTests,
      specs: sqliteQualitySpecs,
      deviations: sqliteDeviations,
      lots: sqliteInventoryLots,
      items: sqliteItems,
      users: sqliteUsers,
    };
  }
  return {
    tests: mysqlQualityTests,
    specs: mysqlQualitySpecs,
    deviations: mysqlDeviations,
    lots: mysqlInventoryLots,
    items: mysqlItems,
    users: mysqlUsers,
  };
}

/**
 * AQL Sampling Plan Calculator (based on ISO 2859-1 / MIL-STD-105E)
 */
export function calculateSamplingPlan(
  lotSize: number,
  inspectionLevel: 'I' | 'II' | 'III' = 'II',
  aql: number = 1.0
): SamplingPlan {
  // Sample size code letters by lot size and inspection level
  const codeLetter = getSampleSizeCodeLetter(lotSize, inspectionLevel);
  
  // Sample sizes by code letter
  const sampleSizes: Record<string, number> = {
    'A': 2, 'B': 3, 'C': 5, 'D': 8, 'E': 13,
    'F': 20, 'G': 32, 'H': 50, 'J': 80, 'K': 125,
    'L': 200, 'M': 315, 'N': 500, 'P': 800, 'Q': 1250,
  };

  // Accept/Reject numbers by AQL (simplified)
  const acceptRejectByAQL: Record<number, Record<string, [number, number]>> = {
    0.65: { 'A': [0, 1], 'B': [0, 1], 'C': [0, 1], 'D': [0, 1], 'E': [1, 2] },
    1.0: { 'A': [0, 1], 'B': [0, 1], 'C': [0, 1], 'D': [1, 2], 'E': [1, 2] },
    1.5: { 'A': [0, 1], 'B': [0, 1], 'C': [1, 2], 'D': [1, 2], 'E': [2, 3] },
    2.5: { 'A': [0, 1], 'B': [1, 2], 'C': [1, 2], 'D': [2, 3], 'E': [3, 4] },
    4.0: { 'A': [1, 2], 'B': [1, 2], 'C': [2, 3], 'D': [3, 4], 'E': [5, 6] },
  };

  const sampleSize = sampleSizes[codeLetter] || 5;
  const acceptReject = acceptRejectByAQL[aql]?.[codeLetter] || [0, 1];

  return {
    lotSize,
    inspectionLevel,
    aql,
    sampleSize,
    acceptNumber: acceptReject[0],
    rejectNumber: acceptReject[1],
  };
}

function getSampleSizeCodeLetter(lotSize: number, level: 'I' | 'II' | 'III'): string {
  const ranges: Array<[number, number, string, string, string]> = [
    [2, 8, 'A', 'A', 'B'],
    [9, 15, 'A', 'B', 'C'],
    [16, 25, 'B', 'C', 'D'],
    [26, 50, 'C', 'D', 'E'],
    [51, 90, 'C', 'E', 'F'],
    [91, 150, 'D', 'F', 'G'],
    [151, 280, 'E', 'G', 'H'],
    [281, 500, 'F', 'H', 'J'],
    [501, 1200, 'G', 'J', 'K'],
    [1201, 3200, 'H', 'K', 'L'],
    [3201, 10000, 'J', 'L', 'M'],
    [10001, 35000, 'K', 'M', 'N'],
    [35001, 150000, 'L', 'N', 'P'],
    [150001, 500000, 'M', 'P', 'Q'],
  ];

  const levelIndex = level === 'I' ? 2 : level === 'II' ? 3 : 4;

  for (const range of ranges) {
    if (lotSize >= range[0] && lotSize <= range[1]) {
      return range[levelIndex];
    }
  }

  return 'L'; // Default for very large lots
}

/**
 * Create QC Test Request for a Lot
 */
export async function createQCTestRequest(
  lotId: number,
  testTypes: string[],
  userId: number
): Promise<number[]> {
  const { tests, lots, items, specs } = getTables();
  const database = db();

  // Get lot and item details
  const [lot] = await database
    .select({
      id: lots.id,
      lotNumber: lots.lotNumber,
      itemId: lots.itemId,
      quantity: lots.quantity,
    })
    .from(lots)
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  // Calculate sampling plan
  const samplingPlan = calculateSamplingPlan(Number(lot.quantity) || 100);

  const testIds: number[] = [];

  for (const testType of testTypes) {
    // Get specification for this test
    const [spec] = await database
      .select()
      .from(specs)
      .where(
        and(
          eq(specs.itemId, lot.itemId),
          
          eq(specs.isActive, true)
        )
      );

    // Create test record
    const [newTest] = await database
      .insert(tests)
      .values({
        lotId,
        testType,
        specId: spec?.id,
        sampleSize: samplingPlan.sampleSize,
        status: 'pending',
        requestedBy: userId,
        requestedAt: new Date().toISOString(),
      })
      .returning({ id: tests.id });

    testIds.push(newTest.id);
  }

  // Update lot status to under_test
  await database
    .update(lots)
    .set({ status: 'under_test' })
    .where(eq(lots.id, lotId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'quality_tests',
    recordId: lotId,
    newValue: {
      lotNumber: lot.lotNumber,
      testTypes,
      sampleSize: samplingPlan.sampleSize,
    },
  });

  return testIds;
}

/**
 * Record QC Test Result
 */
export async function recordTestResult(
  testId: number,
  resultValue: number | null,
  resultText: string | null,
  userId: number
): Promise<{ status: 'pass' | 'fail'; deviationId?: number }> {
  const { tests, specs, deviations } = getTables();
  const database = db();

  // Get test with specification
  const [test] = await database
    .select({
      id: tests.id,
      lotId: tests.lotId,
      testType: tests.testType,
      specId: tests.specId,
    })
    .from(tests)
    .where(eq(tests.id, testId));

  if (!test) {
    throw new Error(`Test ${testId} not found`);
  }

  // Get specification
  let testStatus: 'pass' | 'fail' = 'pass';
  let deviationId: number | undefined;

  if (test.specId) {
    const [spec] = await database
      .select()
      .from(specs)
      .where(eq(specs.id, test.specId));

    if (spec) {
      // Evaluate result against specification
      testStatus = evaluateTestResult(resultValue, resultText, spec);

      if (testStatus === 'fail') {
        // Generate deviation number
        const today = new Date();
        const prefix = `DEV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const deviationNumber = `${prefix}-${random}`;

        // Create OOS deviation
        const [deviation] = await database
          .insert(deviations)
          .values({
            deviationNumber,
            description: `Out of Specification: ${test.testType}. Expected: ${formatSpec(spec)}, Actual: ${resultValue ?? resultText}`,
            lotId: test.lotId,
            type: 'OOS',
            severity: 'major',
            status: 'open',
            reportedBy: userId,
            reportedAt: new Date().toISOString(),
          })
          .returning({ id: deviations.id });

        deviationId = deviation.id;
      }
    }
  }

  // Update test record - map to schema column names
  await database
    .update(tests)
    .set({
      numericResult: resultValue,
      result: resultText,
      status: testStatus === 'pass' ? 'passed' : 'failed',
      testedBy: userId,
      testedAt: new Date().toISOString(),
    })
    .where(eq(tests.id, testId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'quality_tests',
    recordId: testId,
    newValue: {
      numericResult: resultValue,
      result: resultText,
      status: testStatus,
    },
  });

  return { status: testStatus, deviationId };
}

/**
 * Evaluate test result against specification
 * Infers spec type from minValue/maxValue/specification fields
 */
function evaluateTestResult(
  resultValue: number | null,
  resultText: string | null,
  spec: { minValue?: number | null; maxValue?: number | null; specification?: string | null }
): 'pass' | 'fail' {
  // Infer spec type from available fields
  const hasMin = spec.minValue !== null && spec.minValue !== undefined;
  const hasMax = spec.maxValue !== null && spec.maxValue !== undefined;

  // Range check: has both min and max
  if (hasMin && hasMax) {
    if (resultValue === null) return 'fail';
    return (resultValue >= spec.minValue! && resultValue <= spec.maxValue!) ? 'pass' : 'fail';
  }

  // Min only check: has min but no max
  if (hasMin && !hasMax) {
    if (resultValue === null) return 'fail';
    return resultValue >= spec.minValue! ? 'pass' : 'fail';
  }

  // Max only check: has max but no min
  if (!hasMin && hasMax) {
    if (resultValue === null) return 'fail';
    return resultValue <= spec.maxValue! ? 'pass' : 'fail';
  }

  // Text-based check: compare specification with result text
  if (spec.specification && resultText) {
    return resultText.toLowerCase().includes(spec.specification.toLowerCase()) ? 'pass' : 'fail';
  }

  // No spec constraints - pass by default
  return 'pass';
}

/**
 * Format specification for display
 * Infers format from minValue/maxValue/specification fields
 */
function formatSpec(spec: { minValue?: number | null; maxValue?: number | null; specification?: string | null; unit?: string | null }): string {
  const unit = spec.unit || '';
  const hasMin = spec.minValue !== null && spec.minValue !== undefined;
  const hasMax = spec.maxValue !== null && spec.maxValue !== undefined;

  // Range: has both min and max
  if (hasMin && hasMax) {
    return `${spec.minValue} - ${spec.maxValue} ${unit}`.trim();
  }

  // Min only
  if (hasMin) {
    return `≥ ${spec.minValue} ${unit}`.trim();
  }

  // Max only
  if (hasMax) {
    return `≤ ${spec.maxValue} ${unit}`.trim();
  }

  // Text specification
  if (spec.specification) {
    return spec.specification;
  }

  return '';
}

/**
 * Evaluate All Tests for a Lot and Determine Release Status
 */
export async function evaluateLotRelease(
  lotId: number,
  userId: number
): Promise<{ canRelease: boolean; status: string; failedTests: string[]; pendingTests: string[] }> {
  const { tests, lots } = getTables();
  const database = db();

  // Get all tests for this lot
  const lotTests = await database
    .select({
      testType: tests.testType,
      status: tests.status,
    })
    .from(tests)
    .where(eq(tests.lotId, lotId));

  const failedTests: string[] = [];
  const pendingTests: string[] = [];

  for (const test of lotTests) {
    if (test.status === 'pending') {
      pendingTests.push(test.testType);
    } else if (test.status === 'failed') {
      failedTests.push(test.testType);
    }
  }

  let canRelease = false;
  let status = 'under_test';

  if (pendingTests.length > 0) {
    status = 'under_test';
  } else if (failedTests.length > 0) {
    status = 'failed';
    // Auto-reject lot
    await updateLotStatus(lotId, 'rejected', userId, `Failed tests: ${failedTests.join(', ')}`);
  } else if (lotTests.length > 0) {
    canRelease = true;
    status = 'passed';
  }

  return { canRelease, status, failedTests, pendingTests };
}

/**
 * Release Lot after QC Approval
 */
export async function releaseLot(
  lotId: number,
  userId: number,
  coaNumber?: string
): Promise<boolean> {
  const { lots } = getTables();
  const database = db();

  // Evaluate release eligibility
  const evaluation = await evaluateLotRelease(lotId, userId);

  if (!evaluation.canRelease) {
    throw new Error(`Cannot release lot. Status: ${evaluation.status}. ${
      evaluation.pendingTests.length > 0 ? `Pending tests: ${evaluation.pendingTests.join(', ')}` : ''
    } ${
      evaluation.failedTests.length > 0 ? `Failed tests: ${evaluation.failedTests.join(', ')}` : ''
    }`);
  }

  // Generate COA number if not provided
  const finalCoaNumber = coaNumber || await generateCOANumber();

  // Update lot status
  await updateLotStatus(lotId, 'released', userId, 'QC Release', finalCoaNumber);

  return true;
}

/**
 * Generate COA Number
 */
async function generateCOANumber(): Promise<string> {
  const today = new Date();
  const prefix = `COA-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${random}`;
}

/**
 * Generate Certificate of Analysis (COA)
 */
export async function generateCOA(lotId: number): Promise<COADocument> {
  const { tests, specs, lots, items, users } = getTables();
  const database = db();

  // Get lot details
  const [lot] = await database
    .select({
      id: lots.id,
      lotNumber: lots.lotNumber,
      batchNumber: lots.batchNumber,
      quantity: lots.quantity,
      unit: lots.unit,
      manufacturingDate: lots.manufacturingDate,
      expiryDate: lots.expiryDate,
      coaNumber: lots.coaNumber,
      itemId: lots.itemId,
      itemCode: items.code,
      itemName: items.nameEn,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  // Get all completed tests
  const completedTests = await database
    .select({
      testType: tests.testType,
      resultValue: tests.numericResult,
      resultText: tests.result,
      status: tests.status,
      specId: tests.specId,
    })
    .from(tests)
    .where(
      and(
        eq(tests.lotId, lotId),
        or(eq(tests.status, 'passed'), eq(tests.status, 'failed'))
      )
    );

  // Build test results with specifications
  const testResults: SpecificationResult[] = [];

  for (const test of completedTests) {
    let specText = '';
    let unit = '';

    if (test.specId) {
      const [spec] = await database
        .select()
        .from(specs)
        .where(eq(specs.id, test.specId));

      if (spec) {
        specText = formatSpec(spec);
        unit = spec.unit || '';
      }
    }

    testResults.push({
      testType: test.testType,
      specification: specText,
      result: test.resultValue ?? test.resultText ?? '',
      status: test.status === 'passed' ? 'pass' : test.status === 'failed' ? 'fail' : 'pending',
      unit,
    });
  }

  // Determine overall conclusion
  const allPassed = testResults.every(t => t.status === 'pass');

  const coa: COADocument = {
    documentNumber: lot.coaNumber || await generateCOANumber(),
    issueDate: new Date().toISOString().split('T')[0],
    productInfo: {
      name: lot.itemName || lot.itemCode,
      code: lot.itemCode,
      lotNumber: lot.lotNumber,
      batchNumber: lot.batchNumber || undefined,
      manufacturingDate: lot.manufacturingDate || undefined,
      expiryDate: lot.expiryDate || undefined,
      quantity: Number(lot.quantity) || 0,
      unit: lot.unit,
    },
    testResults,
    conclusion: allPassed ? 'PASS' : 'FAIL',
  };

  return coa;
}

/**
 * Create Deviation Record
 */
export async function createDeviation(
  lotId: number | null,
  workOrderId: number | null,
  type: string,
  severity: 'critical' | 'major' | 'minor',
  description: string,
  userId: number
): Promise<number> {
  const { deviations } = getTables();
  const database = db();

  // Generate deviation number
  const today = new Date();
  const prefix = `DEV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const deviationNumber = `${prefix}-${random}`;

  // Create deviation
  const [deviation] = await database
    .insert(deviations)
    .values({
      deviationNumber,
      lotId,
      workOrderId,
      type,
      severity,
      status: 'open',
      description,
      reportedBy: userId,
      reportedAt: new Date().toISOString(),
    })
    .returning({ id: deviations.id });

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'deviations',
    recordId: deviation.id,
    newValue: {
      deviationNumber,
      type,
      severity,
      description,
    },
  });

  return deviation.id;
}

/**
 * Update Deviation with Investigation and CAPA
 */
export async function updateDeviationInvestigation(
  deviationId: number,
  rootCause: string,
  correctiveAction: string,
  preventiveAction: string,
  responsiblePerson: number,
  dueDate: string,
  userId: number
): Promise<boolean> {
  const { deviations } = getTables();
  const database = db();

  // Get current deviation
  const [deviation] = await database
    .select()
    .from(deviations)
    .where(eq(deviations.id, deviationId));

  if (!deviation) {
    throw new Error(`Deviation ${deviationId} not found`);
  }

  // Update deviation
  await database
    .update(deviations)
    .set({
      rootCause,
      correctiveAction,
      preventiveAction,
      responsiblePerson,
      dueDate,
      status: 'investigation',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(deviations.id, deviationId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'deviations',
    recordId: deviationId,
    oldValue: { status: deviation.status },
    newValue: {
      status: 'investigation',
      rootCause,
      correctiveAction,
      preventiveAction,
    },
  });

  return true;
}

/**
 * Close Deviation
 */
export async function closeDeviation(
  deviationId: number,
  closureNotes: string,
  userId: number
): Promise<boolean> {
  const { deviations } = getTables();
  const database = db();

  // Get current deviation
  const [deviation] = await database
    .select()
    .from(deviations)
    .where(eq(deviations.id, deviationId));

  if (!deviation) {
    throw new Error(`Deviation ${deviationId} not found`);
  }

  if (!deviation.correctiveAction || !deviation.preventiveAction) {
    throw new Error('Cannot close deviation without CAPA documentation');
  }

  // Update deviation
  await database
    .update(deviations)
    .set({
      status: 'closed',
      closureNotes,
      closedBy: userId,
      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(deviations.id, deviationId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'deviations',
    recordId: deviationId,
    oldValue: { status: deviation.status },
    newValue: {
      status: 'closed',
      closureNotes,
    },
  });

  return true;
}

/**
 * Get Deviation Statistics
 */
export async function getDeviationStatistics(
  dateFrom?: string,
  dateTo?: string
): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  averageClosureTime: number;
}> {
  const { deviations } = getTables();
  const database = db();

  const conditions = [];
  if (dateFrom) {
    conditions.push(gte(deviations.createdAt, toQueryDate(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(deviations.createdAt, toQueryDate(dateTo)));
  }

  const allDeviations = await database
    .select()
    .from(deviations)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let totalClosureTime = 0;
  let closedCount = 0;

  for (const dev of allDeviations) {
    // Count by status
    byStatus[dev.status] = (byStatus[dev.status] || 0) + 1;
    
    // Count by type
    byType[dev.type] = (byType[dev.type] || 0) + 1;
    
    // Count by severity
    bySeverity[dev.severity] = (bySeverity[dev.severity] || 0) + 1;

    // Calculate closure time
    if (dev.status === 'closed' && dev.reportedAt && dev.closedAt) {
      const reported = new Date(dev.reportedAt);
      const closed = new Date(dev.closedAt);
      const days = (closed.getTime() - reported.getTime()) / (1000 * 60 * 60 * 24);
      totalClosureTime += days;
      closedCount++;
    }
  }

  return {
    total: allDeviations.length,
    byStatus,
    byType,
    bySeverity,
    averageClosureTime: closedCount > 0 ? Math.round(totalClosureTime / closedCount * 10) / 10 : 0,
  };
}

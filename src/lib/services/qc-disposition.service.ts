/**
 * QC Disposition Service
 * Feature: 009-gmp-compliance-gap-analysis Phase 7 (US15 - T086)
 *
 * Handles disposition decisions for QC tests with:
 * - FR-067: Disposition Decision (accept, reject, rework, scrap, return_to_vendor, conditional_release)
 * - FR-068: Disposition Reason (mandatory for non-accept decisions)
 * - FR-069: Auto Lot Status Update based on disposition
 * - FR-070: Complete Audit Trail for disposition decisions
 * - FR-071-074: Electronic Signatures for disposition and approval
 */

import { db, isSqlite } from '../db';
import { eq, and, desc, sql, inArray, isNull } from 'drizzle-orm';
import {
  sqliteQualityTests,
  sqliteInventoryLots,
  sqliteUsers,
  sqliteElectronicSignatures,
  mysqlQualityTests,
  mysqlInventoryLots,
  mysqlUsers,
  mysqlElectronicSignatures,
} from '../db/schema';
import { createAuditLog } from '../audit';
import { verifyUserPassword, createElectronicSignature } from './electronic-signature.service';
import { getNow } from '../db/date-utils';

// Disposition types
export type DispositionType =
  | 'accept'           // Material/product accepted as-is
  | 'reject'           // Material/product rejected
  | 'rework'           // Requires reprocessing
  | 'scrap'            // Must be destroyed
  | 'return_to_vendor' // Return for replacement/credit
  | 'conditional_release'; // Release with conditions

// Types
export interface DispositionInput {
  testId: number;
  disposition: DispositionType;
  reason: string;
  userId: number;
  password: string;
}

export interface DispositionApprovalInput {
  testId: number;
  userId: number;
  password: string;
  approvalNotes?: string;
}

export interface DispositionResult {
  success: boolean;
  testId: number;
  disposition?: DispositionType;
  lotStatusUpdated?: boolean;
  newLotStatus?: string;
  error?: string;
}

export interface DispositionDetails {
  test: {
    id: number;
    testType: string;
    status: string;
    result: string | null;
    disposition: DispositionType | null;
    dispositionReason: string | null;
    dispositionAt: string | null;
    dispositionApprovedAt: string | null;
  };
  lot: {
    id: number;
    lotNumber: string;
    status: string;
  } | null;
  dispositionBy: {
    id: number;
    fullName: string;
  } | null;
  approvedBy: {
    id: number;
    fullName: string;
  } | null;
  signatures: Array<{
    id: number;
    action: string;
    fullName: string;
    signedAt: string;
    meaning: string;
  }>;
}

export interface QCSummary {
  total: number;
  pending: number;
  passed: number;
  failed: number;
  pendingDisposition: number;
  pendingApproval: number;
  byTestType: Record<string, { total: number; passed: number; failed: number; pending: number }>;
}

export interface PendingReleaseItem {
  testId: number;
  testType: string;
  lotId: number;
  lotNumber: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  status: string;
  result: string | null;
  disposition: DispositionType | null;
  dispositionReason: string | null;
  testedAt: string | null;
  needsDisposition: boolean;
  needsApproval: boolean;
}

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      tests: sqliteQualityTests,
      lots: sqliteInventoryLots,
      users: sqliteUsers,
      signatures: sqliteElectronicSignatures,
    };
  }
  return {
    tests: mysqlQualityTests,
    lots: mysqlInventoryLots,
    users: mysqlUsers,
    signatures: mysqlElectronicSignatures,
  };
}

/**
 * Get display name for disposition type
 */
export function getDispositionDisplayName(disposition: DispositionType): string {
  const names: Record<DispositionType, string> = {
    accept: 'Accept',
    reject: 'Reject',
    rework: 'Rework',
    scrap: 'Scrap',
    return_to_vendor: 'Return to Vendor',
    conditional_release: 'Conditional Release',
  };
  return names[disposition] || disposition;
}

/**
 * Validate disposition reason is provided for non-accept decisions
 * FR-068: Disposition reason is mandatory for non-accept decisions
 */
function validateDispositionReason(disposition: DispositionType, reason: string): void {
  if (disposition !== 'accept' && !reason.trim()) {
    throw new Error(`Disposition reason is required for ${getDispositionDisplayName(disposition)} decisions`);
  }
}

/**
 * Map disposition to lot status
 * FR-069: Auto lot status update based on disposition
 */
function mapDispositionToLotStatus(disposition: DispositionType): string | null {
  switch (disposition) {
    case 'accept':
      return 'released';
    case 'reject':
      return 'rejected';
    case 'scrap':
      return 'scrapped';
    case 'return_to_vendor':
      return 'returned';
    case 'rework':
      return 'under_rework';
    case 'conditional_release':
      return 'conditional';
    default:
      return null;
  }
}

/**
 * Set disposition decision on a QC test
 * FR-067: Record disposition decision
 * FR-068: Capture disposition reason
 * FR-071-074: Electronic signature required
 */
export async function setDisposition(input: DispositionInput): Promise<DispositionResult> {
  const { testId, disposition, reason, userId, password } = input;
  const { tests, users } = getTables();
  const database = db();

  try {
    // Validate disposition reason
    validateDispositionReason(disposition, reason);

    // Verify user password for e-signature
    const passwordValid = await verifyUserPassword(userId, password);
    if (!passwordValid) {
      return { success: false, testId, error: 'Invalid password' };
    }

    // Get test details
    const [test] = await database
      .select({
        id: tests.id,
        status: tests.status,
        disposition: tests.disposition,
        lotId: tests.lotId,
      })
      .from(tests)
      .where(eq(tests.id, testId));

    if (!test) {
      return { success: false, testId, error: 'Test not found' };
    }

    // Check if test already has a disposition
    if (test.disposition) {
      return { success: false, testId, error: 'Test already has a disposition decision' };
    }

    // Get user details for signature
    const [user] = await database
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { success: false, testId, error: 'User not found' };
    }

    // Update test with disposition
    const now = getNow();
    await database
      .update(tests)
      .set({
        disposition,
        dispositionBy: userId,
        dispositionAt: now,
        dispositionReason: reason || null,
        updatedAt: now,
      })
      .where(eq(tests.id, testId));

    // Create electronic signature
    const signatureMeaning = `I have reviewed the QC test results and made a disposition decision: ${getDispositionDisplayName(disposition)}${reason ? `. Reason: ${reason}` : ''}`;

    await createElectronicSignature({
      entityType: 'disposition',
      entityId: testId,
      action: 'disposition_decision',
      userId,
      meaning: signatureMeaning,
    });

    // Create audit log (FR-070)
    await createAuditLog({
      userId,
      action: 'UPDATE',
      tableName: 'quality_tests',
      recordId: testId,
      oldValue: { disposition: null },
      newValue: {
        disposition,
        dispositionReason: reason,
        dispositionBy: userId,
      },
    });

    return {
      success: true,
      testId,
      disposition,
    };
  } catch (error) {
    console.error('Error setting disposition:', error);
    return {
      success: false,
      testId,
      error: error instanceof Error ? error.message : 'Failed to set disposition',
    };
  }
}

/**
 * Approve disposition decision (dual sign-off)
 * FR-069: Auto lot status update after approval
 * FR-071-074: Electronic signature required
 */
export async function approveDisposition(input: DispositionApprovalInput): Promise<DispositionResult> {
  const { testId, userId, password, approvalNotes } = input;
  const { tests, lots, users } = getTables();
  const database = db();

  try {
    // Verify user password for e-signature
    const passwordValid = await verifyUserPassword(userId, password);
    if (!passwordValid) {
      return { success: false, testId, error: 'Invalid password' };
    }

    // Get test details
    const [test] = await database
      .select({
        id: tests.id,
        disposition: tests.disposition,
        dispositionBy: tests.dispositionBy,
        dispositionApprovedBy: tests.dispositionApprovedBy,
        lotId: tests.lotId,
      })
      .from(tests)
      .where(eq(tests.id, testId));

    if (!test) {
      return { success: false, testId, error: 'Test not found' };
    }

    // Check if disposition exists
    if (!test.disposition) {
      return { success: false, testId, error: 'No disposition decision to approve' };
    }

    // Check if already approved
    if (test.dispositionApprovedBy) {
      return { success: false, testId, error: 'Disposition already approved' };
    }

    // Ensure approver is different from disposition maker (dual sign-off)
    if (test.dispositionBy === userId) {
      return { success: false, testId, error: 'Approver must be different from the person who made the disposition decision' };
    }

    // Get user details
    const [user] = await database
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { success: false, testId, error: 'User not found' };
    }

    // Update test with approval
    const now = getNow();
    await database
      .update(tests)
      .set({
        dispositionApprovedBy: userId,
        dispositionApprovedAt: now,
        updatedAt: now,
      })
      .where(eq(tests.id, testId));

    // Create electronic signature
    const signatureMeaning = `I approve the disposition decision: ${getDispositionDisplayName(test.disposition as DispositionType)}${approvalNotes ? `. Notes: ${approvalNotes}` : ''}`;

    await createElectronicSignature({
      entityType: 'disposition',
      entityId: testId,
      action: 'disposition_approval',
      userId,
      meaning: signatureMeaning,
    });

    // Update lot status based on disposition (FR-069)
    let lotStatusUpdated = false;
    let newLotStatus: string | undefined;

    if (test.lotId) {
      const targetLotStatus = mapDispositionToLotStatus(test.disposition as DispositionType);

      if (targetLotStatus) {
        await database
          .update(lots)
          .set({
            status: targetLotStatus,
            updatedAt: now,
          })
          .where(eq(lots.id, test.lotId));

        lotStatusUpdated = true;
        newLotStatus = targetLotStatus;

        // Create audit log for lot status change
        await createAuditLog({
          userId,
          action: 'UPDATE',
          tableName: 'inventory_lots',
          recordId: test.lotId,
          newValue: {
            status: targetLotStatus,
            reason: `Disposition approved: ${getDispositionDisplayName(test.disposition as DispositionType)}`,
          },
        });
      }
    }

    // Create audit log for approval (FR-070)
    await createAuditLog({
      userId,
      action: 'UPDATE',
      tableName: 'quality_tests',
      recordId: testId,
      oldValue: { dispositionApprovedBy: null },
      newValue: {
        dispositionApprovedBy: userId,
        approvalNotes,
      },
    });

    return {
      success: true,
      testId,
      disposition: test.disposition as DispositionType,
      lotStatusUpdated,
      newLotStatus,
    };
  } catch (error) {
    console.error('Error approving disposition:', error);
    return {
      success: false,
      testId,
      error: error instanceof Error ? error.message : 'Failed to approve disposition',
    };
  }
}

/**
 * Get disposition details for a test
 */
export async function getDispositionDetails(testId: number): Promise<DispositionDetails | null> {
  const { tests, lots, users, signatures } = getTables();
  const database = db();

  // Get test details
  const [test] = await database
    .select({
      id: tests.id,
      testType: tests.testType,
      status: tests.status,
      result: tests.result,
      disposition: tests.disposition,
      dispositionReason: tests.dispositionReason,
      dispositionBy: tests.dispositionBy,
      dispositionAt: tests.dispositionAt,
      dispositionApprovedBy: tests.dispositionApprovedBy,
      dispositionApprovedAt: tests.dispositionApprovedAt,
      lotId: tests.lotId,
    })
    .from(tests)
    .where(eq(tests.id, testId));

  if (!test) {
    return null;
  }

  // Get lot details
  let lot = null;
  if (test.lotId) {
    const [lotData] = await database
      .select({
        id: lots.id,
        lotNumber: lots.lotNumber,
        status: lots.status,
      })
      .from(lots)
      .where(eq(lots.id, test.lotId));
    lot = lotData || null;
  }

  // Get disposition by user
  let dispositionByUser = null;
  if (test.dispositionBy) {
    const [userData] = await database
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, test.dispositionBy));
    dispositionByUser = userData || null;
  }

  // Get approved by user
  let approvedByUser = null;
  if (test.dispositionApprovedBy) {
    const [userData] = await database
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, test.dispositionApprovedBy));
    approvedByUser = userData || null;
  }

  // Get signatures
  const signatureRecords = await database
    .select({
      id: signatures.id,
      action: signatures.action,
      userId: signatures.userId,
      signedAt: signatures.signedAt,
      meaning: signatures.meaning,
    })
    .from(signatures)
    .where(
      and(
        eq(signatures.entityType, 'disposition'),
        eq(signatures.entityId, testId)
      )
    )
    .orderBy(desc(signatures.signedAt));

  // Get user names for signatures
  const signatureDetails = await Promise.all(
    signatureRecords.map(async (sig) => {
      const [sigUser] = await database
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, sig.userId));
      return {
        id: sig.id,
        action: sig.action,
        fullName: sigUser?.fullName || 'Unknown',
        signedAt: String(sig.signedAt),
        meaning: sig.meaning,
      };
    })
  );

  return {
    test: {
      id: test.id,
      testType: test.testType,
      status: test.status,
      result: test.result,
      disposition: test.disposition as DispositionType | null,
      dispositionReason: test.dispositionReason,
      dispositionAt: test.dispositionAt ? String(test.dispositionAt) : null,
      dispositionApprovedAt: test.dispositionApprovedAt ? String(test.dispositionApprovedAt) : null,
    },
    lot,
    dispositionBy: dispositionByUser,
    approvedBy: approvedByUser,
    signatures: signatureDetails,
  };
}

/**
 * Get QC summary statistics
 * FR-051: QC Summary for dashboard
 */
export async function getQCSummary(): Promise<QCSummary> {
  const { tests } = getTables();
  const database = db();

  // Get all tests
  const allTests = await database
    .select({
      id: tests.id,
      testType: tests.testType,
      status: tests.status,
      disposition: tests.disposition,
      dispositionApprovedBy: tests.dispositionApprovedBy,
    })
    .from(tests);

  const summary: QCSummary = {
    total: allTests.length,
    pending: 0,
    passed: 0,
    failed: 0,
    pendingDisposition: 0,
    pendingApproval: 0,
    byTestType: {},
  };

  for (const test of allTests) {
    // Count by status
    if (test.status === 'pending') {
      summary.pending++;
    } else if (test.status === 'passed') {
      summary.passed++;
    } else if (test.status === 'failed') {
      summary.failed++;
    }

    // Count pending disposition (failed tests without disposition)
    if (test.status === 'failed' && !test.disposition) {
      summary.pendingDisposition++;
    }

    // Count pending approval (has disposition but not approved)
    if (test.disposition && !test.dispositionApprovedBy) {
      summary.pendingApproval++;
    }

    // Group by test type
    if (!summary.byTestType[test.testType]) {
      summary.byTestType[test.testType] = { total: 0, passed: 0, failed: 0, pending: 0 };
    }
    summary.byTestType[test.testType].total++;
    if (test.status === 'passed') {
      summary.byTestType[test.testType].passed++;
    } else if (test.status === 'failed') {
      summary.byTestType[test.testType].failed++;
    } else {
      summary.byTestType[test.testType].pending++;
    }
  }

  return summary;
}

/**
 * Get tests pending release/disposition
 * FR-053: Pending QC for dashboard
 */
export async function getPendingRelease(): Promise<PendingReleaseItem[]> {
  const { tests, lots } = getTables();
  const database = db();

  // Import items table dynamically based on database type
  const items = isSqlite()
    ? (await import('../db/schema')).sqliteItems
    : (await import('../db/schema')).mysqlItems;

  // Get tests that need attention (failed without disposition, or disposition without approval)
  const pendingTests = await database
    .select({
      testId: tests.id,
      testType: tests.testType,
      status: tests.status,
      result: tests.result,
      disposition: tests.disposition,
      dispositionReason: tests.dispositionReason,
      dispositionApprovedBy: tests.dispositionApprovedBy,
      testedAt: tests.testedAt,
      lotId: tests.lotId,
      lotNumber: lots.lotNumber,
      itemId: lots.itemId,
    })
    .from(tests)
    .leftJoin(lots, eq(tests.lotId, lots.id))
    .where(
      sql`(${tests.status} = 'failed' AND ${tests.disposition} IS NULL) OR (${tests.disposition} IS NOT NULL AND ${tests.dispositionApprovedBy} IS NULL)`
    )
    .orderBy(desc(tests.testedAt));

  // Get item details
  const results: PendingReleaseItem[] = [];
  for (const test of pendingTests) {
    let itemCode = '';
    let itemName = '';

    if (test.itemId) {
      const [item] = await database
        .select({
          code: items.code,
          nameEn: items.nameEn,
        })
        .from(items)
        .where(eq(items.id, test.itemId));

      if (item) {
        itemCode = item.code;
        itemName = item.nameEn || item.code;
      }
    }

    results.push({
      testId: test.testId,
      testType: test.testType,
      lotId: test.lotId || 0,
      lotNumber: test.lotNumber || '',
      itemId: test.itemId || 0,
      itemCode,
      itemName,
      status: test.status,
      result: test.result,
      disposition: test.disposition as DispositionType | null,
      dispositionReason: test.dispositionReason,
      testedAt: test.testedAt ? String(test.testedAt) : null,
      needsDisposition: test.status === 'failed' && !test.disposition,
      needsApproval: !!test.disposition && !test.dispositionApprovedBy,
    });
  }

  return results;
}

/**
 * Check if all tests for a lot have been dispositioned and approved
 */
export async function checkLotDispositionComplete(lotId: number): Promise<{
  allComplete: boolean;
  totalTests: number;
  pendingDisposition: number;
  pendingApproval: number;
}> {
  const { tests } = getTables();
  const database = db();

  const lotTests = await database
    .select({
      id: tests.id,
      status: tests.status,
      disposition: tests.disposition,
      dispositionApprovedBy: tests.dispositionApprovedBy,
    })
    .from(tests)
    .where(eq(tests.lotId, lotId));

  let pendingDisposition = 0;
  let pendingApproval = 0;

  for (const test of lotTests) {
    // Failed tests need disposition
    if (test.status === 'failed' && !test.disposition) {
      pendingDisposition++;
    }
    // Tests with disposition need approval
    if (test.disposition && !test.dispositionApprovedBy) {
      pendingApproval++;
    }
  }

  return {
    allComplete: pendingDisposition === 0 && pendingApproval === 0,
    totalTests: lotTests.length,
    pendingDisposition,
    pendingApproval,
  };
}

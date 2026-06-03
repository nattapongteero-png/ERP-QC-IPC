/**
 * Production Gate Service
 *
 * Enforces workflow gates for work order status transitions.
 * Each gate checks prerequisites before allowing transition.
 */

import { eq, and, inArray } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '../db/db-helper';
import { isSqlite } from '../db';
import {
  sqliteWOCleaningLogs,
  sqliteWOSOPExecution,
  sqliteWOPackagingWeightLogs,
  sqliteWOPackagingIntegrityLogs,
  sqliteWOFinishedInspection,
  sqliteWOPackagingMaterials,
  sqliteWorkOrderMaterials,
  mysqlWOCleaningLogs,
  mysqlWOSOPExecution,
  mysqlWOPackagingWeightLogs,
  mysqlWOPackagingIntegrityLogs,
  mysqlWOFinishedInspection,
  mysqlWOPackagingMaterials,
  mysqlWorkOrderMaterials,
} from '../db/schema';

function getTables() {
  if (isSqlite()) {
    return {
      woCleaningLogs: sqliteWOCleaningLogs,
      woSOPExecution: sqliteWOSOPExecution,
      woPackagingWeightLogs: sqliteWOPackagingWeightLogs,
      woPackagingIntegrityLogs: sqliteWOPackagingIntegrityLogs,
      woFinishedInspection: sqliteWOFinishedInspection,
      woPackagingMaterials: sqliteWOPackagingMaterials,
      workOrderMaterials: sqliteWorkOrderMaterials,
    };
  }
  return {
    woCleaningLogs: mysqlWOCleaningLogs,
    woSOPExecution: mysqlWOSOPExecution,
    woPackagingWeightLogs: mysqlWOPackagingWeightLogs,
    woPackagingIntegrityLogs: mysqlWOPackagingIntegrityLogs,
    woFinishedInspection: mysqlWOFinishedInspection,
    woPackagingMaterials: mysqlWOPackagingMaterials,
    workOrderMaterials: mysqlWorkOrderMaterials,
  };
}

export interface GateCheckResult {
  canProceed: boolean;
  blockers: string[];
  completedChecks: string[];
}

/**
 * Check if WO can be released (planned → released)
 * Requirements:
 * - Material requisition approved
 */
export async function canRelease(workOrderId: number): Promise<GateCheckResult> {
  const blockers: string[] = [];
  const completedChecks: string[] = [];

  return executeDbOperation(async (db: any) => {
    const workOrders = getTableRef('workOrders');

    const [wo] = await db.select({ requisitionStatus: workOrders.requisitionStatus })
      .from(workOrders)
      .where(eq(workOrders.id, workOrderId));

    if (!wo) {
      blockers.push('Work order not found');
    } else if (wo.requisitionStatus !== 'approved') {
      blockers.push('ใบเบิกวัตถุดิบยังไม่ได้รับการอนุมัติจากคลังสินค้า (Material requisition not approved)');
    } else {
      completedChecks.push('ใบเบิกวัตถุดิบอนุมัติแล้ว');
    }

    return { canProceed: blockers.length === 0, blockers, completedChecks };
  });
}

/**
 * Check if production can start (released → in_progress)
 * Requirements:
 * - Pre-production cleaning complete + verified
 * - All materials weighed + verified
 */
export async function canStartProduction(workOrderId: number): Promise<GateCheckResult> {
  const tables = getTables();
  const blockers: string[] = [];
  const completedChecks: string[] = [];

  return executeDbOperation(async (db: any) => {
    // Check pre-production cleaning
    const cleaningLogs = await db
      .select()
      .from(tables.woCleaningLogs)
      .where(
        and(
          eq(tables.woCleaningLogs.workOrderId, workOrderId),
          eq(tables.woCleaningLogs.phase, 'pre_production')
        )
      );

    if (cleaningLogs.length === 0) {
      blockers.push('No pre-production cleaning logs recorded');
    } else {
      const allClean = cleaningLogs.every((log: any) => log.isClean);
      const allVerified = cleaningLogs.every((log: any) => log.verifierId !== null);

      if (!allClean) {
        blockers.push('Not all pre-production cleaning items marked as clean');
      } else if (!allVerified) {
        blockers.push('Not all pre-production cleaning items verified');
      } else {
        completedChecks.push('Pre-production cleaning complete and verified');
      }
    }

    // Check material weighing
    const materials = await db
      .select()
      .from(tables.workOrderMaterials)
      .where(eq(tables.workOrderMaterials.workOrderId, workOrderId));

    if (materials.length === 0) {
      blockers.push('No materials assigned to work order');
    } else {
      const allWeighed = materials.every((m: any) => m.weighedQty !== null);
      const allVerified = materials.every((m: any) => m.verifiedBy !== null);

      if (!allWeighed) {
        blockers.push('Not all materials have been weighed');
      } else if (!allVerified) {
        blockers.push('Not all material weights have been verified');
      } else {
        completedChecks.push('All materials weighed and verified');
      }
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
      completedChecks,
    };
  });
}

/**
 * Check if production can complete (in_progress → completed)
 * Requirements:
 * - All SOP steps completed + verified
 * - Post-production cleaning complete + verified
 * - Finished product inspection passed
 */
export async function canCompleteProduction(workOrderId: number): Promise<GateCheckResult> {
  const tables = getTables();
  const blockers: string[] = [];
  const completedChecks: string[] = [];

  return executeDbOperation(async (db: any) => {
    // Check SOP execution — join with bomSOPSteps to know criticality
    const bomSteps = getTableRef('bOMSOPSteps');
    const sopSteps = await db
      .select({
        id: tables.woSOPExecution.id,
        sequence: tables.woSOPExecution.sequence,
        isCompleted: tables.woSOPExecution.isCompleted,
        verifierId: tables.woSOPExecution.verifierId,
        pmApprovedBy: tables.woSOPExecution.pmApprovedBy,
        status: tables.woSOPExecution.status,
        isCritical: bomSteps.isCritical,
      })
      .from(tables.woSOPExecution)
      .leftJoin(bomSteps, eq(tables.woSOPExecution.bomStepId, bomSteps.id))
      .where(eq(tables.woSOPExecution.workOrderId, workOrderId));

    if (sopSteps.length === 0) {
      blockers.push('ยังไม่มีขั้นตอน SOP (No SOP steps initialized)');
    } else {
      const allCompleted = sopSteps.every((step: any) => step.isCompleted);
      const allVerified = sopSteps.every(
        (step: any) => !step.requiresVerification || step.verifierId !== null
      );

      if (!allCompleted) {
        const incomplete = sopSteps.filter((s: any) => !s.isCompleted).length;
        blockers.push(`SOP ยังไม่เสร็จ ${incomplete} ขั้นตอน (${incomplete} SOP steps incomplete)`);
      } else if (!allVerified) {
        const unverified = sopSteps.filter(
          (s: any) => s.requiresVerification && s.verifierId === null
        ).length;
        blockers.push(`SOP ยังไม่ verify ${unverified} ขั้นตอน (${unverified} SOP steps not verified)`);
      } else {
        // Audit #16 — critical SOP steps require Production Manager approval
        const criticalUnapproved = sopSteps.filter(
          (s: any) => s.isCritical === true && s.pmApprovedBy == null,
        );
        if (criticalUnapproved.length > 0) {
          const seqs = criticalUnapproved
            .map((s: any) => `#${s.sequence}`)
            .join(', ');
          blockers.push(
            `Critical SOP step ${seqs} ยังไม่ได้รับอนุมัติจาก Production Manager (PM approval required for critical steps)`,
          );
        } else {
          completedChecks.push('SOP ทุกขั้นตอนเสร็จสมบูรณ์ (รวม PM approval สำหรับ critical steps)');
        }
      }
    }

    // Check post-production cleaning
    const cleaningLogs = await db
      .select()
      .from(tables.woCleaningLogs)
      .where(
        and(
          eq(tables.woCleaningLogs.workOrderId, workOrderId),
          eq(tables.woCleaningLogs.phase, 'post_production')
        )
      );

    if (cleaningLogs.length === 0) {
      blockers.push('ยังไม่ได้บันทึก Post-Production Cleaning');
    } else {
      const allClean = cleaningLogs.every((log: any) => log.isClean);
      const allVerified = cleaningLogs.every((log: any) => log.verifierId !== null);

      if (!allClean) {
        blockers.push('Post-Production Cleaning ยังไม่ผ่านทั้งหมด');
      } else if (!allVerified) {
        blockers.push('Post-Production Cleaning ยังไม่ได้ verify ทั้งหมด');
      } else {
        completedChecks.push('Post-Production Cleaning เสร็จสมบูรณ์');
      }
    }

    // Check finished product inspection
    const inspections = await db
      .select()
      .from(tables.woFinishedInspection)
      .where(eq(tables.woFinishedInspection.workOrderId, workOrderId));

    if (inspections.length === 0) {
      blockers.push('ยังไม่ได้ตรวจ Final Inspection (Finished product inspection not recorded)');
    } else {
      const inspection = inspections[0];
      if (inspection.status !== 'passed') {
        blockers.push(`Final Inspection ยังไม่ผ่าน (status: ${inspection.status})`);
      } else {
        completedChecks.push('Final Inspection ผ่านแล้ว');
      }
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
      completedChecks,
    };
  });
}

/**
 * Check if packaging can start (completed → packaging)
 * Requirements:
 * - Cleaning complete + verified (line clearance + packaging area)
 *
 * Pre-Packaging phase was collapsed into Packaging in the UI; both
 * `phase='pre_packaging'` (legacy BOMs) and `phase='packaging'` cleaning
 * logs satisfy this gate.
 */
export async function canStartPackaging(workOrderId: number): Promise<GateCheckResult> {
  const tables = getTables();
  const blockers: string[] = [];
  const completedChecks: string[] = [];

  return executeDbOperation(async (db: any) => {
    const cleaningLogs = await db
      .select()
      .from(tables.woCleaningLogs)
      .where(
        and(
          eq(tables.woCleaningLogs.workOrderId, workOrderId),
          inArray(tables.woCleaningLogs.phase, ['pre_packaging', 'packaging'])
        )
      );

    if (cleaningLogs.length === 0) {
      blockers.push('No packaging cleaning logs recorded');
    } else {
      const allClean = cleaningLogs.every((log: any) => log.isClean);
      const allVerified = cleaningLogs.every((log: any) => log.verifierId !== null);

      if (!allClean) {
        blockers.push('Not all packaging cleaning items marked as clean');
      } else if (!allVerified) {
        blockers.push('Not all packaging cleaning items verified');
      } else {
        completedChecks.push('Packaging cleaning complete and verified');
      }
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
      completedChecks,
    };
  });
}

/**
 * Check if packaging can complete (packaging → packed)
 * Requirements:
 * - Weight checks passed
 * - Integrity checks passed
 * - Environmental logs recorded during packaging
 */
export async function canCompletePackaging(workOrderId: number): Promise<GateCheckResult> {
  const tables = getTables();
  const blockers: string[] = [];
  const completedChecks: string[] = [];

  return executeDbOperation(async (db: any) => {
    // Check weight logs
    const weightLogs = await db
      .select()
      .from(tables.woPackagingWeightLogs)
      .where(eq(tables.woPackagingWeightLogs.workOrderId, workOrderId));

    if (weightLogs.length === 0) {
      blockers.push('No packaging weight checks recorded');
    } else {
      const failedLogs = weightLogs.filter((log: any) => !log.isPass);
      if (failedLogs.length > 0) {
        blockers.push(`${failedLogs.length} weight check(s) failed`);
      } else {
        completedChecks.push('All weight checks passed');
      }
    }

    // Check integrity logs
    const integrityLogs = await db
      .select()
      .from(tables.woPackagingIntegrityLogs)
      .where(eq(tables.woPackagingIntegrityLogs.workOrderId, workOrderId));

    if (integrityLogs.length === 0) {
      blockers.push('No packaging integrity checks recorded');
    } else {
      const failedLogs = integrityLogs.filter(
        (log: any) => !log.tubeCapComplete || !log.lotNumberCorrect || !log.packingCorrect
      );
      if (failedLogs.length > 0) {
        blockers.push(`${failedLogs.length} integrity check(s) have failures`);
      } else {
        completedChecks.push('All integrity checks passed');
      }
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
      completedChecks,
    };
  });
}

/**
 * Check if work order can close (packed → closed)
 * Requirements:
 * - Finished inspection passed
 * - Packaging materials reconciled
 */
export async function canCloseWorkOrder(workOrderId: number): Promise<GateCheckResult> {
  const tables = getTables();
  const blockers: string[] = [];
  const completedChecks: string[] = [];

  return executeDbOperation(async (db: any) => {
    // Check finished inspection
    const inspections = await db
      .select()
      .from(tables.woFinishedInspection)
      .where(eq(tables.woFinishedInspection.workOrderId, workOrderId));

    if (inspections.length === 0) {
      blockers.push('No finished product inspection recorded');
    } else {
      const inspection = inspections[0];
      if (inspection.status === 'pending') {
        blockers.push('Finished product inspection pending');
      } else if (inspection.status === 'fail') {
        blockers.push('Finished product inspection failed');
      } else {
        completedChecks.push(`Finished product inspection ${inspection.status}`);
      }
    }

    // Check packaging materials reconciliation
    const materials = await db
      .select()
      .from(tables.woPackagingMaterials)
      .where(eq(tables.woPackagingMaterials.workOrderId, workOrderId));

    if (materials.length > 0) {
      const unverified = materials.filter((m: any) => m.verifierId === null);
      if (unverified.length > 0) {
        blockers.push(`${unverified.length} packaging material(s) not verified`);
      } else {
        completedChecks.push('All packaging materials verified');
      }
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
      completedChecks,
    };
  });
}

/**
 * Get overall gate status for a work order
 * Returns all gate check results for display
 */
export async function getGateStatus(workOrderId: number) {
  const [startProduction, completeProduction, startPackaging, completePackaging, closeWorkOrder] =
    await Promise.all([
      canStartProduction(workOrderId),
      canCompleteProduction(workOrderId),
      canStartPackaging(workOrderId),
      canCompletePackaging(workOrderId),
      canCloseWorkOrder(workOrderId),
    ]);

  return {
    startProduction,
    completeProduction,
    startPackaging,
    completePackaging,
    closeWorkOrder,
  };
}

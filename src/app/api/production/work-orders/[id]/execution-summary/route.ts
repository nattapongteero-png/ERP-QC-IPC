import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOMaterials,
  getCleaningRequirements,
  getWOSOPExecution,
  getWOEnvironmentalLogs,
  getWOPackagingWeightLogs,
  getWOPackagingIntegrityLogs,
  getWOFinishedInspection,
  getWOIPCTests,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { eq, inArray } from 'drizzle-orm';

// GET /api/production/work-orders/[id]/execution-summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      // Fetch all execution data in parallel.
      // Cleaning uses getCleaningRequirements (which merges BOM rooms+equipment
      // with logs) so 'total' reflects everything the operator has to do — not
      // just the items they've already touched. Earlier we used getWOCleaningLogs
      // which only contained started items, so a BOM with 2 items but only 1
      // marked clean would report total=1 instead of total=2.
      const [
        materials,
        preProductionCleaning,
        productionCleaning,
        postProductionCleaning,
        prePackagingCleaning,
        packagingCleaning,
        sopExecutions,
        preProductionEnvLogs,
        productionEnvLogs,
        packagingEnvLogs,
        packagingWeightLogs,
        packagingIntegrityLogs,
        finishedInspection,
        ipcTests,
      ] = await Promise.all([
        getWOMaterials(workOrderId),
        getCleaningRequirements(workOrderId, 'pre_production'),
        getCleaningRequirements(workOrderId, 'production'),
        getCleaningRequirements(workOrderId, 'post_production'),
        getCleaningRequirements(workOrderId, 'pre_packaging'),
        getCleaningRequirements(workOrderId, 'packaging'),
        getWOSOPExecution(workOrderId),
        getWOEnvironmentalLogs(workOrderId, 'pre_production'),
        getWOEnvironmentalLogs(workOrderId, 'production'),
        getWOEnvironmentalLogs(workOrderId, 'packaging'),
        getWOPackagingWeightLogs(workOrderId),
        getWOPackagingIntegrityLogs(workOrderId),
        getWOFinishedInspection(workOrderId),
        getWOIPCTests(workOrderId),
      ]);

      // Calculate material weighing status
      const materialWeighing = {
        total: materials.length,
        completed: materials.filter((m: any) => m.weighedAt).length,
        verified: materials.filter((m: any) => m.verifiedAt).length,
      };

      // Cleaning data comes from getCleaningRequirements which is a list of
      // BOM-required items (rooms + equipment) with optional cleaningLog.
      // Total = items from BOM, completed = items with isClean log, verified
      // = items with a verifiedAt timestamp on their log.
      const preProductionCleaningStatus = {
        total: preProductionCleaning.length,
        completed: preProductionCleaning.filter((r: any) => r.cleaningLog?.isClean).length,
        verified: preProductionCleaning.filter((r: any) => r.cleaningLog?.verifiedAt).length,
      };

      const productionCleaningStatus = {
        total: productionCleaning.length,
        completed: productionCleaning.filter((r: any) => r.cleaningLog?.isClean).length,
        verified: productionCleaning.filter((r: any) => r.cleaningLog?.verifiedAt).length,
      };

      // Calculate SOP execution status
      const sopExecution = {
        total: sopExecutions.length,
        completed: sopExecutions.filter((s: any) => s.isCompleted).length,
        verified: sopExecutions.filter((s: any) => s.verifiedAt).length,
      };

      // Calculate pre-production environmental status
      const preProductionEnvironmental = {
        total: preProductionEnvLogs.length > 0 ? preProductionEnvLogs.length : 0,
        recorded: preProductionEnvLogs.length,
        normal: preProductionEnvLogs.filter((l: any) => l.isNormal).length,
      };

      // Calculate production environmental status
      const productionEnvironmental = {
        total: productionEnvLogs.length > 0 ? productionEnvLogs.length : 0,
        recorded: productionEnvLogs.length,
        normal: productionEnvLogs.filter((l: any) => l.isNormal).length,
      };

      const postProductionCleaningStatus = {
        total: postProductionCleaning.length,
        completed: postProductionCleaning.filter((r: any) => r.cleaningLog?.isClean).length,
        verified: postProductionCleaning.filter((r: any) => r.cleaningLog?.verifiedAt).length,
      };

      const prePackagingCleaningStatus = {
        total: prePackagingCleaning.length,
        completed: prePackagingCleaning.filter((r: any) => r.cleaningLog?.isClean).length,
        verified: prePackagingCleaning.filter((r: any) => r.cleaningLog?.verifiedAt).length,
      };

      const packagingCleaningStatus = {
        total: packagingCleaning.length,
        completed: packagingCleaning.filter((r: any) => r.cleaningLog?.isClean).length,
        verified: packagingCleaning.filter((r: any) => r.cleaningLog?.verifiedAt).length,
      };

      // Calculate packaging weight status
      const packagingWeight = {
        total: packagingWeightLogs.length,
        passed: packagingWeightLogs.filter((l: any) => l.isPass).length,
      };

      // Calculate packaging integrity status
      const packagingIntegrity = {
        total: packagingIntegrityLogs.length,
        passed: packagingIntegrityLogs.filter(
          (l: any) => l.tubeCapComplete && l.lotNumberCorrect && l.packingCorrect
        ).length,
      };

      // Calculate packaging environmental status
      const packagingEnvironmental = {
        total: packagingEnvLogs.length > 0 ? packagingEnvLogs.length : 0,
        recorded: packagingEnvLogs.length,
        normal: packagingEnvLogs.filter((l: any) => l.isNormal).length,
      };

      // Calculate finished inspection status
      const finishedInspectionStatus = {
        status: finishedInspection
          ? finishedInspection.status === 'passed'
            ? 'passed'
            : finishedInspection.status === 'failed'
            ? 'failed'
            : 'in_progress'
          : 'pending',
      };

      // Fetch production output status and WO status from work order
      const woData = await executeDbOperation(async (db) => {
        const workOrders = getTableRef('workOrders');
        const rows = await db
          .select({
            status: workOrders.status,
            actualQuantity: workOrders.actualQuantity,
            yieldPercentage: workOrders.yieldPercentage,
            bulkOutputQty: workOrders.bulkOutputQty,
            bulkOutputRecordedAt: workOrders.bulkOutputRecordedAt,
            finishedOutputQty: workOrders.finishedOutputQty,
            finishedOutputRecordedAt: workOrders.finishedOutputRecordedAt,
          })
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId))
          .limit(1);
        return rows[0] || null;
      });

      const bulkOutput = {
        recorded: woData?.bulkOutputQty !== null && woData?.bulkOutputQty !== undefined,
        quantity: woData?.bulkOutputQty ? Number(woData.bulkOutputQty) : null,
        recordedAt: woData?.bulkOutputRecordedAt || null,
      };

      const finishedOutput = {
        recorded: woData?.finishedOutputQty !== null && woData?.finishedOutputQty !== undefined,
        quantity: woData?.finishedOutputQty ? Number(woData.finishedOutputQty) : null,
        recordedAt: woData?.finishedOutputRecordedAt || null,
      };

      // Backwards-compat alias — legacy consumers read productionOutput.recorded
      const productionOutput = {
        recorded: finishedOutput.recorded || (woData?.actualQuantity !== null && woData?.actualQuantity !== undefined),
        actualQuantity: woData?.actualQuantity ? Number(woData.actualQuantity) : null,
        yieldPercent: woData?.yieldPercentage ? Number(woData.yieldPercentage) : null,
      };

      // Fetch requisition fields from work order
      const woReqResult = await executeDbOperation(async (db) => {
        const workOrders = getTableRef('workOrders');
        return db.select({
          requisitionStatus: workOrders.requisitionStatus,
          requisitionRequestedBy: workOrders.requisitionRequestedBy,
          requisitionRequestedAt: workOrders.requisitionRequestedAt,
          requisitionApprovedBy: workOrders.requisitionApprovedBy,
          requisitionApprovedAt: workOrders.requisitionApprovedAt,
        }).from(workOrders).where(eq(workOrders.id, workOrderId));
      });

      // Resolve user names for requestedBy / approvedBy
      const reqRow = woReqResult[0];
      const reqUserIds: number[] = [];
      if (reqRow?.requisitionRequestedBy) reqUserIds.push(reqRow.requisitionRequestedBy);
      if (reqRow?.requisitionApprovedBy) reqUserIds.push(reqRow.requisitionApprovedBy);

      const reqUserMap = new Map<number, string>();
      if (reqUserIds.length > 0) {
        const usersTable = getTableRef('users');
        const userRows = await executeDbOperation(async (db) =>
          db.select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable)
            .where(inArray(usersTable.id, reqUserIds))
        );
        for (const u of userRows) reqUserMap.set(u.id, u.name);
      }

      const materialRequisition = {
        status: reqRow?.requisitionStatus || 'none',
        requestedBy: reqRow?.requisitionRequestedBy || null,
        requestedAt: reqRow?.requisitionRequestedAt || null,
        approvedBy: reqRow?.requisitionApprovedBy || null,
        approvedAt: reqRow?.requisitionApprovedAt || null,
        requestedByName: reqRow?.requisitionRequestedBy
          ? (reqUserMap.get(reqRow.requisitionRequestedBy) || null)
          : null,
        approvedByName: reqRow?.requisitionApprovedBy
          ? (reqUserMap.get(reqRow.requisitionApprovedBy) || null)
          : null,
      };

      // Calculate IPC (In-Process Control) status
      const ipcTestList = Array.isArray(ipcTests) ? ipcTests : [];
      const ipc = {
        total: ipcTestList.length,
        completed: ipcTestList.filter((t: any) => t.status === 'pass' || t.status === 'fail').length,
        approved: ipcTestList.filter((t: any) => t.approvedBy != null).length,
      };

      const summary = {
        workOrderStatus: woData?.status || 'planned',
        materialRequisition,
        materialWeighing,
        preProductionCleaning: preProductionCleaningStatus,
        preProductionEnvironmental,
        productionCleaning: productionCleaningStatus,
        sopExecution,
        productionEnvironmental,
        productionOutput,
        bulkOutput,
        finishedOutput,
        postProductionCleaning: postProductionCleaningStatus,
        prePackagingCleaning: prePackagingCleaningStatus,
        packagingCleaning: packagingCleaningStatus,
        packagingWeight,
        packagingIntegrity,
        packagingEnvironmental,
        finishedInspection: finishedInspectionStatus,
        ipc,
      };

      return successResponse(summary);
    } catch (error) {
      console.error('Error fetching execution summary:', error);
      return serverErrorResponse(error);
    }
  });
}

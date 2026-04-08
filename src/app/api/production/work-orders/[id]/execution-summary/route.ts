import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOMaterials,
  getWOCleaningLogs,
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

      // Fetch all execution data in parallel
      const [
        materials,
        preProductionCleaning,
        productionCleaning,
        postProductionCleaning,
        prePackagingCleaning,
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
        getWOCleaningLogs(workOrderId, 'pre_production'),
        getWOCleaningLogs(workOrderId, 'production'),
        getWOCleaningLogs(workOrderId, 'post_production'),
        getWOCleaningLogs(workOrderId, 'pre_packaging'),
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

      // Calculate pre-production cleaning status
      const preProductionCleaningStatus = {
        total: preProductionCleaning.length,
        completed: preProductionCleaning.filter((l: any) => l.isClean).length,
        verified: preProductionCleaning.filter((l: any) => l.verifiedAt).length,
      };

      // Calculate production cleaning status
      const productionCleaningStatus = {
        total: productionCleaning.length,
        completed: productionCleaning.filter((l: any) => l.isClean).length,
        verified: productionCleaning.filter((l: any) => l.verifiedAt).length,
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

      // Calculate post-production cleaning status
      const postProductionCleaningStatus = {
        total: postProductionCleaning.length,
        completed: postProductionCleaning.filter((l: any) => l.isClean).length,
        verified: postProductionCleaning.filter((l: any) => l.verifiedAt).length,
      };

      // Calculate pre-packaging cleaning status
      const prePackagingCleaningStatus = {
        total: prePackagingCleaning.length,
        completed: prePackagingCleaning.filter((l: any) => l.isClean).length,
        verified: prePackagingCleaning.filter((l: any) => l.verifiedAt).length,
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
          })
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId))
          .limit(1);
        return rows[0] || null;
      });

      const productionOutput = {
        recorded: woData?.actualQuantity !== null && woData?.actualQuantity !== undefined,
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
        postProductionCleaning: postProductionCleaningStatus,
        prePackagingCleaning: prePackagingCleaningStatus,
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

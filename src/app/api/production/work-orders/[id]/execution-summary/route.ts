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
import { getGowningForWorkOrder } from '@/lib/services/wo-gowning.service';
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

      // Gowning (attire/PPE check) — one record per WO. Surface its status so
      // the dashboard card reflects performed/verified instead of staying at
      // "0/1 pending" forever after it's been recorded.
      const gowningRecord = await getGowningForWorkOrder(workOrderId).catch(() => null);
      const gowning = {
        total: 1,
        completed: gowningRecord && gowningRecord.status !== 'pending' ? 1 : 0,
        verified: gowningRecord?.status === 'verified' ? 1 : 0,
      };

      // Cleaning data comes from getCleaningRequirements which returns the
      // BOM-required items (rooms + equipment) each with optional cleaningLog.
      // Total = items required by BOM, completed = items with isClean log,
      // verified = items with verifiedAt timestamp on their log.
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

      // Calculate SOP execution status (overall + per-phase breakdown).
      // Per-phase counts let the dashboard render one SOP card per phase
      // that actually has steps configured in the BOM.
      const sopExecution = {
        total: sopExecutions.length,
        completed: sopExecutions.filter((s: any) => s.isCompleted).length,
        verified: sopExecutions.filter((s: any) => s.verifiedAt).length,
      };
      const sopByPhase: Record<string, { total: number; completed: number; verified: number }> = {};
      for (const s of sopExecutions as any[]) {
        const p = s.phase || 'production';
        if (!sopByPhase[p]) sopByPhase[p] = { total: 0, completed: 0, verified: 0 };
        sopByPhase[p].total += 1;
        if (s.isCompleted) sopByPhase[p].completed += 1;
        if (s.verifiedAt) sopByPhase[p].verified += 1;
      }

      // Which phases have a BOM room mapping — drives whether the environmental
      // monitoring card shows at all. Environmental logging is keyed off
      // bom_rooms (IoT routes readings by room→phase), so a phase with no room
      // configured can never receive readings and its card should stay hidden.
      // Conversely a phase WITH a room must show the card even before any
      // reading arrives, so the operator can see the "waiting for IoT" state.
      const envPhasesWithRoom = await executeDbOperation(async (db) => {
        const woRef = getTableRef('workOrders');
        const bomRoomsRef = getTableRef('BOMRooms');
        const woRows = await db
          .select({ bomId: woRef.bomId })
          .from(woRef)
          .where(eq(woRef.id, workOrderId))
          .limit(1);
        const bomId = woRows[0]?.bomId;
        if (!bomId) return new Set<string>();
        const roomRows = await db
          .select({ phase: bomRoomsRef.phase })
          .from(bomRoomsRef)
          .where(eq(bomRoomsRef.bomId, Number(bomId)));
        return new Set<string>(roomRows.map((r: any) => String(r.phase)));
      });

      // Calculate pre-production environmental status
      const preProductionEnvironmental = {
        total: preProductionEnvLogs.length > 0 ? preProductionEnvLogs.length : 0,
        recorded: preProductionEnvLogs.length,
        normal: preProductionEnvLogs.filter((l: any) => l.isNormal).length,
        hasRoomMapping: envPhasesWithRoom.has('pre_production'),
      };

      // Calculate production environmental status
      const productionEnvironmental = {
        total: productionEnvLogs.length > 0 ? productionEnvLogs.length : 0,
        recorded: productionEnvLogs.length,
        normal: productionEnvLogs.filter((l: any) => l.isNormal).length,
        hasRoomMapping: envPhasesWithRoom.has('production'),
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
        hasRoomMapping: envPhasesWithRoom.has('packaging'),
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

      // Calculate IPC (In-Process Control) status — overall + per-phase.
      // SOP-recorded tests (sopRecordedAt set by getWOIPCTests sync) count as
      // completed even when the IPC-N row's own status is still 'pending'.
      const ipcTestList = Array.isArray(ipcTests) ? ipcTests : [];
      const isCompleted = (t: any) =>
        t.status === 'pass' || t.status === 'fail' || !!t.sopRecordedAt;
      const ipc = {
        total: ipcTestList.length,
        completed: ipcTestList.filter(isCompleted).length,
        approved: ipcTestList.filter((t: any) => t.approvedBy != null).length,
      };
      const ipcByPhase: Record<string, { total: number; completed: number; approved: number }> = {};
      for (const t of ipcTestList as any[]) {
        const p = t.ipcPhase || 'production';
        if (!ipcByPhase[p]) ipcByPhase[p] = { total: 0, completed: 0, approved: 0 };
        ipcByPhase[p].total += 1;
        if (isCompleted(t)) ipcByPhase[p].completed += 1;
        if (t.approvedBy != null) ipcByPhase[p].approved += 1;
      }

      // Per-phase Line Clearance status — keyed by phase so each cleaning
      // card can render its own status and gate cleaning recording when not
      // verified. Phases: pre_production / production / post_production / packaging.
      const lcTable = getTableRef('lineClearanceChecklists');
      const lcRows = await executeDbOperation(async (db) =>
        db.select({
          id: lcTable.id,
          phase: lcTable.phase,
          status: lcTable.status,
          performedAt: lcTable.performedAt,
          verifiedAt: lcTable.verifiedAt,
        })
          .from(lcTable)
          .where(eq(lcTable.workOrderId, workOrderId))
      );
      const lineClearanceByPhase: Record<string, { id: number; status: string; performedAt: Date | string | null; verifiedAt: Date | string | null }> = {};
      for (const r of lcRows as any[]) {
        // Use latest record per phase if duplicates exist (highest id wins).
        const existing = lineClearanceByPhase[r.phase];
        if (!existing || r.id > existing.id) {
          lineClearanceByPhase[r.phase] = {
            id: r.id,
            status: r.status,
            performedAt: r.performedAt,
            verifiedAt: r.verifiedAt,
          };
        }
      }

      const summary = {
        workOrderStatus: woData?.status || 'planned',
        materialRequisition,
        materialWeighing,
        gowning,
        preProductionCleaning: preProductionCleaningStatus,
        preProductionEnvironmental,
        productionCleaning: productionCleaningStatus,
        sopExecution,
        // Per-phase SOP counts; missing phases simply absent (dashboard hides card).
        sopByPhase,
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
        // Per-phase IPC counts; same render rule as sopByPhase.
        ipcByPhase,
        lineClearanceByPhase,
      };

      return successResponse(summary);
    } catch (error) {
      console.error('Error fetching execution summary:', error);
      return serverErrorResponse(error);
    }
  });
}

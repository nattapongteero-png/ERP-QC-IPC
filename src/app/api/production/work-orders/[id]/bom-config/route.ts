import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse, notFoundResponse, withAuth } from '@/lib/api-utils';
import {
  getBOMRooms,
  getBOMEquipment,
  getBOMEnvironmentalConditions,
  getBOMSOPSteps,
  getBOMPackagingQC,
} from '@/lib/services/bom-configuration.service';
import type { BOMConfigResponse } from '@/types/bom-config';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/production/work-orders/[id]/bom-config
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return notFoundResponse('Invalid work order ID');
      }

      const workOrdersTable = getTableRef('workOrders');
      const woResult = await executeDbOperation(async (db) => {
        return db
          .select({ bomId: workOrdersTable.bomId })
          .from(workOrdersTable)
          .where(eq(workOrdersTable.id, workOrderId))
          .limit(1);
      });

      if (woResult.length === 0) {
        return notFoundResponse('Work order not found');
      }

      const bomId = woResult[0].bomId as number;

      if (!bomId) {
        const emptyConfig: BOMConfigResponse = {
          bomId: 0,
          rooms: [],
          equipment: [],
          environmentalConditions: [],
          sopSteps: [],
          packagingQC: [],
        };
        return successResponse(emptyConfig);
      }

      const [rawRooms, rawEquipment, rawConditions, rawSteps, rawQC] = await Promise.all([
        getBOMRooms(bomId),
        getBOMEquipment(bomId),
        getBOMEnvironmentalConditions(bomId),
        getBOMSOPSteps(bomId),
        getBOMPackagingQC(bomId),
      ]);

      const config: BOMConfigResponse = {
        bomId,
        rooms: (rawRooms || []).map((r: any) => ({
          id: r.bomRoom?.id,
          phase: r.bomRoom?.phase || '',
          roomCode: r.room?.code || '',
          roomName: r.room?.name || '',
          roomNameTh: r.room?.nameTh || '',
          sequence: r.bomRoom?.sequence || 0,
        })),
        equipment: (rawEquipment || []).map((e: any) => ({
          id: e.bomEquipment?.id,
          phase: e.bomEquipment?.phase || '',
          equipmentCode: e.equipment?.code || '',
          equipmentName: e.equipment?.name || '',
          equipmentNameTh: e.equipment?.nameTh || '',
          sequence: e.bomEquipment?.sequence || 0,
        })),
        environmentalConditions: (rawConditions || []).map((c: any) => ({
          id: c.bomCondition?.id,
          phase: c.bomCondition?.phase || '',
          conditionName: c.condition?.name || '',
          temperatureMin: Number(c.condition?.temperatureMin) || 0,
          temperatureMax: Number(c.condition?.temperatureMax) || 0,
          humidityMax: Number(c.condition?.humidityMax) || 0,
          monitoringIntervalMinutes: Number(c.condition?.monitoringIntervalMinutes) || 0,
        })),
        sopSteps: (rawSteps || []).map((s: any) => {
          let parameters: Record<string, number> | null = null;
          let equipmentIds: number[] | null = null;
          try {
            if (s.bomStep?.parameters) parameters = JSON.parse(s.bomStep.parameters);
          } catch { /* ignore parse errors */ }
          try {
            if (s.bomStep?.equipmentIds) equipmentIds = JSON.parse(s.bomStep.equipmentIds);
          } catch { /* ignore parse errors */ }

          return {
            id: s.bomStep?.id,
            sequence: s.bomStep?.sequence || 0,
            stepName: s.bomStep?.stepName || '',
            stepNameTh: s.bomStep?.stepNameTh || '',
            instructions: s.bomStep?.instructions || '',
            instructionsTh: s.bomStep?.instructionsTh || '',
            parameters,
            equipmentIds,
            requiresVerification: Boolean(s.bomStep?.requiresVerification),
          };
        }),
        packagingQC: (rawQC || []).map((q: any) => ({
          id: q.bomQC?.id,
          criteriaName: q.criteria?.name || '',
          weightMin: Number(q.criteria?.weightMin) || 0,
          weightMax: Number(q.criteria?.weightMax) || 0,
          sampleSize: Number(q.criteria?.sampleSize) || 0,
          maxFailures: Number(q.criteria?.maxFailures) || 0,
          checkIntervalMinutes: Number(q.criteria?.checkIntervalMinutes) || 0,
        })),
      };

      return successResponse(config);
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}

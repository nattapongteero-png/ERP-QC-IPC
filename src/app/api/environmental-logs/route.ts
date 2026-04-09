import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOEnvironmentalLogs,
  createWOEnvironmentalLog,
  updateWOEnvironmentalLog,
  deleteWOEnvironmentalLog,
  validateEnvironmentalReading,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { eq, and, inArray } from 'drizzle-orm';

// Valid phases for environmental monitoring
const VALID_PHASES = ['pre_production', 'production', 'packaging'];

// External API Key for IoT/sensor integration
const EXTERNAL_API_KEY = process.env.EXTERNAL_ENV_API_KEY || 'env-monitor-2026-secret';
const ACTIVE_WO_STATUSES = ['released', 'in_progress'];

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return !!apiKey && apiKey === EXTERNAL_API_KEY;
}

/**
 * GET /api/environmental-logs
 *
 * Query params:
 *   ?workOrderId=47&phase=production   — get logs for specific WO
 *   ?roomId=3                          — get active rooms for IoT (API Key only)
 */
export async function GET(request: NextRequest) {
  const isExternal = validateApiKey(request);
  const { searchParams } = new URL(request.url);
  const workOrderId = searchParams.get('workOrderId');
  const roomId = searchParams.get('roomId');

  // External: list active rooms for monitoring
  if (isExternal && !workOrderId) {
    try {
      const workOrders = getTableRef('workOrders');
      const bomRooms = getTableRef('bOMRooms');
      const rooms = getTableRef('productionRooms');

      const activeWOs = await executeDbOperation(async (db) => {
        return db.select({ bomId: workOrders.bomId })
          .from(workOrders)
          .where(inArray(workOrders.status, ACTIVE_WO_STATUSES));
      });

      if (activeWOs.length === 0) return successResponse([]);

      const bomIds = [...new Set(activeWOs.map((wo: { bomId: number }) => wo.bomId))];

      const conditions = roomId ? and(eq(bomRooms.roomId, Number(roomId)), inArray(bomRooms.bomId, bomIds))
        : inArray(bomRooms.bomId, bomIds);

      const activeRooms = await executeDbOperation(async (db) => {
        return db.select({
          roomId: bomRooms.roomId,
          roomCode: rooms.code,
          roomName: rooms.name,
          phase: bomRooms.phase,
          bomId: bomRooms.bomId,
        })
        .from(bomRooms)
        .leftJoin(rooms, eq(bomRooms.roomId, rooms.id))
        .where(conditions);
      });

      return successResponse(activeRooms);
    } catch (error) {
      console.error('Error fetching active rooms:', error);
      return serverErrorResponse(error);
    }
  }

  // Internal: get logs for specific WO
  const handleGet = async () => {
    try {
      if (!workOrderId) return errorResponse('Missing workOrderId parameter');
      const phase = searchParams.get('phase') || undefined;
      if (phase && !VALID_PHASES.includes(phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }
      const logs = await getWOEnvironmentalLogs(Number(workOrderId), phase);
      return successResponse(logs);
    } catch (error) {
      console.error('Error fetching environmental logs:', error);
      return serverErrorResponse(error);
    }
  };

  if (isExternal) return handleGet();
  return withAuth(request, handleGet);
}

/**
 * POST /api/environmental-logs
 *
 * Two modes:
 *   1. Room-based (IoT): { roomId, temperature, humidity }
 *      → auto-finds active WOs for that room
 *   2. WO-based (UI):    { workOrderId, phase, temperature, humidity, roomId? }
 *      → logs to specific WO
 *
 * Auth: X-API-Key (IoT) or JWT session (UI)
 */
export async function POST(request: NextRequest) {
  const isExternal = validateApiKey(request);

  const handlePost = async (operatorUserId: number) => {
    try {
      const data = await request.json();

      if (data.temperature === undefined || data.humidity === undefined) {
        return errorResponse('Missing required fields: temperature, humidity');
      }

      const temperature = Number(data.temperature);
      const humidity = Number(data.humidity);

      // ─── Mode 1: Room-based (IoT sensor) ───────────────────────
      if (!data.workOrderId && data.roomId) {
        const roomId = Number(data.roomId);

        // Find active WOs
        const workOrders = getTableRef('workOrders');
        const activeWOs = await executeDbOperation(async (db) => {
          return db.select({ id: workOrders.id, bomId: workOrders.bomId })
            .from(workOrders)
            .where(inArray(workOrders.status, ACTIVE_WO_STATUSES));
        });

        if (activeWOs.length === 0) {
          return successResponse({ logged: 0 }, 'No active work orders — reading not logged');
        }

        // Find BOM rooms matching this roomId
        const bomRooms = getTableRef('bOMRooms');
        const bomIds = [...new Set(activeWOs.map((wo: { bomId: number }) => wo.bomId))];

        const matchingBomRooms = await executeDbOperation(async (db) => {
          return db.select({ id: bomRooms.id, bomId: bomRooms.bomId, phase: bomRooms.phase })
            .from(bomRooms)
            .where(and(eq(bomRooms.roomId, roomId), inArray(bomRooms.bomId, bomIds)));
        });

        if (matchingBomRooms.length === 0) {
          return successResponse({ logged: 0 }, `Room ${roomId} not in any active WO`);
        }

        // Log for each matching WO + phase
        const results: { workOrderId: number; phase: string; isNormal: boolean }[] = [];
        for (const bomRoom of matchingBomRooms) {
          const wo = activeWOs.find((w: { bomId: number }) => w.bomId === bomRoom.bomId);
          if (!wo) continue;

          const validation = await validateEnvironmentalReading(
            bomRoom.bomId as number, bomRoom.phase as string, temperature, humidity
          );

          const now = new Date();
          await createWOEnvironmentalLog({
            workOrderId: wo.id as number,
            bomConditionId: validation.bomConditionId,
            roomId,
            phase: bomRoom.phase as string,
            recordedDate: now.toISOString().split('T')[0],
            recordedTime: now.toTimeString().split(' ')[0].substring(0, 5),
            temperature, humidity,
            isNormal: validation.isNormal,
            operatorId: operatorUserId,
            notes: data.notes || 'Auto-recorded by IoT sensor',
          });

          results.push({ workOrderId: wo.id as number, phase: bomRoom.phase as string, isNormal: validation.isNormal });
        }

        return successResponse(
          { logged: results.length, details: results },
          `Logged ${results.length} reading(s) for room ${roomId}`
        );
      }

      // ─── Mode 2: WO-based (UI operator) ────────────────────────
      if (!data.workOrderId || !data.phase) {
        return errorResponse('Missing required: (roomId) or (workOrderId + phase)');
      }

      if (!VALID_PHASES.includes(data.phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      const workOrderId = Number(data.workOrderId);

      // Get BOM ID from WO
      const workOrders = getTableRef('workOrders');
      const workOrder = await executeDbOperation(async (db) => {
        const rows = await db.select().from(workOrders).where(eq(workOrders.id, workOrderId));
        return rows[0];
      });

      if (!workOrder) return errorResponse('Work order not found');

      const validation = await validateEnvironmentalReading(
        workOrder.bomId as number, data.phase, temperature, humidity
      );

      const log = await createWOEnvironmentalLog({
        workOrderId,
        bomConditionId: validation.bomConditionId,
        roomId: data.roomId,
        phase: data.phase,
        recordedDate: data.recordedDate || new Date().toISOString().split('T')[0],
        recordedTime: data.recordedTime || new Date().toTimeString().split(' ')[0].substring(0, 5),
        temperature, humidity,
        isNormal: validation.isNormal,
        operatorId: data.operatorId || operatorUserId,
        notes: data.notes || (isExternal ? 'Auto-recorded by sensor' : undefined),
      });

      return successResponse(
        { ...log, limits: validation.limits },
        validation.isNormal ? 'Within normal range' : 'OUTSIDE normal range'
      );
    } catch (error) {
      console.error('Error creating environmental log:', error);
      return serverErrorResponse(error);
    }
  };

  if (isExternal) return handlePost(1);
  return withAuth(request, async (session) => handlePost(session.userId));
}

/**
 * PUT /api/environmental-logs
 * Body: { logId, workOrderId, phase?, roomId?, temperature?, humidity?, notes? }
 */
export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();
      if (!data.logId) return errorResponse('Missing logId');

      let isNormal = data.isNormal;
      if (data.temperature !== undefined || data.humidity !== undefined) {
        if (data.workOrderId && data.phase) {
          const workOrders = getTableRef('workOrders');
          const workOrder = await executeDbOperation(async (db) => {
            const rows = await db.select().from(workOrders).where(eq(workOrders.id, Number(data.workOrderId)));
            return rows[0];
          });
          if (workOrder?.bomId) {
            const validation = await validateEnvironmentalReading(
              workOrder.bomId as number, data.phase, data.temperature, data.humidity
            );
            isNormal = validation.isNormal;
          }
        }
      }

      const log = await updateWOEnvironmentalLog(data.logId, {
        roomId: data.roomId,
        temperature: data.temperature,
        humidity: data.humidity,
        isNormal,
        notes: data.notes,
      });

      return successResponse(log, 'Environmental log updated');
    } catch (error) {
      console.error('Error updating environmental log:', error);
      return serverErrorResponse(error);
    }
  });
}

/**
 * DELETE /api/environmental-logs?logId=123
 */
export async function DELETE(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const logId = searchParams.get('logId');
      if (!logId) return errorResponse('Missing logId parameter');

      await deleteWOEnvironmentalLog(Number(logId));
      return successResponse(null, 'Environmental log deleted');
    } catch (error) {
      console.error('Error deleting environmental log:', error);
      return serverErrorResponse(error);
    }
  });
}

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/api-utils';
import {
  createWOEnvironmentalLog,
  validateEnvironmentalReading,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * POST /api/environmental-sensor
 *
 * IoT-friendly endpoint — sensor sends only roomId + temperature + humidity.
 * System auto-finds the active Work Order(s) using that room and logs the reading.
 *
 * Auth: X-API-Key header
 *
 * Request body:
 *   { roomId: number, temperature: number, humidity: number, notes?: string }
 *
 * Flow:
 *   1. Find active WOs (status = released | in_progress)
 *   2. For each WO, find BOM rooms that reference this roomId
 *   3. Log the reading for each matching WO + phase
 */

const EXTERNAL_API_KEY = process.env.EXTERNAL_ENV_API_KEY || 'env-monitor-2026-secret';
const ACTIVE_WO_STATUSES = ['released', 'in_progress'];

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return !!apiKey && apiKey === EXTERNAL_API_KEY;
}

export async function POST(request: NextRequest) {
  // Auth: API Key only
  if (!validateApiKey(request)) {
    return errorResponse('Invalid or missing API Key', 401);
  }

  try {
    const data = await request.json();

    // Validate required fields
    if (!data.roomId || data.temperature === undefined || data.humidity === undefined) {
      return errorResponse('Missing required fields: roomId, temperature, humidity');
    }

    const roomId = Number(data.roomId);
    const temperature = Number(data.temperature);
    const humidity = Number(data.humidity);

    if (isNaN(roomId) || isNaN(temperature) || isNaN(humidity)) {
      return errorResponse('roomId, temperature, humidity must be numbers');
    }

    // Step 1: Find active Work Orders
    const workOrders = getTableRef('workOrders');
    const activeWOs = await executeDbOperation(async (db) => {
      return db.select({
        id: workOrders.id,
        bomId: workOrders.bomId,
        status: workOrders.status,
      })
      .from(workOrders)
      .where(inArray(workOrders.status, ACTIVE_WO_STATUSES));
    });

    if (activeWOs.length === 0) {
      return successResponse({ logged: 0 }, 'No active work orders found — reading not logged');
    }

    // Step 2: Find BOM rooms that reference this roomId
    const bomRooms = getTableRef('bOMRooms');
    const bomIds = [...new Set(activeWOs.map((wo: { bomId: number }) => wo.bomId))];

    const matchingBomRooms = await executeDbOperation(async (db) => {
      return db.select({
        id: bomRooms.id,
        bomId: bomRooms.bomId,
        roomId: bomRooms.roomId,
        phase: bomRooms.phase,
      })
      .from(bomRooms)
      .where(and(
        eq(bomRooms.roomId, roomId),
        inArray(bomRooms.bomId, bomIds),
      ));
    });

    if (matchingBomRooms.length === 0) {
      return successResponse({ logged: 0 }, `Room ${roomId} is not configured in any active Work Order BOM`);
    }

    // Step 3: Log readings for each matching WO + phase
    const results: { workOrderId: number; phase: string; isNormal: boolean }[] = [];

    for (const bomRoom of matchingBomRooms) {
      // Find the WO that uses this BOM
      const wo = activeWOs.find((w: { bomId: number }) => w.bomId === bomRoom.bomId);
      if (!wo) continue;

      // Validate reading against BOM conditions
      const validation = await validateEnvironmentalReading(
        bomRoom.bomId as number,
        bomRoom.phase as string,
        temperature,
        humidity,
      );

      const now = new Date();
      await createWOEnvironmentalLog({
        workOrderId: wo.id as number,
        bomConditionId: validation.bomConditionId,
        roomId,
        phase: bomRoom.phase as string,
        recordedDate: now.toISOString().split('T')[0],
        recordedTime: now.toTimeString().split(' ')[0].substring(0, 5),
        temperature,
        humidity,
        isNormal: validation.isNormal,
        operatorId: 1, // System Administrator for sensor data
        notes: data.notes || 'Auto-recorded by IoT sensor',
      });

      results.push({
        workOrderId: wo.id as number,
        phase: bomRoom.phase as string,
        isNormal: validation.isNormal,
      });
    }

    return successResponse(
      { logged: results.length, details: results },
      `Logged ${results.length} reading(s) for room ${roomId}`
    );
  } catch (error) {
    console.error('Error processing sensor data:', error);
    return serverErrorResponse(error);
  }
}

/**
 * GET /api/environmental-sensor
 *
 * Returns active rooms that sensors should monitor
 * Auth: X-API-Key header
 */
export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return errorResponse('Invalid or missing API Key', 401);
  }

  try {
    // Find rooms used by active Work Orders
    const workOrders = getTableRef('workOrders');
    const bomRooms = getTableRef('bOMRooms');
    const rooms = getTableRef('productionRooms');

    const activeWOs = await executeDbOperation(async (db) => {
      return db.select({ bomId: workOrders.bomId })
        .from(workOrders)
        .where(inArray(workOrders.status, ACTIVE_WO_STATUSES));
    });

    if (activeWOs.length === 0) {
      return successResponse([]);
    }

    const bomIds = [...new Set(activeWOs.map((wo: { bomId: number }) => wo.bomId))];

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
      .where(inArray(bomRooms.bomId, bomIds));
    });

    return successResponse(activeRooms);
  } catch (error) {
    console.error('Error fetching active rooms:', error);
    return serverErrorResponse(error);
  }
}

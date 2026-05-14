import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';

/**
 * GET /api/iot/rooms
 *
 * Lists every active production room in this tenant for IoT device
 * pairing/provisioning. Unlike /api/environmental-logs which only returns
 * rooms currently bound to an active work order, this endpoint returns the
 * full room master so an installer can pick the room to bind the sensor to —
 * even before any work order has been released.
 *
 * Auth: X-API-Key header (same key as other IoT endpoints)
 */

const EXTERNAL_API_KEY = process.env.EXTERNAL_ENV_API_KEY || 'env-monitor-2026-secret';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return !!apiKey && apiKey === EXTERNAL_API_KEY;
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: invalid or missing X-API-Key' },
      { status: 401 },
    );
  }

  try {
    const rooms = getTableRef('productionRooms');

    const data = await executeDbOperation(async (db) => {
      return db
        .select({
          roomId: rooms.id,
          roomCode: rooms.code,
          roomName: rooms.name,
          roomNameTh: rooms.nameTh,
          roomType: rooms.roomType,
          description: rooms.description,
        })
        .from(rooms)
        .where(eq(rooms.isActive, true))
        .orderBy(rooms.code);
    });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/iot/rooms:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';

/**
 * GET /api/iot/should-send?roomId=X
 *
 * Polling endpoint for IoT environmental sensors.
 * IoT devices call this every ~10 seconds to check whether they should
 * take and send a sensor reading. The ERP side decides what to do based on:
 *   - Is there an active work order using this room?
 *   - What BOM phase is this room configured for?
 *   - When was the last reading recorded?
 *   - Is the latest reading within BOM environmental limits?
 *
 * Response modes:
 *   idle    — No active WO for this room. Poll slowly, don't send.
 *   normal  — Active WO with recent normal readings. Poll steady, send periodically.
 *   urgent  — Active WO but waiting for environment to meet limits, or no recent reading.
 *             Poll fast, send immediately.
 *
 * Auth: X-API-Key header (same key as POST /api/environmental-logs)
 */

const EXTERNAL_API_KEY = process.env.EXTERNAL_ENV_API_KEY || 'env-monitor-2026-secret';
const ACTIVE_WO_STATUSES = ['released', 'in_progress'];

// Polling/sending intervals (seconds)
const IDLE_POLL_INTERVAL = 60;
const NORMAL_POLL_INTERVAL = 10;
const URGENT_POLL_INTERVAL = 10;
const NORMAL_SEND_INTERVAL = 300; // 5 minutes
const URGENT_SEND_INTERVAL = 10;  // 10 seconds (send on every poll)

// How stale a reading can be before we consider it "no recent data" (minutes)
const STALE_READING_MINUTES = 10;

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return !!apiKey && apiKey === EXTERNAL_API_KEY;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return jsonError('Unauthorized: invalid or missing X-API-Key', 401);
  }

  const { searchParams } = new URL(request.url);
  const roomIdStr = searchParams.get('roomId');

  if (!roomIdStr) {
    return jsonError('Missing required query parameter: roomId');
  }

  const roomId = Number(roomIdStr);
  if (!Number.isInteger(roomId) || roomId <= 0) {
    return jsonError('Invalid roomId — must be a positive integer');
  }

  try {
    const workOrders = getTableRef('workOrders');
    const bomRooms = getTableRef('bOMRooms');
    const envLogs = getTableRef('wOEnvironmentalLogs');
    const envConditions = getTableRef('environmentalConditions');
    const bomConditions = getTableRef('bOMEnvironmentalConditions');

    // 1. Find active WOs that use this room in BOM
    const activeRows = await executeDbOperation(async (db) => {
      return db
        .select({
          workOrderId: workOrders.id,
          woNumber: workOrders.woNumber,
          bomId: workOrders.bomId,
          status: workOrders.status,
          phase: bomRooms.phase,
        })
        .from(workOrders)
        .innerJoin(bomRooms, eq(bomRooms.bomId, workOrders.bomId))
        .where(
          and(
            inArray(workOrders.status, ACTIVE_WO_STATUSES),
            eq(bomRooms.roomId, roomId)
          )
        )
        .limit(1);
    });

    // No active WO → idle mode
    if (activeRows.length === 0) {
      return NextResponse.json({
        success: true,
        mode: 'idle',
        sendNow: false,
        pollInterval: IDLE_POLL_INTERVAL,
        sendInterval: null,
        reason: 'No active work order using this room',
        timestamp: new Date().toISOString(),
      });
    }

    const wo = activeRows[0] as {
      workOrderId: number;
      woNumber: string;
      bomId: number;
      status: string;
      phase: string;
    };

    // 2. Find the latest environmental log for this WO+phase
    const latestLogRows = await executeDbOperation(async (db) => {
      return db
        .select({
          id: envLogs.id,
          temperature: envLogs.temperature,
          humidity: envLogs.humidity,
          isNormal: envLogs.isNormal,
          createdAt: envLogs.createdAt,
        })
        .from(envLogs)
        .where(
          and(
            eq(envLogs.workOrderId, wo.workOrderId),
            eq(envLogs.phase, wo.phase)
          )
        )
        .orderBy(desc(envLogs.createdAt))
        .limit(1);
    });

    // 3. Get BOM environmental limits + monitoring interval for this phase
    const limitRows = await executeDbOperation(async (db) => {
      return db
        .select({
          temperatureMin: envConditions.temperatureMin,
          temperatureMax: envConditions.temperatureMax,
          humidityMax: envConditions.humidityMax,
          monitoringIntervalMinutes: envConditions.monitoringIntervalMinutes,
        })
        .from(bomConditions)
        .innerJoin(envConditions, eq(envConditions.id, bomConditions.conditionId))
        .where(and(eq(bomConditions.bomId, wo.bomId), eq(bomConditions.phase, wo.phase)))
        .limit(1);
    });

    const limits = limitRows[0]
      ? {
          temperatureMin: Number(limitRows[0].temperatureMin),
          temperatureMax: Number(limitRows[0].temperatureMax),
          humidityMax: Number(limitRows[0].humidityMax),
        }
      : null;

    const monitoringIntervalMinutes = limitRows[0]?.monitoringIntervalMinutes
      ? Number(limitRows[0].monitoringIntervalMinutes)
      : null;

    // 4. Decide mode — strict interval enforcement:
    //    - First reading (no log yet) → urgent, send now
    //    - Last reading older than interval → urgent, send now
    //    - Otherwise → normal, wait until next allowed time
    const latest = latestLogRows[0];
    let mode: 'urgent' | 'normal';
    let reason: string;
    let sendNow = false;
    let secondsUntilNextAllowed: number | null = null;

    if (!latest) {
      mode = 'urgent';
      sendNow = true;
      reason = `No reading recorded yet for ${wo.woNumber} phase ${wo.phase} — record #1`;
    } else {
      const createdAt = latest.createdAt ? new Date(latest.createdAt as string) : null;
      const ageMinutes = createdAt
        ? (Date.now() - createdAt.getTime()) / 60000
        : Number.POSITIVE_INFINITY;

      // Use BOM monitoring interval if configured, otherwise default to STALE_READING_MINUTES
      const intervalMinutes = monitoringIntervalMinutes ?? STALE_READING_MINUTES;

      if (ageMinutes >= intervalMinutes) {
        mode = 'urgent';
        sendNow = true;
        reason = `Last reading is ${Math.round(ageMinutes)} min old (>= ${intervalMinutes}-min interval) — time for next record`;
      } else {
        mode = 'normal';
        sendNow = false;
        secondsUntilNextAllowed = Math.max(0, Math.ceil((intervalMinutes - ageMinutes) * 60));
        reason = `Within ${intervalMinutes}-min interval — next reading allowed in ${secondsUntilNextAllowed}s`;
      }
    }

    const isUrgent = mode === 'urgent';
    // If we're in normal mode, IoT should wait out the remaining interval (but capped to avoid huge sleeps)
    const sendInterval = isUrgent
      ? URGENT_SEND_INTERVAL
      : secondsUntilNextAllowed !== null
        ? Math.min(secondsUntilNextAllowed, NORMAL_SEND_INTERVAL)
        : NORMAL_SEND_INTERVAL;

    return NextResponse.json({
      success: true,
      mode,
      sendNow,
      pollInterval: isUrgent ? URGENT_POLL_INTERVAL : NORMAL_POLL_INTERVAL,
      sendInterval,
      reason,
      workOrder: {
        id: wo.workOrderId,
        woNumber: wo.woNumber,
        phase: wo.phase,
      },
      limits,
      monitoringIntervalMinutes,
      latestReading: latest
        ? {
            temperature: Number(latest.temperature),
            humidity: Number(latest.humidity),
            isNormal: Boolean(latest.isNormal),
            recordedAt: latest.createdAt,
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/iot/should-send:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

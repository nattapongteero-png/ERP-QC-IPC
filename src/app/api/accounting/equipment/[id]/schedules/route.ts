/**
 * Equipment Maintenance Schedules API Route
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMaintenanceSchedule, getEquipmentSchedules, getEquipmentById } from '@/lib/services/accounting-equipment.service';
import { maintenanceScheduleCreateSchema } from '@/lib/validation/accounting';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const equipmentId = parseInt(id, 10);

    if (isNaN(equipmentId)) {
      return NextResponse.json({ error: 'Invalid equipment ID' }, { status: 400 });
    }

    // Check if equipment exists
    const equipment = await getEquipmentById(equipmentId);
    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    const schedules = await getEquipmentSchedules(equipmentId);
    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Error fetching maintenance schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance schedules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const equipmentId = parseInt(id, 10);

    if (isNaN(equipmentId)) {
      return NextResponse.json({ error: 'Invalid equipment ID' }, { status: 400 });
    }

    // Check if equipment exists
    const equipment = await getEquipmentById(equipmentId);
    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = maintenanceScheduleCreateSchema.safeParse({
      ...body,
      equipmentId,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const result = await createMaintenanceSchedule(validation.data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating maintenance schedule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create maintenance schedule' },
      { status: 500 }
    );
  }
}

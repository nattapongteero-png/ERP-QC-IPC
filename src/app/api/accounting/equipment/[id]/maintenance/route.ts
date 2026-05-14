/**
 * Equipment Maintenance Records API Route
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { recordMaintenanceEvent, getEquipmentMaintenanceHistory, getEquipmentById } from '@/lib/services/accounting-equipment.service';
import { maintenanceRecordCreateSchema, maintenanceRecordQuerySchema } from '@/lib/validation/accounting';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
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

      const { searchParams } = new URL(request.url);
      const filters: Record<string, unknown> = {};

      if (searchParams.has('maintenanceType')) {
        filters.maintenanceType = searchParams.get('maintenanceType');
      }
      if (searchParams.has('dateFrom')) {
        filters.dateFrom = searchParams.get('dateFrom');
      }
      if (searchParams.has('dateTo')) {
        filters.dateTo = searchParams.get('dateTo');
      }

      const validation = maintenanceRecordQuerySchema.safeParse(filters);
      const queryFilters = validation.success ? validation.data : undefined;

      const history = await getEquipmentMaintenanceHistory(equipmentId, queryFilters);
      return NextResponse.json({ success: true, data: history });
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch maintenance history' },
        { status: 500 }
      );
    }

  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
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
      const validation = maintenanceRecordCreateSchema.safeParse({
        ...body,
        equipmentId,
      });

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      const result = await recordMaintenanceEvent(validation.data);
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (error) {
      console.error('Error recording maintenance:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to record maintenance' },
        { status: 500 }
      );
    }

  });
}

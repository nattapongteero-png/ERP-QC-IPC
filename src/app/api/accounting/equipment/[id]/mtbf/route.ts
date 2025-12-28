/**
 * Equipment MTBF Analysis API Route
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateMTBF, getEquipmentById } from '@/lib/services/accounting-equipment.service';

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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const analysis = await calculateMTBF(equipmentId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Error calculating MTBF:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate MTBF' },
      { status: 500 }
    );
  }
}

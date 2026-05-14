/**
 * Equipment Meter Reading API Route
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { updateMeterReading, getEquipmentById } from '@/lib/services/accounting-equipment.service';
import { z } from 'zod';

const meterReadingSchema = z.object({
  reading: z.number().min(0).describe('Meter reading value'),
  readingDate: z.string().optional().describe('Reading date (YYYY-MM-DD)'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
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
      const validation = meterReadingSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      const result = await updateMeterReading(
        equipmentId,
        validation.data.reading,
        validation.data.readingDate
      );

      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      console.error('Error updating meter reading:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to update meter reading' },
        { status: 500 }
      );
    }

  });
}

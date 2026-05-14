/**
 * Equipment API Route
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { listEquipment, createEquipment, getEquipmentSummary } from '@/lib/services/accounting-equipment.service';
import { equipmentCreateSchema, equipmentQuerySchema } from '@/lib/validation/accounting';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);

      // Check if requesting summary
      if (searchParams.get('summary') === 'true') {
        const summary = await getEquipmentSummary();
        return NextResponse.json({ success: true, data: summary });
      }

      // Parse query filters
      const filters: Record<string, unknown> = {};
      if (searchParams.has('isAvailable')) {
        filters.isAvailable = searchParams.get('isAvailable') === 'true';
      }
      if (searchParams.has('manufacturer')) {
        filters.manufacturer = searchParams.get('manufacturer');
      }

      const validation = equipmentQuerySchema.safeParse(filters);
      const queryFilters = validation.success ? validation.data : undefined;

      const equipment = await listEquipment(queryFilters);
      return NextResponse.json({ success: true, data: equipment });
    } catch (error) {
      console.error('Error fetching equipment:', error);
      return NextResponse.json(
        { error: 'Failed to fetch equipment' },
        { status: 500 }
      );
    }

  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();

      const validation = equipmentCreateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      const result = await createEquipment(validation.data);
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (error) {
      console.error('Error creating equipment:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to create equipment' },
        { status: 500 }
      );
    }

  });
}

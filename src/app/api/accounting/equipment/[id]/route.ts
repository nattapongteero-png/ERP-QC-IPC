/**
 * Single Equipment API Route
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getEquipmentById, updateEquipment, deleteEquipment, getEquipmentCostSummary } from '@/lib/services/accounting-equipment.service';
import { equipmentUpdateSchema } from '@/lib/validation/accounting';

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

      const { searchParams } = new URL(request.url);

      // If requesting cost summary
      if (searchParams.get('costs') === 'true') {
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;
        const costSummary = await getEquipmentCostSummary(equipmentId, startDate, endDate);
        return NextResponse.json({ success: true, data: costSummary });
      }

      const equipment = await getEquipmentById(equipmentId);
      if (!equipment) {
        return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
      }

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

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const equipmentId = parseInt(id, 10);

      if (isNaN(equipmentId)) {
        return NextResponse.json({ error: 'Invalid equipment ID' }, { status: 400 });
      }

      const body = await request.json();
      const validation = equipmentUpdateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      // Check if equipment exists
      const existing = await getEquipmentById(equipmentId);
      if (!existing) {
        return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
      }

      await updateEquipment(equipmentId, validation.data);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating equipment:', error);
      return NextResponse.json(
        { error: 'Failed to update equipment' },
        { status: 500 }
      );
    }

  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const equipmentId = parseInt(id, 10);

      if (isNaN(equipmentId)) {
        return NextResponse.json({ error: 'Invalid equipment ID' }, { status: 400 });
      }

      // Check if equipment exists
      const existing = await getEquipmentById(equipmentId);
      if (!existing) {
        return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
      }

      await deleteEquipment(equipmentId);
      return NextResponse.json({ success: true, message: 'Equipment deleted successfully' });
    } catch (error) {
      console.error('Error deleting equipment:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to delete equipment' },
        { status: 500 }
      );
    }

  });
}

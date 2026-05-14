/**
 * Overdue Maintenance API Route
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getOverdueMaintenance } from '@/lib/services/accounting-equipment.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);

      const filters: { equipmentId?: number } = {};
      if (searchParams.has('equipmentId')) {
        filters.equipmentId = parseInt(searchParams.get('equipmentId')!, 10);
      }

      const overdueMaintenance = await getOverdueMaintenance(filters);

      return NextResponse.json({
        success: true,
        data: overdueMaintenance,
        count: overdueMaintenance.length,
      });
    } catch (error) {
      console.error('Error fetching overdue maintenance:', error);
      return NextResponse.json(
        { error: 'Failed to fetch overdue maintenance' },
        { status: 500 }
      );
    }

  });
}

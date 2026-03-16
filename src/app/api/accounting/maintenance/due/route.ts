/**
 * Upcoming Maintenance API Route
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getUpcomingMaintenance } from '@/lib/services/accounting-equipment.service';
import { maintenanceDueQuerySchema } from '@/lib/validation/accounting';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);

      const filters: Record<string, unknown> = {};
      if (searchParams.has('daysAhead')) {
        filters.daysAhead = parseInt(searchParams.get('daysAhead')!, 10);
      }
      if (searchParams.has('equipmentId')) {
        filters.equipmentId = parseInt(searchParams.get('equipmentId')!, 10);
      }

      const validation = maintenanceDueQuerySchema.safeParse(filters);
      const queryFilters = validation.success ? validation.data : undefined;

      const upcomingMaintenance = await getUpcomingMaintenance(queryFilters);

      return NextResponse.json({
        success: true,
        data: upcomingMaintenance,
        count: upcomingMaintenance.length,
      });
    } catch (error) {
      console.error('Error fetching upcoming maintenance:', error);
      return NextResponse.json(
        { error: 'Failed to fetch upcoming maintenance' },
        { status: 500 }
      );
    }

  });
}

/**
 * Audit KPIs API Endpoint
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T039)
 *
 * GET /api/dashboard/audit-kpis - Returns all 8 KPI metrics for audit dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuditKpis } from '@/lib/services/audit-dashboard-service';
import { withAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  // This endpoint exposes raw-material stock, lot numbers, QC pass/fail rates
  // and production status. It previously had no auth of any kind and was
  // readable by any anonymous caller.
  //
  // The body stays an unwrapped KPI object (not successResponse) because
  // /dashboard/audit consumes response.json() directly.
  return withAuth(
    request,
    async () => {
      try {
        return NextResponse.json(await getAuditKpis());
      } catch (error) {
        console.error('Error fetching audit KPIs:', error);
        return NextResponse.json(
          { error: 'Failed to fetch audit KPIs' },
          { status: 500 }
        );
      }
    },
    ['reports:read']
  );
}

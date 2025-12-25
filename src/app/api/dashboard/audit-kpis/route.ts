/**
 * Audit KPIs API Endpoint
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T039)
 *
 * GET /api/dashboard/audit-kpis - Returns all 8 KPI metrics for audit dashboard
 */

import { NextResponse } from 'next/server';
import { getAuditKpis } from '@/lib/services/audit-dashboard-service';

export async function GET() {
  try {
    const kpis = await getAuditKpis();
    return NextResponse.json(kpis);
  } catch (error) {
    console.error('Error fetching audit KPIs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit KPIs' },
      { status: 500 }
    );
  }
}

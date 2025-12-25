/**
 * Min Stock Alerts API Endpoint
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T041)
 *
 * GET /api/inventory/min-stock-alerts - Returns items below min stock or reorder point (FR-050)
 */

import { NextResponse } from 'next/server';
import { getMinStockAlerts } from '@/lib/services/audit-dashboard-service';

export async function GET() {
  try {
    const alerts = await getMinStockAlerts();
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching min stock alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch min stock alerts' },
      { status: 500 }
    );
  }
}

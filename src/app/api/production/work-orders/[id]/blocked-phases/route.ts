/**
 * GET /api/production/work-orders/[id]/blocked-phases
 *
 * Returns the list of materials that have a pending withdrawal request for
 * this Work Order. Callers (the WO detail page, the production-gate) use this
 * to render the FR-035..040 selective phase block UI.
 *
 * Phase-level grouping is delegated to the caller for now since BOM phase
 * mapping is project-specific. The response carries enough info to render.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPendingMaterialIdsForWorkOrder } from '@/lib/services/material-withdrawal.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const workOrderId = Number.parseInt(id, 10);
  if (Number.isNaN(workOrderId) || workOrderId <= 0) {
    return NextResponse.json({ error: 'Invalid work order id' }, { status: 400 });
  }

  const result = await getPendingMaterialIdsForWorkOrder(workOrderId);
  return NextResponse.json(result);
}

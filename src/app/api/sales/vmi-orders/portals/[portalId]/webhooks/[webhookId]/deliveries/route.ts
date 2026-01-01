/**
 * VMI Webhook Delivery History API
 *
 * GET /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]/deliveries
 * - Returns paginated delivery history
 * - Supports filtering by status, eventType, date range
 */

import { NextRequest, NextResponse } from 'next/server';
import { VmiWebhookService, VmiWebhookError } from '@/lib/services/vmi-webhook.service';
import { vmiWebhookDeliveryQuerySchema } from '@/lib/validation/vmi-webhook';

interface RouteParams {
  params: Promise<{ portalId: string; webhookId: string }>;
}

/**
 * GET - Get webhook delivery history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { portalId: portalIdStr, webhookId: webhookIdStr } = await params;
    const portalId = parseInt(portalIdStr, 10);
    const webhookId = parseInt(webhookIdStr, 10);

    if (isNaN(portalId) || portalId <= 0) {
      return NextResponse.json(
        { success: false, code: 'INVALID_PORTAL_ID', message: 'Invalid portal ID' },
        { status: 400 }
      );
    }

    if (isNaN(webhookId) || webhookId <= 0) {
      return NextResponse.json(
        { success: false, code: 'INVALID_WEBHOOK_ID', message: 'Invalid webhook ID' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryInput = {
      status: searchParams.get('status') || undefined,
      eventType: searchParams.get('eventType') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '50',
    };

    // Validate query parameters
    const validation = vmiWebhookDeliveryQuerySchema.safeParse(queryInput);
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => e.message).join(', ');
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: errors },
        { status: 400 }
      );
    }

    const query = validation.data;

    // First verify webhook belongs to the specified portal
    const webhookService = new VmiWebhookService();
    const webhook = await webhookService.getById(webhookId);

    if (!webhook || webhook.portalId !== portalId) {
      return NextResponse.json(
        { success: false, code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    const result = await webhookService.getDeliveryHistory(webhookId, {
      status: query.status,
      eventType: query.eventType,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
      pageSize: query.pageSize,
    });

    return NextResponse.json({
      success: true,
      deliveries: result.deliveries,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    });
  } catch (error) {
    console.error('[Webhook API] Deliveries error:', error);

    if (error instanceof VmiWebhookError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.httpStatus }
      );
    }

    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

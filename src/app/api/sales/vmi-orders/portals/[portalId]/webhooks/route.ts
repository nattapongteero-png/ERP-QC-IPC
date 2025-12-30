/**
 * VMI Webhook Management API
 *
 * GET /api/sales/vmi-orders/portals/[portalId]/webhooks - List webhooks for portal
 * POST /api/sales/vmi-orders/portals/[portalId]/webhooks - Create new webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { VmiWebhookService, VmiWebhookError } from '@/lib/services/vmi-webhook.service';
import { vmiWebhookCreateSchema } from '@/lib/validation/vmi-webhook';

interface RouteParams {
  params: Promise<{ portalId: string }>;
}

/**
 * GET - List all webhooks for a portal
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { portalId: portalIdStr } = await params;
    const portalId = parseInt(portalIdStr, 10);

    if (isNaN(portalId) || portalId <= 0) {
      return NextResponse.json(
        { success: false, code: 'INVALID_PORTAL_ID', message: 'Invalid portal ID' },
        { status: 400 }
      );
    }

    const webhookService = new VmiWebhookService();
    const webhooks = await webhookService.listByPortal(portalId);

    return NextResponse.json({
      success: true,
      webhooks,
    });
  } catch (error) {
    console.error('[Webhook API] List error:', error);

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

/**
 * POST - Create a new webhook
 *
 * IMPORTANT: The secret is returned only once in the response.
 * It must be saved immediately as it cannot be retrieved later.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { portalId: portalIdStr } = await params;
    const portalId = parseInt(portalIdStr, 10);

    if (isNaN(portalId) || portalId <= 0) {
      return NextResponse.json(
        { success: false, code: 'INVALID_PORTAL_ID', message: 'Invalid portal ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = vmiWebhookCreateSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => e.message).join(', ');
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: errors },
        { status: 400 }
      );
    }

    const webhookService = new VmiWebhookService();
    const { webhook, secret } = await webhookService.create(portalId, validation.data);

    return NextResponse.json(
      {
        success: true,
        webhook,
        secret,
        message: 'Webhook created successfully. Save the secret - it will not be shown again.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Webhook API] Create error:', error);

    if (error instanceof VmiWebhookError) {
      const status = error.code === 'WEBHOOK_LIMIT_EXCEEDED' ? 409 : error.httpStatus;
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status }
      );
    }

    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

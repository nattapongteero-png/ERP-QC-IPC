/**
 * VMI Webhook Management API - Single Webhook
 *
 * GET /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId] - Get webhook details
 * PATCH /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId] - Update webhook
 * DELETE /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId] - Delete webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { VmiWebhookService, VmiWebhookError } from '@/lib/services/vmi-webhook.service';
import { vmiWebhookUpdateSchema } from '@/lib/validation/vmi-webhook';

interface RouteParams {
  params: Promise<{ portalId: string; webhookId: string }>;
}

/**
 * GET - Get webhook details
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

    const webhookService = new VmiWebhookService();
    const webhook = await webhookService.getById(webhookId);

    if (!webhook) {
      return NextResponse.json(
        { success: false, code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Verify webhook belongs to the specified portal
    if (webhook.portalId !== portalId) {
      return NextResponse.json(
        { success: false, code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      webhook,
    });
  } catch (error) {
    console.error('[Webhook API] Get error:', error);

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
 * PATCH - Update webhook configuration
 *
 * Special flags:
 * - regenerateSecret: true - Generate new secret (invalidates old one)
 * - reenableWebhook: true - Re-enable webhook disabled due to failures
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();

    // Validate input
    const validation = vmiWebhookUpdateSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => e.message).join(', ');
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: errors },
        { status: 400 }
      );
    }

    // First verify webhook belongs to the specified portal
    const webhookService = new VmiWebhookService();
    const existing = await webhookService.getById(webhookId);

    if (!existing || existing.portalId !== portalId) {
      return NextResponse.json(
        { success: false, code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Convert null to undefined for compatibility with service types
    const updateData = {
      ...validation.data,
      description: validation.data.description === null ? undefined : validation.data.description,
    };

    const { webhook, newSecret } = await webhookService.update(webhookId, updateData);

    const response: {
      success: boolean;
      webhook: typeof webhook;
      secret?: string;
      message?: string;
    } = {
      success: true,
      webhook,
    };

    if (newSecret) {
      response.secret = newSecret;
      response.message = 'Secret regenerated. Save the new secret - it will not be shown again.';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Webhook API] Update error:', error);

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
 * DELETE - Delete webhook
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // First verify webhook belongs to the specified portal
    const webhookService = new VmiWebhookService();
    const existing = await webhookService.getById(webhookId);

    if (!existing || existing.portalId !== portalId) {
      return NextResponse.json(
        { success: false, code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    await webhookService.delete(webhookId);

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    console.error('[Webhook API] Delete error:', error);

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

/**
 * VMI Webhook Receiver Endpoint
 *
 * POST /api/sales/vmi-orders/webhooks/[portalId]
 *
 * Receives webhook notifications from VMI Portal for order events.
 * This is the vendor-side endpoint that receives push notifications.
 *
 * Security:
 * - Validates HMAC-SHA256 signature
 * - Validates timestamp (within 5 minutes)
 * - Returns 401 for invalid signatures
 *
 * Processing:
 * - Returns 200 immediately after signature validation
 * - Processes payload asynchronously using Next.js after()
 * - Idempotent (duplicate delivery IDs are ignored)
 */

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { VmiWebhookService } from '@/lib/services/vmi-webhook.service';
import { validateWebhookRequest } from '@/lib/services/vmi-webhook-crypto';
import { processWebhookEvent } from '@/lib/services/vmi-webhook-events';
import {
  vmiWebhookHeadersSchema,
  parseWebhookPayload,
  VmiWebhookEventType,
} from '@/lib/validation/vmi-webhook';

interface RouteParams {
  params: Promise<{ portalId: string }>;
}

/**
 * Receive webhook notification from VMI Portal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  const { portalId: portalIdStr } = await params;
  const portalId = parseInt(portalIdStr, 10);

  if (isNaN(portalId) || portalId <= 0) {
    return NextResponse.json(
      { success: false, code: 'INVALID_PORTAL_ID', message: 'Invalid portal ID' },
      { status: 400 }
    );
  }

  // Extract headers
  const headers = {
    'x-webhook-event': request.headers.get('x-webhook-event') || '',
    'x-webhook-timestamp': request.headers.get('x-webhook-timestamp') || '',
    'x-webhook-delivery-id': request.headers.get('x-webhook-delivery-id') || '',
    'x-webhook-signature': request.headers.get('x-webhook-signature') || '',
  };

  // Validate required headers
  const headerValidation = vmiWebhookHeadersSchema.safeParse(headers);
  if (!headerValidation.success) {
    const errors = headerValidation.error.issues.map((e) => e.message).join(', ');
    return NextResponse.json(
      { success: false, code: 'INVALID_HEADERS', message: `Invalid headers: ${errors}` },
      { status: 400 }
    );
  }

  const { 'x-webhook-event': eventType, 'x-webhook-timestamp': timestamp, 'x-webhook-delivery-id': deliveryId, 'x-webhook-signature': signature } = headerValidation.data;

  // Get raw body for signature validation
  const rawBody = await request.text();

  // Find active webhooks for this portal and event
  const webhookService = new VmiWebhookService();

  try {
    const activeWebhooks = await webhookService.findActiveWebhooksForEvent(
      portalId,
      eventType as VmiWebhookEventType
    );

    if (activeWebhooks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'NO_ACTIVE_WEBHOOK',
          message: `No active webhook found for portal ${portalId} and event ${eventType}`,
        },
        { status: 404 }
      );
    }

    // Find the webhook that can validate this signature
    let validatedWebhook: (typeof activeWebhooks)[0] | null = null;

    for (const webhook of activeWebhooks) {
      const validationResult = validateWebhookRequest(
        {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
        },
        rawBody,
        webhook.decryptedSecret
      );

      if (validationResult.valid) {
        validatedWebhook = webhook;
        break;
      }
    }

    if (!validatedWebhook) {
      return NextResponse.json(
        { success: false, code: 'INVALID_SIGNATURE', message: 'Signature validation failed' },
        { status: 401 }
      );
    }

    // Check for duplicate delivery (idempotency)
    const isDuplicate = await webhookService.deliveryExists(deliveryId);
    if (isDuplicate) {
      // Return 200 for duplicates (already processed)
      return NextResponse.json({
        received: true,
        duplicate: true,
        message: 'Delivery already processed',
      });
    }

    // Parse and validate payload based on event type
    let parsedPayload;
    try {
      parsedPayload = parseWebhookPayload(eventType as VmiWebhookEventType, rawBody);
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_PAYLOAD',
          message: `Invalid payload for event ${eventType}: ${parseError instanceof Error ? parseError.message : 'Parse error'}`,
        },
        { status: 400 }
      );
    }

    // Create delivery record
    await webhookService.createDelivery({
      webhookId: validatedWebhook.id,
      deliveryId,
      eventType: eventType as VmiWebhookEventType,
      eventId: getEventId(parsedPayload),
      payload: rawBody,
      signature,
      signatureValid: true,
    });

    // Process event asynchronously using Next.js after()
    after(async () => {
      try {
        await processWebhookEvent(
          eventType as VmiWebhookEventType,
          parsedPayload,
          {
            webhookId: validatedWebhook!.id,
            deliveryId,
            portalId,
            eventType: eventType as VmiWebhookEventType,
          }
        );
      } catch (error) {
        console.error(`[VMI Webhook] Error processing event ${eventType}:`, error);
      }
    });

    // Return 200 immediately (within 200ms target)
    const responseTime = Date.now() - startTime;
    return NextResponse.json({
      received: true,
      deliveryId,
      responseTimeMs: responseTime,
    });
  } catch (error) {
    console.error('[VMI Webhook] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract event-specific ID for logging purposes
 */
function getEventId(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const p = payload as Record<string, unknown>;

  // order.created, order.cancelled
  if (typeof p.orderId === 'number') {
    return `order:${p.orderId}`;
  }

  // receipt.created
  if (typeof p.receiptId === 'number') {
    return `receipt:${p.receiptId}`;
  }

  return undefined;
}

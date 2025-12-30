# Quickstart: VMI Webhook Integration

**Feature**: 012-vmi-webhook
**Date**: 2025-12-30

## Prerequisites

- Node.js 20+
- pnpm 9+
- MySQL 8.0+ (production) or SQLite (testing)
- Existing VMI Portal connection configured

## Development Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Database Migration

After adding the new schema tables, sync the database:

```bash
pnpm db:push
```

### 3. Start Development Server

```bash
pnpm dev
# Server runs on http://localhost:33021
```

## Key Files to Implement

### Database Schema (src/lib/db/schema.ts)

Add new tables for webhooks:

```typescript
// MySQL tables
export const mysqlVmiWebhooks = mysqlTable('vmi_webhooks', {
  id: int('id').primaryKey().autoincrement(),
  portalId: int('portal_id').notNull().references(() => mysqlVmiPortalConfig.id),
  vmiWebhookId: int('vmi_webhook_id'),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  url: varchar('url', { length: 500 }).notNull(),
  secretEncrypted: text('secret_encrypted').notNull(),
  events: text('events').notNull(), // JSON array
  isActive: boolean('is_active').notNull().default(true),
  isDisabledByFailures: boolean('is_disabled_by_failures').notNull().default(false),
  consecutiveFailures: int('consecutive_failures').notNull().default(0),
  lastSuccessAt: datetime('last_success_at'),
  lastFailureAt: datetime('last_failure_at'),
  lastErrorMessage: text('last_error_message'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
  createdBy: int('created_by').references(() => mysqlUsers.id),
});

export const mysqlVmiWebhookDeliveries = mysqlTable('vmi_webhook_deliveries', {
  id: int('id').primaryKey().autoincrement(),
  webhookId: int('webhook_id').notNull().references(() => mysqlVmiWebhooks.id),
  deliveryId: varchar('delivery_id', { length: 100 }).notNull().unique(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  eventId: varchar('event_id', { length: 100 }),
  payload: text('payload').notNull(),
  signature: varchar('signature', { length: 128 }).notNull(),
  signatureValid: boolean('signature_valid').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  responseCode: int('response_code'),
  errorMessage: text('error_message'),
  processingDurationMs: int('processing_duration_ms'),
  receivedAt: datetime('received_at').notNull(),
  processedAt: datetime('processed_at'),
});
```

### Signature Validation (src/lib/services/vmi-webhook-crypto.ts)

```typescript
import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string
): boolean {
  const signaturePayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export function isTimestampValid(timestamp: string, toleranceSeconds = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  return Math.abs(now - ts) <= toleranceSeconds;
}
```

### Webhook Receiver Endpoint (src/app/api/sales/vmi-orders/webhooks/[portalId]/route.ts)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { verifyWebhookSignature, isTimestampValid } from '@/lib/services/vmi-webhook-crypto';
import { processWebhookEvent } from '@/lib/services/vmi-webhook.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ portalId: string }> }
) {
  const { portalId } = await params;

  // Get headers
  const eventType = request.headers.get('X-Webhook-Event');
  const timestamp = request.headers.get('X-Webhook-Timestamp');
  const deliveryId = request.headers.get('X-Webhook-Delivery-Id');
  const signature = request.headers.get('X-Webhook-Signature');

  if (!eventType || !timestamp || !deliveryId || !signature) {
    return NextResponse.json(
      { success: false, code: 'MISSING_HEADERS', message: 'Missing required headers' },
      { status: 400 }
    );
  }

  // Get raw body for signature validation
  const body = await request.text();

  // Get webhook secret (decrypted from database)
  const webhook = await getWebhookByPortalId(parseInt(portalId, 10));
  if (!webhook) {
    return NextResponse.json(
      { success: false, code: 'PORTAL_NOT_FOUND', message: 'Portal not found' },
      { status: 404 }
    );
  }

  // Validate timestamp
  if (!isTimestampValid(timestamp)) {
    return NextResponse.json(
      { success: false, code: 'TIMESTAMP_EXPIRED', message: 'Timestamp too old' },
      { status: 401 }
    );
  }

  // Validate signature
  const secret = decryptSecret(webhook.secretEncrypted);
  const signatureValid = verifyWebhookSignature(body, signature, secret, timestamp);

  if (!signatureValid) {
    // Log failed attempt
    await logDelivery({
      webhookId: webhook.id,
      deliveryId,
      eventType,
      payload: body,
      signature,
      signatureValid: false,
      status: 'failed',
      responseCode: 401,
      errorMessage: 'Invalid signature',
    });

    return NextResponse.json(
      { success: false, code: 'INVALID_SIGNATURE', message: 'Invalid signature' },
      { status: 401 }
    );
  }

  // Return 200 immediately, process async
  after(async () => {
    await processWebhookEvent({
      webhookId: webhook.id,
      deliveryId,
      eventType,
      payload: body,
      signature,
    });
  });

  return NextResponse.json({ received: true });
}
```

## Testing

### Unit Tests

```bash
# Run signature validation tests
pnpm test src/lib/services/vmi-webhook-crypto.test.ts

# Run all tests
pnpm test
```

### Manual Testing with curl

```bash
# Simulate webhook delivery (for development)
TIMESTAMP=$(date +%s)
PAYLOAD='{"orderId":123,"poNumber":"PO-2024-001","hospitalCode":"12345","hospitalName":"Test Hospital","orderDate":"2024-12-30","totalValue":"15000.00","itemCount":1,"items":[{"localCode":"MED-001","name":"Test Item","quantity":100,"unitPrice":"150.00"}]}'
SECRET="your-webhook-secret"
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

curl -X POST http://localhost:33021/api/sales/vmi-orders/webhooks/1 \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Event: order.created" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -H "X-Webhook-Delivery-Id: test-$(uuidgen)" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## UI Pages

### Webhook Management (/sales/vmi-orders/portals/[id]/webhooks)

Features:
- List registered webhooks with health status badges
- Add/Edit/Delete webhook configurations
- Select events to subscribe (order.created, order.cancelled, receipt.created, receipt.completed)
- Re-enable webhooks disabled by failures

### Delivery History (/sales/vmi-orders/portals/[id]/webhooks/[webhookId]/deliveries)

Features:
- DataGrid showing all received deliveries
- Filter by status (pending, processed, failed)
- Filter by event type
- Filter by date range
- View payload details
- See processing duration and error messages

## Environment Variables

```bash
# Add to .env.local
PUBLIC_URL=https://your-erp-domain.com  # For webhook URL registration
ENCRYPTION_KEY=your-32-byte-encryption-key  # For secret encryption
```

## Deployment Notes

1. **HTTPS Required**: VMI portals require HTTPS for webhook endpoints
2. **Firewall Rules**: Allow incoming POST requests from VMI portal IPs
3. **Response Time**: Webhook endpoint must respond within 30 seconds
4. **Retry Handling**: VMI portal will retry failed deliveries (up to 5 times)

## Troubleshooting

### Signature Validation Fails

1. Check timestamp is within 5 minutes
2. Verify secret matches (regenerate if needed)
3. Ensure raw body is used for signature calculation

### Webhooks Being Auto-Disabled

1. Check network connectivity to webhook endpoint
2. Review error messages in delivery history
3. Re-enable via webhook management UI after fixing issues

### Duplicate Orders

1. System uses delivery ID for idempotency
2. Check `vmi_webhook_deliveries` table for duplicate delivery IDs
3. Verify polling deduplication is working (checks `vmi_order_id`)

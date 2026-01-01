# Data Model: VMI Webhook Integration

**Feature**: 012-vmi-webhook
**Date**: 2025-12-30

## Entity Relationship Diagram

```
┌──────────────────────┐     1     ┌──────────────────────┐
│   vmi_portal_config  │◄──────────│     vmi_webhooks     │
│ (existing table)     │     N     │ (new table)          │
└──────────────────────┘           └──────────────────────┘
                                            │ 1
                                            │
                                            ▼ N
                                   ┌──────────────────────┐
                                   │ vmi_webhook_deliveries│
                                   │ (new table)          │
                                   └──────────────────────┘
```

## New Tables

### vmi_webhooks

Stores webhook configurations registered with VMI portals.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | NO | AUTO | Primary key |
| portal_id | INT | NO | - | FK to vmi_portal_config.id |
| vmi_webhook_id | INT | YES | - | ID assigned by VMI Portal |
| name | VARCHAR(100) | NO | - | Display name for webhook |
| description | VARCHAR(500) | YES | - | Optional description |
| url | VARCHAR(500) | NO | - | Our webhook endpoint URL |
| secret_encrypted | TEXT | NO | - | Encrypted webhook secret |
| events | TEXT | NO | - | JSON array of subscribed events |
| is_active | BOOLEAN | NO | true | Manually enabled/disabled |
| is_disabled_by_failures | BOOLEAN | NO | false | Auto-disabled due to failures |
| consecutive_failures | INT | NO | 0 | Count of consecutive failed deliveries |
| last_success_at | DATETIME | YES | - | Timestamp of last successful delivery |
| last_failure_at | DATETIME | YES | - | Timestamp of last failed delivery |
| last_error_message | TEXT | YES | - | Last error message from failed delivery |
| created_at | DATETIME | NO | NOW() | Record creation timestamp |
| updated_at | DATETIME | NO | NOW() | Record update timestamp |
| created_by | INT | YES | - | FK to users.id |

**Indexes**:
- `idx_vmi_webhooks_portal_id` on `portal_id`
- `UNIQUE idx_vmi_webhooks_portal_url` on `(portal_id, url)`

**Events JSON Example**:
```json
["order.created", "order.cancelled", "receipt.created", "receipt.completed"]
```

### vmi_webhook_deliveries

Stores history of received webhook notifications.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | NO | AUTO | Primary key |
| webhook_id | INT | NO | - | FK to vmi_webhooks.id |
| delivery_id | VARCHAR(100) | NO | - | Unique ID from VMI Portal (X-Webhook-Delivery-Id) |
| event_type | VARCHAR(50) | NO | - | Event type (order.created, etc.) |
| event_id | VARCHAR(100) | YES | - | Event ID from payload |
| payload | TEXT | NO | - | Full JSON payload |
| signature | VARCHAR(128) | NO | - | Received signature |
| signature_valid | BOOLEAN | NO | - | Whether signature was valid |
| status | VARCHAR(20) | NO | pending | pending, processed, failed |
| response_code | INT | YES | - | HTTP response code returned |
| error_message | TEXT | YES | - | Error message if processing failed |
| processing_duration_ms | INT | YES | - | Time taken to process (ms) |
| received_at | DATETIME | NO | NOW() | When notification was received |
| processed_at | DATETIME | YES | - | When processing completed |

**Indexes**:
- `idx_vmi_webhook_deliveries_webhook_id` on `webhook_id`
- `UNIQUE idx_vmi_webhook_deliveries_delivery_id` on `delivery_id`
- `idx_vmi_webhook_deliveries_status` on `status`
- `idx_vmi_webhook_deliveries_received_at` on `received_at`
- `idx_vmi_webhook_deliveries_event_type` on `event_type`

**Status Values**:
- `pending`: Received, not yet processed
- `processed`: Successfully processed
- `failed`: Processing failed

## Modified Tables

### vmi_portal_config

Add webhook-related columns to existing table.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| webhook_enabled | BOOLEAN | NO | false | Enable webhook notifications |
| webhook_endpoint_url | VARCHAR(500) | YES | - | Our webhook endpoint for this portal |

## Event Payload Structures

Based on VMI-VENDOR-API.md section 10.

### order.created

```json
{
  "orderId": 123,
  "poNumber": "PO-2024-001234",
  "hospitalCode": "12345",
  "hospitalName": "โรงพยาบาลตัวอย่าง",
  "orderDate": "2024-12-25",
  "totalValue": "15000.00",
  "itemCount": 3,
  "items": [
    {
      "localCode": "MED-001",
      "name": "พาราเซตามอล 500 มก.",
      "quantity": 1000,
      "unitPrice": "2.50"
    }
  ]
}
```

### order.cancelled

```json
{
  "orderId": 123,
  "poNumber": "PO-2024-001234",
  "hospitalCode": "12345",
  "reason": "เปลี่ยนแปลงแผนการจัดซื้อ",
  "cancelledAt": "2024-12-25T14:30:00.000Z"
}
```

### receipt.created

```json
{
  "orderId": 123,
  "poNumber": "PO-2024-001234",
  "receiptId": 456,
  "receiptNumber": "GR-2024-001234",
  "receiptDate": "2024-12-25",
  "hospitalCode": "12345",
  "items": [
    {
      "localCode": "MED-001",
      "name": "พาราเซตามอล 500 มก.",
      "quantityReceived": 500,
      "quantityOrdered": 1000
    }
  ]
}
```

### receipt.completed

```json
{
  "orderId": 123,
  "poNumber": "PO-2024-001234",
  "hospitalCode": "12345",
  "completedAt": "2024-12-26T09:00:00.000Z",
  "totalReceipts": 2
}
```

## TypeScript Types

```typescript
// Webhook event types
export type VmiWebhookEventType =
  | 'order.created'
  | 'order.cancelled'
  | 'receipt.created'
  | 'receipt.completed';

// Webhook configuration
export interface VmiWebhook {
  id: number;
  portalId: number;
  vmiWebhookId: number | null;
  name: string;
  description: string | null;
  url: string;
  events: VmiWebhookEventType[];
  isActive: boolean;
  isDisabledByFailures: boolean;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook delivery record
export interface VmiWebhookDelivery {
  id: number;
  webhookId: number;
  deliveryId: string;
  eventType: VmiWebhookEventType;
  eventId: string | null;
  payload: string; // JSON string
  signature: string;
  signatureValid: boolean;
  status: 'pending' | 'processed' | 'failed';
  responseCode: number | null;
  errorMessage: string | null;
  processingDurationMs: number | null;
  receivedAt: Date;
  processedAt: Date | null;
}

// Webhook health status (computed)
export type VmiWebhookHealthStatus =
  | 'active'
  | 'warning'
  | 'disabled_by_failures'
  | 'disabled_manual';
```

## Validation Rules

### vmi_webhooks
- `name`: 1-100 characters, required
- `url`: Valid HTTPS URL (production), HTTP allowed in development
- `events`: At least one event type required
- `portal_id`: Must reference existing vmi_portal_config

### vmi_webhook_deliveries
- `delivery_id`: Must be unique (idempotency key)
- `event_type`: Must be valid VmiWebhookEventType
- `payload`: Valid JSON string

## State Transitions

### Webhook Status

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│    ┌──────────┐    user creates    ┌──────────┐        │
│    │  (none)  │ ─────────────────► │  active  │        │
│    └──────────┘                    └──────────┘        │
│                                         │               │
│                     failure count >= 3  │               │
│                                         ▼               │
│                                    ┌──────────┐        │
│                                    │ warning  │        │
│                                    └──────────┘        │
│                                         │               │
│                    failure count >= 10  │               │
│                                         ▼               │
│    ┌──────────────────┐      ┌───────────────────────┐ │
│    │ disabled_manual  │      │ disabled_by_failures  │ │
│    └──────────────────┘      └───────────────────────┘ │
│           ▲                          │                 │
│           │ user disables            │ user re-enables │
│           │                          ▼                 │
│           │                    ┌──────────┐            │
│           └────────────────────│  active  │            │
│                                └──────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Delivery Processing

```
┌─────────────┐    signature valid    ┌─────────────┐    processing    ┌─────────────┐
│   pending   │ ────────────────────► │   pending   │ ───────────────► │  processed  │
└─────────────┘                       └─────────────┘                  └─────────────┘
      │                                     │
      │ signature invalid                   │ processing error
      │                                     │
      ▼                                     ▼
┌─────────────┐                       ┌─────────────┐
│   (reject)  │                       │   failed    │
└─────────────┘                       └─────────────┘
```

## Migration Notes

1. Create new tables `vmi_webhooks` and `vmi_webhook_deliveries`
2. Add columns to `vmi_portal_config`
3. No data migration needed (new feature)
4. Existing polling functionality remains unchanged

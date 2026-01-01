# Research: VMI Webhook Integration

**Feature**: 012-vmi-webhook
**Date**: 2025-12-30

## 1. Webhook URL Structure

**Decision**: Use `/api/webhooks/vmi/[portalId]` pattern

**Rationale**:
- Each VMI portal connection needs its own webhook endpoint
- Portal ID in URL allows routing to correct webhook configuration
- Separates incoming webhook traffic from internal API routes
- Makes it clear this is an external-facing endpoint

**Alternatives Considered**:
- Single endpoint with portal ID in header: Rejected - harder to configure in VMI portal
- Single endpoint with portal ID in body: Rejected - can't validate before parsing body
- `/api/external/webhooks/[portalId]`: Acceptable but `/api/webhooks/vmi` is clearer

## 2. Signature Validation Algorithm

**Decision**: HMAC-SHA256 as specified in VMI-VENDOR-API.md

**Rationale**:
- VMI Portal documentation specifies HMAC-SHA256 signature
- Signature payload format: `${timestamp}.${body}`
- Standard cryptographic approach with good library support
- Timestamp validation prevents replay attacks

**Implementation Details**:
```typescript
// From VMI-VENDOR-API.md section 10
const signaturePayload = `${timestamp}.${body}`;
const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(signaturePayload)
  .digest('hex');

// Use timing-safe comparison
crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
);
```

**Alternatives Considered**:
- HMAC-SHA512: Not supported by VMI Portal
- Ed25519 signatures: Not supported by VMI Portal

## 3. Async Processing Strategy

**Decision**: Immediate 200 response, then process asynchronously

**Rationale**:
- VMI Portal expects quick response (< 30 seconds timeout)
- Processing order creation may involve database operations and matching
- Returning 200 immediately prevents timeouts and retries
- Next.js doesn't have built-in job queue, so use `waitUntil` pattern

**Implementation Approach**:
```typescript
export async function POST(request: Request) {
  // 1. Validate signature (fast operation)
  // 2. Return 200 immediately
  // 3. Process payload asynchronously using after()

  after(async () => {
    await processWebhookPayload(payload);
  });

  return NextResponse.json({ received: true });
}
```

**Alternatives Considered**:
- BullMQ job queue: Too heavy for current scale, adds infrastructure complexity
- Process synchronously: Risk of timeouts, poor user experience
- Background worker process: Adds deployment complexity

## 4. Duplicate Prevention Strategy

**Decision**: Track delivery IDs in `vmi_webhook_deliveries` table

**Rationale**:
- VMI Portal sends `X-Webhook-Delivery-Id` header per VMI-VENDOR-API.md
- Storing delivery ID allows idempotent processing
- Can check if delivery was already processed before taking action
- Also enables delivery history viewing

**Implementation**:
1. Check if delivery ID exists in database
2. If exists with status "processed", return 200 without reprocessing
3. If exists with status "failed", may retry processing
4. If not exists, insert record and process

**Alternatives Considered**:
- In-memory cache (Redis): Adds infrastructure, not persistent
- Event payload hash: Doesn't handle intentional redeliveries

## 5. Secret Storage Pattern

**Decision**: Use existing encryption pattern with `secretEncrypted` column

**Rationale**:
- Project already has encryption for `api_key_encrypted` in `vmi_portal_config`
- Consistent approach across codebase
- Encryption key from environment variable

**Implementation**:
- Store encrypted secret in `vmi_webhooks.secret_encrypted`
- Use same encryption/decryption functions as existing API key storage
- Never expose decrypted secret in API responses (except on creation)

**Alternatives Considered**:
- Plain text storage: Security risk, not acceptable
- External secrets manager (Vault): Over-engineering for current scale

## 6. Event Processing Order

**Decision**: Process events based on event timestamp, not arrival order

**Rationale**:
- Network delays can cause events to arrive out of order
- VMI Portal includes timestamp in payload
- Using event timestamp ensures correct state transitions

**Implementation**:
- Extract event timestamp from payload
- For status updates, check if incoming event is newer than current state
- Skip processing if event is older than current state
- Log skipped events for debugging

## 7. Portal-Side Webhook Registration

**Decision**: Call VMI Portal API to register webhook endpoints

**Rationale**:
- VMI-VENDOR-API.md documents `POST /api/external/vendor/webhooks` endpoint
- Registration returns secret that must be saved immediately
- Portal manages retry logic and delivery

**API Integration** (from docs):
```typescript
// Register webhook with VMI Portal
const response = await portalService.registerWebhook({
  url: `${process.env.PUBLIC_URL}/api/webhooks/vmi/${portalId}`,
  name: 'Order Notifications',
  events: ['order.created', 'order.cancelled', 'receipt.created', 'receipt.completed']
});

// Save returned secret (encrypted)
await saveWebhookSecret(response.secret);
```

## 8. Fallback Polling Coexistence

**Decision**: Keep polling enabled, detect duplicates

**Rationale**:
- Webhook delivery is not guaranteed (network issues, endpoint downtime)
- Polling provides safety net for missed events
- Duplicate detection prevents double-processing

**Implementation**:
- Polling continues at configured interval
- When polling finds orders, check if already received via webhook
- Use `vmi_order_id` as unique identifier for deduplication
- Log when order was received via both methods (for monitoring)

## 9. UI Integration Location

**Decision**: Integrate into existing VMI portal configuration flow

**Rationale**:
- Webhooks are per-portal configuration
- Users managing VMI portals will also manage webhooks
- Consistent navigation pattern

**UI Flow**:
1. User goes to `/purchasing/vmi/portals/[id]` (existing portal detail page)
2. New "Webhooks" tab or link to `/purchasing/vmi/portals/[id]/webhooks`
3. Webhook list with health status indicators
4. Add/Edit/Delete webhook dialogs
5. Delivery history link for each webhook

## 10. Health Status Calculation

**Decision**: Track consecutive failures, auto-disable after 10

**Rationale**:
- VMI Portal documentation mentions auto-disable after 10 consecutive failures
- Need to track failure count per webhook
- Provide re-enable functionality

**Status Levels**:
- **Active**: `isActive=true`, `consecutiveFailures < 3`
- **Warning**: `isActive=true`, `consecutiveFailures >= 3`
- **Disabled (failures)**: `isDisabledByFailures=true`
- **Disabled (manual)**: `isActive=false`

## Summary

All technical decisions are resolved. No NEEDS CLARIFICATION items remain.

Key implementation priorities:
1. Database schema (new tables)
2. Signature validation service
3. Webhook receiver endpoint
4. Event processing logic
5. UI for webhook management
6. Delivery history tracking

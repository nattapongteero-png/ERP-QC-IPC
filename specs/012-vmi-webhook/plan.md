# Implementation Plan: VMI Webhook Integration

**Branch**: `012-vmi-webhook` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-vmi-webhook/spec.md`

## Summary

Modify the existing VMI Portal integration from polling-based (pull) to webhook-based (push) approach. The system will register webhooks with VMI portals to receive real-time notifications for order events (`order.created`, `order.cancelled`, `receipt.created`, `receipt.completed`). The implementation includes webhook endpoint with HMAC-SHA256 signature validation, idempotent event processing, monitoring dashboard, and fallback polling for reliability.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.0.10
**Primary Dependencies**: Drizzle ORM, DevExtreme React 25.2.3, TanStack Query 5.x, Zod 4.x
**Storage**: MySQL (production), SQLite (testing) via Drizzle dual-schema pattern
**Testing**: Vitest with React Testing Library
**Target Platform**: Web application (Linux server deployment)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Process webhook notifications within 200ms, 99.9% successful processing rate
**Constraints**: HTTPS-accessible webhook endpoint required, 5-minute timestamp tolerance for signature validation
**Scale/Scope**: Support multiple VMI portal connections, 100+ webhook deliveries per day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Implementation Notes |
|-----------|--------|---------------------|
| **I. Type Safety** | PASS | All webhook types defined in TypeScript, strict mode |
| **I. Linting Compliance** | PASS | ESLint checks on all new code |
| **I. No Hardcoded Values** | PASS | Webhook secrets in encrypted DB column, configurable via UI |
| **I. Error Handling** | PASS | Structured error responses, audit logging |
| **I. Error Verification** | PASS | Run tsc/lint after each change |
| **I. Frequent Commits** | PASS | Commit after each task |
| **I. Reusable Components** | PASS | Extend existing VMI portal config components |
| **II. Testing Standards** | PASS | Unit tests for signature validation, integration tests for webhook endpoint |
| **III. DevExpress/DevExtreme** | PASS | Use DataGrid for delivery history, Form for webhook config |
| **III. Loading States** | PASS | Show loading during webhook registration |
| **III. Error Feedback** | PASS | Thai/English error messages |
| **IV. API Response** | PASS | Webhook endpoint responds < 200ms |
| **V. Audit Trail** | PASS | All webhook events logged to vmi_webhook_deliveries |
| **V. Input Validation** | PASS | HMAC-SHA256 signature validation, Zod schemas |

**Gate Status**: PASS - All constitution principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/012-vmi-webhook/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
│   └── webhook-api.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── vmi.ts                           # Extend with webhook types
├── lib/
│   ├── db/
│   │   └── schema.ts                    # Add webhook tables (MySQL + SQLite)
│   ├── validation/
│   │   └── vmi-webhook.ts               # Zod schemas for webhook payloads
│   └── services/
│       ├── vmi-portal.service.ts        # Extend with webhook registration
│       ├── vmi-webhook.service.ts       # NEW: Webhook processing service
│       └── vmi-webhook-crypto.ts        # NEW: Signature validation utility
├── app/
│   ├── api/
│   │   └── sales/
│   │       └── vmi-orders/
│   │           ├── webhooks/
│   │           │   └── [portalId]/
│   │           │       └── route.ts     # NEW: Webhook receiver endpoint
│   │           └── portals/
│   │               └── [portalId]/
│   │                   └── webhooks/
│   │                       └── route.ts # NEW: Webhook management API
│   └── sales/
│       └── vmi-orders/
│           └── portals/
│               └── [id]/
│                   ├── webhooks/
│                   │   └── page.tsx     # NEW: Webhook management UI
│                   └── deliveries/
│                       └── page.tsx     # NEW: Delivery history UI
└── components/
    └── vmi/
        ├── WebhookConfigForm.tsx        # NEW: Webhook registration form
        ├── WebhookDeliveryGrid.tsx      # NEW: Delivery history DataGrid
        └── WebhookHealthBadge.tsx       # NEW: Health status indicator

tests/
├── unit/
│   └── services/
│       └── vmi-webhook-crypto.test.ts   # Signature validation tests
└── integration/
    └── api/
        └── sales/
            └── vmi-orders/
                └── webhooks.test.ts     # Webhook endpoint tests
```

**Structure Decision**: Extends existing VMI module structure under `/api/sales/vmi-orders/` since we ARE the vendor receiving orders from hospitals. Webhook endpoint placed under `/api/sales/vmi-orders/webhooks/[portalId]` following the existing pattern. UI integrated into existing VMI sales order management flow.

## Complexity Tracking

> No constitution violations - table not needed.

## Phase 0: Research Summary

Key decisions resolved:
1. **Webhook URL Structure**: `/api/sales/vmi-orders/webhooks/[portalId]` - follows existing sales order pattern since we are the vendor
2. **Signature Validation**: HMAC-SHA256 per VMI-VENDOR-API.md specification
3. **Async Processing**: Immediate 200 response, then process via queue/async function
4. **Duplicate Prevention**: Track delivery IDs in `vmi_webhook_deliveries` table
5. **Secret Storage**: Encrypted using existing encryption pattern (like `api_key_encrypted`)

## Phase 1: Design Artifacts

### Data Model

See [data-model.md](./data-model.md) for complete entity definitions.

**New Tables:**
- `vmi_webhooks` - Registered webhook configurations per portal
- `vmi_webhook_deliveries` - Received webhook notification history

**Extended Tables:**
- `vmi_portal_config` - Add `webhook_enabled` flag

### API Contracts

See [contracts/webhook-api.yaml](./contracts/webhook-api.yaml) for OpenAPI specification.

**New Endpoints:**
- `POST /api/sales/vmi-orders/webhooks/[portalId]` - Receive webhook notifications (from VMI portal)
- `GET /api/sales/vmi-orders/portals/[portalId]/webhooks` - List webhooks for portal
- `POST /api/sales/vmi-orders/portals/[portalId]/webhooks` - Register new webhook
- `PATCH /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]` - Update webhook
- `DELETE /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]` - Delete webhook
- `GET /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]/deliveries` - Delivery history

### Quickstart

See [quickstart.md](./quickstart.md) for developer setup instructions.

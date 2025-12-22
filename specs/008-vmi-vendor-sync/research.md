# Research: VMI Vendor Sync (Correction)

**Feature Branch**: `008-vmi-vendor-sync`
**Created**: 2025-12-21
**Status**: Complete

## Research Summary

This document consolidates research findings for implementing the corrected VMI integration where this ERP system operates as the **vendor/supplier** (not customer) in the VMI ecosystem.

---

## 1. Existing VMI Infrastructure Analysis

### Decision: Extend Existing VMI Tables vs Create New

**Decision**: Extend existing `vmi_*` tables with new `vmi_portal_config` table for settings-based configuration.

**Rationale**:
- Existing `vmi_vendor_config` is vendor-centric (stores config per-vendor) - wrong model
- Need portal-centric configuration (our credentials to connect to VMI portals)
- Existing `vmi_transactions` table is reusable for audit logging
- Existing `vmi_orders` structure can be adapted for incoming sales orders

**Alternatives Considered**:
1. **Reuse vmi_vendor_config**: Rejected - semantics are wrong (vendor vs portal)
2. **Create parallel tables**: Rejected - unnecessary duplication
3. **Extend settings table with JSON**: Rejected - structured table better for multi-portal support

### Existing Tables to Reuse

| Table | Reuse Strategy |
|-------|----------------|
| `vmi_transactions` | As-is - log all outbound sync and order operations |
| `vmi_orders` | Modify - link to sales orders instead of purchase orders |
| `vmi_order_lines` | As-is - structure works for incoming order lines |
| `items` (tpp_code, ttmt_code) | As-is - already has required fields |

### New Tables Required

| Table | Purpose |
|-------|---------|
| `vmi_portal_config` | Store API credentials and sync settings per portal |
| `vmi_sales_orders` | Bridge VMI orders to sales orders |

---

## 2. Settings Module Integration

### Decision: Dedicated vmi_portal_config Table

**Decision**: Create a dedicated `vmi_portal_config` table rather than using the generic `settings` key-value table.

**Rationale**:
- Multiple VMI portal configurations (one per connected hospital/portal)
- Structured data: URL, API key, vendor ID, sync intervals, status
- Query efficiency for listing and filtering portals
- Foreign key relationships (e.g., linking orders to portal)

**Alternatives Considered**:
1. **Generic settings table with JSON value**: Rejected - poor query performance, no FK support
2. **Environment variables**: Rejected - can't support multiple portals dynamically
3. **Config file**: Rejected - requires restart, no runtime changes

### Portal Configuration Schema

```typescript
interface VmiPortalConfig {
  id: number;
  name: string;                    // Display name for the portal
  portalUrl: string;               // Base URL of VMI portal API
  apiKeyEncrypted: string;         // Encrypted API key (X-API-Key)
  vendorId: string;                // Our vendor ID in this portal
  isEnabled: boolean;              // Enable/disable sync
  syncInventoryEnabled: boolean;   // Sync inventory to this portal
  syncInventoryInterval: number;   // Interval in minutes (default: 60)
  syncItemsEnabled: boolean;       // Sync item catalog
  syncPricesEnabled: boolean;      // Sync prices
  orderPollingEnabled: boolean;    // Poll for incoming orders
  orderPollingInterval: number;    // Interval in minutes (default: 15)
  lastInventorySyncAt: Date | null;
  lastItemsSyncAt: Date | null;
  lastPricesSyncAt: Date | null;
  lastOrdersPollAt: Date | null;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. Order Flow: VMI Portal to Sales System

### Decision: Create Sales Orders from VMI Orders

**Decision**: When orders are polled from VMI Portal, create records in `sales_orders` table with a `source` field indicating VMI origin.

**Rationale**:
- Sales module already has order lifecycle (draft, confirmed, shipped, received)
- Existing sales order workflow can handle fulfillment
- Unified reporting across all sales channels
- Avoid duplicate order management logic

**Alternatives Considered**:
1. **Separate vmi_sales_orders table**: Rejected - duplicates sales logic
2. **Link to purchasing module**: Rejected - fundamentally wrong direction
3. **Create new order system**: Rejected - unnecessary complexity

### Order Mapping

| VMI Portal Field | Sales Order Field |
|------------------|-------------------|
| orderId | vmiOrderId (new field) |
| customerInfo.customerId | customerId (FK or create new) |
| customerInfo.customerName | customerName |
| orderDate | orderDate |
| requiredDate | requiredDate |
| lines[].tppCode | item lookup via tppCode |
| lines[].ttmtCode | item lookup via ttmtCode |
| lines[].quantity | quantity |
| lines[].unitPrice | unitPrice |
| status | vmiStatus (separate from local status) |

### Customer Mapping Strategy

**Decision**: Auto-create customer record if not exists, match by VMI customerId.

1. Poll order from VMI Portal
2. Extract `customerInfo.customerId` and `customerInfo.customerName`
3. Search customers table for matching `vmiCustomerId`
4. If found: link to existing customer
5. If not found: create new customer with `vmiCustomerId` set
6. Create sales order linked to customer

---

## 4. Outbound Sync Architecture

### Decision: Service Layer with Batch Operations

**Decision**: Implement `VmiSyncService` class with methods for each sync type, using batch operations with configurable batch size.

**Rationale**:
- Performance requirement: 500 items in <60 seconds
- Transactional consistency for batch operations
- Progress tracking for long-running syncs
- Retry logic for failed items

### Sync Flow

```
1. Trigger (manual or scheduled)
2. Fetch data from local DB (items with TPP/TTMT codes)
3. Transform to VMI Portal format
4. Batch into chunks (default: 100 items)
5. For each batch:
   a. Call VMI Portal API
   b. Log transaction
   c. Update sync timestamp
   d. Handle errors (continue with next batch)
6. Return summary (success/failed counts)
```

### API Endpoints for VMI Portal (Outbound)

Based on assumed VMI Portal API structure:

| Operation | Method | Endpoint | Payload |
|-----------|--------|----------|---------|
| Sync items | POST | /api/vendor/items | Array of items |
| Sync inventory | POST | /api/vendor/inventory | Array of stock levels |
| Sync prices | POST | /api/vendor/prices | Array of price offers |
| Poll orders | GET | /api/vendor/orders?status=submitted | - |
| Confirm order | PATCH | /api/vendor/orders/{id} | { status: "confirmed" } |
| Ship order | PATCH | /api/vendor/orders/{id} | { status: "shipped", shipmentDetails } |

---

## 5. API Key Encryption

### Decision: Use Existing Crypto Service

**Decision**: Use existing `src/lib/crypto/encrypt.ts` for API key encryption.

**Rationale**:
- Already implemented and tested
- Uses AES-256-GCM encryption
- Key derived from `ENCRYPTION_KEY` environment variable
- Pattern already used for `vmi_vendor_config.apiKeyEncrypted`

### Usage Pattern

```typescript
import { encrypt, decrypt } from '@/lib/crypto/encrypt';

// Store
const encryptedKey = await encrypt(apiKey);
await db.insert(vmiPortalConfig).values({ apiKeyEncrypted: encryptedKey });

// Retrieve
const config = await db.select().from(vmiPortalConfig);
const apiKey = await decrypt(config.apiKeyEncrypted);
```

---

## 6. Permissions & Authorization

### Decision: New Permission Scopes for VMI Vendor Operations

**Decision**: Add new permission scopes for VMI vendor operations, separate from purchasing.

**Rationale**:
- VMI vendor operations are sales-side, not purchasing-side
- Need fine-grained control: configure, sync, view orders
- Admin and Sales Manager should have access

### Permission Scopes

| Scope | Description | Allowed Roles |
|-------|-------------|---------------|
| `vmi-settings:read` | View VMI portal configurations | ADMIN, MANAGER, SALES |
| `vmi-settings:write` | Create/update VMI portal configs | ADMIN, MANAGER |
| `vmi-sync:execute` | Trigger manual sync operations | ADMIN, MANAGER, SALES |
| `vmi-orders:read` | View VMI orders | ADMIN, MANAGER, SALES, WAREHOUSE |
| `vmi-orders:write` | Confirm/ship VMI orders | ADMIN, MANAGER, SALES |

---

## 7. Error Handling & Retry Strategy

### Decision: Exponential Backoff with Circuit Breaker

**Decision**: Use existing retry logic from `vmi-portal.service.ts` with circuit breaker pattern.

**Rationale**:
- Existing service already has 3-retry exponential backoff
- Add circuit breaker to prevent hammering unresponsive portals
- Per-portal circuit breaker state

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold: 5;      // Open circuit after 5 failures
  successThreshold: 2;      // Close circuit after 2 successes
  timeout: 60000;           // Half-open after 60 seconds
}
```

### Error States

| Error Type | Response | Retry |
|------------|----------|-------|
| 401 Unauthorized | Mark portal as disconnected, alert admin | No |
| 400 Validation Error | Log item-specific error, continue batch | No |
| 500 Server Error | Retry with backoff | Yes |
| Network Timeout | Retry with backoff | Yes |
| Circuit Open | Skip portal, log warning | Wait |

---

## 8. Scheduled Sync Implementation

### Decision: API Routes with Cron Job Triggers

**Decision**: Use external cron service to call internal API endpoints for scheduled syncs.

**Rationale**:
- Next.js doesn't have built-in cron
- Vercel Cron / system cron can trigger endpoints
- Each sync type has dedicated endpoint
- Configurable per-portal intervals

**Alternatives Considered**:
1. **node-cron in API route**: Rejected - doesn't work with serverless
2. **Separate worker process**: Rejected - adds operational complexity
3. **Database-based scheduler**: Rejected - polling overhead

### Cron Endpoints

```
POST /api/vmi-sync/scheduled/inventory  # Called every 15 minutes
POST /api/vmi-sync/scheduled/items      # Called every hour
POST /api/vmi-sync/scheduled/prices     # Called every hour
POST /api/sales/vmi-orders/poll         # Called every 15 minutes
```

Each endpoint checks portal configurations and only syncs if:
- Portal is enabled
- Sync type is enabled for portal
- Enough time has passed since last sync

---

## 9. Testing Strategy

### Decision: Unit Tests + Integration Tests with Mock VMI Portal

**Decision**: Use Vitest with SQLite in-memory for unit tests, mock external VMI Portal API for integration tests.

**Rationale**:
- Existing test infrastructure in place
- SQLite provides fast, isolated tests
- Mock server prevents external dependencies in CI

### Test Coverage Plan

| Component | Test Type | Focus |
|-----------|-----------|-------|
| VmiSyncService | Unit | Transform logic, batch handling |
| VmiSalesOrderService | Unit | Order mapping, customer lookup |
| API Routes | Integration | Auth, validation, response format |
| Full Flow | E2E | Portal config → Sync → Order receive |

### Mock VMI Portal

```typescript
// tests/mocks/vmi-portal.mock.ts
import { setupServer } from 'msw/node';
import { rest } from 'msw';

export const vmiPortalMock = setupServer(
  rest.post('*/api/vendor/items', (req, res, ctx) => {
    return res(ctx.json({ success: true, inserted: 10, updated: 5 }));
  }),
  rest.get('*/api/vendor/orders', (req, res, ctx) => {
    return res(ctx.json({ orders: [/* mock orders */] }));
  }),
);
```

---

## 10. UI Components

### Decision: DevExtreme Data Grid for Orders, Form Components for Settings

**Decision**: Use DevExtreme DataGrid for VMI orders list, standard form components for portal configuration.

**Rationale**:
- Constitution requires DevExtreme as primary UI library
- DataGrid provides filtering, sorting, export built-in
- Existing patterns in sales module

### Component Structure

```
components/vmi/
├── VmiPortalConfigForm.tsx    # Add/edit portal configuration
├── VmiPortalList.tsx          # List of configured portals with status
├── VmiSyncStatusCard.tsx      # Dashboard card showing sync status
├── VmiSyncTrigger.tsx         # Manual sync buttons with progress
├── VmiOrdersGrid.tsx          # DevExtreme DataGrid for orders
└── VmiOrderDetail.tsx         # Order detail view with actions
```

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| Config Storage | Dedicated `vmi_portal_config` table |
| Order Flow | Create sales orders from VMI orders |
| Sync Architecture | Service layer with batch operations |
| Encryption | Use existing crypto service |
| Permissions | New `vmi-*` scopes for sales-side operations |
| Error Handling | Exponential backoff with circuit breaker |
| Scheduling | External cron triggers internal API endpoints |
| Testing | Unit + integration with mock VMI portal |
| UI | DevExtreme DataGrid + form components |

All research items resolved. Ready for Phase 1: Data Model & Contracts.

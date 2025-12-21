# Quickstart: VMI Portal Vendor Integration

**Feature**: 006-vmi-vendor-integration
**Date**: 2025-12-20

## Overview

This guide helps developers quickly understand and start implementing the VMI Portal integration feature.

## Prerequisites

1. **Environment Setup**
   ```bash
   # Clone and install dependencies
   cd herbal-medicine-erp
   pnpm install

   # Set up environment variables
   cp .env.example .env.local
   ```

2. **Required Environment Variables**
   ```env
   # VMI Portal Configuration
   VMI_PORTAL_BASE_URL=https://vmi-portal.bmscloud.in.th/api/external/vendor
   VMI_ENCRYPTION_KEY=<generate-32-byte-hex-key>
   CRON_SECRET=<generate-secure-random-string>

   # Generate encryption key:
   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Database Migration**
   ```bash
   # After schema changes are implemented
   pnpm db:generate
   pnpm db:migrate
   ```

## Key Files to Create/Modify

### 1. Schema Changes (`src/lib/db/schema.ts`)

Add to items table:
```typescript
// Add to sqliteItems and mysqlItems
tppCode: text('tpp_code'),  // 13 digits
ttmtCode: text('ttmt_code'), // A + 8 digits
```

Create new tables:
- `vmi_vendor_config`
- `vmi_price_offers`
- `vmi_orders`
- `vmi_order_lines`

Extend `vmi_transactions` with:
- `request_payload`
- `response_payload`
- `http_status`
- `duration_ms`

### 2. Encryption Utility (`src/lib/crypto/encrypt.ts`)

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(plaintext: string): string {
  const key = Buffer.from(process.env.VMI_ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':');
  const key = Buffer.from(process.env.VMI_ENCRYPTION_KEY!, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return decipher.update(Buffer.from(encryptedB64, 'base64')) + decipher.final('utf8');
}
```

### 3. VMI Portal Service (`src/lib/services/vmi-portal.service.ts`)

```typescript
export class VmiPortalService {
  constructor(private config: VmiVendorConfig) {}

  async syncItems(items: VmiItem[]): Promise<VmiSyncResult> {
    return this.request('POST', '/items', { items });
  }

  async syncPrices(offers: VmiPriceOffer[]): Promise<VmiSyncResult> {
    return this.request('POST', '/prices', { offers });
  }

  async syncInventory(inventory: VmiInventoryItem[]): Promise<VmiSyncResult> {
    return this.request('POST', '/inventory', { inventory });
  }

  async getOrders(params: VmiOrderQuery): Promise<VmiOrderListResponse> {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.request('GET', `/orders?${query}`);
  }

  async confirmOrder(orderId: number): Promise<VmiOrderActionResult> {
    return this.request('PATCH', `/orders/${orderId}`, { action: 'confirm' });
  }

  async shipOrder(orderId: number, date: string): Promise<VmiOrderActionResult> {
    return this.request('PATCH', `/orders/${orderId}`, {
      action: 'ship',
      expectedDeliveryDate: date
    });
  }
}
```

### 4. API Routes Structure

```text
src/app/api/purchasing/vmi/
├── config/route.ts           # GET/PUT vendor VMI config
├── sync/
│   ├── items/route.ts        # POST sync items
│   ├── prices/route.ts       # POST sync prices
│   └── inventory/route.ts    # POST sync inventory
├── orders/
│   ├── route.ts              # GET list, POST poll
│   └── [id]/
│       ├── route.ts          # GET detail, PATCH action
│       └── receipt-status/route.ts
├── dashboard/route.ts        # GET dashboard stats
├── transactions/route.ts     # GET transaction log
└── cron/
    ├── poll-orders/route.ts  # Cron trigger
    └── sync-inventory/route.ts
```

## Testing Workflow

### 1. Unit Tests

```bash
# Run all tests
pnpm test:run

# Run VMI-specific tests
pnpm test:run tests/unit/services/vmi-portal.service.test.ts
```

### 2. Integration Tests

```bash
# Test with SQLite
DB_TYPE=sqlite pnpm test:run tests/integration/api/vmi/
```

### 3. Manual Testing with VMI Portal (Development)

```bash
# Use development base URL
VMI_PORTAL_BASE_URL=http://localhost:3000/api/external/vendor

# Test connection
curl -X POST http://localhost:3000/api/vendors/1/vmi-config/test
```

## Development Checklist

### Phase 1: Foundation
- [ ] Add tpp_code, ttmt_code to items schema
- [ ] Create vmi_vendor_config table
- [ ] Create vmi_price_offers table
- [ ] Create vmi_orders and vmi_order_lines tables
- [ ] Extend vmi_transactions table
- [ ] Implement encryption utility
- [ ] Create VmiPortalService class

### Phase 2: Configuration
- [ ] Vendor VMI config API (GET/PUT)
- [ ] Connection test endpoint
- [ ] Add VMI config section to vendor detail page

### Phase 3: Sync Operations
- [ ] Item sync to VMI Portal
- [ ] Price sync to VMI Portal
- [ ] Inventory sync to VMI Portal
- [ ] Sync status tracking

### Phase 4: Order Management
- [ ] Order polling from VMI Portal
- [ ] Order list and detail views
- [ ] Confirm order action
- [ ] Ship order action
- [ ] Receipt status check
- [ ] Create local PO on confirm

### Phase 5: Dashboard & Monitoring
- [ ] VMI dashboard page
- [ ] Transaction log view
- [ ] Error notifications

### Phase 6: Scheduled Jobs
- [ ] Cron endpoint for order polling
- [ ] Cron endpoint for inventory sync
- [ ] Cron job configuration (external)

## Common Patterns

### Error Handling

```typescript
try {
  const result = await vmiService.syncItems(items);
  return successResponse(result);
} catch (error) {
  if (error instanceof VmiPortalError) {
    // Map VMI error codes to user messages
    return errorResponse(mapVmiError(error), error.httpStatus);
  }
  // Log and return generic error
  console.error('VMI sync error:', error);
  return errorResponse('Failed to sync with VMI Portal', 500);
}
```

### Transaction Logging

```typescript
async function logTransaction(
  vendorId: number,
  type: string,
  request: unknown,
  response: unknown,
  status: number,
  duration: number
) {
  await db.insert(vmiTransactions).values({
    vendorId,
    transactionType: type,
    requestPayload: JSON.stringify(request),
    responsePayload: JSON.stringify(response),
    httpStatus: status,
    durationMs: duration,
    status: status >= 200 && status < 300 ? 'processed' : 'error',
    createdAt: new Date(),
  });
}
```

### Cron Endpoint Security

```typescript
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('X-Cron-Secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Execute cron job...
}
```

## API Reference

See detailed API contracts:
- [VMI Configuration](./contracts/vmi-config.yaml)
- [VMI Sync](./contracts/vmi-sync.yaml)
- [VMI Orders](./contracts/vmi-orders.yaml)

## VMI Portal API Reference

Full VMI Portal API documentation: [docs/VMI-VENDOR-API.md](../../docs/VMI-VENDOR-API.md)

Key endpoints used:
- `POST /items` - Sync item master
- `POST /prices` - Sync price offers
- `POST /inventory` - Sync stock levels
- `GET /orders` - List orders
- `GET /orders/{id}` - Order detail
- `PATCH /orders/{id}` - Confirm/ship order
- `GET /orders/{id}/receipt-status` - Check receipt

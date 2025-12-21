# Quickstart: VMI Vendor Sync (Correction)

**Feature Branch**: `008-vmi-vendor-sync`
**Created**: 2025-12-21

## Overview

This feature corrects the VMI integration to treat this ERP as the **vendor/supplier** that sells products to hospitals via VMI portals (not as a customer purchasing from vendors).

## Prerequisites

- Node.js 18+
- MySQL 8.0 (production) or SQLite (development/testing)
- VMI Portal API credentials (obtain from portal administrator)
- Environment variables configured

## Environment Setup

Add to `.env.local`:

```bash
# Existing variables
DB_TYPE=mysql  # or sqlite for testing
ENCRYPTION_KEY=your-32-byte-encryption-key

# For scheduled sync (optional)
CRON_SECRET=your-cron-secret-key
```

## Database Migration

Run the schema changes:

```bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:push

# Verify tables exist
npm run db:studio
```

New tables:
- `vmi_portal_config` - Portal configurations
- `vmi_sync_history` - Sync operation logs
- `vmi_sales_orders` - Orders from VMI portals
- `vmi_sales_order_lines` - Order line items

## Configuration

### 1. Add VMI Portal Configuration

Navigate to **Settings > VMI Integration** or use the API:

```bash
curl -X POST http://localhost:3000/api/settings/vmi \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Hospital A Portal",
    "portalUrl": "https://vmi-portal.example.com/api",
    "apiKey": "your-api-key",
    "vendorId": "VENDOR001",
    "isEnabled": true,
    "syncInventoryEnabled": true,
    "syncInventoryInterval": 60,
    "orderPollingEnabled": true,
    "orderPollingInterval": 15
  }'
```

### 2. Test Connection

```bash
curl -X POST http://localhost:3000/api/settings/vmi/1/test \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "latencyMs": 245,
    "vendorInfo": {
      "vendorId": "VENDOR001",
      "vendorName": "Your Company Name"
    }
  }
}
```

### 3. Enable Items for VMI Sync

Mark items to include in sync:

```sql
UPDATE items
SET vmi_sync_enabled = 1
WHERE tpp_code IS NOT NULL OR ttmt_code IS NOT NULL;
```

## Basic Operations

### Sync Inventory to Portal

Manual sync:
```bash
curl -X POST http://localhost:3000/api/vmi-sync/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"portalId": 1}'
```

### Sync Item Catalog

```bash
curl -X POST http://localhost:3000/api/vmi-sync/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"portalId": 1}'
```

### Poll for Orders

```bash
curl -X POST http://localhost:3000/api/sales/vmi-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"portalId": 1}'
```

### Confirm Order

```bash
curl -X POST http://localhost:3000/api/sales/vmi-orders/123/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"expectedShipDate": "2025-12-25"}'
```

### Ship Order

```bash
curl -X POST http://localhost:3000/api/sales/vmi-orders/123/ship \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "shipmentDate": "2025-12-24",
    "expectedDeliveryDate": "2025-12-25",
    "trackingNumber": "TRK123456"
  }'
```

## Scheduled Sync (Cron)

Set up cron jobs to call internal endpoints:

```cron
# Every 15 minutes: sync inventory and poll orders
*/15 * * * * curl -X POST http://localhost:3000/api/vmi-sync/scheduled/inventory -H "X-Cron-Secret: $CRON_SECRET"
*/15 * * * * curl -X POST http://localhost:3000/api/sales/vmi-orders/poll -H "X-Cron-Secret: $CRON_SECRET"

# Every hour: sync items and prices
0 * * * * curl -X POST http://localhost:3000/api/vmi-sync/scheduled/items -H "X-Cron-Secret: $CRON_SECRET"
0 * * * * curl -X POST http://localhost:3000/api/vmi-sync/scheduled/prices -H "X-Cron-Secret: $CRON_SECRET"
```

## Testing

Run unit tests:
```bash
npm test -- --grep "vmi"
```

Run integration tests with mock portal:
```bash
npm test -- tests/integration/vmi-full-flow.test.ts
```

## Troubleshooting

### Connection Test Fails

1. Check portal URL (must be HTTPS)
2. Verify API key is valid
3. Check network connectivity
4. Review error in `vmi_portal_config.last_error_message`

### Items Not Syncing

1. Verify `vmi_sync_enabled = true` on items
2. Check items have `tpp_code` or `ttmt_code`
3. Review sync history: `GET /api/vmi-sync/status`

### Orders Not Matching

1. Check `vmi_sales_order_lines.match_status`
2. Verify item codes match (tpp_code/ttmt_code)
3. Manual match: `POST /api/sales/vmi-orders/{id}/lines/{lineId}/match`

## Data Flow Summary

```
┌────────────────────┐
│   Our Inventory    │
│   Items, Prices    │
└─────────┬──────────┘
          │ PUSH (outbound)
          ▼
┌────────────────────┐
│   VMI Portal       │
│   (External)       │
└─────────┬──────────┘
          │ POLL (inbound)
          ▼
┌────────────────────┐
│   Sales Orders     │
│   (Our System)     │
└────────────────────┘
```

## Key Differences from 006-vmi-vendor-integration

| Aspect | 006 (Wrong) | 008 (Correct) |
|--------|-------------|---------------|
| Our Role | Customer | Vendor |
| Inventory Sync | Pull from vendors | Push to portals |
| Orders | Create purchase orders | Receive sales orders |
| Config Location | Per-vendor | Settings module |
| Order Module | Purchasing | Sales |

## Next Steps

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement database schema changes
3. Build settings UI
4. Implement sync services
5. Build order processing flow
6. Set up scheduled jobs

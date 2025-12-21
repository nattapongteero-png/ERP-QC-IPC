# Data Model: VMI Portal Vendor Integration

**Feature**: 006-vmi-vendor-integration
**Date**: 2025-12-20

## Entity Relationship Diagram

```
┌─────────────────────┐     ┌─────────────────────┐
│      vendors        │     │       items         │
├─────────────────────┤     ├─────────────────────┤
│ id (PK)             │     │ id (PK)             │
│ code                │     │ code                │
│ name                │     │ name_th             │
│ is_vmi              │     │ name_en             │
│ ...existing...      │     │ tpp_code (NEW)      │
└─────────┬───────────┘     │ ttmt_code (NEW)     │
          │                 │ ...existing...      │
          │                 └──────────┬──────────┘
          │                            │
          ▼                            │
┌─────────────────────┐                │
│ vmi_vendor_config   │                │
│ (NEW)               │                │
├─────────────────────┤                │
│ id (PK)             │                │
│ vendor_id (FK)      │───┐            │
│ api_key_encrypted   │   │            │
│ vmi_vendor_id       │   │            │
│ base_url            │   │            │
│ is_connected        │   │            │
│ last_connection_at  │   │            │
│ sync_items_enabled  │   │            │
│ sync_prices_enabled │   │            │
│ sync_inventory_en..│   │            │
│ order_poll_interval│   │            │
│ created_at          │   │            │
│ updated_at          │   │            │
└─────────────────────┘   │            │
                          │            │
┌─────────────────────┐   │            │
│ vmi_price_offers    │   │            │
│ (NEW)               │   │            │
├─────────────────────┤   │            │
│ id (PK)             │   │            │
│ vendor_id (FK)      │───┤            │
│ item_id (FK)        │───┼────────────┘
│ unit_price          │   │
│ pack_price          │   │
│ moq                 │   │
│ lead_time_days      │   │
│ effective_date      │   │
│ expiry_date         │   │
│ is_active           │   │
│ last_synced_at      │   │
│ created_at          │   │
│ updated_at          │   │
└─────────────────────┘   │
                          │
┌─────────────────────┐   │
│ vmi_orders          │   │
│ (NEW)               │   │
├─────────────────────┤   │
│ id (PK)             │   │
│ vendor_id (FK)      │───┤
│ vmi_order_id        │   │ (VMI Portal order ID)
│ hospital_code       │   │
│ hospital_name       │   │
│ po_number           │   │ (from VMI Portal)
│ status              │   │
│ order_date          │   │
│ expected_delivery   │   │
│ total_value         │   │
│ item_count          │   │
│ notes               │   │
│ local_po_id (FK)    │───┤ (linked after confirm)
│ confirmed_at        │   │
│ shipped_at          │   │
│ received_at         │   │
│ created_at          │   │
│ updated_at          │   │
└─────────┬───────────┘   │
          │               │
          ▼               │
┌─────────────────────┐   │
│ vmi_order_lines     │   │
│ (NEW)               │   │
├─────────────────────┤   │
│ id (PK)             │   │
│ vmi_order_id (FK)   │───┤
│ item_id (FK)        │───┼────────────┐
│ local_code          │   │            │
│ quantity_ordered    │   │            │
│ quantity_received   │   │            │
│ unit_price          │   │            │
│ line_total          │   │            │
│ unit                │   │            │
│ tpp_code            │   │            │
│ ttmt_code           │   │            │
│ created_at          │   │            │
└─────────────────────┘   │            │
                          │            │
┌─────────────────────┐   │            │
│ vmi_transactions    │   │            │
│ (EXTEND existing)   │   │            │
├─────────────────────┤   │            │
│ id (PK)             │   │            │
│ vendor_id (FK)      │───┘            │
│ transaction_type    │                │
│ item_id (FK)        │────────────────┘
│ quantity            │
│ unit                │
│ data                │
│ status              │
│ request_payload(NEW)│
│ response_payload(NEW│
│ http_status (NEW)   │
│ duration_ms (NEW)   │
│ sent_at             │
│ received_at         │
│ error_message       │
│ created_at          │
└─────────────────────┘
```

## Schema Changes

### 1. Extend `items` Table

Add standard product code fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tpp_code` | VARCHAR(13) | No | Thai Pharmaceutical Product code (13 digits) |
| `ttmt_code` | VARCHAR(10) | No | Thai Traditional Medicine Terminology (A + 8 digits) |

**Validation Rules**:
- `tpp_code`: Must be exactly 13 digits if provided
- `ttmt_code`: Must match pattern `A[0-9]{8}` if provided
- At least one code should be set for VMI sync (enforced at application level)

### 2. New `vmi_vendor_config` Table

Store VMI Portal configuration per vendor:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INT | Yes | Auto | Primary key |
| `vendor_id` | INT | Yes | - | FK to vendors.id |
| `api_key_encrypted` | TEXT | Yes | - | AES-256-GCM encrypted API key |
| `vmi_vendor_id` | VARCHAR(50) | No | - | Vendor ID in VMI Portal |
| `base_url` | VARCHAR(255) | No | Default | VMI Portal base URL |
| `is_connected` | BOOLEAN | Yes | false | Connection status |
| `last_connection_at` | DATETIME | No | - | Last successful connection |
| `sync_items_enabled` | BOOLEAN | Yes | true | Enable item sync |
| `sync_prices_enabled` | BOOLEAN | Yes | true | Enable price sync |
| `sync_inventory_enabled` | BOOLEAN | Yes | true | Enable inventory sync |
| `order_poll_interval_minutes` | INT | Yes | 15 | Order polling interval |
| `last_items_sync_at` | DATETIME | No | - | Last item sync timestamp |
| `last_prices_sync_at` | DATETIME | No | - | Last price sync timestamp |
| `last_inventory_sync_at` | DATETIME | No | - | Last inventory sync timestamp |
| `last_orders_poll_at` | DATETIME | No | - | Last order poll timestamp |
| `created_at` | DATETIME | Yes | NOW() | Record creation time |
| `updated_at` | DATETIME | Yes | NOW() | Record update time |

**Constraints**:
- UNIQUE on `vendor_id` (one config per vendor)
- FK `vendor_id` → `vendors.id`

### 3. New `vmi_price_offers` Table

Store price offers to sync to VMI Portal:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INT | Yes | Auto | Primary key |
| `vendor_id` | INT | Yes | - | FK to vendors.id |
| `item_id` | INT | Yes | - | FK to items.id |
| `unit_price` | DECIMAL(15,2) | Yes | - | Price per unit (THB) |
| `pack_price` | DECIMAL(15,2) | No | - | Price per pack (THB) |
| `moq` | INT | No | - | Minimum order quantity |
| `lead_time_days` | INT | No | - | Delivery lead time |
| `effective_date` | DATE | Yes | - | Price effective from |
| `expiry_date` | DATE | No | - | Price valid until |
| `is_active` | BOOLEAN | Yes | true | Price is active |
| `last_synced_at` | DATETIME | No | - | Last sync to VMI Portal |
| `sync_status` | VARCHAR(20) | Yes | 'pending' | pending/synced/error |
| `sync_error` | TEXT | No | - | Last sync error message |
| `created_at` | DATETIME | Yes | NOW() | Record creation time |
| `updated_at` | DATETIME | Yes | NOW() | Record update time |

**Constraints**:
- UNIQUE on (`vendor_id`, `item_id`, `effective_date`)
- FK `vendor_id` → `vendors.id`
- FK `item_id` → `items.id`

### 4. New `vmi_orders` Table

Store orders received from VMI Portal:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INT | Yes | Auto | Primary key |
| `vendor_id` | INT | Yes | - | FK to vendors.id |
| `vmi_order_id` | INT | Yes | - | Order ID from VMI Portal |
| `hospital_code` | VARCHAR(20) | Yes | - | Hospital identifier |
| `hospital_name` | VARCHAR(255) | Yes | - | Hospital name |
| `po_number` | VARCHAR(50) | Yes | - | PO number from hospital |
| `warehouse_name` | VARCHAR(255) | No | - | Destination warehouse |
| `status` | VARCHAR(20) | Yes | 'submitted' | Order status |
| `order_date` | DATE | Yes | - | Order creation date |
| `expected_delivery_date` | DATE | No | - | Expected delivery |
| `total_value` | DECIMAL(15,2) | Yes | - | Total order value |
| `item_count` | INT | Yes | - | Number of line items |
| `notes` | TEXT | No | - | Order notes |
| `local_po_id` | INT | No | - | FK to purchase_orders.id |
| `confirmed_at` | DATETIME | No | - | Confirmation timestamp |
| `shipped_at` | DATETIME | No | - | Shipment timestamp |
| `received_at` | DATETIME | No | - | Receipt timestamp |
| `created_at` | DATETIME | Yes | NOW() | Record creation time |
| `updated_at` | DATETIME | Yes | NOW() | Record update time |

**Constraints**:
- UNIQUE on (`vendor_id`, `vmi_order_id`)
- FK `vendor_id` → `vendors.id`
- FK `local_po_id` → `purchase_orders.id`

**Status Values**: `submitted`, `confirmed`, `shipped`, `received`, `cancelled`

### 5. New `vmi_order_lines` Table

Store order line items from VMI Portal:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INT | Yes | Auto | Primary key |
| `vmi_order_id` | INT | Yes | - | FK to vmi_orders.id |
| `item_id` | INT | No | - | FK to items.id (if matched) |
| `local_code` | VARCHAR(50) | Yes | - | Vendor item code |
| `item_name` | VARCHAR(500) | Yes | - | Item name |
| `quantity_ordered` | DECIMAL(15,4) | Yes | - | Ordered quantity |
| `quantity_received` | DECIMAL(15,4) | Yes | 0 | Received quantity |
| `unit_price` | DECIMAL(15,2) | Yes | - | Unit price |
| `line_total` | DECIMAL(15,2) | Yes | - | Line total value |
| `unit` | VARCHAR(50) | Yes | - | Unit of measure |
| `tpp_code` | VARCHAR(13) | No | - | TPP code from order |
| `ttmt_code` | VARCHAR(10) | No | - | TTMT code from order |
| `created_at` | DATETIME | Yes | NOW() | Record creation time |

**Constraints**:
- FK `vmi_order_id` → `vmi_orders.id` (CASCADE DELETE)
- FK `item_id` → `items.id`

### 6. Extend `vmi_transactions` Table

Add fields for detailed API logging:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `request_payload` | TEXT | No | - | JSON request body |
| `response_payload` | TEXT | No | - | JSON response body |
| `http_status` | INT | No | - | HTTP status code |
| `duration_ms` | INT | No | - | Request duration in ms |
| `endpoint` | VARCHAR(255) | No | - | API endpoint called |
| `method` | VARCHAR(10) | No | - | HTTP method |

## State Transitions

### VMI Order Status

```
   ┌──────────┐
   │  draft   │ (not visible to vendor)
   └────┬─────┘
        │ hospital submits
        ▼
   ┌──────────┐
   │submitted │ ← Order appears in vendor polling
   └────┬─────┘
        │ vendor confirms (PATCH action=confirm)
        ▼
   ┌──────────┐
   │confirmed │ ← Local PO created
   └────┬─────┘
        │ vendor ships (PATCH action=ship)
        ▼
   ┌──────────┐
   │ shipped  │
   └────┬─────┘
        │ hospital receives goods
        ▼
   ┌──────────┐
   │ received │ (final)
   └──────────┘

   Any state except received can transition to:
   ┌──────────┐
   │cancelled │ (final)
   └──────────┘
```

### Sync Status

```
   ┌─────────┐
   │ pending │ ← Initial state, data changed
   └────┬────┘
        │ sync triggered
        ▼
   ┌─────────┐
   │ syncing │ ← In progress
   └────┬────┘
        │
   ┌────┴────┐
   ▼         ▼
┌──────┐  ┌───────┐
│synced│  │ error │ ← Retry on next sync
└──────┘  └───────┘
```

## Indexes

### Performance Indexes

```sql
-- vmi_vendor_config
CREATE INDEX idx_vmi_vendor_config_vendor ON vmi_vendor_config(vendor_id);

-- vmi_price_offers
CREATE INDEX idx_vmi_price_offers_vendor ON vmi_price_offers(vendor_id);
CREATE INDEX idx_vmi_price_offers_item ON vmi_price_offers(item_id);
CREATE INDEX idx_vmi_price_offers_effective ON vmi_price_offers(effective_date, expiry_date);
CREATE INDEX idx_vmi_price_offers_sync ON vmi_price_offers(sync_status, last_synced_at);

-- vmi_orders
CREATE INDEX idx_vmi_orders_vendor ON vmi_orders(vendor_id);
CREATE INDEX idx_vmi_orders_status ON vmi_orders(status);
CREATE INDEX idx_vmi_orders_date ON vmi_orders(order_date);
CREATE INDEX idx_vmi_orders_vmi_id ON vmi_orders(vmi_order_id);

-- vmi_order_lines
CREATE INDEX idx_vmi_order_lines_order ON vmi_order_lines(vmi_order_id);
CREATE INDEX idx_vmi_order_lines_item ON vmi_order_lines(item_id);

-- vmi_transactions (existing + new)
CREATE INDEX idx_vmi_transactions_vendor_date ON vmi_transactions(vendor_id, created_at);
CREATE INDEX idx_vmi_transactions_status ON vmi_transactions(status);
CREATE INDEX idx_vmi_transactions_type ON vmi_transactions(transaction_type);

-- items (new fields)
CREATE INDEX idx_items_tpp ON items(tpp_code) WHERE tpp_code IS NOT NULL;
CREATE INDEX idx_items_ttmt ON items(ttmt_code) WHERE ttmt_code IS NOT NULL;
```

## Validation Rules

### Item Standard Codes
- `tpp_code`: `/^[0-9]{13}$/` (exactly 13 digits)
- `ttmt_code`: `/^A[0-9]{8}$/` (A followed by exactly 8 digits)
- At least one code required for VMI sync

### API Key
- Non-empty string
- Encrypted before storage

### Price Offers
- `unit_price` > 0
- `pack_price` > 0 if provided
- `effective_date` <= `expiry_date` if both provided
- `moq` >= 1 if provided

### Orders
- `status` must follow valid transition rules
- `quantity_ordered` > 0
- `unit_price` >= 0

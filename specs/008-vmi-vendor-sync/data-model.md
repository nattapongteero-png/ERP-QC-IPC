# Data Model: VMI Vendor Sync (Correction)

**Feature Branch**: `008-vmi-vendor-sync`
**Created**: 2025-12-21
**Status**: Complete

## Overview

This document defines the data model changes for the corrected VMI integration where this ERP operates as a **vendor/supplier** to external VMI portals.

---

## Entity Relationship Diagram

```
┌─────────────────────────┐
│   vmi_portal_config     │
│─────────────────────────│
│ id (PK)                 │
│ name                    │
│ portal_url              │
│ api_key_encrypted       │
│ vendor_id               │
│ is_enabled              │
│ sync_*_enabled          │
│ last_*_sync_at          │
│ connection_status       │
└──────────┬──────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────┐
│   vmi_sync_history      │
│─────────────────────────│
│ id (PK)                 │
│ portal_id (FK)          │◄───────────────────────────────┐
│ sync_type               │                                │
│ status                  │                                │
│ items_processed         │                                │
│ items_failed            │                                │
│ error_details           │                                │
│ started_at              │                                │
│ completed_at            │                                │
└─────────────────────────┘                                │
                                                           │
┌─────────────────────────┐                                │
│   vmi_sales_orders      │                                │
│─────────────────────────│                                │
│ id (PK)                 │                                │
│ portal_id (FK)          │────────────────────────────────┘
│ vmi_order_id            │
│ sales_order_id (FK)     │────────► sales_orders
│ customer_id (FK)        │────────► customers
│ vmi_status              │
│ vmi_customer_id         │
│ vmi_customer_name       │
│ order_data_json         │
│ polled_at               │
│ confirmed_at            │
│ shipped_at              │
│ delivered_at            │
└──────────┬──────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────┐
│  vmi_sales_order_lines  │
│─────────────────────────│
│ id (PK)                 │
│ vmi_sales_order_id (FK) │
│ item_id (FK)            │────────► items
│ vmi_line_id             │
│ tpp_code                │
│ ttmt_code               │
│ quantity                │
│ unit_price              │
│ line_total              │
└─────────────────────────┘


Existing Tables (Modified):
┌─────────────────────────┐       ┌─────────────────────────┐
│       customers         │       │         items           │
│─────────────────────────│       │─────────────────────────│
│ id (PK)                 │       │ id (PK)                 │
│ code                    │       │ code                    │
│ name                    │       │ name_th                 │
│ ...                     │       │ tpp_code                │ ◄── Used for VMI sync
│ vmi_customer_id (NEW)   │       │ ttmt_code               │ ◄── Used for VMI sync
│ vmi_portal_id (NEW)     │       │ vmi_sync_enabled (NEW)  │ ◄── Flag for sync
└─────────────────────────┘       │ last_vmi_sync_at (NEW)  │
                                  └─────────────────────────┘
```

---

## New Tables

### 1. vmi_portal_config

Stores configuration for each VMI portal connection.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | No | AUTO | Primary key |
| name | VARCHAR(100) | No | - | Display name (e.g., "Hospital A Portal") |
| portal_url | VARCHAR(255) | No | - | Base URL of VMI Portal API |
| api_key_encrypted | TEXT | No | - | Encrypted API key (AES-256-GCM) |
| vendor_id | VARCHAR(50) | No | - | Our vendor ID in this portal |
| is_enabled | BOOLEAN | No | true | Master enable/disable toggle |
| sync_inventory_enabled | BOOLEAN | No | true | Enable inventory sync |
| sync_inventory_interval | INTEGER | No | 60 | Inventory sync interval (minutes) |
| sync_items_enabled | BOOLEAN | No | true | Enable item catalog sync |
| sync_items_interval | INTEGER | No | 1440 | Item sync interval (minutes, default 24h) |
| sync_prices_enabled | BOOLEAN | No | true | Enable price sync |
| sync_prices_interval | INTEGER | No | 1440 | Price sync interval (minutes, default 24h) |
| order_polling_enabled | BOOLEAN | No | true | Enable order polling |
| order_polling_interval | INTEGER | No | 15 | Order polling interval (minutes) |
| last_inventory_sync_at | DATETIME | Yes | NULL | Last successful inventory sync |
| last_items_sync_at | DATETIME | Yes | NULL | Last successful items sync |
| last_prices_sync_at | DATETIME | Yes | NULL | Last successful prices sync |
| last_orders_poll_at | DATETIME | Yes | NULL | Last successful order poll |
| connection_status | ENUM | No | 'disconnected' | 'connected' / 'disconnected' / 'error' |
| last_error_message | TEXT | Yes | NULL | Last error message if status is 'error' |
| created_by | INTEGER | Yes | NULL | FK to users.id |
| updated_by | INTEGER | Yes | NULL | FK to users.id |
| created_at | DATETIME | No | NOW() | Creation timestamp |
| updated_at | DATETIME | No | NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY (id)
- UNIQUE (name)
- INDEX (is_enabled, connection_status)

**Drizzle Schema (SQLite)**:
```typescript
export const sqliteVmiPortalConfig = sqliteTable('vmi_portal_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  portalUrl: text('portal_url').notNull(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  vendorId: text('vendor_id').notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  syncInventoryEnabled: integer('sync_inventory_enabled', { mode: 'boolean' }).notNull().default(true),
  syncInventoryInterval: integer('sync_inventory_interval').notNull().default(60),
  syncItemsEnabled: integer('sync_items_enabled', { mode: 'boolean' }).notNull().default(true),
  syncItemsInterval: integer('sync_items_interval').notNull().default(1440),
  syncPricesEnabled: integer('sync_prices_enabled', { mode: 'boolean' }).notNull().default(true),
  syncPricesInterval: integer('sync_prices_interval').notNull().default(1440),
  orderPollingEnabled: integer('order_polling_enabled', { mode: 'boolean' }).notNull().default(true),
  orderPollingInterval: integer('order_polling_interval').notNull().default(15),
  lastInventorySyncAt: text('last_inventory_sync_at'),
  lastItemsSyncAt: text('last_items_sync_at'),
  lastPricesSyncAt: text('last_prices_sync_at'),
  lastOrdersPollAt: text('last_orders_poll_at'),
  connectionStatus: text('connection_status').notNull().default('disconnected'),
  lastErrorMessage: text('last_error_message'),
  createdBy: integer('created_by').references(() => sqliteUsers.id),
  updatedBy: integer('updated_by').references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

---

### 2. vmi_sync_history

Tracks history of all sync operations for auditing and troubleshooting.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | No | AUTO | Primary key |
| portal_id | INTEGER | No | - | FK to vmi_portal_config.id |
| sync_type | ENUM | No | - | 'inventory' / 'items' / 'prices' / 'orders' |
| trigger_type | ENUM | No | - | 'manual' / 'scheduled' / 'threshold' |
| status | ENUM | No | - | 'running' / 'completed' / 'failed' / 'partial' |
| items_total | INTEGER | No | 0 | Total items to sync |
| items_processed | INTEGER | No | 0 | Successfully synced items |
| items_failed | INTEGER | No | 0 | Failed items |
| error_details | JSON | Yes | NULL | Array of {itemId, error} for failed items |
| triggered_by | INTEGER | Yes | NULL | FK to users.id (null for scheduled) |
| started_at | DATETIME | No | NOW() | Start timestamp |
| completed_at | DATETIME | Yes | NULL | Completion timestamp |

**Indexes**:
- PRIMARY KEY (id)
- INDEX (portal_id, sync_type)
- INDEX (status, started_at)

---

### 3. vmi_sales_orders

Links VMI orders from portal to local sales orders.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | No | AUTO | Primary key |
| portal_id | INTEGER | No | - | FK to vmi_portal_config.id |
| vmi_order_id | VARCHAR(50) | No | - | Order ID from VMI Portal |
| sales_order_id | INTEGER | Yes | NULL | FK to sales_orders.id (created on confirmation) |
| customer_id | INTEGER | Yes | NULL | FK to customers.id (matched or created) |
| vmi_status | ENUM | No | - | Status from VMI Portal |
| local_status | ENUM | No | 'pending' | Local processing status |
| vmi_customer_id | VARCHAR(50) | No | - | Customer ID from VMI Portal |
| vmi_customer_name | VARCHAR(200) | No | - | Customer name from VMI Portal |
| order_date | DATE | No | - | Order date from VMI |
| required_date | DATE | Yes | NULL | Required delivery date |
| total_amount | DECIMAL(15,2) | No | - | Total order amount |
| currency | VARCHAR(3) | No | 'THB' | Currency code |
| order_data_json | JSON | No | - | Full order data from VMI Portal |
| polled_at | DATETIME | No | NOW() | When order was first polled |
| confirmed_at | DATETIME | Yes | NULL | When confirmed in VMI Portal |
| shipped_at | DATETIME | Yes | NULL | When shipped |
| delivered_at | DATETIME | Yes | NULL | When delivery confirmed |
| created_at | DATETIME | No | NOW() | Creation timestamp |
| updated_at | DATETIME | No | NOW() | Last update timestamp |

**Constraints**:
- UNIQUE (portal_id, vmi_order_id)

**Indexes**:
- PRIMARY KEY (id)
- INDEX (portal_id, vmi_status)
- INDEX (local_status)
- INDEX (customer_id)
- INDEX (sales_order_id)

**Enums**:
```typescript
// VMI Portal status values
type VmiOrderStatus = 'draft' | 'submitted' | 'confirmed' | 'shipped' | 'received' | 'cancelled';

// Local processing status
type LocalOrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
```

---

### 4. vmi_sales_order_lines

Line items for VMI sales orders.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | No | AUTO | Primary key |
| vmi_sales_order_id | INTEGER | No | - | FK to vmi_sales_orders.id |
| item_id | INTEGER | Yes | NULL | FK to items.id (matched) |
| vmi_line_id | VARCHAR(50) | No | - | Line ID from VMI Portal |
| tpp_code | VARCHAR(20) | Yes | NULL | TPP code from order |
| ttmt_code | VARCHAR(20) | Yes | NULL | TTMT code from order |
| local_code | VARCHAR(50) | Yes | NULL | Our item code (if matched) |
| item_name | VARCHAR(200) | No | - | Item name from VMI |
| quantity | DECIMAL(15,3) | No | - | Ordered quantity |
| unit | VARCHAR(20) | No | - | Unit of measure |
| unit_price | DECIMAL(15,2) | No | - | Price per unit |
| line_total | DECIMAL(15,2) | No | - | Line total (qty * price) |
| match_status | ENUM | No | 'unmatched' | Item matching status |

**Indexes**:
- PRIMARY KEY (id)
- INDEX (vmi_sales_order_id)
- INDEX (item_id)
- INDEX (tpp_code)
- INDEX (ttmt_code)

**Enums**:
```typescript
type ItemMatchStatus = 'unmatched' | 'matched' | 'multiple_matches' | 'manual_mapped';
```

---

## Modified Existing Tables

### 1. customers (Extended)

Add fields to track VMI portal customer mapping.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| vmi_customer_id | VARCHAR(50) | Yes | NULL | Customer ID from VMI Portal |
| vmi_portal_id | INTEGER | Yes | NULL | FK to vmi_portal_config.id |

**Note**: A customer may be linked to only one VMI portal. If the same hospital uses multiple portals, they would be separate customer records.

---

### 2. items (Extended)

Add fields to control VMI sync behavior.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| vmi_sync_enabled | BOOLEAN | No | false | Include in VMI sync |
| last_vmi_sync_at | DATETIME | Yes | NULL | Last sync to any VMI portal |

**Note**: `tpp_code` and `ttmt_code` already exist from previous implementation.

---

### 3. sales_orders (Extended)

Add field to track VMI origin.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| vmi_sales_order_id | INTEGER | Yes | NULL | FK to vmi_sales_orders.id |
| source | ENUM | No | 'direct' | 'direct' / 'vmi' / 'api' |

---

## Validation Rules

### vmi_portal_config

1. `name` must be unique
2. `portal_url` must be valid HTTPS URL
3. `api_key_encrypted` must be valid ciphertext (isValidCiphertext check)
4. `vendor_id` must be non-empty
5. Interval fields must be >= 1 minute

### vmi_sales_orders

1. `vmi_order_id` must be unique per portal
2. `total_amount` must equal sum of line totals
3. Cannot transition to 'delivered' without 'shipped' first

### vmi_sales_order_lines

1. Must have either `tpp_code` or `ttmt_code` (or both)
2. `quantity` must be > 0
3. `line_total` must equal `quantity * unit_price`

---

## State Transitions

### VMI Order Status

```
                         ┌──────────────┐
                         │  submitted   │  (polled from portal)
                         └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
            ┌───────────┐ ┌───────────┐ ┌───────────┐
            │ cancelled │ │ confirmed │ │  pending  │
            └───────────┘ └─────┬─────┘ └───────────┘
                                │
                                ▼
                        ┌───────────┐
                        │  shipped  │
                        └─────┬─────┘
                              │
                              ▼
                        ┌───────────┐
                        │ received  │
                        └───────────┘
```

### Connection Status

```
    ┌──────────────┐
    │ disconnected │ ◄──────────────────┐
    └──────┬───────┘                    │
           │ test connection            │ test fails
           ▼                            │
    ┌───────────┐                       │
    │ connected │ ──── API error ──────►│
    └───────────┘                       │
           │                            │
           │ repeated errors            │
           ▼                            │
    ┌───────────┐                       │
    │   error   │ ──────────────────────┘
    └───────────┘     manual reset
```

---

## Migration Strategy

### Phase 1: Add New Tables

1. Create `vmi_portal_config` table
2. Create `vmi_sync_history` table
3. Create `vmi_sales_orders` table
4. Create `vmi_sales_order_lines` table

### Phase 2: Extend Existing Tables

1. Add `vmi_customer_id`, `vmi_portal_id` to `customers`
2. Add `vmi_sync_enabled`, `last_vmi_sync_at` to `items`
3. Add `vmi_sales_order_id`, `source` to `sales_orders`

### Phase 3: Data Migration (if needed)

No data migration from 006 required - that implementation was for wrong use case.

---

## Index Strategy

### Query Patterns

| Query | Tables | Index |
|-------|--------|-------|
| List enabled portals | vmi_portal_config | (is_enabled, connection_status) |
| Get items for sync | items | (vmi_sync_enabled, tpp_code, ttmt_code) |
| Find orders by status | vmi_sales_orders | (portal_id, vmi_status) |
| Match customer | customers | (vmi_customer_id, vmi_portal_id) |
| Get order lines | vmi_sales_order_lines | (vmi_sales_order_id) |
| Find unmatched lines | vmi_sales_order_lines | (match_status) |

---

## Security Considerations

1. **API Keys**: Encrypted at rest using AES-256-GCM
2. **Audit Trail**: All portal config changes logged via `createAuditLog`
3. **Access Control**: Permission checks on all operations
4. **PII**: Customer names stored in `vmi_sales_orders` - follow data retention policies

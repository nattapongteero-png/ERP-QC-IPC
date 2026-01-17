# Data Model: Unit Cost Calculation System

**Feature Branch**: `014-unit-cost`
**Date**: 2026-01-15
**Status**: Design Complete

---

## Overview

This document defines the data model for the Unit Cost Calculation System. It includes 8 new tables and modifications to 3 existing tables.

---

## Entity Relationship Diagram

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│      items      │────<│   item_cost_layers   │     │    work_centers     │
│  (existing)     │     │       (NEW)          │     │        (NEW)        │
│  +currentWAC    │     │                      │     │ +laborRatePerHour   │
│  +lastPurchase  │     │  transactionType     │     │ +overheadRatePerHour│
│  +lastProduction│     │  quantity, unitCost  │     │ +machineRatePerHour │
│  +sgaAllocation │     │  runningWAC          │     └─────────┬───────────┘
└────────┬────────┘     └──────────────────────┘               │
         │                                                      │
         │              ┌──────────────────────┐               │
         │              │   overhead_rates     │───────────────┘
         │              │        (NEW)         │
         │              │ allocationBasis      │
         │              │ ratePerUnit          │
         │              └──────────────────────┘
         │
         │ ┌──────────────────────────────────────────────────────────────┐
         │ │                    LANDED COST FLOW                          │
         │ └──────────────────────────────────────────────────────────────┘
         │
         │              ┌──────────────────────┐
         └─────────────<│landed_cost_allocations│
                        │        (NEW)         │
                        │ allocatedAmount      │
                        └──────────┬───────────┘
                                   │
                        ┌──────────┴───────────┐
                        │  landed_cost_lines   │
                        │        (NEW)         │
                        │ costType, amount     │
                        │ allocationBasis      │
                        └──────────┬───────────┘
                                   │
                        ┌──────────┴───────────┐
                        │ landed_cost_headers  │
                        │        (NEW)         │
                        │ status: draft→posted │
                        └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION COST FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   work_orders   │────<│work_order_operations │     │  work_order_costs   │
│   (existing)    │     │        (NEW)         │────>│       (NEW)         │
│                 │     │ actualHours          │     │ materialCost        │
│                 │     │ laborCost            │     │ laborCost           │
│                 │     │ overheadCost         │     │ overheadCost        │
└─────────────────┘     └──────────────────────┘     │ unitCost            │
                                                      └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         GL INTEGRATION                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   cost_gl_mapping   │
│        (NEW)        │
│ transactionType     │────> gl_accounts (existing)
│ debitAccountId      │
│ creditAccountId     │
└─────────────────────┘
```

---

## New Tables

### 1. work_centers

Production locations with cost rates for labor and overhead allocation.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Primary key |
| code | string(20) | unique, not null | Work center code (e.g., "WC-001") |
| name | string(100) | not null | English name |
| nameTh | string(100) | nullable | Thai name |
| orgUnitId | integer | FK → hr_org_units | Cost center linkage |
| laborRatePerHour | decimal(15,4) | not null, default 0 | Standard labor rate (THB) |
| overheadRatePerHour | decimal(15,4) | not null, default 0 | Allocated overhead rate (THB) |
| machineRatePerHour | decimal(15,4) | not null, default 0 | Equipment depreciation rate (THB) |
| capacityHoursPerDay | decimal(10,2) | nullable | Available production hours |
| isActive | boolean | not null, default true | Active flag |
| createdAt | datetime | not null | Creation timestamp |
| updatedAt | datetime | not null | Last update timestamp |

**Indexes**: `code` (unique)

**Relationships**:
- References `hr_org_units.id` for cost center rollup
- Referenced by `work_order_operations.workCenterId`
- Referenced by `overhead_rates.workCenterId`

---

### 2. item_cost_layers

Audit trail for WAC calculations, recording every cost-affecting transaction.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Primary key |
| itemId | integer | FK → items, not null | Item reference |
| transactionType | enum | not null | 'receipt', 'landed_cost', 'adjustment', 'return' |
| transactionId | integer | not null | Reference to source document |
| transactionDate | date | not null | Transaction date |
| quantityIn | decimal(15,4) | not null | Quantity added (negative for adjustments/returns) |
| unitCost | decimal(15,4) | not null | Cost per unit for this transaction |
| totalCost | decimal(15,4) | not null | quantityIn × unitCost |
| runningQty | decimal(15,4) | not null | On-hand quantity after transaction |
| runningTotalCost | decimal(15,4) | not null | Total inventory value after |
| runningWAC | decimal(15,4) | not null | WAC after this transaction |
| notes | text | nullable | Additional notes |
| createdBy | integer | FK → hr_employees | User who created |
| createdAt | datetime | not null | Creation timestamp |

**Indexes**:
- `(itemId, transactionDate)` - cost history queries
- `(transactionType, transactionId)` - source document lookup

**Relationships**:
- References `items.id`
- References `hr_employees.id`

**Validation Rules**:
- `quantityIn` can be negative for returns/adjustments
- `runningQty` must be >= 0 (enforced at service layer)
- `runningWAC` must be > 0 when `runningQty` > 0

---

### 3. landed_cost_headers

Header for landed cost documents (freight, duty, insurance allocations).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Primary key |
| documentNumber | string(30) | unique, not null | Document number (e.g., "LC-2026-0001") |
| referenceType | enum | not null | 'po', 'shipment' |
| referenceId | integer | not null | PO ID or shipment ID |
| vendorId | integer | FK → vendors, nullable | Freight forwarder/customs broker |
| invoiceNumber | string(50) | nullable | Vendor invoice number |
| invoiceDate | date | nullable | Invoice date |
| totalAmount | decimal(15,2) | not null | Total landed cost amount |
| currency | string(3) | not null, default 'THB' | Currency code |
| exchangeRate | decimal(10,6) | not null, default 1 | Exchange rate to THB |
| status | enum | not null, default 'draft' | 'draft', 'allocated', 'posted' |
| postedAt | datetime | nullable | Posting timestamp |
| postedBy | integer | FK → hr_employees, nullable | User who posted |
| createdBy | integer | FK → hr_employees | User who created |
| createdAt | datetime | not null | Creation timestamp |
| updatedAt | datetime | not null | Last update timestamp |

**Indexes**:
- `documentNumber` (unique)
- `(referenceType, referenceId)` - PO/shipment lookup
- `status` - list filtering

**State Transitions**:
```
draft → allocated → posted
  │         │
  └─────────┘ (can revert to draft before posting)
```

---

### 4. landed_cost_lines

Detail lines for each cost type in a landed cost document.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Primary key |
| landedCostHeaderId | integer | FK → landed_cost_headers, not null | Header reference |
| costType | enum | not null | 'freight', 'duty', 'insurance', 'handling', 'inspection', 'other' |
| description | string(200) | nullable | Cost description |
| amount | decimal(15,2) | not null | Cost amount |
| allocationBasis | enum | not null, default 'value' | 'value', 'quantity', 'weight', 'volume' |
| createdAt | datetime | not null | Creation timestamp |

**Indexes**: `landedCostHeaderId`

**Relationships**:
- References `landed_cost_headers.id` (cascade delete)

---

### 5. landed_cost_allocations

Allocation of landed costs to specific items/lots.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Primary key |
| landedCostLineId | integer | FK → landed_cost_lines, not null | Line reference |
| landedCostHeaderId | integer | FK → landed_cost_headers, not null | Header (denormalized) |
| itemId | integer | FK → items, not null | Item receiving allocation |
| lotId | integer | FK → inventory_lots, nullable | Lot-level tracking |
| poLineId | integer | FK → purchase_order_lines, nullable | PO line reference |
| allocatedAmount | decimal(15,4) | not null | Amount allocated to this item |
| basisValue | decimal(15,4) | not null | Value used for calculation |
| createdAt | datetime | not null | Creation timestamp |

**Indexes**:
- `landedCostHeaderId`
- `itemId`

**Relationships**:
- References `landed_cost_lines.id` (cascade delete)
- References `landed_cost_headers.id`
- References `items.id`
- References `inventory_lots.id`
- References `purchase_order_lines.id`

---

### 6. overhead_rates

Configuration for overhead allocation rates by work center or department.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Primary key |
| code | string(20) | unique, not null | Rate code |
| name | string(100) | not null | Rate name |
| orgUnitId | integer | FK → hr_org_units, nullable | Department/cost center |
| workCenterId | integer | FK → work_centers, nullable | Work center specific |
| overheadType | enum | not null | 'fixed', 'variable', 'mixed' |
| allocationBasis | enum | not null | 'labor_hours', 'machine_hours', 'units', 'direct_labor_cost' |
| ratePerUnit | decimal(15,4) | not null | Rate per allocation unit |
| effectiveFrom | date | not null | Start date |
| effectiveTo | date | nullable | End date (null = current) |
| glAccountId | integer | FK → gl_accounts, nullable | Overhead expense account |
| isActive | boolean | not null, default true | Active flag |
| createdAt | datetime | not null | Creation timestamp |
| updatedAt | datetime | not null | Last update timestamp |

**Indexes**:
- `code` (unique)
- `(workCenterId, effectiveFrom)` - rate lookup
- `effectiveTo` - current rate queries

---

### 7. work_order_operations

Track actual labor time per operation on a work order.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Primary key |
| workOrderId | integer | FK → work_orders, not null | Work order reference |
| operationId | integer | FK → operations, not null | BOM operation reference |
| workCenterId | integer | FK → work_centers, not null | Work center |
| sequence | integer | not null | Operation sequence |
| plannedHours | decimal(10,2) | not null, default 0 | From BOM standard time |
| actualHours | decimal(10,2) | nullable | Actual hours recorded |
| laborRate | decimal(15,4) | not null | Snapshot of rate at production |
| laborCost | decimal(15,4) | nullable | actualHours × laborRate |
| overheadRate | decimal(15,4) | not null | Snapshot of OH rate |
| overheadCost | decimal(15,4) | nullable | actualHours × overheadRate |
| startTime | datetime | nullable | Operation start |
| endTime | datetime | nullable | Operation end |
| operatorId | integer | FK → hr_employees, nullable | Operator |
| status | enum | not null, default 'pending' | 'pending', 'in_progress', 'completed', 'skipped' |
| notes | text | nullable | Notes |
| createdAt | datetime | not null | Creation timestamp |
| updatedAt | datetime | not null | Last update timestamp |

**Indexes**:
- `workOrderId`
- `(workOrderId, sequence)` - unique

---

### 8. work_order_costs

Aggregated cost summary per work order.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Primary key |
| workOrderId | integer | FK → work_orders, unique, not null | Work order reference |
| materialCost | decimal(15,4) | not null, default 0 | Sum of issued materials × WAC |
| laborCost | decimal(15,4) | not null, default 0 | Sum of operation labor costs |
| overheadCost | decimal(15,4) | not null, default 0 | Sum of operation overhead |
| totalCost | decimal(15,4) | not null, default 0 | Material + Labor + Overhead |
| producedQuantity | decimal(15,4) | nullable | Actual good output |
| unitCost | decimal(15,4) | nullable | totalCost ÷ producedQuantity |
| status | enum | not null, default 'in_progress' | 'in_progress', 'completed', 'adjusted' |
| completedAt | datetime | nullable | Completion timestamp |
| createdAt | datetime | not null | Creation timestamp |
| updatedAt | datetime | not null | Last update timestamp |

**Indexes**: `workOrderId` (unique)

---

### 9. cost_gl_mapping

Account mapping for automatic journal entry generation.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Primary key |
| transactionType | enum | not null | See transaction types below |
| itemType | enum | not null | 'raw_material', 'packaging', 'wip', 'finished_goods', 'consumable' |
| debitAccountId | integer | FK → gl_accounts, not null | Debit GL account |
| creditAccountId | integer | FK → gl_accounts, not null | Credit GL account |
| description | string(200) | nullable | Mapping description |
| isActive | boolean | not null, default true | Active flag |
| createdAt | datetime | not null | Creation timestamp |
| updatedAt | datetime | not null | Last update timestamp |

**Transaction Types**:
- `material_receipt` - PO receipt
- `landed_cost` - Landed cost posting
- `material_issue` - Issue to production
- `labor` - Labor cost recording
- `overhead` - Overhead allocation
- `fg_transfer` - Finished goods transfer
- `cogs` - Cost of goods sold
- `variance` - Cost variances

**Indexes**: `(transactionType, itemType)` (unique)

---

## Modifications to Existing Tables

### 1. items (add columns)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| currentWAC | decimal(15,4) | nullable | Current weighted average cost |
| lastPurchaseCost | decimal(15,4) | nullable | From most recent PO receipt |
| lastPurchaseDate | date | nullable | Date of last purchase |
| lastPurchasePoId | integer | FK → purchase_orders, nullable | Reference to PO |
| lastProductionCost | decimal(15,4) | nullable | From most recent completed WO |
| lastProductionDate | date | nullable | Date of last production |
| lastProductionWoId | integer | FK → work_orders, nullable | Reference to WO |
| sgaAllocationRate | decimal(5,2) | nullable, default 0 | SG&A % for full cost |

---

### 2. work_order_materials (add columns)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| unitCost | decimal(15,4) | nullable | WAC at time of issue |
| totalCost | decimal(15,4) | nullable | quantity × unitCost |
| costLayerId | integer | FK → item_cost_layers, nullable | Cost layer reference |

---

### 3. sales_order_lines (add columns)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| unitCost | decimal(15,4) | nullable | WAC at time of shipment |
| totalCost | decimal(15,4) | nullable | quantity × unitCost |
| marginAmount | decimal(15,4) | nullable | (unitPrice - unitCost) × qty |
| marginPercent | decimal(5,2) | nullable | margin ÷ revenue × 100 |

---

## Validation Rules Summary

### Cost Calculations
1. WAC must be > 0 when on-hand quantity > 0
2. WAC calculation uses 4 decimal precision
3. Running quantity in cost layers must be >= 0
4. Total cost = quantity × unit cost (validated)

### Landed Cost
1. Total allocations must equal line amount
2. Allocation basis values must be > 0 for allocation to work
3. Can only post when status = 'allocated' and allocations complete
4. Cannot modify after posting

### Work Orders
1. Actual hours cannot be negative
2. Labor cost = actual hours × labor rate
3. Overhead cost = actual hours × overhead rate
4. Unit cost = total cost ÷ produced quantity (when > 0)

### GL Mapping
1. Debit and credit accounts must differ
2. Transaction type + item type combination is unique
3. Only active mappings used for journal generation

---

## Indexes Summary

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| work_centers | work_centers_code | code (unique) | Code lookup |
| item_cost_layers | item_cost_layers_item_date | (itemId, transactionDate) | Cost history |
| item_cost_layers | item_cost_layers_txn | (transactionType, transactionId) | Source lookup |
| landed_cost_headers | landed_cost_headers_docnum | documentNumber (unique) | Doc lookup |
| landed_cost_headers | landed_cost_headers_ref | (referenceType, referenceId) | PO lookup |
| overhead_rates | overhead_rates_wc_date | (workCenterId, effectiveFrom) | Rate lookup |
| work_order_operations | work_order_ops_wo_seq | (workOrderId, sequence) (unique) | Op ordering |
| work_order_costs | work_order_costs_wo | workOrderId (unique) | Cost lookup |
| cost_gl_mapping | cost_gl_mapping_type | (transactionType, itemType) (unique) | Mapping lookup |

---

## Migration Notes

1. **Schema changes**: Add all new tables before modifying existing tables
2. **Default values**: Set `currentWAC = onHandCost / onHand` for existing items with inventory
3. **Backfill**: Do not create historical cost layers (start fresh from go-live)
4. **Work centers**: Require setup before production costing can function
5. **GL mapping**: Require configuration for auto-journal generation

---

## Drizzle ORM Implementation Notes

### Table Naming Convention
- SQLite: `sqliteWorkCenters`, `sqliteItemCostLayers`, etc.
- MySQL: `mysqlWorkCenters`, `mysqlItemCostLayers`, etc.

### Decimal Handling
- SQLite: Use `real` type (JavaScript handles precision)
- MySQL: Use `decimal(15,4)` for costs, `decimal(10,2)` for hours/rates

### Enum Types
- SQLite: Use `text` with application-level validation
- MySQL: Use native `enum` or `varchar` with check constraints

### Foreign Keys
- Both databases support foreign keys
- Use Drizzle's `.references()` for declaration
- Cascading deletes where appropriate (cost lines → allocations)

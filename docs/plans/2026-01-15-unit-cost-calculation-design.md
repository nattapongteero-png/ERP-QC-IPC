# Unit Cost Calculation System Design

**Date:** 2026-01-15
**Status:** Draft
**Author:** AI-assisted design session

## 1. Overview

This document describes the design for a comprehensive unit cost calculation system for the Herbal Medicine ERP. The system enables accurate product costing for financial reporting, pricing decisions, production efficiency analysis, and management reporting.

### 1.1 Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Inventory Costing Method | Weighted Average Cost (WAC) | Simple, widely accepted in Thailand, aligns with existing approach |
| Cost Components | Full Absorption Costing | GAAP/TFRS compliant, includes Material + Labor + Overhead |
| Overhead Allocation Basis | Direct Labor Hours | Aligns with labor-intensive herbal manufacturing |
| Landed Cost | Full Tracking | Accurate material cost including freight, duty, insurance, handling |
| Cost Views | Multiple (5 types) | Different stakeholders need different cost perspectives |

### 1.2 Cost Views Supported

1. **Inventory Cost (WAC)** - For balance sheet valuation and COGS
2. **Standard Cost** - For budgeting and variance analysis
3. **Last Purchase Cost** - For purchasing decisions
4. **Production Cost** - Actual cost per batch
5. **Full Cost** - Including SG&A allocation for pricing decisions

---

## 2. Architecture

### 2.1 Cost Engine Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        COST ENGINE                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ WAC Calculator│  │ Landed Cost  │  │ Production   │          │
│  │ (on receipt)  │  │ Allocator    │  │ Cost Aggregator│        │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Labor Rate   │  │ Overhead     │  │ Cost View    │          │
│  │ Engine       │  │ Allocator    │  │ Generator    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│                     INTEGRATION POINTS                           │
│  Purchasing → Inventory → Production → Sales → Accounting        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Triggers

| Event | Cost Engine Action |
|-------|-------------------|
| PO Receipt | Capture landed cost → Recalculate WAC |
| Material Issue | Use current WAC → Record to WIP |
| Work Order Complete | Aggregate costs → Calculate batch unit cost |
| Sales Shipment | Calculate COGS using WAC |

---

## 3. Data Model

### 3.1 New Tables Required

#### 3.1.1 Work Centers (work_centers)

Missing table that is referenced by `operations.workCenterId`.

```typescript
work_centers {
  id: number (PK, auto-increment)
  code: string (unique, not null)
  name: string (not null)
  nameTh: string
  orgUnitId: number (FK to hr_org_units) // Cost center linkage
  laborRatePerHour: decimal(15,4)        // Standard labor rate
  overheadRatePerHour: decimal(15,4)     // Allocated OH rate
  machineRatePerHour: decimal(15,4)      // Equipment depreciation rate
  capacityHoursPerDay: decimal(10,2)     // Available hours
  isActive: boolean (default true)
  createdAt: datetime
  updatedAt: datetime
}
```

#### 3.1.2 Item Cost Layers (item_cost_layers)

Audit trail for WAC calculations.

```typescript
item_cost_layers {
  id: number (PK, auto-increment)
  itemId: number (FK to items, not null)
  transactionType: enum('receipt', 'landed_cost', 'adjustment', 'return')
  transactionId: number               // Reference to source document
  transactionDate: date (not null)
  quantityIn: decimal(15,4)           // Qty added (can be negative for adjustments)
  unitCost: decimal(15,4)             // Cost per unit for this transaction
  totalCost: decimal(15,4)            // quantityIn × unitCost
  runningQty: decimal(15,4)           // On-hand qty after this transaction
  runningTotalCost: decimal(15,4)     // Total inventory value after
  runningWAC: decimal(15,4)           // WAC after this transaction
  notes: text
  createdBy: number (FK to hr_employees)
  createdAt: datetime
}

// Index on (itemId, transactionDate) for cost history queries
```

#### 3.1.3 Landed Cost Headers (landed_cost_headers)

```typescript
landed_cost_headers {
  id: number (PK, auto-increment)
  documentNumber: string (unique)
  referenceType: enum('po', 'shipment')
  referenceId: number                 // PO ID or shipment ID
  vendorId: number (FK to vendors)    // Freight forwarder, customs broker, etc.
  invoiceNumber: string
  invoiceDate: date
  totalAmount: decimal(15,2)
  currency: string (default 'THB')
  exchangeRate: decimal(10,6) (default 1)
  status: enum('draft', 'allocated', 'posted')
  postedAt: datetime
  postedBy: number (FK to hr_employees)
  createdAt: datetime
  updatedAt: datetime
}
```

#### 3.1.4 Landed Cost Lines (landed_cost_lines)

```typescript
landed_cost_lines {
  id: number (PK, auto-increment)
  landedCostHeaderId: number (FK, not null)
  costType: enum('freight', 'duty', 'insurance', 'handling', 'inspection', 'other')
  description: string
  amount: decimal(15,2) (not null)
  allocationBasis: enum('value', 'quantity', 'weight', 'volume')
  createdAt: datetime
}
```

#### 3.1.5 Landed Cost Allocations (landed_cost_allocations)

```typescript
landed_cost_allocations {
  id: number (PK, auto-increment)
  landedCostLineId: number (FK, not null)
  landedCostHeaderId: number (FK, not null) // Denormalized for query performance
  itemId: number (FK to items, not null)
  lotId: number (FK to inventory_lots)      // Optional, for lot-level tracking
  poLineId: number (FK to purchase_order_lines)
  allocatedAmount: decimal(15,4) (not null)
  basisValue: decimal(15,4)                 // Value used for allocation calculation
  createdAt: datetime
}
```

#### 3.1.6 Overhead Rates (overhead_rates)

```typescript
overhead_rates {
  id: number (PK, auto-increment)
  code: string (unique, not null)
  name: string (not null)
  orgUnitId: number (FK to hr_org_units)    // Department/cost center
  workCenterId: number (FK to work_centers) // Optional, for work center specific rates
  overheadType: enum('fixed', 'variable', 'mixed')
  allocationBasis: enum('labor_hours', 'machine_hours', 'units', 'direct_labor_cost')
  ratePerUnit: decimal(15,4) (not null)
  effectiveFrom: date (not null)
  effectiveTo: date
  glAccountId: number (FK to gl_accounts)   // OH expense account
  isActive: boolean (default true)
  createdAt: datetime
  updatedAt: datetime
}
```

#### 3.1.7 Work Order Operations (work_order_operations)

Track actual labor time per operation.

```typescript
work_order_operations {
  id: number (PK, auto-increment)
  workOrderId: number (FK to work_orders, not null)
  operationId: number (FK to operations, not null)
  workCenterId: number (FK to work_centers, not null)
  sequence: integer (not null)
  plannedHours: decimal(10,2)           // From BOM operation standardTime
  actualHours: decimal(10,2)
  laborRate: decimal(15,4)              // Snapshot of rate at time of production
  laborCost: decimal(15,4)              // actualHours × laborRate
  overheadRate: decimal(15,4)           // Snapshot of OH rate
  overheadCost: decimal(15,4)           // actualHours × overheadRate
  startTime: datetime
  endTime: datetime
  operatorId: number (FK to hr_employees)
  status: enum('pending', 'in_progress', 'completed', 'skipped')
  notes: text
  createdAt: datetime
  updatedAt: datetime
}
```

#### 3.1.8 Work Order Costs (work_order_costs)

Aggregated cost summary per work order.

```typescript
work_order_costs {
  id: number (PK, auto-increment)
  workOrderId: number (FK to work_orders, unique, not null)
  materialCost: decimal(15,4) (default 0)
  laborCost: decimal(15,4) (default 0)
  overheadCost: decimal(15,4) (default 0)
  totalCost: decimal(15,4) (default 0)
  producedQuantity: decimal(15,4)
  unitCost: decimal(15,4)               // totalCost ÷ producedQuantity
  status: enum('in_progress', 'completed', 'adjusted')
  completedAt: datetime
  createdAt: datetime
  updatedAt: datetime
}
```

#### 3.1.9 Cost GL Mapping (cost_gl_mapping)

Account mapping for automatic journal entry generation.

```typescript
cost_gl_mapping {
  id: number (PK, auto-increment)
  transactionType: enum('material_receipt', 'landed_cost', 'material_issue', 'labor', 'overhead', 'fg_transfer', 'cogs', 'variance')
  itemType: enum('raw_material', 'packaging', 'wip', 'finished_goods', 'consumable')
  debitAccountId: number (FK to gl_accounts, not null)
  creditAccountId: number (FK to gl_accounts, not null)
  description: string
  isActive: boolean (default true)
  createdAt: datetime
  updatedAt: datetime
}

// Unique constraint on (transactionType, itemType)
```

### 3.2 Modifications to Existing Tables

#### 3.2.1 Items Table - Add Cost Fields

```typescript
// Add to items table
currentWAC: decimal(15,4)              // Current weighted average cost
lastPurchaseCost: decimal(15,4)        // From most recent PO receipt
lastPurchaseDate: date
lastPurchasePoId: number               // Reference to PO
lastProductionCost: decimal(15,4)      // From most recent completed WO
lastProductionDate: date
lastProductionWoId: number             // Reference to WO
sgaAllocationRate: decimal(5,2)        // SG&A % for full cost calculation
```

#### 3.2.2 Work Order Materials - Add Cost Fields

```typescript
// Add to work_order_materials table
unitCost: decimal(15,4)                // WAC at time of issue
totalCost: decimal(15,4)               // quantity × unitCost
costLayerId: number                    // Reference to cost layer used
```

#### 3.2.3 Sales Order Lines - Add Cost Fields

```typescript
// Add to sales_order_lines table
unitCost: decimal(15,4)                // WAC at time of allocation/shipment
totalCost: decimal(15,4)               // quantity × unitCost
marginAmount: decimal(15,4)            // (unitPrice - unitCost) × quantity
marginPercent: decimal(5,2)            // margin ÷ revenue × 100
```

---

## 4. WAC Calculation Logic

### 4.1 Formula

```
New WAC = (Existing Total Cost + New Receipt Cost) / (Existing Qty + New Receipt Qty)
```

**Example:**
- Current: 100 units @ ฿50 WAC = ฿5,000 total
- Receipt: 50 units @ ฿60 = ฿3,000
- New WAC: (฿5,000 + ฿3,000) / (100 + 50) = ฿53.33

### 4.2 Recalculation Triggers

| Event | Action | WAC Impact |
|-------|--------|------------|
| PO Receipt | Add cost layer, recalculate WAC | Increases/decreases based on receipt cost |
| Landed Cost Posted | Add adjustment layer, recalculate WAC | Increases (additional cost allocated) |
| Inventory Adjustment (+) | Add cost layer at specified cost | Recalculated |
| Inventory Adjustment (-) | No WAC change | Cost flows out at current WAC |
| Material Issue | No WAC change | Uses current WAC for WIP |
| Return to Vendor | Reverse at original receipt cost | Recalculated |

### 4.3 Service Function

```typescript
interface RecalculateWACInput {
  itemId: number;
  transactionType: 'receipt' | 'landed_cost' | 'adjustment' | 'return';
  transactionId: number;
  quantity: number;        // Can be negative for returns/adjustments
  unitCost: number;
  transactionDate: Date;
  notes?: string;
  createdBy: number;
}

interface RecalculateWACResult {
  previousWAC: number;
  previousQty: number;
  previousTotalCost: number;
  newWAC: number;
  newQty: number;
  newTotalCost: number;
  costLayerId: number;
}

async function recalculateWAC(input: RecalculateWACInput): Promise<RecalculateWACResult>
```

### 4.4 Key Rules

1. **Never negative WAC** - System validates quantity can't go negative
2. **Zero quantity handling** - If on-hand = 0, next receipt sets WAC directly
3. **Audit trail** - Every WAC change recorded in `item_cost_layers`
4. **Retroactive blocked** - Landed costs must be posted before period close
5. **Decimal precision** - Use 4 decimal places for unit costs

---

## 5. Landed Cost Implementation

### 5.1 Workflow

```
PO Receipt (GRN created)
        ↓
Goods received at PO unit price
        ↓
WAC updated with PO price
        ↓
Landed cost invoice received (freight, duty, etc.)
        ↓
Create Landed Cost Header + Lines
        ↓
System calculates allocation per item
        ↓
Review & Approve allocation
        ↓
Post → Triggers WAC recalculation for each item
        ↓
Journal entry created (Dr. Inventory, Cr. AP)
```

### 5.2 Allocation Methods

| Basis | Formula | Best For |
|-------|---------|----------|
| **Value** | Item's PO value ÷ Total PO value × Cost | General purpose, most common |
| **Quantity** | Item qty ÷ Total qty × Cost | Similar-sized items |
| **Weight** | Item weight ÷ Total weight × Cost | Freight charges |
| **Volume** | Item volume ÷ Total volume × Cost | Bulky items, container shipping |

### 5.3 Allocation Example (Value-based)

```
PO #001 Total Value: ฿100,000
├── Item A: 100 units × ฿600 = ฿60,000 (60%)
└── Item B: 200 units × ฿200 = ฿40,000 (40%)

Landed Cost Invoice: ฿5,000 (freight)

Allocation:
├── Item A: ฿5,000 × 60% = ฿3,000 → ฿3,000 ÷ 100 units = ฿30/unit additional
└── Item B: ฿5,000 × 40% = ฿2,000 → ฿2,000 ÷ 200 units = ฿10/unit additional
```

### 5.4 Impact on WAC

When landed cost is posted, for each allocated item:

```typescript
await recalculateWAC({
  itemId: allocation.itemId,
  transactionType: 'landed_cost',
  transactionId: landedCostHeaderId,
  quantity: 0,                                    // No qty change
  unitCost: allocatedAmount,                      // Total cost addition
  transactionDate: postingDate
});
```

Special handling: When quantity = 0, the formula becomes:
```
New Total Cost = Old Total Cost + Allocated Amount
New WAC = New Total Cost / Existing Qty
```

---

## 6. Labor & Overhead Allocation

### 6.1 Labor Cost Calculation

```
Work Order Labor Cost = Σ (Operation Actual Hours × Work Center Labor Rate)
```

**Data Flow:**
1. Work order created from BOM
2. Operations copied to `work_order_operations` with planned hours
3. Production records actual hours per operation
4. On completion, labor cost calculated: `actualHours × laborRate`

### 6.2 Overhead Cost Calculation

Using Direct Labor Hours as basis:

```
Work Order Overhead Cost = Total Actual Labor Hours × Work Center Overhead Rate
```

**Alternative calculation (if using department-level rates):**
```
Overhead Cost = Σ (Operation Hours × Department Overhead Rate)
```

### 6.3 Production Cost Aggregation

```typescript
interface WorkOrderCostSummary {
  workOrderId: number;

  // Material Cost
  materialCost: number;           // Sum of issued materials × WAC at issue

  // Labor Cost
  totalLaborHours: number;
  laborCost: number;              // Sum of operation labor costs

  // Overhead Cost
  overheadCost: number;           // Total hours × OH rate

  // Totals
  totalCost: number;              // Material + Labor + Overhead
  producedQuantity: number;       // Actual good output
  unitCost: number;               // totalCost ÷ producedQuantity

  // Variance (if using standard costing)
  standardUnitCost?: number;
  varianceAmount?: number;
  variancePercent?: number;
}
```

### 6.4 Finished Goods Transfer

When work order is completed:
1. Calculate total WIP cost (material + labor + overhead)
2. Calculate unit cost: `totalCost ÷ producedQuantity`
3. Update finished goods item's `lastProductionCost`
4. Recalculate finished goods WAC
5. Create journal entry: Dr. Finished Goods, Cr. WIP

---

## 7. Multiple Cost Views

### 7.1 Cost View Definitions

| Cost View | Source | Calculation | Storage |
|-----------|--------|-------------|---------|
| **Inventory Cost (WAC)** | Cost layers | Running weighted average | `items.currentWAC` |
| **Standard Cost** | Manual setup | Defined per period | `standard_costs` table |
| **Last Purchase Cost** | PO receipts | Most recent receipt | `items.lastPurchaseCost` |
| **Last Production Cost** | Work orders | Most recent WO completion | `items.lastProductionCost` |
| **Full Cost** | Calculated | WAC + SG&A allocation | On-demand calculation |

### 7.2 Full Cost Calculation

```typescript
interface FullCostCalculation {
  itemId: number;
  inventoryCost: number;          // WAC
  sgaAllocationRate: number;      // % from item or category setting
  sgaAmount: number;              // WAC × sgaAllocationRate
  fullCost: number;               // WAC + sgaAmount
  targetMarginPercent: number;    // Configurable
  suggestedPrice: number;         // fullCost ÷ (1 - targetMargin%)
}
```

**Example:**
- WAC: ฿100
- SG&A Rate: 15%
- SG&A Amount: ฿15
- Full Cost: ฿115
- Target Margin: 30%
- Suggested Price: ฿115 ÷ (1 - 0.30) = ฿164.29

### 7.3 Cost View API

```typescript
interface ItemCostViews {
  itemId: number;
  itemCode: string;
  itemName: string;

  // Cost Views
  inventoryCost: number | null;         // WAC
  standardCost: number | null;          // Current standard
  lastPurchaseCost: number | null;
  lastPurchaseDate: Date | null;
  lastProductionCost: number | null;
  lastProductionDate: Date | null;
  fullCost: number | null;

  // Metadata
  onHandQty: number;
  onHandValue: number;                  // onHandQty × WAC

  // History
  costLayers: CostLayerSummary[];       // Recent transactions
}

async function getItemCostViews(itemId: number): Promise<ItemCostViews>
async function getItemsCostViews(filters: CostViewFilters): Promise<ItemCostViews[]>
```

---

## 8. Integration Points

### 8.1 End-to-End Cost Flow

```
PURCHASING          INVENTORY           PRODUCTION          SALES
┌─────────┐        ┌─────────┐         ┌─────────┐        ┌─────────┐
│PO Create│        │         │         │         │        │         │
│(no cost)│        │         │         │         │        │         │
└────┬────┘        │         │         │         │        │         │
     ↓             │         │         │         │        │         │
┌─────────┐        ┌─────────┐         │         │        │         │
│PO Receipt│──────▶│WAC Update│        │         │        │         │
│(GRN)    │        │Cost Layer│        │         │        │         │
└────┬────┘        └─────────┘         │         │        │         │
     ↓                  │              │         │        │         │
┌─────────┐             │              │         │        │         │
│Landed   │─────────────┘              │         │        │         │
│Cost Post│        ┌─────────┐         │         │        │         │
└─────────┘        │WAC Update│        │         │        │         │
                   └────┬────┘         │         │        │         │
                        │              │         │        │         │
                        ↓              ↓         │        │         │
                   ┌─────────┐    ┌─────────┐    │        │         │
                   │Material │───▶│WIP Cost │    │        │         │
                   │Issue    │    │(Material)│   │        │         │
                   └─────────┘    └────┬────┘    │        │         │
                                       │         │        │         │
                                       ↓         │        │         │
                                  ┌─────────┐    │        │         │
                                  │Labor    │────┘        │         │
                                  │Recording│             │         │
                                  └────┬────┘             │         │
                                       ↓                  │         │
                                  ┌─────────┐             │         │
                                  │OH Alloc │             │         │
                                  └────┬────┘             │         │
                                       ↓                  │         │
                                  ┌─────────┐        ┌─────────┐
                                  │WO Compl │───────▶│FG WAC   │
                                  │FG Txfer │        │Update   │
                                  └─────────┘        └────┬────┘
                                                          │
                                                          ↓
                                                     ┌─────────┐
                                                     │SO Ship  │
                                                     │COGS Calc│
                                                     └─────────┘
```

### 8.2 Transaction-Level Integration

| Transaction | Module | Cost Action | Journal Entry |
|-------------|--------|-------------|---------------|
| PO Receipt | Purchasing | Capture unit cost, create cost layer, update WAC | Dr. Inventory, Cr. GR/IR |
| Landed Cost | Purchasing | Allocate costs, create cost layers, update WAC | Dr. Inventory, Cr. AP |
| Material Issue | Production | Record WAC at issue time to WO materials | Dr. WIP, Cr. Raw Material |
| Labor Recording | Production | Calculate labor cost per operation | Dr. WIP, Cr. Wages Payable |
| OH Allocation | Production | Apply OH rate × hours to WO | Dr. WIP, Cr. OH Applied |
| WO Completion | Production | Sum costs, calculate unit cost, transfer FG | Dr. Finished Goods, Cr. WIP |
| Sales Shipment | Sales | Calculate COGS at current WAC | Dr. COGS, Cr. Finished Goods |
| Cost Variance | Accounting | Record standard vs actual variance | Dr/Cr Variance accounts |

### 8.3 Module Modifications Required

| Module | Changes |
|--------|---------|
| **Purchasing** | Add cost capture on GRN, landed cost management screens, cost display on PO |
| **Inventory** | Add cost layer viewer, WAC history, cost adjustment screen |
| **Production** | Add operation time entry, labor cost display, WO cost summary |
| **Sales** | Add COGS calculation on shipment, margin display on SO lines |
| **Accounting** | Auto-generate cost journal entries, cost variance posting |
| **Master Data** | Work center setup, overhead rate configuration, GL mapping |

---

## 9. Reports & Dashboards

### 9.1 Cost Reports

| Report | Purpose | Key Data |
|--------|---------|----------|
| **Item Cost Summary** | View all cost types per item | WAC, Standard, Last Purchase, Production, Full Cost |
| **Cost Movement Analysis** | Track cost changes over time | WAC trend by item, receipt costs, adjustments |
| **Landed Cost Report** | Analyze procurement true cost | PO cost vs total landed cost, % uplift by cost type |
| **Production Cost Report** | Batch-level cost breakdown | Material, Labor, OH per work order |
| **Variance Analysis** | Standard vs actual comparison | MPV, MUV, LRV, LEV, OH variances |
| **COGS Report** | Cost of goods sold analysis | COGS by product, period, customer |
| **Margin Analysis** | Profitability analysis | Revenue, COGS, Gross Margin %, contribution margin |

### 9.2 Cost Dashboard KPIs

```
┌─────────────────────────────────────────────────────────────────┐
│                    COST MANAGEMENT DASHBOARD                     │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Inventory Value │ Avg Material    │ Production Cost Trend       │
│ ฿ XX.XM        │ Cost Change     │ [Line Chart - 6 months]     │
│ (at WAC)       │ +X.X% MTD       │                             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ WIP Value      │ Gross Margin    │ Variance Summary            │
│ ฿ X.XM         │ XX.X%           │ Favorable: ฿XXK             │
│                │                 │ Unfavorable: ฿XXK           │
├─────────────────┴─────────────────┴─────────────────────────────┤
│ Top 5 Cost Increases (Items)    │ Top 5 Margin Erosion (SKUs) │
│ [Bar Chart]                      │ [Bar Chart]                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Drill-Down Capabilities

- **Item Cost** → Cost layers → Individual transactions (PO, landed cost, adjustment)
- **Work Order Cost** → Material + Labor + OH breakdown → Operation details
- **Variance** → By type → By item → Root cause transaction
- **Margin** → By product → By customer → By sales order line

---

## 10. Implementation Phases

### Phase 1: Foundation (Core Tables & WAC)
- Create work_centers table
- Create item_cost_layers table
- Implement WAC calculation service
- Modify PO receipt to capture costs
- Add cost fields to items table

### Phase 2: Landed Cost
- Create landed cost tables (headers, lines, allocations)
- Build landed cost entry UI
- Implement allocation algorithms
- Integrate with WAC recalculation

### Phase 3: Production Costing
- Create work_order_operations table
- Create work_order_costs table
- Build operation time entry UI
- Implement labor & OH allocation
- Calculate FG unit cost on WO completion

### Phase 4: Sales & COGS
- Add cost fields to sales_order_lines
- Implement COGS calculation on shipment
- Add margin display to sales UI
- Create margin reports

### Phase 5: Reporting & Analysis
- Build cost dashboard
- Create all cost reports
- Implement drill-down functionality
- Add variance analysis reports

### Phase 6: Accounting Integration
- Create cost_gl_mapping table
- Implement auto journal entry generation
- Add cost variance posting
- Period-end cost procedures

---

## 11. Appendix

### A. Existing Tables Referenced

- `items` - Item master (to be modified)
- `inventory_lots` - Lot tracking
- `inventory_transactions` - Movement audit
- `purchase_orders` / `purchase_order_lines` - PO data
- `work_orders` / `work_order_materials` - Production data
- `sales_orders` / `sales_order_lines` - Sales data
- `standard_costs` - Standard costing (exists)
- `variance_records` - Variance tracking (exists)
- `journal_entries` / `journal_lines` - Accounting entries
- `gl_accounts` - Chart of accounts
- `hr_org_units` - Cost centers

### B. Key Service Files to Create

```
src/lib/services/
├── cost/
│   ├── wac-calculator.service.ts
│   ├── landed-cost.service.ts
│   ├── production-cost.service.ts
│   ├── cost-views.service.ts
│   └── cogs.service.ts
```

### C. API Endpoints to Create

```
/api/cost/
├── items/[id]/cost-views          GET     - Get all cost views for item
├── items/[id]/cost-layers         GET     - Get cost layer history
├── landed-costs                   GET/POST - List/create landed costs
├── landed-costs/[id]              GET/PUT  - Get/update landed cost
├── landed-costs/[id]/allocate     POST    - Calculate allocations
├── landed-costs/[id]/post         POST    - Post and update WAC
├── work-orders/[id]/costs         GET     - Get WO cost breakdown
├── work-orders/[id]/operations    GET/PUT - Get/update operation times
├── reports/cost-summary           GET     - Item cost summary report
├── reports/margin-analysis        GET     - Margin analysis report
└── dashboard/cost-kpis            GET     - Dashboard KPIs
```

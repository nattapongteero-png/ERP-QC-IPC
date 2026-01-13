# Data Model: Workflow Test Page

**Feature**: 013-workflow-test | **Date**: 2026-01-01

## Overview

The workflow test feature executes 31 test steps across 8 phases. This data model defines the runtime state structures used during test execution. **No database schema changes required** - this feature uses in-memory state and existing ERP tables.

---

## Core Entities

### WorkflowTestSession

Represents a complete test execution session.

```typescript
interface WorkflowTestSession {
  id: string                    // UUID: "wftest-{timestamp}"
  status: WorkflowStatus        // 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
  startedAt: string | null      // ISO timestamp
  completedAt: string | null    // ISO timestamp
  totalDuration: number         // milliseconds
  phases: WorkflowPhase[]       // 8 phases
  currentPhase: number | null   // 1-8 or null
  currentStep: number | null    // 1-31 or null
  config: TestConfiguration     // User-configured parameters
  cleanup: CleanupStatus        // Cleanup result before test
  createdBy: number             // User ID who started test
}

type WorkflowStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
```

---

### WorkflowPhase

Logical grouping of related test steps.

```typescript
interface WorkflowPhase {
  id: number                    // 1-8
  name: string                  // e.g., "Master Data Setup"
  description: string           // Brief explanation
  status: PhaseStatus           // 'pending' | 'running' | 'passed' | 'failed'
  steps: WorkflowTestStep[]     // Steps in this phase
  stepCount: number             // Total steps
  completedCount: number        // Passed + Failed
  passedCount: number           // Green checkmarks
  failedCount: number           // Red X marks
  startedAt: string | null
  completedAt: string | null
  duration: number              // milliseconds
}

type PhaseStatus = 'pending' | 'running' | 'passed' | 'failed'
```

**Phase Definitions**:

| Phase | Name | Steps | Description |
|-------|------|-------|-------------|
| 1 | Master Data Setup | 1-4 | Warehouse, categories, items, HR |
| 2 | BOM & Production Planning | 5-6 | BOM creation, explosion |
| 3 | Purchasing Flow | 7-12 | Vendor, PR, PO, receive, QC |
| 4 | Production Flow | 13-19 | WO, line clearance, dispensing, production |
| 5 | Finished Goods QC | 20-21 | FG testing, release |
| 6 | Sales Flow | 22-25 | Customer, SO, pick/pack, ship |
| 7 | Accounting Verification | 26-29 | AP, AR, journal entries, 3-way match |
| 8 | VMI Integration | 30-31 | Inventory sync, order status |

---

### WorkflowTestStep

Individual test step with execution details.

```typescript
interface WorkflowTestStep {
  id: number                    // 1-31 (global)
  phaseId: number               // 1-8
  stepNumber: number            // Position within phase
  name: string                  // e.g., "Setup warehouse and storage locations"
  description: string           // Detailed description
  status: StepStatus            // 'pending' | 'running' | 'passed' | 'failed'
  startedAt: string | null
  completedAt: string | null
  duration: number              // milliseconds

  // API execution details
  apiCall: ApiCallDetails | null

  // Created entity references
  createdEntities: CreatedEntity[]

  // Error details if failed
  error: StepError | null

  // Live activity message
  activityMessage: string | null  // "Creating vendor record..."
}

type StepStatus = 'pending' | 'running' | 'passed' | 'failed'
```

---

### ApiCallDetails

Records the API request/response for each step.

```typescript
interface ApiCallDetails {
  endpoint: string              // e.g., "/api/warehouses"
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  requestPayload: Record<string, unknown> | null
  requestHeaders: Record<string, string>
  responseStatus: number        // HTTP status code
  responseBody: Record<string, unknown> | null
  responseTime: number          // milliseconds
}
```

---

### CreatedEntity

Tracks entities created by each step for linking and cleanup.

```typescript
interface CreatedEntity {
  entityType: string            // e.g., "warehouse", "item", "vendor"
  entityId: number              // Database ID
  entityCode: string            // Code/name for display
  viewUrl: string               // Link to view in ERP
}
```

---

### StepError

Detailed error information for failed steps.

```typescript
interface StepError {
  message: string               // Human-readable error
  code: string | null           // Error code if available
  endpoint: string              // Which API failed
  httpStatus: number            // HTTP status code
  responseBody: Record<string, unknown> | null
  stackTrace: string | null     // Development only
  timestamp: string             // When error occurred
}
```

---

### TestConfiguration

User-configurable test parameters (P3 feature).

```typescript
interface TestConfiguration {
  // Test data prefix for cleanup
  prefix: string                // Default: "WFTEST_"

  // Phase 1: Master Data
  warehouseName: string         // Default: "WFTEST_MAIN"
  itemPrefix: string            // Default: "WFTEST_"

  // Phase 3: Purchasing
  vendorName: string            // Default: "WFTEST_VENDOR"
  purchaseQuantity: number      // Default: 100

  // Phase 4: Production
  productionQuantity: number    // Default: 50

  // Phase 6: Sales
  customerName: string          // Default: "WFTEST_CUSTOMER"
  salesQuantity: number         // Default: 10
}

const DEFAULT_CONFIG: TestConfiguration = {
  prefix: 'WFTEST_',
  warehouseName: 'WFTEST_MAIN',
  itemPrefix: 'WFTEST_',
  vendorName: 'WFTEST_VENDOR',
  purchaseQuantity: 100,
  vendorName: 'WFTEST_VENDOR',
  productionQuantity: 50,
  customerName: 'WFTEST_CUSTOMER',
  salesQuantity: 10,
}
```

---

### CleanupStatus

Result of pre-test data cleanup.

```typescript
interface CleanupStatus {
  performed: boolean
  startedAt: string
  completedAt: string
  duration: number              // milliseconds
  deletedCounts: Record<string, number>  // { "items": 5, "vendors": 1, ... }
  errors: string[]              // Any cleanup errors
}
```

---

## State Transitions

### Session Status

```
pending → running → passed
                  → failed
                  → cancelled
```

### Phase Status

```
pending → running → passed (all steps passed)
                  → failed (any step failed)
```

### Step Status

```
pending → running → passed (API 2xx response)
                  → failed (API error or exception)
```

---

## Complete Step Definitions

### Phase 1: Master Data Setup (Steps 1-4)

| Step | Name | API Endpoint | Creates |
|------|------|--------------|---------|
| 1 | Setup warehouse and storage locations | POST /api/warehouses | warehouse, locations |
| 2 | Setup item categories and units | POST /api/item-categories, /api/units | categories, units |
| 3 | Setup inventory items | POST /api/items | raw materials, packaging, finished goods |
| 4 | Setup HR employees | POST /api/hr/employees | employees with roles, training |

### Phase 2: BOM & Production Planning (Steps 5-6)

| Step | Name | API Endpoint | Creates |
|------|------|--------------|---------|
| 5 | Create Bill of Materials | POST /api/bom | BOM header, BOM lines |
| 6 | Execute BOM explosion | POST /api/bom/{id}/explosion | Material requirements |

### Phase 3: Purchasing Flow (Steps 7-12)

| Step | Name | API Endpoint | Creates |
|------|------|--------------|---------|
| 7 | Setup vendor with AVL | POST /api/vendors | vendor, AVL records |
| 8 | Create purchase requisition | POST /api/purchase-requisitions | PR header, lines |
| 9 | Convert PR to purchase order | POST /api/purchase-orders | PO header, lines |
| 10 | Receive goods to quarantine | POST /api/inventory/lots | inventory lots |
| 11 | Perform incoming QC | POST /api/qc-tests | QC test results |
| 12 | Release QC-passed lots | PATCH /api/inventory/lots/{id} | lot status update |

### Phase 4: Production Flow (Steps 13-19)

| Step | Name | API Endpoint | Creates |
|------|------|--------------|---------|
| 13 | Create work order | POST /api/work-orders | WO header |
| 14 | Complete line clearance | POST /api/work-orders/{id}/line-clearance | clearance record |
| 15 | Issue materials to WO | POST /api/work-orders/{id}/issue | material issues |
| 16 | Execute WO steps | POST /api/work-orders/{id}/steps | step records |
| 17 | Perform in-process QC | POST /api/qc-tests | IPQC results |
| 18 | Complete production | PATCH /api/work-orders/{id} | WO status, yield |
| 19 | Receive finished goods | POST /api/inventory/lots | FG lots |

### Phase 5: Finished Goods QC (Steps 20-21)

| Step | Name | API Endpoint | Creates |
|------|------|--------------|---------|
| 20 | Perform FG QC testing | POST /api/qc-tests | FG QC results |
| 21 | Release finished goods | PATCH /api/inventory/lots/{id} | lot status → released |

### Phase 6: Sales Flow (Steps 22-25)

| Step | Name | API Endpoint | Creates |
|------|------|--------------|---------|
| 22 | Setup customer master | POST /api/customers | customer record |
| 23 | Create sales order with ATP | POST /api/sales-orders | SO header, lines |
| 24 | Pick and pack order | POST /api/sales-orders/{id}/pick | pick records |
| 25 | Ship order | POST /api/sales-orders/{id}/ship | shipment, delivery |

### Phase 7: Accounting Verification (Steps 26-29)

| Step | Name | API Endpoint | Creates |
|------|------|--------------|---------|
| 26 | Verify AP invoice | GET /api/ap-invoices | verification only |
| 27 | Verify AR invoice | GET /api/ar-invoices | verification only |
| 28 | Verify journal entries | GET /api/journal-entries | verification only |
| 29 | Verify 3-way matching | GET /api/accounting/3way-match | verification only |

### Phase 8: VMI Integration (Steps 30-31)

| Step | Name | API Endpoint | Creates |
|------|------|--------------|---------|
| 30 | Sync inventory to VMI | POST /api/vmi-sync/inventory | VMI sync record |
| 31 | Verify VMI order status | GET /api/vmi/order-status | verification only |

---

## SSE Message Types

Messages streamed during test execution:

```typescript
type SSEMessage =
  | { type: 'connected'; sessionId: string; totalSteps: number }
  | { type: 'cleanup_start' }
  | { type: 'cleanup_complete'; status: CleanupStatus }
  | { type: 'phase_start'; phaseId: number; phaseName: string }
  | { type: 'phase_complete'; phaseId: number; status: PhaseStatus }
  | { type: 'step_start'; stepId: number; stepName: string; activityMessage: string }
  | { type: 'step_activity'; stepId: number; message: string }
  | { type: 'step_complete'; stepId: number; status: StepStatus; details: WorkflowTestStep }
  | { type: 'test_complete'; status: WorkflowStatus; summary: WorkflowTestSession }
  | { type: 'error'; stepId?: number; error: StepError }
  | { type: 'heartbeat'; timestamp: string }
```

---

## Data Cleanup Scope

Tables/entities with test data to clean before each run:

```typescript
const CLEANUP_ORDER = [
  // Clean in dependency order (reverse of creation)
  'vmiSyncLogs',
  'shipments',
  'salesOrderLines',
  'salesOrders',
  'arInvoices',
  'apInvoices',
  'journalEntries',
  'qcTests',
  'workOrderSteps',
  'workOrderMaterials',
  'workOrders',
  'purchaseOrderLines',
  'purchaseOrders',
  'purchaseRequisitionLines',
  'purchaseRequisitions',
  'inventoryTransactions',
  'inventoryLots',
  'bomLines',
  'boms',
  'approvedVendorList',
  'vendors',
  'customers',
  'trainingRecords',
  'employees',
  'items',
  'itemCategories',
  'storageLocations',
  'warehouses',
]
```

---

## Validation Rules

### Session
- `id` must be unique
- `startedAt` required when status changes to 'running'
- `completedAt` required when status changes to terminal state

### Phase
- Must have 1-19 steps
- `completedCount` ≤ `stepCount`
- Status 'passed' requires all steps 'passed'
- Status 'failed' requires at least one step 'failed'

### Step
- `duration` ≥ 0
- `apiCall` required when status is 'passed' or 'failed'
- `error` required when status is 'failed'
- `createdEntities` populated when step creates records

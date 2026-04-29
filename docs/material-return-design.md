# Material Issue / Return Module — Design

**Date**: 2026-04-30
**Author**: Claude Opus 4.7 (research-driven)
**Status**: Draft for review

## 1. Problem Statement

โรงงานเบิกวัตถุดิบเป็น **หน่วยใหญ่** (e.g. 1 ถัง 25kg, 1 ลัง 100 ขวด) แต่ชั่งใช้จริงเป็น **หน่วยย่อย** (250g, 5 ขวด) → มีของเหลือคืนคลังเสมอ

**คำถามหลัก**:
1. คืนในหน่วยไหน — หน่วยใหญ่เดิม หรือหน่วยย่อยที่ชั่ง?
2. ถ้าเหลือ 12.5kg จากถัง 25kg ตอนคืน ใช้ container อะไร?
3. ใครรับผิดชอบความแตกต่างระหว่างที่เบิก vs ที่ใช้+คืน?
4. Reconciliation ผ่านเกณฑ์อะไร — ต้องสอบสวนเมื่อเกินกี่ %?

## 2. Standards & References

ออกแบบตามมาตรฐานสากล:

- **FDA 21 CFR 211.103** — Calculation of yield + reconciliation
- **FDA 21 CFR 211.101–105** — Charge-in of components, control system
- **PIC/S PE 009 Annex 7 (Herbal)** — Material reconciliation in herbal manufacturing
- **WHO Annex 2 (Documentation)** — Issue / dispense / return records
- **Oracle MES Process Manufacturing** — "Reverse Dispense" pattern (industry reference)
- **SAP PP-PI Process Industry** — Goods movement type 262 (return to stock)
- **GMP variance limits** — Active RM ≤ 1%, Inactive RM ≤ 3% (PharmaGMP industry standard)

## 3. Key Design Decisions (Research-Driven)

### 3.1 Return UOM = Same as Dispensed UOM

อุตสาหกรรมยาสากลใช้แนวทาง: **คืนในหน่วยที่ชั่งจริง (dispense UOM) ไม่ใช่หน่วยใหญ่ที่เบิก**

**เหตุผล**:
- Traceability — ทุก gram ต้องสามารถ trace ได้
- ความแม่นยำ — ชั่งคืนเป็น "1 ถัง" ไม่บอกว่าเหลือเท่าไหร่
- Container tracking — Oracle MES ใช้ "Source Container Dispense" mode: เปิดถังใหญ่, ใช้ส่วนหนึ่ง, ที่เหลือใส่ container ใหม่ (สีหรือ tag ต่าง) → กลับคลัง

**ตัวอย่างสำหรับโรงงานเรา**:
```
เบิก:    SACK-2026-001 (ขมิ้นชัน 25 kg)        ← issue UOM = sack(25kg)
ชั่งใช้:  4 batches × 6 kg = 24 kg              ← dispense UOM = kg
ของเหลือ: 1 kg                                  ← return UOM = kg (NOT sack)
```

ของเหลือ 1kg → สร้าง lot ใหม่ `RTN-2026-0001` → คืนคลัง

### 3.2 Container Lifecycle

```
[Original Container]              [Returned Container]
  SACK-2026-001                     RTN-2026-0001
  Original lot info ────parent────► Same product, same batch
  25 kg                              1 kg (remaining)
  (consumed)                         (returned, available)
```

**Traceability rules**:
- Returned lot **inherits** original lot's expiry, supplier, country of origin
- Returned lot has **own lot number** (RTN-prefix) for audit
- Linked back to original lot via `parent_lot_id`
- Storage location: usually back to original RM warehouse (or quarantine)

### 3.3 Variance Categories

ทุกครั้งที่ดำเนินการ reconciliation:

```
Issued − Used − Returned = Variance
```

**Variance dispositions**:
| Reason | Examples | Action |
|---|---|---|
| **Process loss** | Equipment residue, transfer loss | Within ±1% Active / ±3% Inactive → log only |
| **Sampling** | QC retest, in-process samples | Document sample, link to QC record |
| **Spillage** | Documented incident | Record + photo, may need deviation |
| **Cleaning** | Equipment cleaning consume material | Standard %; document in cleaning log |
| **Unaccounted** | Outside tolerance | Trigger deviation + investigation |

### 3.4 State Machine (Issue → Use → Return)

```
Issued (planned)
   │
   ▼
Issued (physical) ─────► Returned (excess)
   │                          │
   │                          ▼
   ▼                       Verified by QA
Consumed (in process)         │
   │                          ▼
   ▼                       Back in stock
Reconciliation
   │
   ▼ (if variance > tol)
Investigation/Deviation
```

## 4. Database Schema

### 4.1 Tables

```sql
-- A formal return event (trip from production → warehouse)
CREATE TABLE material_returns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  return_number VARCHAR(30) UNIQUE NOT NULL,  -- "RET-2026-0001"
  work_order_id INT REFERENCES work_orders(id),
  source_requisition_id INT REFERENCES inventory_requisitions(id),
  return_date DATETIME NOT NULL,
  returned_by INT NOT NULL REFERENCES users(id),
  receiving_warehouse_id INT NOT NULL REFERENCES warehouses(id),
  status ENUM('draft','submitted','received','rejected') DEFAULT 'draft',
  -- QA approval
  approved_by INT REFERENCES users(id),
  approved_at DATETIME,
  rejection_reason TEXT,
  notes TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_wo (work_order_id),
  INDEX idx_status (status)
);

-- Each item line on a return
CREATE TABLE material_return_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  return_id INT NOT NULL REFERENCES material_returns(id) ON DELETE CASCADE,
  -- What was issued
  source_lot_id INT NOT NULL REFERENCES inventory_lots(id),
  item_id INT NOT NULL REFERENCES items(id),
  issued_qty DECIMAL(15,4) NOT NULL,        -- amount originally issued
  issued_unit VARCHAR(20) NOT NULL,         -- e.g. "kg", "L", "sack"
  -- What was used
  used_qty DECIMAL(15,4) NOT NULL,          -- amount actually consumed
  used_unit VARCHAR(20) NOT NULL,           -- usually = issued_unit (after conversion)
  -- What is being returned
  return_qty DECIMAL(15,4) NOT NULL,        -- amount being returned
  return_unit VARCHAR(20) NOT NULL,         -- DISPENSE unit (small), per industry
  -- New lot for the returned portion (created on submission)
  returned_lot_id INT REFERENCES inventory_lots(id),
  -- Container tracking (for cross-contamination prevention)
  return_container_label VARCHAR(50),       -- "RTN-2026-0001-A"
  return_container_type VARCHAR(50),        -- "bag", "drum", "bottle"
  -- Variance reconciliation
  expected_variance_qty DECIMAL(15,4),      -- known process loss
  variance_qty DECIMAL(15,4) NOT NULL,      -- = issued - used - return
  variance_pct DECIMAL(8,4) NOT NULL,       -- = variance / issued * 100
  variance_reason ENUM('process_loss','sampling','spillage','cleaning',
                       'measurement_error','unaccounted','other') NOT NULL,
  variance_explanation TEXT,
  is_outside_tolerance BOOLEAN DEFAULT FALSE,
  deviation_id INT REFERENCES deviations(id),  -- if investigation triggered
  notes TEXT,
  INDEX idx_source_lot (source_lot_id),
  INDEX idx_returned_lot (returned_lot_id)
);

-- Tolerance config per item / category
CREATE TABLE material_variance_tolerances (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT REFERENCES items(id),         -- specific item
  item_category VARCHAR(50),                -- 'active','inactive','excipient','herb'
  tolerance_pct DECIMAL(8,4) NOT NULL,      -- e.g. 1.0 for active, 3.0 for inactive
  effective_from DATE NOT NULL,
  effective_to DATE,
  approved_by INT REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (item_id, effective_from)
);
```

### 4.2 Reuse Existing Tables

ต่อยอดจากตารางที่มีอยู่:
- `inventory_lots` — เพิ่ม `parent_lot_id` (FK to itself, for return-traceability)
- `inventory_transactions` — ใช้ existing types: ISSUE / RETURN / VARIANCE_ADJUSTMENT
- `work_order_materials` — ใช้ track issued amount per WO

## 5. Service Layer Design

### 5.1 Functions

```typescript
// Submit a return (operator action)
async function submitMaterialReturn(input: {
  workOrderId: number;
  lines: Array<{
    sourceLotId: number;
    issuedQty: number;
    usedQty: number;
    returnQty: number;
    returnUnit: string;
    varianceReason: string;
    varianceExplanation?: string;
    containerLabel: string;
  }>;
  operatorId: number;
}): Promise<MaterialReturn>;

// Approve and post to inventory (QA action)
async function approveMaterialReturn(
  returnId: number,
  approverId: number,
): Promise<{
  newLots: InventoryLot[];
  inventoryAdjustments: InventoryTransaction[];
  deviationsCreated: Deviation[];
}>;

// Get reconciliation report for a WO
async function getMaterialReconciliation(workOrderId: number): Promise<{
  totalIssued: Map<itemId, number>;
  totalUsed: Map<itemId, number>;
  totalReturned: Map<itemId, number>;
  variancesByItem: Array<{ itemId, qty, pct, status: 'within'|'outside' }>;
  unsubmittedExcess: Array<{...}>;  // issued but not yet used or returned
}>;
```

### 5.2 Key Business Rules

1. **Return UOM enforcement**: `returnUnit` MUST equal a defined dispense UOM for the item (looked up from item master). Reject submission if mismatched.

2. **Variance auto-classification**:
   ```
   variancePct = (issued - used - return) / issued * 100
   tolerance = lookup(item.category) || 3.0
   if abs(variancePct) > tolerance:
     mark isOutsideTolerance = true
     auto-create deviation linked to return line
   ```

3. **New lot creation on approval**:
   - Inherit from source lot: itemId, supplierId, expiryDate, manufactureDate, countryOfOrigin
   - New: lotNumber = `RTN-{YYYY}-{seq}`, parentLotId = source.id, quantity = returnQty
   - Initial status: `quarantine` until QA verifies (configurable)
   - Storage location: source warehouse default, override allowed

4. **Inventory adjustments** (transactions):
   - Decrement source lot by `returnQty` (it was already counted as issued/consumed; we now correct that)
   - Create new lot with `returnQty`
   - Log VARIANCE_ADJUSTMENT for `variance` portion

5. **Audit trail** (FDA Part 11):
   - All return lines log who, when, what
   - Approval signature captured
   - Rejection includes reason

## 6. UI Design

### 6.1 Operator Flow (Production)

```
WO Detail → Material Weighing tab
  ┌──────────────────────────────────────────┐
  │ Material        Issued    Used    Excess │
  │ ขมิ้นชัน          25 kg    24 kg    1 kg  │
  │                                  [Return]│
  └──────────────────────────────────────────┘

Click [Return] → 
  ┌──────────────────────────────────────────┐
  │ Return Excess Material                   │
  │ Item: ขมิ้นชัน · Source Lot: SACK-001    │
  │ ─────────────────────────────────────────│
  │ Issued      : 25 kg                      │
  │ Used        : 24 kg                      │
  │ Return      : [1] kg ▼                   │
  │ Variance    : 0 kg (0.0%)                │
  │ Container   : [RTN-2026-0001-A]          │
  │ Reason      : ⦿ Process loss              │
  │              ○ Sampling                  │
  │              ○ Spillage                  │
  │              ○ Other                     │
  │ Notes       : [free text]                │
  │                                          │
  │ [Cancel]                  [Submit Return]│
  └──────────────────────────────────────────┘
```

### 6.2 Warehouse Flow (Receiving)

```
Inventory → Returns Inbox
  ┌──────────────────────────────────────────┐
  │ Pending Returns (3)                      │
  │ #RET-2026-0001 · WO#195 · 30/4/2026     │
  │   ขมิ้นชัน 1 kg · Variance 0.0%  [Review]│
  └──────────────────────────────────────────┘

Click [Review] →
  ┌──────────────────────────────────────────┐
  │ Receive Return RET-2026-0001             │
  │ ─── Source ──────────────────────────────│
  │ Lot: SACK-2026-001 · ขมิ้นชัน 25 kg     │
  │ ─── Returning ───────────────────────────│
  │ Qty: 1 kg · Container: RTN-2026-0001-A   │
  │ Reason: Process loss                     │
  │ Operator notes: [...]                    │
  │ ─── Verification ────────────────────────│
  │ Physical count: [_____] kg               │
  │ Match: ✓                                 │
  │ ─── Disposition ─────────────────────────│
  │ Status: ⦿ Accept → Quarantine            │
  │         ○ Accept → Available             │
  │         ○ Reject (with reason)           │
  │                                          │
  │ [Cancel]               [Approve & Post]  │
  └──────────────────────────────────────────┘
```

### 6.3 Reconciliation Dashboard (per WO)

```
Material Reconciliation — WO#195
┌─────────────────┬─────────┬──────┬─────────┬────────┬────────┐
│ Material        │ Issued  │ Used │ Returned│Variance│ Status │
├─────────────────┼─────────┼──────┼─────────┼────────┼────────┤
│ ขมิ้นชัน 25kg    │ 25.000  │24.000│  1.000  │ 0.000  │ ✓ OK   │
│ Capsule shell   │ 5,000   │4,920 │     0   │   80   │ ⚠ 1.6% │
│ Lactose         │ 10.000  │ 9.500│     0   │ 0.500  │ ✗ 5%   │
│                 │         │      │         │        │ → Inv. │
└─────────────────┴─────────┴──────┴─────────┴────────┴────────┘
                                              [Run Final Reconciliation]
```

## 7. Implementation Phases

| Phase | Deliverable | Effort | Dep |
|---|---|---|---|
| **1** | DB schema (3 new tables + parent_lot_id) | 0.5 day | - |
| **2** | Service: `submitReturn` + `approveReturn` + `getReconciliation` | 1.5 days | 1 |
| **3** | Operator UI in Material Weighing page | 1 day | 2 |
| **4** | Warehouse Returns Inbox + receive flow | 1 day | 2 |
| **5** | Reconciliation dashboard per WO | 0.5 day | 2 |
| **6** | Tolerance master CRUD UI | 0.5 day | 2 |
| **7** | Variance auto-deviation integration | 0.5 day | 2 |
| **8** | E2E test + GMP review | 0.5 day | all |

**Total: ~6 days**. **MVP**: Phases 1-4 (~4 days) gets the core flow working.

## 8. Open Questions

1. **Default tolerance**: ใช้ 1% (Active) / 3% (Inactive) หรือมีค่าอื่นที่โรงงานเราใช้?
2. **Returned lot status**: Auto-quarantine แล้วให้ QC re-test? หรือ Auto-available ถ้า reason="process_loss"?
3. **Container labeling**: Print barcode/QR ตอน submit return หรือ manual write?
4. **Warehouse approval**: ทุก return ต้อง QA sign? หรือเฉพาะที่เกิน tolerance?
5. **Sampling reason**: ถ้าเหลือเพราะ QC sampling → ลด `expected_variance_qty` ตามจำนวน sample โดยอัตโนมัติ?
6. **Multi-WO source**: ถ้า issue จาก lot เดียว ใช้กับหลาย WO → return จะ allocate ยังไง?
7. **Already-issued vs not-yet-issued**: ระบบเดิมมี requisition workflow หรือไม่ (รอตรวจ existing schema)?

## 9. Compliance Coverage

ระบบครอบคลุม:
- ✅ **FDA 21 CFR 211.103**: Yield reconciliation per batch
- ✅ **FDA 21 CFR 211.182**: Equipment cleaning + use logs (variance reason 'cleaning')
- ✅ **PIC/S PE 009 Annex 7**: Herbal-specific reconciliation including sampling
- ✅ **21 CFR Part 11**: Audit trail, e-sign on approval, time-stamped records
- ✅ **Industry standard**: Variance limit 1%/3% per Active/Inactive
- ✅ **Container traceability**: Source lot → returned lot via parent_lot_id
- ✅ **Cross-contamination prevention**: New container, new label, fresh lot ID

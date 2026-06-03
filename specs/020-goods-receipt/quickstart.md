# Quickstart: Goods Receipt & Incoming Inspection

**Feature**: 020-goods-receipt
**Target audience**: warehouse receiver, production supervisor, QA officer
**Prerequisites**: feature deployed, three users created with appropriate roles (WH_STAFF, QA_OFFICER, ADMIN)

This walkthrough exercises P1 user stories 1–3 end-to-end against a fresh UAT instance with seed data.

---

## Setup (one-time)

1. Seed data must include:
   - 1 approved PO with at least 2 lines (raw material items with `defaultTestPanelId` set).
   - 1 Work Order in `packaging_complete` status with expected finished-goods output.
   - 1 quarantine warehouse (`type='quarantine'`).
   - Default checklist templates seeded (`raw_material` v1 — 4 items; `finished_goods` v1 — 5 items).
   - Default tolerances seeded (`raw_material` 2%, `finished_goods` 5%).
   - 3 users:
     - `wh1@example.com` — role WH_STAFF (has receive + checklist)
     - `qa1@example.com` — role QA_OFFICER (has approve)
     - `admin@example.com` — role ADMIN (has all, but blocked from self-approve)

2. Run: `bun run db:seed:f020`

---

## Walkthrough A — Raw Material GRN (User Story 1)

### Step 1: Receiver creates GRN

1. Log in as `wh1@example.com`.
2. Navigate to **Inventory → ตรวจรับของ (GRN)**.
3. Click **+ สร้าง GRN ใหม่**.
4. Select source: **Purchase Order**.
5. Pick `PO-2026-00001` from the dropdown.
6. Warehouse: pick `WH-QR`.
7. Received date: today.
8. Click **บันทึก**.

**Expected**: System creates GRN `GRN-2026-00001` with 2 lines pre-populated from the PO. Line status `created`. Header status `in_progress`.

### Step 2: Receiver enters actuals on line 1

1. On the GRN detail page, click line 1.
2. Enter:
   - Actual quantity: `99.5` (vs expected 100)
   - Vendor lot: `VL-2026-A001`
   - Mfg date: 30 days ago
   - Expiry: 730 days from today
3. Click **บันทึก**.

**Expected**: Variance shown 0.5% (within 2% tolerance). No variance flag. Status still `created`.

### Step 3: Receiver runs checklist + signs

1. Click **เริ่ม Checklist**.
2. 4 items appear:
   - ☐ COA ตรงกับล็อตที่รับ
   - ☐ วันหมดอายุ ≥ shelf-life ขั้นต่ำ
   - ☐ บรรจุภัณฑ์ภายนอกสมบูรณ์
   - ☐ น้ำหนัก/จำนวน ± 2%
3. Check all 4 items.
4. Click **ลงนาม**.
5. Sign with current password/PIN.

**Expected**:
- Line status → `checklist_done` → immediately to `qc_pending` (auto-QC created).
- Inventory lot created in `quarantine` status, linked back to line.
- QC sample created with status `registered`, linked to line + lot.
- Audit trail entry for state transition.
- Toast: "Checklist signed. QC sample QC-XXXXXX created."

### Step 4: Verify quarantine gate

1. Log out, log in as a different user.
2. Navigate to Material Withdrawal.
3. Try to withdraw from the new lot.

**Expected**: Lot does not appear in selectable list, OR if attempted directly via API, returns 409 `LOT_IN_QUARANTINE`.

### Step 5: QC tests + approves the sample

1. Log in as QC operator (`qc1@example.com` if seeded, otherwise QA_OFFICER).
2. Navigate to **Quality → ตรวจรับเข้า**.
3. Find sample `QC-XXXXXX`. Click to enter test results.
4. Record results within spec for all panel tests.
5. Sample status → `approved`.

**Expected**: GRN line status auto-transitions `qc_pending` → `qc_approved`.

### Step 6: QA Officer releases

1. Log in as `qa1@example.com`.
2. Navigate to **Inventory → ตรวจรับของ (GRN)** → click `GRN-2026-00001`.
3. Click **Release to Stock** on line 1.
4. Sign with current password/PIN.

**Expected**:
- Line status → `released_to_stock`.
- Inventory lot status → `released`.
- Item `onHand` increases.
- Item `quarantineQty` decreases.
- Audit trail records QA release.

### Step 7: Verify lot is now usable

1. Log in as `wh1@example.com`.
2. Open Material Withdrawal.
3. Lot now appears in selectable list. Withdraw succeeds.

---

## Walkthrough B — Finished Goods GRN (User Story 2)

### Step 1: Production supervisor receives FG from WO

1. Log in as a production supervisor with `inventory:goods_receipt:receive`.
2. Navigate to **Production → Work Orders → WO-2026-0042**.
3. Click **รับเข้าคลัง**.

**Expected**: System creates GRN `GRN-2026-00002` with 1 line pre-populated for the FG with expected qty from WO.

### Step 2: Enter actual yield

1. Click line 1.
2. Actual: `9,650` (vs expected 10,000 → 3.5% short, within 5% tolerance).
3. Batch number: matches the WO batch.
4. Mfg date: today.
5. Expiry: calculated from product shelf life.
6. Save.

**Expected**: Variance 3.5% — within tolerance. Status `created`.

### Step 3: Run FG checklist + sign

5 items:
- ☐ ฉลากถูกต้อง
- ☐ บรรจุภัณฑ์สมบูรณ์
- ☐ น้ำหนักต่อหน่วยอยู่ในเกณฑ์
- ☐ จำนวนต่อแพ็ค
- ☐ ปริมาณ ± 5%

Sign — same auto-creation flow as Walkthrough A.

### Step 4: QA release (same as Walkthrough A Step 6)

---

## Walkthrough C — Triple Independence Block (User Story 3)

### Setup
GRN with line in `qc_approved` status. Receiver was `wh1`.

### Step 1: `wh1` attempts to release

1. Log in as `wh1@example.com` (same user who signed checklist).
2. Open the GRN.
3. Click **Release to Stock**.

**Expected**: Error toast: "Triple Independence violation — receiver cannot also be QA approver." Action blocked.

### Step 2: Admin attempts the same release

1. Log in as `admin@example.com`.
2. Same GRN.
3. Click **Release to Stock**.

**Expected**: Same block — Admin role does NOT bypass.

### Step 3: `qa1` releases successfully

1. Log in as `qa1@example.com`.
2. Click **Release to Stock**.

**Expected**: Release succeeds.

---

## Walkthrough D — Reject Flow

1. As QA officer, on a line with QC sample status `failed` (any test result outside spec):
2. **Release to Stock** button is disabled.
3. Click **Reject**.
4. Enter reason (≥10 chars).
5. Sign.

**Expected**:
- Line status → `rejected`.
- Lot status → `rejected`.
- Deviation record auto-created with link back to GRN.
- Toast: "Lot rejected. Deviation DEV-XXXXX created."

---

## Walkthrough E — Dashboard (User Story 4)

1. Generate 4 GRNs in `created` state and have 7 lines reach `qc_approved`.
2. Have at least 1 lot in quarantine ≥15 days.

3. Navigate to **Inventory → ตรวจรับของ**.

**Expected dashboard tiles**:
- "รอตรวจ Checklist: 4"
- "รอ QA: 7"
- "ออกแล้ววันนี้: N"
- "กักกันเกิน 14 วัน: 1 ⚠️"

4. Click "กักกันเกิน 14 วัน" tile → opens filtered list showing the 1 old lot.

---

## Verification queries (post-walkthrough)

Run these against MySQL UAT to confirm invariants:

```sql
-- SC-003: every released lot has a corresponding QA-signed GRN line
SELECT il.id, il.status, grl.status, grl.qa_signature_id
FROM inventory_lots il
LEFT JOIN goods_receipt_lines grl ON grl.inventory_lot_id = il.id
WHERE il.status = 'released'
  AND il.source_grn_line_id IS NOT NULL
  AND grl.qa_signature_id IS NULL;
-- Expected: 0 rows
```

```sql
-- SC-006: zero Triple Independence violations
SELECT grl.id
FROM goods_receipt_lines grl
JOIN electronic_signatures rs ON rs.id = grl.receiver_signature_id
JOIN electronic_signatures qs ON qs.id = grl.qa_signature_id
WHERE rs.signed_by_user_id = qs.signed_by_user_id;
-- Expected: 0 rows
```

```sql
-- SC-008: no gaps in GRN numbering this year
SELECT t1.grn_number AS prev, t2.grn_number AS next
FROM goods_receipts t1
LEFT JOIN goods_receipts t2 ON CAST(SUBSTRING(t2.grn_number, 10) AS UNSIGNED) =
                               CAST(SUBSTRING(t1.grn_number, 10) AS UNSIGNED) + 1
                            AND LEFT(t1.grn_number, 9) = LEFT(t2.grn_number, 9)
WHERE LEFT(t1.grn_number, 9) = CONCAT('GRN-', YEAR(NOW()), '-')
  AND t2.grn_number IS NULL
  AND CAST(SUBSTRING(t1.grn_number, 10) AS UNSIGNED) <
      (SELECT MAX(CAST(SUBSTRING(grn_number, 10) AS UNSIGNED)) FROM goods_receipts
       WHERE LEFT(grn_number, 9) = CONCAT('GRN-', YEAR(NOW()), '-'));
-- Expected: 0 rows (no gaps)
```

---

## Rollback plan

If a critical bug ships:
1. Disable sidebar entries `goods-receipt` and `incoming-inspection`.
2. Revoke the 3 new permissions from all roles via `/hr/roles`.
3. Existing PO-receive and Production Output flows continue to work unchanged.
4. No data deletion needed — incomplete GRNs remain as historical records.

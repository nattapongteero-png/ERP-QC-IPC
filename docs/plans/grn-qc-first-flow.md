# GRN flow rework — QC สุ่ม+ตรวจก่อน → คลังนับส่วนที่เหลือเข้าคลัง

## Flow จริง (ยืนยันกับผู้ใช้แล้ว)
```
ของเข้า (PO ที่ซื้อ  หรือ  WO ที่ผลิตเสร็จ)
   │
① QC สุ่มตัวอย่าง + เซ็น checklist
   │   • QC กรอก "จำนวนที่สุ่ม" เอง (ไม่ใช้ sampling plan อัตโนมัติ)
   │   • จำนวนสุ่ม → สร้าง lot ใน warehouse ประเภท "QC" (ชั้นวาง/คลังตัวอย่าง QC)
   │   • สร้าง qcSample ส่งแล็บ
   │   ├─ ผ่าน  → line: qc_approved
   │   └─ ไม่ผ่าน → ของยังเข้าคลังแต่ lot.status = quarantine (ล็อกไว้ ไม่ปฏิเสธทิ้ง)
   │
② คลังนับ "ส่วนที่เหลือ" + release
       • คลังกรอก "จำนวนรวมที่รับจริง"
       • ส่วนที่เหลือ = จำนวนรวม − จำนวนที่ QC สุ่ม
       • ส่วนที่เหลือ → สร้าง lot ใน RM (ถ้า PO) / FG (ถ้า WO), status: released
```

## การตัดสินใจ (จากผู้ใช้)
| เรื่อง | ตัดสินใจ |
|---|---|
| จำนวนสุ่ม QC | **QC กรอกเอง** ตอนเซ็น checklist (ไม่ auto จาก sampling plan) |
| คลัง QC | **warehouse แยก type ใหม่ = `qc`** (lot ตัวอย่างลงคลังนี้) |
| QC fail | ของเข้าคลังแต่ **lot.status = quarantine** (ล็อก ไม่ทิ้ง) |

## สถานะ warehouse ปัจจุบัน
type ที่มี: `raw_material`, `finished_goods`, `quarantine`, `rejected`
→ **ต้องเพิ่ม type `qc`** + seed warehouse 1 ตัว (เช่น `WH-QC` "คลังตัวอย่าง QC")

---

## การเปลี่ยนแปลง (สถาปัตยกรรม)

### A. Master data — เพิ่มคลัง QC
- เพิ่ม warehouse type `qc` ใน enum/validation (ถ้ามี constraint)
- Seed `WH-QC` (idempotent — ตามแพตเทิร์น report_categories ที่ commit ก่อน)
- service หา warehouse QC ด้วย `type='qc'` (ตัวแรก) — ไม่ hardcode id

### B. `signChecklist()` — QC สุ่ม+เซ็น (goods-receipt-checklist.service.ts)
- **เพิ่ม input** `sampleQuantity` (จำนวน QC สุ่ม, > 0, ≤ expectedQuantity)
- **ลบ** guard `actualQuantity == null` (บรรทัด 150) — ไม่ต้องมี qty รวมก่อน
- **เปลี่ยน lot สร้างที่นี่**: lot = `sampleQuantity` ลง warehouse type `qc`
  (เดิมสร้าง lot = actualQty ลง warehouse ของ grn — ย้าย logic ส่วนนี้ไป release)
  - ถ้า checklist FAIL → lot.status = `quarantine`; ถ้าผ่าน → `quarantine` เช่นกัน
    (ตัวอย่างยังรอผลแล็บ — quarantine ถูกต้องทั้งสองทาง) แต่ line status ต่างกัน
- **qcSample**: `quantityReceived = sampleQuantity`, sourceRefId = lot QC ที่เพิ่งสร้าง
- เก็บ `sampleQuantity` ไว้ที่ line (เพิ่มคอลัมน์ `sample_quantity` — migration เล็ก, nullable)
- line.status: ผ่าน → `qc_approved`, fail → `checklist_done` (กันคลัง release จนกว่าจัดการ)

### C. `qaReleaseLine()` — คลังนับ+release (goods-receipt-qa.service.ts)
- **เพิ่ม input** `actualQuantity` (จำนวนรวมที่คลังนับได้จริง, > 0)
- **guard**: `actualQuantity >= sampleQuantity` (เหลือก่อนเข้าคลัง ≥ 0)
- **สร้าง lot ส่วนที่เหลือ**: qty = `actualQuantity − sampleQuantity`
  - warehouse: PO → RM (`grn.warehouseId` เดิม / type raw_material), WO → FG
  - status: `released`
  - ถ้าส่วนที่เหลือ = 0 → ไม่สร้าง lot (ทั้งหมดเป็นตัวอย่าง)
- set `line.actualQuantity`, อัปเดต header status
- **Triple Independence**: ผู้เซ็น QC (B) ≠ ผู้ release (C) — เดิมมี ใช้ได้

### D. API + validation
- `/lines/[lineId]/checklist` (POST) — schema เพิ่ม `sampleQuantity`
- `/lines/[lineId]/qa` (POST) — schema เพิ่ม `actualQuantity` (เฉพาะ action=release)

### E. UI ([id]/page.tsx)
- **checklist popup (QC)**: ลบช่อง actualQty ที่ผมเพิ่ง add (commit 0793fd6a) →
  **ใส่ช่อง "จำนวนที่สุ่มตรวจ (เข้าคลัง QC)"** แทน (required, ≤ expected)
- **release popup (คลัง)**: เพิ่มช่อง "จำนวนรวมที่รับจริง" + แสดง "สุ่มไป QC: X, เข้าคลัง: รวม−X"
- grid: คอลัมน์แสดง sampleQty + actualQty (read-only, เติมตามจังหวะ)

### F. Tests
- sign: ต้องมี sampleQuantity>0, สร้าง lot ในคลัง QC, qcSample.quantityReceived=sample
- sign fail: lot.status=quarantine, line=checklist_done
- release: actualQuantity≥sample, สร้าง lot ส่วนที่เหลือในคลัง RM/FG, qty=actual−sample
- release เหลือ=0: ไม่สร้าง lot ที่สอง
- Triple Independence: QC signer ≠ releaser

---

## Migration
- **มี**: เพิ่มคอลัมน์ `goods_receipt_lines.sample_quantity` (nullable) — dual schema
- เพิ่ม warehouse type `qc` (ถ้ามี enum/constraint) + seed WH-QC
- `actualQuantity` ยัง nullable — ไม่แตะ

## ความเสี่ยง / ข้อมูลเก่า
- GRN ที่ค้าง `qc_approved` ก่อน deploy: มี lot สร้างแบบเก่า (เต็มจำนวน ลงคลัง grn) →
  release ใหม่ต้องเช็ค `line.inventoryLotId` มีอยู่แล้ว → skip สร้าง lot ซ้ำ (backward compat)
- ของที่ FAIL: เดิม reject สร้าง Deviation; ใหม่ "quarantine ไม่ทิ้ง" → ปุ่ม reject เดิมยังมีไว้
  สำหรับเคสทิ้งจริง แต่ default fail = quarantine

## ขอบเขต (ประเมินแรงงาน)
- 1 migration (เล็ก) + 1 seed (warehouse QC)
- 2 service ไฟล์ (แก้แกน) + 2 API route + 1 UI ไฟล์ + validation schema
- ~6-8 unit/integration tests
- **ไม่กระทบ**: หน้า qc-entry, qc-inspections (คนละ flow)

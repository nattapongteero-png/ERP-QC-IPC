# Material Requisition Gate — Design Spec

**Date:** 2026-04-02
**Status:** Approved
**Approach:** Status Gate on Work Orders (Approach A)

## Problem

ฝ่ายผลิตสามารถชั่งน้ำหนักและหัก stock วัตถุดิบได้เองเลยที่หน้า Material Weighing โดยคลังไม่ได้มีส่วนอนุมัติปล่อยของ ต้องการเพิ่มขั้นตอน "ใบเบิกวัตถุดิบ" ที่คลังต้องอนุมัติก่อนฝ่ายผลิตจึงจะชั่งได้

## Flow

```
1. สร้าง WO → work_order_materials ถูกสร้าง (requisitionStatus = 'none')
2. ฝ่ายผลิต กด "ส่งใบเบิกวัตถุดิบ" → requisitionStatus = 'requested'
3. คลัง เห็นใบเบิกที่ Tab ใหม่ในหน้า /inventory/lots → กด "อนุมัติปล่อยของ"
4. requisitionStatus = 'approved' + สร้าง inventory_transactions (ประวัติ)
5. ฝ่ายผลิต ไปชั่งวัตถุดิบที่ Material Weighing ได้ (stock หักตอน verify เหมือนเดิม)
```

## Decisions

| คำถาม | คำตอบ |
|-------|-------|
| ใครเริ่มกระบวนการเบิก? | ฝ่ายผลิต กด "ส่งใบเบิก" |
| คลังอนุมัติแล้วเกิดอะไร? | ฝ่ายผลิตไปชั่ง + เลือก Lot เอง (ชั่ง 1 ครั้ง) |
| อนุมัติบางส่วนได้ไหม? | ไม่ได้ — อนุมัติทั้งใบหรือรอ |
| ปฏิเสธได้ไหม? | ไม่มี — คลังมีแค่ "อนุมัติ" กับ "รอ" |
| แสดงที่ไหนในฝั่งคลัง? | Tab ใหม่ "ใบเบิกวัตถุดิบ" ในหน้า /inventory/lots |
| Transaction history? | ใช้ inventory_transactions เดิม เพิ่ม type 'requisition_approved' |

## Database Changes

เพิ่ม fields ใน `work_orders` (ไม่สร้างตารางใหม่):

```sql
ALTER TABLE work_orders ADD COLUMN requisition_status VARCHAR(20) DEFAULT 'none';
ALTER TABLE work_orders ADD COLUMN requisition_requested_by INT REFERENCES users(id);
ALTER TABLE work_orders ADD COLUMN requisition_requested_at DATETIME;
ALTER TABLE work_orders ADD COLUMN requisition_approved_by INT REFERENCES users(id);
ALTER TABLE work_orders ADD COLUMN requisition_approved_at DATETIME;
```

**Values for `requisition_status`:**
- `none` — ยังไม่ส่งใบเบิก
- `requested` — ฝ่ายผลิตส่งใบเบิกแล้ว รอคลังอนุมัติ
- `approved` — คลังอนุมัติแล้ว ไปชั่งได้

## UI Changes

### 1. Execution Dashboard (`/production/work-orders/[id]/execution`)

เพิ่ม section "Material Requisition" ในกลุ่ม pre_production ก่อน Material Weighing:

- แสดงรายการวัตถุดิบจาก work_order_materials (item, qty, unit)
- สถานะ `none`: ปุ่ม "ส่งใบเบิกวัตถุดิบ"
- สถานะ `requested`: แสดง "รอคลังอนุมัติ" + วันที่ส่ง + ผู้ส่ง
- สถานะ `approved`: แสดง "คลังอนุมัติแล้ว" + วันที่อนุมัติ + ผู้อนุมัติ

### 2. Inventory Lots Page (`/inventory/lots`) — Tab ใหม่

เพิ่ม Tab "ใบเบิกวัตถุดิบ" แสดง:

- รายการ WO ที่มี requisitionStatus = 'requested' หรือ 'approved'
- Filter: รอ / อนุมัติแล้ว / ทั้งหมด
- แต่ละรายการแสดง: WO Number, Batch, สินค้า, จำนวน, วันที่ขอ, ผู้ขอ
- กดขยายเห็นรายการวัตถุดิบ (item code, name, qty, unit, available stock)
- ปุ่ม "อนุมัติปล่อยของ" (เฉพาะ status = 'requested')

### 3. Material Weighing Gate

แก้ไขหน้า Material Weighing:

- ถ้า `requisitionStatus !== 'approved'`: แสดง banner warning + disable ปุ่มชั่งทั้งหมด
- ถ้า `approved`: ทำงานเหมือนเดิมทุกประการ

## API Endpoints

### POST `/api/production/work-orders/[id]/requisition`

**Request:** `{ action: 'request' | 'approve' }`

**action = 'request':**
- Validate: WO status = 'released' | 'in_progress', requisitionStatus = 'none'
- Update: requisitionStatus='requested', requisitionRequestedBy=session.userId, requisitionRequestedAt=now()

**action = 'approve':**
- Validate: requisitionStatus = 'requested'
- Update: requisitionStatus='approved', requisitionApprovedBy=session.userId, requisitionApprovedAt=now()
- For each work_order_material: create inventory_transaction with type='requisition_approved', referenceType='WO', referenceId=woId, referenceNumber=woNumber, quantity=plannedQuantity, approvedBy=session.userId

### GET `/api/inventory/requisitions`

**Query params:** `?status=requested|approved|all`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "workOrderId": 100,
      "woNumber": "WO2604017716",
      "batchNumber": "FG-8107-260401-951",
      "productName": "สินค้าพร้อมขาย1",
      "plannedQuantity": 200,
      "requisitionStatus": "requested",
      "requestedBy": "System Administrator",
      "requestedAt": "2026-04-02T10:00:00",
      "approvedBy": null,
      "approvedAt": null,
      "materials": [
        {
          "itemCode": "RM-001",
          "itemName": "สมุนไพร A",
          "plannedQuantity": 20,
          "unit": "g",
          "availableStock": 500
        }
      ]
    }
  ]
}
```

### GET `/api/production/work-orders/[id]/material-weighing` (แก้ไข)

เพิ่ม field `requisitionStatus` ใน response เพื่อให้ frontend ตรวจ gate

## Transaction History

เมื่อคลังกด "อนุมัติ" สร้าง record ใน `inventory_transactions`:

| Field | Value |
|-------|-------|
| lotId | null (ยังไม่ระบุ lot — จะระบุตอนชั่ง) |
| transactionType | 'requisition_approved' |
| quantity | plannedQuantity ของแต่ละ material |
| unit | unit ของ material |
| referenceType | 'WO' |
| referenceId | workOrderId |
| referenceNumber | woNumber |
| performedBy | null |
| approvedBy | userId ของคลัง |

**Note:** lotId=null เพราะตอนอนุมัติยังไม่ได้เลือก lot — lot จะถูกเลือกตอน Material Weighing แล้วสร้าง transaction type='issue' เพิ่มตอน verify เหมือนเดิม

## Scope Boundaries

**In scope:**
- Database: เพิ่ม 5 fields ใน work_orders
- API: 1 endpoint ใหม่ (requisition), 1 endpoint ใหม่ (inventory/requisitions), 1 แก้ไข (material-weighing)
- UI: 1 section ใหม่ใน execution dashboard, 1 tab ใหม่ในหน้า lots, 1 gate check ที่ material weighing
- Transaction history: ใช้ตาราง inventory_transactions เดิม

**Out of scope:**
- ปฏิเสธใบเบิก
- อนุมัติบางส่วน (partial approval)
- เลขที่ใบเบิกแยก (MR number)
- หลายใบเบิกต่อ 1 WO
- Print ใบเบิก

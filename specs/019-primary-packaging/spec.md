# Feature Specification: Primary Packaging Material Issuance & Return

**Feature Branch**: `019-primary-packaging`
**Created**: 2026-06-02
**Status**: Draft
**Input**: User description: "เพิ่มกระบวนการเบิกและคืน Primary Packaging Material (บรรจุภัณฑ์ปฐมภูมิ) ใน Herbal ERP"

## Overview

Primary Packaging Material (วัสดุบรรจุภัณฑ์ปฐมภูมิ) คือบรรจุภัณฑ์ที่สัมผัสยาโดยตรง — เช่น แคปซูลเปล่า ขวด ฝา ฉลาก — มีกฎ GMP ที่เข้มกว่าวัตถุดิบทั่วไป (Raw Material) เพราะ:
- การปนเปื้อนข้าม (Cross-contamination) มีผลกระทบโดยตรงต่อผู้ป่วยที่ใช้ผลิตภัณฑ์
- หน่วยนับมักเป็น "ชิ้น" (pcs/units) ไม่ใช่ "น้ำหนัก" — tolerance ต่างจาก raw material
- ต้องมี Container Closure System validation per US FDA 21 CFR 211.94 + PIC/S Annex 9

ฟีเจอร์นี้สร้างกระบวนการ **เบิก (Issuance)** + **คืน (Return)** ที่แยกออกจาก Raw Material:
- หน้า UI เฉพาะสำหรับ packaging material
- Container Label tracking ทุกขั้นตอน
- 3 สถานะการคืน: Reusable / Quarantine / Rejected
- QA approval before stock re-addition
- Auto reconciliation: Issued = Used + Returned + Variance
- Auto deviation if variance > tolerance per packaging category

ระบบมี foundation อยู่แล้ว (`wo_packaging_materials` table + basic API) — ต้องต่อยอด UI + Return workflow + Reconciliation + QA approval

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator Issues Primary Packaging from BOM (Priority: P1)

เจ้าหน้าที่ฝ่ายผลิต (Operator) ทำงานในห้องบรรจุของ Work Order WO-2569-004 ต้องการเบิกแคปซูลเปล่า ขวดบรรจุ และฝาขวด ตามที่ระบุใน BOM เปิดหน้า "เบิก Primary Packaging" เลือกวัตถุดิบจาก dropdown (filter type=packaging) เลือก lot ที่ต้องการ ระบุจำนวน (pcs) ระบุ Container Label (รหัสกล่องที่จะใช้บรรจุ packaging ออกจากคลัง) เลือกห้องผลิตที่จะใช้ ส่งคำขอเบิก ระบบรอผู้ตรวจสอบ (Verifier) มาตรวจสอบ Container Label และจำนวน ลงนามอิเล็กทรอนิกส์ทั้ง 2 ฝั่ง → ระบบตัดสต๊อกอัตโนมัติ

**Why this priority**: เป็นจุดเริ่มต้นของกระบวนการ — ถ้าไม่มีการเบิก ก็ไม่มีอะไรให้คืน เป็น MVP ที่ส่งมอบคุณค่าได้ทันที (ทดแทนการบันทึก manual ปัจจุบัน)

**Independent Test**: Login เป็น operator → เปิด WO → กดปุ่มเบิก packaging → กรอกข้อมูล → submit → verifier เข้ามาตรวจสอบ → ลงนาม → ดูสต๊อกลดลงในระบบ inventory

**Acceptance Scenarios**:

1. **Given** WO-2569-004 มีแคปซูล 1000 ชิ้นใน BOM **When** operator เบิก 800 ชิ้น พร้อมระบุ Container Label "PKG-001-CAP" **Then** ระบบบันทึกคำขอเบิกพร้อม status `pending_verification`
2. **Given** คำขอเบิก pending verification **When** verifier (คนละคนกับ operator) ตรวจสอบและลงนามด้วยรหัสผ่าน **Then** status เปลี่ยนเป็น `issued` และ stock ในคลังลดลง 800 ชิ้น
3. **Given** Operator พยายามเบิก packaging ที่ไม่อยู่ใน BOM ของ WO **Then** ระบบปฏิเสธพร้อมข้อความ "วัตถุดิบไม่อยู่ใน BOM"
4. **Given** ผู้เบิกพยายามเป็นผู้ verifier เอง **Then** ระบบปฏิเสธพร้อมข้อความ "ผู้เบิกไม่สามารถตรวจสอบเองได้ (Dual Control)"
5. **Given** เบิกโดยไม่ระบุ Container Label **Then** ระบบปฏิเสธ — Container Label เป็น required field
6. **Given** Stock ของ lot นั้นเหลือน้อยกว่าที่ขอเบิก **Then** ระบบปฏิเสธพร้อมแจ้งจำนวนคงเหลือ

---

### User Story 2 - Operator Returns Unused Primary Packaging (Priority: P1)

หลังเสร็จสิ้นการผลิต operator พบว่าใช้แคปซูลเพียง 750 ชิ้น (จาก 800 ที่เบิก) เหลือ 45 ชิ้น (อีก 5 ชิ้นใช้เป็น sampling/spillage) ต้องการคืน 45 ชิ้นกลับคลัง เปิดหน้า "คืน Primary Packaging" เลือกรายการที่เบิกไว้ (issuance #N) ระบุจำนวนที่ใช้จริง (750) ระบุจำนวนที่คืน (45) ระบบคำนวณ variance อัตโนมัติ (= 800 - 750 - 45 = 5) ระบุเหตุผล variance (sampling) ระบุ Container Label ของกล่องที่ใช้บรรจุของคืน เลือกสถานะการคืน (Reusable / Quarantine / Rejected) Verifier เข้ามาตรวจสอบและลงนาม

**Why this priority**: คู่กับ US1 — เป็นการปิดวงจร (close the loop) ของการเบิก เป็น P1 เพราะ GMP บังคับ reconciliation เสมอ ถ้าไม่มี return flow → ตัวเลขใน reconciliation ไม่สมดุล

**Independent Test**: ใช้ issuance ที่สร้างจาก US1 → เปิดหน้าคืน → กรอกข้อมูล → verifier ลงนาม → status เปลี่ยน → submit ให้ QA approve

**Acceptance Scenarios**:

1. **Given** มี issuance #N status=issued จำนวน 800 ชิ้น **When** operator คืน 45 ชิ้น used=750 reason=sampling status=Reusable **Then** ระบบบันทึก return พร้อม variance=5 status=`pending_qa_approval`
2. **Given** Return form **When** operator พิมพ์ used=900 (เกินที่เบิก 800) **Then** ระบบปฏิเสธ "ปริมาณที่ใช้เกินที่เบิก"
3. **Given** Operator ระบุ used=750 return=45 **When** submit **Then** variance อัตโนมัติคำนวณเป็น 5 (= 800 - 750 - 45)
4. **Given** Variance > tolerance ของ packaging category (เช่น แคปซูล tolerance 2% = max 16 ชิ้น) **When** variance=20 **Then** ระบบให้ส่งได้แต่ flag ว่า "outside tolerance" และบังคับระบุ root cause
5. **Given** เลือกสถานะ "Rejected" **When** submit **Then** ระบบบังคับระบุเหตุผลการปฏิเสธ (damaged / contaminated / wrong-spec)

---

### User Story 3 - QA Reviews and Approves Return (Priority: P1)

ฝ่าย QA ได้รับการแจ้งเตือนว่ามีรายการคืนรอตรวจสอบ เปิดหน้า "คืน Packaging รอ QA อนุมัติ" เห็นรายการของ WO-2569-004 ดูรายละเอียด: ผู้คืนเป็นใคร เหตุผล variance Container Label ของกล่อง สถานะ packaging ที่เสนอ (Reusable) เปิดดูรูปประกอบ (ถ้ามี) ตัดสินใจ: อนุมัติให้กลับเข้าคลังเป็น Reusable หรือเปลี่ยนสถานะเป็น Quarantine/Reject พร้อมเหตุผล ลงนามอิเล็กทรอนิกส์

ถ้า approve **Reusable**:
- ระบบสร้าง inventory_lots ใหม่ (child lot — parentLotId = source lot สำหรับ traceability)
- บันทึก inventory transaction เพิ่ม stock (transaction type = `return`)

ถ้า approve **Quarantine**:
- สร้าง lot ใหม่ status=`quarantine` (ห้ามเบิกใช้จนกว่า QA full review ต่อ)

ถ้า approve **Reject**:
- ไม่เพิ่ม stock
- บันทึก deviation
- บันทึก waste/disposal log

**Why this priority**: เป็นส่วนที่ "ปลดล็อก" สต๊อกให้กลับใช้ได้ — ถ้าไม่มีกระบวนการนี้ packaging ที่คืนจะค้างอยู่ในระบบ ไม่กลับเข้าคลัง = วงจรไม่สมบูรณ์

**Independent Test**: ใช้ return ที่สร้างจาก US2 → login เป็น QA → เปิด queue → approve ด้วยสถานะ Reusable → ตรวจสอบ inventory_lots ใหม่ + transaction เพิ่ม stock

**Acceptance Scenarios**:

1. **Given** มี return rows status=`pending_qa_approval` **When** QA user เปิด queue **Then** เห็นรายการพร้อมรายละเอียด
2. **Given** QA approve เป็น Reusable **When** ลงนามด้วยรหัสผ่าน **Then** สร้าง inventory_lot ใหม่ + transaction เพิ่ม stock + status return = `approved_reusable`
3. **Given** QA approve เป็น Quarantine **Then** สร้าง lot status=`quarantine` ไม่สามารถเบิกได้
4. **Given** QA approve เป็น Reject พร้อมเหตุผล **Then** ไม่มี stock เพิ่ม + สร้าง deviation + บันทึก disposal
5. **Given** QA พยายามเป็นคนเดียวกับ operator/verifier **Then** ระบบปฏิเสธ (Triple Independence)

---

### User Story 4 - Reconciliation Report per Work Order (Priority: P2)

ผู้จัดการฝ่ายผลิตและ QA ต้องการดู reconciliation ของ WO-2569-004 เพื่อยืนยันว่า packaging materials ทั้งหมดสมดุล (Issued = Used + Returned + Variance) เปิดหน้า "Reconciliation Report" ของ WO นั้น เห็นตารางแสดง:
- แต่ละ packaging item: BOM Planned | Issued | Used | Returned | Variance | %Variance | Within Tolerance?
- Summary row: ยอดรวมและสถานะการ balance
- กราฟแสดง % การสูญเสียแยกตามประเภท
- Export Excel/PDF สำหรับ GMP audit

**Why this priority**: เป็นเครื่องมือ governance — ถ้าไม่มี รายงานนี้ องค์กรไม่สามารถพิสูจน์ความสมดุลของ packaging ตามมาตรฐาน GMP P2 เพราะใช้ได้หลัง flow หลักทำงานเสร็จแล้ว

**Independent Test**: สร้าง issuance + return หลายรายการของ WO → เปิดรายงาน → ตรวจตัวเลขสอดคล้องกับ data

**Acceptance Scenarios**:

1. **Given** WO มี issuance 800 + return 45 + used 750 **When** เปิด reconciliation **Then** แสดง Issued=800, Used=750, Returned=45, Variance=5 (0.625%)
2. **Given** Variance 5 ชิ้นจาก 800 ของแคปซูล (tolerance 2%) **Then** แสดงสีเขียว "Within Tolerance"
3. **Given** Variance 30 ชิ้นจาก 800 ของแคปซูล (3.75% > 2%) **Then** แสดงสีแดง + ลิงก์ไปยัง deviation ที่ระบบสร้างอัตโนมัติ
4. **Given** กดปุ่ม Export Excel **Then** ดาวน์โหลดไฟล์ภายใน 10 วินาที พร้อมข้อมูลครบ
5. **Given** WO ยังไม่มี return เลย **Then** แสดง "Awaiting Returns" ใน column Returned

---

### User Story 5 - Trend & Wastage Analysis Report (Priority: P3)

ผู้บริหารต้องการดู trend การสูญเสีย packaging รายเดือน/ไตรมาส เพื่อ:
- ระบุ packaging ที่ waste บ่อย
- เปรียบเทียบ % wastage ระหว่างโรงงาน
- พิจารณาเปลี่ยน supplier ถ้าคุณภาพต่ำ

เปิดหน้า "Packaging Wastage Analytics" เลือกช่วงเวลา + โรงงาน เห็นกราฟ trend + ตาราง top wastage materials + filter ตามประเภท packaging

**Why this priority**: เพิ่มมูลค่าทางธุรกิจ (strategic insight) แต่ไม่จำเป็นต่อ MVP — P3 เพราะรอ data ใช้งานจริงระยะหนึ่งถึงจะ meaningful

**Independent Test**: หลัง flow หลักใช้งานสะสม data ≥ 1 เดือน → เปิดหน้า analytics → เห็นกราฟและ insights

**Acceptance Scenarios**:

1. **Given** มี data 3 เดือน **When** เลือก groupBy=month **Then** เห็นกราฟแท่ง 3 เดือน
2. **Given** เลือกโรงงานเดียว **When** กรอง **Then** แสดงเฉพาะ data ของโรงงานนั้น
3. **Given** ต้องการดู top wastage **Then** แสดงตารางเรียงตาม %variance descending

---

### Edge Cases

- **WO ปิดระหว่างมี return pending QA**: รายการ pending สามารถ approve/reject ได้ตามปกติ
- **ผู้คืนลาออกระหว่าง return pending**: ข้อมูลผู้คืนยังถูกเก็บไว้ — QA approve ได้ปกติ
- **Lot ต้นทาง expired ระหว่าง pending QA**: ระบบเตือน QA — อาจ force reject
- **Lot ต้นทาง rejected (โดยทีม QC)**: ระบบบล็อกการคืนแบบ Reusable — บังคับเป็น Reject เท่านั้น (cross-contamination prevention)
- **เบิกซ้ำกัน 2 ใบสำหรับ WO เดียวกัน + material เดียวกัน**: อนุญาตได้ (อาจมี shift หรือ batch แยก) — แต่ติด flag เตือน
- **Container Label ซ้ำกัน**: ระบบเตือนถ้าซ้ำในช่วง 24 ชม.ของ WO เดียวกัน — ป้องกัน mix-up
- **Return จำนวน 0**: ไม่อนุญาต — ถ้าไม่มีของคืนต้อง record ที่หน้า "Used Up Confirmation" แทน
- **WO ยังไม่ released**: ไม่อนุญาตเบิก
- **เบิกครบจำนวนแล้ว แล้ว BOM ขยับ**: ไม่กระทบ — issuance immutable หลัง verified

## Requirements *(mandatory)*

### Functional Requirements

#### การเบิก Primary Packaging (Issuance)

- **FR-001**: ระบบ MUST อนุญาตให้ผู้ใช้ที่มี permission `production:packaging:issue` สร้างคำขอเบิก primary packaging จากภายในหน้า Work Order
- **FR-002**: คำขอเบิก MUST ผูกกับ Work Order ID และ packaging item MUST อยู่ใน BOM ของ WO นั้นเท่านั้น (filter `items.type='packaging'`)
- **FR-003**: ระบบ MUST รองรับการระบุ: packaging material, source lot, quantity (pcs), Container Label, room
- **FR-004**: Container Label MUST เป็น required field (ป้องกัน mix-up)
- **FR-005**: ระบบ MUST แสดงเตือน (ไม่บล็อก) ถ้า Container Label ซ้ำกับการเบิกใน 24 ชม. ของ WO เดียวกัน
- **FR-006**: ระบบ MUST บล็อกการเบิกถ้า stock ของ lot ไม่พอ
- **FR-007**: ระบบ MUST รองรับ FIFO suggestion สำหรับ lot — operator override ได้
- **FR-008**: ระบบ MUST บังคับ Dual Control — verifier ต้องไม่ใช่ operator
- **FR-009**: Verifier MUST ลงนามอิเล็กทรอนิกส์ด้วยรหัสผ่านก่อนเปลี่ยน status เป็น `issued`
- **FR-010**: หลัง verified ระบบ MUST สร้าง inventory transaction (type=`issue`) ตัดสต๊อกอัตโนมัติ
- **FR-011**: ระบบ MUST รักษา immutability หลัง verified — ห้ามแก้ไขปริมาณ (ต้องผ่าน return flow)

#### การคืน Primary Packaging (Return)

- **FR-012**: ระบบ MUST อนุญาตให้ผู้ใช้ที่มี permission `production:packaging:return` สร้าง return ที่ link กับ issuance ที่ status=`issued`
- **FR-013**: Return MUST ระบุ: usedQty, returnQty, Container Label ของกล่องคืน, สถานะ (Reusable/Quarantine/Rejected), เหตุผล variance
- **FR-014**: ระบบ MUST คำนวณ variance อัตโนมัติ: `variance = issuedQty - usedQty - returnQty` (ต้อง ≥ 0)
- **FR-015**: ถ้า usedQty > issuedQty → ระบบ MUST ปฏิเสธ
- **FR-016**: ถ้า variance > tolerance ของ packaging category → ระบบ MUST flag `outsideTolerance=true` และบังคับระบุ root cause
- **FR-017**: Source lot ที่ status=`rejected` (โดย QC) → ระบบ MUST บล็อกการคืนแบบ Reusable, อนุญาตเฉพาะ Rejected
- **FR-018**: Container Label ของ return MUST เป็น required (traceability)
- **FR-019**: Dual Control — verifier ของ return ≠ ผู้คืน
- **FR-020**: Return หลัง verified MUST มี status `pending_qa_approval`

#### กระบวนการอนุมัติ QA (Approval)

- **FR-021**: เฉพาะผู้ใช้ที่มี permission `production:packaging:approve` MUST อนุมัติ return ได้
- **FR-022**: Triple Independence — QA approver MUST NOT เป็นผู้คืนหรือ verifier
- **FR-023**: QA MUST ลงนามอิเล็กทรอนิกส์ก่อน finalize
- **FR-024**: QA สามารถ override สถานะที่ operator เสนอ (เช่น Reusable → Quarantine) พร้อมเหตุผล
- **FR-025**: เมื่อ approve `Reusable` ระบบ MUST สร้าง inventory_lots ใหม่ (parentLotId=source lot) + inventory_transaction (type=`return`) เพิ่ม stock
- **FR-026**: เมื่อ approve `Quarantine` ระบบ MUST สร้าง lot ใหม่ status=`quarantine` — เบิกไม่ได้จนกว่า QC จะ release
- **FR-027**: เมื่อ approve `Reject` ระบบ MUST NOT เพิ่ม stock + MUST สร้าง deviation + บันทึก disposal log
- **FR-028**: ทั้ง 3 กรณีต้องเป็น single transaction — atomicity ครบทุก side-effect

#### Tolerance & Variance Rules

- **FR-029**: ระบบ MUST รองรับ tolerance config per packaging category ผ่านตาราง `packaging_tolerances`
- **FR-030**: Default tolerances:
  - แคปซูล (capsule): 2.0%
  - ขวด (bottle): 1.0%
  - ฝา (cap): 1.0%
  - ฉลาก (label): 0.5%
  - อื่นๆ: 1.0%
- **FR-031**: Admin (permission `production:packaging:configure`) MUST สามารถแก้ tolerance ได้

#### Reconciliation Report

- **FR-032**: ระบบ MUST แสดงรายงาน reconciliation per WO: BOM Planned | Issued | Used | Returned | Variance | %Variance | Within Tolerance
- **FR-033**: ระบบ MUST รองรับ export Excel + PDF
- **FR-034**: รายงาน MUST แสดง link ไปยัง deviation ที่ระบบสร้างอัตโนมัติเมื่อ variance > tolerance

#### Trend Analytics

- **FR-035**: ระบบ MUST รองรับรายงาน trend การสูญเสีย packaging รายเดือน/ไตรมาส
- **FR-036**: filter: ช่วงเวลา, โรงงาน, packaging category
- **FR-037**: Export Excel/PDF

#### Audit & Compliance

- **FR-038**: ทุก mutation (create, verify, approve, reject) MUST ผ่าน audit-wrapper บันทึก who/when/old/new
- **FR-039**: Issuance + Return + Approval ที่ finalize แล้ว MUST immutable
- **FR-040**: Audit data retention ≥ 5 ปี ตาม GMP

### Key Entities

- **WOPackagingIssuance**: คำขอเบิก packaging
  - id, work_order_id, item_id, source_lot_id, quantity, unit, container_label, room_id, operator_user_id, verifier_user_id, verifier_signature_id, status (pending_verification/issued/cancelled), issued_at

- **WOPackagingReturn**: รายการคืน packaging
  - id, issuance_id, used_qty, return_qty, variance_qty, variance_percent, outside_tolerance (bool), variance_reason, return_container_label, returner_user_id, verifier_user_id, verifier_signature_id, proposed_status (Reusable/Quarantine/Rejected), status (pending_qa_approval/approved_reusable/approved_quarantine/rejected)

- **WOPackagingReturnApproval**: บันทึก QA approval (1:1)
  - id, return_id, qa_user_id, approver_signature_id, final_status, override_reason, deviation_id (nullable), new_lot_id (nullable), action_at

- **PackagingTolerance**: เกณฑ์ variance per category
  - id, packaging_category (capsule/bottle/cap/label/other), tolerance_percent, is_active

- **Items** (existing): ใช้ `type='packaging'` + `category` ในการ filter
- **InventoryLots** (existing): ขยาย — รองรับ parentLotId chain (มีอยู่แล้วใน material-return)
- **InventoryTransactions** (existing): ใช้ transaction type=`issue` + `return`
- **Deviations** (existing): ผูกกับ return เมื่อ outside tolerance หรือ Rejected
- **ElectronicSignatures** (existing): สำหรับ E-sig

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operator เบิก packaging 1 รายการ (จากกดปุ่ม → submit) เสร็จภายใน 60 วินาที
- **SC-002**: Verifier ตรวจสอบและลงนามภายใน 30 วินาที
- **SC-003**: 100% ของ issuance ที่ verified มี inventory transaction ที่สอดคล้อง (Data Integrity)
- **SC-004**: 0 รายการที่ Dual Control fail (operator = verifier) — 100% enforcement
- **SC-005**: 0 รายการที่ Triple Independence fail (operator/verifier/QA overlap) — 100% enforcement
- **SC-006**: Operator คืน packaging 1 รายการเสร็จภายใน 90 วินาที
- **SC-007**: QA review + approve 1 รายการเสร็จภายใน 60 วินาที (รวมตรวจ Container Label + ลงนาม)
- **SC-008**: 95% ของ return ได้รับการ approve ภายใน 4 ชั่วโมงทำการ
- **SC-009**: Reconciliation report 1 WO render เสร็จภายใน 5 วินาที
- **SC-010**: Reconciliation Export Excel/PDF เสร็จภายใน 10 วินาที สำหรับ 1 WO
- **SC-011**: 100% ของ return ที่ outside tolerance สร้าง deviation อัตโนมัติ
- **SC-012**: 100% ของ approval Reusable สร้าง child lot + inventory transaction ครบใน single transaction
- **SC-013**: หลังเปิดใช้งาน 3 เดือน — packaging waste rate ลดลงอย่างน้อย 10% เทียบ baseline (จาก visibility ที่ดีขึ้น)
- **SC-014**: 100% ของ Container Label ที่ใส่ใน issuance + return — ไม่มี duplicate ภายใน 24 ชม. ของ WO เดียวกัน (หรือมี warning)

## Assumptions

1. **`items.type='packaging'` มีอยู่แล้ว** — ระบบจำแนก packaging vs raw material อยู่แล้ว (ตามที่ตรวจ schema.ts)
2. **ใช้ table `wo_packaging_materials` เดิม** + extend column สำหรับ return tracking — ไม่สร้างตารางใหม่ทั้งหมด
3. **E-signature** ใช้ pattern เดียวกับ Line Clearance และ feature 018
4. **Inventory return pattern** ใช้แบบเดียวกับ material-return.service.ts (child lot via parentLotId)
5. **Tolerance ตั้ง 4 category พื้นฐาน** — capsule/bottle/cap/label/other — ขยายเพิ่มได้ใน future
6. **Container Label เป็น free text** — โรงงานกำหนดรูปแบบเอง (เช่น "PKG-WO004-CAP-001")
7. **Reconciliation = Issued = Used + Returned + Variance** — สูตรนี้คงที่ ไม่ใช้สูตรอื่น
8. **Variance reason เป็น enum** — sampling / spillage / process_loss / cleaning / damaged / unaccounted / other
9. **Locale**: UI รองรับภาษาไทย (default) + อังกฤษ ตาม spec 015-i18n
10. **Tablet support** — operator ใช้ tablet ในห้องบรรจุ
11. **WO ต้อง status `released` หรือ `in_progress`** ถึงจะเบิกได้

## Dependencies

- **Existing systems:**
  - `wo_packaging_materials` table (extend)
  - `inventory_lots` + `inventory_transactions` (existing)
  - `electronic_signatures` (existing E-sig pattern)
  - `deviations` (existing tracking)
  - `audit-wrapper.ts` (existing audit)
  - `material-return.service.ts` (pattern reference — copy structure)
  - `production-gate.service.ts` (no integration needed for this feature, but coexists)
  - Permission system — เพิ่ม 4 permission ใหม่
- **Permission**:
  - `production:packaging:issue` — Operator + Manager
  - `production:packaging:return` — Operator + Manager
  - `production:packaging:approve` — QA Manager + QA Officer only
  - `production:packaging:configure` — Admin + Factory Manager
- **Database**: extend `wo_packaging_materials` + create 3 new tables

## Out of Scope

- **Secondary Packaging** (เช่น กล่องสำหรับขนส่ง) — ใช้ raw material flow
- **Tertiary Packaging** (pallet, wrap) — ใช้ raw material flow
- **Auto-replenishment** เมื่อ packaging ใกล้หมด — ใช้ระบบ purchasing ปกติ
- **Barcode scanning** สำหรับ Container Label — manual input ก่อน, ขยายภายหลัง
- **Image upload** ของ packaging ที่คืน — optional, ใช้ existing attachment system ถ้ามี
- **Integration กับเครื่อง count อัตโนมัติ** — manual count ก่อน

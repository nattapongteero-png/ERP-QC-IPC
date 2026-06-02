# Feature Specification: Material Withdrawal Approval for Machine Setup Loss

**Feature Branch**: `018-material-withdrawal-approval`
**Created**: 2026-06-02
**Status**: Draft
**Input**: User description: "เพิ่มกระบวนการขออนุมัติเบิกวัตถุดิบเพิ่ม กรณีสูญเสียระหว่างการตั้งค่าเครื่อง (Machine Setup Loss) ในระบบ Herbal ERP"

## Overview

ขณะดำเนินการผลิตยา เจ้าหน้าที่ฝ่ายผลิตอาจต้องเบิกวัตถุดิบเพิ่มจากปริมาณที่ระบุไว้ใน BOM (Bill of Materials) ของใบสั่งผลิต (Work Order) สาเหตุหลักคือเกิดการสูญเสียระหว่างการตั้งค่าเครื่อง การทดสอบ run เครื่อง การ calibrate หรือการปรับ parameter เครื่อง

ฟีเจอร์นี้สร้างกระบวนการ "ขออนุมัติเบิกเพิ่ม" ที่บังคับให้ทุกการเบิกเพิ่มผ่านการอนุมัติจากหัวหน้าฝ่ายผลิตก่อน เพื่อ:
- ควบคุมการสูญเสียวัตถุดิบให้อยู่ในเกณฑ์ที่กำหนด
- ตรวจสอบและบันทึกสาเหตุการสูญเสีย
- ปฏิบัติตามมาตรฐาน GMP ในส่วนของ Deviation Management และ Material Reconciliation
- รักษา audit trail ครบถ้วนสำหรับการตรวจสอบย้อนหลัง

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Production Operator Submits Withdrawal Request (Priority: P1)

เจ้าหน้าที่ฝ่ายผลิตทำงานในห้องผลิตและกำลังดำเนินการผลิตตามใบสั่งผลิต ระหว่างการตั้งค่าเครื่องบรรจุพบว่าวัตถุดิบที่เตรียมไว้ไม่พอเนื่องจากเครื่องตั้งค่าครั้งแรกแล้ววัตถุดิบสูญเสียไป จำเป็นต้องเบิกเพิ่ม เจ้าหน้าที่เปิดใบสั่งผลิตในระบบ สร้างคำขอเบิกเพิ่ม เลือกวัตถุดิบจากรายการ BOM ระบุปริมาณและสาเหตุ พร้อมแนบหลักฐาน (รูปถ่ายเครื่อง/วัตถุดิบที่สูญเสีย) แล้วส่งคำขอเพื่อรอการอนุมัติ

**Why this priority**: เป็นจุดเริ่มต้นของกระบวนการ — ถ้าไม่มี user story นี้ ทั้งระบบไม่สามารถทำงานได้ การจับข้อมูล ณ จุดเกิดเหตุคือสิ่งสำคัญที่สุด

**Independent Test**: สามารถทดสอบได้อย่างอิสระโดย operator สามารถสร้างคำขอ บันทึก และดูสถานะ pending ได้ครบถ้วน แม้ยังไม่มีกระบวนการอนุมัติ (อนุมัติด้วย stub ก่อนได้)

**Acceptance Scenarios**:

1. **Given** เจ้าหน้าที่ฝ่ายผลิต login เข้าระบบและเปิดใบสั่งผลิตที่กำลังดำเนินการอยู่ **When** กดปุ่ม "ขอเบิกวัตถุดิบเพิ่ม" และกรอกข้อมูล (วัตถุดิบจาก BOM, ปริมาณ, สาเหตุ "การตั้งค่าเครื่อง", ระบุ phase, ห้องผลิต) **Then** ระบบบันทึกคำขอด้วยสถานะ pending และแสดงในรายการคำขอของผู้ใช้
2. **Given** มีคำขอที่อยู่ในสถานะ pending **When** ผู้ใช้เปิดดูรายละเอียดคำขอ **Then** ระบบแสดงข้อมูลครบถ้วน (วัตถุดิบ, ปริมาณ, สาเหตุ, รูปแนบ, เวลาส่งคำขอ, สถานะ)
3. **Given** ผู้ใช้กำลังกรอกฟอร์มขอเบิก **When** เลือกสาเหตุ "การตั้งค่าเครื่อง (Machine Setup Loss)" **Then** ระบบบังคับให้ระบุ phase ของการตั้งค่าเครื่องก่อนยืนยันส่งคำขอ
4. **Given** ผู้ใช้ระบุปริมาณที่ขอเบิกเพิ่ม **When** ปริมาณรวมกับที่เคยขอแล้ว เกินเกณฑ์สูงสุด (% เทียบกับ BOM ที่ตั้งค่าไว้) **Then** ระบบเตือนและอนุญาตให้ส่งแต่บังคับให้ระบุเหตุผลพิเศษ + แจ้งเตือนหัวหน้าฝ่ายเป็นพิเศษ

---

### User Story 2 - Production Supervisor Reviews and Approves/Rejects Requests (Priority: P1)

หัวหน้าฝ่ายผลิตได้รับการแจ้งเตือนว่ามีคำขอรออนุมัติ เปิดรายการคำขอที่รออนุมัติ (เฉพาะของ Work Order ที่อยู่ในความรับผิดชอบ) ดูรายละเอียดคำขอแต่ละรายการ ดูประวัติการเบิกของ WO นั้น ตัดสินใจอนุมัติหรือปฏิเสธ พร้อมระบุเหตุผล และลงนามอิเล็กทรอนิกส์ด้วยรหัสผ่าน

**Why this priority**: เป็นแกนของกระบวนการควบคุม — ถ้าไม่มีกระบวนการอนุมัติ ระบบจะกลายเป็นแค่การบันทึกข้อมูล ไม่ใช่กระบวนการควบคุม GMP

**Independent Test**: ทดสอบได้โดยใช้คำขอที่สร้างจาก Story 1 → หัวหน้าฝ่ายเข้ามาอนุมัติ/ปฏิเสธ → สถานะเปลี่ยนถูกต้อง

**Acceptance Scenarios**:

1. **Given** มีคำขอ pending ของ WO ที่ฉันรับผิดชอบ **When** ฉัน (ผู้มีสิทธิ์ `production:withdrawal:approve`) เข้าหน้ารายการคำขอ **Then** ระบบแสดงคำขอนั้นพร้อมรายละเอียด
2. **Given** ฉันเปิดคำขอเพื่อพิจารณา **When** ฉันกดอนุมัติและกรอกรหัสผ่านยืนยัน **Then** ระบบเปลี่ยนสถานะเป็น approved บันทึกผู้อนุมัติและเวลา + สร้าง inventory transaction + บันทึก deviation + อัปเดต material consumption ของ WO
3. **Given** ฉันเปิดคำขอเพื่อพิจารณา **When** ฉันกดปฏิเสธพร้อมระบุเหตุผล และยืนยันด้วยรหัสผ่าน **Then** สถานะเปลี่ยนเป็น rejected ไม่มีการตัดสต๊อก แต่บันทึก deviation ไว้
4. **Given** ฉันเป็นผู้สร้างคำขอนั้นเอง **When** พยายามอนุมัติคำขอที่ตัวเองสร้าง **Then** ระบบปฏิเสธการอนุมัติพร้อมข้อความ "ผู้ขอเบิกไม่สามารถอนุมัติคำขอของตนเองได้" (Dual Control)
5. **Given** ฉันไม่มี permission `production:withdrawal:approve` **When** เข้าหน้ารายการคำขอรออนุมัติ **Then** ระบบปฏิเสธการเข้าถึง

---

### User Story 3 - Tracking and Reporting (Priority: P2)

ผู้บริหารและทีม QC ต้องการติดตามการสูญเสียวัตถุดิบในแต่ละโรงงาน เพื่อ:
- รายงานสรุปการสูญเสียระหว่างตั้งค่าเครื่อง รายเดือน/รายไตรมาส
- วิเคราะห์ trend การสูญเสียแยกตามเครื่อง/วัตถุดิบ/โรงงาน
- Export ไปวิเคราะห์ต่อ (Excel/PDF)

**Why this priority**: ค่าจาก reporting ทำให้กระบวนการเกิดประโยชน์ทางธุรกิจ แต่ไม่จำเป็นต้องมีตั้งแต่ MVP

**Independent Test**: ทดสอบโดยมีข้อมูลคำขอที่ผ่าน 2-3 รอบ → เปิดหน้ารายงาน → เห็นข้อมูลถูกต้อง

**Acceptance Scenarios**:

1. **Given** มีคำขอที่ approved/rejected หลายรายการในช่วงเวลาหนึ่ง **When** เปิดหน้ารายการคำขอทั้งหมด **Then** สามารถ filter ตาม WO, สถานะ, ช่วงเวลา, สาเหตุได้
2. **Given** ต้องการรายงานสรุปประจำเดือน **When** เลือกเดือนและกด Export **Then** ระบบสร้าง Excel/PDF ที่มี: ปริมาณรวมที่เบิกเพิ่ม, จำนวนคำขอ, top 5 วัตถุดิบที่สูญเสียบ่อย, top 5 เครื่องที่สูญเสียบ่อย
3. **Given** ต้องการดู trend **When** เลือกกราฟ "Setup Loss Trend" **Then** ระบบแสดงกราฟแท่ง/เส้นแยกตามเครื่องหรือวัตถุดิบ ตามช่วงเวลาที่เลือก

---

### User Story 4 - QC and Deviation Integration (Priority: P3)

ฝ่ายควบคุมคุณภาพ (QC) ต้องการได้รับข้อมูลการเบิกเพิ่มเพื่อบันทึกเป็น deviation ในระบบเดียวกัน ทำให้ตามรอย batch ได้ครบถ้วน เมื่อมีการอนุมัติคำขอเบิกเพิ่ม ระบบสร้าง deviation อัตโนมัติและแจ้งเตือน QC

**Why this priority**: ช่วยลด manual work ของ QC แต่ผลของการขอเบิกเพิ่มเองยังถูกบันทึกใน audit trail แม้ไม่มีฟีเจอร์นี้

**Independent Test**: ทดสอบได้โดย approve 1 คำขอ → ตรวจสอบ deviation record ที่สร้างขึ้นในระบบ deviation tracking + ตรวจสอบ notification ของ QC

**Acceptance Scenarios**:

1. **Given** คำขอเบิกเพิ่มได้รับการ approve **When** กระบวนการ approve เสร็จสิ้น **Then** ระบบสร้าง deviation record ผูกกับ WO และคำขอเบิกเพิ่มอัตโนมัติ
2. **Given** มี deviation ใหม่ที่เกิดจากการเบิกเพิ่ม **When** QC user เปิดระบบ **Then** เห็นการแจ้งเตือนและสามารถเปิดดูรายละเอียดคำขอเบิกเพิ่มต้นทาง

---

### Edge Cases

- **เมื่อสต๊อกวัตถุดิบไม่พอ ณ เวลาที่ approve**: ระบบต้องตรวจสอบสต๊อก ณ เวลา approve (ไม่ใช่เวลาส่งคำขอ) — ถ้าไม่พอ บล็อกการ approve และแจ้งเตือน "วัตถุดิบไม่พอ"
- **WO ถูกปิด/ยกเลิกระหว่างมีคำขอ pending**: คำขอ pending จะถูกเปลี่ยนสถานะเป็น "cancelled" อัตโนมัติ พร้อมเหตุผล "WO closed/cancelled"
- **ผู้ขอลาออก/ถูก deactivate ระหว่างคำขอ pending**: คำขอยังคงสามารถ approve/reject ได้ตามปกติ (ข้อมูลผู้ขอตอนนั้นยังถูกเก็บไว้)
- **หัวหน้าฝ่ายผลิตคนเดียวที่มีสิทธิ์ลา/ไม่อยู่**: ระบบรองรับ delegate permission ชั่วคราว (ใช้ระบบ delegation ที่มีอยู่)
- **คำขอที่ pending นานเกิน X วัน**: ระบบสร้างแจ้งเตือน escalation ถึงผู้จัดการโรงงาน (default: 1 วัน)
- **ส่งคำขอด้วยข้อมูลซ้ำ (double-submit)**: ระบบป้องกัน duplicate submission ในช่วง 30 วินาที
- **วัตถุดิบที่ขอเบิกไม่อยู่ใน BOM ของ WO นั้น**: ระบบไม่อนุญาต — ต้องเลือกจาก BOM เท่านั้น (กันการเบิกข้ามสูตร)
- **ปริมาณรวมเกิน 200% ของ BOM**: ระบบบล็อก ไม่อนุญาตให้ส่งคำขอใหม่จน WO นี้ถูก review (hard cap)

## Requirements *(mandatory)*

### Functional Requirements

#### การสร้างคำขอ (Request Submission)

- **FR-001**: ระบบ MUST อนุญาตให้ผู้ใช้ที่มี permission `production:withdrawal:request` สร้างคำขอเบิกเพิ่มจากภายในหน้า Work Order
- **FR-002**: คำขอ MUST ผูกกับ Work Order ID ที่ระบุ และวัตถุดิบ MUST อยู่ใน BOM ของ WO นั้นเท่านั้น
- **FR-003**: ระบบ MUST รองรับการระบุข้อมูลคำขอ: วัตถุดิบ, ปริมาณ, หน่วย, สาเหตุ (จาก dropdown), ห้องผลิต, รูปหลักฐาน (optional, multiple)
- **FR-004**: สาเหตุที่รองรับ MUST รวม:
  - การตั้งค่าเครื่อง (Machine Setup Loss) — ต้องระบุ phase
  - การทดสอบเครื่อง (Equipment Trial Run)
  - การปรับ parameter
  - อื่นๆ — ต้องระบุข้อความเอง (text required)
- **FR-005**: เมื่อเลือกสาเหตุ "การตั้งค่าเครื่อง" ระบบ MUST บังคับให้ระบุ phase ของเครื่องก่อนส่งคำขอ
- **FR-006**: ระบบ MUST อนุญาตให้แนบรูปหลักฐานได้สูงสุด 5 รูป ขนาดไม่เกิน 5 MB ต่อรูป
- **FR-007**: คำขอที่ส่งใหม่ MUST มี status เริ่มต้นเป็น "pending"
- **FR-008**: ระบบ MUST บันทึกข้อมูลผู้ขอ (user ID, ชื่อ, ตำแหน่ง) และเวลาส่งคำขอ
- **FR-009**: ระบบ MUST ป้องกัน duplicate submission ในช่วง 30 วินาทีของผู้ใช้คนเดียวกัน (idempotency)

#### กฎปริมาณ (Quantity Rules)

- **FR-010**: ระบบ MUST ตรวจสอบปริมาณรวมของคำขอเบิกเพิ่ม + ที่ approve แล้ว เทียบกับ BOM
- **FR-011**: ถ้าปริมาณรวมเกินเกณฑ์ "soft cap" (configurable ต่อโรงงาน/วัตถุดิบ, default 10%) ระบบ MUST เตือนและบังคับให้ระบุเหตุผลพิเศษ
- **FR-012**: ถ้าปริมาณรวมเกินเกณฑ์ "hard cap" (configurable, default 50%) ระบบ MUST บล็อกการส่งคำขอใหม่จนกว่า manager จะ review WO นี้
- **FR-013**: ระบบ MUST รองรับการตั้งค่า cap ต่างกันสำหรับวัตถุดิบประเภทต่างกัน (เช่น Active Ingredient เข้มกว่า Excipient)

#### กระบวนการอนุมัติ (Approval Workflow)

- **FR-014**: เฉพาะผู้ใช้ที่มี permission `production:withdrawal:approve` MUST สามารถอนุมัติ/ปฏิเสธคำขอได้
- **FR-015**: ระบบ MUST ป้องกัน Dual Control — ผู้ขอเบิก MUST NOT สามารถอนุมัติคำขอของตนเองได้ ระบบบล็อกที่ระดับ business logic
- **FR-016**: ผู้อนุมัติ MUST เห็นรายการคำขอ pending เฉพาะของ WO ที่ตนรับผิดชอบ (ตาม factory + assigned team)
- **FR-017**: ก่อนการอนุมัติ/ปฏิเสธ ระบบ MUST บังคับให้ผู้อนุมัติลงนามอิเล็กทรอนิกส์ด้วยรหัสผ่าน (E-signature) — ใช้ pattern เดียวกับ Line Clearance
- **FR-018**: เมื่อปฏิเสธ ผู้อนุมัติ MUST ระบุเหตุผลการปฏิเสธ (required text)
- **FR-019**: ระบบ MUST อนุญาตให้ผู้ขอส่งคำขอใหม่ได้แม้ถูกปฏิเสธ (ไม่ใช่ block ถาวร)

#### กระบวนการหลังการอนุมัติ (Post-Approval Processing)

- **FR-020**: เมื่อ approve สำเร็จ ระบบ MUST ตรวจสอบสต๊อกวัตถุดิบ ณ เวลานั้น (ไม่ใช่ ณ เวลาส่งคำขอ) — ถ้าไม่พอ ระบบ MUST บล็อกการ approve และแจ้งเตือน
- **FR-021**: เมื่อ approve สำเร็จ ระบบ MUST สร้าง inventory transaction อัตโนมัติ เพื่อตัดสต๊อกตามปริมาณที่อนุมัติ
- **FR-022**: เมื่อ approve สำเร็จ ระบบ MUST อัปเดต Material Consumption ของ WO ให้รวมส่วนที่เบิกเพิ่ม
- **FR-023**: เมื่อ approve สำเร็จ ระบบ MUST สร้าง deviation record อัตโนมัติในระบบ deviation tracking ผูกกับ WO + คำขอเบิกเพิ่ม
- **FR-024**: เมื่อ approve สำเร็จ ระบบ MUST แจ้งเตือนผู้ขอเบิก (in-app notification + LINE notify if configured)
- **FR-025**: เมื่อปฏิเสธ ระบบ MUST NOT ตัดสต๊อกหรือสร้าง inventory transaction
- **FR-026**: เมื่อปฏิเสธ ระบบ MUST บันทึก deviation record (เพื่อตามรอย incident) แต่ติด flag "rejected — no inventory impact"

#### Audit & Compliance

- **FR-027**: ทุกการกระทำ (create, approve, reject) MUST ถูกบันทึกใน audit trail พร้อม: user ID, timestamp, action, old/new state
- **FR-028**: ระบบ MUST รักษา immutability ของคำขอที่ approved/rejected แล้ว — ไม่สามารถแก้ไขข้อมูลย้อนหลังได้ (ต้องสร้าง deviation ใหม่)
- **FR-029**: รายงาน audit สามารถ export เป็น PDF (สำหรับ GMP audit)
- **FR-030**: ระบบ MUST รักษาข้อมูล (รวมรูปหลักฐาน) อย่างน้อย 5 ปี เพื่อรองรับ GMP audit

#### การติดตามและรายงาน (Tracking & Reporting)

- **FR-031**: ระบบ MUST แสดงรายการคำขอทั้งหมด พร้อม filter: WO, สถานะ, ช่วงเวลา, สาเหตุ, ผู้ขอ, ผู้อนุมัติ, วัตถุดิบ, โรงงาน
- **FR-032**: ระบบ MUST รองรับรายงานสรุป: ปริมาณการสูญเสียรายเดือน/รายไตรมาส/รายปี, แยกตามเครื่อง/วัตถุดิบ/โรงงาน
- **FR-033**: ระบบ MUST รองรับการ export รายงานเป็น Excel และ PDF
- **FR-034**: หน้า dashboard MUST แสดง KPI: จำนวนคำขอ pending, อัตราการอนุมัติ %, top wastage materials

#### Phase Blocking (Selective Block — Option C)

- **FR-035**: เมื่อมีคำขอเบิกเพิ่ม **pending** สำหรับวัตถุดิบ M ของ Work Order W ระบบ MUST บล็อกการ advance phase ใดๆ ของ W ที่ "ต้องใช้วัตถุดิบ M" (ตาม BOM step → material mapping) จนกว่าคำขอจะถูก approve หรือ reject
- **FR-036**: Phase อื่นของ Work Order W ที่ **ไม่เกี่ยวข้องกับวัตถุดิบ M** MUST สามารถ advance ได้ปกติ (ไม่ถูกบล็อก)
- **FR-037**: ระบบ MUST แสดงข้อความแจ้งเตือนชัดเจนใน UI ของ phase ที่ถูกบล็อก — ระบุชื่อวัตถุดิบที่รออนุมัติ + ผู้อนุมัติที่รับผิดชอบ + ลิงก์เปิดดูคำขอ
- **FR-038**: เมื่อคำขอถูก approve ระบบ MUST ปลดล็อก phase ที่เกี่ยวข้องทันที (ไม่ต้อง refresh) และแจ้งเตือนผู้ใช้ที่กำลังทำงานบน phase นั้น
- **FR-039**: เมื่อคำขอถูก reject ระบบ MUST ปลดล็อก phase ที่เกี่ยวข้องและแจ้ง operator ว่าต้อง proceed ด้วยปริมาณวัตถุดิบเดิมที่มี (หรือสร้างคำขอใหม่)
- **FR-040**: การ map "phase → วัตถุดิบที่ใช้" MUST ดึงจาก BOM Configuration ที่มีอยู่ — phase ที่ใช้ M หมายถึงทุก SOP step ใน phase นั้นที่อ้างอิงถึง material M ใน BOM

### Key Entities

- **MaterialWithdrawalRequest**: เก็บคำขอเบิกเพิ่ม
  - id, work_order_id, requested_by_user_id, requested_at, status (pending/approved/rejected/cancelled), reason_type, reason_detail, room_id, machine_phase, factory_id

- **MaterialWithdrawalRequestItem**: รายการวัตถุดิบในคำขอ (1 คำขอเบิกหลายรายการได้)
  - id, request_id, material_id (FK to BOM item), quantity_requested, unit, quantity_approved (กรอกตอน approve)

- **MaterialWithdrawalApproval**: บันทึกการอนุมัติ/ปฏิเสธ
  - id, request_id, approver_user_id, action (approve/reject), action_at, reason, e_signature_hash, password_verified_at

- **MaterialWithdrawalAttachment**: รูปหลักฐาน
  - id, request_id, file_url, file_name, uploaded_by, uploaded_at, mime_type, size_bytes

- **MaterialWithdrawalRule**: เกณฑ์ปริมาณ (per factory + material category)
  - id, factory_id, material_category, soft_cap_percent, hard_cap_percent, created_by, created_at

- **MaterialConsumption** (existing — extend): เพิ่ม column `additional_qty_via_withdrawal_request` เก็บปริมาณที่เบิกเพิ่มสะสม

- **Deviation** (existing — extend): เพิ่ม FK `withdrawal_request_id` เพื่อ link กลับ

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: เจ้าหน้าที่ฝ่ายผลิตสามารถสร้างคำขอเบิกเพิ่มเสร็จสิ้นภายใน 90 วินาที จากการกดปุ่ม "ขอเบิก" จนถึงการยืนยันส่ง (รวมการเลือกวัตถุดิบ ระบุปริมาณ และระบุสาเหตุ)
- **SC-002**: หัวหน้าฝ่ายผลิตสามารถตรวจสอบและอนุมัติ/ปฏิเสธคำขอ 1 รายการได้ภายใน 60 วินาที (ดูรายละเอียด, ตรวจสอบประวัติ, ลงนาม)
- **SC-003**: 100% ของคำขอที่ approve มี inventory transaction และ deviation record ที่สอดคล้องกัน (Data Integrity)
- **SC-004**: 0 รายการของการอนุมัติคำขอโดยผู้ขอเอง (Dual Control ทำงาน 100%)
- **SC-005**: ทุกการกระทำมี audit trail ครบถ้วน 100% (ตรวจสอบโดย sample 50 records ต่อเดือน)
- **SC-006**: ผู้บริหารสามารถดูรายงานสรุปการสูญเสียรายเดือนของโรงงานใดๆ ภายใน 5 คลิก
- **SC-007**: หลังเปิดใช้งาน 3 เดือน — อัตราการสูญเสียวัตถุดิบจากการตั้งค่าเครื่อง (ทุกโรงงานรวมกัน) ลดลงอย่างน้อย 15% เทียบกับ baseline
- **SC-008**: 95% ของคำขอเบิกเพิ่มได้รับการพิจารณา (approve/reject) ภายใน 4 ชั่วโมงทำการ
- **SC-009**: ระบบรองรับ concurrent withdrawal requests ของ WO เดียวกันได้ถูกต้อง (ไม่มี race condition)
- **SC-010**: รายงานการสูญเสีย export PDF/Excel ได้ภายใน 10 วินาที สำหรับช่วงเวลา 1 เดือนของ 1 โรงงาน
- **SC-011**: 100% ของ phase ที่ใช้วัตถุดิบที่อยู่ในคำขอเบิกเพิ่ม pending ถูกบล็อกอย่างถูกต้อง (Selective Block ตาม FR-035 ทำงาน 100%)
- **SC-012**: ค่าเฉลี่ยเวลาที่ phase ถูกบล็อกเนื่องจาก pending request น้อยกว่า 30 นาที (วัด supervisor responsiveness)

## Assumptions

1. **ระบบ permission ที่มีอยู่รองรับ:** การเพิ่ม permission `production:withdrawal:request` และ `production:withdrawal:approve` โดยไม่ต้องแก้ schema ของ permission table
2. **Generic approval workflow engine ที่มีอยู่ (`approval-workflow.service.ts`):** สามารถเพิ่ม document_type `material_withdrawal_request` ได้
3. **E-signature pattern (รหัสผ่าน) ใช้แบบเดียวกับ Line Clearance:** ไม่ต้องออกแบบใหม่
4. **Default soft cap:** 10% ของปริมาณ BOM (สอดคล้องกับ GMP best practice)
5. **Default hard cap:** 50% ของปริมาณ BOM (ป้องกัน WO ที่ผิดปกติชัดเจน)
6. **Notification:** ใช้ระบบ notification ที่มีอยู่ (in-app + LINE notify configurable)
7. **File upload:** ใช้ storage layer ที่มีอยู่ของระบบ
8. **Deviation auto-creation:** กระบวนการ approve สร้าง deviation type "Material Withdrawal — Setup Loss" อัตโนมัติ
9. **Factory scope:** ทุกโรงงานใช้ฟีเจอร์ตัวเดียวกัน แต่กฎปริมาณ (cap) ตั้งค่าแยกต่อโรงงานได้
10. **Audit retention:** สอดคล้องกับนโยบาย retention ของ audit_trail table ที่มีอยู่ (≥ 5 ปี)
11. **Locale:** UI รองรับภาษาไทย (default) และอังกฤษ (ตาม spec 015-i18n)
12. **Mobile/Tablet:** ใช้งานบน Tablet ได้ (Web Responsive) — เนื่องจาก operator ใช้ tablet ในห้องผลิต

## Dependencies

- **Existing systems:**
  - `approval-workflow.service.ts` (generic engine) — ต้องเพิ่ม document type
  - `production-gate.service.ts` — ต้องเพิ่ม hook ตรวจสอบ pending request (ตาม FR-035)
  - `material-return.service.ts` — ใช้เป็น pattern reference
  - `inventory transaction system` — ใช้ตัด stock เมื่อ approve
  - `deviation tracking system` — ใช้บันทึก deviation
  - `audit-wrapper.ts` — ใช้บันทึก audit
  - `notification system` (existing) — แจ้งเตือน
  - Permission system — เพิ่ม 2 permissions ใหม่
- **Database:** schema migration เพิ่มตารางใหม่ + 2-3 columns ในตารางที่มีอยู่
- **Roles:** Production Operator + Production Supervisor (existing roles) — ต้องอัปเดต role-permission mapping

## Out of Scope

- การคำนวณต้นทุนการสูญเสียกับระบบบัญชีอัตโนมัติ (จะพิจารณาใน spec ถัดไป ถ้าจำเป็น)
- การเชื่อมต่อกับเครื่อง IoT เพื่ออ่านปริมาณสูญเสียอัตโนมัติ (ปัจจุบันยังเป็น manual input)
- การพยากรณ์ (predictive) การสูญเสียโดย ML — ออกนอก scope MVP
- การจัดการ vendor return กรณีวัตถุดิบเสียก่อนตั้งค่า (ใช้ flow อื่น — vendor complaint)
- การพิมพ์เอกสารคำขอเป็นกระดาษ — ระบบ paperless


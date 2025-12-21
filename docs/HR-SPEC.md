“โมดูล HR/Personnel Management” ที่เพิ่มเข้าไปในระบบ เพื่อให้ **เชื่อม/Matching กับ Authentication ของระบบ HR** และครอบคลุม “ข้อมูลที่จำเป็นต่อการควบคุมคุณภาพตาม GMP” โดยยึดหลักการที่ข้อกำหนด GMP ระบุไว้ เช่น ต้องมี **ผังองค์กร + Job Description**, โครงสร้างฝ่ายผลิต/ฝ่ายควบคุมคุณภาพต้องแยกอิสระ, ต้องมีระบบฝึกอบรมและบันทึกการฝึกอบรม, การตรวจสุขภาพบุคลากร, และการควบคุมการเข้าถึง/การเปลี่ยนแปลงข้อมูลในระบบอิเล็กทรอนิกส์ให้เฉพาะผู้ได้รับอนุญาตพร้อมการบันทึกการเปลี่ยนแปลง    

---

## 1) เป้าหมายของโมดูล HR 

1. เป็น “แหล่งข้อมูลบุคลากรและโครงสร้างองค์กร” ที่ระบบงานอื่น ๆ (การผลิต, QC/QA, เอกสาร, CAPA, Deviations, Release) เรียกใช้ร่วมกัน
2. ทำให้การ Login/Authorization สอดคล้องกับระบบ HR โดย **ดึงตัวตน + สังกัด + ตำแหน่ง + บทบาทงาน** จาก HR แล้ว map เป็นสิทธิ์ในระบบนี้
3. รองรับหลักฐานด้าน GMP: ผังองค์กร/ความรับผิดชอบ, การแต่งตั้งผู้มีอำนาจ, ประวัติการฝึกอบรม, คุณสมบัติ/ใบอนุญาต, สุขภาพบุคลากร, และ Audit trail

---

## 2) ข้อมูลหลัก (Master Data) ที่ “จำเป็น” สำหรับ GMP + การกำหนดสิทธิ์

อ้างอิงแนวทางในหมวด “บุคลากร” และ “เอกสาร” ของข้อกำหนด GMP ที่ระบุให้มีผังองค์กร/Job descriptions/การฝึกอบรม และบันทึกด้านบุคลากร   

### 2.1 โครงสร้างองค์กร (Organization / Org Chart)

* Company / Plant / Site (กรณีหลายโรงงาน/หลายพื้นที่)
* Division / Department / Section / Unit
* ความสัมพันธ์ “ผู้บังคับบัญชา-ผู้ใต้บังคับบัญชา” (Reporting line)
* การแยกสายงานสำคัญตาม GMP: Production, QC, QA (ควรตั้งเป็น Org Unit ชัดเจนเพื่อบังคับ separation of duties) 

### 2.2 ตำแหน่งงาน + Job Description

* Position/Job title, Job grade/Job family (ถ้ามี)
* Job Description (หน้าที่/ความรับผิดชอบ/ขอบเขตอำนาจ) ตามข้อกำหนดต้องมีเป็นลายลักษณ์อักษร 
* การมอบหมายผู้แทน/ผู้ปฏิบัติหน้าที่แทน (Delegation/Acting) พร้อมช่วงวันที่มีผล

### 2.3 ข้อมูลพนักงาน (Employee Profile)

* HR Employee ID (Primary Key สำหรับ matching)
* ชื่อ-สกุล, หน่วยงาน, ตำแหน่ง, สถานะการจ้าง (Active/Inactive), วันที่เริ่มงาน
* Site/Plant assignment
* คุณสมบัติ/วุฒิ/ความชำนาญ (competency tags)

### 2.4 GMP-Competency / Training (หัวใจสำหรับ “อนุญาตให้ทำงานได้”)

* Training Catalog: หลักสูตร GMP, SOP เฉพาะงาน, ความปลอดภัย, งานเฉพาะเครื่องจักร/ขั้นตอนวิกฤต
* Training Record: ผู้เข้ารับการอบรม, วันที่, ผู้สอน/ผู้อนุมัติ, ผลการประเมิน, วันหมดอายุ/รอบทบทวน
* Training Program ต้องทำต่อเนื่อง และต้องมีบันทึก/ประเมินผล 

### 2.5 สุขภาพบุคลากร (Personnel Health)

* ผลตรวจสุขภาพก่อนเริ่มงาน และตรวจสุขภาพประจำตามรอบ (ตามความเหมาะสมของงาน) 
* สถานะข้อจำกัดการทำงาน (Fit/Unfit/Restricted) กรณีเจ็บป่วย/บาดแผลที่อาจกระทบคุณภาพผลิตภัณฑ์ 

### 2.6 ผู้ได้รับมอบหมาย/ผู้มีอำนาจ (Authorised / Qualified Persons)

* “Authorised person”/ผู้ได้รับมอบหมายให้อนุมัติหรือรับรองกิจกรรมสำคัญ
* รายการอำนาจอนุมัติ (เช่น Approve deviation, Approve SOP, Release batch, Approve change control)
* ขอบเขตตาม Site/Line/Product group

### 2.7 ลายมือชื่อ/การยืนยันตัวตนในการทำบันทึก (Signature / e-Signature readiness)

* Signature specimen / บัญชีลายมือชื่อ (รองรับการตรวจสอบย้อนกลับของเอกสาร/บันทึก) 
* (ถ้าต้องการ) ผูก Digital certificate หรือ e-signature policy

---

## 3) การเชื่อมกับระบบ Authentication ของ HR (Matching Design)

เป้าหมายคือ “ไม่ต้องมีฐานผู้ใช้ซ้ำซ้อน” แต่ยังรองรับกรณีระบบ HR เป็น IdP/Directory ภายนอก

### 3.1 แนวทางมาตรฐาน (แนะนำ)

1. HR เป็น Identity Provider (IdP) ผ่าน OIDC/OAuth2 หรือ SAML
2. ระบบนี้รับ token แล้ว “อ่าน claims” เช่น `employee_id`, `org_unit`, `position`, `hr_role_codes`
3. ระบบนี้ทำ **Role/Permission mapping** จาก `hr_role_codes` → Application roles
4. ดึง/Sync รายละเอียดเพิ่มเติมจาก HR API (หรือ SCIM/Provisioning) เฉพาะข้อมูลจำเป็น

### 3.2 กฎ matching (ควรกำหนดชัด)

* Primary match key: `HR Employee ID`
* หากคนย้ายหน่วยงาน/ตำแหน่ง ให้ยึดสถานะจาก HR เป็นหลัก และเก็บประวัติการเปลี่ยนแปลง (effective date)
* เมื่อพนักงาน Inactive ให้ปิดสิทธิ์โดยอัตโนมัติ

---

## 4) Authorization & GMP Control (สิ่งที่ระบบควร “บังคับใช้ได้จริง”)

### 4.1 RBAC + ABAC

* RBAC: บทบาท (QA/QC/Production/Warehouse/Admin/Trainer/Approver)
* ABAC: เงื่อนไขตาม Site/Department/Line/Product
* บังคับ separation of duties: ฝ่ายผลิตและฝ่ายควบคุมคุณภาพต้องเป็นอิสระ ไม่ขึ้นต่อกัน 

### 4.2 Training-gated Actions

ตัวอย่างกฎที่ควรทำได้:

* ผู้บันทึก/ผู้ตรวจสอบ/ผู้อนุมัติ “ต้องผ่านหลักสูตรที่เกี่ยวข้องและยังไม่หมดอายุ”
* งานสำคัญ (เช่น ปล่อยผ่านรุ่นผลิต) ให้จำกัดเฉพาะ “ผู้ได้รับมอบหมาย” ตามบทบาท/อำนาจ

### 4.3 การควบคุมระบบอิเล็กทรอนิกส์และ Audit Trail

ข้อกำหนดเอกสารระบุชัดว่าระบบอิเล็กทรอนิกส์ควรจำกัดการเข้าถึงเฉพาะผู้ได้รับอนุญาต และต้องมีการบันทึกเมื่อมีการเปลี่ยนแปลง/ลบข้อมูล 
ดังนั้นโมดูล HR ควรรองรับ:

* Audit log: ใครทำอะไร เมื่อไร จากหน้าจอใด/รายการใด
* Immutable log สำหรับเหตุการณ์สำคัญ (เช่น สิทธิ์เปลี่ยน, การแต่งตั้งผู้อนุมัติ)
* Versioning สำหรับ Job Description/Org chart/Role mapping

---

## 5) หน้าจอ/ฟังก์ชันหลักที่ควรมีในระบบ

1. Organization Chart (ดู/ค้นหา/เวอร์ชัน/วันมีผล)
2. Employee Directory + Employee Profile
3. Position & Job Description Management
4. Role & Permission Mapping (HR roles → System roles)
5. Training Catalog / Training Plan / Training Record + Competency Matrix
6. Authorised Persons & Delegation Management
7. Health Check Register (เฉพาะสถานะที่เกี่ยวข้องกับการอนุญาตทำงาน)
8. Audit & Access Review (รายงานผู้มีสิทธิ์/ผู้อนุมัติ/ผู้ผ่านอบรม)

---

## 6) ข้อแนะนำเชิงโครงสร้างข้อมูล (Data Model แบบย่อ)

* `org_unit` (id, code, name, parent_id, site_id, effective_from/to)
* `position` (id, code, name, jd_doc_id, gmp_critical_flag)
* `employee` (employee_id, name, org_unit_id, position_id, status, start_date, end_date)
* `employee_assignment_history`
* `app_role`, `app_permission`, `role_permission`
* `employee_role` (employee_id, app_role_id, scope_site/org_unit, effective_from/to)
* `training_course`, `training_session`, `training_record` (pass/fail, expiry_date, trainer_id, approver_id)
* `competency_matrix` (employee_id, competency_code, level, valid_until)
* `authorisation` (employee_id, auth_type, scope, effective_from/to)
* `audit_log` (actor_employee_id, action, entity, entity_id, before/after hash, timestamp)

---


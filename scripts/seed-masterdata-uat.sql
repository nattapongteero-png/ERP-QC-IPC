-- =====================================================================
-- UAT local: full Master Data reseed (delete + insert), comprehensive.
-- Emphasis: IPC criteria (all dosage forms/parameters) and SOP Templates
-- (library + steps + IPC criteria linked to steps).
-- Run via: mysql --default-character-set=utf8mb4
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 0) Wipe existing master data (children before parents)
-- ---------------------------------------------------------------------
DELETE FROM sop_template_ipc_criteria;
DELETE FROM sop_template_steps;
DELETE FROM sop_step_templates;
DELETE FROM ipc_criteria;
DELETE FROM production_equipment;
DELETE FROM production_rooms;
DELETE FROM environmental_conditions;
DELETE FROM packaging_tolerances;
DELETE FROM receipt_tolerances;
DELETE FROM receipt_checklist_templates;
DELETE FROM standard_weights;
DELETE FROM maintenance_plan_templates;
DELETE FROM lot_patterns;
DELETE FROM item_code_patterns;

ALTER TABLE sop_template_ipc_criteria AUTO_INCREMENT = 1;
ALTER TABLE sop_template_steps AUTO_INCREMENT = 1;
ALTER TABLE sop_step_templates AUTO_INCREMENT = 1;
ALTER TABLE ipc_criteria AUTO_INCREMENT = 1;
ALTER TABLE production_equipment AUTO_INCREMENT = 1;
ALTER TABLE production_rooms AUTO_INCREMENT = 1;
ALTER TABLE environmental_conditions AUTO_INCREMENT = 1;
ALTER TABLE packaging_tolerances AUTO_INCREMENT = 1;
ALTER TABLE receipt_tolerances AUTO_INCREMENT = 1;
ALTER TABLE receipt_checklist_templates AUTO_INCREMENT = 1;
ALTER TABLE standard_weights AUTO_INCREMENT = 1;
ALTER TABLE maintenance_plan_templates AUTO_INCREMENT = 1;
ALTER TABLE lot_patterns AUTO_INCREMENT = 1;
ALTER TABLE item_code_patterns AUTO_INCREMENT = 1;

-- ---------------------------------------------------------------------
-- 1) Production rooms (GMP areas) — ids 1..7
-- ---------------------------------------------------------------------
INSERT INTO production_rooms (code, name, name_th, room_type, description, is_active) VALUES
('ROOM-WEIGH-01','Weighing Room','ห้องชั่ง','weighing','ห้องชั่งวัตถุดิบ ควบคุมฝุ่นและความชื้น',1),
('ROOM-MIX-01','Mixing Room A','ห้องผสม A','mixing','ห้องผสมสมุนไพรและสารสกัด',1),
('ROOM-MILL-01','Milling Room','ห้องบด','production','ห้องบดและร่อนวัตถุดิบ',1),
('ROOM-FILL-01','Capsule Filling Room','ห้องบรรจุแคปซูล','production','ห้องบรรจุผงยาลงแคปซูล ควบคุมความชื้น',1),
('ROOM-PACK-01','Packaging Room','ห้องบรรจุภัณฑ์','packaging','ห้องบรรจุขวดและติดฉลาก',1),
('ROOM-QC-01','QC Laboratory','ห้องปฏิบัติการ QC','production','ห้องตรวจสอบคุณภาพระหว่างและหลังผลิต',1),
('ROOM-STORE-01','Storage Area','คลังจัดเก็บ','storage','พื้นที่จัดเก็บวัตถุดิบและสินค้าสำเร็จรูป',1);

-- ---------------------------------------------------------------------
-- 2) Production equipment (incl. scales with verification config) — ids 1..10
-- ---------------------------------------------------------------------
INSERT INTO production_equipment
(code, name, name_th, equipment_type, capacity, room_id, description, is_active,
 verification_interval_hours, min_verification_weight_g, max_verification_weight_g, tolerance_percent, scale_status) VALUES
('EQ-CONT-01','Stainless Container 100L','ภาชนะสแตนเลส 100L','Container','100 liters',2,'ภาชนะผสมสแตนเลส',1,8,NULL,NULL,0.1000,'active'),
('EQ-FILL-01','Capsule Filler 1200','เครื่องบรรจุแคปซูล 1200','Filler','1200 caps/hr',4,'เครื่องบรรจุแคปซูลกึ่งอัตโนมัติ',1,8,NULL,NULL,0.1000,'active'),
('EQ-MILL-01','Hammer Mill','เครื่องบดแบบค้อน','Mill','50 kg/hr',3,'เครื่องบดวัตถุดิบสมุนไพร',1,8,NULL,NULL,0.1000,'active'),
('EQ-MIX-01','Ribbon Mixer 500L','เครื่องผสมริบบอน 500L','Mixer','500 liters',2,'เครื่องผสมแห้ง',1,8,NULL,NULL,0.1000,'active'),
('EQ-SIEVE-01','Vibro Sifter','เครื่องร่อนสั่น','Sieve','40 mesh',3,'เครื่องร่อนผง',1,8,NULL,NULL,0.1000,'active'),
('EQ-SCALE-01','Digital Platform Scale 200kg','เครื่องชั่งดิจิทัล 200kg','Scale','200 kg x 0.01 kg',1,'เครื่องชั่งวัตถุดิบใหญ่',1,8,1000.0000,200000.0000,0.1000,'active'),
('EQ-SCALE-02','Precision Balance 1kg','เครื่องชั่งแม่นยำสูง 1kg','balance','1000 g x 0.001 g',1,'เครื่องชั่งห้องชั่งละเอียด',1,8,10.0000,1000.0000,0.0500,'active'),
('EQ-SCALE-03','Analytical Balance 220g','เครื่องชั่งวิเคราะห์ 220g','balance','220 g x 0.0001 g',6,'เครื่องชั่งวิเคราะห์ QC Lab',1,8,1.0000,220.0000,0.0100,'active'),
('EQ-HOT-01','Industrial Hotplate','เตาร้อนอุตสาหกรรม','Hotplate','50 liters',2,'เตาให้ความร้อน',1,8,NULL,NULL,0.1000,'active'),
('EQ-TOOL-01','Stainless Scoop Set','ชุดช้อนตักสแตนเลส','Tool',NULL,1,'อุปกรณ์ตักวัตถุดิบ',1,8,NULL,NULL,0.1000,'active');

-- ---------------------------------------------------------------------
-- 3) Environmental conditions (monitoring profiles) — ids 1..4
-- ---------------------------------------------------------------------
INSERT INTO environmental_conditions (code, name, temperature_min, temperature_max, humidity_max, monitoring_interval_minutes, notes, is_active) VALUES
('ENV-GENERAL','พื้นที่ผลิตทั่วไป',20.00,25.00,60.00,60,'พื้นที่ผลิตมาตรฐาน GMP',1),
('ENV-FILLING','ห้องบรรจุแคปซูล',20.00,24.00,50.00,30,'ควบคุมความชื้นต่ำเพื่อป้องกันแคปซูลนิ่ม',1),
('ENV-COLD','ห้องเย็นเก็บสารสกัด',2.00,8.00,60.00,30,'เก็บสารสกัดที่ไวต่อความร้อน',1),
('ENV-STORE','คลังจัดเก็บ',20.00,30.00,65.00,120,'คลังเก็บวัตถุดิบและสินค้า',1);

-- ---------------------------------------------------------------------
-- 4) IPC criteria — COMPREHENSIVE, per dosage form + parameter — ids 1..16
--   criteria_type: numeric | checkbox | weight ; dosage_form groups them.
-- ---------------------------------------------------------------------
INSERT INTO ipc_criteria
(code, name, name_th, test_method, specification, min_value, max_value, unit, sample_size,
 check_interval_minutes, is_critical, is_active, dosage_form, criteria_type,
 tolerance_percent, spec_target, spec_tolerance_percent, acceptance_stages, max_retest_rounds,
 empty_capsule_weight, warning_tolerance_percent) VALUES
-- ---- CAPSULE dosage form ----
('IPC-CAP-AVGWT','Capsule Average Weight','น้ำหนักเฉลี่ยแคปซูล','ชั่งน้ำหนัก 20 แคปซูล','ตามสเปคแต่ละสูตร ±5%',NULL,NULL,'mg',20,30,1,1,'capsule','weight',5.00,NULL,5.00,'[20,40]',2,96.0000,3.00),
('IPC-CAP-FILLWT','Capsule Fill Weight','น้ำหนักผงบรรจุต่อแคปซูล','ชั่งน้ำหนักหลังหักแคปซูลเปล่า','ตามสเปคสูตร ±7.5%',NULL,NULL,'mg',20,30,1,1,'capsule','weight',7.50,NULL,7.50,'[20]',2,96.0000,5.00),
('IPC-CAP-MOIST','Capsule Moisture','ความชื้นผงบรรจุ','Moisture analyzer',NULL,NULL,8.0000,'%',3,60,0,1,'capsule','numeric',0.00,NULL,0.00,NULL,1,NULL,0.00),
('IPC-CAP-DISINT','Capsule Disintegration','เวลาแตกตัวของแคปซูล','Disintegration tester',NULL,NULL,30.0000,'min',6,120,1,1,'capsule','numeric',0.00,NULL,0.00,NULL,1,NULL,0.00),
('IPC-CAP-APPEAR','Capsule Appearance','ลักษณะภายนอกแคปซูล','ตรวจด้วยสายตา','สีสม่ำเสมอ ไม่บุบ ไม่รั่ว',NULL,NULL,NULL,20,60,0,1,'capsule','checkbox',0.00,NULL,0.00,NULL,1,NULL,0.00),
('IPC-CAP-LOCK','Capsule Locking','การล็อกฝาแคปซูล','ตรวจด้วยสายตา/บีบ','ฝาแคปซูลล็อกสนิททุกเม็ด',NULL,NULL,NULL,20,60,1,1,'capsule','checkbox',0.00,NULL,0.00,NULL,1,NULL,0.00),
-- ---- TABLET dosage form ----
('IPC-TAB-AVGWT','Tablet Average Weight','น้ำหนักเฉลี่ยเม็ด','ชั่งน้ำหนัก 20 เม็ด','ตามสเปค ±5%',NULL,NULL,'mg',20,30,1,1,'tablet','weight',5.00,NULL,5.00,'[20,40]',2,NULL,3.00),
('IPC-TAB-HARD','Tablet Hardness','ความแข็งเม็ด','Hardness tester',NULL,4.0000,12.0000,'kp',10,60,0,1,'tablet','numeric',0.00,NULL,0.00,NULL,1,NULL,0.00),
('IPC-TAB-FRIAB','Tablet Friability','ความกร่อนเม็ด','Friability tester',NULL,NULL,1.0000,'%',10,120,0,1,'tablet','numeric',0.00,NULL,0.00,NULL,1,NULL,0.00),
('IPC-TAB-DISINT','Tablet Disintegration','เวลาแตกตัวของเม็ด','Disintegration tester',NULL,NULL,15.0000,'min',6,120,1,1,'tablet','numeric',0.00,NULL,0.00,NULL,1,NULL,0.00),
('IPC-TAB-THICK','Tablet Thickness','ความหนาเม็ด','Caliper',NULL,3.0000,5.0000,'mm',10,60,0,1,'tablet','numeric',0.00,NULL,0.00,NULL,1,NULL,0.00),
-- ---- POWDER / BLEND dosage form ----
('IPC-PWD-MOIST','Powder Moisture','ความชื้นผง','Moisture analyzer',NULL,NULL,10.0000,'%',3,60,1,1,'powder','numeric',0.00,NULL,0.00,NULL,1,NULL,0.00),
('IPC-PWD-UNIF','Blend Uniformity','ความสม่ำเสมอของการผสม','สุ่มตัวอย่าง 10 จุด','RSD ≤ 5%',NULL,5.0000,'%',10,60,1,1,'powder','numeric',0.00,NULL,0.00,NULL,1,NULL,0.00),
('IPC-PWD-MESH','Particle Size','ขนาดอนุภาค/ความละเอียด','Sieve analysis','ผ่านตะแกรง 40 mesh ≥ 95%',95.0000,NULL,'%',3,120,0,1,'powder','numeric',0.00,NULL,0.00,NULL,1,NULL,0.00),
-- ---- PACKAGING (common) ----
('IPC-PKG-SEAL','Seal Integrity','ความสมบูรณ์ของซีล','ตรวจด้วยสายตา/ทดสอบรั่ว','ซีลสนิททุกหน่วย ไม่มีรอยรั่ว',NULL,NULL,NULL,10,60,1,1,'packaging','checkbox',0.00,NULL,0.00,NULL,1,NULL,0.00),
('IPC-PKG-LABEL','Label Correctness','ความถูกต้องของฉลาก','ตรวจด้วยสายตา','ฉลาก/Lot/วันหมดอายุ ถูกต้องครบถ้วน',NULL,NULL,NULL,10,60,1,1,'packaging','checkbox',0.00,NULL,0.00,NULL,1,NULL,0.00);

-- ---------------------------------------------------------------------
-- 5) SOP step templates (library) — ids 1..17  (matches process stages)
-- ---------------------------------------------------------------------
INSERT INTO sop_step_templates (code, name, name_th, category, instructions, instructions_th, default_parameters, is_active) VALUES
('SOP-LC-01','Line Clearance','ตรวจสอบความพร้อมสายการผลิต','line_clearance','Clear residues, verify documents, record clearance.','เคลียร์วัสดุรุ่นก่อน ตรวจเอกสาร และบันทึกผลการเคลียร์สายการผลิต',NULL,1),
('SOP-DISP-01','Dispensing','การจ่ายวัตถุดิบ','dispensing','Verify order, weigh, label and double-check.','ตรวจใบสั่งจ่าย ชั่ง ติดฉลาก และตรวจสอบซ้ำ',NULL,1),
('SOP-PREP-01','Material Preparation','การเตรียมวัตถุดิบ','preparation','Receive, sort, clean and stage materials.','ตรวจรับ คัดแยก ทำความสะอาด และเตรียมวัตถุดิบ',NULL,1),
('SOP-MILL-01','Milling','การบด','milling','Set up mill, mill material, check particle size.','ตั้งค่าเครื่องบด บดวัตถุดิบ และตรวจขนาดอนุภาค',NULL,1),
('SOP-SIEVE-01','Sieving','การร่อน','sieving','Sieve milled powder, collect oversize, record yield.','ร่อนผงที่บด เก็บส่วนหยาบ และบันทึกผลผลิต',NULL,1),
('SOP-DRY-01','Drying','การอบแห้ง','drying','Dry to target moisture, monitor temperature.','อบแห้งจนได้ความชื้นเป้าหมาย ควบคุมอุณหภูมิ',NULL,1),
('SOP-BLEND-01','Dry Blending','การผสมแห้ง','blending','Charge blender, blend to uniformity, sample.','ใส่วัตถุดิบ ผสมจนสม่ำเสมอ และสุ่มตัวอย่าง',NULL,1),
('SOP-MIX-01','Mixing','การผสม','mixing','Add ingredients per recipe, mix per time/speed.','ใส่ส่วนผสมตามสูตร ผสมตามเวลาและความเร็วที่กำหนด',NULL,1),
('SOP-HEAT-01','Heating','การให้ความร้อน','heating','Heat to set temperature, hold and monitor.','ให้ความร้อนถึงอุณหภูมิที่ตั้ง คงไว้และเฝ้าระวัง',NULL,1),
('SOP-COOL-01','Cooling','การทำให้เย็น','cooling','Cool to target temperature before next step.','ทำให้เย็นถึงอุณหภูมิเป้าหมายก่อนขั้นตอนถัดไป',NULL,1),
('SOP-FILL-01','Capsule Filling','การบรรจุลงแคปซูล','filling','Set fill weight, fill capsules, in-process weight checks.','ตั้งน้ำหนักบรรจุ บรรจุแคปซูล ตรวจน้ำหนักระหว่างผลิต',NULL,1),
('SOP-PACK-01','Packaging','การบรรจุภัณฑ์','packaging','Fill bottles/blisters, seal, label, code Lot/expiry.','บรรจุขวด/แผง ซีล ติดฉลาก ระบุ Lot และวันหมดอายุ',NULL,1),
('SOP-IPC-01','In-Process Control','การควบคุมระหว่างผลิต','ipc','Sample and test per IPC plan, record and judge.','สุ่มและทดสอบตามแผน IPC บันทึกและตัดสินผล',NULL,1),
('SOP-WEIGH-01','Weighing','การชั่งน้ำหนัก','weighing','Verify scale, tare, weigh and record net weight.','ตรวจสอบเครื่องชั่ง หักภาชนะ ชั่งและบันทึกน้ำหนักสุทธิ',NULL,1),
('SOP-CLEAN-01','Cleaning','การทำความสะอาด','cleaning','Clean equipment/room per procedure, verify, log.','ทำความสะอาดเครื่อง/ห้องตามขั้นตอน ตรวจสอบและบันทึก',NULL,1),
('SOP-INSP-01','Inspection','การตรวจสอบ','inspection','Visual/measurement inspection against spec.','ตรวจสอบด้วยสายตา/วัดค่าเทียบกับสเปค',NULL,1),
('SOP-OTHER-01','General Step','ขั้นตอนทั่วไป','other','Generic step for ad-hoc operations.','ขั้นตอนทั่วไปสำหรับงานเฉพาะกิจ',NULL,1);

-- ---------------------------------------------------------------------
-- 6) SOP template steps — 3 ordered steps per template (ids 1..51)
--    Insert per template referencing the parent id.
-- ---------------------------------------------------------------------
INSERT INTO sop_template_steps (template_id, sequence, step_name, step_name_th, instructions_th) VALUES
(1,1,'Clear previous batch','เคลียร์วัสดุรุ่นก่อนหน้า','นำวัสดุและเอกสารรุ่นก่อนออกจากพื้นที่'),
(1,2,'Verify labels and documents','ตรวจสอบฉลากและเอกสาร','ตรวจฉลากเครื่อง ภาชนะ และเอกสารให้ตรงรุ่นปัจจุบัน'),
(1,3,'Record line clearance','บันทึกผลการเคลียร์สายการผลิต','ลงนามยืนยันความพร้อมของสายการผลิต'),
(2,1,'Check dispensing order','ตรวจสอบใบสั่งจ่าย','ตรวจรายการและปริมาณตามใบสั่งจ่าย'),
(2,2,'Weigh and dispense','ชั่งและจ่ายวัตถุดิบ','ชั่งวัตถุดิบตามสูตรด้วยเครื่องชั่งที่ผ่านการตรวจสอบ'),
(2,3,'Label and double-check','ติดฉลากและตรวจสอบซ้ำ','ติดฉลากและให้ผู้ตรวจสอบคนที่สองยืนยัน'),
(3,1,'Receive raw materials','ตรวจรับวัตถุดิบ','ตรวจรับวัตถุดิบตามใบเบิก'),
(3,2,'Sort and clean','คัดแยกและทำความสะอาด','คัดแยกสิ่งปลอมปนและทำความสะอาด'),
(3,3,'Prepare containers','เตรียมภาชนะ','เตรียมภาชนะที่สะอาดสำหรับขั้นตอนถัดไป'),
(4,1,'Set up mill','ตั้งค่าเครื่องบด','ตั้งค่าตะแกรงและความเร็วเครื่องบด'),
(4,2,'Mill material','บดวัตถุดิบ','ป้อนวัตถุดิบและบดตามขนาดที่กำหนด'),
(4,3,'Check particle size','ตรวจขนาดอนุภาค','สุ่มตรวจขนาดอนุภาคด้วยตะแกรงมาตรฐาน'),
(5,1,'Prepare sieve','เตรียมตะแกรง','เลือกเบอร์ตะแกรงและตรวจความสะอาด'),
(5,2,'Sieve powder','ร่อนผง','ร่อนผงและแยกส่วนหยาบ'),
(5,3,'Record yield','บันทึกผลผลิต','ชั่งและบันทึกปริมาณผงที่ผ่านการร่อน'),
(6,1,'Load dryer','ใส่วัตถุดิบเข้าตู้อบ','กระจายวัตถุดิบในถาดอบ'),
(6,2,'Dry to target','อบจนได้ความชื้นเป้าหมาย','ควบคุมอุณหภูมิและเวลาอบ'),
(6,3,'Check moisture','ตรวจความชื้น','สุ่มวัดความชื้นจนได้ตามสเปค'),
(7,1,'Charge blender','ใส่วัตถุดิบเข้าเครื่องผสม','ใส่วัตถุดิบตามลำดับสูตร'),
(7,2,'Blend','ผสมแห้ง','ผสมตามเวลาที่กำหนด'),
(7,3,'Sample uniformity','สุ่มตรวจความสม่ำเสมอ','สุ่มตัวอย่างหลายจุดเพื่อตรวจความสม่ำเสมอ'),
(8,1,'Add ingredients','ใส่ส่วนผสม','ใส่ส่วนผสมตามสูตร'),
(8,2,'Mix','ผสม','ผสมตามเวลาและความเร็วที่กำหนด'),
(8,3,'Check appearance','ตรวจลักษณะ','ตรวจความสม่ำเสมอของเนื้อผสม'),
(9,1,'Set temperature','ตั้งอุณหภูมิ','ตั้งอุณหภูมิเป้าหมาย'),
(9,2,'Heat and hold','ให้ความร้อนและคงไว้','ให้ความร้อนถึงอุณหภูมิและคงไว้ตามเวลา'),
(9,3,'Monitor','เฝ้าระวัง','บันทึกอุณหภูมิเป็นระยะ'),
(10,1,'Start cooling','เริ่มทำให้เย็น','เริ่มกระบวนการลดอุณหภูมิ'),
(10,2,'Monitor temperature','เฝ้าวัดอุณหภูมิ','วัดอุณหภูมิจนถึงเป้าหมาย'),
(10,3,'Confirm target','ยืนยันอุณหภูมิเป้าหมาย','ยืนยันก่อนเข้าขั้นตอนถัดไป'),
(11,1,'Set fill weight','ตั้งน้ำหนักบรรจุ','ตั้งน้ำหนักผงต่อแคปซูลตามสูตร'),
(11,2,'Fill capsules','บรรจุแคปซูล','บรรจุผงลงแคปซูลและล็อกฝา'),
(11,3,'In-process weight check','ตรวจน้ำหนักระหว่างผลิต','สุ่มชั่งน้ำหนักทุกช่วงเวลาตามแผน IPC'),
(12,1,'Fill containers','บรรจุลงภาชนะ','บรรจุแคปซูล/เม็ดลงขวดหรือแผง'),
(12,2,'Seal','ซีล','ปิดผนึกและตรวจความสมบูรณ์ของซีล'),
(12,3,'Label and code','ติดฉลากและระบุรหัส','ติดฉลาก ระบุ Lot และวันหมดอายุ'),
(13,1,'Plan IPC sampling','วางแผนการสุ่ม IPC','กำหนดจุดและความถี่การสุ่มตามแผน'),
(13,2,'Test samples','ทดสอบตัวอย่าง','ทดสอบตามเกณฑ์ IPC ที่กำหนด'),
(13,3,'Record and judge','บันทึกและตัดสินผล','บันทึกผลและตัดสิน ผ่าน/ไม่ผ่าน'),
(14,1,'Verify scale','ตรวจสอบเครื่องชั่ง','ตรวจสอบเครื่องชั่งด้วยลูกตุ้มมาตรฐานก่อนใช้'),
(14,2,'Tare and weigh','หักภาชนะและชั่ง','หักน้ำหนักภาชนะแล้วชั่งวัตถุดิบ'),
(14,3,'Record net weight','บันทึกน้ำหนักสุทธิ','บันทึกน้ำหนักสุทธิและลงนาม'),
(15,1,'Disassemble parts','ถอดชิ้นส่วน','ถอดชิ้นส่วนที่สัมผัสผลิตภัณฑ์'),
(15,2,'Clean and rinse','ทำความสะอาดและล้าง','ทำความสะอาดตามขั้นตอนและล้างให้สะอาด'),
(15,3,'Verify cleanliness','ตรวจสอบความสะอาด','ตรวจและบันทึกผลความสะอาด'),
(16,1,'Prepare inspection','เตรียมการตรวจสอบ','เตรียมเครื่องมือและสเปคอ้างอิง'),
(16,2,'Inspect','ตรวจสอบ','ตรวจด้วยสายตา/วัดค่าเทียบสเปค'),
(16,3,'Record result','บันทึกผล','บันทึกผลการตรวจสอบ'),
(17,1,'Prepare','เตรียมการ','เตรียมงานตามที่กำหนด'),
(17,2,'Execute','ดำเนินการ','ดำเนินการตามขั้นตอน'),
(17,3,'Record','บันทึก','บันทึกผลการดำเนินการ');

-- ---------------------------------------------------------------------
-- 7) Link IPC criteria to SOP steps (the previously-EMPTY table).
--    Attach the relevant IPC checks to the steps that need them.
--    Step ids: Filling IPC-check = 33 (template 11, seq 3),
--    IPC test = 38 (template 13, seq 2), Inspection = 47 (template 16, seq 2),
--    Blend sample = 21 (template 7, seq 3), Drying moisture = 18 (template 6, seq 3),
--    Packaging seal/label = 35 (template 12, seq 2) & 36 (seq 3).
--    criteria_id refers to ipc_criteria ids above.
-- ---------------------------------------------------------------------
INSERT INTO sop_template_ipc_criteria (procedure_step_id, criteria_id, sequence, sample_size, is_critical, notes, max_retest_rounds) VALUES
-- Capsule filling step (33): avg wt, fill wt, appearance, locking
(33,1,1,20,1,'ตรวจน้ำหนักเฉลี่ยแคปซูลทุกช่วงเวลา',2),
(33,2,2,20,1,'ตรวจน้ำหนักผงบรรจุ (หักแคปซูลเปล่า)',2),
(33,5,3,20,0,'ตรวจลักษณะภายนอก',1),
(33,6,4,20,1,'ตรวจการล็อกฝาแคปซูล',1),
-- IPC test step (38): full capsule IPC panel
(38,1,1,20,1,'น้ำหนักเฉลี่ย',2),
(38,3,2,3,0,'ความชื้น',1),
(38,4,3,6,1,'เวลาแตกตัว',1),
-- Dry blending sample step (21): blend uniformity + moisture
(21,13,1,10,1,'ความสม่ำเสมอของการผสม',1),
(21,12,2,3,1,'ความชื้นผง',1),
-- Drying moisture check (18)
(18,12,1,3,1,'ความชื้นหลังอบ',1),
-- Packaging seal (35) + label (36)
(35,15,1,10,1,'ความสมบูรณ์ของซีล',1),
(36,16,1,10,1,'ความถูกต้องของฉลาก',1);

-- ---------------------------------------------------------------------
-- 8) Packaging tolerances (QC packaging criteria) — ids 1..5
-- ---------------------------------------------------------------------
INSERT INTO packaging_tolerances (packaging_category, tolerance_percent, is_active, notes, created_by_user_id, created_at, updated_at) VALUES
('capsule',2.50,1,'แคปซูลเปล่า',1,NOW(),NOW()),
('bottle',1.00,1,'ขวดบรรจุ',1,NOW(),NOW()),
('blister',2.00,1,'แผงบรรจุ',1,NOW(),NOW()),
('label',0.50,1,'ฉลาก',1,NOW(),NOW()),
('box',3.00,1,'กล่องบรรจุ',1,NOW(),NOW());

-- ---------------------------------------------------------------------
-- 9) Receipt tolerances (GRN) — ids 1..3
-- ---------------------------------------------------------------------
INSERT INTO receipt_tolerances (category, tolerance_percent, is_active, notes, created_at, updated_at) VALUES
('raw_material',5.00,1,'ผลต่างที่ยอมรับได้สำหรับวัตถุดิบ',NOW(),NOW()),
('packaging',3.00,1,'ผลต่างสำหรับบรรจุภัณฑ์',NOW(),NOW()),
('finished_goods',1.00,1,'ผลต่างสำหรับสินค้าสำเร็จรูป',NOW(),NOW());

-- ---------------------------------------------------------------------
-- 10) Receipt checklist templates (UTF-8 clean Thai) — ids 1..3
-- ---------------------------------------------------------------------
INSERT INTO receipt_checklist_templates (category, version, is_current, items_json, created_by_user_id, created_at) VALUES
('raw_material',1,1, CAST('[{"id":1,"label":"มีใบรับรองผลวิเคราะห์ (COA) แนบครบถ้วน","sortOrder":1,"isMandatory":true},{"id":2,"label":"ตรวจวันผลิต/วันหมดอายุ และอายุคงเหลือเพียงพอ","sortOrder":2,"isMandatory":true},{"id":3,"label":"ภาชนะบรรจุสะอาด ไม่ชำรุด ไม่รั่ว","sortOrder":3,"isMandatory":true},{"id":4,"label":"ฉลากระบุชื่อ Lot และผู้ผลิตถูกต้อง","sortOrder":4,"isMandatory":true},{"id":5,"label":"ลักษณะภายนอกของวัตถุดิบเป็นปกติ","sortOrder":5,"isMandatory":false}]' AS JSON),1,NOW()),
('packaging',1,1, CAST('[{"id":1,"label":"ตรงตามสเปคขนาด/ชนิดบรรจุภัณฑ์","sortOrder":1,"isMandatory":true},{"id":2,"label":"สะอาด ไม่ชำรุด ไม่มีสิ่งปนเปื้อน","sortOrder":2,"isMandatory":true},{"id":3,"label":"จำนวนตรงกับใบส่งของ","sortOrder":3,"isMandatory":true},{"id":4,"label":"มีฉลากระบุ Lot ผู้ผลิต","sortOrder":4,"isMandatory":false}]' AS JSON),1,NOW()),
('finished_goods',1,1, CAST('[{"id":1,"label":"ฉลากผลิตภัณฑ์ถูกต้อง ครบถ้วน","sortOrder":1,"isMandatory":true},{"id":2,"label":"ระบุ Lot และวันหมดอายุชัดเจน","sortOrder":2,"isMandatory":true},{"id":3,"label":"บรรจุภัณฑ์ปิดผนึกสมบูรณ์","sortOrder":3,"isMandatory":true},{"id":4,"label":"จำนวนตรงกับเอกสาร","sortOrder":4,"isMandatory":true}]' AS JSON),1,NOW());

-- ---------------------------------------------------------------------
-- 11) Standard weights (ลูกตุ้มมาตรฐาน) — ids 1..4
-- ---------------------------------------------------------------------
INSERT INTO standard_weights
(code, denomination_value, denomination_unit, accuracy_class, certificate_number, certificate_issuer,
 certificate_issue_date, certificate_expiry_date, owner_department, is_active, notes, created_by_user_id, created_at, updated_at) VALUES
('SW-1G',1.0000,'g','E2','CERT-SW-1G-2026','สถาบันมาตรวิทยาแห่งชาติ','2026-01-05','2027-01-04','QC',1,'ลูกตุ้มมาตรฐาน 1 กรัม',1,NOW(),NOW()),
('SW-100G',100.0000,'g','F1','CERT-SW-100G-2026','สถาบันมาตรวิทยาแห่งชาติ','2026-01-05','2027-01-04','คลังชั่ง',1,'ลูกตุ้มมาตรฐาน 100 กรัม',1,NOW(),NOW()),
('SW-1KG',1.0000,'kg','F1','CERT-SW-1KG-2026','สถาบันมาตรวิทยาแห่งชาติ','2026-01-05','2027-01-04','คลังชั่ง',1,'ลูกตุ้มมาตรฐาน 1 กิโลกรัม',1,NOW(),NOW()),
('SW-20KG',20.0000,'kg','M1','CERT-SW-20KG-2026','สถาบันมาตรวิทยาแห่งชาติ','2026-01-05','2027-01-04','คลังชั่ง',1,'ลูกตุ้มมาตรฐาน 20 กิโลกรัม',1,NOW(),NOW());

-- ---------------------------------------------------------------------
-- 12) Maintenance plan templates — ids 1..4
-- ---------------------------------------------------------------------
INSERT INTO maintenance_plan_templates (name, description, maintenance_type, interval_type, interval_value, alert_days_before, is_active, created_by_user_id, created_at, updated_at) VALUES
('สอบเทียบเครื่องชั่งประจำปี','สอบเทียบเครื่องชั่งกับลูกตุ้มมาตรฐานที่ผ่านการรับรอง','calibration','months',12,30,1,1,NOW(),NOW()),
('บำรุงรักษาเครื่องบดทุก 3 เดือน','ตรวจสอบและหล่อลื่นเครื่องบด','preventive','months',3,7,1,1,NOW(),NOW()),
('ตรวจสอบเครื่องบรรจุแคปซูลรายเดือน','ตรวจสอบความแม่นยำน้ำหนักบรรจุ','preventive','months',1,7,1,1,NOW(),NOW()),
('ทำความสะอาดใหญ่เครื่องผสมรายสัปดาห์','ทำความสะอาดเชิงลึกเครื่องผสม','cleaning','weeks',1,2,1,1,NOW(),NOW());

-- ---------------------------------------------------------------------
-- 13) Item code patterns (per type) — ids 1..5
-- ---------------------------------------------------------------------
INSERT INTO item_code_patterns (item_type, prefix, `separator`, padding, include_year, year_format, year_position, sequence_start, is_active, notes, created_at, updated_at) VALUES
('raw_material','RM','-',4,0,'YYYY','after_prefix',1,1,'รหัสวัตถุดิบ',NOW(),NOW()),
('packaging','PK','-',4,0,'YYYY','after_prefix',1,1,'รหัสบรรจุภัณฑ์',NOW(),NOW()),
('wip','WIP','-',4,0,'YYYY','after_prefix',1,1,'รหัสกึ่งสำเร็จรูป',NOW(),NOW()),
('finished_goods','FG','-',4,0,'YYYY','after_prefix',1,1,'รหัสสินค้าสำเร็จรูป',NOW(),NOW()),
('consumable','CS','-',4,0,'YYYY','after_prefix',1,1,'รหัสวัสดุสิ้นเปลือง',NOW(),NOW());

-- ---------------------------------------------------------------------
-- 14) Lot patterns — ids 1..2
-- ---------------------------------------------------------------------
INSERT INTO lot_patterns (pattern_type, prefix, `separator`, include_date, date_format, sequence_type, sequence_length, sequence_start, hint_th, hint_en, is_active, notes, created_at, updated_at) VALUES
('internal','LOT','-',1,'YYYYMMDD','sequential',3,1,'รูปแบบเลข Lot ภายใน เช่น LOT-20260115-001','Internal lot e.g. LOT-20260115-001',1,'สำหรับ Lot ที่ระบบสร้าง',NOW(),NOW()),
('vendor','V','-',0,'YYYYMMDD','random',6,1,'รูปแบบเลข Lot ของผู้ขาย','Vendor lot pattern',1,'สำหรับตรวจรูปแบบ Lot ผู้ขาย',NOW(),NOW());

SET FOREIGN_KEY_CHECKS = 1;

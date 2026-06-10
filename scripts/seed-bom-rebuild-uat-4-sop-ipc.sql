-- =====================================================================
-- BOM Rebuild Seed — Part 4: SOP steps + In-Process QC (IPC) + work_order repoint
-- IPC criteria are dosage-form specific:
--   capsule 1-6, tablet 7-11, powder 12-14, packaging 15-16
-- =====================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- SOP STEPS — generic GMP pipeline per dosage form
-- ---------------------------------------------------------------------
-- Solid-dose capsule (1,2,3,15)
INSERT INTO bom_sop_steps (bom_id,sequence,step_name,step_name_th,phase,is_critical,requires_verification) VALUES
 (1,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (1,2,'Weighing','การชั่งน้ำหนักวัตถุดิบ','pre_production',1,1),
 (1,3,'Dry blending','การผสมแห้ง','production',1,1),
 (1,4,'Sieving','การร่อนผง','production',0,1),
 (1,5,'Capsule filling','การบรรจุลงแคปซูล','production',1,1),
 (1,6,'In-process check','การควบคุมระหว่างผลิต','production',0,1),
 (1,7,'Bottling & labeling','การบรรจุขวดและติดฉลาก','packaging',0,1),
 (1,8,'Final inspection','การตรวจสอบขั้นสุดท้าย','post_production',0,1),
 (2,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (2,2,'Weighing','การชั่งน้ำหนักวัตถุดิบ','pre_production',1,1),
 (2,3,'Dry blending','การผสมแห้ง','production',1,1),
 (2,4,'Sieving','การร่อนผง','production',0,1),
 (2,5,'Capsule filling','การบรรจุลงแคปซูล','production',1,1),
 (2,6,'In-process check','การควบคุมระหว่างผลิต','production',0,1),
 (2,7,'Bottling & labeling','การบรรจุขวดและติดฉลาก','packaging',0,1),
 (2,8,'Final inspection','การตรวจสอบขั้นสุดท้าย','post_production',0,1),
 (3,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (3,2,'Weighing','การชั่งน้ำหนักวัตถุดิบ','pre_production',1,1),
 (3,3,'Dry blending','การผสมแห้ง','production',1,1),
 (3,4,'Capsule filling','การบรรจุลงแคปซูล','production',1,1),
 (3,5,'Bottling & labeling','การบรรจุขวดและติดฉลาก','packaging',0,1),
 (3,6,'Final inspection','การตรวจสอบขั้นสุดท้าย','post_production',0,1),
 (15,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (15,2,'Weighing','การชั่งน้ำหนักวัตถุดิบ','pre_production',1,1),
 (15,3,'Dry blending','การผสมแห้ง','production',1,1),
 (15,4,'Capsule filling','การบรรจุลงแคปซูล','production',1,1),
 (15,5,'Bottling & labeling','การบรรจุขวดและติดฉลาก','packaging',0,1),
 (15,6,'Final inspection','การตรวจสอบขั้นสุดท้าย','post_production',0,1);

-- Tablet (4,16)
INSERT INTO bom_sop_steps (bom_id,sequence,step_name,step_name_th,phase,is_critical,requires_verification) VALUES
 (4,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (4,2,'Weighing','การชั่งน้ำหนักวัตถุดิบ','pre_production',1,1),
 (4,3,'Milling','การบดวัตถุดิบ','production',0,1),
 (4,4,'Blending','การผสม','production',1,1),
 (4,5,'Tablet compression','การตอกเม็ด','production',1,1),
 (4,6,'In-process check','การควบคุมระหว่างผลิต','production',0,1),
 (4,7,'Bottling & labeling','การบรรจุและติดฉลาก','packaging',0,1),
 (16,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (16,2,'Weighing','การชั่งน้ำหนักวัตถุดิบ','pre_production',1,1),
 (16,3,'Blending','การผสม','production',1,1),
 (16,4,'Tablet compression','การตอกเม็ด','production',1,1),
 (16,5,'Bottling & labeling','การบรรจุและติดฉลาก','packaging',0,1);

-- Powder/sachet (5,6,17)
INSERT INTO bom_sop_steps (bom_id,sequence,step_name,step_name_th,phase,is_critical,requires_verification) VALUES
 (5,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (5,2,'Weighing','การชั่งน้ำหนักวัตถุดิบ','pre_production',1,1),
 (5,3,'Blending','การผสมผง','production',1,1),
 (5,4,'Sachet filling','การบรรจุซอง','packaging',1,1),
 (6,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (6,2,'Weighing','การชั่งน้ำหนักวัตถุดิบ','pre_production',1,1),
 (6,3,'Blending','การผสมผง','production',1,1),
 (6,4,'Sachet filling','การบรรจุซอง','packaging',1,1),
 (17,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (17,2,'Weighing','การชั่งน้ำหนักวัตถุดิบ','pre_production',1,1),
 (17,3,'Blending','การผสมผง','production',1,1),
 (17,4,'Sachet filling','การบรรจุซอง','packaging',1,1);

-- Liquid syrup (7,18)
INSERT INTO bom_sop_steps (bom_id,sequence,step_name,step_name_th,phase,is_critical,requires_verification) VALUES
 (7,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (7,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (7,3,'Syrup heating','การต้มน้ำเชื่อม','production',1,1),
 (7,4,'Mixing','การผสมตัวยา','production',1,1),
 (7,5,'Filtration','การกรอง','production',0,1),
 (7,6,'Bottling & labeling','การบรรจุขวดและติดฉลาก','packaging',0,1),
 (18,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (18,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (18,3,'Syrup heating','การต้มน้ำเชื่อม','production',1,1),
 (18,4,'Mixing','การผสมตัวยา','production',1,1),
 (18,5,'Bottling & labeling','การบรรจุขวดและติดฉลาก','packaging',0,1);

-- Bolus (8,19) / Balm (9,20) / Cream (10) / Oil (11) / Inhaler (12) / Compress (13,21) / Lozenge (14)
INSERT INTO bom_sop_steps (bom_id,sequence,step_name,step_name_th,phase,is_critical,requires_verification) VALUES
 (8,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (8,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (8,3,'Kneading','การนวดผสมกับน้ำผึ้ง','production',1,1),
 (8,4,'Bolus forming','การปั้นลูกกลอน','production',1,1),
 (8,5,'Drying','การอบแห้ง','post_production',0,1),
 (8,6,'Bottling & labeling','การบรรจุและติดฉลาก','packaging',0,1),
 (19,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (19,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (19,3,'Kneading','การนวดผสม','production',1,1),
 (19,4,'Bolus forming','การปั้นลูกกลอน','production',1,1),
 (19,5,'Bottling & labeling','การบรรจุและติดฉลาก','packaging',0,1),
 (9,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (9,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (9,3,'Base melting','การหลอมเบส','production',1,1),
 (9,4,'Active mixing','การผสมตัวยาหอมระเหย','production',1,1),
 (9,5,'Filling & cooling','การเทลงขวดและทิ้งให้เซ็ตตัว','packaging',1,1),
 (20,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (20,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (20,3,'Base melting','การหลอมเบส','production',1,1),
 (20,4,'Active mixing','การผสมตัวยา','production',1,1),
 (20,5,'Filling & cooling','การเทลงขวด','packaging',1,1),
 (10,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (10,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (10,3,'Emulsification','การทำอิมัลชัน','production',1,1),
 (10,4,'Homogenizing','การโฮโมจีไนซ์','production',0,1),
 (10,5,'Cooling','การลดอุณหภูมิ','post_production',0,1),
 (10,6,'Filling & labeling','การบรรจุตลับและติดฉลาก','packaging',0,1),
 (11,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (11,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (11,3,'Oil blending','การผสมน้ำมัน','production',1,1),
 (11,4,'Bottling & labeling','การบรรจุขวดและติดฉลาก','packaging',0,1),
 (12,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (12,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (12,3,'Aromatic blending','การผสมตัวยาหอมระเหย','production',1,1),
 (12,4,'Filling','การบรรจุหลอดยาดม','packaging',1,1),
 (13,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (13,2,'Weighing','การชั่งสมุนไพร','pre_production',1,1),
 (13,3,'Wrapping','การห่อลูกประคบ','packaging',1,1),
 (21,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (21,2,'Weighing','การชั่งสมุนไพร','pre_production',1,1),
 (21,3,'Wrapping','การห่อลูกประคบ','packaging',1,1),
 (14,1,'Line clearance','ตรวจสอบความพร้อมสายการผลิต','pre_production',0,1),
 (14,2,'Weighing','การชั่งวัตถุดิบ','pre_production',1,1),
 (14,3,'Syrup boiling','การเคี่ยวน้ำเชื่อม','production',1,1),
 (14,4,'Molding','การขึ้นรูปเม็ดอม','production',1,1),
 (14,5,'Blister packing','การบรรจุแผงบลิสเตอร์','packaging',0,1);

-- ---------------------------------------------------------------------
-- IN-PROCESS QC (IPC) — dosage-form-specific criteria
-- ---------------------------------------------------------------------
INSERT INTO bom_in_process_qc (bom_id,criteria_id,sequence,sample_size,is_critical,phase) VALUES
-- Capsules → avg wt, fill wt, appearance, locking
 (1,1,1,10,1,'production'),(1,2,2,10,1,'production'),(1,5,3,20,0,'production'),(1,6,4,20,0,'production'),
 (2,1,1,10,1,'production'),(2,2,2,10,1,'production'),(2,5,3,20,0,'production'),(2,6,4,20,0,'production'),
 (3,1,1,10,1,'production'),(3,2,2,10,1,'production'),(3,5,3,20,0,'production'),
 (15,1,1,10,1,'production'),(15,2,2,10,1,'production'),(15,5,3,20,0,'production'),
-- Tablet → avg wt, hardness, friability, disintegration, thickness
 (4,7,1,20,1,'production'),(4,8,2,10,0,'production'),(4,9,3,10,0,'production'),(4,10,4,6,1,'production'),(4,11,5,10,0,'production'),
 (16,7,1,20,1,'production'),(16,8,2,10,0,'production'),(16,10,3,6,1,'production'),
-- Powder/sachet → moisture, blend uniformity, particle size
 (5,12,1,3,0,'production'),(5,13,2,10,1,'production'),(5,14,3,3,0,'production'),
 (6,12,1,3,0,'production'),(6,13,2,10,1,'production'),
 (17,12,1,3,0,'production'),(17,13,2,10,1,'production'),(17,14,3,3,0,'production'),
-- Bolus → moisture, blend uniformity
 (8,12,1,5,0,'production'),(8,13,2,5,1,'production'),
 (19,12,1,5,0,'production'),(19,13,2,5,1,'production'),
-- Lozenge → avg wt, moisture
 (14,7,1,20,1,'production'),(14,12,2,3,0,'production'),
-- Liquid / cream / oil / balm / inhaler / compress → packaging-level checks (seal/label) at packaging
 (7,15,1,5,1,'packaging'),(7,16,2,5,0,'packaging'),
 (18,15,1,5,1,'packaging'),
 (9,15,1,5,1,'packaging'),(9,16,2,5,0,'packaging'),
 (20,15,1,5,1,'packaging'),
 (10,15,1,5,1,'packaging'),(10,16,2,5,0,'packaging'),
 (11,15,1,5,1,'packaging'),
 (12,15,1,5,1,'packaging'),
 (13,16,1,5,0,'packaging'),
 (21,16,1,5,0,'packaging');

-- ---------------------------------------------------------------------
-- REPOINT pre-existing test work_orders to valid BOM/product ids
-- (old product_ids 53-59 were phantom; map to the matching rebuilt BOM)
-- ---------------------------------------------------------------------
UPDATE work_orders SET bom_id=1,  product_id=9  WHERE id IN (1,10);
UPDATE work_orders SET bom_id=2,  product_id=10 WHERE id IN (2,11,13);
UPDATE work_orders SET bom_id=3,  product_id=11 WHERE id=3;
UPDATE work_orders SET bom_id=4,  product_id=50 WHERE id=4;
UPDATE work_orders SET bom_id=5,  product_id=51 WHERE id=5;
UPDATE work_orders SET bom_id=6,  product_id=52 WHERE id=6;
UPDATE work_orders SET bom_id=7,  product_id=53 WHERE id=7;
UPDATE work_orders SET bom_id=8,  product_id=54 WHERE id=8;
UPDATE work_orders SET bom_id=9,  product_id=55 WHERE id=9;

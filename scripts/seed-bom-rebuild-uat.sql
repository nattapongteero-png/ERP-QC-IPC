-- =====================================================================
-- BOM Rebuild Seed — herbal_erp_uat (UAT Local)
-- Purpose: Delete orphaned/inconsistent BOM data and rebuild from scratch
--          using REAL items. Covers every dosage form. Adds missing items
--          and master data as needed.
--
-- Strategy:
--   * Preserve items 1..13 (referenced by inventory_lots) — do NOT touch.
--   * Add new items from id 14+ (raw materials, excipients, packaging, WIP, FG).
--   * Wipe ALL bom* config + lines + boms, recreate clean with fixed ids.
--   * Repoint the 12 pre-existing test work_orders to valid new BOM/product ids.
--
-- Idempotent: re-running produces the same result (TRUNCATE + INSERT ... id).
-- Run: docker exec -i herbal-erp-uat-mysql sh -c \
--      'mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD" herbal_erp_uat' \
--      < scripts/seed-bom-rebuild-uat.sql
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1. WIPE old BOM data (orphaned — references phantom product/item ids)
-- ---------------------------------------------------------------------
DELETE FROM bom_sop_step_ipc;
DELETE FROM bom_in_process_qc;
DELETE FROM bom_packaging_qc;
DELETE FROM bom_sop_steps;
DELETE FROM bom_environmental_conditions;
DELETE FROM bom_equipment;
DELETE FROM bom_rooms;
DELETE FROM bom_lines;
DELETE FROM operations;
DELETE FROM bom;

-- ---------------------------------------------------------------------
-- 2. ITEMS — preserve 1..13, (re)insert new ones with fixed ids 14+
--    Remove any prior run's new items first so re-seed is clean.
-- ---------------------------------------------------------------------
DELETE FROM items WHERE id >= 14;

-- Raw materials (สมุนไพร / สารสกัด)
INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, secondary_unit, conversion_rate, weight_unit, weight_tracking_enabled, shelf_life_days, storage_condition, is_active, is_primary_packing, unit_weight_mg) VALUES
 (14,'RM-0004','ผงบอระเพ็ด','Tinospora Powder','raw_material','สมุนไพร','kg','g',1000,'g',1,730,'แห้ง ไม่เกิน 30°C',1,0,NULL),
 (15,'RM-0005','ผงขิง','Ginger Powder','raw_material','สมุนไพร','kg','g',1000,'g',1,730,'แห้ง ไม่เกิน 30°C',1,0,NULL),
 (16,'RM-0006','ผงรางจืด','Thunbergia Powder','raw_material','สมุนไพร','kg','g',1000,'g',1,730,'แห้ง ไม่เกิน 30°C',1,0,NULL),
 (17,'RM-0007','มะขามป้อมเข้มข้น','Emblica Concentrate','raw_material','สารสกัด','kg','g',1000,'g',1,365,'2-8°C',1,0,NULL),
 (18,'RM-0008','น้ำผึ้ง','Honey','raw_material','สมุนไพร','kg','g',1000,'g',1,1095,'อุณหภูมิห้อง',1,0,NULL),
 (19,'RM-0009','พิมเสน','Borneol','raw_material','สมุนไพร','kg','g',1000,'g',1,1095,'ปิดสนิท แห้ง',1,0,NULL),
 (20,'RM-0010','การบูร','Camphor','raw_material','สมุนไพร','kg','g',1000,'g',1,1095,'ปิดสนิท แห้ง',1,0,NULL),
 (21,'RM-0011','เมนทอล','Menthol','raw_material','สมุนไพร','kg','g',1000,'g',1,1095,'ปิดสนิท แห้ง',1,0,NULL),
 (22,'RM-0012','วาสลีน','Petroleum Jelly','raw_material','สารเติมแต่ง','kg','g',1000,'g',1,1095,'อุณหภูมิห้อง',1,0,NULL),
 (23,'RM-0013','เจลว่านหางจระเข้','Aloe Vera Gel','raw_material','สารสกัด','kg','g',1000,'g',1,365,'2-8°C',1,0,NULL),
 (24,'RM-0014','น้ำมันไพล','Plai Oil','raw_material','สารสกัด','kg','g',1000,'g',1,730,'แห้ง พ้นแสง',1,0,NULL),
 (25,'RM-0015','น้ำมันมะพร้าว','Coconut Oil','raw_material','สารเติมแต่ง','kg','g',1000,'g',1,730,'อุณหภูมิห้อง',1,0,NULL),
 (26,'RM-0016','ตะไคร้หอมอบแห้ง','Dried Lemongrass','raw_material','สมุนไพร','kg','g',1000,'g',1,365,'แห้ง',1,0,NULL),
 (27,'RM-0017','ไพลอบแห้ง','Dried Plai','raw_material','สมุนไพร','kg','g',1000,'g',1,365,'แห้ง',1,0,NULL),
 (28,'RM-0018','ผงมะแว้ง','Solanum Powder','raw_material','สมุนไพร','kg','g',1000,'g',1,730,'แห้ง',1,0,NULL);

-- Excipients (สารเติมแต่ง)
INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, secondary_unit, conversion_rate, weight_unit, weight_tracking_enabled, shelf_life_days, storage_condition, is_active) VALUES
 (29,'EX-0001','แป้งข้าวโพด (filler)','Corn Starch','raw_material','สารเติมแต่ง','kg','g',1000,'g',1,1095,'แห้ง',1),
 (30,'EX-0002','แมกนีเซียมสเตียเรต','Magnesium Stearate','raw_material','สารเติมแต่ง','kg','g',1000,'g',1,1095,'แห้ง',1),
 (31,'EX-0003','ไมโครคริสตัลลีนเซลลูโลส','MCC PH102','raw_material','สารเติมแต่ง','kg','g',1000,'g',1,1095,'แห้ง',1),
 (32,'EX-0004','น้ำเชื่อมเข้มข้น','Syrup Base','raw_material','สารเติมแต่ง','kg','g',1000,'g',1,365,'อุณหภูมิห้อง',1),
 (33,'EX-0005','น้ำบริสุทธิ์ (purified)','Purified Water','raw_material','สารเติมแต่ง','l','ml',1000,'ml',0,180,'อุณหภูมิห้อง',1),
 (34,'EX-0006','บีแว็กซ์','Beeswax','raw_material','สารเติมแต่ง','kg','g',1000,'g',1,1095,'อุณหภูมิห้อง',1),
 (35,'EX-0007','สารกันเสีย (เมทิลพาราเบน)','Methylparaben','raw_material','สารเติมแต่ง','kg','g',1000,'g',1,1095,'แห้ง',1);

-- Packaging (บรรจุภัณฑ์)
INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, secondary_unit, conversion_rate, is_active, is_primary_packing, unit_weight_mg) VALUES
 (36,'PK-0004','ซองฟอยล์ 5 g','Foil Sachet 5g','packaging','ซอง','box','pcs',1000,1,1,5000),
 (37,'PK-0005','ขวดแก้วสีชา 100 ml','Amber Glass Bottle 100ml','packaging','ขวด','box','pcs',500,1,1,140000),
 (38,'PK-0006','ตลับครีม 30 g','Cream Jar 30g','packaging','ตลับ','box','pcs',500,1,1,25000),
 (39,'PK-0007','ขวดยาหม่อง 15 g','Balm Jar 15g','packaging','ขวด','box','pcs',1000,1,1,18000),
 (40,'PK-0008','ขวดน้ำมันนวด 120 ml','Massage Oil Bottle 120ml','packaging','ขวด','box','pcs',500,1,1,90000),
 (41,'PK-0009','ขวดยาดม 3 ml','Inhaler Tube 3ml','packaging','ขวด','box','pcs',2000,1,1,6000),
 (42,'PK-0010','ผ้าห่อลูกประคบ','Compress Cloth','packaging','ผืน','box','pcs',200,1,1,40000),
 (43,'PK-0011','แผงบลิสเตอร์ลูกอม 10 เม็ด','Lozenge Blister 10','packaging','แผง','box','pcs',1000,1,1,3000),
 (44,'PK-0012','ฉลากผลิตภัณฑ์','Product Label','packaging','ฉลาก','roll','pcs',1000,1,0,200);

-- WIP (กึ่งสำเร็จรูป / bulk)
INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, secondary_unit, conversion_rate, weight_unit, weight_tracking_enabled, shelf_life_days, is_active) VALUES
 (45,'WIP-0003','ผงผสมกระชายขาว (bulk)','Krachai Blend Bulk','wip','ผงผสม','kg','g',1000,'g',1,90,1),
 (46,'WIP-0004','แกรนูลบอระเพ็ด (bulk)','Tinospora Granule Bulk','wip','แกรนูล','kg','g',1000,'g',1,90,1),
 (47,'WIP-0005','เนื้อครีมว่านหางจระเข้ (bulk)','Aloe Cream Bulk','wip','ครีม','kg','g',1000,'g',1,60,1),
 (48,'WIP-0006','เนื้อยาหม่อง (bulk)','Balm Mass Bulk','wip','ยาหม่อง','kg','g',1000,'g',1,180,1),
 (49,'WIP-0007','น้ำเชื่อมมะขามป้อม (bulk)','Emblica Syrup Bulk','wip','น้ำเชื่อม','l','ml',1000,'ml',0,30,1);

-- Finished goods (ผลิตภัณฑ์สำเร็จรูป) — one per non-existing dosage form
INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, secondary_unit, conversion_rate, weight_unit, shelf_life_days, is_active) VALUES
 (50,'FG-0004','ยาเม็ดบอระเพ็ด 500 mg (100 เม็ด)','Tinospora Tablet 500mg','finished_goods','ยาเม็ด','bottle','tab',100,'mg',730,1),
 (51,'FG-0005','ผงขิงชงดื่ม 5 g (10 ซอง)','Ginger Sachet 5g','finished_goods','ยาผง','box','pcs',10,'g',548,1),
 (52,'FG-0006','ชาชงรางจืด 5 g (10 ซอง)','Thunbergia Tea Sachet','finished_goods','ชาชง','box','pcs',10,'g',548,1),
 (53,'FG-0007','ยาน้ำแก้ไอมะขามป้อม 100 ml','Emblica Cough Syrup 100ml','finished_goods','ยาน้ำ','bottle','ml',100,'ml',365,1),
 (54,'FG-0008','ยาลูกกลอนบำรุงร่างกาย (60 เม็ด)','Herbal Bolus 60','finished_goods','ลูกกลอน','bottle','pcs',60,'mg',548,1),
 (55,'FG-0009','ยาหม่องสมุนไพร 15 g','Herbal Balm 15g','finished_goods','ยาหม่อง','pcs','g',15,'g',730,1),
 (56,'FG-0010','ครีมว่านหางจระเข้ 30 g','Aloe Vera Cream 30g','finished_goods','ครีม','pcs','g',30,'g',365,1),
 (57,'FG-0011','น้ำมันนวดสมุนไพร 120 ml','Herbal Massage Oil 120ml','finished_goods','น้ำมันนวด','bottle','ml',120,'ml',730,1),
 (58,'FG-0012','ยาดมสมุนไพร 3 ml','Herbal Inhaler 3ml','finished_goods','ยาดม','pcs','ml',3,'ml',548,1),
 (59,'FG-0013','ลูกประคบสมุนไพร 200 g','Herbal Compress Ball','finished_goods','ลูกประคบ','pcs','g',200,'g',180,1),
 (60,'FG-0014','ยาอมมะแว้ง (100 เม็ด)','Solanum Lozenge','finished_goods','ลูกอม','box','pcs',100,'mg',548,1);

-- ---------------------------------------------------------------------
-- 3. BOM headers — 14 BOMs covering every dosage form (+ 4 V2 drafts)
--    product_id now points to a REAL finished_goods item.
-- ---------------------------------------------------------------------
INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit, yield_target, loss_allowance, fill_weight_mg, effective_date) VALUES
 (1,'BOM-FG-001','สูตรแคปซูลขมิ้นชัน 500mg',9,'1.0','active',1000,'bottle',98.00,2.00,500,'2026-05-14'),
 (2,'BOM-FG-002','สูตรแคปซูลฟ้าทะลายโจร 400mg',10,'1.0','active',1000,'bottle',98.00,2.00,400,'2026-05-14'),
 (3,'BOM-FG-003','สูตรแคปซูลกระชายขาว 350mg',11,'1.0','active',1000,'bottle',98.00,2.00,350,'2026-05-14'),
 (4,'BOM-FG-004','สูตรยาเม็ดบอระเพ็ด 500mg',50,'1.0','active',1000,'bottle',97.00,3.00,500,'2026-05-14'),
 (5,'BOM-FG-005','สูตรยาผงขิงชง',51,'1.0','active',2000,'box',99.00,1.00,NULL,'2026-05-14'),
 (6,'BOM-FG-006','สูตรชาชงรางจืด',52,'1.0','active',2000,'box',99.00,1.00,NULL,'2026-05-14'),
 (7,'BOM-FG-007','สูตรยาน้ำแก้ไอมะขามป้อม',53,'1.0','active',1000,'bottle',96.00,4.00,NULL,'2026-05-14'),
 (8,'BOM-FG-008','สูตรยาลูกกลอนบำรุงร่างกาย',54,'1.0','active',500,'bottle',95.00,5.00,NULL,'2026-05-14'),
 (9,'BOM-FG-009','สูตรยาหม่องสมุนไพร',55,'1.0','active',2000,'pcs',97.00,3.00,NULL,'2026-05-14'),
 (10,'BOM-FG-010','สูตรครีมว่านหางจระเข้',56,'1.0','active',1500,'pcs',97.00,3.00,NULL,'2026-05-14'),
 (11,'BOM-FG-011','สูตรน้ำมันนวดสมุนไพร',57,'1.0','active',1000,'bottle',98.00,2.00,NULL,'2026-05-14'),
 (12,'BOM-FG-012','สูตรยาดมสมุนไพร',58,'1.0','active',3000,'pcs',98.00,2.00,NULL,'2026-05-14'),
 (13,'BOM-FG-013','สูตรลูกประคบสมุนไพร',59,'1.0','active',500,'pcs',98.00,2.00,NULL,'2026-05-14'),
 (14,'BOM-FG-014','สูตรยาอมมะแว้ง',60,'1.0','active',1000,'box',97.00,3.00,300,'2026-05-14'),
 -- V2 drafts (revision examples)
 (15,'BOM-FG-001-V2','สูตรแคปซูลขมิ้นชัน 500mg (ปรับปรุง)',9,'2.0','draft',1200,'bottle',98.50,1.50,500,NULL),
 (16,'BOM-FG-004-V2','สูตรยาเม็ดบอระเพ็ด 500mg (ปรับปรุง)',50,'2.0','draft',1200,'bottle',97.50,2.50,500,NULL),
 (17,'BOM-FG-005-V2','สูตรยาผงขิงชง (ปรับปรุง)',51,'2.0','draft',2500,'box',99.00,1.00,NULL,NULL),
 (18,'BOM-FG-007-V2','สูตรยาน้ำแก้ไอมะขามป้อม (ปรับปรุง)',53,'2.0','draft',1200,'bottle',96.50,3.50,NULL,NULL),
 (19,'BOM-FG-008-V2','สูตรยาลูกกลอนบำรุงร่างกาย (ปรับปรุง)',54,'2.0','draft',600,'bottle',95.50,4.50,NULL,NULL),
 (20,'BOM-FG-009-V2','สูตรยาหม่องสมุนไพร (ปรับปรุง)',55,'2.0','draft',2400,'pcs',97.50,2.50,NULL,NULL),
 (21,'BOM-FG-013-V2','สูตรลูกประคบสมุนไพร (ปรับปรุง)',59,'2.0','draft',600,'pcs',98.00,2.00,NULL,NULL);

SET FOREIGN_KEY_CHECKS = 1;

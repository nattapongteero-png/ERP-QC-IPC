-- =====================================================================
-- UAT local reseed: items (all 5 types, all fields) + receiving lots
-- (with value) + inbound inventory transactions.
-- Safe order: transactions -> lots -> items, then insert fresh.
-- Charset: run via mysql --default-character-set=utf8mb4
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) Wipe existing item-related stock data (UAT only)
DELETE FROM inventory_transactions;
DELETE FROM inventory_lots;
DELETE FROM items;
ALTER TABLE items AUTO_INCREMENT = 1;
ALTER TABLE inventory_lots AUTO_INCREMENT = 1;
ALTER TABLE inventory_transactions AUTO_INCREMENT = 1;

-- 2) Insert items — every type, every meaningful column populated.
-- Types in use: raw_material, packaging, wip, finished_goods, consumable
INSERT INTO items
(code, name_th, name_en, type, category, primary_unit, secondary_unit, conversion_rate,
 weight_unit, secondary_to_weight_rate, weight_tracking_enabled, shelf_life_days, storage_condition,
 min_stock, max_stock, reorder_point, is_lot_controlled, is_fefo, is_active,
 confidentiality_level, default_confidential, tpp_code, tpp_name, ttmt_code, ttmt_name, drug_code_24,
 vmi_sync_enabled, strength, strength_value, strength_unit, g_reg_number,
 standard_cost, sga_allocation_rate, is_primary_packing, unit_weight_mg)
VALUES
-- ---------- RAW MATERIALS (สมุนไพร/สารสกัด) ----------
('RM-0001','ผงขมิ้นชัน','Turmeric Powder','raw_material','สมุนไพร','kg','g',1000,
 'g',1,1,730,'เก็บในที่แห้ง อุณหภูมิห้อง หลีกเลี่ยงแสง',
 5,500,50,1,1,1,'PUBLIC',0,'1000000000001','ขมิ้นชัน TPP','TTM-0001','ขมิ้นชัน','100000000000000000000001',
 0,'curcumin 95',95,'%',NULL,
 350.0000,5.00,0,NULL),
('RM-0002','ผงฟ้าทะลายโจร','Andrographis Powder','raw_material','สมุนไพร','kg','g',1000,
 'g',1,1,730,'เก็บในที่แห้ง อุณหภูมิห้อง',
 5,400,40,1,1,1,'PUBLIC',0,'1000000000002','ฟ้าทะลายโจร TPP','TTM-0002','ฟ้าทะลายโจร','100000000000000000000002',
 0,'andrographolide 4',4,'%',NULL,
 420.0000,5.00,0,NULL),
('RM-0003','สารสกัดกระชายขาว','Fingerroot Extract','raw_material','สารสกัด','kg','g',1000,
 'g',1,1,548,'เก็บในตู้เย็น 2-8°C',
 2,100,20,1,1,1,'CONFIDENTIAL',1,'1000000000003','กระชายขาว TPP','TTM-0003','กระชายขาว','100000000000000000000003',
 0,'panduratin 1.5',1.5,'%',NULL,
 1850.0000,8.00,0,NULL),

-- ---------- PACKAGING (บรรจุภัณฑ์ รวมแคปซูลเปล่า) ----------
('PK-0001','แคปซูลเปล่า ขนาด 0','Empty Capsule Size 0','packaging','แคปซูล','box','cap',5000,
 NULL,NULL,0,1095,'เก็บในที่แห้ง อุณหภูมิห้อง',
 10,200,30,1,1,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,
 0,NULL,NULL,NULL,NULL,
 0.0192,0.00,1,96.0000),
('PK-0002','แคปซูลเปล่า ขนาด 00','Empty Capsule Size 00','packaging','แคปซูล','box','cap',5000,
 NULL,NULL,0,1095,'เก็บในที่แห้ง อุณหภูมิห้อง',
 5,100,15,1,1,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,
 0,NULL,NULL,NULL,NULL,
 0.0236,0.00,1,118.0000),
('PK-0003','ขวดพลาสติก HDPE 60 cc','HDPE Bottle 60cc','packaging','ขวด','box','pcs',100,
 NULL,NULL,0,1825,'เก็บในที่แห้ง อุณหภูมิห้อง',
 20,500,50,1,0,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,
 0,NULL,NULL,NULL,NULL,
 3.5000,0.00,1,8500.0000),

-- ---------- WIP (กึ่งสำเร็จรูป / ผงผสม bulk) ----------
('WIP-0001','ผงผสมขมิ้นชัน (bulk)','Turmeric Blend Bulk','wip','ผงผสม','kg','g',1000,
 'g',1,1,365,'เก็บในถุงสุญญากาศ อุณหภูมิห้อง',
 2,50,10,1,1,1,'INTERNAL',0,NULL,NULL,NULL,NULL,NULL,
 0,'curcumin 90',90,'%',NULL,
 480.0000,6.00,0,NULL),
('WIP-0002','ผงผสมฟ้าทะลายโจร (bulk)','Andrographis Blend Bulk','wip','ผงผสม','kg','g',1000,
 'g',1,1,365,'เก็บในถุงสุญญากาศ อุณหภูมิห้อง',
 2,40,8,1,1,1,'INTERNAL',0,NULL,NULL,NULL,NULL,NULL,
 0,'andrographolide 4',4,'%',NULL,
 530.0000,6.00,0,NULL),

-- ---------- FINISHED GOODS (ยาสำเร็จรูป) ----------
('FG-0001','แคปซูลขมิ้นชัน 500 mg (60 แคปซูล)','Turmeric Capsule 500mg (60s)','finished_goods','ยาแคปซูล','bottle','cap',60,
 'mg',500,1,730,'เก็บในที่แห้ง อุณหภูมิห้อง หลีกเลี่ยงแสงแดด',
 50,2000,200,1,1,1,'PUBLIC',0,'2000000000001','ยาแคปซูลขมิ้นชัน','TTM-1001','ขมิ้นชันแคปซูล','200000000000000000000001',
 1,'500 mg/แคปซูล',500,'mg/แคปซูล','G 123/2566',
 95.0000,10.00,0,NULL),
('FG-0002','แคปซูลฟ้าทะลายโจร 400 mg (60 แคปซูล)','Andrographis Capsule 400mg (60s)','finished_goods','ยาแคปซูล','bottle','cap',60,
 'mg',400,1,730,'เก็บในที่แห้ง อุณหภูมิห้อง',
 50,1500,150,1,1,1,'PUBLIC',0,'2000000000002','ยาแคปซูลฟ้าทะลายโจร','TTM-1002','ฟ้าทะลายโจรแคปซูล','200000000000000000000002',
 1,'400 mg/แคปซูล',400,'mg/แคปซูล','G 124/2566',
 88.0000,10.00,0,NULL),
('FG-0003','แคปซูลกระชายขาว 350 mg (30 แคปซูล)','Fingerroot Capsule 350mg (30s)','finished_goods','ยาแคปซูล','bottle','cap',30,
 'mg',350,1,548,'เก็บในที่แห้ง อุณหภูมิห้อง',
 30,800,80,1,1,1,'CONFIDENTIAL',1,'2000000000003','ยาแคปซูลกระชายขาว','TTM-1003','กระชายขาวแคปซูล','200000000000000000000003',
 0,'350 mg/แคปซูล',350,'mg/แคปซูล','G 125/2566',
 145.0000,12.00,0,NULL),

-- ---------- CONSUMABLE (วัสดุสิ้นเปลือง) ----------
('CS-0001','ถุงมือไนไตรล์ ไซส์ M','Nitrile Gloves M','consumable','วัสดุสิ้นเปลือง','box','pcs',100,
 NULL,NULL,0,1095,'เก็บในที่แห้ง อุณหภูมิห้อง',
 10,100,20,0,0,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,
 0,NULL,NULL,NULL,NULL,
 120.0000,0.00,0,NULL),
('CS-0002','แอลกอฮอล์ 70% 5 ลิตร','Ethanol 70% 5L','consumable','วัสดุสิ้นเปลือง','gallon','ml',5000,
 NULL,NULL,0,730,'เก็บในที่เย็น ห่างจากเปลวไฟ',
 5,50,10,0,0,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,
 0,NULL,NULL,NULL,NULL,
 350.0000,0.00,0,NULL);

SET FOREIGN_KEY_CHECKS = 1;

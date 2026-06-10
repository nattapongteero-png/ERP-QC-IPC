-- =====================================================================
-- BOM Rebuild Seed — Part 3: BOM configuration
-- Rooms / Equipment / Environmental / SOP steps / IPC / Packaging QC
-- References REAL master data:
--   rooms 1-7, equipment 1-10, env_conditions 1-4,
--   ipc_criteria 1-16, packaging_qc_criteria 1-4
-- =====================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- ROOMS — phase pipeline per BOM
--   capsule/tablet (solid): weigh→mill→fill→qc→pack
--   powder/sachet: weigh→mix→pack
--   liquid/cream/oil/balm: weigh→mix→pack
--   compress: weigh→pack
-- ---------------------------------------------------------------------
INSERT INTO bom_rooms (bom_id,room_id,phase,sequence,is_required) VALUES
-- Solid dose (capsule 1,2,3,15 ; tablet 4,16 ; lozenge 14 ; bolus 8,19)
 (1,1,'pre_production',1,1),(1,3,'pre_production',2,1),(1,4,'production',3,1),(1,6,'post_production',4,1),(1,5,'packaging',5,1),
 (2,1,'pre_production',1,1),(2,3,'pre_production',2,1),(2,4,'production',3,1),(2,6,'post_production',4,1),(2,5,'packaging',5,1),
 (3,1,'pre_production',1,1),(3,3,'pre_production',2,1),(3,4,'production',3,1),(3,6,'post_production',4,1),(3,5,'packaging',5,1),
 (4,1,'pre_production',1,1),(4,2,'production',2,1),(4,6,'post_production',3,1),(4,5,'packaging',4,1),
 (8,1,'pre_production',1,1),(8,2,'production',2,1),(8,6,'post_production',3,1),(8,5,'packaging',4,1),
 (14,1,'pre_production',1,1),(14,2,'production',2,1),(14,6,'post_production',3,1),(14,5,'packaging',4,1),
-- Powder/sachet (5,6,17)
 (5,1,'pre_production',1,1),(5,2,'production',2,1),(5,5,'packaging',3,1),
 (6,1,'pre_production',1,1),(6,2,'production',2,1),(6,5,'packaging',3,1),
-- Liquid syrup (7,18)
 (7,1,'pre_production',1,1),(7,2,'production',2,1),(7,6,'post_production',3,1),(7,5,'packaging',4,1),
-- Balm (9,20) / Cream (10) / Oil (11) — semi-solid mixing
 (9,1,'pre_production',1,1),(9,2,'production',2,1),(9,5,'packaging',3,1),
 (10,1,'pre_production',1,1),(10,2,'production',2,1),(10,6,'post_production',3,1),(10,5,'packaging',4,1),
 (11,1,'pre_production',1,1),(11,2,'production',2,1),(11,5,'packaging',3,1),
-- Inhaler (12)
 (12,1,'pre_production',1,1),(12,2,'production',2,1),(12,5,'packaging',3,1),
-- Compress (13,21)
 (13,1,'pre_production',1,1),(13,5,'packaging',2,1),
-- V2 drafts mirror their base
 (15,1,'pre_production',1,1),(15,3,'pre_production',2,1),(15,4,'production',3,1),(15,6,'post_production',4,1),(15,5,'packaging',5,1),
 (16,1,'pre_production',1,1),(16,2,'production',2,1),(16,6,'post_production',3,1),(16,5,'packaging',4,1),
 (17,1,'pre_production',1,1),(17,2,'production',2,1),(17,5,'packaging',3,1),
 (18,1,'pre_production',1,1),(18,2,'production',2,1),(18,6,'post_production',3,1),(18,5,'packaging',4,1),
 (19,1,'pre_production',1,1),(19,2,'production',2,1),(19,6,'post_production',3,1),(19,5,'packaging',4,1),
 (20,1,'pre_production',1,1),(20,2,'production',2,1),(20,5,'packaging',3,1),
 (21,1,'pre_production',1,1),(21,5,'packaging',2,1);

-- ---------------------------------------------------------------------
-- EQUIPMENT
--   1 ภาชนะ100L, 2 เครื่องบรรจุแคปซูล, 3 เครื่องบด, 4 เครื่องผสมริบบอน,
--   5 เครื่องร่อน, 6 ชั่ง200kg, 7 ชั่ง1kg, 8 ชั่งวิเคราะห์, 9 เตาร้อน, 10 ช้อนตัก
-- ---------------------------------------------------------------------
INSERT INTO bom_equipment (bom_id,equipment_id,phase,sequence,is_required) VALUES
-- Capsules: weigh→mix→sieve→fill
 (1,6,'pre_production',1,1),(1,4,'production',2,1),(1,5,'production',3,1),(1,2,'production',4,1),
 (2,6,'pre_production',1,1),(2,4,'production',2,1),(2,5,'production',3,1),(2,2,'production',4,1),
 (3,6,'pre_production',1,1),(3,4,'production',2,1),(3,5,'production',3,1),(3,2,'production',4,1),
-- Tablet: weigh→mill→mix→sieve
 (4,6,'pre_production',1,1),(4,3,'production',2,1),(4,4,'production',3,1),(4,5,'production',4,1),
-- Powder sachet: weigh→mix→sieve
 (5,6,'pre_production',1,1),(5,4,'production',2,1),(5,5,'production',3,1),
 (6,6,'pre_production',1,1),(6,4,'production',2,1),(6,5,'production',3,1),
-- Syrup: weigh→heat→mix(container)
 (7,7,'pre_production',1,1),(7,9,'production',2,1),(7,1,'production',3,1),
-- Bolus: weigh→mix
 (8,6,'pre_production',1,1),(8,4,'production',2,1),(8,1,'production',3,1),
-- Balm: weigh→heat→mix
 (9,7,'pre_production',1,1),(9,9,'production',2,1),(9,1,'production',3,1),
-- Cream: weigh→heat→mix
 (10,7,'pre_production',1,1),(10,9,'production',2,1),(10,1,'production',3,1),
-- Oil: weigh→mix
 (11,7,'pre_production',1,1),(11,1,'production',2,1),
-- Inhaler: precision weigh→mix
 (12,8,'pre_production',1,1),(12,1,'production',2,1),
-- Compress: weigh
 (13,6,'pre_production',1,1),(13,10,'production',2,1),
-- Lozenge: weigh→heat→mix
 (14,6,'pre_production',1,1),(14,9,'production',2,1),(14,4,'production',3,1),
-- V2 drafts
 (15,6,'pre_production',1,1),(15,4,'production',2,1),(15,5,'production',3,1),(15,2,'production',4,1),
 (16,6,'pre_production',1,1),(16,3,'production',2,1),(16,4,'production',3,1),(16,5,'production',4,1),
 (17,6,'pre_production',1,1),(17,4,'production',2,1),(17,5,'production',3,1),
 (18,7,'pre_production',1,1),(18,9,'production',2,1),(18,1,'production',3,1),
 (19,6,'pre_production',1,1),(19,4,'production',2,1),(19,1,'production',3,1),
 (20,7,'pre_production',1,1),(20,9,'production',2,1),(20,1,'production',3,1),
 (21,6,'pre_production',1,1),(21,10,'production',2,1);

-- ---------------------------------------------------------------------
-- ENVIRONMENTAL CONDITIONS  (1 GENERAL, 2 FILLING, 3 COLD, 4 STORE)
-- unique(bom_id,phase,condition_id)
-- ---------------------------------------------------------------------
INSERT INTO bom_environmental_conditions (bom_id,condition_id,phase) VALUES
-- Capsules need low-humidity filling
 (1,1,'pre_production'),(1,2,'production'),
 (2,1,'pre_production'),(2,2,'production'),
 (3,1,'pre_production'),(3,2,'production'),
 (4,1,'pre_production'),(4,1,'production'),
 (5,1,'production'),(6,1,'production'),
-- Syrup/cream use cold storage for extracts
 (7,3,'pre_production'),(7,1,'production'),
 (8,1,'production'),
 (9,1,'production'),
 (10,3,'pre_production'),(10,1,'production'),
 (11,1,'production'),
 (12,1,'production'),
 (13,1,'production'),
 (14,1,'production'),
 (15,1,'pre_production'),(15,2,'production'),
 (16,1,'production'),(17,1,'production'),
 (18,3,'pre_production'),(18,1,'production'),
 (19,1,'production'),(20,1,'production'),(21,1,'production');

-- ---------------------------------------------------------------------
-- PACKAGING QC  (1 CAP500, 2 CAP400, 3 SACHET5, 4 BOTTLE100)
-- ---------------------------------------------------------------------
INSERT INTO bom_packaging_qc (bom_id,criteria_id) VALUES
 (1,1),(2,2),(3,1),(4,1),
 (5,3),(6,3),(7,4),(8,1),
 (9,4),(10,4),(11,4),(12,4),(13,3),(14,3),
 (15,1),(16,1),(17,3),(18,4),(19,1),(20,4),(21,3);

-- =====================================================================
-- UAT local: receiving lots (with value) + inbound transactions for the
-- freshly-seeded items. Quantities are in each item's PRIMARY unit; cost is
-- per primary unit. Lots are 'released' (available) so stock shows on-hand.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Map: item code -> id (after reseed): RM 1-3, PK 4-6, WIP 7-8, FG 9-11, CS 12-13
-- Warehouses: WH-RM=1, WH-FG=2 ; users admin=1, qc=3

-- 2 lots per raw material, 1-2 for others. cost = realistic per primary unit.
INSERT INTO inventory_lots
(item_id, lot_number, batch_number, warehouse_id, quantity, reserved_quantity, unit, status,
 manufacturing_date, expiry_date, received_date, vendor_lot_number, cost, po_number, coa_number,
 manufacturer_name, country_of_origin, qc_disposition, qc_disposition_by, qc_disposition_at)
VALUES
-- RM-0001 ผงขมิ้นชัน (kg) — 2 lots
(1,'LOT-RM0001-2601','BN-RM0001-01',1,120.0000,0,'kg','released','2026-01-10','2028-01-09','2026-01-15','V-TUR-2601',355.0000,'PO-2601-001','COA-RM0001-01','Herbal Source Co.','Thailand','APPROVED',3,'2026-01-16 09:00:00'),
(1,'LOT-RM0001-2603','BN-RM0001-02',1,80.0000,0,'kg','released','2026-03-05','2028-03-04','2026-03-10','V-TUR-2603',360.0000,'PO-2603-004','COA-RM0001-02','Herbal Source Co.','Thailand','APPROVED',3,'2026-03-11 09:00:00'),
-- RM-0002 ผงฟ้าทะลายโจร (kg)
(2,'LOT-RM0002-2602','BN-RM0002-01',1,95.0000,0,'kg','released','2026-02-01','2028-01-31','2026-02-06','V-AND-2602',420.0000,'PO-2602-002','COA-RM0002-01','GreenLeaf Botanicals','Thailand','APPROVED',3,'2026-02-07 09:00:00'),
-- RM-0003 สารสกัดกระชายขาว (kg) — high value, cold storage
(3,'LOT-RM0003-2602','BN-RM0003-01',1,30.0000,0,'kg','released','2026-02-15','2027-08-14','2026-02-20','V-FIN-2602',1880.0000,'PO-2602-003','COA-RM0003-01','PhytoExtract Ltd.','Thailand','APPROVED',3,'2026-02-21 10:00:00'),
-- PK-0001 แคปซูลเปล่า 0 (box of 5000)
(4,'LOT-PK0001-2601','BN-PK0001-01',1,60.0000,0,'box','released','2026-01-05','2029-01-04','2026-01-12','V-CAP-2601',96.0000,'PO-2601-010','COA-PK0001-01','CapsulePro Inc.','Thailand','APPROVED',3,'2026-01-13 11:00:00'),
-- PK-0002 แคปซูลเปล่า 00 (box)
(5,'LOT-PK0002-2601','BN-PK0002-01',1,30.0000,0,'box','released','2026-01-05','2029-01-04','2026-01-12','V-CAP-2602',118.0000,'PO-2601-010','COA-PK0002-01','CapsulePro Inc.','Thailand','APPROVED',3,'2026-01-13 11:00:00'),
-- PK-0003 ขวด HDPE (box of 100)
(6,'LOT-PK0003-2602','BN-PK0003-01',1,80.0000,0,'box','released','2026-02-10',NULL,'2026-02-18','V-BTL-2602',350.0000,'PO-2602-011','COA-PK0003-01','PlastPack Co.','Thailand','APPROVED',3,'2026-02-19 11:00:00'),
-- WIP-0001 ผงผสมขมิ้น (kg) — produced internally
(7,'LOT-WIP0001-2603','BN-WIP0001-01',1,18.0000,0,'kg','released','2026-03-20','2027-03-19','2026-03-20',NULL,485.0000,NULL,'COA-WIP0001-01','In-house Production','Thailand','APPROVED',3,'2026-03-20 15:00:00'),
-- WIP-0002 ผงผสมฟ้าทะลายโจร (kg)
(8,'LOT-WIP0002-2603','BN-WIP0002-01',1,15.0000,0,'kg','released','2026-03-22','2027-03-21','2026-03-22',NULL,535.0000,NULL,'COA-WIP0002-01','In-house Production','Thailand','APPROVED',3,'2026-03-22 15:00:00'),
-- FG-0001 แคปซูลขมิ้น (bottle) — finished, in FG warehouse
(9,'LOT-FG0001-2604','BN-FG0001-01',2,800.0000,0,'bottle','released','2026-04-01','2028-03-31','2026-04-02',NULL,95.0000,NULL,'COA-FG0001-01','In-house Production','Thailand','APPROVED',3,'2026-04-02 16:00:00'),
-- FG-0002 แคปซูลฟ้าทะลายโจร (bottle)
(10,'LOT-FG0002-2604','BN-FG0002-01',2,600.0000,0,'bottle','released','2026-04-05','2028-04-04','2026-04-06',NULL,88.0000,NULL,'COA-FG0002-01','In-house Production','Thailand','APPROVED',3,'2026-04-06 16:00:00'),
-- FG-0003 แคปซูลกระชายขาว (bottle)
(11,'LOT-FG0003-2604','BN-FG0003-01',2,300.0000,0,'bottle','released','2026-04-10','2027-10-09','2026-04-11',NULL,145.0000,NULL,'COA-FG0003-01','In-house Production','Thailand','APPROVED',3,'2026-04-11 16:00:00'),
-- CS-0001 ถุงมือ (box)
(12,'LOT-CS0001-2601','BN-CS0001-01',1,40.0000,0,'box','released','2026-01-02','2029-01-01','2026-01-08','V-GLV-2601',120.0000,'PO-2601-020',NULL,'SafeHands Co.','Malaysia',NULL,NULL,NULL),
-- CS-0002 แอลกอฮอล์ (gallon)
(13,'LOT-CS0002-2602','BN-CS0002-01',1,25.0000,0,'gallon','released','2026-02-03','2028-02-02','2026-02-09','V-ETH-2602',350.0000,'PO-2602-021',NULL,'ChemSupply Co.','Thailand',NULL,NULL,NULL);

-- Inbound 'receipt' transactions, one per lot. balance_after = lot qty (first
-- receipt). item_balance_after = running total per item.
INSERT INTO inventory_transactions
(lot_id, transaction_type, quantity, unit, reference_type, reference_id, reference_number,
 to_warehouse_id, reason, performed_by, approved_by, balance_after, item_balance_after, created_at)
VALUES
(1,'receipt',120.0000,'kg','grn',NULL,'GRN-2601-001',1,'รับเข้าวัตถุดิบจากผู้ขาย',1,3,120.0000,120.0000,'2026-01-15 09:30:00'),
(2,'receipt',80.0000,'kg','grn',NULL,'GRN-2603-004',1,'รับเข้าวัตถุดิบจากผู้ขาย',1,3,80.0000,200.0000,'2026-03-10 09:30:00'),
(3,'receipt',95.0000,'kg','grn',NULL,'GRN-2602-002',1,'รับเข้าวัตถุดิบจากผู้ขาย',1,3,95.0000,95.0000,'2026-02-06 09:30:00'),
(4,'receipt',30.0000,'kg','grn',NULL,'GRN-2602-003',1,'รับเข้าสารสกัด (cold chain)',1,3,30.0000,30.0000,'2026-02-20 10:30:00'),
(5,'receipt',60.0000,'box','grn',NULL,'GRN-2601-010',1,'รับเข้าบรรจุภัณฑ์',1,3,60.0000,60.0000,'2026-01-12 11:30:00'),
(6,'receipt',30.0000,'box','grn',NULL,'GRN-2601-010',1,'รับเข้าบรรจุภัณฑ์',1,3,30.0000,30.0000,'2026-01-12 11:30:00'),
(7,'receipt',80.0000,'box','grn',NULL,'GRN-2602-011',1,'รับเข้าบรรจุภัณฑ์',1,3,80.0000,80.0000,'2026-02-18 11:30:00'),
(8,'receipt',18.0000,'kg','production',NULL,'WO-WIP-0001',1,'รับเข้าผงผสมจากการผลิต',2,3,18.0000,18.0000,'2026-03-20 15:30:00'),
(9,'receipt',15.0000,'kg','production',NULL,'WO-WIP-0002',1,'รับเข้าผงผสมจากการผลิต',2,3,15.0000,15.0000,'2026-03-22 15:30:00'),
(10,'receipt',800.0000,'bottle','production',NULL,'WO-FG-0001',2,'รับเข้าสินค้าสำเร็จรูป',2,3,800.0000,800.0000,'2026-04-02 16:30:00'),
(11,'receipt',600.0000,'bottle','production',NULL,'WO-FG-0002',2,'รับเข้าสินค้าสำเร็จรูป',2,3,600.0000,600.0000,'2026-04-06 16:30:00'),
(12,'receipt',300.0000,'bottle','production',NULL,'WO-FG-0003',2,'รับเข้าสินค้าสำเร็จรูป',2,3,300.0000,300.0000,'2026-04-11 16:30:00'),
(13,'receipt',40.0000,'box','grn',NULL,'GRN-2601-020',1,'รับเข้าวัสดุสิ้นเปลือง',1,3,40.0000,40.0000,'2026-01-08 11:30:00'),
(14,'receipt',25.0000,'gallon','grn',NULL,'GRN-2602-021',1,'รับเข้าวัสดุสิ้นเปลือง',1,3,25.0000,25.0000,'2026-02-09 11:30:00');

-- Roll up on_hand / on_hand_cost / WAC onto each item from its released lots.
UPDATE items i
JOIN (
  SELECT item_id,
         SUM(quantity) AS qty,
         SUM(quantity * COALESCE(cost,0)) AS val
  FROM inventory_lots
  WHERE status = 'released'
  GROUP BY item_id
) l ON l.item_id = i.id
SET i.on_hand = l.qty,
    i.on_hand_cost = l.val,
    i.current_wac = CASE WHEN l.qty > 0 THEN l.val / l.qty ELSE NULL END,
    i.last_purchase_cost = i.standard_cost,
    i.last_purchase_date = NOW();

SET FOREIGN_KEY_CHECKS = 1;

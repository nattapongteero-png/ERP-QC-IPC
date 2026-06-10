-- =====================================================================
-- Group 1: Material Withdrawal / Returns / Requisitions / Goods Receipt
-- Consistent with rebuilt work orders (WO 14..27, batches B2601..B2614).
-- Refs: items 1..60, inventory_lots, users 1..4, production_rooms 1..7,
--       warehouses 1..4, vendors 1..3, electronic_signatures 1..10,
--       purchase_orders (rebuilt in G4 — GRN po-sourced rows reference them,
--       so PO-sourced GRNs are created in G4; here only WO-sourced GRNs).
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---- wipe ----
DELETE FROM material_withdrawal_approvals;
DELETE FROM material_withdrawal_attachments;
DELETE FROM material_withdrawal_request_items;
DELETE FROM material_withdrawal_requests;
DELETE FROM material_return_lines;
DELETE FROM material_returns;
DELETE FROM purchase_requisition_lines;
DELETE FROM purchase_requisitions;
DELETE FROM goods_receipt_checklists;
DELETE FROM goods_receipt_lines;
DELETE FROM goods_receipts;

-- =====================================================================
-- 1. MATERIAL WITHDRAWAL REQUESTS (extra-BOM withdrawals on in_progress WOs)
--    reason_type: machine_setup_loss | equipment_trial_run | parameter_adjustment | other
--    status: pending | approved | rejected
-- =====================================================================
INSERT INTO material_withdrawal_requests
 (id, work_order_id, requested_by_user_id, requested_at, status, reason_type, reason_detail, machine_phase, room_id, created_at, updated_at) VALUES
 (1, 14, 2, NOW(), 'approved', 'machine_setup_loss', 'สูญเสียระหว่างตั้งเครื่องบรรจุแคปซูล', 'production', 4, NOW(), NOW()),
 (2, 16, 2, NOW(), 'pending',  'equipment_trial_run', 'ทดลองเดินเครื่องผสมก่อนผลิตจริง', 'production', 2, NOW(), NOW()),
 (3, 17, 2, NOW(), 'pending',  'parameter_adjustment', 'ปรับพารามิเตอร์การตอกเม็ด', 'production', 2, NOW(), NOW()),
 (4, 18, 2, NOW(), 'approved', 'machine_setup_loss', 'สูญเสียผงระหว่างตั้งค่าเครื่องบรรจุซอง', 'packaging', 5, NOW(), NOW()),
 (5, 20, 2, NOW(), 'rejected', 'other', 'ขอเบิกเกินความจำเป็น (ปฏิเสธ)', 'production', 2, NOW(), NOW()),
 (6, 22, 2, NOW(), 'pending',  'parameter_adjustment', 'ปรับสูตรเนื้อยาหม่องระหว่างผสม', 'production', 2, NOW(), NOW());

-- request items (material_id from each WO's BOM materials; bom_planned snapshot)
INSERT INTO material_withdrawal_request_items
 (request_id, material_id, quantity_requested, quantity_approved, unit, bom_planned_quantity, created_at) VALUES
 (1, 1,  500, 500, 'g', 30000, NOW()),
 (1, 31, 100, 100, 'g', 4000,  NOW()),
 (2, 3,  300, NULL,'g', 7000,  NOW()),
 (3, 14, 400, NULL,'g', 50000, NOW()),
 (4, 15, 600, 600, 'g', 80000, NOW()),
 (5, 17, 200, NULL,'g', 20000, NOW()),
 (6, 22, 250, NULL,'g', 18000, NOW());

-- approvals for approved/rejected requests (dual control: approver=3 qc, requester=2)
INSERT INTO material_withdrawal_approvals
 (request_id, approver_user_id, action, action_at, reason, comment, signature_id, created_at) VALUES
 (1, 3, 'approve', NOW(), NULL, 'อนุมัติตามจริง', 1, NOW()),
 (4, 3, 'approve', NOW(), NULL, 'อนุมัติ', 2, NOW()),
 (5, 3, 'reject',  NOW(), 'ปริมาณเกินเกณฑ์ที่อนุมัติได้', NULL, 3, NOW());

-- =====================================================================
-- 2. MATERIAL RETURNS (leftover RM returned to warehouse after production)
--    status: submitted | received | rejected
-- =====================================================================
INSERT INTO material_returns
 (id, return_number, work_order_id, return_date, returned_by, receiving_warehouse_id, status, approved_by, approved_at, notes, created_at, updated_at) VALUES
 (1, 'RET-2026-000001', 14, NOW(), 2, 1, 'received',  3, NOW(), 'คืนผงขมิ้นชันเหลือจากการผลิต', NOW(), NOW()),
 (2, 'RET-2026-000002', 15, NOW(), 2, 1, 'submitted', NULL, NULL, 'รอตรวจรับคืนฟ้าทะลายโจร', NOW(), NOW()),
 (3, 'RET-2026-000003', 18, NOW(), 2, 1, 'submitted', NULL, NULL, 'คืนผงขิงเหลือ', NOW(), NOW()),
 (4, 'RET-2026-000004', 20, NOW(), 2, 1, 'rejected',  3, NOW(), 'ภาชนะไม่ติดฉลากครบ — ปฏิเสธ', NOW(), NOW());

-- return lines: issued - used - return = variance
INSERT INTO material_return_lines
 (return_id, source_lot_id, item_id, issued_qty, issued_unit, used_qty, used_unit, return_qty, return_unit,
  variance_qty, variance_pct, variance_reason, is_outside_tolerance, notes, created_at, updated_at) VALUES
 (1, 1, 1, 30000, 'g', 28500, 'g', 1400, 'g', 100, 0.3333, 'process_loss', 0, 'สูญเสียปกติ', NOW(), NOW()),
 (2, (SELECT id FROM inventory_lots WHERE item_id=2 AND status='released' LIMIT 1), 2, 24000, 'g', 23200, 'g', 700, 'g', 100, 0.4167, 'process_loss', 0, NULL, NOW(), NOW()),
 (3, (SELECT id FROM inventory_lots WHERE item_id=15 AND status='released' LIMIT 1), 15, 80000, 'g', 78000, 'g', 1800, 'g', 200, 0.2500, 'sampling', 0, NULL, NOW(), NOW()),
 (4, (SELECT id FROM inventory_lots WHERE item_id=17 AND status='released' LIMIT 1), 17, 20000, 'g', 18000, 'g', 1500, 'g', 500, 2.5000, 'unaccounted', 1, 'นอกเกณฑ์', NOW(), NOW());

-- =====================================================================
-- 3. PURCHASE REQUISITIONS (raw-material reorder requests)
--    requester_id/approved_by -> hr_employees.id (seeded in G5 = 1..N); use NULL-safe:
--    we set requester_id to an existing hr_employee if present else fallback handled in G5.
--    status: draft | submitted | pending_approval | approved | converted
-- =====================================================================
INSERT INTO purchase_requisitions
 (id, pr_number, requester_id, department_id, required_date, priority, description, justification, status, total_amount, approved_by, approved_at, created_by, created_at, updated_at) VALUES
 (1, 'PR2026-0001', 1, 10, DATE_ADD(NOW(), INTERVAL 14 DAY), 'normal',   'จัดซื้อวัตถุดิบสมุนไพรรอบเดือน', 'สต็อกใกล้ถึงจุดสั่งซื้อ', 'approved', 0, 1, NOW(), 5, NOW(), NOW()),
 (2, 'PR2026-0002', 1, 10, DATE_ADD(NOW(), INTERVAL 7 DAY),  'urgent',   'สั่งซื้อบรรจุภัณฑ์เร่งด่วน', 'รองรับแผนผลิตสัปดาห์หน้า', 'pending_approval', 0, NULL, NULL, 5, NOW(), NOW()),
 (3, 'PR2026-0003', 1, 10, DATE_ADD(NOW(), INTERVAL 30 DAY), 'normal',   'สั่งซื้อสารเติมแต่ง', NULL, 'draft', 0, NULL, NULL, 5, NOW(), NOW()),
 (4, 'PR2026-0004', 1, 10, DATE_ADD(NOW(), INTERVAL 10 DAY), 'critical', 'สั่งซื้อสารสกัดกระชายขาว (ขาดสต็อก)', 'จำเป็นต่อการผลิต WO กระชายขาว', 'converted', 0, 1, NOW(), 5, NOW(), NOW());

INSERT INTO purchase_requisition_lines
 (pr_id, line_number, item_id, description, quantity, unit, estimated_price, line_total, preferred_vendor_id, status, created_at) VALUES
 (1, 1, 1,  'ผงขมิ้นชัน',        100, 'kg', 350, 35000, 1, 'open', NOW()),
 (1, 2, 2,  'ผงฟ้าทะลายโจร',     80,  'kg', 420, 33600, 1, 'open', NOW()),
 (2, 1, 36, 'ซองฟอยล์ 5g',       50,  'box', 800, 40000, 3, 'open', NOW()),
 (2, 2, 37, 'ขวดแก้วสีชา 100ml',  20,  'box', 1200, 24000, 3, 'open', NOW()),
 (3, 1, 31, 'MCC PH102',          50,  'kg', 180, 9000, 1, 'open', NOW()),
 (4, 1, 3,  'สารสกัดกระชายขาว',   30,  'kg', 1500, 45000, 2, 'converted', NOW());

-- update PR totals from lines
UPDATE purchase_requisitions p SET total_amount =
  (SELECT COALESCE(SUM(line_total),0) FROM purchase_requisition_lines l WHERE l.pr_id=p.id)
WHERE p.id BETWEEN 1 AND 4;

-- =====================================================================
-- 4. GOODS RECEIPTS — WO-sourced (finished goods from completed WO 26)
--    PO-sourced GRNs are added in Group 4 after purchase_orders exist.
--    status: in_progress | released ; line status flow created..released_to_stock
-- =====================================================================
INSERT INTO goods_receipts
 (id, grn_number, source_type, wo_id, warehouse_id, status, receiver_user_id, received_date, notes, created_at, updated_at) VALUES
 (1, 'GRN-2026-0001', 'wo', 26, 2, 'released', 4, CURDATE(), 'รับสินค้าสำเร็จรูปลูกประคบจาก WO ที่ปิดงาน', NOW(), NOW());

INSERT INTO goods_receipt_lines
 (grn_id, line_number, item_id, expected_quantity, actual_quantity, unit, batch_number, status, qc_sample_creation_failed, source_wo_output_id, created_at, updated_at) VALUES
 (1, 1, 59, 500, 500, 'pcs', 'B261313', 'released_to_stock', 0, 26, NOW(), NOW());

SET FOREIGN_KEY_CHECKS = 1;
SELECT
 (SELECT COUNT(*) FROM material_withdrawal_requests) mwr,
 (SELECT COUNT(*) FROM material_returns) ret,
 (SELECT COUNT(*) FROM purchase_requisitions) pr,
 (SELECT COUNT(*) FROM goods_receipts) grn;

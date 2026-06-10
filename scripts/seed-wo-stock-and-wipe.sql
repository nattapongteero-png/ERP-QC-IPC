-- =====================================================================
-- Part A: seed inventory lots for new BOM materials (items 14..49) so the
--         requisition-approve stock gate passes, then wipe all work orders
--         and their execution rows for a clean rebuild.
-- Run before the WO orchestration script.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --- A1. Stock for new raw materials / excipients / WIP (items 14..49) ---
-- Generous quantities so any dosage-form batch can be requisitioned.
-- weight-tracked RM/excipient/WIP are in kg (1 kg = 1000 g via conversionRate);
-- packaging is in box (each box = many pcs via conversionRate).
DELETE FROM inventory_lots WHERE lot_number LIKE 'LOT-WOSEED-%';

INSERT INTO inventory_lots
  (item_id, lot_number, batch_number, warehouse_id, quantity, reserved_quantity, unit, status,
   manufacturing_date, expiry_date, received_date, cost, qc_disposition, qc_disposition_by, qc_disposition_at)
SELECT
  i.id,
  CONCAT('LOT-WOSEED-', i.code),
  CONCAT('BN-WOSEED-', i.code),
  1,
  CASE
    WHEN i.type IN ('raw_material','wip') THEN 1000          -- 1000 kg / 1000 L
    WHEN i.type = 'packaging' THEN 2000                       -- 2000 box
    ELSE 1000
  END,
  0,
  i.primary_unit,
  'released',
  '2026-03-01', '2028-03-01', '2026-03-05',
  10.0000, 'APPROVED', 1, '2026-03-06'
FROM items i
WHERE i.id BETWEEN 14 AND 49
  AND i.type IN ('raw_material','wip','packaging');

-- Top up existing items 1..13 too (older lots may be small for big batches)
DELETE FROM inventory_lots WHERE lot_number LIKE 'LOT-WOTOP-%';
INSERT INTO inventory_lots
  (item_id, lot_number, batch_number, warehouse_id, quantity, reserved_quantity, unit, status,
   manufacturing_date, expiry_date, received_date, cost, qc_disposition, qc_disposition_by, qc_disposition_at)
SELECT
  i.id, CONCAT('LOT-WOTOP-', i.code), CONCAT('BN-WOTOP-', i.code), 1,
  CASE WHEN i.type='packaging' THEN 2000 ELSE 1000 END,
  0, i.primary_unit, 'released',
  '2026-03-01','2028-03-01','2026-03-05', 10.0000, 'APPROVED', 1, '2026-03-06'
FROM items i
WHERE i.id BETWEEN 1 AND 13
  AND i.type IN ('raw_material','wip','packaging');

-- --- A2. Wipe all work orders and their execution / dependent rows ---
DELETE FROM ipc_test_samples;
DELETE FROM ipc_recording_rounds;
DELETE FROM quality_tests WHERE test_type IN ('IPC','ipc','in_process') OR lot_id IN (SELECT id FROM inventory_lots WHERE lot_number LIKE '%-IP');
DELETE FROM wo_sop_execution;
DELETE FROM wo_line_clearance;
DELETE FROM wo_cleaning_logs;
DELETE FROM wo_environmental_logs;
DELETE FROM wo_finished_inspection;
DELETE FROM wo_packaging_weight_logs;
DELETE FROM wo_packaging_integrity_logs;
DELETE FROM wo_packaging_materials;
DELETE FROM wo_packaging_returns;
DELETE FROM wo_packaging_return_approvals;
DELETE FROM line_clearance_checklists;
DELETE FROM work_order_assignees;
DELETE FROM work_order_costs;
DELETE FROM work_order_operations;
DELETE FROM work_order_materials;
DELETE FROM material_withdrawal_request_items;
DELETE FROM material_withdrawal_requests;
DELETE FROM work_order_supplementary_requisition_lines;
DELETE FROM work_order_supplementary_requisitions;
DELETE FROM batch_records;
DELETE FROM label_verifications;
DELETE FROM variance_records;
DELETE FROM deviations WHERE work_order_id IS NOT NULL;
DELETE FROM qc_inspections WHERE work_order_id IS NOT NULL;
-- goods_receipts auto-created on WO completion (source 'wo')
DELETE FROM goods_receipts WHERE wo_id IS NOT NULL OR source_type = 'wo';
-- in-process lots auto-created for IPC
DELETE FROM inventory_lots WHERE lot_number LIKE '%-IP';
DELETE FROM work_orders;

SET FOREIGN_KEY_CHECKS = 1;
SELECT (SELECT COUNT(*) FROM work_orders) wo,
       (SELECT COUNT(*) FROM inventory_lots WHERE lot_number LIKE 'LOT-WOSEED-%') seeded_lots;

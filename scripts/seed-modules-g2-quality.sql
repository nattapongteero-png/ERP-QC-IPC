-- =====================================================================
-- Group 2: Quality — qc_samples, qc_sample_tests(+samples), qc_inspections,
--          coa_documents(+results), scale_verifications, deviations.
-- IMPORTANT: do NOT delete the WO in-process IPC rows in quality_tests
--   (test_type='in_process') — they belong to the WO execution module.
-- Refs: items, inventory_lots, ipc_criteria, users 1..4, customers 1..5,
--       coa_templates 1..6, production_equipment scales 6/7/8,
--       standard_weights 1/2, work_orders 14..27.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---- wipe (quality, but keep WO IPC tests) ----
DELETE FROM coa_test_results;
DELETE FROM coa_documents;
DELETE FROM qc_oos_investigations;
DELETE FROM qc_sample_test_samples;
DELETE FROM qc_sample_tests;
DELETE FROM qc_samples;
DELETE FROM qc_inspections;
DELETE FROM scale_verifications;
DELETE FROM deviations;
-- standalone (non-IPC) quality_tests only
DELETE FROM quality_tests WHERE test_type <> 'in_process' AND (sample_number IS NULL OR sample_number NOT LIKE 'SOP-%');

-- =====================================================================
-- 1. QC SAMPLES (incoming RM lots + finished WO batch + stability)
--    status: registered | testing | reviewed | approved | released | rejected | oos
-- =====================================================================
INSERT INTO qc_samples
 (id, sample_number, source_type, source_ref_text, product_id, lot_number, received_date, received_by, status, source_lot_id, sample_qty, unit, notes, created_at, updated_at) VALUES
 (1, 'QS-20260601-0001', 'raw_material_lot', 'รับเข้าผงขมิ้นชัน', 1, 'BN-RM0001-01', NOW(), 3, 'released',  1, 50, 'g', 'ตัวอย่างวัตถุดิบขมิ้นชัน', NOW(), NOW()),
 (2, 'QS-20260601-0002', 'raw_material_lot', 'รับเข้าผงฟ้าทะลายโจร', 2, 'BN-RM0002-01', NOW(), 3, 'approved',  2, 50, 'g', NULL, NOW(), NOW()),
 (3, 'QS-20260601-0003', 'raw_material_lot', 'รับเข้าสารสกัดกระชายขาว', 3, 'BN-RM0003-01', NOW(), 3, 'testing', 3, 30, 'g', 'กำลังทดสอบ', NOW(), NOW()),
 (4, 'QS-20260602-0001', 'work_order_batch', 'WO ลูกประคบ', 59, 'B261313', NOW(), 3, 'released', NULL, 200, 'g', 'ตัวอย่างสินค้าสำเร็จรูป', NOW(), NOW()),
 (5, 'QS-20260602-0002', 'work_order_batch', 'WO แคปซูลขมิ้นชัน', 9, 'B260101', NOW(), 3, 'testing', NULL, 60, 'cap', NULL, NOW(), NOW()),
 (6, 'QS-20260603-0001', 'raw_material_lot', 'รับเข้าน้ำผึ้ง', 18, 'BN-WOSEED-RM-0008', NOW(), 3, 'oos', NULL, 100, 'g', 'พบผลนอกข้อกำหนด', NOW(), NOW()),
 (7, 'QS-20260603-0002', 'stability', 'การศึกษาความคงสภาพแคปซูลกระชายขาว', 11, 'BN-FG0003-01', NOW(), 3, 'registered', NULL, 30, 'cap', 'ตัวอย่างคงสภาพ', NOW(), NOW());

-- qc_sample_tests (criteria from ipc_criteria; spec snapshot; result_status)
INSERT INTO qc_sample_tests
 (id, sample_id, criteria_id, sequence, spec_min, spec_max, spec_target, unit, test_method, numeric_result, result_status, tested_by, tested_at, created_at, updated_at) VALUES
 (1, 1, 12, 1, NULL, 10.0, NULL, '%', 'Moisture Analyzer', 7.8, 'pass', 3, NOW(), NOW(), NOW()),  -- powder moisture
 (2, 1, 13, 2, NULL, 5.0,  NULL, '%', 'HPLC', 3.2, 'pass', 3, NOW(), NOW(), NOW()),                 -- blend uniformity
 (3, 2, 12, 1, NULL, 10.0, NULL, '%', 'Moisture Analyzer', 8.1, 'pass', 3, NOW(), NOW(), NOW()),
 (4, 3, 12, 1, NULL, 10.0, NULL, '%', 'Moisture Analyzer', NULL, 'pending', NULL, NULL, NOW(), NOW()),
 (5, 5, 1,  1, NULL, NULL, 500,  'mg', 'ชั่งน้ำหนัก', 501.2, 'pass', 3, NOW(), NOW(), NOW()),         -- capsule avg wt
 (6, 6, 12, 1, NULL, 10.0, NULL, '%', 'Moisture Analyzer', 12.5, 'fail', 3, NOW(), NOW(), NOW());   -- OOS moisture

-- per-sample readings for a couple of tests (n-point)
INSERT INTO qc_sample_test_samples (sample_test_id, sample_number, test_round, numeric_value, result, created_at) VALUES
 (1, 1, 1, 7.7, 'pass', NOW()), (1, 2, 1, 7.9, 'pass', NOW()), (1, 3, 1, 7.8, 'pass', NOW()),
 (5, 1, 1, 500.8, 'pass', NOW()), (5, 2, 1, 501.5, 'pass', NOW()), (5, 3, 1, 501.3, 'pass', NOW()),
 (6, 1, 1, 12.3, 'fail', NOW()), (6, 2, 1, 12.7, 'fail', NOW()), (6, 3, 1, 12.5, 'fail', NOW());

-- OOS investigation for the failed sample test (id 6)
INSERT INTO qc_oos_investigations
 (sample_test_id, initiated_by, initiated_at, phase1_lab_error_check, classification, retest_authorized, created_at, updated_at) VALUES
 (6, 3, NOW(), 'ตรวจสอบเครื่องมือและวิธีทดสอบ — ไม่พบความผิดพลาดในห้องปฏิบัติการ', 'assignable_cause', 1, NOW(), NOW());

-- =====================================================================
-- 2. QC INSPECTIONS (incoming / in_process / finished / ad_hoc)
-- =====================================================================
INSERT INTO qc_inspections
 (id, inspection_number, work_order_id, batch_number, inspection_type, subject, findings, overall_result, inspector_id, inspected_at, created_at, updated_at) VALUES
 (1, 'QCI-2026-0001', NULL, NULL, 'incoming', 'ตรวจรับวัตถุดิบขมิ้นชัน', 'ลักษณะปกติ ผ่านการตรวจรับ', 'pass', 3, NOW(), NOW(), NOW()),
 (2, 'QCI-2026-0002', 14, 'B260101', 'in_process', 'ตรวจระหว่างผลิตแคปซูลขมิ้นชัน', 'น้ำหนักแคปซูลอยู่ในเกณฑ์', 'pass', 3, NOW(), NOW(), NOW()),
 (3, 'QCI-2026-0003', 26, 'B261313', 'finished', 'ตรวจสินค้าสำเร็จรูปลูกประคบ', 'ผ่านการตรวจสอบขั้นสุดท้าย', 'pass', 3, NOW(), NOW(), NOW()),
 (4, 'QCI-2026-0004', NULL, NULL, 'ad_hoc', 'ตรวจสอบกรณีพบความผิดปกติของน้ำผึ้ง', 'พบความชื้นสูงเกินข้อกำหนด', 'fail', 3, NOW(), NOW(), NOW()),
 (5, 'QCI-2026-0005', 18, 'B260505', 'in_process', 'ตรวจระหว่างผลิตผงขิงชง', NULL, 'pending', 3, NOW(), NOW(), NOW());

-- =====================================================================
-- 3. SCALE VERIFICATIONS (pre-use verification with standard weight)
--    result: pass | fail ; valid_until = +8h TTL or daily
-- =====================================================================
INSERT INTO scale_verifications
 (scale_id, standard_weight_id, certified_value_snapshot, certified_unit_snapshot, actual_reading, deviation_amount, deviation_percent, result, operator_user_id, signature_id, performed_at, valid_until, notes, created_at) VALUES
 (6, 2, 100.0000, 'g', 100.0500, 0.0500, 0.0500, 'pass', 2, 1, NOW(), DATE_ADD(NOW(), INTERVAL 8 HOUR), 'สอบเทียบก่อนใช้งานเครื่องชั่ง 200kg', NOW()),
 (7, 1, 1.0000,   'g', 1.0010,   0.0010, 0.1000, 'pass', 2, 2, NOW(), DATE_ADD(NOW(), INTERVAL 8 HOUR), 'สอบเทียบเครื่องชั่ง 1kg', NOW()),
 (8, 1, 1.0000,   'g', 1.0080,   0.0080, 0.8000, 'fail', 2, 3, NOW(), DATE_ADD(NOW(), INTERVAL 8 HOUR), 'เกินเกณฑ์ — ส่งซ่อม', NOW()),
 (7, 1, 1.0000,   'g', 1.0005,   0.0005, 0.0500, 'pass', 2, 4, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 16 HOUR), 'สอบเทียบเมื่อวาน (หมดอายุแล้ว)', NOW());

-- =====================================================================
-- 4. DEVIATIONS (from OOS, scale fail, material return out-of-tolerance)
--    status: open | investigating | resolved | closed ; severity minor/major/critical
-- =====================================================================
INSERT INTO deviations
 (id, deviation_number, title, description, type, source_type, source_id, lot_id, work_order_id, severity, status, root_cause, corrective_action, reported_by, reported_at, assigned_to, due_date, created_at, updated_at) VALUES
 (1, 'DEV2606001', 'ความชื้นน้ำผึ้งเกินข้อกำหนด (OOS)', 'ผลทดสอบความชื้นน้ำผึ้ง 12.5% เกินเกณฑ์ 10%', 'OOS', 'qc_sample', 6, NULL, NULL, 'major', 'investigating', NULL, NULL, 3, NOW(), 3, DATE_ADD(NOW(), INTERVAL 14 DAY), NOW(), NOW()),
 (2, 'DEV2606002', 'เครื่องชั่งวิเคราะห์ไม่ผ่านการสอบเทียบ', 'เครื่องชั่ง EQ-SCALE-03 ค่าเบี่ยงเบน 0.8% เกินเกณฑ์', 'equipment', 'scale_verification', 8, NULL, NULL, 'minor', 'resolved', 'หัววัดคลาดเคลื่อน', 'ส่งสอบเทียบใหม่และปรับตั้ง', 2, NOW(), 5, DATE_ADD(NOW(), INTERVAL 7 DAY), NOW(), NOW()),
 (3, 'DEV2606003', 'ผลต่างวัตถุดิบคืนเกินเกณฑ์', 'การคืนสารสกัดมะขามป้อม variance 2.5% เกินเกณฑ์', 'material', 'material_return', 4, NULL, 20, 'minor', 'open', NULL, NULL, 2, NOW(), 3, DATE_ADD(NOW(), INTERVAL 10 DAY), NOW(), NOW());

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 5. COA DOCUMENTS (from released finished-goods sample) — needs created_by, qr token
--    status: draft | review | approved | issued ; conclusion complies/...
-- =====================================================================
INSERT INTO coa_documents
 (id, coa_number, sample_id, template_id, product_id, lot_number, customer_id, issue_date, manufacture_date, conclusion, status, qr_code_token, created_at, created_by, approved_at, approved_by, updated_at) VALUES
 (1, 'COA-2026-000001', 4, 2, 59, 'B261313', 1, NOW(), DATE_SUB(NOW(), INTERVAL 5 DAY), 'complies', 'issued', SHA2(CONCAT('COA-2026-000001', NOW()), 256), NOW(), 3, NOW(), 3, NOW()),
 (2, 'COA-2026-000002', 1, 3, 1,  'BN-RM0001-01', NULL, NOW(), NULL, 'complies', 'approved', SHA2(CONCAT('COA-2026-000002', NOW()), 256), NOW(), 3, NOW(), 3, NOW()),
 (3, 'COA-2026-000003', 2, 3, 2,  'BN-RM0002-01', NULL, NOW(), NULL, 'complies', 'draft', SHA2(CONCAT('COA-2026-000003', NOW()), 256), NOW(), 3, NULL, NULL, NOW());

INSERT INTO coa_test_results
 (coa_id, sequence, test_name, test_name_th, test_method, specification, result, result_unit, conclusion, created_at) VALUES
 (1, 1, 'Appearance', 'ลักษณะภายนอก', 'Visual', 'สมุนไพรอัดแน่น ไม่มีสิ่งแปลกปลอม', 'เป็นไปตามข้อกำหนด', NULL, 'pass', NOW()),
 (1, 2, 'Weight', 'น้ำหนัก', 'ชั่งน้ำหนัก', '200 g ± 5%', '201 g', 'g', 'pass', NOW()),
 (2, 1, 'Curcuminoids', 'สารเคอร์คูมินอยด์', 'HPLC', 'ไม่น้อยกว่า 3.0%', '3.4%', '%', 'pass', NOW()),
 (2, 2, 'Moisture', 'ความชื้น', 'Moisture Analyzer', 'ไม่เกิน 10.0%', '7.8%', '%', 'pass', NOW());

SET FOREIGN_KEY_CHECKS = 1;
SELECT
 (SELECT COUNT(*) FROM qc_samples) samples,
 (SELECT COUNT(*) FROM qc_inspections) insp,
 (SELECT COUNT(*) FROM scale_verifications) scale,
 (SELECT COUNT(*) FROM deviations) dev,
 (SELECT COUNT(*) FROM coa_documents) coa,
 (SELECT COUNT(*) FROM quality_tests WHERE test_type='in_process') ipc_preserved;

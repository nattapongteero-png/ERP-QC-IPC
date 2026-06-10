-- =====================================================================
-- Group 3: Premises — operational data (sanitation, pest control, water).
-- PRESERVE production_rooms / production_equipment / equipment (referenced by
-- BOM config, cleaning logs, scale verifications). Only rebuild the premises
-- operational logs/schedules + water quality.
-- Refs: production_rooms 1..7, equipment, users 1..4, water_systems 1..4,
--       water_sample_points 1..6, water_quality_specs.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM water_quality_test_results;
DELETE FROM water_quality_tests;
DELETE FROM sanitation_logs;
DELETE FROM sanitation_schedules;
DELETE FROM pest_control_logs;

-- =====================================================================
-- 1. SANITATION SCHEDULES (per area/frequency)
-- =====================================================================
INSERT INTO sanitation_schedules
 (id, name, area_type, area_id, equipment_id, frequency, day_of_week, day_of_month, method, verification_required, is_active, created_at) VALUES
 (1, 'ทำความสะอาดห้องชั่งประจำวัน', 'production', 1, NULL, 'daily',   NULL, NULL, 'เช็ดพื้นและโต๊ะด้วยน้ำยาฆ่าเชื้อ 70% แอลกอฮอล์', 1, 1, NOW()),
 (2, 'ทำความสะอาดห้องผสมประจำวัน', 'production', 2, NULL, 'daily',   NULL, NULL, 'ล้างเครื่องผสมและพื้นห้อง', 1, 1, NOW()),
 (3, 'ทำความสะอาดห้องบรรจุแคปซูล', 'production', 4, NULL, 'daily',   NULL, NULL, 'ทำความสะอาดเครื่องบรรจุและพื้นที่', 1, 1, NOW()),
 (4, 'ทำความสะอาดคลังวัตถุดิบรายสัปดาห์', 'warehouse', 7, NULL, 'weekly', 1, NULL, 'กวาด เช็ด และตรวจความเรียบร้อยชั้นวาง', 1, 1, NOW()),
 (5, 'ทำความสะอาดห้องปฏิบัติการ QC', 'lab', 6, NULL, 'weekly',  5, NULL, 'ทำความสะอาดเครื่องมือและโต๊ะปฏิบัติการ', 1, 1, NOW()),
 (6, 'ทำความสะอาดใหญ่รายเดือน', 'production', NULL, NULL, 'monthly', NULL, 1, 'ทำความสะอาดเชิงลึกทุกพื้นที่ผลิต', 1, 1, NOW());

-- =====================================================================
-- 2. SANITATION LOGS (completed/partial/missed)
-- =====================================================================
INSERT INTO sanitation_logs
 (schedule_id, scheduled_date, performed_date, performed_by, method, chemicals_used, status, verified_by, verified_at, notes, created_at) VALUES
 (1, CURDATE(), NOW(), 2, 'เช็ดพื้นและโต๊ะ', '70% Alcohol', 'completed', 3, NOW(), 'เรียบร้อย', NOW()),
 (2, CURDATE(), NOW(), 2, 'ล้างเครื่องผสม', 'Detergent + 70% Alcohol', 'completed', 3, NOW(), NULL, NOW()),
 (3, CURDATE(), NOW(), 2, 'ทำความสะอาดเครื่องบรรจุ', '70% Alcohol', 'completed', 3, NOW(), NULL, NOW()),
 (4, DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 4, 'กวาดและเช็ด', 'Detergent', 'completed', 3, DATE_SUB(NOW(), INTERVAL 1 DAY), NULL, NOW()),
 (1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 2, 'เช็ดพื้น', '70% Alcohol', 'partial', NULL, NULL, 'ทำไม่ครบ รอทำต่อ', NOW()),
 (5, DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL, 2, NULL, NULL, 'missed', NULL, NULL, 'ไม่ได้ดำเนินการ — วันหยุด', NOW());

-- =====================================================================
-- 3. PEST CONTROL LOGS (routine / follow_up)
-- =====================================================================
INSERT INTO pest_control_logs
 (service_date, contractor_name, technician_name, service_type, areas_serviced, treatment_method, findings_count, findings, recommendations, follow_up_required, follow_up_date, verified_by, created_at) VALUES
 (DATE_SUB(NOW(), INTERVAL 7 DAY), 'บริษัท กำจัดแมลง โปรเฟสชันแนล', 'นายสมชาย ใจดี', 'routine', '["คลังวัตถุดิบ","คลังสินค้า","พื้นที่ผลิต"]', 'วางกับดักและพ่นสารกำจัดแมลงรอบนอกอาคาร', 0, 'ไม่พบร่องรอยสัตว์พาหะ', 'รักษาความสะอาดต่อเนื่อง', 0, NULL, 3, NOW()),
 (DATE_SUB(NOW(), INTERVAL 30 DAY), 'บริษัท กำจัดแมลง โปรเฟสชันแนล', 'นายสมชาย ใจดี', 'routine', '["คลังวัตถุดิบ","คลังสินค้า"]', 'ตรวจกับดักหนูและพ่นสาร', 2, 'พบร่องรอยแมลงบริเวณประตูคลัง', 'ติดม่านกันแมลงเพิ่ม และนัดติดตามผล', 1, DATE_ADD(NOW(), INTERVAL 3 DAY), 3, NOW());

-- =====================================================================
-- 4. WATER QUALITY TESTS + results (in_spec / out_of_spec)
-- =====================================================================
INSERT INTO water_quality_tests
 (id, sample_point_id, water_system_id, performed_at, operator_user_id, signature_id, overall_result, notes, created_at) VALUES
 (1, 1, 2, NOW(), 3, 1, 'in_spec', 'ตรวจน้ำ RO จุดที่ 1', NOW()),
 (2, 3, 3, NOW(), 3, 2, 'in_spec', 'ตรวจน้ำบริสุทธิ์ PW', NOW()),
 (3, 5, 4, NOW(), 3, 3, 'out_of_spec', 'ค่าจุลินทรีย์เกินเกณฑ์ WFI', NOW()),
 (4, 1, 2, DATE_SUB(NOW(), INTERVAL 7 DAY), 3, 4, 'in_spec', 'ตรวจประจำสัปดาห์ก่อน', NOW());

INSERT INTO water_quality_test_results
 (test_id, spec_id, parameter, numeric_value, unit, spec_min_snapshot, spec_max_snapshot, result, created_at) VALUES
 (1, 1, 'conductivity', 1.2,  'uS/cm', NULL, 1.3, 'in_spec', NOW()),
 (1, 3, 'ph',           6.8,  '',      5.0,  7.0, 'in_spec', NOW()),
 (2, 4, 'toc',          0.30, 'mg/L',  NULL, 0.5, 'in_spec', NOW()),
 (2, 3, 'ph',           6.5,  '',      5.0,  7.0, 'in_spec', NOW()),
 (3, 7, 'microbial',    15.0, 'CFU/mL',NULL, 10.0,'out_of_spec', NOW()),
 (4, 1, 'conductivity', 1.1,  'uS/cm', NULL, 1.3, 'in_spec', NOW());

SET FOREIGN_KEY_CHECKS = 1;
SELECT
 (SELECT COUNT(*) FROM sanitation_schedules) sched,
 (SELECT COUNT(*) FROM sanitation_logs) logs,
 (SELECT COUNT(*) FROM pest_control_logs) pest,
 (SELECT COUNT(*) FROM water_quality_tests) water,
 (SELECT COUNT(*) FROM production_rooms) rooms_preserved,
 (SELECT COUNT(*) FROM production_equipment) equip_preserved;

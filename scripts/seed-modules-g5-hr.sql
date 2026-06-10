-- =====================================================================
-- Group 5: HR ("ทรัพยากร") — employees, assignments, job descriptions,
--          training sessions/records, health records, authorizations.
-- EXCLUDE roles/permissions tables (hr_app_roles/permissions/role_permissions/
--   employee_roles) per request — not touched.
-- PRESERVE master data: hr_org_units(34), hr_positions(73), hr_training_courses(41).
-- Refs: users 1..7, hr_positions, hr_org_units, hr_training_courses.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM hr_delegations;
DELETE FROM hr_authorizations;
DELETE FROM hr_notifications;
DELETE FROM hr_health_records;
DELETE FROM hr_training_records;
DELETE FROM hr_training_sessions;
DELETE FROM hr_job_descriptions;
DELETE FROM hr_employee_assignments;
DELETE FROM hr_employees;

-- =====================================================================
-- 1. EMPLOYEES (linked to users + positions + departments)
-- =====================================================================
INSERT INTO hr_employees
 (id, user_id, employee_code, first_name, last_name, first_name_en, last_name_en, email, phone,
  gender, nationality_code, position_id, org_unit_id, hire_date, status, created_at, updated_at) VALUES
 (1, 1, 'EMP-001', 'สมศักดิ์', 'ผู้บริหาร', 'Somsak', 'Admin', 'admin@herbal-erp.com', '081-000-0001', 'male', 'TH', 1, 1, '2024-01-15', 'active', NOW(), NOW()),
 (2, 2, 'EMP-002', 'ประสิทธิ์', 'ผลิตดี', 'Prasit', 'Production', 'production@herbal-erp.com', '081-000-0002', 'male', 'TH', 4, 2, '2024-02-01', 'active', NOW(), NOW()),
 (3, 3, 'EMP-003', 'กัลยา', 'ควบคุมคุณภาพ', 'Kanlaya', 'QC', 'qc@herbal-erp.com', '081-000-0003', 'female', 'TH', NULL, 3, '2024-02-01', 'active', NOW(), NOW()),
 (4, 4, 'EMP-004', 'วิชัย', 'คลังสินค้า', 'Wichai', 'Warehouse', 'warehouse@herbal-erp.com', '081-000-0004', 'male', 'TH', NULL, 6, '2024-03-01', 'active', NOW(), NOW()),
 (5, 5, 'EMP-005', 'นภา', 'จัดซื้อ', 'Napha', 'Purchasing', 'purchasing@herbal-erp.com', '081-000-0005', 'female', 'TH', NULL, 10, '2024-03-15', 'active', NOW(), NOW()),
 (6, NULL, 'EMP-006', 'อนุชา', 'แผนกผลิต', 'Anucha', 'Operator', NULL, '081-000-0006', 'male', 'TH', 8, 11, '2024-05-01', 'active', NOW(), NOW()),
 (7, NULL, 'EMP-007', 'พรทิพย์', 'แผนกวิเคราะห์', 'Porntip', 'Analyst', NULL, '081-000-0007', 'female', 'TH', NULL, 3, '2024-06-01', 'active', NOW(), NOW()),
 (8, NULL, 'EMP-008', 'สุรชัย', 'พ้นสภาพ', 'Surachai', 'Former', NULL, '081-000-0008', 'male', 'TH', NULL, 2, '2023-01-01', 'terminated', NOW(), NOW());
UPDATE hr_employees SET termination_date='2026-03-31' WHERE id=8;

-- =====================================================================
-- 2. EMPLOYEE ASSIGNMENTS (primary postings)
-- =====================================================================
INSERT INTO hr_employee_assignments (employee_id, position_id, org_unit_id, is_primary, effective_from, reason, created_at) VALUES
 (1, 1, 1,  1, '2024-01-15', 'แต่งตั้งเริ่มงาน', NOW()),
 (2, 4, 2,  1, '2024-02-01', 'แต่งตั้งหัวหน้าฝ่ายผลิต', NOW()),
 (6, 8, 11, 1, '2024-05-01', 'บรรจุพนักงานผลิต', NOW());

-- =====================================================================
-- 3. JOB DESCRIPTIONS
-- =====================================================================
INSERT INTO hr_job_descriptions (position_id, version, responsibilities, authorities, qualifications, status, effective_from, approved_by, approved_at, created_at, updated_at) VALUES
 (1, '1.0', 'กำกับดูแลการดำเนินงานโรงงานทั้งหมด', 'อนุมัติงบประมาณและนโยบาย', 'ปริญญาตรีขึ้นไป ประสบการณ์ 10 ปี', 'active', '2024-01-01', 1, NOW(), NOW(), NOW()),
 (4, '1.0', 'ควบคุมการผลิตให้เป็นไปตามแผนและ GMP', 'อนุมัติใบสั่งผลิตและการเบิกวัตถุดิบ', 'เภสัชศาสตร์ ประสบการณ์ 5 ปี', 'active', '2024-01-01', 1, NOW(), NOW(), NOW());

-- =====================================================================
-- 4. TRAINING SESSIONS (for existing courses) + RECORDS
-- =====================================================================
INSERT INTO hr_training_sessions (id, course_id, session_date, start_time, end_time, location, instructor_id, max_participants, status, created_at, updated_at) VALUES
 (1, 1, DATE_SUB(NOW(), INTERVAL 30 DAY), '09:00', '16:00', 'ห้องประชุมใหญ่', 1, 30, 'completed', NOW(), NOW()),
 (2, 2, DATE_SUB(NOW(), INTERVAL 15 DAY), '09:00', '12:00', 'ห้องประชุม A', 1, 25, 'completed', NOW(), NOW()),
 (3, 3, DATE_ADD(NOW(), INTERVAL 7 DAY),  '13:00', '16:00', 'ห้องประชุม B', 2, 20, 'scheduled', NOW(), NOW());

INSERT INTO hr_training_records (employee_id, session_id, course_id, completion_date, expiry_date, result, score, assessed_by, certificate_number, created_at, updated_at) VALUES
 (2, 1, 1, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 335 DAY), 'pass', 92.0, 1, 'CERT-GMP-001', NOW(), NOW()),
 (3, 1, 1, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 335 DAY), 'pass', 88.0, 1, 'CERT-GMP-002', NOW(), NOW()),
 (6, 1, 1, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 335 DAY), 'pass', 79.0, 1, 'CERT-GMP-003', NOW(), NOW()),
 (2, 2, 2, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 350 DAY), 'pass', 95.0, 1, 'CERT-GMP-R-001', NOW(), NOW()),
 (7, 1, 1, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 335 DAY), 'fail', 55.0, 1, NULL, NOW(), NOW());

-- =====================================================================
-- 5. HEALTH RECORDS (annual / pre_placement)
-- =====================================================================
INSERT INTO hr_health_records (employee_id, examination_type, examination_date, next_exam_due, fitness_status, examiner_name, recorded_by, created_at, updated_at) VALUES
 (2, 'annual', DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_ADD(NOW(), INTERVAL 305 DAY), 'fit', 'นพ.สมหมาย', 1, NOW(), NOW()),
 (3, 'annual', DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_ADD(NOW(), INTERVAL 305 DAY), 'fit', 'นพ.สมหมาย', 1, NOW(), NOW()),
 (6, 'pre_placement', DATE_SUB(NOW(), INTERVAL 200 DAY), DATE_ADD(NOW(), INTERVAL 165 DAY), 'restricted', 'นพ.สมหมาย', 1, NOW(), NOW());

-- =====================================================================
-- 6. AUTHORIZATIONS (GMP-critical: batch release, SOP approval)
-- =====================================================================
INSERT INTO hr_authorizations (employee_id, auth_type, scope_org_unit_id, effective_from, granted_by, granted_at, is_active, created_at, updated_at) VALUES
 (1, 'batch_release', NULL, '2024-01-15', 1, NOW(), 1, NOW(), NOW()),
 (2, 'sop_approval', 2, '2024-02-01', 1, NOW(), 1, NOW(), NOW()),
 (3, 'deviation_approval', 3, '2024-02-01', 1, NOW(), 1, NOW(), NOW());

SET FOREIGN_KEY_CHECKS = 1;
SELECT
 (SELECT COUNT(*) FROM hr_employees) emp, (SELECT COUNT(*) FROM hr_employee_assignments) asg,
 (SELECT COUNT(*) FROM hr_job_descriptions) jd, (SELECT COUNT(*) FROM hr_training_sessions) ses,
 (SELECT COUNT(*) FROM hr_training_records) rec, (SELECT COUNT(*) FROM hr_health_records) hlt,
 (SELECT COUNT(*) FROM hr_authorizations) auth,
 (SELECT COUNT(*) FROM hr_training_courses) courses_preserved;

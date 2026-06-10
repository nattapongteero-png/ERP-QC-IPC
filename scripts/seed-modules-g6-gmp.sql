-- =====================================================================
-- Group 6: GMP Compliance — audit plans / audits / findings / CAPA.
-- EXCLUDE the documents menu from rebuild, BUT link existing GMP documents
-- to the relevant training courses (documents.training_course_id).
-- Refs: users 1..4, deviations(G2), hr_training_courses, documents.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM capa;
DELETE FROM audit_findings;
DELETE FROM audits;
DELETE FROM audit_plans;

-- =====================================================================
-- 1. AUDIT PLAN (annual) + AUDITS + FINDINGS
-- =====================================================================
INSERT INTO audit_plans (id, plan_year, name, status, approved_by, approved_at, created_by, created_at) VALUES
 (1, 2026, 'แผนการตรวจประเมินภายในประจำปี 2569', 'approved', 1, NOW(), 1, NOW());

INSERT INTO audits
 (id, audit_number, plan_id, audit_type, scope, gmp_chapters, scheduled_date, actual_date, lead_auditor_id, status, summary, created_at) VALUES
 (1, 'AUD-2026-001', 1, 'internal', 'ตรวจประเมินฝ่ายผลิตและคลังวัตถุดิบ', '[1,2,3,4]', DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), 3, 'completed', 'พบข้อสังเกต 3 รายการ มีข้อบกพร่องระดับ minor 1 รายการ', NOW()),
 (2, 'AUD-2026-002', 1, 'internal', 'ตรวจประเมินระบบเอกสารและ QC', '[4,6]', DATE_ADD(NOW(), INTERVAL 14 DAY), NULL, 3, 'scheduled', NULL, NOW()),
 (3, 'AUD-2026-003', 1, 'external', 'ตรวจประเมินจากหน่วยงานภายนอก (อย.)', '[1,2,3,4,5,6,7,8,9,10]', DATE_ADD(NOW(), INTERVAL 60 DAY), NULL, 1, 'scheduled', NULL, NOW());

INSERT INTO audit_findings
 (id, audit_id, finding_number, category, gmp_chapter, gmp_requirement, description, evidence, area_owner, capa_required, status, created_at) VALUES
 (1, 1, 'F-001', 'minor', 3, 'การควบคุมสุขลักษณะส่วนบุคคล', 'พบพนักงานไม่สวมถุงมือในบางช่วงการผลิต', 'บันทึกภาพระหว่างตรวจ', 2, 1, 'capa_assigned', NOW()),
 (2, 1, 'F-002', 'observation', 4, 'การควบคุมเอกสาร', 'บันทึกการผลิตบางฉบับลงข้อมูลล่าช้า', NULL, 2, 0, 'open', NOW()),
 (3, 1, 'F-003', 'observation', 2, 'การจัดเก็บวัตถุดิบ', 'ป้ายระบุสถานะวัตถุดิบบางรายการไม่ชัดเจน', NULL, 4, 0, 'closed', NOW());

-- =====================================================================
-- 2. CAPA (from audit finding + deviation)
-- =====================================================================
INSERT INTO capa
 (id, capa_number, title, source_type, source_id, audit_finding_id, deviation_id, type, priority, status,
  root_cause_analysis, due_date, owner_id, created_by, created_at, updated_at) VALUES
 (1, 'CAPA-2026-001', 'แก้ไขการสวมถุงมือระหว่างผลิต', 'audit_finding', 1, 1, NULL, 'both', 'high', 'action_pending',
  'พนักงานขาดความตระหนักและการกำกับดูแล', DATE_ADD(NOW(), INTERVAL 21 DAY), 2, 3, NOW(), NOW()),
 (2, 'CAPA-2026-002', 'ป้องกันความชื้นน้ำผึ้งเกินข้อกำหนด', 'deviation', 1, NULL, 1, 'corrective', 'medium', 'investigation',
  'การจัดเก็บไม่ควบคุมความชื้น', DATE_ADD(NOW(), INTERVAL 30 DAY), 3, 3, NOW(), NOW()),
 (3, 'CAPA-2026-003', 'ปรับปรุงการสอบเทียบเครื่องชั่ง', 'deviation', 2, NULL, 2, 'preventive', 'low', 'closed',
  'รอบการสอบเทียบยาวเกินไป', DATE_SUB(NOW(), INTERVAL 2 DAY), 2, 2, NOW(), NOW());

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 3. LINK GMP DOCUMENTS -> TRAINING COURSES (documents menu special request)
--    Map by document type/prefix to the most relevant course:
--      SOP/WI procedures      -> TRN-GMP-001 (GMP fundamentals)
--      FORM/Batch record      -> TRN-DOC-002 (Batch Record & release)
--      POL/MAN/SPEC/PRO/etc.  -> TRN-DOC-001 (Good Documentation Practice)
--      CHK/LOG/RPT            -> TRN-DOC-001
-- =====================================================================
-- SOP* and WI* -> GMP fundamentals
UPDATE documents d
SET d.training_course_id = (SELECT id FROM hr_training_courses WHERE code='TRN-GMP-001')
WHERE d.document_number LIKE 'SOP-%' OR d.document_number LIKE 'WI-%';

-- FORM (FRM) / Batch records -> Batch Record course
UPDATE documents d
SET d.training_course_id = (SELECT id FROM hr_training_courses WHERE code='TRN-DOC-002')
WHERE d.document_number LIKE 'FRM-%';

-- POL / MAN / SPEC / PRO / RPT / LOG / CHK -> Good Documentation Practice
UPDATE documents d
SET d.training_course_id = (SELECT id FROM hr_training_courses WHERE code='TRN-DOC-001')
WHERE d.training_course_id IS NULL
  AND (d.document_number LIKE 'POL-%' OR d.document_number LIKE 'MAN-%'
       OR d.document_number LIKE 'SPEC-%' OR d.document_number LIKE 'PRO-%'
       OR d.document_number LIKE 'RPT-%' OR d.document_number LIKE 'LOG-%'
       OR d.document_number LIKE 'CHK-%');

SELECT
 (SELECT COUNT(*) FROM audit_plans) plans, (SELECT COUNT(*) FROM audits) audits,
 (SELECT COUNT(*) FROM audit_findings) findings, (SELECT COUNT(*) FROM capa) capa,
 (SELECT COUNT(*) FROM documents WHERE training_course_id IS NOT NULL) docs_linked,
 (SELECT COUNT(*) FROM documents) docs_total;

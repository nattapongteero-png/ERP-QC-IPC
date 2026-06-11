-- Seed default document_types for GMP Document Control (หมวด 5)
-- Use this to fix UAT where the "Document Type" dropdown shows "ไม่พบข้อมูล"
-- (table document_types is empty on UAT, so /api/documents/types returns nothing).
--
-- Safe to re-run: INSERT IGNORE skips rows whose `code` already exists (UNIQUE KEY).
-- Mirrors the 10 default types auto-seeded by src/lib/db/seed-gmp.ts.

INSERT IGNORE INTO `document_types` (`code`, `name`, `prefix`, `approval_chain`, `review_period_months`) VALUES
  ('SOP',  'Standard Operating Procedure', 'SOP',  '["author","reviewer","approver"]',                 24),
  ('POL',  'Policy',                       'POL',  '["author","reviewer","qa_manager","management"]',  36),
  ('FORM', 'Form/Record',                  'FRM',  '["author","approver"]',                            24),
  ('WI',   'Work Instruction',             'WI',   '["author","supervisor","approver"]',               12),
  ('SPEC', 'Specification',                'SPEC', '["author","qa_reviewer","qa_manager"]',            24),
  ('MAN',  'Manual',                       'MAN',  '["author","reviewer","qa_manager","management"]',  36),
  ('PRO',  'Protocol',                     'PRO',  '["author","reviewer","qa_approver"]',              24),
  ('RPT',  'Report Template',              'RPT',  '["author","reviewer","approver"]',                 24),
  ('LOG',  'Log Book Template',            'LOG',  '["author","supervisor"]',                          24),
  ('CHK',  'Checklist',                    'CHK',  '["author","approver"]',                            12);

SELECT code, name, prefix, review_period_months FROM `document_types` ORDER BY code;

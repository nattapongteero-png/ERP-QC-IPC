-- Generate UPDATE statements from the GOOD local DB to repair UAT mojibake.
-- Run: mysql ... herbal_erp < gen-mojibake-fix.sql  (output = the fix SQL)
-- Each row is guarded so only corrupted (??? ) cells are touched on UAT.
SET SESSION group_concat_max_len = 1000000;

SELECT 'SET NAMES utf8mb4;' AS line
UNION ALL
-- bom.name (key: code)
SELECT CONCAT('UPDATE bom SET name=', QUOTE(name), ' WHERE code=', QUOTE(code), ' AND name REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM bom WHERE code IS NOT NULL AND name NOT REGEXP '[?]{3,}'
UNION ALL
-- coa_templates.name (key: product_category+language)
SELECT CONCAT('UPDATE coa_templates SET name=', QUOTE(name), ' WHERE product_category=', QUOTE(product_category), ' AND language=', QUOTE(language), ' AND name REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM coa_templates WHERE name NOT REGEXP '[?]{3,}'
UNION ALL
-- qc_samples.notes (key: sample_number)
SELECT CONCAT('UPDATE qc_samples SET notes=', QUOTE(notes), ' WHERE sample_number=', QUOTE(sample_number), ' AND notes REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM qc_samples WHERE notes IS NOT NULL AND notes <> '' AND notes NOT REGEXP '[?]{3,}'
UNION ALL
-- work_orders.notes (key: wo_number)
SELECT CONCAT('UPDATE work_orders SET notes=', QUOTE(notes), ' WHERE wo_number=', QUOTE(wo_number), ' AND notes REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM work_orders WHERE notes IS NOT NULL AND notes <> '' AND notes NOT REGEXP '[?]{3,}'
UNION ALL
-- coa_documents.revoke_reason (key: coa_number)
SELECT CONCAT('UPDATE coa_documents SET revoke_reason=', QUOTE(revoke_reason), ' WHERE coa_number=', QUOTE(coa_number), ' AND revoke_reason REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM coa_documents WHERE revoke_reason IS NOT NULL AND revoke_reason <> '' AND revoke_reason NOT REGEXP '[?]{3,}'
UNION ALL
-- bom_sop_steps.step_name_th (key: bom.code + sequence)
SELECT CONCAT('UPDATE bom_sop_steps s JOIN bom b ON s.bom_id=b.id SET s.step_name_th=', QUOTE(s.step_name_th), ' WHERE b.code=', QUOTE(b.code), ' AND s.sequence=', s.sequence, ' AND s.step_name_th REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM bom_sop_steps s JOIN bom b ON s.bom_id=b.id
  WHERE s.step_name_th IS NOT NULL AND s.step_name_th <> '' AND s.step_name_th NOT REGEXP '[?]{3,}'
UNION ALL
-- qc_sample_tests.spec_text (key: qc_samples.sample_number + sequence)
SELECT CONCAT('UPDATE qc_sample_tests t JOIN qc_samples q ON t.sample_id=q.id SET t.spec_text=', QUOTE(t.spec_text), ' WHERE q.sample_number=', QUOTE(q.sample_number), ' AND t.sequence=', t.sequence, ' AND t.spec_text REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM qc_sample_tests t JOIN qc_samples q ON t.sample_id=q.id
  WHERE t.spec_text IS NOT NULL AND t.spec_text <> '' AND t.spec_text NOT REGEXP '[?]{3,}'
UNION ALL
-- qc_sample_tests.text_result
SELECT CONCAT('UPDATE qc_sample_tests t JOIN qc_samples q ON t.sample_id=q.id SET t.text_result=', QUOTE(t.text_result), ' WHERE q.sample_number=', QUOTE(q.sample_number), ' AND t.sequence=', t.sequence, ' AND t.text_result REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM qc_sample_tests t JOIN qc_samples q ON t.sample_id=q.id
  WHERE t.text_result IS NOT NULL AND t.text_result <> '' AND t.text_result NOT REGEXP '[?]{3,}'
UNION ALL
-- coa_test_results.test_name_th (key: coa_documents.coa_number + sequence)
SELECT CONCAT('UPDATE coa_test_results r JOIN coa_documents d ON r.coa_id=d.id SET r.test_name_th=', QUOTE(r.test_name_th), ' WHERE d.coa_number=', QUOTE(d.coa_number), ' AND r.sequence=', r.sequence, ' AND r.test_name_th REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM coa_test_results r JOIN coa_documents d ON r.coa_id=d.id
  WHERE r.test_name_th IS NOT NULL AND r.test_name_th <> '' AND r.test_name_th NOT REGEXP '[?]{3,}'
UNION ALL
-- coa_test_results.specification
SELECT CONCAT('UPDATE coa_test_results r JOIN coa_documents d ON r.coa_id=d.id SET r.specification=', QUOTE(r.specification), ' WHERE d.coa_number=', QUOTE(d.coa_number), ' AND r.sequence=', r.sequence, ' AND r.specification REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM coa_test_results r JOIN coa_documents d ON r.coa_id=d.id
  WHERE r.specification IS NOT NULL AND r.specification <> '' AND r.specification NOT REGEXP '[?]{3,}'
UNION ALL
-- coa_test_results.result
SELECT CONCAT('UPDATE coa_test_results r JOIN coa_documents d ON r.coa_id=d.id SET r.result=', QUOTE(r.result), ' WHERE d.coa_number=', QUOTE(d.coa_number), ' AND r.sequence=', r.sequence, ' AND r.result REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM coa_test_results r JOIN coa_documents d ON r.coa_id=d.id
  WHERE r.result IS NOT NULL AND r.result <> '' AND r.result NOT REGEXP '[?]{3,}'
UNION ALL
-- quality_tests.spec_specification (key: sample_number + test_type)
SELECT CONCAT('UPDATE quality_tests SET spec_specification=', QUOTE(spec_specification), ' WHERE sample_number=', QUOTE(sample_number), ' AND test_type=', QUOTE(test_type), ' AND spec_specification REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM quality_tests WHERE sample_number IS NOT NULL AND spec_specification IS NOT NULL AND spec_specification <> '' AND spec_specification NOT REGEXP '[?]{3,}'
UNION ALL
-- quality_tests.result
SELECT CONCAT('UPDATE quality_tests SET result=', QUOTE(result), ' WHERE sample_number=', QUOTE(sample_number), ' AND test_type=', QUOTE(test_type), ' AND result REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM quality_tests WHERE sample_number IS NOT NULL AND result IS NOT NULL AND result <> '' AND result NOT REGEXP '[?]{3,}'
UNION ALL
-- quality_tests.notes
SELECT CONCAT('UPDATE quality_tests SET notes=', QUOTE(notes), ' WHERE sample_number=', QUOTE(sample_number), ' AND test_type=', QUOTE(test_type), ' AND notes REGEXP ', QUOTE('[?]{3,}'), ';')
  FROM quality_tests WHERE sample_number IS NOT NULL AND notes IS NOT NULL AND notes <> '' AND notes NOT REGEXP '[?]{3,}';

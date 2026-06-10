-- =====================================================================
-- Attach each bom_sop_step_ipc link to a specific SOP template SUB-STEP
-- (procedure_step_id) so the IPC test renders inline under that sub-step in
-- SOP Execution — not just at the parent-step level.
--
-- procedure_step_id references sop_template_steps.id. Those ids belong to the
-- template, so every BOM step using that template shares the same sub-steps.
-- We pick the sub-step whose meaning matches the IPC (resolved by template +
-- criteria), e.g. weight IPC -> "ตรวจน้ำหนักระหว่างผลิต", seal -> "ซีล".
--
-- Idempotent (plain UPDATEs keyed by template + criteria code).
-- =====================================================================
SET NAMES utf8mb4;

-- Helper: resolve a sub-step id by (templateId, name keyword).
-- Template 13 (SOP-IPC): plan(37) / test(38) / record(39) -> all IPC under "ทดสอบตัวอย่าง"
-- Template 11 (SOP-FILL): set-wt(31) / fill(32) / check-wt(33)
-- Template 8  (SOP-MIX):  add(22) / mix(23) / inspect(24)
-- Template 12 (SOP-PACK): fill(34) / seal(35) / label(36)
-- Template 10 (SOP-COOL): start(28) / monitor(29) / confirm(30)

-- ---- Template 13 (In-process control): everything under "ทดสอบตัวอย่าง" ----
UPDATE bom_sop_step_ipc l
JOIN bom_sop_steps s ON s.id = l.bom_step_id
SET l.procedure_step_id = (
  SELECT ts.id FROM sop_template_steps ts
  WHERE ts.template_id = 13 AND ts.step_name_th LIKE '%ทดสอบตัวอย่าง%'
  ORDER BY ts.sequence LIMIT 1)
WHERE s.template_id = 13;

-- ---- Template 11 (Capsule filling) ----
-- weight IPC -> "ตรวจน้ำหนักระหว่างผลิต"; appearance/lock -> "บรรจุแคปซูล"
UPDATE bom_sop_step_ipc l
JOIN bom_sop_steps s ON s.id = l.bom_step_id
JOIN ipc_criteria c ON c.id = l.criteria_id
SET l.procedure_step_id = (
  SELECT ts.id FROM sop_template_steps ts
  WHERE ts.template_id = 11 AND ts.step_name_th LIKE '%ตรวจน้ำหนัก%'
  ORDER BY ts.sequence LIMIT 1)
WHERE s.template_id = 11 AND c.criteria_type = 'weight';

UPDATE bom_sop_step_ipc l
JOIN bom_sop_steps s ON s.id = l.bom_step_id
JOIN ipc_criteria c ON c.id = l.criteria_id
SET l.procedure_step_id = (
  SELECT ts.id FROM sop_template_steps ts
  WHERE ts.template_id = 11 AND ts.step_name_th LIKE '%บรรจุแคปซูล%'
  ORDER BY ts.sequence LIMIT 1)
WHERE s.template_id = 11 AND c.criteria_type <> 'weight';

-- ---- Template 8 (Mixing): all IPC under "ตรวจลักษณะ" ----
UPDATE bom_sop_step_ipc l
JOIN bom_sop_steps s ON s.id = l.bom_step_id
SET l.procedure_step_id = (
  SELECT ts.id FROM sop_template_steps ts
  WHERE ts.template_id = 8 AND ts.step_name_th LIKE '%ตรวจลักษณะ%'
  ORDER BY ts.sequence LIMIT 1)
WHERE s.template_id = 8;

-- ---- Template 12 (Packaging): seal -> "ซีล", label -> "ติดฉลาก" ----
UPDATE bom_sop_step_ipc l
JOIN bom_sop_steps s ON s.id = l.bom_step_id
JOIN ipc_criteria c ON c.id = l.criteria_id
SET l.procedure_step_id = (
  SELECT ts.id FROM sop_template_steps ts
  WHERE ts.template_id = 12 AND ts.step_name_th LIKE '%ซีล%'
  ORDER BY ts.sequence LIMIT 1)
WHERE s.template_id = 12 AND c.code = 'IPC-PKG-SEAL';

UPDATE bom_sop_step_ipc l
JOIN bom_sop_steps s ON s.id = l.bom_step_id
JOIN ipc_criteria c ON c.id = l.criteria_id
SET l.procedure_step_id = (
  SELECT ts.id FROM sop_template_steps ts
  WHERE ts.template_id = 12 AND ts.step_name_th LIKE '%ติดฉลาก%'
  ORDER BY ts.sequence LIMIT 1)
WHERE s.template_id = 12 AND c.code = 'IPC-PKG-LABEL';

-- ---- Template 10 (Cooling): under "ยืนยันอุณหภูมิเป้าหมาย" ----
UPDATE bom_sop_step_ipc l
JOIN bom_sop_steps s ON s.id = l.bom_step_id
SET l.procedure_step_id = (
  SELECT ts.id FROM sop_template_steps ts
  WHERE ts.template_id = 10 AND ts.step_name_th LIKE '%ยืนยันอุณหภูมิ%'
  ORDER BY ts.sequence LIMIT 1)
WHERE s.template_id = 10;

SELECT
  (SELECT COUNT(*) FROM bom_sop_step_ipc) total,
  (SELECT COUNT(*) FROM bom_sop_step_ipc WHERE procedure_step_id IS NOT NULL) with_substep;

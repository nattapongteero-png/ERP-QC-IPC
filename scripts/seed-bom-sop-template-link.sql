-- =====================================================================
-- Map bom_sop_steps.template_id -> sop_step_templates by matching the step
-- name to a template category. Required because the WO SOP-Execution service
-- only loads inline IPC links (bom_sop_step_ipc) when the step has a
-- template_id (it gates that whole block on templateIds.length > 0).
--
-- Matching is keyword-based on step_name_th, in priority order so the most
-- specific phrase wins. Falls back to template 17 (ขั้นตอนทั่วไป).
-- Idempotent.
-- =====================================================================
SET NAMES utf8mb4;

UPDATE bom_sop_steps s
SET s.template_id = CASE
  WHEN s.step_name_th LIKE '%ความพร้อมสายการผลิต%' OR s.step_name_th LIKE '%Line clear%' THEN 1   -- line_clearance
  WHEN s.step_name_th LIKE '%ควบคุมระหว่างผลิต%'                                          THEN 13  -- ipc
  WHEN s.step_name_th LIKE '%ชั่ง%'                                                        THEN 14  -- weighing
  WHEN s.step_name_th LIKE '%จ่ายวัตถุดิบ%'                                                THEN 2   -- dispensing
  WHEN s.step_name_th LIKE '%เตรียมวัตถุดิบ%'                                              THEN 3   -- preparation
  WHEN s.step_name_th LIKE '%บด%'                                                          THEN 4   -- milling
  WHEN s.step_name_th LIKE '%ร่อน%'                                                        THEN 5   -- sieving
  WHEN s.step_name_th LIKE '%อบแห้ง%'                                                      THEN 6   -- drying
  WHEN s.step_name_th LIKE '%ผสมแห้ง%'                                                     THEN 7   -- blending
  WHEN s.step_name_th LIKE '%ต้ม%' OR s.step_name_th LIKE '%หลอม%' OR s.step_name_th LIKE '%เคี่ยว%' THEN 9   -- heating
  WHEN s.step_name_th LIKE '%ลดอุณหภูมิ%' OR s.step_name_th LIKE '%เซ็ตตัว%'               THEN 10  -- cooling
  WHEN s.step_name_th LIKE '%แคปซูล%'                                                      THEN 11  -- filling (capsule)
  WHEN s.step_name_th LIKE '%บรรจุ%' OR s.step_name_th LIKE '%ติดฉลาก%' OR s.step_name_th LIKE '%ห่อ%' OR s.step_name_th LIKE '%เทลงขวด%' THEN 12  -- packaging
  WHEN s.step_name_th LIKE '%ตรวจสอบขั้นสุดท้าย%' OR s.step_name_th LIKE '%การตรวจสอบ%'    THEN 16  -- inspection
  WHEN s.step_name_th LIKE '%ผสม%' OR s.step_name_th LIKE '%นวด%' OR s.step_name_th LIKE '%อิมัลชัน%' OR s.step_name_th LIKE '%โฮโมจีไนซ์%' THEN 8  -- mixing
  WHEN s.step_name_th LIKE '%ตอก%' OR s.step_name_th LIKE '%ขึ้นรูป%' OR s.step_name_th LIKE '%ปั้น%' THEN 8  -- forming -> mixing template
  ELSE 17  -- general
END
WHERE s.bom_id BETWEEN 1 AND 14;

SELECT s.bom_id, s.sequence, s.step_name_th, t.code template
FROM bom_sop_steps s JOIN sop_step_templates t ON t.id=s.template_id
WHERE s.bom_id = 1 ORDER BY s.sequence;

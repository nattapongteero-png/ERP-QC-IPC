-- =====================================================================
-- Link BOM SOP steps to IPC criteria (bom_sop_step_ipc) so the operator
-- sees inline IPC recording inside SOP Execution.
--
-- For each active BOM (1..14) and each phase that has IPC criteria
-- (bom_in_process_qc), pick ONE representative SOP step in that phase and
-- attach all of that phase's IPC criteria to it. Step preference:
--   1. a "control / in-process" step (ควบคุมระหว่างผลิต)
--   2. else a forming/filling step (บรรจุ / ตอก / ขึ้นรูป / ปั้น / ห่อ)
--   3. else the LAST step of that phase (highest sequence)
--
-- Idempotent: clears prior seed links first.
-- =====================================================================
SET NAMES utf8mb4;

DELETE FROM bom_sop_step_ipc
WHERE bom_step_id IN (SELECT id FROM bom_sop_steps WHERE bom_id BETWEEN 1 AND 14);

-- Resolve the target SOP step per (bom_id, phase) into a temp table.
DROP TEMPORARY TABLE IF EXISTS _ipc_target_step;
CREATE TEMPORARY TABLE _ipc_target_step AS
SELECT q.bom_id, q.phase,
  (
    SELECT s.id FROM bom_sop_steps s
    WHERE s.bom_id = q.bom_id AND s.phase = q.phase
    ORDER BY
      -- priority 1: control / in-process step
      (s.step_name_th LIKE '%ควบคุมระหว่างผลิต%') DESC,
      -- priority 2: forming / filling / packing steps
      (s.step_name_th LIKE '%บรรจุ%'
        OR s.step_name_th LIKE '%ตอก%'
        OR s.step_name_th LIKE '%ขึ้นรูป%'
        OR s.step_name_th LIKE '%ปั้น%'
        OR s.step_name_th LIKE '%ห่อ%'
        OR s.step_name_th LIKE '%เท%') DESC,
      -- priority 3: last step of the phase
      s.sequence DESC
    LIMIT 1
  ) AS step_id
FROM (SELECT DISTINCT bom_id, phase FROM bom_in_process_qc WHERE bom_id BETWEEN 1 AND 14) q;

-- Insert one link per IPC criterion, attached to the resolved step.
INSERT INTO bom_sop_step_ipc
  (bom_step_id, procedure_step_id, criteria_id, sequence, sample_size, is_critical, notes)
SELECT
  t.step_id,
  NULL,                 -- step-level (no sub-step); renders under the step
  q.criteria_id,
  q.sequence,
  q.sample_size,
  q.is_critical,
  'ผูกอัตโนมัติ (seed): IPC ในขั้นตอน SOP'
FROM bom_in_process_qc q
JOIN _ipc_target_step t ON t.bom_id = q.bom_id AND t.phase = q.phase
WHERE q.bom_id BETWEEN 1 AND 14
  AND t.step_id IS NOT NULL;

DROP TEMPORARY TABLE IF EXISTS _ipc_target_step;

SELECT (SELECT COUNT(*) FROM bom_sop_step_ipc) total_links,
       (SELECT COUNT(DISTINCT bom_step_id) FROM bom_sop_step_ipc) steps_with_ipc;

-- Create the work centres that production costing needs.
--
-- Backup: /home/bms/wc_backup_20260729.sql (table was empty; kept for symmetry)
--
-- WHY THESE SIX, AND WHERE THE NAMES COME FROM
-- work_centers was empty, so labour and overhead could not be costed at all:
-- the cost dashboard showed Labour Efficiency 0.0% and Production Cost 0 with
-- "ไม่มีข้อมูลศูนย์งาน". The names are NOT invented — they are the actual
-- production steps already recorded in bom_sop_steps across 36 BOMs (152 rows),
-- grouped by the stage they belong to:
--
--   WC-WGH  Weighing (24) · Weighing Raw Materials · Material Preparation (3)
--   WC-BLD  Blending (6) · Dry blending (4) · Mixing · Kneading · Milling ·
--           Sieving · Homogenizing · Emulsification
--   WC-CAP  Capsule filling (7) · Tablet compression · Molding · Bolus forming
--   WC-LIQ  Syrup heating/boiling · Filtration · Cooling · Oil blending
--   WC-PAK  Bottling & labeling (11) · Sachet filling (3) · Blister packing ·
--           Filling & labeling · บรรจุเม็ดยาลงแผง
--   WC-QCL  Line clearance (24) · In-process check (3) · Final inspection (5) ·
--           IPC Check · Cleaning
--
-- RATES
-- labor_rate_per_hour = 360 for every centre, because 360 is the labour rate the
-- system ALREADY uses: standard_costs.standard_labor_rate is 360.0000, and the
-- variance calculation prices labour at that figure. Using anything else would
-- make the new centres disagree with variances already posted.
--
-- overhead_rate_per_hour is set to 0, deliberately. There is no overhead figure
-- anywhere in this database to derive one from, and inventing a number would
-- silently inflate every product cost. 0 means "not yet determined" and is
-- honest; the factory can enter real rates per centre on the edit screen.
-- Same for machine_rate_per_hour.
--
-- capacity_hours_per_day = 8 matches the form's own default (one shift).

USE herbal_erp_uat;

START TRANSACTION;

INSERT INTO work_centers
  (code, name, name_th, labor_rate_per_hour, overhead_rate_per_hour,
   machine_rate_per_hour, capacity_hours_per_day, is_active, created_at, updated_at)
SELECT * FROM (
  SELECT 'WC-WGH' code, 'Weighing & Dispensing' nm, 'ชั่งและจ่ายวัตถุดิบ' nth,
         360.0000 lr, 0.0000 orr, 0.0000 mr, 8.00 cap, 1 act, NOW() ca, NOW() ua
  UNION ALL SELECT 'WC-BLD','Blending & Granulation','ผสมและแกรนูล',360.0000,0.0000,0.0000,8.00,1,NOW(),NOW()
  UNION ALL SELECT 'WC-CAP','Capsule & Tablet','บรรจุแคปซูลและตอกเม็ด',360.0000,0.0000,0.0000,8.00,1,NOW(),NOW()
  UNION ALL SELECT 'WC-LIQ','Liquid Preparation','เตรียมของเหลว',360.0000,0.0000,0.0000,8.00,1,NOW(),NOW()
  UNION ALL SELECT 'WC-PAK','Packaging & Labeling','บรรจุและติดฉลาก',360.0000,0.0000,0.0000,8.00,1,NOW(),NOW()
  UNION ALL SELECT 'WC-QCL','Line Clearance & IPC','เคลียร์ไลน์และตรวจระหว่างผลิต',360.0000,0.0000,0.0000,8.00,1,NOW(),NOW()
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM work_centers wc WHERE wc.code = seed.code);

COMMIT;

SELECT id, code, name_th, labor_rate_per_hour, overhead_rate_per_hour,
       capacity_hours_per_day, is_active
FROM work_centers ORDER BY code;

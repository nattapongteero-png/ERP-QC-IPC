-- PK-0001 / PK-0002: standard_cost holds the price per SECONDARY unit (capsule)
-- while the column is per PRIMARY unit (box).
--
-- Backup: /home/bms/items_backup_20260729.sql
-- (verified: 1 CREATE TABLE, 1 INSERT, "Dump completed" footer)
--
-- EVIDENCE
--   PK-0001: primary_unit = box, secondary_unit = cap, conversion_rate = 5000
--            standard_cost = 0.0192  ->  0.0192 x 5000 = 96.00
--            and a real lot EXISTS at cost 96.0000/box.
--   PK-0002: 0.0236 x 5000 = 118.00, and a real lot exists at 118.0000/box.
--   Sibling PK-0004 stores 30.00 per box directly, so per-box IS the convention
--   for this column.
--
-- NOT TOUCHED, deliberately:
--   RM-0002 (420), RM-0003 (1850), WIP-0001 (480), WIP-0002 (530) all have
--   standard_cost equal to their MAXIMUM lot cost — those are ordinary price
--   ranges, not unit errors, and multiplying them by conversion_rate would give
--   absurd figures (RM-0002 would become 420,000/kg).
--   PK-0003 (3.50 x 100 = 350, max lot 350) fits the same pattern as PK-0001/2,
--   but is left for the same review: see the note at the bottom.
--
-- Effect: the cost summary report stops showing 0.0192 as the standard cost of a
-- box that actually costs about 96 baht.

USE herbal_erp_uat;

START TRANSACTION;

UPDATE items
SET standard_cost = ROUND(standard_cost * conversion_rate, 4),
    updated_at = NOW()
WHERE code IN ('PK-0001', 'PK-0002')
  AND primary_unit = 'box'
  AND conversion_rate = 5000
  AND standard_cost < 1;

COMMIT;

-- Expect PK-0001 = 96.0000 and PK-0002 = 118.0000, both inside their lot ranges.
SELECT code, primary_unit, secondary_unit, conversion_rate, standard_cost
FROM items
WHERE code IN ('PK-0001', 'PK-0002', 'PK-0003', 'PK-0004')
ORDER BY code;

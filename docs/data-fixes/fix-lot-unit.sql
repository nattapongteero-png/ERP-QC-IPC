-- Correct the gram/kilogram unit error on RM-0001 (PO2026-0025 and its lots).
--
-- Backup: /home/bms/lots_po_backup_20260729.sql
-- (verified: 2 CREATE TABLE, 2 INSERT, "Dump completed" footer)
--
-- WHY THE UNIT IS WRONG AND NOT THE PRICE
--   * PO2026-0023, raised the SAME DAY (2026-06-30), buys RM-0001 at 1,425 per
--     "กก." — the identical price with a kilogram unit. 0025 is the same
--     purchase typed with the wrong unit.
--   * Other RM-0001 purchases price grams at 0.15–0.17, i.e. 150–170 per kg,
--     the same order of magnitude as 1,425/kg for a different grade.
--   * If 1,425 really were per gram it would be 1,425,000 per kilogram of
--     turmeric powder, which is not a real price.
--   * items.standard_cost is 350 and primary_unit is kg — the costing basis for
--     this item is per kilogram.
--
-- So: keep cost = 1425, change the unit to kg, and convert the quantity from
-- grams to kilograms so quantity * cost stays a true value.
--   lot 323: 24,990 g -> 24.99 kg  ->  24.99 * 1425 = 35,610.75
--   lot 293:     10 g -> 0.01 kg   ->   0.01 * 1425 =     14.25
--   PO line 67: 25,000 g -> 25 kg  ->     25 * 1425 = 35,625.00

USE herbal_erp_uat;

START TRANSACTION;

-- Lots: grams -> kilograms, unit relabelled to match the cost basis.
UPDATE inventory_lots
SET quantity = quantity / 1000,
    unit = 'kg',
    updated_at = NOW()
WHERE id IN (293, 323)
  AND unit = 'g'
  AND cost = 1425.0000;

-- The PO line carries the same mistake; leaving it would re-create the problem
-- on any further receipt against this PO, and makes the document disagree with
-- the stock it produced.
UPDATE purchase_order_lines
SET quantity = quantity / 1000,
    unit = 'kg',
    total_price = ROUND((quantity / 1000) * unit_price, 2)
WHERE id = 67
  AND unit = 'g'
  AND unit_price = 1425.00;

COMMIT;

-- Verify: values should now be 35,610.75 / 14.25 / 35,625.00
SELECT l.id, l.lot_number, l.quantity, l.unit, l.cost,
       ROUND(l.quantity * l.cost, 2) AS lot_value
FROM inventory_lots l
WHERE l.id IN (293, 323);

SELECT pol.id, pol.quantity, pol.unit, pol.unit_price, pol.total_price
FROM purchase_order_lines pol
WHERE pol.id = 67;

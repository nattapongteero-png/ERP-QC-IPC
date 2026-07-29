-- Same gram/kilogram error on RM-0005 (ผงขิง), 4 purchase order lines.
--
-- Backup: /home/bms/lots_po_backup_20260729.sql
--
-- EVIDENCE THE UNIT IS WRONG, NOT THE PRICE
--   * Line 77 (PO2026-0032) buys the same item at 0.15 per GRAM = 150 per kg.
--     Lines 68/95/96 use 150 per GRAM — the per-kilogram price against a gram
--     quantity. Line 97 uses 142.50, the same figure discounted.
--   * items.standard_cost for RM-0005 is 250 with primary_unit kg, and line 16
--     buys 60 kg at 280/kg. A price of 150/kg sits in that range;
--     150,000/kg for ginger powder does not.
--
-- All four lines are status = draft with received_quantity = 0, so no stock or
-- costing has been derived from them yet — this corrects the documents before
-- they can produce another 35-million-baht lot.
--
-- Convert quantity grams -> kilograms, relabel the unit, and restate
-- total_price. total_price is computed in a SEPARATE statement: MySQL evaluates
-- SET clauses left to right and later clauses see already-updated columns, so
-- doing both at once divides the quantity twice (that mistake produced 35.63
-- instead of 35,625.00 on PO2026-0025 earlier today).

USE herbal_erp_uat;

START TRANSACTION;

UPDATE purchase_order_lines
SET quantity = quantity / 1000,
    unit = 'kg'
WHERE id IN (68, 95, 96, 97)
  AND unit = 'g';

UPDATE purchase_order_lines
SET total_price = ROUND(quantity * unit_price, 2)
WHERE id IN (68, 95, 96, 97);

-- Keep each header in step with its own lines.
UPDATE purchase_orders po
SET total_amount = (
      SELECT ROUND(SUM(total_price), 2)
      FROM purchase_order_lines
      WHERE po_id = po.id
    ),
    updated_at = NOW()
WHERE po.po_number IN ('PO2026-0026', 'PO2026-0047', 'PO2026-0048', 'PO2026-0049');

COMMIT;

-- Expect: 50 kg x 150 = 7,500 · 10 kg x 150 = 1,500 · 20 kg x 150 = 3,000
--         25 kg x 142.50 = 3,562.50
SELECT pol.id, pol.quantity, pol.unit, pol.unit_price, pol.total_price,
       po.po_number, po.total_amount
FROM purchase_order_lines pol
JOIN purchase_orders po ON pol.po_id = po.id
WHERE pol.id IN (68, 95, 96, 97);

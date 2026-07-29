-- PO2026-0025 header still carries the pre-correction total.
--
-- The line was fixed to 25 kg x 1,425 = 35,625.00, but purchase_orders.
-- total_amount was left at 35,625,000.00 — the header and its own lines now
-- disagree by a factor of 1,000, which is exactly the kind of split that makes
-- a purchasing report irreconcilable.
--
-- subtotal_amount and vat_amount are NULL on this record, so only total_amount
-- is restated, from the line sum.
--
-- Backup: /home/bms/lots_po_backup_20260729.sql

USE herbal_erp_uat;

UPDATE purchase_orders po
SET total_amount = (
      SELECT ROUND(SUM(total_price), 2)
      FROM purchase_order_lines
      WHERE po_id = po.id
    ),
    updated_at = NOW()
WHERE po.po_number = 'PO2026-0025';

SELECT po.po_number, po.total_amount,
       (SELECT SUM(total_price) FROM purchase_order_lines WHERE po_id = po.id) AS lines_sum
FROM purchase_orders po
WHERE po.po_number = 'PO2026-0025';

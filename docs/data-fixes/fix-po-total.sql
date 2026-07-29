-- Repair purchase_order_lines.id = 67 total_price.
--
-- My previous statement did:
--   SET quantity = quantity / 1000,
--       total_price = ROUND((quantity / 1000) * unit_price, 2)
-- MySQL evaluates SET clauses left to right and later clauses SEE the already
-- updated column, so `quantity` in the total_price expression was the ALREADY
-- divided 25, and it got divided a second time: 25/1000 * 1425 = 35.63 instead
-- of 25 * 1425 = 35,625.00.
--
-- quantity and unit are correct (25 kg); only total_price needs restating.

USE herbal_erp_uat;

UPDATE purchase_order_lines
SET total_price = ROUND(quantity * unit_price, 2)
WHERE id = 67;

SELECT id, quantity, unit, unit_price, total_price
FROM purchase_order_lines
WHERE id = 67;

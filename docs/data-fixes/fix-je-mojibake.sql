-- Repair the two journal descriptions whose customer name is mojibake.
--
-- Backup: /home/bms/je_backup_20260729.sql (verified: CREATE TABLE + footer)
--
-- WHAT HAPPENED
-- JE-202607-000037 and -000038 read:
--   "ต้นทุนขาย: SO2607283593 - �ç��Һ������ع�� (Delivery: DL-202607-00xx)"
-- The Thai words "ต้นทุนขาย" are fine (E0B895…), so the column and connection
-- are UTF-8. Only the customer name is broken, and it contains EFBFBD bytes —
-- U+FFFD, the replacement character. That is the signature of text that passed
-- through a non-UTF-8 shell, which is exactly how I created this test sales
-- order earlier in the session.
--
-- The customers row itself is INTACT: customer id 1 is
-- "โรงพยาบาลไทยสมุนไพร" in valid UTF-8. Only the copy denormalised into the
-- journal description was damaged, so the correct text is recovered from the
-- source table rather than retyped.
--
-- Only these 2 rows are affected — a HEX(...) LIKE '%EFBFBD%' sweep over
-- journal_entries returns exactly these two.

USE herbal_erp_uat;

START TRANSACTION;

UPDATE journal_entries je
JOIN sales_orders so ON so.so_number = 'SO2607283593'
JOIN customers c ON c.id = so.customer_id
SET je.description = CONCAT(
      SUBSTRING_INDEX(je.description, ' - ', 1),
      ' - ', c.name, ' ',
      SUBSTRING(je.description, LOCATE('(Delivery:', je.description))
    )
WHERE je.id IN (127, 128)
  AND HEX(je.description) LIKE '%EFBFBD%'
  AND LOCATE('(Delivery:', je.description) > 0;

COMMIT;

-- Expect the customer name to read โรงพยาบาลไทยสมุนไพร and no EFBFBD left.
SELECT id, entry_number, description,
       HEX(description) LIKE '%EFBFBD%' AS still_broken
FROM journal_entries
WHERE id IN (127, 128);

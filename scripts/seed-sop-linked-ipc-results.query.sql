-- Input query for seed-sop-linked-ipc-results.cjs.
-- Run this first and save the TSV output to scripts/_ipc-data.tsv, then run
-- the .cjs generator, then apply its scripts/_sop-ipc-results.sql output:
--
--   docker exec -i herbal-erp-uat-mysql sh -c \
--     'mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD" herbal_erp_uat -N' \
--     < scripts/seed-sop-linked-ipc-results.query.sql > scripts/_ipc-data.tsv
--   node scripts/seed-sop-linked-ipc-results.cjs
--   docker exec -i herbal-erp-uat-mysql sh -c \
--     'mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD" herbal_erp_uat' \
--     < scripts/_sop-ipc-results.sql
SELECT w.id, w.status, e.id, e.status, l.criteria_id, c.criteria_type,
       c.min_value, c.max_value, c.spec_tolerance_percent, c.sample_size, c.unit,
       (SELECT phase FROM bom_sop_steps s2 WHERE s2.id=e.bom_step_id) ph,
       (SELECT id FROM inventory_lots il WHERE il.lot_number=CONCAT(w.batch_number,'-IP') LIMIT 1) lot
FROM work_orders w
JOIN wo_sop_execution e ON e.work_order_id=w.id
JOIN bom_sop_steps s ON s.id=e.bom_step_id
JOIN bom_sop_step_ipc l ON l.bom_step_id=s.id
JOIN ipc_criteria c ON c.id=l.criteria_id
WHERE w.status IN ('in_progress','completed')
ORDER BY w.id, e.id, l.sequence;

-- =====================================================================
-- Fix empty "มูลค่า / ราคาทุน" columns on /inventory/items.
-- The value/cost columns are driven by items.on_hand_cost (มูลค่า) and
-- on_hand_cost / on_hand (ราคาทุน per unit). Items seeded during the BOM/
-- module rebuild (ids 14+) and a few others have on_hand_cost=0 +
-- current_wac=NULL, and their lots carry a placeholder cost=10 — so both
-- columns render blank.
--
-- Fix: assign realistic per-type unit costs to the placeholder lots, then
-- recompute each item's on_hand, on_hand_cost, current_wac, standard_cost
-- from its released lots. Touches ONLY items whose cost is empty (keeps the
-- already-correct original + (more) items intact).
-- =====================================================================
SET NAMES utf8mb4;

-- 1. Replace placeholder lot cost (=10) on lots of empty-cost items with a
--    realistic per-type unit cost. Leaves real-cost lots untouched.
UPDATE inventory_lots l
JOIN items i ON i.id = l.item_id
SET l.cost = CASE i.type
  WHEN 'raw_material'   THEN 250
  WHEN 'packaging'      THEN 30
  WHEN 'wip'            THEN 400
  WHEN 'finished_goods' THEN 120
  WHEN 'consumable'     THEN 80
  ELSE 100
END
WHERE (i.on_hand_cost IS NULL OR i.on_hand_cost = 0)
  AND (l.cost IS NULL OR l.cost = 10);

-- 2. Recompute item aggregates from released lots, for the empty items only.
UPDATE items i
JOIN (
  SELECT item_id,
         SUM(quantity)                                            AS on_hand,
         SUM(quantity * cost)                                     AS on_hand_cost,
         ROUND(SUM(quantity * cost) / NULLIF(SUM(quantity), 0), 4) AS wac
  FROM inventory_lots
  WHERE status = 'released'
  GROUP BY item_id
) agg ON agg.item_id = i.id
SET i.on_hand      = agg.on_hand,
    i.on_hand_cost = agg.on_hand_cost,
    i.current_wac  = agg.wac,
    i.standard_cost = COALESCE(NULLIF(i.standard_cost, 0), agg.wac)
WHERE (i.on_hand_cost IS NULL OR i.on_hand_cost = 0);

-- report
SELECT
  CASE WHEN code LIKE '%-MORE' THEN 'more' ELSE 'non-more' END grp,
  COUNT(*) total,
  SUM(on_hand_cost > 0) has_value,
  SUM(on_hand_cost IS NULL OR on_hand_cost = 0) still_empty
FROM items GROUP BY grp;
